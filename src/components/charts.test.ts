import { describe, expect, it } from "vitest";
import { orderLines, snapMarkers, toChartTime } from "@/components/charts";
import type { SystemOrder } from "@/lib/api/types";

const order: SystemOrder = {
  id: 1,
  client_id: "test",
  tag: "TP",
  origin: "strategy",
  created_by: null,
  side: "sell",
  type: "limit",
  size: "0.031",
  price: "66000",
  stop_price: null,
  reduce_only: false,
  status: "accepted",
  filled_size: "0",
  avg_fill_price: null,
  reject_reason: null,
  cancelled_by: null,
  replaces: null,
  replaced_by: null,
  bar_time: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  allowed_actions: [],
};

describe("charts", () => {
  it("converts milliseconds to chart seconds", () => {
    expect(toChartTime(1792742400000)).toBe(1792742400);
  });

  it("snaps markers to their bar", () => {
    const markers = snapMarkers(
      [
        {
          t: 5_400_000,
          kind: "fill",
          side: "buy",
          price: "1",
          size: "1",
          origin: "strategy",
          order_id: 1,
        },
      ],
      3_600_000,
    );
    expect(markers[0].t).toBe(3_600_000);
  });

  it("creates limit and stop order lines", () => {
    expect(orderLines([order])).toEqual([
      { price: "66000", label: "TP sell 0.031 @ 66000.00", dashed: false },
    ]);
    expect(
      orderLines([
        { ...order, tag: null, side: "buy", size: "0.5", price: null, stop_price: "55184.49" },
      ]),
    ).toEqual([{ price: "55184.49", label: "buy 0.5 @ 55184.49", dashed: true }]);
  });
});
