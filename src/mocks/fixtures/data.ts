import type {
  Account,
  Instrument,
  StrategySummary,
  StrategyVersionDetail,
  StrategyVersionSummary,
  TradingSystem,
  Venue,
} from "@/lib/api/types";

export const venues: Venue[] = [
  {
    id: "binance",
    name: "Binance",
    kinds: ["spot", "linear_perp"],
    has_testnet: true,
    credential_fields: [{ name: "api_key", label: "API key", secret: false }],
  },
  {
    id: "okx",
    name: "OKX",
    kinds: ["spot", "linear_perp"],
    has_testnet: true,
    credential_fields: [
      { name: "api_key", label: "API key", secret: false },
      { name: "api_secret", label: "API secret", secret: true },
      { name: "passphrase", label: "Passphrase", secret: true },
    ],
  },
];
export const instruments: Instrument[] = [
  {
    id: 812,
    venue: "binance",
    symbol: "BTC/USDT",
    kind: "spot",
    base: "BTC",
    quote: "USDT",
    settle: "USDT",
    tick_size: "0.1",
    lot_size: "0.0001",
    min_notional: "5",
    max_leverage: "1",
    contract_size: "1",
    timeframes: ["1h"],
  },
];
export const strategies: StrategySummary[] = [
  {
    key: "atr_strategies/atr_allocation",
    title: "ATR allocation",
    description_md: "# ATR allocation\n\n<script>window.catalogScript = true</script>\n\nUses ATR.",
    instrument_kinds: ["spot"],
    recommended_timeframes: ["1h"],
    warmup_bars: 200,
    latest_version: {
      version: "1.0.0",
      meta: { live_capable: true, restart_safe: false, notes: ["Review position sizing."] },
      published_at: "2026-10-22T10:00:00Z",
    },
  },
  {
    key: "trend/breakout",
    title: "Trend breakout",
    description_md:
      "## Research log\n\n| Date | Result |\n| --- | --- |\n| 2026-10-22 | Positive |",
    instrument_kinds: ["spot"],
    recommended_timeframes: ["1h"],
    warmup_bars: 100,
    latest_version: {
      version: "1.0.0",
      meta: { live_capable: false, restart_safe: true, notes: [] },
      published_at: "2026-10-21T10:00:00Z",
    },
  },
  {
    key: "mean/reversion",
    title: "Mean reversion",
    description_md: "",
    instrument_kinds: ["spot"],
    recommended_timeframes: ["1h"],
    warmup_bars: 50,
    latest_version: {
      version: "1.0.0",
      meta: { live_capable: false, restart_safe: true, notes: [] },
      published_at: null,
    },
  },
];

export const strategyVersions: Record<string, StrategyVersionSummary[]> = {
  "atr_strategies/atr_allocation": [
    {
      key: "atr_strategies/atr_allocation",
      version: "1.0.0",
      title: "ATR allocation",
      description_md: "# ATR allocation\n\nUses ATR.",
      instrument_kinds: ["spot"],
      recommended_timeframes: ["1h"],
      warmup_bars: 200,
      meta: { live_capable: true, restart_safe: false, notes: ["Review position sizing."] },
      evidence: [{ backtest_id: 1, label: "Published ATR backtest" }],
      published_at: "2026-10-22T10:00:00Z",
    },
    {
      key: "atr_strategies/atr_allocation",
      version: "0.9.0",
      title: "ATR allocation",
      description_md: "# ATR allocation\n\nUses ATR.",
      instrument_kinds: ["spot"],
      recommended_timeframes: ["1h"],
      warmup_bars: 200,
      meta: { live_capable: false, restart_safe: true, notes: [] },
      evidence: [],
      published_at: "2026-10-20T10:00:00Z",
    },
  ],
  "trend/breakout": [],
  "mean/reversion": [],
};

export const strategyVersionDetails: Record<string, StrategyVersionDetail> = {
  "atr_strategies/atr_allocation:1.0.0": {
    ...strategyVersions["atr_strategies/atr_allocation"][0],
    params_schema: {
      properties: {
        trailing_atr_period: {
          type: "integer",
          minimum: 1,
          default: 5,
          description: "ATR lookback period.",
        },
      },
    },
    default_params: { trailing_atr_period: 5 },
  },
  "atr_strategies/atr_allocation:0.9.0": {
    ...strategyVersions["atr_strategies/atr_allocation"][1],
    params_schema: {
      properties: {
        trailing_atr_period: {
          type: "integer",
          minimum: 1,
          default: 3,
          description: "ATR lookback period.",
        },
      },
    },
    default_params: { trailing_atr_period: 3 },
  },
};
export const accounts: Account[] = [
  {
    id: 7,
    venue: "binance",
    label: "Main futures",
    is_testnet: true,
    status: "verified",
    verified_at: "2026-10-22T09:10:00Z",
    permissions: { trade: true, withdraw: false },
    credentials_set: true,
    credential_hint: "…k9Qz",
    risk: { daily_loss_limit: null, max_drawdown_pct: null, breaker_policy: "cancel_orders" },
    kill_switch: { active: false },
    systems_count: 1,
    verification_pending: false,
    probe_error: "",
    created_at: "2026-10-20T08:00:00Z",
  },
  {
    id: 8,
    venue: "okx",
    label: "Invalid account",
    is_testnet: false,
    status: "invalid",
    verified_at: null,
    permissions: { trade: false, withdraw: true },
    credentials_set: true,
    credential_hint: "…d4Cc",
    risk: { daily_loss_limit: null, max_drawdown_pct: null, breaker_policy: "cancel_orders" },
    kill_switch: { active: true },
    systems_count: 0,
    verification_pending: false,
    probe_error: "Invalid credentials",
    created_at: "2026-10-20T08:00:00Z",
  },
];
export const systems: TradingSystem[] = [
  {
    id: 42,
    name: "BTC ATR 1h",
    mode: "live",
    state: "running",
    allowed_actions: ["stop", "new_order", "close_position"],
  },
  {
    id: 43,
    name: "Paper trend",
    mode: "paper",
    state: "running",
    allowed_actions: ["stop", "new_order"],
  },
  {
    id: 44,
    name: "Stopped mean",
    mode: "paper",
    state: "stopped",
    allowed_actions: ["edit", "delete", "start"],
  },
  {
    id: 45,
    name: "Halted BTC system",
    mode: "live",
    state: "halted",
    state_reason: "Reconciliation mismatch",
    allowed_actions: ["ack"],
  },
  { id: 46, name: "Errored breakout", mode: "live", state: "error", allowed_actions: ["stop"] },
  { id: 47, name: "Starting trend", mode: "paper", state: "starting", allowed_actions: ["stop"] },
];
export const portfolio = {
  mode: "live",
  as_of: "2026-10-22T10:00:00Z",
  period: "today",
  buckets: [
    { currency: "USD*", members: ["USDT", "USDC"], allocation: "12000", value: "12387.40" },
    { currency: "BTC", members: ["BTC"], allocation: "1", value: "1.02" },
  ],
  systems,
  alerts: [
    {
      system: 45,
      kind: "halted",
      severity: "error",
      message: "Reconciliation mismatch",
      time: "2026-10-22T10:00:00Z",
    },
  ],
};
