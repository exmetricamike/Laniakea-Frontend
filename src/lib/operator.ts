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

export function formatAge(ageSeconds: number | null): string {
  if (ageSeconds === null || !Number.isFinite(ageSeconds)) return "—";
  const seconds = Math.max(0, Math.floor(ageSeconds));
  if (seconds < 3_600) return `${seconds} s`;
  const totalHours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days} d ${hours} h`;
  return `${hours} h ${minutes} m`;
}
