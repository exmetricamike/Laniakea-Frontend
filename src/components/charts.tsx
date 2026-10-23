"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import Decimal from "decimal.js-light";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartPayload, SystemOrder } from "@/lib/api/types";

type ChartMarker = ChartPayload["markers"][number];
export type OrderLine = { price: string; label: string; dashed: boolean };

export function toChartTime(milliseconds: number): number {
  return Math.floor(milliseconds / 1_000);
}

export function snapMarkers(markers: ChartMarker[], timeframeMs?: number): ChartMarker[] {
  if (!timeframeMs) return markers;
  return markers.map((marker) => ({
    ...marker,
    t: Math.floor(marker.t / timeframeMs) * timeframeMs,
  }));
}

export function orderLines(openOrders: SystemOrder[]): OrderLine[] {
  return openOrders.flatMap((order) => {
    const price = order.price ?? order.stop_price;
    if (!price) return [];
    const parts = [
      order.tag ?? "",
      order.side,
      new Decimal(order.size).toSignificantDigits(8).toString(),
      `@ ${new Decimal(price).toFixed(2)}`,
    ].filter(Boolean);
    return [{ price, label: parts.join(" "), dashed: order.price === null }];
  });
}

export function EquityChart({
  data,
  showRealised = false,
  showUnrealised = false,
  controls,
}: {
  data:
    | {
        t: number[];
        value: Array<string | number>;
        drawdown: number[];
        realised?: Array<string | number>;
        unrealised?: Array<string | number>;
      }
    | undefined;
  showRealised?: boolean;
  showUnrealised?: boolean;
  controls?: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const times = useMemo(() => (Array.isArray(data?.t) ? data.t : []), [data]);
  useEffect(() => {
    if (!host.current || !data || times.length === 0) return;
    let disposed = false;
    let dispose: (() => void) | null = null;
    void import("lightweight-charts").then(({ AreaSeries, LineSeries, createChart }) => {
      if (!host.current || disposed) return;
      const chart = createChart(host.current, {
        autoSize: true,
        height: 220,
        layout: { textColor: "#a1a1aa", background: { color: "transparent" } },
      });
      const equity = chart.addSeries(LineSeries, { color: "#60a5fa" });
      equity.setData(
        data.t.map((time, index) => ({
          time: toChartTime(time) as never,
          value: Number(data.value[index]),
        })),
      );
      if (showRealised && data.realised) {
        const realised = chart.addSeries(LineSeries, { color: "#a78bfa" });
        realised.setData(
          data.t.map((time, index) => ({
            time: toChartTime(time) as never,
            value: Number(data.realised?.[index]),
          })),
        );
      }
      if (showUnrealised && data.unrealised) {
        const unrealised = chart.addSeries(LineSeries, { color: "#f59e0b" });
        unrealised.setData(
          data.t.map((time, index) => ({
            time: toChartTime(time) as never,
            value: Number(data.unrealised?.[index]),
          })),
        );
      }
      const drawdownPane = chart.addPane();
      const drawdown = drawdownPane.addSeries(AreaSeries, {
        lineColor: "#ef4444",
        topColor: "rgba(239, 68, 68, 0.35)",
        bottomColor: "rgba(239, 68, 68, 0.05)",
      });
      drawdown.setData(
        data.t.map((time, index) => ({
          time: toChartTime(time) as never,
          value: -data.drawdown[index] * 100,
        })),
      );
      chart.timeScale().fitContent();
      dispose = () => chart.remove();
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [data, showRealised, showUnrealised, times]);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Equity & drawdown</CardTitle>
        {controls}
      </CardHeader>
      <CardContent>
        <div
          ref={host}
          className="h-[260px] rounded bg-[var(--muted)]"
          data-points={times.length}
          data-first={times[0] ? new Date(times[0]).toISOString() : ""}
          data-last={times.at(-1) ? new Date(times.at(-1) as number).toISOString() : ""}
        />
        {!times.length ? <p className="mt-2 text-sm">No chart data.</p> : null}
      </CardContent>
    </Card>
  );
}

export function PriceChart({
  data,
  orderLines: lines = [],
  timeframeMs,
}: {
  data: ChartPayload;
  orderLines?: OrderLine[];
  timeframeMs?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current || data.t.length === 0) return;
    let disposed = false;
    let dispose: (() => void) | null = null;
    void import("lightweight-charts").then(
      ({ CandlestickSeries, LineStyle, createChart, createSeriesMarkers }) => {
        if (!host.current || disposed) return;
        const chart = createChart(host.current, {
          autoSize: true,
          height: 260,
          layout: { textColor: "#a1a1aa", background: { color: "transparent" } },
        });
        const series = chart.addSeries(CandlestickSeries);
        series.setData(
          data.t.map((time, index) => ({
            time: toChartTime(time) as never,
            open: Number(data.open[index]),
            high: Number(data.high[index]),
            low: Number(data.low[index]),
            close: Number(data.close[index]),
          })),
        );
        createSeriesMarkers(
          series,
          snapMarkers(data.markers, timeframeMs).map((marker) => {
            const manual = marker.origin === "manual";
            return {
              time: toChartTime(marker.t) as never,
              position: marker.side === "buy" ? "belowBar" : "aboveBar",
              color: manual ? "#a78bfa" : marker.side === "buy" ? "#22c55e" : "#ef4444",
              shape: manual ? "circle" : marker.side === "buy" ? "arrowUp" : "arrowDown",
              text: manual ? "M" : marker.side === "buy" ? "B" : "S",
            };
          }),
        );
        lines.forEach((line) => {
          series.createPriceLine({
            price: Number(line.price),
            color: line.dashed ? "#f59e0b" : "#38bdf8",
            lineStyle: line.dashed ? LineStyle.Dashed : LineStyle.Solid,
            lineWidth: 1,
            axisLabelVisible: true,
            title: line.label,
          });
        });
        chart.timeScale().fitContent();
        dispose = () => chart.remove();
      },
    );
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [data, lines, timeframeMs]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price chart</CardTitle>
      </CardHeader>
      <CardContent>
        {data.t.length ? (
          <div ref={host} className="h-[260px] rounded bg-[var(--muted)]" />
        ) : (
          <p>No market data for this window.</p>
        )}
      </CardContent>
    </Card>
  );
}
