import { describe, expect, it } from "vitest";
import { formatJsonValue, paramsRows } from "@/lib/strategies/params";

describe("paramsRows", () => {
  it("preserves property order and applies default precedence", () => {
    const rows = paramsRows(
      {
        properties: {
          period: { type: "integer", minimum: 1, default: 5, enum: [1, "five"] },
          mode: { type: ["string", "null"], default: "fast" },
          unknown: {},
        },
      },
      { period: 10 },
    );
    expect(rows.map((row) => row.name)).toEqual(["period", "mode", "unknown"]);
    expect(rows[0]).toMatchObject({ type: "integer", defaultValue: 10, minimum: 1 });
    expect(rows[1]).toMatchObject({ type: "string | null", defaultValue: "fast" });
    expect(rows[2].type).toBe("—");
  });

  it("returns no rows without properties and formats JSON values", () => {
    expect(paramsRows({}, {})).toEqual([]);
    expect(formatJsonValue({ nested: [true, null] })).toBe('{"nested":[true,null]}');
    expect(formatJsonValue(undefined)).toBe("—");
    expect(formatJsonValue(null)).toBe("null");
  });
});
