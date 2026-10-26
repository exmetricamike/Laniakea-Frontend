"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { useSetGlobalKillSwitch, useSetKillSwitch } from "@/lib/api/mutations";

type Scope = "tenant" | "account" | "global";

export function KillSwitchDialog({
  open,
  onOpenChange,
  scope,
  active,
  accountId,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: Scope;
  active: boolean;
  accountId?: number;
  label?: string;
}) {
  const setSwitch = useSetKillSwitch();
  const setGlobal = useSetGlobalKillSwitch();
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const title =
    scope === "tenant"
      ? "Tenant — all my systems"
      : scope === "global"
        ? "Global"
        : `Account ${label ?? ""}`;
  const pending = setSwitch.isPending || setGlobal.isPending;
  function submit() {
    const onSuccess = () => {
      toast.success(active ? "Kill switch deactivated" : "Kill switch activated");
      onOpenChange(false);
    };
    const onError = (value: ApiError) => {
      const fieldErrors = value.fields
        ? Object.values(value.fields).flatMap((field) =>
            Array.isArray(field)
              ? field.filter((message): message is string => typeof message === "string")
              : [],
          )
        : [];
      setErrors(fieldErrors.length ? fieldErrors : [value.message]);
    };
    if (scope === "global") {
      setGlobal.mutate({ active: !active, reason: reason.trim() }, { onSuccess, onError });
      return;
    }
    const body =
      scope === "account"
        ? { scope, target: accountId, active: !active, reason: reason.trim() }
        : { scope, active: !active, reason: reason.trim() };
    setSwitch.mutate(body, { onSuccess, onError });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-4">
          <DialogTitle>
            {active ? "Deactivate" : "Activate"} kill switch: {title}
          </DialogTitle>
          <DialogDescription>
            {active
              ? "Halted systems stay halted until acknowledged."
              : "New orders will be blocked immediately."}
          </DialogDescription>
          <Label htmlFor="kill-switch-reason">Reason</Label>
          <Input
            id="kill-switch-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-describedby={errors.length ? "kill-switch-error" : undefined}
          />
          {errors.length ? (
            <ul id="kill-switch-error" role="alert">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          <Button
            variant={active ? "outline" : "destructive"}
            disabled={!reason.trim() || pending}
            onClick={submit}
          >
            {active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
