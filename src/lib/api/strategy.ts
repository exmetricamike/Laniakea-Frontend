import { ApiError } from "@/lib/api/client";

export function strategyApiPath(key: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(key);
  } catch {
    throw new ApiError("Invalid strategy key", 400, "validation_error");
  }
  const split = decoded.indexOf("/");
  const family = decoded.slice(0, split);
  const name = decoded.slice(split + 1);
  if (split < 1 || !name) throw new ApiError("Invalid strategy key", 400, "validation_error");
  return `/api/engine/v1/strategies/${encodeURIComponent(family)}/${encodeURIComponent(name)}/`;
}
