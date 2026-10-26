import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/api/keys";

describe("query keys", () => {
  it("returns the canonical §11.3 arrays", () => {
    expect(queryKeys.portfolio.summary("live", "today", false)).toEqual([
      "portfolio",
      "summary",
      "live",
      "today",
      false,
    ]);
    expect(queryKeys.portfolio.equity("paper", "7d")).toEqual([
      "portfolio",
      "equity",
      "paper",
      "7d",
    ]);
    expect(queryKeys.system.orders(42, "open")).toEqual(["system", 42, "orders", "open"]);
    expect(queryKeys.system.trades(42, "all")).toEqual(["system", 42, "trades", "all"]);
    expect(queryKeys.system.equity(42, "30d")).toEqual(["system", 42, "equity", "30d"]);
    expect(queryKeys.system.chart(42, "1d")).toEqual(["system", 42, "chart", "1d"]);
    expect(queryKeys.system.events(42)).toEqual(["system", 42, "events"]);
    expect(queryKeys.system.commands(42)).toEqual(["system", 42, "commands"]);
  });
});
