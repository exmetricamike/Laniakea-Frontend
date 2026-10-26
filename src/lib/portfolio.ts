import type { PortfolioBucket, PortfolioPeriod } from "@/lib/api/types";

export function periodFrom(period: PortfolioPeriod, now: Date): string | undefined {
  if (period === "all") return undefined;
  if (period === "today") {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();
  }
  const days = period === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function orderedBuckets(buckets: PortfolioBucket[]): PortfolioBucket[] {
  return [...buckets].sort((left, right) => {
    if (left.currency === "USD*") return -1;
    if (right.currency === "USD*") return 1;
    return left.currency.localeCompare(right.currency);
  });
}
