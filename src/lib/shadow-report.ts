import type { ShadowReportSummary } from "@/lib/api/types";

export function shadowStatusLabel(summary: ShadowReportSummary): string {
  if (summary.status === "data_changed") return "data changed";
  if (summary.status === "not_comparable")
    return `not comparable${summary.reason ? `: ${summary.reason}` : ""}`;
  return summary.status;
}

export function shadowAttributionRows(summary: ShadowReportSummary) {
  return [
    ["PnL live", summary.pnl_live],
    ["PnL shadow", summary.pnl_shadow],
    ["Fees live", summary.fees_live],
    ["Fees shadow", summary.fees_shadow],
    ["Fee delta", summary.fee_delta],
    ["Other", summary.other],
  ] as const;
}
