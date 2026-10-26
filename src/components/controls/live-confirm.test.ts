import { describe, expect, it } from "vitest";
import { liveNameMatches } from "@/components/controls/live-confirm";

describe("liveNameMatches", () => {
  it("requires case-sensitive system names while accepting typed padding", () => {
    expect(liveNameMatches("Paper trend", " Paper trend ")).toBe(true);
    expect(liveNameMatches("Paper trend", "paper trend")).toBe(false);
    expect(liveNameMatches("Paper trend", "Paper trend x")).toBe(false);
  });
});
