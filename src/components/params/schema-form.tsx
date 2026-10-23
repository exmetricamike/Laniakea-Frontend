"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { JsonValue, ParamsSchema } from "@/lib/api/types";

type Property = Record<string, unknown>;
export type FormWithParams = { params: Record<string, string | number | boolean | null> };

export function supportedProperty(property: Property): boolean {
  return (
    ["integer", "number", "boolean", "string"].includes(String(property.type)) ||
    Array.isArray(property.enum)
  );
}

export function schemaFieldState(
  name: string,
  property: Property,
  defaults: Record<string, JsonValue>,
  serverErrors: Record<string, string> = {},
) {
  return {
    type: Array.isArray(property.enum) ? "enum" : String(property.type),
    defaultValue: defaults[name] ?? (property.default as JsonValue | undefined),
    minimum: typeof property.minimum === "number" ? property.minimum : undefined,
    maximum: typeof property.maximum === "number" ? property.maximum : undefined,
    description: typeof property.description === "string" ? property.description : undefined,
    error: serverErrors[name],
  };
}

export function SchemaForm({
  schema,
  defaults,
  form,
  serverErrors = {},
}: {
  schema: ParamsSchema | null | undefined;
  defaults: Record<string, JsonValue>;
  form: UseFormReturn<FormWithParams>;
  serverErrors?: Record<string, string>;
}) {
  const properties = schema?.properties ?? {};
  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([name, raw]) => {
        const property = raw as Property;
        const field = schemaFieldState(name, property, defaults, serverErrors);
        const initial = field.defaultValue;
        const error = field.error;
        const errorId = error ? `param-${name}-error` : undefined;
        const description = field.description;
        if (!supportedProperty(property)) {
          return (
            <p key={name}>
              {initial === undefined ? `Unsupported parameter: ${name}` : `${name}: uses default`}
            </p>
          );
        }
        if (property.type === "boolean") {
          return (
            <div key={name} className="space-y-1">
              <div className="flex items-center gap-2">
                <Switch
                  id={`param-${name}`}
                  checked={form.getValues().params[name] === true}
                  aria-describedby={errorId}
                  aria-invalid={Boolean(error)}
                  onCheckedChange={(value) =>
                    form.setValue("params", { ...form.getValues().params, [name]: value })
                  }
                />
                <Label htmlFor={`param-${name}`}>{name}</Label>
              </div>
              {description ? (
                <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
              ) : null}
              {error ? (
                <p id={errorId} role="alert" className="text-sm text-red-400">
                  {String(error)}
                </p>
              ) : null}
            </div>
          );
        }
        if (Array.isArray(property.enum)) {
          const items = property.enum.filter((item): item is string | number | boolean =>
            ["string", "number", "boolean"].includes(typeof item),
          );
          return (
            <div key={name} className="space-y-1">
              <Label htmlFor={`param-${name}`}>{name}</Label>
              <Select
                value={String(form.getValues().params[name] ?? initial ?? "")}
                onValueChange={(value) => {
                  const item = items.find((candidate) => String(candidate) === value) ?? value;
                  form.setValue("params", { ...form.getValues().params, [name]: item });
                }}
              >
                <SelectTrigger
                  id={`param-${name}`}
                  aria-describedby={errorId}
                  aria-invalid={Boolean(error)}
                >
                  <SelectValue placeholder={`Choose ${name}`} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={String(item)} value={String(item)}>
                      {String(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {description ? (
                <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
              ) : null}
              {error ? (
                <p id={errorId} role="alert" className="text-sm text-red-400">
                  {String(error)}
                </p>
              ) : null}
            </div>
          );
        }
        const numeric = property.type === "integer" || property.type === "number";
        const minimum = typeof property.minimum === "number" ? property.minimum : undefined;
        const maximum = typeof property.maximum === "number" ? property.maximum : undefined;
        return (
          <div key={name} className="space-y-1">
            <Label htmlFor={`param-${name}`}>{name}</Label>
            <Input
              id={`param-${name}`}
              type={numeric ? "number" : "text"}
              min={minimum}
              max={maximum}
              step={property.type === "integer" ? 1 : "any"}
              value={String(form.getValues().params[name] ?? initial ?? "")}
              aria-describedby={errorId}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                const value = numeric ? Number(event.target.value) : event.target.value;
                form.setValue("params", { ...form.getValues().params, [name]: value });
              }}
            />
            {description ? (
              <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
            ) : null}
            {error ? (
              <p id={errorId} role="alert" className="text-sm text-red-400">
                {String(error)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
