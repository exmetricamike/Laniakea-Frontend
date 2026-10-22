import { clearTokens, getAccess, getRefresh } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type ErrorFields = Record<string, unknown> | null;

export class ApiError extends Error {
  status: number;
  code: string | null;
  fields: ErrorFields;
  reasons: unknown;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    fields: ErrorFields = null,
    reasons: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.reasons = reasons;
  }
}

let refreshing: Promise<boolean> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorFrom(body: unknown, fallback: string, status: number): ApiError {
  const root = isRecord(body) ? body : {};
  const envelope = isRecord(root.error) ? root.error : root;
  const code = typeof envelope.code === "string" ? envelope.code : null;
  const message =
    typeof envelope.message === "string"
      ? envelope.message
      : typeof root.detail === "string"
        ? root.detail
        : (firstFieldMessage(root) ?? fallback);
  return new ApiError(
    message,
    status,
    code,
    isRecord(envelope.fields) ? envelope.fields : null,
    envelope.reasons ?? null,
  );
}

function firstFieldMessage(body: Record<string, unknown>): string | null {
  for (const value of Object.values(body)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return null;
}

async function bodyOf(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function doRefresh(): Promise<boolean> {
  const refresh = getRefresh();
  if (!refresh) return false;
  try {
    const response = await fetch(`${BASE}/api/jwt/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    const body = await bodyOf(response);
    if (!response.ok || !isRecord(body) || typeof body.access !== "string") return false;
    if (typeof window !== "undefined") window.localStorage.setItem("laniakea.access", body.access);
    return true;
  } catch {
    return false;
  }
}

function loginPath(): string {
  if (typeof window === "undefined") return "/login";
  const next = `${window.location.pathname}${window.location.search}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

function expireSession(): never {
  clearTokens();
  if (typeof window !== "undefined") window.location.href = loginPath();
  throw new ApiError("Session expired", 401, "not_authenticated");
}

function requestHeaders(init: RequestInit, includeAuthorization: boolean): Headers {
  const headers = new Headers(init.headers);
  if (includeAuthorization) {
    const access = getAccess();
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }
  const formData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !formData && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  return headers;
}

async function request<T>(path: string, init: RequestInit, retry = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers: requestHeaders(init, true) });
  } catch {
    throw new ApiError("Network request failed", 0);
  }
  if (response.status === 401 && retry) {
    if (!getRefresh()) return expireSession();
    refreshing ??= doRefresh();
    const refreshed = await refreshing;
    refreshing = null;
    if (refreshed) return request<T>(path, init, false);
    return expireSession();
  }
  if (response.status === 204) return undefined as T;
  const body = await bodyOf(response);
  if (!response.ok) throw errorFrom(body, response.statusText, response.status);
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export async function apiRequest<T>(
  method: ApiMethod,
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const headers = new Headers();
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  return request<T>(path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers: requestHeaders(init, false) });
  } catch {
    throw new ApiError("Network request failed", 0);
  }
  if (response.status === 204) return undefined as T;
  const body = await bodyOf(response);
  if (!response.ok) throw errorFrom(body, response.statusText, response.status);
  return body as T;
}

export function __resetRefreshStateForTests() {
  refreshing = null;
}
