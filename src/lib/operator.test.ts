import { describe, expect, it } from "vitest";
import { auditTarget, formatAge, isStaleHeartbeat } from "@/lib/operator";

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

  it("formats ages without fractional seconds", () => {
    expect(formatAge(8.621915)).toBe("8 s");
    expect(formatAge(532349.213369)).toBe("6 d 3 h");
    expect(formatAge(null)).toBe("—");
  });
});
