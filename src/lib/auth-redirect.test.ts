import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth-redirect";

Object.defineProperty(globalThis, "window", {
  value: { location: { origin: "http://localhost:3001" } },
  configurable: true,
});

describe("safeNext", () => {
  it("only accepts same-origin local paths", () => {
    expect(safeNext("/systems?x=1")).toBe("/systems?x=1");
    expect(safeNext("//evil")).toBe("/portfolio");
    expect(safeNext("/\\evil")).toBe("/portfolio");
    expect(safeNext("https://evil")).toBe("/portfolio");
  });
});
