import type { components } from "@/lib/api/schema";

export type Venue = {
  id: string;
  name: string;
  kinds: string[];
  has_testnet: boolean;
  credential_fields: Array<{ name: string; label: string; secret: boolean }>;
};
export type Instrument = components["schemas"]["Instrument"];
export type Strategy = components["schemas"]["Version"];
export type StrategyVersion = components["schemas"]["Version"];
export type Account = components["schemas"]["Account"];
export type AccountBalance = {
  balances: Array<Record<string, unknown>>;
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
