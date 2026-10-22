import { describe, expect, it } from "vitest";
import { idempotent, resetIdempotency } from "@/mocks/handlers";

describe("mock idempotency", () => {
  it("rejects a missing key", async () => {
    resetIdempotency();
    const response = await idempotent(new Request("http://mock/", { method: "POST" }), { id: 1 });
    expect(response?.status).toBe(400);
  });
  it("replays a matching request and rejects a changed body", async () => {
    resetIdempotency();
    const first = new Request("http://mock/", {
      method: "POST",
      headers: { "Idempotency-Key": "key" },
      body: '{"a":1}',
    });
    expect(await idempotent(first, { id: 1 })).toBeNull();
    const same = await idempotent(
      new Request("http://mock/", {
        method: "POST",
        headers: { "Idempotency-Key": "key" },
        body: '{"a":1}',
      }),
      { id: 2 },
    );
    expect(same?.status).toBe(202);
    expect(await same?.json()).toEqual({ id: 1 });
    const changed = await idempotent(
      new Request("http://mock/", {
        method: "POST",
        headers: { "Idempotency-Key": "key" },
        body: '{"a":2}',
      }),
      { id: 1 },
    );
    expect(changed?.status).toBe(409);
  });
});
