"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { ModeBadge } from "@/components/mode-badge";
import { LiveConfirm, liveNameMatches } from "@/components/controls/live-confirm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { useAckSystem, useStartSystem, useStopSystem } from "@/lib/api/mutations";
import { useSystem, useSystemEvents } from "@/lib/api/queries";
import { START_BLOCKER_LABELS } from "@/lib/start-blockers";

type DialogProps = { id: number; open: boolean; onOpenChange: (open: boolean) => void };

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Unable to complete the request.";
}

function SystemDialog({
  children,
  id,
  open,
  onOpenChange,
}: DialogProps & {
  children: (system: NonNullable<ReturnType<typeof useSystem>["data"]>) => ReactNode;
}) {
  const system = useSystem(id, { enabled: open });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {system.isLoading ? <p>Loading system…</p> : null}
        {system.error ? <p role="alert">{errorText(system.error)}</p> : null}
        {system.data ? children(system.data) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogHeading({
  action,
  system,
}: {
  action: string;
  system: NonNullable<ReturnType<typeof useSystem>["data"]>;
}) {
  return (
    <>
      <DialogTitle className="flex flex-wrap items-center gap-2">
        {action}: {system.name}
        <ModeBadge mode={system.mode} />
      </DialogTitle>
      <DialogDescription>
        {system.instrument.venue}:{system.instrument.symbol}
      </DialogDescription>
    </>
  );
}

export function StartDialog(props: DialogProps) {
  const mutation = useStartSystem(props.id);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  return (
    <SystemDialog {...props}>
      {(system) => {
        const live = system.mode === "live";
        const blocked = live && !liveNameMatches(system.name, typed);
        const reasons = error?.status === 412 && Array.isArray(error.reasons) ? error.reasons : [];
        return (
          <div className="space-y-4">
            <DialogHeading action="Start" system={system} />
            {live ? <LiveConfirm name={system.name} value={typed} onChange={setTyped} /> : null}
            {reasons.length ? (
              <ul role="alert" className="space-y-1 text-sm text-red-400">
                {reasons
                  .filter((value): value is string => typeof value === "string")
                  .map((reason) => (
                    <li key={reason}>
                      {START_BLOCKER_LABELS[reason] ?? reason}{" "}
                      {reason === "kill_switch_active" ? (
                        <Link className="underline" href="/risk">
                          Fix
                        </Link>
                      ) : null}
                      {reason.startsWith("account_") && system.account ? (
                        <Link className="underline" href={`/accounts/${system.account}`}>
                          Fix
                        </Link>
                      ) : null}
                    </li>
                  ))}
              </ul>
            ) : null}
            {error && error.status !== 412 ? <p role="alert">{errorText(error)}</p> : null}
            <Button
              disabled={blocked || mutation.isPending}
              onClick={() =>
                mutation.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Start requested");
                    props.onOpenChange(false);
                  },
                  onError: setError,
                })
              }
            >
              Start
            </Button>
          </div>
        );
      }}
    </SystemDialog>
  );
}

export function StopDialog(props: DialogProps) {
  const mutation = useStopSystem(props.id);
  const [policy, setPolicy] = useState<"keep_positions" | "cancel_all" | "flatten">(
    "keep_positions",
  );
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  return (
    <SystemDialog {...props}>
      {(system) => {
        const confirm = system.mode === "live" && policy === "flatten";
        return (
          <div className="space-y-4">
            <DialogHeading action="Stop" system={system} />
            <fieldset className="space-y-3" aria-describedby={error ? "stop-error" : undefined}>
              <legend>Stop policy</legend>
              {[
                ["keep_positions", "Keep positions", "Stop strategy orders and retain positions."],
                ["cancel_all", "Cancel all orders", "Cancel open orders and retain positions."],
                ["flatten", "Flatten", "Cancel orders and close positions."],
              ].map(([value, label, description]) => (
                <label key={value} className="block">
                  <input
                    type="radio"
                    name="stop-policy"
                    value={value}
                    checked={policy === value}
                    onChange={() => setPolicy(value as typeof policy)}
                  />{" "}
                  {label}
                  <span className="ml-2 text-sm text-[var(--muted-foreground)]">{description}</span>
                </label>
              ))}
            </fieldset>
            {confirm ? <LiveConfirm name={system.name} value={typed} onChange={setTyped} /> : null}
            {error ? (
              <p id="stop-error" role="alert">
                {error.status === 409 ? "The system changed state — refresh" : errorText(error)}
              </p>
            ) : null}
            <Button
              disabled={mutation.isPending || (confirm && !liveNameMatches(system.name, typed))}
              onClick={() =>
                mutation.mutate(
                  { policy },
                  {
                    onSuccess: () => {
                      toast.success("Stop requested");
                      props.onOpenChange(false);
                    },
                    onError: setError,
                  },
                )
              }
            >
              Stop
            </Button>
          </div>
        );
      }}
    </SystemDialog>
  );
}

export function AckDialog(props: DialogProps) {
  const mutation = useAckSystem(props.id);
  const events = useSystemEvents(props.id, {}, { enabled: props.open });
  const [note, setNote] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const event = events.data?.pages
    .flatMap((page) => page.results)
    .find((item) => ["risk.kill_switch", "data.gap", "lifecycle.error"].includes(item.kind));
  return (
    <SystemDialog {...props}>
      {(system) => (
        <div className="space-y-4">
          <DialogHeading action="Acknowledge halt" system={system} />
          <p>{system.state_reason || "No halt reason recorded."}</p>
          {event ? <p className="text-sm">Latest event: {event.message}</p> : null}
          <Label htmlFor="ack-note">Acknowledgement note</Label>
          <textarea
            id="ack-note"
            className="min-h-24 w-full rounded-md border bg-transparent p-2"
            value={note}
            onChange={(item) => setNote(item.target.value)}
            aria-describedby={error ? "ack-error" : undefined}
          />
          {error ? (
            <p id="ack-error" role="alert">
              {error.status === 409 ? "The system changed state — refresh" : errorText(error)}
            </p>
          ) : null}
          <Button
            disabled={note.trim().length < 10 || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { note },
                {
                  onSuccess: () => {
                    toast.success("Acknowledgement requested");
                    props.onOpenChange(false);
                  },
                  onError: setError,
                },
              )
            }
          >
            Acknowledge
          </Button>
        </div>
      )}
    </SystemDialog>
  );
}
