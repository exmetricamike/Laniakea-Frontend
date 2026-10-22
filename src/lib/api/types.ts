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

/** Hand-derived from SPEC §8 until the endpoint exists in the backend schema; replace with generated types when it lands. */
export type Bucket = Record<string, unknown> & { currency: string; members: string[] };
export type SystemRow = Record<string, unknown> & {
  id: number;
  name: string;
  state: string;
  mode: string;
};
export type PortfolioSummary = {
  mode: string;
  as_of: string;
  period: string;
  buckets: Bucket[];
  systems: SystemRow[];
  alerts: unknown[];
};
export type TradingSystem = SystemRow & Record<string, unknown>;
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
export type Backtest = Record<string, unknown> & { id: number; status: string };
export type KillSwitch = Record<string, unknown> & { active: boolean; scope: string };
export type WsEnvelope<T> = { type: string; channel: string; seq: number; time: string; data: T };
