"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import Decimal from "decimal.js-light";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { type FormWithParams, SchemaForm } from "@/components/params/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModeBadge } from "@/components/mode-badge";
import { SystemActions } from "@/components/controls/system-actions";
import { ApiError } from "@/lib/api/client";
import { useCreateSystem } from "@/lib/api/mutations";
import {
  useAccounts,
  useInstruments,
  useStrategies,
  useStrategyVersions,
  useStrategyVersion,
  useSystems,
  useSystemsInfinite,
  useVenues,
} from "@/lib/api/queries";
import type { JsonValue, SystemCreate, SystemRisk, TradingSystem } from "@/lib/api/types";

const STEP_NAMES = ["Strategy", "Version", "Parameters", "Instrument", "Mode", "Capital", "Review"];
export { START_BLOCKER_LABELS } from "@/lib/start-blockers";

export type WizardValues = {
  name: string;
  strategy: string;
  version: string;
  params: Record<string, string | number | boolean | null>;
  venue: string;
  kind: string;
  instrument: string;
  timeframe: string;
  mode: "paper" | "live";
  account: string;
  allocation: string;
  max_order_notional: string;
  max_position_notional: string;
  max_leverage: string;
  max_orders_per_minute: string;
  fee_rate: string;
  slippage_bps: string;
};

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Unable to complete the request.";
}

function stateBadge(state: TradingSystem["state"]) {
  return (
    <Badge variant={state === "error" || state === "halted" ? "destructive" : "secondary"}>
      {state}
    </Badge>
  );
}

function number(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeframeMs(timeframe: string): number | null {
  const values: Record<string, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
  };
  return values[timeframe] ?? null;
}

function stale(system: TradingSystem): boolean {
  const period = timeframeMs(system.timeframe);
  const last = system.last_bar_time ? new Date(system.last_bar_time).getTime() : NaN;
  return period !== null && Number.isFinite(last) && Date.now() - last > period * 2;
}

function money(value: string | null | undefined): string {
  return value === null || value === undefined ? "—" : new Decimal(value).toFixed(2);
}

function size(value: string | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : new Decimal(value).toSignificantDigits(8).toString();
}

function percent(value: number): string {
  return `${new Decimal(value).mul(100).toFixed(2)}%`;
}

export function SystemsPage() {
  const [filters, setFilters] = useState({ state: "", mode: "", strategy: "" });
  const systems = useSystemsInfinite(filters);
  const strategies = useStrategies();
  const rows = systems.data?.pages.flatMap((page) => page.results) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Systems</h1>
        <Button asChild>
          <Link href="/systems/new">New system</Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="State filter"
          value={filters.state}
          onChange={(event) => setFilters({ ...filters, state: event.target.value })}
        >
          <option value="">All states</option>
          {["draft", "stopped", "starting", "running", "stopping", "error", "halted"].map(
            (state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ),
          )}
        </select>
        <select
          aria-label="Mode filter"
          value={filters.mode}
          onChange={(event) => setFilters({ ...filters, mode: event.target.value })}
        >
          <option value="">All modes</option>
          <option value="paper">paper</option>
          <option value="live">live</option>
        </select>
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
      </div>
      {systems.isLoading ? <Skeleton className="h-64" /> : null}
      {systems.error ? <p role="alert">{message(systems.error)}</p> : null}
      {!systems.isLoading && rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">No systems yet.</CardContent>
        </Card>
      ) : null}
      {rows.length ? <SystemsTable rows={rows} /> : null}
      {systems.hasNextPage ? (
        <Button
          variant="outline"
          disabled={systems.isFetchingNextPage}
          onClick={() => void systems.fetchNextPage()}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

function SystemsTable({ rows }: { rows: TradingSystem[] }) {
  return (
    <Table className="min-w-[1240px] whitespace-nowrap text-xs [&_td]:px-1.5 [&_th]:h-8 [&_th]:px-1.5">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Strategy</TableHead>
          <TableHead>Instrument</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Mark</TableHead>
          <TableHead>Unrealised</TableHead>
          <TableHead>Period PnL</TableHead>
          <TableHead>Net PnL</TableHead>
          <TableHead>Return</TableHead>
          <TableHead>Max DD</TableHead>
          <TableHead>Trades</TableHead>
          <TableHead>Open orders</TableHead>
          <TableHead>Last bar</TableHead>
          <TableHead>Manual</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((system) => (
          <TableRow key={system.id}>
            <TableCell className="max-w-40 truncate p-1.5" title={system.name}>
              <Link
                className="block truncate underline"
                href={`/systems/${system.id}`}
                title={system.name}
              >
                {system.name}
              </Link>
            </TableCell>
            <TableCell>
              <ModeBadge mode={system.mode} />
            </TableCell>
            <TableCell>{stateBadge(system.state)}</TableCell>
            <TableCell>
              {system.strategy}@{system.version}
            </TableCell>
            <TableCell>
              {system.instrument.venue}:{system.instrument.symbol}
            </TableCell>
            <TableCell>
              {system.position
                ? `${system.position.side} ${size(system.position.size)} @ ${money(system.position.avg_price)}`
                : "—"}
            </TableCell>
            <TableCell>{money(system.position?.mark_price)}</TableCell>
            <TableCell>{money(system.unrealised_pnl)}</TableCell>
            <TableCell>{money(system.period_pnl)}</TableCell>
            <TableCell>{money(system.net_pnl)}</TableCell>
            <TableCell>{percent(system.return)}</TableCell>
            <TableCell>{percent(system.max_drawdown)}</TableCell>
            <TableCell>{system.trades}</TableCell>
            <TableCell>{system.open_orders}</TableCell>
            <TableCell>
              {stale(system) ? (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="size-4" />
                  {system.last_bar_time ?? "—"}
                </span>
              ) : (
                (system.last_bar_time ?? "—")
              )}
            </TableCell>
            <TableCell>
              {system.manual_intervention ? (
                <CircleAlert aria-label="Manual intervention" className="size-4" />
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <Link className="underline" href={`/systems/${system.id}`}>
                Open
              </Link>
              <SystemActions system={system} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function firstIncomplete(values: WizardValues, chosen: boolean): number {
  if (!values.strategy) return 1;
  if (!values.version) return 2;
  if (!chosen) return 3;
  if (!values.instrument || !values.timeframe) return 4;
  if (values.mode === "live" && !values.account) return 5;
  if (!values.allocation) return 6;
  return 7;
}

export function errorStep(field: string): number {
  if (field === "params") return 3;
  if (["instrument", "timeframe"].includes(field)) return 4;
  if (["mode", "account"].includes(field)) return 5;
  if (["allocation", "risk", "cost_model"].includes(field)) return 6;
  return 7;
}

function paramsErrors(error: ApiError): { list: string[]; fields: Record<string, string> } {
  const values = error.fields?.params;
  const list = Array.isArray(values)
    ? values.filter((item): item is string => typeof item === "string")
    : [];
  const fields = Object.fromEntries(
    list.flatMap((item) => {
      const [path, text] = item.split(": ", 2);
      return path && text && path !== "$" ? [[path.split("/")[0], text]] : [];
    }),
  );
  return { list, fields };
}

export function NewSystemPage() {
  const router = useRouter();
  const search = useSearchParams();
  const form = useForm<WizardValues>({
    defaultValues: {
      name: "",
      strategy: "",
      version: "",
      params: {},
      venue: "binance",
      kind: "spot",
      instrument: "",
      timeframe: "",
      mode: "paper",
      account: "",
      allocation: "10000",
      max_order_notional: "",
      max_position_notional: "",
      max_leverage: "",
      max_orders_per_minute: "",
      fee_rate: "0.001",
      slippage_bps: "0",
    },
  });
  const values = useWatch({ control: form.control }) as WizardValues;
  const strategies = useStrategies();
  const versions = useStrategyVersions(values.strategy);
  const detail = useStrategyVersion(values.strategy, values.version || null);
  const venues = useVenues();
  const [instrumentSearch, setInstrumentSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const instruments = useInstruments({
    venue: values.venue,
    kind: values.kind,
    search: debouncedSearch,
    page_size: 100,
  });
  const accounts = useAccounts();
  const existing = useSystems({ mode: "live", account: number(values.account) ?? undefined });
  const create = useCreateSystem();
  const [serverParams, setServerParams] = useState<string[]>([]);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<TradingSystem | null>(null);
  const selected = strategies.data?.results.find((item) => item.key === values.strategy);
  const selectedInstrument = instruments.data?.results.find(
    (item) => item.id === Number(values.instrument),
  );
  const compatibleVenues =
    venues.data?.results.filter(
      (item) =>
        selected?.instrument_kinds.includes(values.kind) && item.kinds.includes(values.kind),
    ) ?? [];
  const accountsForVenue =
    accounts.data?.results.filter(
      (item) => item.status === "verified" && item.venue === values.venue,
    ) ?? [];
  const duplicate =
    existing.data?.results.some((item) => item.instrument.id === selectedInstrument?.id) ?? false;
  const requested = Math.max(1, Math.min(7, Number(search.get("step")) || 1));
  const step = Math.min(requested, firstIncomplete(values, Boolean(selected)));

  useEffect(() => {
    if (selected && !selected.instrument_kinds.includes(values.kind))
      form.setValue("kind", selected.instrument_kinds[0] ?? "spot");
  }, [form, selected, values.kind]);
  useEffect(() => {
    if (detail.data) {
      form.setValue(
        "params",
        (detail.data.default_params ?? {}) as Record<string, string | number | boolean | null>,
      );
    }
  }, [detail.data, form]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(instrumentSearch), 300);
    return () => window.clearTimeout(timer);
  }, [instrumentSearch]);
  useEffect(() => {
    if (requested !== step) router.replace(`/systems/new?step=${step}`);
  }, [requested, router, step]);

  const go = (next: number) => router.push(`/systems/new?step=${next}`);
  const review = async () => {
    const risk: SystemRisk = {};
    if (values.max_order_notional) risk.max_order_notional = values.max_order_notional;
    if (values.max_position_notional) risk.max_position_notional = values.max_position_notional;
    if (values.max_leverage) risk.max_leverage = values.max_leverage;
    if (values.max_orders_per_minute)
      risk.max_orders_per_minute = Number(values.max_orders_per_minute);
    const body: SystemCreate = {
      name: values.name || `${selected?.title ?? "Strategy"} ${values.timeframe}`,
      mode: values.mode,
      strategy: values.strategy,
      version: values.version,
      params: values.params,
      instrument: Number(values.instrument),
      timeframe: values.timeframe,
      ...(values.mode === "live" ? { account: Number(values.account) } : {}),
      allocation: values.allocation,
      risk,
      cost_model: {
        instrument_kind: selectedInstrument?.kind === "linear_perp" ? "linear_perp" : "spot",
        fee_rate: Number(values.fee_rate),
        slippage_bps: Number(values.slippage_bps),
        leverage: 1,
      },
    };
    setServerParams([]);
    setServerFields({});
    try {
      setCreated(await create.mutateAsync(body));
    } catch (reason) {
      if (reason instanceof ApiError) {
        const params = paramsErrors(reason);
        setServerParams(params.list);
        setServerFields(params.fields);
        const fields = reason.fields ?? {};
        const field = Object.keys(fields)[0] ?? "name";
        go(errorStep(field));
      }
    }
  };
  if (created) return <CreatedPanel system={created} router={router} />;
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">New system</h1>
      <ol className="flex flex-wrap gap-2" aria-label="Wizard steps">
        {STEP_NAMES.map((name, index) => (
          <li key={name}>
            <Button
              variant={step === index + 1 ? "default" : "outline"}
              disabled={index + 1 > firstIncomplete(values, Boolean(selected))}
              onClick={() => go(index + 1)}
            >
              {index + 1}. {name}
            </Button>
          </li>
        ))}
      </ol>
      <Card>
        <CardContent className="space-y-5 p-6">
          {step === 1 ? (
            <StrategyStep
              strategies={strategies.data?.results ?? []}
              choose={(key) => {
                form.setValue("strategy", key);
                form.setValue("version", "");
                form.setValue("instrument", "");
                go(2);
              }}
            />
          ) : null}
          {step === 2 ? (
            <VersionStep
              versions={versions.data?.results ?? []}
              choose={(version) => {
                form.setValue("version", version);
                go(3);
              }}
            />
          ) : null}
          {step === 3 ? (
            <>
              <h2 className="font-semibold">Parameters</h2>
              {serverParams.length ? (
                <ul role="alert" className="list-inside list-disc text-sm text-red-400">
                  {serverParams.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <SchemaForm
                schema={detail.data?.params_schema}
                defaults={detail.data?.default_params ?? {}}
                form={form as unknown as import("react-hook-form").UseFormReturn<FormWithParams>}
                serverErrors={serverFields}
              />
              <WizardButtons step={step} go={go} />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <InstrumentStep
                form={form}
                venues={compatibleVenues}
                instruments={instruments.data?.results ?? []}
                selected={selected}
                search={instrumentSearch}
                setSearch={setInstrumentSearch}
              />
              <WizardButtons step={step} go={go} />
            </>
          ) : null}
          {step === 5 ? (
            <>
              <h2 className="font-semibold">Mode and account</h2>
              <ModeStep form={form} accounts={accountsForVenue} duplicate={duplicate} />
              <WizardButtons step={step} go={go} />
            </>
          ) : null}
          {step === 6 ? (
            <>
              <CapitalStep form={form} />
              <WizardButtons step={step} go={go} />
            </>
          ) : null}
          {step === 7 ? (
            <ReviewStep
              form={form}
              strategy={selected?.title ?? values.strategy}
              submit={review}
              pending={create.isPending}
              error={create.error ? message(create.error) : ""}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function WizardButtons({ step, go }: { step: number; go: (step: number) => void }) {
  return (
    <div className="flex justify-between">
      <Button variant="outline" disabled={step === 1} onClick={() => go(step - 1)}>
        Back
      </Button>
      <Button onClick={() => go(step + 1)}>Continue</Button>
    </div>
  );
}
function StrategyStep({
  strategies,
  choose,
}: {
  strategies: NonNullable<ReturnType<typeof useStrategies>["data"]>["results"];
  choose: (key: string) => void;
}) {
  return (
    <>
      <h2 className="font-semibold">Choose a strategy</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {strategies.map((strategy) => (
          <Card key={strategy.key} className="flex flex-col">
            <CardHeader>
              <CardTitle>{strategy.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
              <p>{strategy.key}</p>
              <Badge variant="outline">
                {strategy.latest_version.meta.live_capable ? "Live capable" : "Paper only"}
              </Badge>
              <Badge variant="outline">
                {strategy.latest_version.meta.restart_safe ? "Restart safe" : "Not restart safe"}
              </Badge>
              {strategy.latest_version.meta.notes.map((note) => (
                <p key={note} className="text-sm">
                  {note}
                </p>
              ))}
              <Button className="mt-auto self-start" onClick={() => choose(strategy.key)}>
                Choose
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
function VersionStep({
  versions,
  choose,
}: {
  versions: NonNullable<ReturnType<typeof useStrategyVersions>["data"]>["results"];
  choose: (version: string) => void;
}) {
  return (
    <>
      <h2 className="font-semibold">Choose a version</h2>
      {versions.map((version) => (
        <Card key={version.version} className="mb-3">
          <CardContent className="flex items-center justify-between p-4">
            <span>{version.version}</span>
            <Button onClick={() => choose(version.version)}>Choose</Button>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
function InstrumentStep({
  form,
  venues,
  instruments,
  selected,
  search,
  setSearch,
}: {
  form: ReturnType<typeof useForm<WizardValues>>;
  venues: { id: string; name: string; kinds: string[] }[];
  instruments: { id: number; symbol: string; timeframes?: unknown }[];
  selected: { instrument_kinds: string[]; recommended_timeframes: string[] } | undefined;
  search: string;
  setSearch: (value: string) => void;
}) {
  const values = useWatch({ control: form.control }) as WizardValues;
  const selectedInstrument = instruments.find((item) => item.id === Number(values.instrument));
  const frames = Array.isArray(selectedInstrument?.timeframes)
    ? selectedInstrument.timeframes.filter((item): item is string => typeof item === "string")
    : [];
  const ordered = [...frames].sort(
    (left, right) =>
      (selected?.recommended_timeframes.includes(left) ? -1 : 0) -
      (selected?.recommended_timeframes.includes(right) ? -1 : 0),
  );
  return (
    <>
      <h2 className="font-semibold">Instrument and timeframe</h2>
      <Label htmlFor="venue">Venue</Label>
      <Select
        value={values.venue}
        onValueChange={(value) => {
          form.setValue("venue", value);
          form.setValue("instrument", "");
        }}
      >
        <SelectTrigger id="venue">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {venues.map((venue) => (
            <SelectItem key={venue.id} value={venue.id}>
              {venue.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="kind">Kind</Label>
      <Select
        value={values.kind}
        onValueChange={(value) => {
          form.setValue("kind", value);
          form.setValue("instrument", "");
        }}
      >
        <SelectTrigger id="kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {selected?.instrument_kinds.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {kind}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="instrument">Instrument</Label>
      <Input
        id="instrument-search"
        aria-label="Search instruments"
        value={search}
        placeholder="Search instruments"
        onChange={(event) => setSearch(event.target.value)}
      />
      <Select
        value={values.instrument}
        onValueChange={(value) => form.setValue("instrument", value)}
      >
        <SelectTrigger id="instrument">
          <SelectValue placeholder="Choose instrument" />
        </SelectTrigger>
        <SelectContent>
          {instruments.map((instrument) => (
            <SelectItem key={instrument.id} value={String(instrument.id)}>
              {instrument.symbol}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="timeframe">Timeframe</Label>
      <Select value={values.timeframe} onValueChange={(value) => form.setValue("timeframe", value)}>
        <SelectTrigger id="timeframe">
          <SelectValue placeholder="Choose timeframe" />
        </SelectTrigger>
        <SelectContent>
          {ordered.map((frame) => (
            <SelectItem key={frame} value={frame}>
              {frame}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
function ModeStep({
  form,
  accounts,
  duplicate,
}: {
  form: ReturnType<typeof useForm<WizardValues>>;
  accounts: { id: number; label: string }[];
  duplicate: boolean;
}) {
  const values = useWatch({ control: form.control }) as WizardValues;
  return (
    <>
      <Select
        value={values.mode}
        onValueChange={(value) => form.setValue("mode", value as "paper" | "live")}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paper">Paper</SelectItem>
          <SelectItem value="live">Live</SelectItem>
        </SelectContent>
      </Select>
      {values.mode === "live" ? (
        <>
          <Label>Verified account</Label>
          <Select value={values.account} onValueChange={(value) => form.setValue("account", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p>Live systems cannot start until live runtime support is available.</p>
          {duplicate ? (
            <p role="alert">This account already has a live system on this instrument.</p>
          ) : null}
        </>
      ) : (
        <p>Paper systems do not need an account.</p>
      )}
    </>
  );
}
function CapitalStep({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  return (
    <>
      <h2 className="font-semibold">Capital, risk, and costs</h2>
      {(
        [
          "allocation",
          "max_order_notional",
          "max_position_notional",
          "max_leverage",
          "max_orders_per_minute",
          "fee_rate",
          "slippage_bps",
        ] as const
      ).map((field) => (
        <div key={field}>
          <Label htmlFor={field}>{field.replaceAll("_", " ")}</Label>
          <Input id={field} type="number" step="any" {...form.register(field)} />
        </div>
      ))}
    </>
  );
}
function ReviewStep({
  form,
  strategy,
  submit,
  pending,
  error,
}: {
  form: ReturnType<typeof useForm<WizardValues>>;
  strategy: string;
  submit: () => Promise<void>;
  pending: boolean;
  error: string;
}) {
  const values = useWatch({ control: form.control }) as WizardValues;
  return (
    <>
      <h2 className="font-semibold">Review</h2>
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder={`${strategy} ${values.timeframe}`}
        />
        <p>
          {strategy}@{values.version} · {values.instrument} · {values.timeframe} · {values.mode}
        </p>
      </div>
      <Link
        className="underline"
        href={`/backtests/new?strategy=${encodeURIComponent(values.strategy)}`}
      >
        Run a backtest of this strategy
      </Link>
      {error ? <p role="alert">{error}</p> : null}
      <Button disabled={pending} onClick={() => void submit()}>
        Create system
      </Button>
    </>
  );
}
function CreatedPanel({
  system,
  router,
}: {
  system: TradingSystem;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Created</h1>
      <Card>
        <CardContent className="space-y-4 p-6">
          <p>{system.name} is stopped.</p>
          <Button onClick={() => router.push("/systems")}>Open in list</Button>
          {system.allowed_actions.includes("start") ? <SystemActions system={system} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
