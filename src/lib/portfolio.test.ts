import { describe, expect, it } from "vitest";
import { orderedBuckets, periodFrom } from "@/lib/portfolio";

describe("periodFrom", () => {
  const now = new Date("2026-10-26T09:04:29.924Z");

  it("uses UTC midnight for today and rolling windows otherwise", () => {
    expect(periodFrom("today", now)).toBe("2026-10-26T00:00:00.000Z");
    expect(periodFrom("7d", now)).toBe("2026-10-19T09:04:29.924Z");
    expect(periodFrom("30d", now)).toBe("2026-09-26T09:04:29.924Z");
    expect(periodFrom("all", now)).toBeUndefined();
  });
});

describe("orderedBuckets", () => {
  it("puts USD star first and keeps other currencies alphabetical", () => {
    const buckets = [{ currency: "BTC" }, { currency: "USD*" }, { currency: "ETH" }] as never;
    expect(orderedBuckets(buckets).map((bucket) => bucket.currency)).toEqual([
      "USD*",
      "BTC",
      "ETH",
    ]);
  });
});
