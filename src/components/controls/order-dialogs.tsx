"use client";

import Decimal from "decimal.js-light";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { LiveConfirm, liveNameMatches } from "@/components/controls/live-confirm";
import { ModeBadge } from "@/components/mode-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { useCancelOrder, useClosePosition, useModifyOrder, useNewOrder } from "@/lib/api/mutations";
import {
  useCommandStatus,
  useInstrument,
  useKillSwitches,
  useSystem,
  useSystemPosition,
} from "@/lib/api/queries";
import { COMMAND_REASON_LABELS, estimateOrder, validManualOrder } from "@/lib/order-controls";
import { formatMoney, formatQuantity } from "@/lib/format";
import type { ManualOrder, SystemCommand, SystemOrder, TradingSystem } from "@/lib/api/types";

type Props = { id: number; open: boolean; onOpenChange: (open: boolean) => void };

function message(error: unknown): string {
  if (error instanceof ApiError && error.code === "mark_unavailable") {
    return "No price yet — try again after the next bar.";
  }
  return error instanceof ApiError ? error.message : "Unable to submit command.";
}

function isGreater(value: string, than: string): boolean {
  try {
    return new Decimal(value).gt(than);
  } catch {
    return false;
  }
}

function Heading({ action, system }: { action: string; system: TradingSystem }) {
  return (
    <>
      <DialogTitle className="flex flex-wrap items-center gap-2">
        {action}: {system.name} <ModeBadge mode={system.mode} />
      </DialogTitle>
      <DialogDescription>
        {system.instrument.venue}:{system.instrument.symbol}
      </DialogDescription>
    </>
  );
}

function ActiveDialog({
  children,
  ...props
}: Props & { children: (system: TradingSystem) => ReactNode }) {
  const system = useSystem(props.id, { enabled: props.open });
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {system.isLoading ? <p>Loading system…</p> : null}
        {system.error ? <p role="alert">{message(system.error)}</p> : null}
        {system.data ? children(system.data) : null}
      </DialogContent>
    </Dialog>
  );
}

function CommandProgress({
  command,
  systemId,
  onDone,
}: {
  command: SystemCommand | null;
  systemId: number;
  onDone: () => void;
}) {
  const status = useCommandStatus(systemId, command?.id ?? null);
  const client = useQueryClient();
  const row = status.data;
  useEffect(() => {
    if (row?.status !== "done") return;
    void Promise.all([
      client.invalidateQueries({ queryKey: ["system", systemId] }),
      client.invalidateQueries({ queryKey: ["systems"] }),
      client.invalidateQueries({ queryKey: ["portfolio"] }),
    ]);
    toast.success("Command completed");
    onDone();
  }, [client, onDone, row?.status, systemId]);
  if (!command) return null;
  if (status.error) return <p role="alert">Couldn&apos;t check status — retrying</p>;
  if (!row) return <p>Submitted</p>;
  if (row.status === "rejected") {
    const reason = row.reason ?? "venue_rejected";
    const riskReason =
      reason === "risk_rejected" && typeof row.result === "object" && row.result !== null
        ? (row.result as Record<string, unknown>).risk_reason
        : null;
    return (
      <p role="alert">
        {COMMAND_REASON_LABELS[reason] ?? reason}
        {typeof riskReason === "string" ? ` ${riskReason}` : ""}
      </p>
    );
  }
  return <p>Command {row.status}</p>;
}

export function CancelOrderDialog({ order, ...props }: Props & { order: SystemOrder }) {
  return (
    <ActiveDialog {...props}>
      {(system) => <CancelBody system={system} order={order} {...props} />}
    </ActiveDialog>
  );
}

function CancelBody({
  system,
  order,
  ...props
}: Props & { system: TradingSystem; order: SystemOrder }) {
  const mutation = useCancelOrder(props.id, order.id);
  const instrument = useInstrument(system.instrument.id, { enabled: props.open });
  const [command, setCommand] = useState<SystemCommand | null>(null);
  const lotSize = instrument.data?.lot_size ?? null;
  const tickSize = instrument.data?.tick_size ?? null;
  return (
    <div className="space-y-4">
      <Heading action="Cancel order" system={system} />
      <p>
        Cancel {order.type} {order.side} order #{order.id}?
      </p>
      <p>
        {order.side} {formatQuantity(order.size, lotSize)} @ {formatQuantity(order.price, tickSize)}
      </p>
      <CommandProgress
        command={command}
        systemId={props.id}
        onDone={() => props.onOpenChange(false)}
      />
      {!command || mutation.isError ? (
        <Button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(undefined, { onSuccess: setCommand })}
        >
          Cancel order
        </Button>
      ) : null}
      {mutation.error ? <p role="alert">{message(mutation.error)}</p> : null}
    </div>
  );
}

export function ModifyOrderDialog({ order, ...props }: Props & { order: SystemOrder }) {
  return (
    <ActiveDialog {...props}>
      {(system) => <ModifyBody system={system} order={order} {...props} />}
    </ActiveDialog>
  );
}

function ModifyBody({
  system,
  order,
  ...props
}: Props & { system: TradingSystem; order: SystemOrder }) {
  const mutation = useModifyOrder(props.id, order.id);
  const instrument = useInstrument(system.instrument.id, { enabled: props.open });
  const [command, setCommand] = useState<SystemCommand | null>(null);
  const [size, setSize] = useState(order.size);
  const [price, setPrice] = useState(order.price ?? "");
  const [stopPrice, setStopPrice] = useState(order.stop_price ?? "");
  const [typed, setTyped] = useState("");
  const valid = isGreater(size, order.filled_size);
  const needsPrice = order.type === "limit" || order.type === "stop_limit";
  const needsStop = order.type === "stop" || order.type === "stop_limit";
  const increase = isGreater(size, order.size);
  const confirmed = system.mode !== "live" || !increase || liveNameMatches(system.name, typed);
  const lotSize = instrument.data?.lot_size ?? null;
  const tickSize = instrument.data?.tick_size ?? null;
  return (
    <div className="space-y-4">
      <Heading action="Modify order" system={system} />
      <p className="text-sm text-yellow-400">Will cancel and replace; queue priority is lost</p>
      <p>
        Current: {order.side} {formatQuantity(order.size, lotSize)} (filled{" "}
        {formatQuantity(order.filled_size, lotSize)}) @ {formatQuantity(order.price, tickSize)}
      </p>
      <Field label="Size" value={size} onChange={setSize} hint={lotSize} />
      {needsPrice ? (
        <Field label="Price" value={price} onChange={setPrice} hint={tickSize} />
      ) : null}
      {needsStop ? (
        <Field label="Stop price" value={stopPrice} onChange={setStopPrice} hint={tickSize} />
      ) : null}
      {system.mode === "live" && increase ? (
        <LiveConfirm name={system.name} value={typed} onChange={setTyped} />
      ) : null}
      <CommandProgress
        command={command}
        systemId={props.id}
        onDone={() => props.onOpenChange(false)}
      />
      {!command || mutation.isError ? (
        <Button
          disabled={
            mutation.isPending ||
            !valid ||
            !confirmed ||
            (needsPrice && !price) ||
            (needsStop && !stopPrice)
          }
          onClick={() =>
            mutation.mutate(
              {
                size,
                ...(needsPrice ? { price } : {}),
                ...(needsStop ? { stop_price: stopPrice } : {}),
              },
              { onSuccess: setCommand },
            )
          }
        >
          Modify order
        </Button>
      ) : null}
      {mutation.error ? <p role="alert">{message(mutation.error)}</p> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | null;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Increment: {formatQuantity(hint, hint)}
        </p>
      ) : null}
    </div>
  );
}

export function NewOrderDialog(props: Props) {
  return (
    <ActiveDialog {...props}>
      {(system) => <NewOrderBody system={system} {...props} />}
    </ActiveDialog>
  );
}

function NewOrderBody({ system, ...props }: Props & { system: TradingSystem }) {
  const mutation = useNewOrder(props.id);
  const position = useSystemPosition(props.id, { enabled: props.open });
  const instrument = useInstrument(system.instrument.id, { enabled: props.open });
  const switches = useKillSwitches();
  const [command, setCommand] = useState<SystemCommand | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<ManualOrder["type"]>("limit");
  const [amountKind, setAmountKind] = useState<"size" | "notional">("size");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [typed, setTyped] = useState("");
  const activeSwitch =
    switches.data?.results.some(
      (item) =>
        item.active &&
        (item.scope === "tenant" ||
          (item.scope === "account" && item.target === system.account) ||
          item.scope === "global"),
    ) ?? false;
  const order: ManualOrder = {
    side,
    type,
    ...(amountKind === "size" ? { size: amount } : { notional: amount }),
    ...(type === "limit" || type === "stop_limit" ? { price } : {}),
    ...(type === "stop" || type === "stop_limit" ? { stop_price: stopPrice } : {}),
    reduce_only: activeSwitch || reduceOnly,
  };
  const estimate = estimateOrder(order, position.data?.mark_price, system.cost_model.fee_rate);
  const lotSize = instrument.data?.lot_size ?? null;
  const tickSize = instrument.data?.tick_size ?? null;
  const currency = instrument.data?.settle ?? system.settle;
  const confirmed =
    system.mode !== "live" || order.reduce_only || liveNameMatches(system.name, typed);
  return (
    <div className="space-y-4">
      <Heading action="New order" system={system} />
      <div className="flex gap-2">
        <label>
          Side{" "}
          <select value={side} onChange={(event) => setSide(event.target.value as "buy" | "sell")}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
        <label>
          Type{" "}
          <select
            value={type}
            onChange={(event) => setType(event.target.value as ManualOrder["type"])}
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
            <option value="stop_limit">Stop-limit</option>
          </select>
        </label>
      </div>
      <fieldset className="flex gap-3">
        <legend>Amount in</legend>
        <label>
          <input
            type="radio"
            name="order-amount-kind"
            checked={amountKind === "size"}
            onChange={() => setAmountKind("size")}
          />{" "}
          By size
        </label>
        <label>
          <input
            type="radio"
            name="order-amount-kind"
            checked={amountKind === "notional"}
            onChange={() => setAmountKind("notional")}
          />{" "}
          By notional
        </label>
      </fieldset>
      <Field
        label={amountKind === "size" ? "Size" : "Notional"}
        value={amount}
        onChange={setAmount}
        hint={amountKind === "size" ? lotSize : null}
      />
      {type === "limit" || type === "stop_limit" ? (
        <Field label="Price" value={price} onChange={setPrice} hint={tickSize} />
      ) : null}
      {type === "stop" || type === "stop_limit" ? (
        <Field label="Stop price" value={stopPrice} onChange={setStopPrice} hint={tickSize} />
      ) : null}
      <label>
        <input
          type="checkbox"
          checked={activeSwitch || reduceOnly}
          disabled={activeSwitch}
          onChange={(event) => setReduceOnly(event.target.checked)}
        />{" "}
        Reduce only
      </label>
      <p>Estimated notional: {formatMoney(estimate?.notional ?? null, currency)}</p>
      <p>Estimated fee: {formatMoney(estimate?.fee ?? null, currency)}</p>
      {system.mode === "live" && !order.reduce_only ? (
        <LiveConfirm name={system.name} value={typed} onChange={setTyped} />
      ) : null}
      <CommandProgress
        command={command}
        systemId={props.id}
        onDone={() => props.onOpenChange(false)}
      />
      {!command || mutation.isError ? (
        <Button
          disabled={!validManualOrder(order) || !confirmed || mutation.isPending}
          onClick={() => mutation.mutate(order, { onSuccess: setCommand })}
        >
          Place order
        </Button>
      ) : null}
      {mutation.error ? <p role="alert">{message(mutation.error)}</p> : null}
    </div>
  );
}

export function ClosePositionDialog(props: Props) {
  return (
    <ActiveDialog {...props}>{(system) => <CloseBody system={system} {...props} />}</ActiveDialog>
  );
}

export function SystemOrderActions({ system }: { system: TradingSystem }) {
  const [open, setOpen] = useState<"new" | "close" | null>(null);
  return (
    <div className="flex gap-2">
      {system.allowed_actions.includes("new_order") ? (
        <Button size="sm" onClick={() => setOpen("new")}>
          New order
        </Button>
      ) : null}
      {system.allowed_actions.includes("close_position") ? (
        <Button size="sm" variant="outline" onClick={() => setOpen("close")}>
          Close position
        </Button>
      ) : null}
      <NewOrderDialog
        key={`new-${open === "new"}`}
        id={system.id}
        open={open === "new"}
        onOpenChange={(value) => !value && setOpen(null)}
      />
      <ClosePositionDialog
        key={`close-${open === "close"}`}
        id={system.id}
        open={open === "close"}
        onOpenChange={(value) => !value && setOpen(null)}
      />
    </div>
  );
}

export function OrderRowActions({ systemId, order }: { systemId: number; order: SystemOrder }) {
  const [open, setOpen] = useState<"cancel" | "modify" | null>(null);
  return (
    <div className="flex gap-2">
      {order.allowed_actions.includes("cancel_order") ? (
        <Button size="sm" variant="outline" onClick={() => setOpen("cancel")}>
          Cancel
        </Button>
      ) : null}
      {order.allowed_actions.includes("modify_order") ? (
        <Button size="sm" variant="outline" onClick={() => setOpen("modify")}>
          Modify
        </Button>
      ) : null}
      <CancelOrderDialog
        key={`cancel-${open === "cancel"}`}
        id={systemId}
        order={order}
        open={open === "cancel"}
        onOpenChange={(value) => !value && setOpen(null)}
      />
      <ModifyOrderDialog
        key={`modify-${open === "modify"}`}
        id={systemId}
        order={order}
        open={open === "modify"}
        onOpenChange={(value) => !value && setOpen(null)}
      />
    </div>
  );
}

function CloseBody({ system, ...props }: Props & { system: TradingSystem }) {
  const mutation = useClosePosition(props.id);
  const position = useSystemPosition(props.id, { enabled: props.open });
  const instrument = useInstrument(system.instrument.id, { enabled: props.open });
  const [command, setCommand] = useState<SystemCommand | null>(null);
  const [typed, setTyped] = useState("");
  const row = position.data;
  const lotSize = instrument.data?.lot_size ?? null;
  const tickSize = instrument.data?.tick_size ?? null;
  const currency = instrument.data?.settle ?? system.settle;
  const confirmed = system.mode !== "live" || liveNameMatches(system.name, typed);
  return (
    <div className="space-y-4">
      <Heading action="Close position" system={system} />
      <p>
        {row?.side === "long" ? "Sell" : "Buy"} {formatQuantity(row?.size ?? null, lotSize)} at{" "}
        {formatQuantity(row?.mark_price ?? null, tickSize)}
      </p>
      <p>Estimated PnL: {formatMoney(row?.unrealised_pnl ?? null, currency)}</p>
      {system.mode === "live" ? (
        <LiveConfirm name={system.name} value={typed} onChange={setTyped} />
      ) : null}
      <CommandProgress
        command={command}
        systemId={props.id}
        onDone={() => props.onOpenChange(false)}
      />
      {!command || mutation.isError ? (
        <Button
          disabled={!row?.side || !confirmed || mutation.isPending}
          onClick={() => mutation.mutate(undefined, { onSuccess: setCommand })}
        >
          Close position
        </Button>
      ) : null}
      {mutation.error ? <p role="alert">{message(mutation.error)}</p> : null}
    </div>
  );
}
