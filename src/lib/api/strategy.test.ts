import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { strategyApiPath } from "@/lib/api/strategy";

describe("strategyApiPath", () => {
  it("maps an encoded catalog key to schema route parameters", () => {
    expect(strategyApiPath("atr_strategies%2Fatr_allocation")).toBe(
      "/api/engine/v1/strategies/atr_strategies/atr_allocation/",
    );
  });
  it("rejects invalid keys before a request", () => {
    expect(() => strategyApiPath("bad%ZZ")).toThrow(ApiError);
  });
});
