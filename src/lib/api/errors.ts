import { ApiError } from "@/lib/api/client";

export function apiErrorMessage(
  error: unknown,
  fallback = "Unable to complete the request.",
): string {
  if (!(error instanceof ApiError)) return fallback;
  // An envelope code means the server wrote this message for the case; it beats a generic one.
  if (error.code && error.message) return error.message;
  if (error.status === 409) {
    return "This request conflicts with the current server state. Refresh and try again.";
  }
  if (error.status === 412) {
    return "This action is not currently allowed. Resolve the listed requirements and try again.";
  }
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  return error.message || fallback;
}
