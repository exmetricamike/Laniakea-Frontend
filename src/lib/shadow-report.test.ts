import { describe, expect, it } from "vitest";
import { shadowAttributionRows, shadowStatusLabel } from "@/lib/shadow-report";

describe("shadow report helpers", () => {
  it("labels non-comparable reports with their reason", () => {
    expect(shadowStatusLabel({ status: "not_comparable", reason: "restarted" })).toBe(
      "not comparable: restarted",
    );
  });

  it("keeps attribution values in display order", () => {
    expect(shadowAttributionRows({ status: "ok", pnl_live: "1", other: "0.2" })).toEqual([
      ["PnL live", "1"],
      ["PnL shadow", undefined],
      ["Fees live", undefined],
      ["Fees shadow", undefined],
      ["Fee delta", undefined],
      ["Other", "0.2"],
    ]);
  });
});
