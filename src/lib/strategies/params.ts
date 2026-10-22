import type { JsonValue, ParamsSchema } from "@/lib/api/types";

export type ParamRow = {
  name: string;
  type: string;
  defaultValue: unknown;
  minimum: unknown;
  maximum: unknown;
  enumValues: unknown;
  description: unknown;
};

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join(" | ");
  }
  return "—";
}

export function formatJsonValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}

export function paramsRows(schema: ParamsSchema | null | undefined, defaults: unknown): ParamRow[] {
  if (!schema?.properties) return [];
  const safeDefaults = isJsonObject(defaults) ? defaults : {};
  return Object.entries(schema.properties).map(([name, property]) => ({
    name,
    type: typeLabel(property.type),
    defaultValue: name in safeDefaults ? safeDefaults[name] : property.default,
    minimum: property.minimum,
    maximum: property.maximum,
    enumValues: property.enum,
    description: property.description,
  }));
}
