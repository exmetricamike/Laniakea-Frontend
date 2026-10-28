import { describe, expect, it } from "vitest";
import { livePollInterval } from "@/lib/ws/poll";

describe("livePollInterval", () => {
  it("stops polling when realtime is connected", () => {
    expect(livePollInterval("connected", { connecting: 10_000, paused: 15_000 })).toBe(false);
  });

  it("uses the state-specific fallback interval", () => {
    expect(livePollInterval("connecting", { connecting: 10_000, paused: 15_000 })).toBe(10_000);
    expect(livePollInterval("paused", { connecting: 10_000, paused: 15_000 })).toBe(15_000);
  });
});
