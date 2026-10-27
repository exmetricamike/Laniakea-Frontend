"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import Decimal from "decimal.js-light";
import { AlertTriangle } from "lucide-react";
import { EquityChart, PriceChart, orderLines } from "@/components/charts";
import { SystemOrderActions, OrderRowActions } from "@/components/controls/order-dialogs";
import { SystemActions } from "@/components/controls/system-actions";
import { ModeBadge } from "@/components/mode-badge";
import { type FormWithParams, SchemaForm } from "@/components/params/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import {
  useAccount,
  useBacktest,
  useStrategyVersion,
  useSystem,
  useSystemChart,
  useSystemCommands,
  useSystemEquity,
  useSystemEvents,
  useSystemFills,
  useSystemOrders,
  useSystemPerformance,
  useSystemPosition,
  useSystemTrades,
} from "@/lib/api/queries";
import { useUpdateSystem } from "@/lib/api/mutations";
import type { BacktestMetric, SystemOrder, TradingSystem } from "@/lib/api/types";

type Tab =
  "open" | "history" | "trades" | "fills" | "performance" | "events" | "commands" | "settings";

function money(value: string | null | undefined): string {
  return value === null || value === undefined ? "—" : new Decimal(value).toFixed(2);
}

function size(value: string | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : new Decimal(value).toSignificantDigits(8).toString();
}

function ratio(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Decimal(value).mul(100).toFixed(2)}%`;
}

function localTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function heartbeatAge(value: string | null | undefined, now: number): string {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "—";
  const seconds = Math.max(0, Math.floor((now - time) / 1_000));
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

function periodMs(timeframe: string): number | undefined {
  return {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
  }[timeframe];
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Unable to load system data.";
}

function AccountLabel({ id }: { id: number }) {
  const account = useAccount(id);
  if (account.isLoading) return <>Loading account…</>;
  return <>{account.data?.label ?? "—"}</>;
}

function StateBadge({ system }: { system: TradingSystem }) {
  const destructive = system.state === "error" || system.state === "halted";
  return <Badge variant={destructive ? "destructive" : "secondary"}>{system.state}</Badge>;
}

function Header({ system, now }: { system: TradingSystem; now: number }) {
  const frame = periodMs(system.timeframe);
  const lastBar = system.last_bar_time ? new Date(system.last_bar_time).getTime() : NaN;
  const stale = frame !== undefined && Number.isFinite(lastBar) && now - lastBar > frame * 2;
  return (
    <header className="space-y-2">
      <Link className="text-sm underline" href="/systems">
        Back to systems
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{system.name}</h1>
        <ModeBadge mode={system.mode} />
        <StateBadge system={system} />
        {system.manual_intervention_at ? (
          <Badge variant="destructive">Manual intervention</Badge>
        ) : null}
        <SystemActions system={system} />
      </div>
      <div className="flex flex-wrap gap-2">
        <SystemOrderActions system={system} />
      </div>
      {system.state_reason ? (
        <p className="text-sm text-[var(--muted-foreground)]">{system.state_reason}</p>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link className="underline" href={`/strategies/${encodeURIComponent(system.strategy)}`}>
          {system.strategy}@{system.version}
        </Link>
        <span>
          {system.instrument.venue}:{system.instrument.symbol}
        </span>
        <span>Account: {system.account === null ? "—" : <AccountLabel id={system.account} />}</span>
        <span>{system.timeframe}</span>
        <span>Allocation: {money(system.allocation)}</span>
        <span title={system.heartbeat_at ? localTime(system.heartbeat_at) : undefined}>
          Heartbeat: {heartbeatAge(system.heartbeat_at, now)}
        </span>
        <span className={stale ? "text-yellow-400" : ""}>
          {stale ? <AlertTriangle className="mr-1 inline size-4" /> : null}
          Last bar: {localTime(system.last_bar_time)}
        </span>
        {system.manual_intervention_at ? (
          <span>Manual: {localTime(system.manual_intervention_at)}</span>
        ) : null}
      </div>
    </header>
  );
}

function Kpis({
  system,
  metrics,
  period,
}: {
  system: TradingSystem;
  metrics: BacktestMetric | null | undefined;
  period: { today: string; "7d": string; "30d": string } | undefined;
}) {
  const items: Array<[string, string]> = [
    ["Equity", money(system.value)],
    ["Net PnL", `${money(system.net_pnl)} (${ratio(system.return)})`],
    ["Today", money(period?.today)],
    ["7D", money(period?.["7d"])],
    ["30D", money(period?.["30d"])],
    ["Realised", money(system.realised_pnl)],
    ["Unrealised", money(system.unrealised_pnl)],
    ["Fees", money(system.fees)],
    ["Max DD", ratio(system.max_drawdown)],
    ["Sharpe", metric(metrics?.sharpe)],
    ["Trades", metric(metrics?.trades, false, true)],
    ["Win rate", metric(metrics?.win_rate, true)],
    ["Profit factor", metric(metrics?.profit_factor)],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {items.map(([label, value]) => (
        <Card key={label}>
          <CardContent className="p-3">
            <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
            <p className="font-medium">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function metric(value: unknown, percent = false, integer = false): string {
  if (typeof value !== "number") return "—";
  if (integer) return String(Math.trunc(value));
  return percent ? ratio(value) : new Decimal(value).toFixed(2);
}

function PositionCard({
  position,
  system,
}: {
  position: ReturnType<typeof useSystemPosition>;
  system: TradingSystem;
}) {
  if (position.isLoading)
    return (
      <Card>
        <CardContent className="p-6">Loading position…</CardContent>
      </Card>
    );
  if (position.error)
    return (
      <Card>
        <CardContent className="p-6" role="alert">
          {errorText(position.error)}
        </CardContent>
      </Card>
    );
  const row = position.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Position</CardTitle>
      </CardHeader>
      <CardContent>
        {!row?.side ? (
          "Flat"
        ) : (
          <div className="grid gap-1 text-sm">
            <span>
              {row.side} {size(row.size)}
            </span>
            <span>Entry: {money(row.avg_price)}</span>
            <span>
              Mark: {money(row.mark_price)} · {localTime(row.marked_at)}
            </span>
            <span>Unrealised: {money(row.unrealised_pnl)}</span>
          </div>
        )}
        {row?.side && system.allowed_actions.includes("close_position") ? (
          <div className="mt-3">
            <SystemOrderActions system={{ ...system, allowed_actions: ["close_position"] }} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActivityTabs({ id, active, running }: { id: number; active: Tab; running: boolean }) {
  const [origin, setOrigin] = useState("");
  const [tradeStatus, setTradeStatus] = useState<"open" | "closed" | "all">("all");
  const [severity, setSeverity] = useState("");
  const [kind, setKind] = useState("");
  const open = useSystemOrders(id, { status: "open" }, { poll: running });
  const history = useSystemOrders(
    id,
    { status: "all", origin: origin || undefined },
    { enabled: active === "history", poll: running && active === "history" },
  );
  const trades = useSystemTrades(
    id,
    { status: tradeStatus },
    { enabled: active === "trades", poll: running && active === "trades" },
  );
  const fills = useSystemFills(
    id,
    {},
    { enabled: active === "fills", poll: running && active === "fills" },
  );
  const events = useSystemEvents(
    id,
    { severity: severity || undefined, kind: kind || undefined },
    { enabled: active === "events", poll: running && active === "events" },
  );
  const commands = useSystemCommands(
    id,
    {},
    { enabled: active === "commands", poll: running && active === "commands" },
  );
  const table = (headers: string[], body: ReactNode) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{body}</TableBody>
      </Table>
    </div>
  );
  const page = <T,>(
    query: ReturnType<typeof useSystemOrders>,
    empty: string,
    render: (row: T, index: number) => ReactNode,
  ) => {
    const rows = query.data?.pages.flatMap((item) => item.results) as T[] | undefined;
    if (query.isLoading)
      return (
        <TableRow>
          <TableCell colSpan={20}>Loading…</TableCell>
        </TableRow>
      );
    if (query.error)
      return (
        <TableRow>
          <TableCell colSpan={20} role="alert">
            {errorText(query.error)}
          </TableCell>
        </TableRow>
      );
    if (!rows?.length)
      return (
        <TableRow>
          <TableCell colSpan={20}>{empty}</TableCell>
        </TableRow>
      );
    return (
      <>
        {rows.map(render)}
        {query.hasNextPage ? (
          <TableRow>
            <TableCell colSpan={20}>
              <button type="button" onClick={() => void query.fetchNextPage()}>
                Load more
              </button>
            </TableCell>
          </TableRow>
        ) : null}
      </>
    );
  };
  return (
    <>
      <TabsContent value="open">
        {table(
          [
            "Created",
            "Tag",
            "Origin",
            "Side",
            "Type",
            "Size",
            "Filled",
            "Price",
            "Stop",
            "Status",
            "Actions",
          ],
          page(open, "No open orders.", (order, index) => (
            <TableRow key={index}>
              <TableCell>
                {localTime((order as never as { created_at: string }).created_at)}
              </TableCell>
              <TableCell>{(order as never as { tag: string | null }).tag ?? "—"}</TableCell>
              <TableCell>{(order as never as { origin: string }).origin}</TableCell>
              <TableCell>{(order as never as { side: string }).side}</TableCell>
              <TableCell>{(order as never as { type: string }).type}</TableCell>
              <TableCell>{size((order as never as { size: string }).size)}</TableCell>
              <TableCell>{size((order as never as { filled_size: string }).filled_size)}</TableCell>
              <TableCell>{money((order as never as { price: string | null }).price)}</TableCell>
              <TableCell>
                {money((order as never as { stop_price: string | null }).stop_price)}
              </TableCell>
              <TableCell>{(order as never as { status: string }).status}</TableCell>
              <TableCell>
                <OrderRowActions systemId={id} order={order as SystemOrder} />
              </TableCell>
            </TableRow>
          )),
        )}
      </TabsContent>
      <TabsContent value="history">
        <select
          aria-label="Order origin"
          value={origin}
          onChange={(event) => setOrigin(event.target.value)}
        >
          <option value="">All origins</option>
          <option value="strategy">strategy</option>
          <option value="manual">manual</option>
        </select>
        {table(
          ["Created", "Tag", "Side", "Type", "Status", "Replaces", "Replaced by", "Reason"],
          page(history, "No order history.", (order, index) => {
            const row = order as never as {
              id: number;
              created_at: string;
              tag: string | null;
              side: string;
              type: string;
              status: string;
              replaces: number | null;
              replaced_by: number | null;
              cancelled_by: string | null;
              reject_reason: string | null;
            };
            return (
              <TableRow id={`order-${row.id}`} key={index}>
                <TableCell>{localTime(row.created_at)}</TableCell>
                <TableCell>{row.tag ?? "—"}</TableCell>
                <TableCell>{row.side}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  {row.replaces ? <a href={`#order-${row.replaces}`}>{row.replaces}</a> : "—"}
                </TableCell>
                <TableCell>
                  {row.replaced_by ? (
                    <a href={`#order-${row.replaced_by}`}>{row.replaced_by}</a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{row.cancelled_by ?? row.reject_reason ?? "—"}</TableCell>
              </TableRow>
            );
          }),
        )}
      </TabsContent>
      <TabsContent value="trades">
        <select
          aria-label="Trade status"
          value={tradeStatus}
          onChange={(event) => setTradeStatus(event.target.value as "open" | "closed" | "all")}
        >
          <option value="all">all</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
        </select>
        {table(
          [
            "Opened",
            "Closed",
            "Side",
            "Size",
            "Entry",
            "Exit",
            "PnL net",
            "Fees",
            "Bars",
            "Origin",
          ],
          page(
            trades as never as ReturnType<typeof useSystemOrders>,
            "No trades.",
            (trade, index) => {
              const row = trade as never as {
                opened_at: string;
                closed_at: string | null;
                side: string;
                max_size: string;
                entry_avg: string;
                exit_avg: string | null;
                pnl_net: string;
                fees: string;
                bars: number;
                origin: string;
              };
              return (
                <TableRow key={index}>
                  <TableCell>{localTime(row.opened_at)}</TableCell>
                  <TableCell>{localTime(row.closed_at)}</TableCell>
                  <TableCell>{row.side}</TableCell>
                  <TableCell>{size(row.max_size)}</TableCell>
                  <TableCell>{money(row.entry_avg)}</TableCell>
                  <TableCell>{money(row.exit_avg)}</TableCell>
                  <TableCell>{money(row.pnl_net)}</TableCell>
                  <TableCell>{money(row.fees)}</TableCell>
                  <TableCell>{row.bars}</TableCell>
                  <TableCell>{row.origin}</TableCell>
                </TableRow>
              );
            },
          ),
        )}
      </TabsContent>
      <TabsContent value="fills">
        {table(
          ["Time", "Side", "Price", "Size", "Fee", "Origin", "Order"],
          page(fills as never as ReturnType<typeof useSystemOrders>, "No fills.", (fill, index) => {
            const row = fill as never as {
              time: string;
              side: string;
              price: string;
              size: string;
              fee: string;
              origin: string;
              order_id: number;
            };
            return (
              <TableRow key={index}>
                <TableCell>{localTime(row.time)}</TableCell>
                <TableCell>{row.side}</TableCell>
                <TableCell>{money(row.price)}</TableCell>
                <TableCell>{size(row.size)}</TableCell>
                <TableCell>{money(row.fee)}</TableCell>
                <TableCell>{row.origin}</TableCell>
                <TableCell>{row.order_id}</TableCell>
              </TableRow>
            );
          }),
        )}
      </TabsContent>
      <TabsContent value="events">
        <div className="flex gap-2">
          <select
            aria-label="Event severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="">All severities</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
          </select>
          <select
            aria-label="Event kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="">All kinds</option>
            {["lifecycle.", "risk.", "data.", "order.", "manual."].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        {table(
          ["Time", "Severity", "Kind", "Message"],
          page(
            events as never as ReturnType<typeof useSystemOrders>,
            "No events.",
            (event, index) => {
              const row = event as never as {
                time: string;
                severity: string;
                kind: string;
                message: string;
              };
              return (
                <TableRow key={index}>
                  <TableCell>{localTime(row.time)}</TableCell>
                  <TableCell>
                    <Badge variant={row.severity === "error" ? "destructive" : "secondary"}>
                      {row.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.kind}</TableCell>
                  <TableCell>{row.message}</TableCell>
                </TableRow>
              );
            },
          ),
        )}
      </TabsContent>
      <TabsContent value="commands">
        {table(
          ["Created", "Kind", "Status", "Reason", "Created by", "Finished"],
          page(
            commands as never as ReturnType<typeof useSystemOrders>,
            "No commands.",
            (command, index) => {
              const row = command as never as {
                created_at: string;
                kind: string;
                status: string;
                reason: string | null;
                created_by: string | null;
                finished_at: string | null;
              };
              return (
                <TableRow key={index}>
                  <TableCell>{localTime(row.created_at)}</TableCell>
                  <TableCell>{row.kind}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.reason ?? "—"}</TableCell>
                  <TableCell>{row.created_by ?? "—"}</TableCell>
                  <TableCell>{localTime(row.finished_at)}</TableCell>
                </TableRow>
              );
            },
          ),
        )}
      </TabsContent>
    </>
  );
}

function EvidenceCard({ id, label }: { id: number; label: string }) {
  const backtest = useBacktest(id);
  if (backtest.isLoading) return <p>Loading {label}…</p>;
  if (!backtest.data) return <p role="alert">Unable to load {label}.</p>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Return: {metric(backtest.data.metrics?.full?.total_return, true)}</p>
        <p>Caveats: {backtest.data.caveats.join(", ") || "—"}</p>
        <p>Split: {backtest.data.in_sample_end ?? "—"}</p>
      </CardContent>
    </Card>
  );
}

function PerformanceTab({
  id,
  active,
  running,
}: {
  id: number;
  active: boolean;
  running: boolean;
}) {
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState<string | undefined>(undefined);
  const performance = useSystemPerformance(id, from, { enabled: active, poll: running && active });
  if (!active) return <TabsContent value="performance" />;
  return (
    <TabsContent value="performance">
      <select
        aria-label="Performance period"
        value={period}
        onChange={(event) => {
          const value = event.target.value;
          setPeriod(value);
          setFrom(
            value === "all"
              ? undefined
              : new Date(Date.now() - Number(value) * 86_400_000).toISOString(),
          );
        }}
      >
        <option value="all">All</option>
        <option value="30">30D</option>
        <option value="7">7D</option>
      </select>
      {performance.isLoading ? <p>Loading…</p> : null}
      {performance.error ? <p role="alert">{errorText(performance.error)}</p> : null}
      {performance.data ? (
        <>
          <Table>
            <TableBody>
              {Object.entries(performance.data.metrics ?? {}).map(([name, value]) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    {typeof value === "number" ? metric(value) : String(value ?? "—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {performance.data.backtest_evidence.length ? (
            performance.data.backtest_evidence.map((item) => (
              <EvidenceCard key={item.backtest_id} id={item.backtest_id} label={item.label} />
            ))
          ) : (
            <p>No published backtest evidence for this version.</p>
          )}
        </>
      ) : null}
    </TabsContent>
  );
}

function SettingsTab({ system, active }: { system: TradingSystem; active: boolean }) {
  const detail = useStrategyVersion(system.strategy, active ? system.version : null);
  const update = useUpdateSystem(system.id);
  const [editing, setEditing] = useState(false);
  const [allocation, setAllocation] = useState(system.allocation);
  const [risk, setRisk] = useState(system.risk);
  const [costModel, setCostModel] = useState(system.cost_model);
  const form = useForm<FormWithParams>({
    defaultValues: { params: system.params as FormWithParams["params"] },
  });
  const resetForm = () => {
    setAllocation(system.allocation);
    setRisk(system.risk);
    setCostModel(system.cost_model);
    form.reset({ params: system.params as FormWithParams["params"] });
  };
  const save = () => {
    const changes = {
      ...(allocation !== system.allocation ? { allocation } : {}),
      ...(JSON.stringify(risk) !== JSON.stringify(system.risk) ? { risk } : {}),
      ...(JSON.stringify(costModel) !== JSON.stringify(system.cost_model)
        ? { cost_model: costModel }
        : {}),
      ...(JSON.stringify(form.getValues().params) !== JSON.stringify(system.params)
        ? { params: form.getValues().params }
        : {}),
    };
    update.mutate(changes, {
      onSuccess: () => {
        resetForm();
        setEditing(false);
      },
    });
  };
  const parameterErrors = Object.fromEntries(
    (Array.isArray(update.error?.fields?.params) ? update.error.fields.params : []).flatMap(
      (item) => {
        if (typeof item !== "string") return [];
        const [path, text] = item.split(": ", 2);
        return path && text && path !== "$" ? [[path.split("/")[0], text] as const] : [];
      },
    ),
  );
  return (
    <TabsContent value="settings">
      {active && detail.isLoading ? <p>Loading…</p> : null}
      {active && detail.error ? <p role="alert">{errorText(detail.error)}</p> : null}
      {active ? (
        <>
          {system.allowed_actions.includes("edit") ? (
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setEditing(true);
              }}
            >
              Edit
            </Button>
          ) : null}
          <SchemaForm
            schema={detail.data?.params_schema}
            defaults={system.params}
            form={form}
            serverErrors={parameterErrors}
            disabled={!editing}
          />
          {editing ? (
            <div className="grid gap-3">
              <SettingsField label="Allocation" value={allocation} onChange={setAllocation} />
              <SettingsField
                label="Max order notional"
                value={risk.max_order_notional ?? ""}
                onChange={(value) => {
                  const { max_order_notional: ignored, ...rest } = risk;
                  setRisk(value ? { ...rest, max_order_notional: value } : rest);
                }}
              />
              <SettingsField
                label="Max position notional"
                value={risk.max_position_notional ?? ""}
                onChange={(value) => {
                  const { max_position_notional: ignored, ...rest } = risk;
                  setRisk(value ? { ...rest, max_position_notional: value } : rest);
                }}
              />
              <SettingsField
                label="Max leverage"
                value={risk.max_leverage ?? ""}
                onChange={(value) => {
                  const { max_leverage: ignored, ...rest } = risk;
                  setRisk(value ? { ...rest, max_leverage: value } : rest);
                }}
              />
              <SettingsField
                label="Max orders per minute"
                value={risk.max_orders_per_minute?.toString() ?? ""}
                onChange={(value) => {
                  const { max_orders_per_minute: ignored, ...rest } = risk;
                  setRisk(value ? { ...rest, max_orders_per_minute: Number(value) } : rest);
                }}
              />
              <SettingsField
                label="Fee rate"
                value={costModel.fee_rate.toString()}
                onChange={(value) => setCostModel({ ...costModel, fee_rate: Number(value) })}
              />
              <SettingsField
                label="Slippage bps"
                value={costModel.slippage_bps.toString()}
                onChange={(value) => setCostModel({ ...costModel, slippage_bps: Number(value) })}
              />
              <SettingsField
                label="Leverage"
                value={costModel.leverage.toString()}
                onChange={(value) => setCostModel({ ...costModel, leverage: Number(value) })}
              />
              <Button disabled={update.isPending} onClick={save}>
                Save settings
              </Button>
              {update.error ? (
                <p role="alert">
                  {update.error.status === 409
                    ? "System is no longer stopped"
                    : errorText(update.error)}
                </p>
              ) : null}
            </div>
          ) : null}
          <dl className="grid gap-2 text-sm">
            <div>
              <dt>Risk limits</dt>
              <dd>{JSON.stringify(system.risk)}</dd>
            </div>
            <div>
              <dt>Cost model</dt>
              <dd>{JSON.stringify(system.cost_model)}</dd>
            </div>
            <div>
              <dt>Allocation</dt>
              <dd>{money(system.allocation)}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{system.mode}</dd>
            </div>
            <div>
              <dt>Stop policy</dt>
              <dd>{system.stop_policy}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </TabsContent>
  );
}

function SettingsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `settings-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label htmlFor={id} className="grid gap-1">
      {label}
      <input
        id={id}
        className="rounded-md border bg-transparent px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function SystemDetailPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = Number(rawId);
  const system = useSystem(id, { poll: true });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(clock);
  }, []);
  const [showRealised, setShowRealised] = useState(false);
  const [showUnrealised, setShowUnrealised] = useState(false);
  const running = ["running", "starting", "stopping"].includes(system.data?.state ?? "");
  const [active, setActive] = useState<Tab>("open");
  const performance = useSystemPerformance(id, undefined, {
    enabled: Boolean(system.data),
    poll: running,
  });
  const position = useSystemPosition(id, { enabled: Boolean(system.data), poll: running });
  const chart = useSystemChart(id, { enabled: Boolean(system.data), poll: running });
  const equity = useSystemEquity(id, { enabled: Boolean(system.data), poll: running });
  const openOrders = useSystemOrders(
    id,
    { status: "open" },
    { enabled: Boolean(system.data), poll: running },
  );
  const rows = useMemo(
    () => openOrders.data?.pages.flatMap((page) => page.results) ?? [],
    [openOrders.data],
  );
  const priceLines = useMemo(() => orderLines(rows), [rows]);
  if (system.isLoading) return <p>Loading system…</p>;
  if (system.error instanceof ApiError && system.error.status === 404)
    return (
      <div>
        <h1 className="text-2xl font-semibold">System not found</h1>
        <Link className="underline" href="/systems">
          Back to systems
        </Link>
      </div>
    );
  if (system.error || !system.data) return <p role="alert">{errorText(system.error)}</p>;
  return (
    <div className="space-y-6">
      <Header system={system.data} now={now} />
      {performance.isLoading ? (
        <p>Loading KPIs…</p>
      ) : (
        <Kpis
          system={system.data}
          metrics={performance.data?.metrics}
          period={performance.data?.period_pnl}
        />
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        {chart.data ? (
          <PriceChart
            data={chart.data}
            orderLines={priceLines}
            timeframeMs={periodMs(system.data.timeframe)}
          />
        ) : (
          <Card>
            <CardContent className="p-6">Loading chart…</CardContent>
          </Card>
        )}
        <EquityChart
          data={equity.data}
          showRealised={showRealised}
          showUnrealised={showUnrealised}
          controls={
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1">
                <Switch checked={showRealised} onCheckedChange={setShowRealised} />
                Realised
              </label>
              <label className="flex items-center gap-1">
                <Switch checked={showUnrealised} onCheckedChange={setShowUnrealised} />
                Unrealised
              </label>
            </div>
          }
        />
      </div>
      <PositionCard position={position} system={system.data} />
      <Tabs value={active} onValueChange={(value) => setActive(value as Tab)} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1" aria-label="System detail tabs">
          {[
            ["open", "Open orders"],
            ["history", "Order history"],
            ["trades", "Trades"],
            ["fills", "Fills"],
            ["performance", "Performance"],
            ["events", "Events"],
            ["commands", "Commands"],
            ["settings", "Settings"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ActivityTabs id={id} active={active} running={running} />
        <PerformanceTab id={id} active={active === "performance"} running={running} />
        <SettingsTab system={system.data} active={active === "settings"} />
      </Tabs>
    </div>
  );
}
