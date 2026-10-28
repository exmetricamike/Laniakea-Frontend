import type {
  Account,
  BacktestStatus,
  KillSwitch,
  PortfolioSummary,
  SystemCommand,
  SystemEventRow,
  SystemFill,
  SystemOrder,
  SystemPosition,
  SystemRow,
  SystemTrade,
  TradingSystem,
} from "@/lib/api/types";

type Envelope<TType extends string, TData> = {
  type: TType;
  channel: string;
  seq: number;
  time: string;
  data: TData;
};

export type SystemStateEvent = Pick<
  TradingSystem,
  "state" | "desired_state" | "state_reason" | "allowed_actions"
> & { id: number };

export type SystemEquityPoint = {
  t: number;
  value: string;
  drawdown: number;
  realised: string;
  unrealised: string;
};

export type SystemChartPoint = {
  t: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

export type AccountUpdated =
  | { deleted: false; account: Account }
  | { deleted: true; id: number };

export type AlertEvent = {
  system: number;
  kind: string;
  severity: string;
  message: string;
  time: string;
};

export type BacktestProgress = {
  id: number;
  status: BacktestStatus;
  progress: number;
};

export type EngineEvent =
  | Envelope<"system.state", SystemStateEvent>
  | Envelope<"system.summary", SystemRow>
  | Envelope<"portfolio.summary", PortfolioSummary>
  | Envelope<"order.updated", SystemOrder>
  | Envelope<"fill", SystemFill>
  | Envelope<"trade.updated", SystemTrade>
  | Envelope<"position", SystemPosition>
  | Envelope<"equity", SystemEquityPoint>
  | Envelope<"bar", SystemChartPoint>
  | Envelope<"command.updated", SystemCommand>
  | Envelope<"event", SystemEventRow>
  | Envelope<"alert", AlertEvent>
  | Envelope<"kill_switch", KillSwitch>
  | Envelope<"account.updated", AccountUpdated>
  | Envelope<"backtest.progress", BacktestProgress>;

export type ServerMessage =
  | { type: "auth.ok" }
  | { type: "auth.expiring"; in_s: number }
  | { type: "subscribed"; channel: string }
  | { type: "unsubscribed"; channel: string }
  | { type: "error"; detail?: string };

export type ParsedServerFrame = EngineEvent | ServerMessage | "invalid";

const eventTypes = new Set<EngineEvent["type"]>([
  "system.state",
  "system.summary",
  "portfolio.summary",
  "order.updated",
  "fill",
  "trade.updated",
  "position",
  "equity",
  "bar",
  "command.updated",
  "event",
  "alert",
  "kill_switch",
  "account.updated",
  "backtest.progress",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function valueOf(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isRecord(raw) ? raw : null;
}

export function parseServerFrame(raw: unknown): ParsedServerFrame {
  const frame = valueOf(raw);
  if (!frame || typeof frame.type !== "string") return "invalid";

  if (frame.type === "auth.ok") return { type: "auth.ok" };
  if (frame.type === "auth.expiring" && typeof frame.in_s === "number") {
    return { type: "auth.expiring", in_s: frame.in_s };
  }
  if (frame.type === "subscribed" && typeof frame.channel === "string") {
    return { type: "subscribed", channel: frame.channel };
  }
  if (frame.type === "unsubscribed" && typeof frame.channel === "string") {
    return { type: "unsubscribed", channel: frame.channel };
  }
  if (frame.type === "error") {
    return typeof frame.detail === "string"
      ? { type: "error", detail: frame.detail }
      : { type: "error" };
  }

  if (
    eventTypes.has(frame.type as EngineEvent["type"]) &&
    typeof frame.channel === "string" &&
    typeof frame.seq === "number" &&
    typeof frame.time === "string" &&
    "data" in frame
  ) {
    return frame as EngineEvent;
  }
  return "invalid";
}
