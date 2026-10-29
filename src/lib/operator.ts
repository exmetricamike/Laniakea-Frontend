import type { JsonValue } from "@/lib/api/types";

export function auditTarget(targetType: string, targetId: string): string {
  return targetId ? `${targetType}:${targetId}` : targetType;
}

export function compactJson(value: JsonValue): string {
  return JSON.stringify(value);
}

export function isStaleHeartbeat(ageSeconds: number | null): boolean {
  return ageSeconds !== null && ageSeconds > 60;
}
