import { describe, expect, it } from "vitest";
import { schemaFieldState, supportedProperty } from "@/components/params/schema-form";

describe("SchemaForm schema handling", () => {
  it("supports every v1 field type", () => {
    for (const property of [
      { type: "integer" },
      { type: "number" },
      { type: "string" },
      { type: "boolean" },
      { enum: ["fast", "slow"] },
    ]) {
      expect(supportedProperty(property)).toBe(true);
    }
  });

  it("uses defaults, bounds, descriptions, and server errors", () => {
    const state = schemaFieldState(
      "period",
      { type: "integer", default: 5, minimum: 1, maximum: 20, description: "Lookback." },
      { period: 10 },
      { period: "Must be at most 20." },
    );
    expect(state).toEqual({
      type: "integer",
      defaultValue: 10,
      minimum: 1,
      maximum: 20,
      description: "Lookback.",
      error: "Must be at most 20.",
    });
  });
});
