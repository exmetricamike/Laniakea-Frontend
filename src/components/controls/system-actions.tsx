"use client";

import { useState } from "react";
import { AckDialog, StartDialog, StopDialog } from "@/components/controls/lifecycle-dialogs";
import { Button } from "@/components/ui/button";
import type { SystemRow } from "@/lib/api/types";

export function lifecycleActions(actions: string[]): Array<"start" | "stop" | "ack"> {
  return ["start", "stop", "ack"].filter((action): action is "start" | "stop" | "ack" =>
    actions.includes(action),
  );
}

export function SystemActions({ system }: { system: SystemRow }) {
  const [open, setOpen] = useState<"start" | "stop" | "ack" | null>(null);
  const actions = lifecycleActions(system.allowed_actions);
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action}
          size="sm"
          variant={action === "stop" ? "outline" : "default"}
          onClick={() => setOpen(action)}
        >
          {action === "ack" ? "Ack" : action[0].toUpperCase() + action.slice(1)}
        </Button>
      ))}
      <StartDialog
        key={`start-${open === "start"}`}
        id={system.id}
        open={open === "start"}
        onOpenChange={(value) => !value && setOpen(null)}
      />
      <StopDialog
        key={`stop-${open === "stop"}`}
        id={system.id}
        open={open === "stop"}
        onOpenChange={(value) => !value && setOpen(null)}
      />
      <AckDialog
        key={`ack-${open === "ack"}`}
        id={system.id}
        open={open === "ack"}
        onOpenChange={(value) => !value && setOpen(null)}
      />
    </div>
  );
}
