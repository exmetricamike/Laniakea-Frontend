import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/keys";
import type {
  ChartPayload,
  PortfolioSummary,
  SystemCommand,
  SystemEquity,
  TradingSystem,
} from "@/lib/api/types";
import { handleEngineEvent, onGap, onResync } from "@/lib/ws/handlers";
import type { EngineEvent } from "@/lib/ws/events";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("react-toastify", () => ({ toast: { error: toastError } }));

function client(): QueryClient {
  return new QueryClient();
}

function event(value: Record<string, unknown>): EngineEvent {
  return value as EngineEvent;
}

function invalidated(client: QueryClient, key: readonly unknown[]): boolean {
  return client.getQueryState(key)?.isInvalidated === true;
}

const system = {
  id: 42,
  state: "running",
  desired_state: "running",
  state_reason: "",
  allowed_actions: ["stop"],
} as TradingSystem;

describe("WebSocket cache handlers", () => {
  it("patches system state and invalidates list summaries", () => {
    const queryClient = client();
    queryClient.setQueryData(queryKeys.system.detail(42), system);
    queryClient.setQueryData(queryKeys.systems({}), []);
    queryClient.setQueryData(queryKeys.portfolio.summary("paper", "today", false), {});
    handleEngineEvent(
      queryClient,
      event({
        type: "system.state",
        channel: "system.42",
        seq: 1,
        time: "now",
        data: {
          id: 42,
          state: "halted",
          desired_state: "stopped",
          state_reason: "Risk",
          allowed_actions: ["ack"],
        },
      }),
    );
    expect(queryClient.getQueryData<TradingSystem>(queryKeys.system.detail(42))?.state).toBe(
      "halted",
    );
    expect(invalidated(queryClient, queryKeys.systems({}))).toBe(true);
    expect(invalidated(queryClient, queryKeys.portfolio.summary("paper", "today", false))).toBe(
      true,
    );
  });

  it("handles system and portfolio summaries", () => {
    const queryClient = client();
    queryClient.setQueryData(queryKeys.systems({}), []);
    const summary = {
      mode: "paper",
      as_of: "now",
      period: "today",
      buckets: [],
      systems: [],
      alerts: [],
    } as PortfolioSummary;
    handleEngineEvent(
      queryClient,
      event({ type: "system.summary", channel: "portfolio", seq: 1, time: "now", data: system }),
    );
    expect(invalidated(queryClient, queryKeys.systems({}))).toBe(true);
    handleEngineEvent(
      queryClient,
      event({
        type: "portfolio.summary",
        channel: "portfolio",
        seq: 2,
        time: "now",
        data: summary,
      }),
    );
    expect(queryClient.getQueryData(queryKeys.portfolio.summary("paper", "today", false))).toBe(
      summary,
    );
  });

  it("invalidates order, fill, and trade collections", () => {
    const queryClient = client();
    const orderKey = queryKeys.system.orders(42, { status: "open" });
    const fillKey = queryKeys.system.fills(42, {});
    const tradeKey = queryKeys.system.trades(42, { status: "all" });
    const performanceKey = queryKeys.system.performance(42, "all");
    queryClient.setQueryData(orderKey, []);
    queryClient.setQueryData(fillKey, []);
    queryClient.setQueryData(tradeKey, []);
    queryClient.setQueryData(performanceKey, {});
    handleEngineEvent(
      queryClient,
      event({ type: "order.updated", channel: "system.42", seq: 1, time: "now", data: { id: 1 } }),
    );
    handleEngineEvent(
      queryClient,
      event({ type: "fill", channel: "system.42", seq: 2, time: "now", data: { id: 2 } }),
    );
    handleEngineEvent(
      queryClient,
      event({ type: "trade.updated", channel: "system.42", seq: 3, time: "now", data: { id: 3 } }),
    );
    expect(invalidated(queryClient, orderKey)).toBe(true);
    expect(invalidated(queryClient, fillKey)).toBe(true);
    expect(invalidated(queryClient, tradeKey)).toBe(true);
    expect(invalidated(queryClient, performanceKey)).toBe(true);
  });

  it("sets the current position", () => {
    const queryClient = client();
    const position = {
      size: "1",
      side: "long",
      avg_price: "10",
      mark_price: "11",
      marked_at: "now",
    };
    handleEngineEvent(
      queryClient,
      event({ type: "position", channel: "system.42", seq: 1, time: "now", data: position }),
    );
    expect(queryClient.getQueryData(queryKeys.system.position(42))).toEqual(position);
  });

  it("appends and replaces equity points", () => {
    const queryClient = client();
    const key = queryKeys.system.equity(42, "default");
    queryClient.setQueryData(key, {
      interval: "1h",
      t: [1],
      value: ["1"],
      drawdown: [0],
      realised: ["0"],
      unrealised: ["1"],
    } as SystemEquity);
    handleEngineEvent(
      queryClient,
      event({
        type: "equity",
        channel: "system.42",
        seq: 1,
        time: "now",
        data: { t: 1, value: "2", drawdown: 0.1, realised: "1", unrealised: "1" },
      }),
    );
    handleEngineEvent(
      queryClient,
      event({
        type: "equity",
        channel: "system.42",
        seq: 2,
        time: "now",
        data: { t: 2, value: "3", drawdown: 0, realised: "2", unrealised: "1" },
      }),
    );
    expect(queryClient.getQueryData<SystemEquity>(key)?.t).toEqual([1, 2]);
    expect(queryClient.getQueryData<SystemEquity>(key)?.value).toEqual(["2", "3"]);
  });

  it("appends chart bars", () => {
    const queryClient = client();
    const key = queryKeys.system.chart(42, "default");
    queryClient.setQueryData(key, {
      t: [1],
      open: ["1"],
      high: ["1"],
      low: ["1"],
      close: ["1"],
      volume: ["1"],
      indicators: {},
      markers: [],
      open_orders: [],
    } as ChartPayload);
    handleEngineEvent(
      queryClient,
      event({
        type: "bar",
        channel: "system.42",
        seq: 1,
        time: "now",
        data: { t: 2, open: "2", high: "3", low: "1", close: "2", volume: "4" },
      }),
    );
    handleEngineEvent(
      queryClient,
      event({
        type: "bar",
        channel: "system.42",
        seq: 2,
        time: "now",
        data: { t: 2, open: "2", high: "4", low: "1", close: "3", volume: "5" },
      }),
    );
    expect(queryClient.getQueryData<ChartPayload>(key)?.close).toEqual(["1", "3"]);
  });

  it("upserts commands and updates command status", () => {
    const queryClient = client();
    const command = { id: 7, system: 42, status: "done" } as SystemCommand;
    const key = queryKeys.system.commands(42, {});
    queryClient.setQueryData(key, {
      pages: [{ results: [], next: null, count: 0 }],
      pageParams: [""],
    });
    handleEngineEvent(
      queryClient,
      event({ type: "command.updated", channel: "system.42", seq: 1, time: "now", data: command }),
    );
    const cached = queryClient.getQueryData<{ pages: Array<{ results: SystemCommand[] }> }>(key);
    expect(cached?.pages[0].results).toEqual([command]);
    expect(queryClient.getQueryData(["system", 42, "command-status", 7])).toEqual(command);
  });

  it("invalidates events, alerts, risk, account, and portfolio caches", () => {
    const queryClient = client();
    const eventKey = queryKeys.system.events(42, {});
    queryClient.setQueryData(eventKey, []);
    queryClient.setQueryData(queryKeys.systems({}), []);
    queryClient.setQueryData(queryKeys.risk(), []);
    queryClient.setQueryData(queryKeys.accounts(), []);
    queryClient.setQueryData(queryKeys.account(7), {});
    handleEngineEvent(
      queryClient,
      event({ type: "event", channel: "system.42", seq: 1, time: "now", data: { id: 1 } }),
    );
    handleEngineEvent(
      queryClient,
      event({
        type: "alert",
        channel: "portfolio",
        seq: 2,
        time: "now",
        data: { system: 42, kind: "halted", severity: "error", message: "Halted", time: "now" },
      }),
    );
    handleEngineEvent(
      queryClient,
      event({ type: "kill_switch", channel: "portfolio", seq: 3, time: "now", data: {} }),
    );
    handleEngineEvent(
      queryClient,
      event({
        type: "account.updated",
        channel: "portfolio",
        seq: 4,
        time: "now",
        data: { deleted: true, id: 7 },
      }),
    );
    expect(invalidated(queryClient, eventKey)).toBe(true);
    expect(toastError).toHaveBeenCalledWith("Halted");
    expect(invalidated(queryClient, queryKeys.risk())).toBe(true);
    expect(invalidated(queryClient, queryKeys.accounts())).toBe(true);
    expect(invalidated(queryClient, queryKeys.account(7))).toBe(true);
  });

  it("patches completed backtests and invalidates their collections", () => {
    const queryClient = client();
    queryClient.setQueryData(queryKeys.backtest(3), { id: 3, status: "running", progress: 0 });
    queryClient.setQueryData(queryKeys.backtests({}), []);
    handleEngineEvent(
      queryClient,
      event({
        type: "backtest.progress",
        channel: "backtest.3",
        seq: 1,
        time: "now",
        data: { id: 3, status: "done", progress: 1 },
      }),
    );
    expect(queryClient.getQueryData<{ status: string }>(queryKeys.backtest(3))?.status).toBe(
      "done",
    );
    expect(invalidated(queryClient, queryKeys.backtest(3))).toBe(true);
    expect(invalidated(queryClient, queryKeys.backtests({}))).toBe(true);
  });

  it("invalidates channels on gaps and resync", () => {
    const queryClient = client();
    queryClient.setQueryData(queryKeys.portfolio.orders("paper"), []);
    queryClient.setQueryData(queryKeys.system.detail(42), system);
    queryClient.setQueryData(queryKeys.backtest(3), {});
    onGap(queryClient, "portfolio");
    onResync(queryClient, ["system.42", "backtest.3"]);
    expect(invalidated(queryClient, queryKeys.portfolio.orders("paper"))).toBe(true);
    expect(invalidated(queryClient, queryKeys.system.detail(42))).toBe(true);
    expect(invalidated(queryClient, queryKeys.backtest(3))).toBe(true);
  });
});
