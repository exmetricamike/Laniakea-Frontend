import type { AccountPermissions, Venue } from "@/lib/api/types";

export function parsePositiveInt(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function percentToFraction(value: string): number | null {
  if (value.trim() === "") return null;
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return null;
  return percent / 100;
}

export function fractionToPercent(value: number | null): string {
  return value === null ? "" : String(value * 100);
}

export function permissionExplanation(permissions: AccountPermissions | null): string | null {
  return permissions?.withdraw === true
    ? "This key can withdraw funds and is refused for live trading. Create a trade-only key."
    : null;
}

export function credentialInputProps(field: Venue["credential_fields"][number]) {
  return field.secret
    ? { type: "password", autoComplete: "new-password" }
    : { type: "text", autoComplete: "off" };
}
