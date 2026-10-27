import Decimal from "decimal.js-light";
import type { ManualOrder } from "@/lib/api/types";

export const COMMAND_REASON_LABELS: Record<string, string> = {
  already_filled: "The order was already filled.",
  already_cancelled: "The order was already cancelled.",
  not_open: "The order is no longer open.",
  state_not_allowed: "The system does not accept this command now.",
  risk_rejected: "The order was rejected by risk controls.",
  venue_rejected: "The venue rejected the order.",
  precision: "The order does not meet venue precision requirements.",
  min_notional: "The order is below the minimum notional.",
  worker_unavailable: "The system worker is unavailable.",
  no_position: "There is no position to close.",
  mark_unavailable: "No price yet — try again after the next bar.",
};

export function estimateOrder(
  order: Pick<ManualOrder, "size" | "notional" | "type" | "price" | "stop_price">,
  mark: string | null | undefined,
  feeRate: number,
): { notional: string; fee: string } | null {
  const price =
    order.type === "market" ? mark : order.type === "stop" ? order.stop_price : order.price;
  if (!price) return null;
  try {
    const notional = order.notional
      ? new Decimal(order.notional)
      : new Decimal(order.size ?? "0").mul(price);
    return { notional: notional.toString(), fee: notional.mul(feeRate).toString() };
  } catch {
    return null;
  }
}

export function validManualOrder(order: ManualOrder): boolean {
  const amount = order.size ?? order.notional;
  if (!amount || (order.size !== undefined && order.notional !== undefined)) return false;
  try {
    if (!new Decimal(amount).gt(0)) return false;
    if (order.type === "limit") return Boolean(order.price && new Decimal(order.price).gt(0));
    if (order.type === "stop")
      return Boolean(order.stop_price && new Decimal(order.stop_price).gt(0));
    if (order.type === "stop_limit")
      return Boolean(
        order.price &&
        order.stop_price &&
        new Decimal(order.price).gt(0) &&
        new Decimal(order.stop_price).gt(0),
      );
    return true;
  } catch {
    return false;
  }
}
