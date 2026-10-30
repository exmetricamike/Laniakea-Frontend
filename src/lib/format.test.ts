import { describe, expect, it } from "vitest";
import { decimalsOf, formatMoney, formatQuantity } from "@/lib/format";

describe("decimalsOf", () => {
  it.each([
    ["0.00001", 5],
    ["0.0100", 2],
    ["1.0", 0],
    ["1", 0],
    ["1e-8", 8],
    [null, null],
    ["", null],
    ["nope", null],
    ["0", null],
    ["-0.1", null],
  ])("returns %s as %s", (step, expected) => {
    expect(decimalsOf(step)).toBe(expected);
  });
});

describe("formatQuantity", () => {
  it("uses the step precision and half-up rounding", () => {
    expect(formatQuantity("0.125", "0.01")).toBe("0.13");
    expect(formatQuantity("-1.2", "0.01")).toBe("-1.20");
  });

  it("uses plain, trimmed significant digits without a step", () => {
    expect(formatQuantity("0.0000000123456789", null)).toBe("0.000000012345679");
  });

  it.each([null, "", "nope", "NaN", "Infinity"])(
    "renders invalid value %s as an em dash",
    (value) => {
      expect(formatQuantity(value, "0.01")).toBe("—");
    },
  );
});

describe("formatMoney", () => {
  it("rounds half-up, groups digits and includes currency", () => {
    expect(formatMoney("1234567.891", "USDT")).toBe("1,234,567.89 USDT");
    expect(formatMoney("0.125", "USDT")).toBe("0.13 USDT");
  });

  it.each([null, "", "nope", "NaN", "Infinity"])(
    "renders invalid value %s as an em dash",
    (value) => {
      expect(formatMoney(value, "USDT")).toBe("—");
    },
  );
});
