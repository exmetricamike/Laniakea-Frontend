import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { queryKeys } from "@/lib/api/keys";
import type {
  ChartPayload,
  PaginatedList,
  SystemCommand,
  SystemEquity,
  TradingSystem,
} from "@/lib/api/types";
import type { EngineEvent, SystemChartPoint, SystemEquityPoint } from "@/lib/ws/events";

function systemId(channel: string): number | null {
  const match = /^system\.(\d+)$/.exec(channel);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

function invalidate(client: QueryClient, queryKey: QueryKey): void {
  void client.invalidateQueries({ queryKey });
}

function isEquity(value: unknown): value is SystemEquity {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.t) &&
    Array.isArray(row.value) &&
    Array.isArray(row.drawdown) &&
    Array.isArray(row.realised) &&
    Array.isArray(row.unrealised)
  );
}

function isChart(value: unknown): value is ChartPayload {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.t) &&
    Array.isArray(row.open) &&
    Array.isArray(row.high) &&
    Array.isArray(row.low) &&
    Array.isArray(row.close) &&
    Array.isArray(row.volume)
  );
}

function replaceOrAppend<T>(rows: T[], value: T, replace: boolean): T[] {
  if (!replace) return [...rows, value];
  return [...rows.slice(0, -1), value];
}

function appendEquity(client: QueryClient, id: number, point: SystemEquityPoint): void {
  const queries = client.getQueryCache().findAll({ queryKey: ["system", id, "equity"] });
  queries.forEach((query) => {
    client.setQueryData<SystemEquity>(query.queryKey, (current) => {
      if (!isEquity(current)) return current;
      const last = current.t.at(-1);
      const replace = last === point.t;
      return {
        ...current,
        t: replaceOrAppend(current.t, point.t, replace),
        value: replaceOrAppend(current.value, point.value, replace),
        drawdown: replaceOrAppend(current.drawdown, point.drawdown, replace),
        realised: replaceOrAppend(current.realised, point.realised, replace),
        unrealised: replaceOrAppend(current.unrealised, point.unrealised, replace),
      };
    });
  });
}

function appendChart(client: QueryClient, id: number, point: SystemChartPoint): void {
  const queries = client.getQueryCache().findAll({ queryKey: ["system", id, "chart"] });
  queries.forEach((query) => {
    client.setQueryData<ChartPayload>(query.queryKey, (current) => {
      if (!isChart(current)) return current;
      const replace = current.t.at(-1) === point.t;
      return {
        ...current,
        t: replaceOrAppend(current.t, point.t, replace),
        open: replaceOrAppend(current.open, point.open, replace),
        high: replaceOrAppend(current.high, point.high, replace),
        low: replaceOrAppend(current.low, point.low, replace),
        close: replaceOrAppend(current.close, point.close, replace),
        volume: replaceOrAppend(current.volume, point.volume, replace),
      };
    });
  });
}

function isCommandPages(value: unknown): value is { pages: PaginatedList<SystemCommand>[] } {
  if (typeof value !== "object" || value === null) return false;
  const pages = (value as Record<string, unknown>).pages;
  return Array.isArray(pages);
}

function upsertCommand(client: QueryClient, command: SystemCommand): void {
  const queries = client.getQueryCache().findAll({
    queryKey: ["system", command.system, "commands"],
  });
  queries.forEach((query) => {
    client.setQueryData(query.queryKey, (current) => {
      if (!isCommandPages(current) || !current.pages.length) return current;
      const [first, ...rest] = current.pages;
      const existing = first.results.some((row) => row.id === command.id);
      const results = existing
        ? first.results.map((row) => (row.id === command.id ? command : row))
        : [command, ...first.results];
      return {
        ...current,
        pages: [
          {
            ...first,
            results,
            count: first.count === null || existing ? first.count : first.count + 1,
          },
          ...rest,
        ],
      };
    });
  });
  client.setQueryData(["system", command.system, "command-status", command.id], command);
}

function patchSystemState(
  client: QueryClient,
  event: EngineEvent & { type: "system.state" },
): void {
  client.setQueryData<TradingSystem>(queryKeys.system.detail(event.data.id), (current) =>
    current ? { ...current, ...event.data } : current,
  );
  invalidate(client, ["systems"]);
  invalidate(client, ["portfolio", "summary"]);
}

export function handleEngineEvent(client: QueryClient, event: EngineEvent): void {
  if (event.type === "system.state") {
    patchSystemState(client, event);
    return;
  }
  if (event.type === "system.summary") {
    invalidate(client, ["systems"]);
    invalidate(client, ["portfolio", "summary"]);
    return;
  }
  if (event.type === "portfolio.summary") {
    client.setQueryData(queryKeys.portfolio.summary(event.data.mode, "today", false), event.data);
    return;
  }
  if (event.type === "order.updated") {
    const id = systemId(event.channel);
    if (id !== null) invalidate(client, ["system", id, "orders"]);
    invalidate(client, ["portfolio", "orders"]);
    return;
  }
  if (event.type === "fill" || event.type === "trade.updated") {
    const id = systemId(event.channel);
    if (id !== null) {
      invalidate(client, ["system", id, event.type === "fill" ? "fills" : "trades"]);
      invalidate(client, ["system", id, "performance"]);
    }
    invalidate(client, ["portfolio", "trades"]);
    invalidate(client, ["portfolio", "positions"]);
    return;
  }
  if (event.type === "position") {
    const id = systemId(event.channel);
    if (id !== null) client.setQueryData(queryKeys.system.position(id), event.data);
    return;
  }
  if (event.type === "equity") {
    const id = systemId(event.channel);
    if (id !== null) appendEquity(client, id, event.data);
    return;
  }
  if (event.type === "bar") {
    const id = systemId(event.channel);
    if (id !== null) appendChart(client, id, event.data);
    return;
  }
  if (event.type === "command.updated") {
    upsertCommand(client, event.data);
    return;
  }
  if (event.type === "event") {
    const id = systemId(event.channel);
    if (id !== null) invalidate(client, ["system", id, "events"]);
    return;
  }
  if (event.type === "alert") {
    toast.error(event.data.message);
    invalidate(client, ["systems"]);
    return;
  }
  if (event.type === "kill_switch" || event.type === "account.updated") {
    invalidate(client, queryKeys.risk());
    invalidate(client, queryKeys.accounts());
    invalidate(client, ["account"]);
    invalidate(client, ["portfolio", "summary"]);
    return;
  }
  if (event.type === "backtest.progress") {
    client.setQueryData(queryKeys.backtest(event.data.id), (current: unknown) => {
      if (typeof current !== "object" || current === null) return current;
      return { ...current, status: event.data.status, progress: event.data.progress };
    });
    if (event.data.status === "done" || event.data.status === "failed") {
      invalidate(client, ["backtest", event.data.id]);
      invalidate(client, ["backtests"]);
    }
  }
}

export function onGap(client: QueryClient, channel: string): void {
  if (channel === "portfolio") {
    invalidate(client, ["portfolio"]);
    invalidate(client, ["systems"]);
    invalidate(client, queryKeys.risk());
    invalidate(client, queryKeys.accounts());
    return;
  }
  const system = systemId(channel);
  if (system !== null) {
    invalidate(client, ["system", system]);
    return;
  }
  const backtest = /^backtest\.(\d+)$/.exec(channel);
  if (backtest) invalidate(client, ["backtest", Number(backtest[1])]);
}

export function onResync(client: QueryClient, channels: string[]): void {
  channels.forEach((channel) => onGap(client, channel));
}
