"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Decimal from "decimal.js-light";
import { AlertTriangle } from "lucide-react";
import { useMode } from "@/components/app-shell";
import { EquityChart } from "@/components/charts";
import { ModeBadge } from "@/components/mode-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  usePortfolioEquity,
  usePortfolioOrders,
  usePortfolioPositions,
  usePortfolioSummary,
  usePortfolioTradesInfinite,
  useSystemsInfinite,
} from "@/lib/api/queries";
import type {
  JsonValue,
  PortfolioOrder,
  PortfolioPeriod,
  PortfolioTrade,
  SystemRow,
} from "@/lib/api/types";
import { orderedBuckets, periodFrom } from "@/lib/portfolio";

const PERIODS: Array<{ value: PortfolioPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All" },
];

function money(value: string | null | undefined): string {
  return value === null || value === undefined ? "—" : new Decimal(value).toFixed(2);
}

function size(value: string | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : new Decimal(value).toSignificantDigits(8).toString();
}

function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${new Decimal(value).mul(100).toFixed(2)}%`;
}

function localTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function stateBadge(state: SystemRow["state"]) {
  return (
    <Badge variant={state === "error" || state === "halted" ? "destructive" : "secondary"}>
      {state}
    </Badge>
  );
}

function tags(value: JsonValue[]): string {
  return (
    value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ") || "—"
  );
}

function PortfolioSystemsTable({ rows }: { rows: SystemRow[] }) {
  const [state, setState] = useState("");
  const [venue, setVenue] = useState("");
  const [currency, setCurrency] = useState("");
  const filtered = useMemo(
    () =>
      rows
        .filter((row) => !state || row.state === state)
        .filter((row) => !venue || row.instrument.venue === venue)
        .filter((row) => !currency || row.settle === currency)
        .sort((left, right) => {
          const leftPriority = left.state === "halted" || left.state === "error" ? 0 : 1;
          const rightPriority = right.state === "halted" || right.state === "error" ? 0 : 1;
          return leftPriority - rightPriority;
        }),
    [currency, rows, state, venue],
  );
  const venues = [...new Set(rows.map((row) => row.instrument.venue))];
  const currencies = [...new Set(rows.map((row) => row.settle))];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Systems</CardTitle>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Portfolio state filter"
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="">All states</option>
            {["draft", "stopped", "starting", "running", "stopping", "error", "halted"].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
          <select
            aria-label="Portfolio venue filter"
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
          >
            <option value="">All venues</option>
            {venues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            aria-label="Portfolio currency filter"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option value="">All currencies</option>
            {currencies.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="overflow-auto">
        <Table className="min-w-[1120px] whitespace-nowrap text-xs">
          <TableHeader>
            <TableRow>
              {[
                "Name",
                "Mode",
                "State",
                "Instrument",
                "Settle",
                "Allocation",
                "Value",
                "Net PnL",
                "Return",
                "Period PnL",
                "Position",
                "Open orders",
                "Actions",
              ].map((heading) => (
                <TableHead key={heading}>{heading}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((system) => (
              <TableRow key={system.id} data-system-state={system.state}>
                <TableCell>
                  <Link className="underline" href={`/systems/${system.id}`}>
                    {system.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <ModeBadge mode={system.mode} />
                </TableCell>
                <TableCell>{stateBadge(system.state)}</TableCell>
                <TableCell>
                  {system.instrument.venue}:{system.instrument.symbol}
                </TableCell>
                <TableCell>{system.settle}</TableCell>
                <TableCell>{money(system.allocation)}</TableCell>
                <TableCell>{money(system.value)}</TableCell>
                <TableCell>{money(system.net_pnl)}</TableCell>
                <TableCell>{percent(system.return)}</TableCell>
                <TableCell>{money(system.period_pnl)}</TableCell>
                <TableCell>
                  {system.position ? `${system.position.side} ${size(system.position.size)}` : "—"}
                </TableCell>
                <TableCell>{system.open_orders}</TableCell>
                <TableCell>
                  <Link className="underline" href={`/systems/${system.id}`}>
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BucketCards({
  buckets,
  rows,
}: {
  buckets: ReturnType<typeof orderedBuckets>;
  rows: SystemRow[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {buckets.map((bucket) => {
        const running = rows.filter(
          (row) => bucket.members.includes(row.settle) && row.state === "running",
        ).length;
        return (
          <Card key={bucket.currency} data-bucket={bucket.currency}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {bucket.currency}
                {bucket.currency === "USD*" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="cursor-help text-xs text-[var(--muted-foreground)]"
                      >
                        ⓘ
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      stablecoins counted at 1:1: {bucket.members.join(", ")}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-3">
              <Kpi label="Equity" value={money(bucket.value)} />
              <Kpi label="Net PnL" value={`${money(bucket.net_pnl)} · ${percent(bucket.return)}`} />
              <Kpi label="Period PnL" value={money(bucket.period_pnl)} />
              <Kpi label="Realised" value={money(bucket.realised_pnl)} />
              <Kpi label="Unrealised" value={money(bucket.unrealised_pnl)} />
              <Kpi label="Fees" value={money(bucket.fees)} />
              <Kpi label="Max drawdown" value={percent(bucket.max_drawdown)} />
              <Kpi label="Systems running / total" value={`${running} / ${bucket.systems}`} />
              <Kpi label="Open positions" value={String(bucket.open_positions)} />
              <Kpi label="Open orders" value={String(bucket.open_orders)} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted-foreground)]">{label}</dt>
      <dd data-kpi={label} className="font-medium">
        {value}
      </dd>
    </div>
  );
}

export function PortfolioPage() {
  const mode = useMode((state) => state.mode);
  const setMode = useMode((state) => state.setMode);
  const [period, setPeriod] = useState<PortfolioPeriod>("today");
  const [includeStopped, setIncludeStopped] = useState(false);
  const [tradeFilters, setTradeFilters] = useState({
    system: "",
    side: "",
    origin: "",
    status: "all" as const,
  });
  const [tradeRefresh, setTradeRefresh] = useState(0);
  const allSystems = useSystemsInfinite({});
  const modeSystems = useSystemsInfinite({ mode });
  const summary = usePortfolioSummary(mode, period, includeStopped);
  const from = useMemo(() => periodFrom(period, new Date()), [period]);
  const equity = usePortfolioEquity(mode, from);
  const orders = usePortfolioOrders(mode);
  const positions = usePortfolioPositions(mode);
  const trades = usePortfolioTradesInfinite({ mode, ...tradeFilters }, tradeRefresh);
  const systems = summary.data?.systems ?? [];
  const buckets = orderedBuckets(summary.data?.buckets ?? []);
  const tradeRows = [...(trades.data?.pages.flatMap((page) => page.results) ?? [])].sort(
    (left, right) => Number(right.status === "open") - Number(left.status === "open"),
  );
  const initialLoading = allSystems.isLoading || modeSystems.isLoading || summary.isLoading;
  const noSystems = allSystems.data?.pages[0]?.results.length === 0;
  const noModeSystems = modeSystems.data?.pages[0]?.results.length === 0;
  const error =
    allSystems.error ??
    modeSystems.error ??
    summary.error ??
    equity.error ??
    orders.error ??
    positions.error;

  function updateTradeFilter(name: "system" | "side" | "origin" | "status", value: string) {
    setTradeFilters((current) => ({ ...current, [name]: value }) as typeof current);
    setTradeRefresh((current) => current + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <ModeBadge mode={mode} />
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Updated {localTime(summary.data?.as_of)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded border p-0.5" role="group" aria-label="Portfolio period">
          {PERIODS.map((item) => (
            <Button
              key={item.value}
              variant={period === item.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={includeStopped}
            onCheckedChange={setIncludeStopped}
            aria-label="Include stopped with PnL in period"
          />
          Include stopped with PnL in period
        </label>
      </div>
      {initialLoading ? <p aria-label="Loading portfolio">Loading…</p> : null}
      {error ? <p role="alert">Unable to load portfolio.</p> : null}
      {noSystems ? (
        <Card>
          <CardContent className="p-6">
            <p>No systems yet.</p>
            <Button asChild className="mt-3">
              <Link href="/systems/new">Create a system</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {!initialLoading && !noSystems && noModeSystems ? (
        <Card>
          <CardContent className="p-6">
            <p>{mode === "live" ? "No live systems — switch to PAPER" : "No paper systems"}</p>
            {mode === "live" ? (
              <Button className="mt-3" onClick={() => setMode("paper")}>
                Switch to PAPER
              </Button>
            ) : (
              <Button asChild className="mt-3">
                <Link href="/systems/new">Create a system</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
      {!initialLoading && !noSystems && !noModeSystems && systems.length === 0 ? (
        <Card>
          <CardContent className="p-6">No portfolio rows for these options.</CardContent>
        </Card>
      ) : null}
      {!initialLoading && !noSystems && !noModeSystems && systems.length > 0 ? (
        <>
          {summary.data?.alerts.length ? (
            <div role="alert" className="space-y-2">
              {summary.data.alerts.map((alert) => (
                <Link
                  key={`${alert.system}-${alert.kind}`}
                  className="flex items-center gap-2 rounded border border-red-500/40 p-3 text-sm"
                  href={`/systems/${alert.system}`}
                >
                  <AlertTriangle className="size-4 text-red-400" />
                  {systems.find((row) => row.id === alert.system)?.name ??
                    `System ${alert.system}`}{" "}
                  - {alert.kind}: {alert.message}
                </Link>
              ))}
            </div>
          ) : null}
          <BucketCards buckets={buckets} rows={systems} />
          <div className="grid gap-4 xl:grid-cols-2">
            {buckets.map((bucket) => (
              <EquityChart
                key={bucket.currency}
                data={equity.data?.buckets.find((item) => item.currency === bucket.currency)}
                controls={<span className="text-sm">{bucket.currency}</span>}
              />
            ))}
          </div>
          <PortfolioSystemsTable rows={systems} />
          <Card>
            <CardHeader>
              <CardTitle>Trades</CardTitle>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Trade system filter"
                  value={tradeFilters.system}
                  onChange={(event) => updateTradeFilter("system", event.target.value)}
                >
                  <option value="">All systems</option>
                  {systems.map((system) => (
                    <option key={system.id} value={String(system.id)}>
                      {system.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Trade side filter"
                  value={tradeFilters.side}
                  onChange={(event) => updateTradeFilter("side", event.target.value)}
                >
                  <option value="">All sides</option>
                  <option value="long">long</option>
                  <option value="short">short</option>
                </select>
                <select
                  aria-label="Trade origin filter"
                  value={tradeFilters.origin}
                  onChange={(event) => updateTradeFilter("origin", event.target.value)}
                >
                  <option value="">All origins</option>
                  <option value="strategy">strategy</option>
                  <option value="manual">manual</option>
                </select>
                <select
                  aria-label="Trade status filter"
                  value={tradeFilters.status}
                  onChange={(event) => updateTradeFilter("status", event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTradeRefresh((current) => current + 1)}
                >
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-auto">
              <TradeTable rows={tradeRows} />
              {trades.hasNextPage ? (
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={trades.isFetchingNextPage}
                  onClick={() => void trades.fetchNextPage()}
                >
                  Load more
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <OrdersPanel rows={orders.data?.results ?? []} />
        </>
      ) : null}
    </div>
  );
}

function TradeTable({ rows }: { rows: PortfolioTrade[] }) {
  return (
    <Table className="min-w-[1350px] whitespace-nowrap text-xs">
      <TableHeader>
        <TableRow>
          {[
            "Opened",
            "Closed",
            "System",
            "Instrument",
            "Side",
            "Size",
            "Entry",
            "Exit",
            "PnL net",
            "Return",
            "Fees",
            "Bars",
            "Origin",
            "Tags",
          ].map((heading) => (
            <TableHead key={heading}>{heading}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((trade) => (
          <TableRow key={trade.id}>
            <TableCell>{localTime(trade.opened_at)}</TableCell>
            <TableCell>{localTime(trade.closed_at)}</TableCell>
            <TableCell>
              <Link className="underline" href={`/systems/${trade.system.id}`}>
                {trade.system.name}
              </Link>
            </TableCell>
            <TableCell>{trade.instrument.symbol}</TableCell>
            <TableCell>{trade.side}</TableCell>
            <TableCell>{size(trade.max_size)}</TableCell>
            <TableCell>{money(trade.entry_avg)}</TableCell>
            <TableCell>{money(trade.exit_avg)}</TableCell>
            <TableCell>{money(trade.pnl_net)}</TableCell>
            <TableCell>{percent(trade.return)}</TableCell>
            <TableCell>{money(trade.fees)}</TableCell>
            <TableCell>{trade.bars}</TableCell>
            <TableCell>{trade.origin}</TableCell>
            <TableCell>{tags(trade.tags)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrdersPanel({ rows }: { rows: PortfolioOrder[] }) {
  const grouped = rows.reduce<Record<number, typeof rows>>((result, order) => {
    result[order.system.id] = [...(result[order.system.id] ?? []), order];
    return result;
  }, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open orders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.values(grouped).length ? (
          Object.values(grouped).map((orders) => (
            <div key={orders[0].system.id}>
              <Link className="font-medium underline" href={`/systems/${orders[0].system.id}`}>
                {orders[0].system.name}
              </Link>
              {orders.map((order) => (
                <p key={order.id} className="text-sm">
                  {order.side} {size(order.size)} {order.type} @{" "}
                  {money(order.price ?? order.stop_price)} · {localTime(order.created_at)}
                </p>
              ))}
            </div>
          ))
        ) : (
          <p>No open orders.</p>
        )}
      </CardContent>
    </Card>
  );
}
