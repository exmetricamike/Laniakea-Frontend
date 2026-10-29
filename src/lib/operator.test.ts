import { describe, expect, it } from "vitest";
import { auditTarget, isStaleHeartbeat } from "@/lib/operator";

describe("operator helpers", () => {
  it("formats audit targets consistently", () => {
    expect(auditTarget("trading_system", "42")).toBe("trading_system:42");
    expect(auditTarget("trading_system", "")).toBe("trading_system");
  });

  it("highlights heartbeats older than sixty seconds", () => {
    expect(isStaleHeartbeat(60)).toBe(false);
    expect(isStaleHeartbeat(61)).toBe(true);
    expect(isStaleHeartbeat(null)).toBe(false);
  });
});
