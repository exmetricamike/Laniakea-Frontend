import { describe, expect, it } from "vitest";
import {
  credentialInputProps,
  fractionToPercent,
  parsePositiveInt,
  percentToFraction,
  permissionExplanation,
} from "@/lib/accounts";

describe("account helpers", () => {
  it("converts drawdown percent ratios only", () => {
    expect(percentToFraction("25.5")).toBe(0.255);
    expect(percentToFraction("")).toBeNull();
    expect(percentToFraction("101")).toBeNull();
    expect(fractionToPercent(0.25)).toBe("25");
  });

  it("explains withdrawal-capable credentials", () => {
    expect(permissionExplanation({ withdraw: true })).toContain("withdraw funds");
    expect(permissionExplanation({ withdraw: false })).toBeNull();
  });

  it("maps credential field security properties", () => {
    expect(credentialInputProps({ name: "secret", label: "Secret", secret: true })).toEqual({
      type: "password",
      autoComplete: "new-password",
    });
    expect(credentialInputProps({ name: "key", label: "Key", secret: false })).toEqual({
      type: "text",
      autoComplete: "off",
    });
  });

  it("only parses positive route ids", () => {
    expect(parsePositiveInt("7")).toBe(7);
    expect(parsePositiveInt("0")).toBeNull();
    expect(parsePositiveInt("7.2")).toBeNull();
  });
});
