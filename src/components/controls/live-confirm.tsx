"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function liveNameMatches(name: string, typed: string): boolean {
  return name === typed.trim();
}

export function LiveConfirm({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 rounded border border-red-500/40 p-3">
      <Label htmlFor="live-confirm">Type the system name to confirm LIVE exposure</Label>
      <Input
        id="live-confirm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
    </div>
  );
}
