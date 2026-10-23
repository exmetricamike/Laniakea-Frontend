"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import Decimal from "decimal.js-light";
import { Copy, LoaderCircle } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useCancelBacktest, useCreateBacktest } from "@/lib/api/mutations";
import {
  useBacktest,
  useBacktestChart,
  useBacktestEquity,
  useBacktestOrders,
  useBacktestTrades,
  useBacktestsInfinite,
  useInstruments,
  useStrategies,
  useStrategyVersion,
  useVenues,
} from "@/lib/api/queries";
import type {
  BacktestJob,
  BacktestMetric,
  ChartPayload,
  CreateBacktestBody,
  Instrument,
} from "@/lib/api/types";
import {
  type FormWithParams,
  SchemaForm,
  supportedProperty,
} from "@/components/params/schema-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const metricRows = [
  ["total_return", "Total return", "percent"],
  ["cagr", "CAGR", "percent"],
  ["max_drawdown", "Max drawdown", "percent"],
  ["win_rate", "Win rate", "percent"],
  ["exposure", "Exposure", "percent"],
  ["benchmark_return", "Benchmark return", "percent"],
  ["sharpe", "Sharpe", "number"],
  ["sortino", "Sortino", "number"],
  ["profit_factor", "Profit factor", "number"],
  ["net_profit", "Net profit", "money"],
  ["fees", "Fees", "money"],
  ["avg_trade", "Average trade", "money"],
  ["start_value", "Start value", "money"],
  ["end_value", "End value", "money"],
  ["trades", "Trades", "integer"],
  ["start", "Start", "date"],
  ["end", "End", "date"],
] as const;

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Unable to complete the request.";
}

function fieldMessages(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.fields) return {};
  return Object.fromEntries(
    Object.entries(error.fields).flatMap(([key, value]) => {
      const message = Array.isArray(value) ? value[0] : value;
      return typeof message === "string" ? [[key, message]] : [];
    }),
  );
}

function utcDate(value: string): Date {
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`);
}

function localTime(value: string | null): ReactNode {
  if (!value) return "—";
  const date = utcDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return <span title={date.toUTCString()}>{date.toLocaleString()}</span>;
}

function formatMetric(value: BacktestMetric[string], kind: string): ReactNode {
  if (value === null || value === undefined) {
    return <span title="Not enough data in this segment">—</span>;
  }
  if (kind === "date" && typeof value === "string") return value.slice(0, 10);
  if (kind === "integer") return String(value);
  if (typeof value !== "number") return String(value);
  if (kind === "percent") return `${new Decimal(value).mul(100).toFixed(2)}%`;
  return new Decimal(value).toFixed(2);
}

function Status({ job }: { job: BacktestJob }) {
  const variant =
    job.status === "failed" ? "destructive" : job.status === "done" ? "default" : "secondary";
  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant}>{job.status}</Badge>
      {job.status === "running" ? (
        <div className="h-2 w-24 overflow-hidden rounded bg-[var(--muted)]" aria-label="Progress">
          <div
            className="h-full bg-blue-400"
            style={{ width: `${Math.round(job.progress * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function BacktestsPage() {
  const [filters, setFilters] = useState({ strategy: "", status: "" });
  const strategies = useStrategies();
  const jobs = useBacktestsInfinite(filters);
  const rows = jobs.data?.pages.flatMap((page) => page.results) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Backtests</h1>
        <Button asChild>
          <Link href="/backtests/new">New backtest</Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Strategy filter"
          value={filters.strategy}
          onChange={(event) => setFilters({ ...filters, strategy: event.target.value })}
        >
          <option value="">All strategies</option>
          {strategies.data?.results.map((strategy) => (
            <option key={strategy.key} value={strategy.key}>
              {strategy.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Status filter"
          value={filters.status}
          onChange={(event) => setFilters({ ...filters, status: event.target.value })}
        >
          <option value="">All statuses</option>
          {["queued", "running", "done", "failed", "cancelled"].map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </div>
      {jobs.isLoading ? <Skeleton className="h-64" /> : null}
      {jobs.error ? <p role="alert">{errorMessage(jobs.error)}</p> : null}
      {!jobs.isLoading && rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">No backtests yet.</CardContent>
        </Card>
      ) : null}
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Strategy</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Instrument</TableHead>
              <TableHead>Timeframe</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <Link className="underline" href={`/backtests/${job.id}`}>
                    {job.strategy}
                  </Link>
                </TableCell>
                <TableCell>{job.version}</TableCell>
                <TableCell>{job.instrument.symbol}</TableCell>
                <TableCell>{job.timeframe}</TableCell>
                <TableCell>
                  {job.start.slice(0, 10)} – {job.end.slice(0, 10)}
                </TableCell>
                <TableCell>
                  <Status job={job} />
                </TableCell>
                <TableCell>{localTime(job.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      {jobs.hasNextPage ? (
        <Button
          variant="outline"
          disabled={jobs.isFetchingNextPage}
          onClick={() => void jobs.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

type FormValues = {
  strategy: string;
  venue: string;
  kind: string;
  instrument: string;
  timeframe: string;
  start: string;
  end: string;
  in_sample_end: string;
  allocation: string;
  fee_rate: string;
  slippage_bps: string;
  params: Record<string, string | number | boolean | null>;
};

export function NewBacktestPage() {
  const router = useRouter();
  const search = useSearchParams();
  const strategies = useStrategies();
  const form = useForm<FormValues>({
    defaultValues: {
      strategy: search.get("strategy") ?? "",
      venue: "binance",
      kind: "spot",
      instrument: "",
      timeframe: "",
      start: "",
      end: "",
      in_sample_end: "",
      allocation: "10000",
      fee_rate: "0.001",
      slippage_bps: "0",
      params: {},
    },
  });
  const strategyKey = useWatch({ control: form.control, name: "strategy" });
  const venue = useWatch({ control: form.control, name: "venue" });
  const kind = useWatch({ control: form.control, name: "kind" });
  const instrumentId = useWatch({ control: form.control, name: "instrument" });
  const timeframe = useWatch({ control: form.control, name: "timeframe" });
  const feeRate = useWatch({ control: form.control, name: "fee_rate" });
  const [instrumentSearch, setInstrumentSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const selected =
    strategies.data?.results.find((strategy) => strategy.key === strategyKey) ?? null;
  const version = selected?.latest_version.version ?? null;
  const detail = useStrategyVersion(strategyKey, version);
  const venues = useVenues();
  const instruments = useInstruments({
    venue,
    kind,
    search: debouncedSearch,
    page_size: 100,
  });
  const chosen = instruments.data?.results.find((item) => item.id === Number(instrumentId));
  const mutation = useCreateBacktest();
  const [error, setError] = useState("");
  const unsupported = Object.entries(detail.data?.params_schema?.properties ?? {}).some(
    ([name, value]) =>
      !supportedProperty(value) &&
      detail.data?.default_params?.[name] === undefined &&
      value.default === undefined,
  );
  const compatibleVenues = venues.data?.results.filter((item) => item.kinds.includes(kind)) ?? [];
  const selectedVenue = compatibleVenues.some((item) => item.id === venue)
    ? venue
    : (compatibleVenues[0]?.id ?? "");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(instrumentSearch), 300);
    return () => window.clearTimeout(timer);
  }, [instrumentSearch]);
  useEffect(() => {
    if (selectedVenue && selectedVenue !== venue) form.setValue("venue", selectedVenue);
  }, [form, selectedVenue, venue]);
  useEffect(() => {
    if (selected) {
      form.setValue("kind", selected.instrument_kinds[0] ?? "spot");
      form.setValue("timeframe", "");
      form.setValue("instrument", "");
      form.reset({
        ...form.getValues(),
        params: (detail.data?.default_params ?? {}) as Record<
          string,
          string | number | boolean | null
        >,
      });
    }
  }, [selected?.key, detail.data?.version]);
  async function submit(values: FormValues) {
    setError("");
    const start = `${values.start}T00:00:00Z`;
    const end = `${values.end}T00:00:00Z`;
    const split = values.in_sample_end ? `${values.in_sample_end}T00:00:00Z` : undefined;
    if (
      !values.start ||
      !values.end ||
      end <= start ||
      (split && (split <= start || split >= end))
    ) {
      setError("Choose a valid UTC date window and split.");
      return;
    }
    if (!chosen) {
      setError("Choose an instrument.");
      return;
    }
    try {
      const job = await mutation.mutateAsync({
        strategy: values.strategy,
        version: version ?? "",
        params: values.params,
        instrument: chosen.id,
        timeframe: values.timeframe,
        start,
        end,
        ...(split ? { in_sample_end: split } : {}),
        allocation: values.allocation,
        cost_model: {
          instrument_kind: chosen.kind,
          fee_rate: Number(values.fee_rate),
          slippage_bps: Number(values.slippage_bps),
          leverage: 1,
        },
      } as CreateBacktestBody);
      router.push(`/backtests/${job.id}`);
    } catch (reason) {
      const fields = fieldMessages(reason);
      Object.entries(fields).forEach(([name, message]) =>
        form.setError(name as keyof FormValues, { message }),
      );
      setError(errorMessage(reason));
    }
  }
  const timeframes = Array.isArray(chosen?.timeframes)
    ? chosen.timeframes.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(selected?.recommended_timeframes.includes(item)),
      )
    : [];
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New backtest</h1>
      <Card>
        <CardContent className="p-6">
          <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
            <div>
              <Label htmlFor="strategy">Strategy</Label>
              <Select
                value={strategyKey}
                onValueChange={(value) => form.setValue("strategy", value)}
              >
                <SelectTrigger id="strategy">
                  <SelectValue placeholder="Choose strategy" />
                </SelectTrigger>
                <SelectContent>
                  {strategies.data?.results
                    .filter((item) => item.latest_version.published_at)
                    .map((item) => (
                      <SelectItem key={item.key} value={item.key}>
                        {item.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {selected ? (
              <p>
                Version: <code>{version}</code>
              </p>
            ) : null}
            <SchemaForm
              schema={detail.data?.params_schema}
              defaults={
                (detail.data?.default_params ?? {}) as Record<
                  string,
                  string | number | boolean | null
                >
              }
              form={form as unknown as import("react-hook-form").UseFormReturn<FormWithParams>}
            />
            <div>
              <Label htmlFor="venue">Venue</Label>
              <Select
                value={selectedVenue}
                onValueChange={(value) => form.setValue("venue", value)}
              >
                <SelectTrigger id="venue">
                  <SelectValue placeholder="Choose venue" />
                </SelectTrigger>
                <SelectContent>
                  {compatibleVenues.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kind">Kind</Label>
              <Select value={kind} onValueChange={(value) => form.setValue("kind", value)}>
                <SelectTrigger id="kind">
                  <SelectValue placeholder="Choose kind" />
                </SelectTrigger>
                <SelectContent>
                  {selected?.instrument_kinds.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="instrument-search">Search instruments</Label>
              <Input
                id="instrument-search"
                value={instrumentSearch}
                onChange={(event) => setInstrumentSearch(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="instrument">Instrument</Label>
              <Select
                value={instrumentId}
                onValueChange={(value) => form.setValue("instrument", value)}
              >
                <SelectTrigger id="instrument">
                  <SelectValue placeholder="Choose instrument" />
                </SelectTrigger>
                <SelectContent>
                  {instruments.data?.results.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {instruments.data && instruments.data.results.length === 0 ? (
                <p>No instruments match.</p>
              ) : null}
              {form.formState.errors.instrument?.message ? (
                <p role="alert">
                  {form.formState.errors.instrument.message} Backtests need curated data (binance
                  spot 1h/1d).
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select
                value={timeframe}
                onValueChange={(value) => form.setValue("timeframe", value)}
              >
                <SelectTrigger id="timeframe">
                  <SelectValue placeholder="Choose timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {timeframes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["start", "end", "in_sample_end"] as const).map((name) => (
                <div key={name}>
                  <Label htmlFor={name}>
                    {name === "start"
                      ? "Start (UTC)"
                      : name === "end"
                        ? "End (UTC)"
                        : "In-sample end (UTC, optional)"}
                  </Label>
                  <Input id={name} type="date" {...form.register(name)} />
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="allocation">Allocation</Label>
              <Input id="allocation" {...form.register("allocation", { required: true })} />
            </div>
            <div>
              <Label htmlFor="fee_rate">Fee rate (fraction, 0.001 = 0.10%)</Label>
              <Input
                id="fee_rate"
                type="number"
                min="0"
                max="0.099999"
                step="any"
                {...form.register("fee_rate", { required: true })}
              />
              <p>{(Number(feeRate || 0) * 100).toFixed(2)}%</p>
            </div>
            <div>
              <Label htmlFor="slippage_bps">Slippage (bps)</Label>
              <Input
                id="slippage_bps"
                type="number"
                min="0"
                step="1"
                {...form.register("slippage_bps", { required: true })}
              />
            </div>
            <p>Instrument kind: {chosen?.kind ?? kind}</p>
            <p>Leverage: 1</p>
            {error ? <p role="alert">{error}</p> : null}
            <Button type="submit" disabled={mutation.isPending || unsupported || !selected}>
              {mutation.isPending ? <LoaderCircle className="animate-spin" /> : null} Create
              backtest
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Assumptions({ job }: { job: BacktestJob }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Caveats & assumptions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>
          Cost model: {job.cost_model.instrument_kind}; fee{" "}
          {(job.cost_model.fee_rate * 100).toFixed(2)}%; slippage {job.cost_model.slippage_bps} bps;
          leverage {job.cost_model.leverage}
        </p>
        <p>
          Full: {job.start.slice(0, 10)} → {job.end.slice(0, 10)}
        </p>
        {job.in_sample_end ? (
          <>
            <p>
              In-sample: {job.start.slice(0, 10)} → {job.in_sample_end.slice(0, 10)}
            </p>
            <p>
              Out-of-sample: {job.in_sample_end.slice(0, 10)} → {job.end.slice(0, 10)}
            </p>
          </>
        ) : (
          <p role="alert">No out-of-sample split.</p>
        )}
        <ul className="list-disc pl-5">
          {job.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Metrics({ job }: { job: BacktestJob }) {
  if (!job.metrics) {
    return (
      <Card>
        <CardContent className="p-6">Results appear when the backtest finishes.</CardContent>
      </Card>
    );
  }
  const metrics = job.metrics;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Full</TableHead>
              <TableHead>In-sample</TableHead>
              <TableHead>Out-of-sample</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metricRows.map(([key, label, kind]) => (
              <TableRow key={key}>
                <TableCell>{label}</TableCell>
                <TableCell>{formatMetric(metrics.full?.[key], kind)}</TableCell>
                <TableCell>{formatMetric(metrics.in_sample?.[key], kind)}</TableCell>
                <TableCell>{formatMetric(metrics.out_of_sample?.[key], kind)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EquityChart({
  data,
}: {
  data: { t: number[]; value: string[]; drawdown: number[] } | undefined;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current || !data || !Array.isArray(data.t) || data.t.length === 0) return;
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
          time: (time / 1000) as never,
          value: Number(data.value[index]),
        })),
      );
      const drawdownPane = chart.addPane();
      const drawdown = drawdownPane.addSeries(AreaSeries, {
        lineColor: "#ef4444",
        topColor: "rgba(239, 68, 68, 0.35)",
        bottomColor: "rgba(239, 68, 68, 0.05)",
      });
      drawdown.setData(
        data.t.map((time, index) => ({
          time: (time / 1000) as never,
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
  }, [data]);
  const times = Array.isArray(data?.t) ? data.t : [];
  const first = times[0] ? new Date(times[0]).toISOString() : "";
  const last = times.at(-1) ? new Date(times.at(-1) as number).toISOString() : "";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Equity & drawdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={host}
          className="h-[260px] rounded bg-[var(--muted)]"
          data-points={times.length}
          data-first={first}
          data-last={last}
        />
        {!times.length ? <p className="mt-2 text-sm">No chart data.</p> : null}
      </CardContent>
    </Card>
  );
}

function PriceChart({ data }: { data: ChartPayload }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current || data.t.length === 0) return;
    let disposed = false;
    let dispose: (() => void) | null = null;
    void import("lightweight-charts").then(
      ({ CandlestickSeries, createChart, createSeriesMarkers }) => {
        if (!host.current || disposed) return;
        const chart = createChart(host.current, {
          autoSize: true,
          height: 260,
          layout: { textColor: "#a1a1aa", background: { color: "transparent" } },
        });
        const series = chart.addSeries(CandlestickSeries);
        series.setData(
          data.t.map((time, index) => ({
            time: (time / 1000) as never,
            open: Number(data.open[index]),
            high: Number(data.high[index]),
            low: Number(data.low[index]),
            close: Number(data.close[index]),
          })),
        );
        createSeriesMarkers(
          series,
          data.markers
            .filter((marker) => data.t.includes(marker.t))
            .map((marker) => ({
              time: (marker.t / 1000) as never,
              position: marker.side === "buy" ? "belowBar" : "aboveBar",
              color: marker.side === "buy" ? "#22c55e" : "#ef4444",
              shape: marker.side === "buy" ? "arrowUp" : "arrowDown",
              text: marker.side === "buy" ? "B" : "S",
            })),
        );
        chart.timeScale().fitContent();
        dispose = () => chart.remove();
      },
    );
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [data]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={host} className="h-[260px] rounded bg-[var(--muted)]" />
      </CardContent>
    </Card>
  );
}

function PaginatedTables({ job }: { job: BacktestJob }) {
  const trades = useBacktestTrades(job.id, true);
  const orders = useBacktestOrders(job.id, true);
  return (
    <Tabs defaultValue="trades" className="space-y-4">
      <TabsList className="flex gap-2" aria-label="Backtest activity">
        <TabsTrigger
          value="trades"
          className="rounded px-3 py-2 data-[state=active]:bg-[var(--muted)]"
        >
          Trades
        </TabsTrigger>
        <TabsTrigger
          value="orders"
          className="rounded px-3 py-2 data-[state=active]:bg-[var(--muted)]"
        >
          Orders
        </TabsTrigger>
      </TabsList>
      <TabsContent value="trades">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Side</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Exit</TableHead>
              <TableHead>Net PnL</TableHead>
              <TableHead>Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.data?.results.slice(0, 50).map((trade, index) => (
              <TableRow key={index}>
                <TableCell>{trade.side}</TableCell>
                <TableCell>{localTime(trade.entry_time)}</TableCell>
                <TableCell>{localTime(trade.exit_time)}</TableCell>
                <TableCell>{new Decimal(trade.pnl_net).toFixed(2)}</TableCell>
                <TableCell>{new Decimal(trade.size).toSignificantDigits(8).toString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
      <TabsContent value="orders">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Side</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Fill price</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Filled at</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.data?.results.slice(0, 50).map((order, index) => (
              <TableRow key={index}>
                <TableCell>{order.side}</TableCell>
                <TableCell>{order.type}</TableCell>
                <TableCell>{new Decimal(order.size).toSignificantDigits(8).toString()}</TableCell>
                <TableCell>{order.price}</TableCell>
                <TableCell>{order.fill_price ?? "—"}</TableCell>
                <TableCell>{localTime(order.created)}</TableCell>
                <TableCell>{localTime(order.filled_at)}</TableCell>
                <TableCell>{order.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
}

export function BacktestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const job = useBacktest(Number(id), { poll: true });
  const cancel = useCancelBacktest(Number(id));
  const equity = useBacktestEquity(Number(id), job.data?.status === "done");
  const chart = useBacktestChart(Number(id), job.data?.status === "done");
  if (job.isLoading) return <Skeleton className="h-96" />;
  if (job.error || !job.data) return <p role="alert">{errorMessage(job.error)}</p>;
  const current = job.data;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {current.strategy}@{current.version}
          </h1>
          <p>
            {current.instrument.symbol} · {current.timeframe} · {current.start.slice(0, 10)} –{" "}
            {current.end.slice(0, 10)}
          </p>
        </div>
        <Status job={current} />
        {["queued", "running"].includes(current.status) ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Cancel</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Cancel backtest?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              <div className="mt-4 flex gap-2">
                <AlertDialogCancel>Keep running</AlertDialogCancel>
                <AlertDialogAction onClick={() => void cancel.mutateAsync()}>
                  Cancel backtest
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </header>
      {current.status === "failed" ? (
        <p role="alert">{current.error || "Backtest failed."}</p>
      ) : null}
      <Assumptions job={current} />
      <Metrics job={current} />
      {current.status === "done" && current.metrics ? (
        <>
          <EquityChart data={equity.data} />
          {chart.data?.close && chart.data.t ? (
            <PriceChart data={chart.data} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Price chart</CardTitle>
              </CardHeader>
              <CardContent>No chart data.</CardContent>
            </Card>
          )}
          <PaginatedTables job={current} />
          <footer className="flex flex-wrap gap-2 text-xs">
            <span>
              <span className="font-sans">Dataset SHA-256: </span>
              <code>{current.dataset_sha256 ?? "—"}</code>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(current.dataset_sha256 ?? "")}
            >
              <Copy /> Copy
            </Button>
            <span>
              <span className="font-sans">Engine revision: </span>
              <code>{current.engine_revision ?? "—"}</code>
            </span>
          </footer>
          <Button asChild>
            <Link href={`/systems/new?from_backtest=${current.id}`}>
              Create system from this backtest
            </Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}
