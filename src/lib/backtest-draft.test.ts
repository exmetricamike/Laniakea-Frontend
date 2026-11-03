import { describe, expect, it } from "vitest";
import { isDraftBacktestMode } from "@/lib/backtest-draft";

describe("isDraftBacktestMode", () => {
  it("uses draft mode only for staff with a strategy and version", () => {
    expect(isDraftBacktestMode(true, "family/name", "1.2.3")).toBe(true);
  });

  it("keeps non-staff users in the normal form", () => {
    expect(isDraftBacktestMode(false, "family/name", "1.2.3")).toBe(false);
  });
});
