export const queryKeys = {
  portfolio: {
    summary: (mode: string, period: string, includeStopped: boolean) =>
      ["portfolio", "summary", mode, period, includeStopped] as const,
    equity: (mode: string, range: string) => ["portfolio", "equity", mode, range] as const,
    trades: (filters: object) => ["portfolio", "trades", filters] as const,
    orders: (mode: string) => ["portfolio", "orders", mode] as const,
    positions: (mode: string) => ["portfolio", "positions", mode] as const,
  },
  system: {
    detail: (id: number) => ["system", id] as const,
    orders: (id: number, filters: object | string) => ["system", id, "orders", filters] as const,
    trades: (id: number, filters: object | string) => ["system", id, "trades", filters] as const,
    equity: (id: number, range: string) => ["system", id, "equity", range] as const,
    chart: (id: number, range: string) => ["system", id, "chart", range] as const,
    fills: (id: number, filters: object) => ["system", id, "fills", filters] as const,
    position: (id: number) => ["system", id, "position"] as const,
    performance: (id: number, range: string) => ["system", id, "performance", range] as const,
    events: (id: number, filters?: object) =>
      filters ? (["system", id, "events", filters] as const) : (["system", id, "events"] as const),
    commands: (id: number, filters?: object) =>
      filters
        ? (["system", id, "commands", filters] as const)
        : (["system", id, "commands"] as const),
  },
  venues: () => ["venues"] as const,
  instruments: (filters: object) => ["instruments", filters] as const,
  instrument: (id: number) => ["instrument", id] as const,
  strategies: () => ["strategies"] as const,
  strategy: (key: string) => ["strategy", key] as const,
  strategyVersions: (key: string) => ["strategy", key, "versions"] as const,
  strategyVersion: (key: string, version: string) =>
    ["strategy", key, "versions", version] as const,
  accounts: () => ["accounts"] as const,
  account: (id: number) => ["account", id] as const,
  accountBalance: (id: number) => ["account", id, "balance"] as const,
  backtests: (filters: object) => ["backtests", filters] as const,
  backtest: (id: number) => ["backtest", id] as const,
  backtestEquity: (id: number) => ["backtest", id, "equity"] as const,
  backtestTrades: (id: number) => ["backtest", id, "trades"] as const,
  backtestOrders: (id: number) => ["backtest", id, "orders"] as const,
  backtestChart: (id: number) => ["backtest", id, "chart"] as const,
  risk: () => ["risk"] as const,
  systems: (filters: object) => ["systems", filters] as const,
  me: () => ["me"] as const,
  operator: { systems: () => ["operator", "systems"] as const },
};
