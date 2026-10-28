import { describe, expect, it } from "vitest";
import { parseServerFrame } from "@/lib/ws/events";

describe("parseServerFrame", () => {
  it("parses protocol messages", () => {
    expect(parseServerFrame('{"type":"auth.ok"}')).toEqual({ type: "auth.ok" });
    expect(parseServerFrame({ type: "subscribed", channel: "portfolio" })).toEqual({
      type: "subscribed",
      channel: "portfolio",
    });
  });

  it("parses an event envelope", () => {
    expect(
      parseServerFrame({
        type: "position",
        channel: "system.42",
        seq: 3,
        time: "2026-10-28T10:00:00Z",
        data: { size: "1" },
      }),
    ).toMatchObject({ type: "position", channel: "system.42", seq: 3 });
  });

  it("rejects malformed frames", () => {
    expect(parseServerFrame("not json")).toBe("invalid");
    expect(parseServerFrame({ type: "order.updated", channel: "system.42" })).toBe("invalid");
  });
});
