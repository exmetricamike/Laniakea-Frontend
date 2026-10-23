import { describe, expect, it } from "vitest";
import { errorStep, firstIncomplete, type WizardValues } from "@/components/systems-pages";

const values: WizardValues = {
  name: "System",
  strategy: "family/name",
  version: "1.0.0",
  params: {},
  venue: "binance",
  kind: "spot",
  instrument: "812",
  timeframe: "1h",
  mode: "paper",
  account: "",
  allocation: "1000",
  max_order_notional: "",
  max_position_notional: "",
  max_leverage: "",
  max_orders_per_minute: "",
  fee_rate: "0.001",
  slippage_bps: "0",
};

describe("system wizard navigation", () => {
  it("clamps a requested step to the first incomplete step", () => {
    expect(firstIncomplete({ ...values, strategy: "" }, false)).toBe(1);
    expect(firstIncomplete({ ...values, version: "" }, true)).toBe(2);
    expect(firstIncomplete({ ...values, instrument: "" }, true)).toBe(4);
    expect(firstIncomplete({ ...values, mode: "live", account: "" }, true)).toBe(5);
    expect(firstIncomplete({ ...values, allocation: "" }, true)).toBe(6);
  });

  it("maps API validation fields to their wizard step", () => {
    expect(errorStep("params")).toBe(3);
    expect(errorStep("instrument")).toBe(4);
    expect(errorStep("account")).toBe(5);
    expect(errorStep("cost_model")).toBe(6);
    expect(errorStep("name")).toBe(7);
  });
});
