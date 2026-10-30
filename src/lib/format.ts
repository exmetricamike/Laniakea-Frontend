import Decimal from "decimal.js-light";

function decimal(value: string | null): Decimal | null {
  if (value === null || value.trim() === "") return null;
  try {
    return new Decimal(value);
  } catch {
    return null;
  }
}

export function decimalsOf(step: string | null): number | null {
  const value = decimal(step);
  if (!value || !value.gt(0)) return null;
  return value.decimalPlaces();
}

function trimZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function formatQuantity(value: string | null, step: string | null): string {
  const parsed = decimal(value);
  if (!parsed) return "—";
  const places = decimalsOf(step);
  if (places !== null) return parsed.toFixed(places, Decimal.ROUND_HALF_UP);
  return trimZeros(parsed.toSignificantDigits(8, Decimal.ROUND_HALF_UP).toFixed());
}

export function formatMoney(value: string | null, currency?: string | null): string {
  const parsed = decimal(value);
  if (!parsed) return "—";
  const fixed = parsed.toFixed(2, Decimal.ROUND_HALF_UP);
  const [integer, fraction] = fixed.split(".");
  const sign = integer.startsWith("-") ? "-" : "";
  const grouped = integer.replace(/^-/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}.${fraction}${currency ? ` ${currency}` : ""}`;
}
