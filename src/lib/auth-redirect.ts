export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/portfolio";
  }
  if (typeof window === "undefined") return "/portfolio";
  try {
    return new URL(value, window.location.origin).origin === window.location.origin
      ? value
      : "/portfolio";
  } catch {
    return "/portfolio";
  }
}
