export const START_BLOCKER_LABELS: Record<string, string> = {
  version_unpublished: "The strategy version is not published.",
  params_invalid: "The strategy parameters are invalid.",
  kill_switch_active: "A kill switch is active.",
  instrument_kind_mismatch: "The selected instrument kind does not match the strategy.",
  market_data_unavailable: "Required live market data is unavailable.",
  account_unverified: "The exchange account is not verified.",
  account_can_withdraw: "The exchange account can withdraw funds.",
  risk_limits_missing: "All live risk limits are required.",
  strategy_not_live_capable: "This strategy is not live-capable.",
  strategy_not_restart_safe: "This strategy is not restart-safe.",
  live_runtime_unavailable: "Live trading is not available yet.",
};
