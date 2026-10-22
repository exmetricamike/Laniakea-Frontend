import { describe, expect, it, vi } from "vitest";
import { createIntentKey, nextIntentKey } from "@/lib/api/mutations";

describe("intent keys", () => {
  it("reuses a retry key and renews after success", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn().mockReturnValueOnce("one").mockReturnValueOnce("two"),
    });
    const first = createIntentKey();
    expect(nextIntentKey(first, "retry")).toBe(first);
    expect(nextIntentKey(first, "success").key).toBe("two");
  });
});
