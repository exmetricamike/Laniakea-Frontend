import type { components } from "@/lib/api/schema";

export type Venue = {
  id: string;
  name: string;
  kinds: string[];
  has_testnet: boolean;
  credential_fields: Array<{ name: string; label: string; secret: boolean }>;
};
export type Instrument = components["schemas"]["Instrument"];
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type StrategyMeta = {
  live_capable: boolean;
  restart_safe: boolean;
  notes: string[];
};
export type StrategySummary = {
  key: string;
  title: string;
  description_md: string;
  instrument_kinds: string[];
  recommended_timeframes: string[];
  warmup_bars: number;
  latest_version: {
    version: string;
    meta: StrategyMeta;
    published_at?: string | null;
  };
};
export type StrategyVersionSummary = Omit<StrategySummary, "latest_version"> & {
  version: string;
  meta: StrategyMeta;
  evidence: StrategyEvidence[];
  published_at?: string | null;
};
export type ParamsSchema = {
  properties?: Record<string, Record<string, unknown>>;
};
export type StrategyEvidence = { backtest_id: number; label: string };
export type StrategyVersionDetail = StrategyVersionSummary & {
  params_schema?: ParamsSchema | null;
  default_params?: Record<string, JsonValue> | null;
};
export type AccountPermissions = {
  trade?: boolean;
  withdraw?: boolean;
};
export type AccountRisk = {
  daily_loss_limit: string | null;
  max_drawdown_pct: number | null;
  breaker_policy: "cancel_orders" | "flatten";
};
export type Account = {
  id: number;
  venue: string;
  label: string;
  is_testnet: boolean;
  status: "unverified" | "verified" | "invalid" | "disabled";
  verified_at: string | null;
  permissions: AccountPermissions | null;
  credentials_set: boolean;
  credential_hint: string;
  risk: AccountRisk;
  kill_switch: { active: boolean };
  systems_count: number;
  created_at: string;
  verification_pending: boolean;
  probe_error: string;
};
export type AccountBalance = {
  balances: Array<{ currency: string; total: string; free: string }>;
  as_of: string | null;
  pending: boolean;
  error: string | null;
};
export type PaginatedList<T> = { results: T[]; next: string | null; count: number | null };

export type Bucket = Record<string, unknown> & { currency: string; members: string[] };
export type SystemPosition = {
  size: string;
  side: "long" | "short";
  avg_price: string | null;
  mark_price: string | null;
  marked_at: string | null;
};
export type SystemRisk = {
  max_order_notional?: string;
  max_position_notional?: string;
  max_leverage?: string;
  max_orders_per_minute?: number;
};
export type SystemCostModel = {
  instrument_kind: "spot" | "linear_perp";
  fee_rate: number;
  slippage_bps: number;
  leverage: number;
};
export type SystemRow = {
  id: number;
  name: string;
  mode: "paper" | "live";
  state: "draft" | "stopped" | "starting" | "running" | "stopping" | "error" | "halted";
  instrument: { id: number; venue: string; symbol: string };
  settle: string;
  allocation: string;
  value: string;
  net_pnl: string;
  return: number;
  period_pnl: string;
  realised_pnl: string;
  unrealised_pnl: string;
  fees: string;
  max_drawdown: number;
  position: SystemPosition | null;
  open_orders: number;
  trades: number;
  last_bar_time: string | null;
  heartbeat_at: string | null;
  manual_intervention: boolean;
  allowed_actions: string[];
};
export type PortfolioSummary = {
  mode: string;
  as_of: string;
  period: string;
  buckets: Bucket[];
  systems: SystemRow[];
  alerts: unknown[];
};
export type TradingSystem = SystemRow & {
  params: Record<string, JsonValue>;
  risk: SystemRisk;
  cost_model: SystemCostModel;
  version: string;
  strategy: string;
  account: number | null;
  timeframe: string;
  desired_state: "running" | "stopped";
  stop_policy: "keep_positions" | "cancel_all" | "flatten";
  state_reason: string;
  started_at: string | null;
  stopped_at: string | null;
  meta: StrategyMeta;
  manual_intervention_at: string | null;
  warmup_bars: number;
  created_at: string;
};
export type SystemCreate = {
  name: string;
  mode: "paper" | "live";
  strategy: string;
  version: string;
  params: Record<string, JsonValue>;
  instrument: number;
  timeframe: string;
  account?: number | null;
  allocation: string;
  risk: SystemRisk;
  cost_model: SystemCostModel;
};
export type Trade = Record<string, unknown> & { id: number; status: string };
export type Order = Record<string, unknown> & { id: number; status: string };
export type Fill = Record<string, unknown> & { id: number };
export type Position = Record<string, unknown>;
export type Command = Record<string, unknown> & { id: number; status: string };
export type SystemEvent = Record<string, unknown> & { id: number };
export type EquitySeries = Record<string, unknown> & { t: number[]; value: Array<string | number> };
export type ChartSeries = Record<string, unknown> & {
  t: number[];
  open: string[];
  high: string[];
  low: string[];
  close: string[];
};
export type BacktestStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type BacktestMetric = Record<string, number | string | null | undefined>;
export type BacktestMetrics = {
  full?: BacktestMetric;
  in_sample?: BacktestMetric;
  out_of_sample?: BacktestMetric;
};
export type BacktestCostModel = {
  instrument_kind: "spot" | "linear_perp";
  fee_rate: number;
  slippage_bps: number;
  leverage: number;
};
export type BacktestJob = {
  id: number;
  strategy: string;
  version: string;
  params: Record<string, JsonValue>;
  instrument: { id: number; venue: string; symbol: string };
  timeframe: string;
  start: string;
  end: string;
  in_sample_end: string | null;
  trade_start: string | null;
  allocation: string;
  cost_model: BacktestCostModel;
  status: BacktestStatus;
  progress: number;
  error: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  metrics: BacktestMetrics | null;
  caveats: string[];
  dataset_sha256?: string;
  engine_revision?: string;
  trades_count: number;
};
export type CreateBacktestBody = Omit<
  BacktestJob,
  | "id"
  | "instrument"
  | "status"
  | "progress"
  | "error"
  | "created_at"
  | "started_at"
  | "finished_at"
  | "metrics"
  | "caveats"
  | "dataset_sha256"
  | "engine_revision"
  | "trades_count"
> & { instrument: number; in_sample_end?: string; trade_start?: string };
export type BacktestEquity = { t: number[]; value: string[]; drawdown: number[] };
export type BacktestTrade = {
  pnl: string;
  pnl_net: string;
  commission: string;
  bars: number;
  side: string;
  size: string;
  segment: string;
  entry_time: string;
  exit_time: string;
  entry_price: string;
};
export type BacktestOrder = {
  tag: string | null;
  side: string;
  size: string;
  type: string;
  price: string;
  status: string;
  created: string;
  filled_at: string | null;
  fill_price: string | null;
};
export type ChartPayload = {
  t: number[];
  open: string[];
  high: string[];
  low: string[];
  close: string[];
  volume: string[];
  indicators: Record<string, unknown>;
  markers: Array<{
    t: number;
    kind: "fill";
    side: "buy" | "sell";
    price: string;
    size: string;
    origin: string;
    order_id: number | null;
  }>;
  open_orders: unknown[];
};
export type Backtest = BacktestJob;
export type KillSwitch = Record<string, unknown> & { active: boolean; scope: string };
export type WsEnvelope<T> = { type: string; channel: string; seq: number; time: string; data: T };
