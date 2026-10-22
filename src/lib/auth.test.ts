import { afterEach, describe, expect, it } from "vitest";
import { clearTokens, getAccess, getRefresh, setTokens } from "@/lib/auth";

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
afterEach(() => memory.clear());

describe("token storage", () => {
  it("stores and clears access and refresh tokens", () => {
    setTokens("access-token", "refresh-token");
    expect(getAccess()).toBe("access-token");
    expect(getRefresh()).toBe("refresh-token");
    clearTokens();
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });
});
