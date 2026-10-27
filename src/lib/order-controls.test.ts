import { describe, expect, it } from "vitest";
import { COMMAND_REASON_LABELS, estimateOrder, validManualOrder } from "@/lib/order-controls";

describe("order controls", () => {
  it("requires exactly one positive size or notional", () => {
    expect(validManualOrder({ side: "buy", type: "market", size: "1", reduce_only: false })).toBe(
      true,
    );
    expect(
      validManualOrder({
        side: "buy",
        type: "market",
        size: "1",
        notional: "2",
        reduce_only: false,
      }),
    ).toBe(false);
  });

  it("calculates labelled estimates from decimal strings", () => {
    expect(estimateOrder({ type: "limit", size: "2", price: "10" }, "9", 0.001)).toEqual({
      notional: "20",
      fee: "0.02",
    });
  });

  it("maps command reasons to usable text", () => {
    expect(COMMAND_REASON_LABELS.risk_rejected).toContain("risk");
  });
});
