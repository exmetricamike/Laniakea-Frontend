import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTokens, getAccess, setTokens } from "@/lib/auth";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
const memory = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  value: { localStorage: memory, location: { href: "" } },
  configurable: true,
});
const { __resetRefreshStateForTests, api, ApiError, publicRequest } =
  await import("@/lib/api/client");
afterEach(() => {
  memory.clear();
  vi.unstubAllGlobals();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: memory, location: { href: "" } },
    configurable: true,
  });
  __resetRefreshStateForTests();
});

describe("API client", () => {
  it("shares one refresh request between concurrent 401s", async () => {
    setTokens("old", "refresh");
    let refreshes = 0;
    let protectedCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/jwt/refresh/")) {
          refreshes += 1;
          return new Response(JSON.stringify({ access: "new" }), { status: 200 });
        }
        protectedCalls += 1;
        if (protectedCalls <= 2)
          return new Response(JSON.stringify({ detail: "Unauthorized" }), { status: 401 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    await Promise.all([api.get("/protected/one"), api.get("/protected/two")]);
    expect(refreshes).toBe(1);
    expect(getAccess()).toBe("new");
  });
  it("clears tokens when refresh fails", async () => {
    setTokens("old", "refresh");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response("", { status: String(input).endsWith("/api/jwt/refresh/") ? 401 : 401 }),
      ),
    );
    await expect(api.get("/protected/")).rejects.toMatchObject({
      message: "Session expired",
      status: 401,
    });
    expect(getAccess()).toBeNull();
    expect(memory.getItem("laniakea.refresh")).toBeNull();
  });
  it("never attaches authorization to public requests", async () => {
    setTokens("stale", "refresh");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Response(JSON.stringify({ detail: "Bad credentials" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      publicRequest("/api/jwt/create/", { method: "POST", body: "{}" }),
    ).rejects.toBeInstanceOf(ApiError);
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.has("Authorization")).toBe(false);
  });
  it("parses engine error envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "conflict",
                message: "Already exists",
                fields: { name: ["Taken"] },
                reasons: ["duplicate"],
              },
            }),
            { status: 409, statusText: "Conflict" },
          ),
      ),
    );
    await expect(api.get("/engine/")).rejects.toMatchObject({
      status: 409,
      code: "conflict",
      message: "Already exists",
      fields: { name: ["Taken"] },
      reasons: ["duplicate"],
    });
  });
});
