"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Decimal from "decimal.js-light";
import { AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModeBadge } from "@/components/mode-badge";
import { KillSwitchDialog } from "@/components/controls/kill-switch-dialog";
import { ApiError } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { usePublishVersion, useUnpublishVersion } from "@/lib/api/mutations";
import {
  useAuditLogInfinite,
  useBacktestsInfinite,
  useHealth,
  useKillSwitches,
  useMe,
  useOperatorStrategies,
  useOperatorSystemsInfinite,
  useStrategies,
} from "@/lib/api/queries";
import { auditTarget, compactJson, formatAge, isStaleHeartbeat } from "@/lib/operator";
import type { AuditLogRow, OperatorStrategy, OperatorSystem } from "@/lib/api/types";

const TAB_VALUES = ["systems", "strategies", "kill-switch", "audit", "health"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function tabValue(value: string | null): TabValue {
  return TAB_VALUES.includes(value as TabValue) ? (value as TabValue) : "systems";
}

function errorMessage(error: unknown): string {
  return apiErrorMessage(error, "Unable to load operator data.");
}

function fieldMessages(error: unknown): string[] {
  if (!(error instanceof ApiError) || !error.fields) return [];
  return Object.values(error.fields).flatMap((field) =>
    Array.isArray(field)
      ? field.filter((message): message is string => typeof message === "string")
      : typeof field === "string"
        ? [field]
        : [],
  );
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

function heartbeatAge(value: string | null): string {
  if (!value) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
}

function money(value: string | null | undefined): string {
  return value === null || value === undefined ? "—" : new Decimal(value).toFixed(2);
}

function localTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function stateBadge(state: OperatorSystem["state"]) {
  return (
    <Badge variant={state === "error" || state === "halted" ? "destructive" : "secondary"}>
      {state}
    </Badge>
  );
}

export function OperatorPage() {
  const router = useRouter();
  const search = useSearchParams();
  const user = useMe();
  const [filters, setFilters] = useState({ state: "", mode: "", owner: "", strategy: "" });
  const [auditFilters, setAuditFilters] = useState({ actor: "", action: "", target: "" });
  const activeTab = tabValue(search.get("tab"));
  const staff = user.data?.is_staff === true;
  const systems = useOperatorSystemsInfinite(filters, {
    enabled: staff && activeTab === "systems",
  });
  const strategies = useOperatorStrategies({ enabled: staff && activeTab === "strategies" });
  const audit = useAuditLogInfinite(auditFilters, { enabled: staff && activeTab === "audit" });
  const health = useHealth({ enabled: staff && activeTab === "health" });
  const [mutationForbidden, setMutationForbidden] = useState(false);
  const forbidden =
    user.data?.is_staff === false ||
    [systems.error, strategies.error, audit.error, health.error].some(isForbidden) ||
    mutationForbidden;

  function changeTab(value: string) {
    const next = tabValue(value);
    router.replace(next === "systems" ? "/operator" : `/operator?tab=${next}`);
  }

  if (user.isLoading) return <Skeleton className="h-64" />;
  if (forbidden) return <OperatorsOnly />;
  if (user.error) return <LocalError error={user.error} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Operator</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Cross-tenant operational controls.</p>
      </div>
      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList aria-label="Operator sections">
          <TabsTrigger value="systems">Systems</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="kill-switch">Global kill switch</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>
        <TabsContent value="systems" className="mt-6">
          {activeTab === "systems" ? (
            <OperatorSystemsTab
              filters={filters}
              setFilters={setFilters}
              systems={systems}
              ownEmail={user.data?.email ?? ""}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="strategies" className="mt-6">
          {activeTab === "strategies" ? (
            <StrategiesTab query={strategies} onForbidden={() => setMutationForbidden(true)} />
          ) : null}
        </TabsContent>
        <TabsContent value="kill-switch" className="mt-6">
          {activeTab === "kill-switch" ? (
            <GlobalKillSwitchTab onForbidden={() => setMutationForbidden(true)} />
          ) : null}
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          {activeTab === "audit" ? (
            <AuditLogTab query={audit} filters={auditFilters} setFilters={setAuditFilters} />
          ) : null}
        </TabsContent>
        <TabsContent value="health" className="mt-6">
          {activeTab === "health" ? <HealthTab query={health} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OperatorsOnly() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-6" role="alert">
        <AlertTriangle className="size-5 text-[var(--destructive)]" />
        <div>
          <h1 className="font-semibold">Operators only</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            You do not have access to this area.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LocalError({ error }: { error: unknown }) {
  return <p role="alert">{errorMessage(error)}</p>;
}

type SystemsTabProps = {
  filters: { state: string; mode: string; owner: string; strategy: string };
  setFilters: (value: { state: string; mode: string; owner: string; strategy: string }) => void;
  systems: ReturnType<typeof useOperatorSystemsInfinite>;
  ownEmail: string;
};

function OperatorSystemsTab({ filters, setFilters, systems, ownEmail }: SystemsTabProps) {
  const strategies = useStrategies();
  const rows = useMemo(
    () => systems.data?.pages.flatMap((page) => page.results) ?? [],
    [systems.data],
  );
  if (systems.isLoading) return <Skeleton className="h-64" />;
  if (systems.error) return <LocalError error={systems.error} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Operator state filter"
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
          aria-label="Operator mode filter"
          value={filters.mode}
          onChange={(event) => setFilters({ ...filters, mode: event.target.value })}
        >
          <option value="">All modes</option>
          <option value="paper">paper</option>
          <option value="live">live</option>
        </select>
        <Input
          aria-label="Owner filter"
          placeholder="Owner email or ID"
          value={filters.owner}
          onChange={(event) => setFilters({ ...filters, owner: event.target.value })}
        />
        <select
          aria-label="Operator strategy filter"
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
      {rows.length ? (
        <OperatorSystemsTable rows={rows} ownEmail={ownEmail} />
      ) : (
        <Card>
          <CardContent className="p-6">No systems found.</CardContent>
        </Card>
      )}
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

function OperatorSystemsTable({ rows, ownEmail }: { rows: OperatorSystem[]; ownEmail: string }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1000px] whitespace-nowrap text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Owner</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Strategy</TableHead>
            <TableHead>Instrument</TableHead>
            <TableHead>PnL</TableHead>
            <TableHead>Heartbeat</TableHead>
            <TableHead>Manual</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((system) => (
            <TableRow key={system.id}>
              <TableCell>{system.owner.email}</TableCell>
              <TableCell>
                {system.owner.email === ownEmail ? (
                  <Link className="underline" href={`/systems/${system.id}`}>
                    {system.name}
                  </Link>
                ) : (
                  system.name
                )}
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
              <TableCell>{money(system.net_pnl)}</TableCell>
              <TableCell>{heartbeatAge(system.heartbeat_at)}</TableCell>
              <TableCell>{system.manual_intervention ? "Yes" : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function strategyPath(key: string): [string, string] {
  const separator = key.indexOf("/");
  return [key.slice(0, separator), key.slice(separator + 1)];
}

function StrategiesTab({
  query,
  onForbidden,
}: {
  query: ReturnType<typeof useOperatorStrategies>;
  onForbidden: () => void;
}) {
  if (query.isLoading) return <Skeleton className="h-64" />;
  if (query.error) return <LocalError error={query.error} />;
  return (
    <div className="space-y-4">
      {query.data?.results.map((strategy) => (
        <StrategyCard key={strategy.key} strategy={strategy} onForbidden={onForbidden} />
      ))}
    </div>
  );
}

function StrategyCard({
  strategy,
  onForbidden,
}: {
  strategy: OperatorStrategy;
  onForbidden: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="font-semibold">{strategy.title}</h2>
        {strategy.versions.map((version) => (
          <div key={version.version} className="flex flex-wrap items-center gap-3 border-t pt-3">
            <span>{version.version}</span>
            <Badge variant={version.status === "published" ? "secondary" : "outline"}>
              {version.status}
            </Badge>
            <span className="text-sm text-[var(--muted-foreground)]">
              {version.code_revision || "No code revision"}
            </span>
            {version.status === "draft" ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/backtests/new?strategy=${encodeURIComponent(strategy.key)}&version=${encodeURIComponent(version.version)}`}
                  >
                    Run backtest
                  </Link>
                </Button>
                <PublishDialog
                  strategy={strategy}
                  version={version.version}
                  onForbidden={onForbidden}
                />
              </>
            ) : null}
            {version.status === "published" ? (
              <UnpublishButton
                strategy={strategy}
                version={version.version}
                onForbidden={onForbidden}
              />
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PublishDialog({
  strategy,
  version,
  onForbidden,
}: {
  strategy: OperatorStrategy;
  version: string;
  onForbidden: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [codeRevision, setCodeRevision] = useState(
    strategy.versions.find((item) => item.version === version)?.code_revision ?? "",
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [family, name] = strategyPath(strategy.key);
  const backtests = useBacktestsInfinite(
    { strategy: strategy.key, version, status: "done" },
    { enabled: open },
  );
  const publish = usePublishVersion(family, name);
  const jobs = backtests.data?.pages.flatMap((page) => page.results) ?? [];

  useEffect(() => {
    if (isForbidden(publish.error) || isForbidden(backtests.error)) onForbidden();
  }, [backtests.error, onForbidden, publish.error]);

  function toggleEvidence(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function publishVersion() {
    publish.mutate(
      { version, code_revision: codeRevision, evidence: selected },
      {
        onSuccess: () => {
          toast.success("Strategy version published");
          setOpen(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Publish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="space-y-4">
          <DialogTitle>
            Publish {strategy.title}@{version}
          </DialogTitle>
          <DialogDescription>Select at least one finished backtest as evidence.</DialogDescription>
          <Input
            aria-label="Code revision"
            value={codeRevision}
            onChange={(event) => setCodeRevision(event.target.value)}
          />
          {backtests.isLoading ? <Skeleton className="h-20" /> : null}
          {!backtests.isLoading && jobs.length === 0 ? (
            <p>No finished backtests of this draft yet</p>
          ) : null}
          {jobs.map((job) => (
            <label key={job.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(job.id)}
                onChange={() => toggleEvidence(job.id)}
              />
              #{job.id} {job.instrument.symbol} {job.timeframe}
            </label>
          ))}
          {publish.error ? (
            <div role="alert">
              <p>{errorMessage(publish.error)}</p>
              {fieldMessages(publish.error).map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}
          <Button disabled={selected.length === 0 || publish.isPending} onClick={publishVersion}>
            Publish version
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UnpublishButton({
  strategy,
  version,
  onForbidden,
}: {
  strategy: OperatorStrategy;
  version: string;
  onForbidden: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [family, name] = strategyPath(strategy.key);
  const unpublish = useUnpublishVersion(family, name, version);

  useEffect(() => {
    if (isForbidden(unpublish.error)) onForbidden();
  }, [onForbidden, unpublish.error]);

  function unpublishVersion(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    unpublish.mutate(undefined, {
      onSuccess: () => {
        toast.success("Strategy version unpublished");
        setOpen(false);
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Unpublish
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>
          Unpublish {strategy.title}@{version}?
        </AlertDialogTitle>
        <AlertDialogDescription>
          This removes the version from the public catalog.
        </AlertDialogDescription>
        {unpublish.error ? (
          <div role="alert">
            <p>{errorMessage(unpublish.error)}</p>
            {fieldMessages(unpublish.error).map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={unpublishVersion}>Unpublish</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function GlobalKillSwitchTab({ onForbidden }: { onForbidden: () => void }) {
  const switches = useKillSwitches();
  const [open, setOpen] = useState(false);
  const global = switches.data?.results.find((item) => item.scope === "global");

  useEffect(() => {
    if (isForbidden(switches.error)) onForbidden();
  }, [onForbidden, switches.error]);

  if (switches.isLoading) return <Skeleton className="h-32" />;
  if (switches.error) return <LocalError error={switches.error} />;
  if (!global) return <p role="alert">Global kill switch status is unavailable.</p>;
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-semibold">Global kill switch</h2>
          <p>{global.active ? "Active" : "Inactive"}</p>
        </div>
        <Button variant={global.active ? "outline" : "destructive"} onClick={() => setOpen(true)}>
          {global.active ? "Deactivate" : "Activate"}
        </Button>
        <KillSwitchDialog
          open={open}
          onOpenChange={setOpen}
          scope="global"
          active={global.active}
          onForbidden={onForbidden}
        />
      </CardContent>
    </Card>
  );
}

function AuditLogTab({
  query,
  filters,
  setFilters,
}: {
  query: ReturnType<typeof useAuditLogInfinite>;
  filters: { actor: string; action: string; target: string };
  setFilters: (value: { actor: string; action: string; target: string }) => void;
}) {
  const rows = query.data?.pages.flatMap((page) => page.results) ?? [];
  if (query.isLoading) return <Skeleton className="h-64" />;
  if (query.error) return <LocalError error={query.error} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {(["actor", "action", "target"] as const).map((name) => (
          <Input
            key={name}
            aria-label={`${name} filter`}
            placeholder={name}
            value={filters[name]}
            onChange={(event) => setFilters({ ...filters, [name]: event.target.value })}
          />
        ))}
      </div>
      <AuditTable rows={rows} />
      {query.hasNextPage ? (
        <Button variant="outline" onClick={() => void query.fetchNextPage()}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}

function AuditTable({ rows }: { rows: AuditLogRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="whitespace-nowrap">
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{localTime(row.time)}</TableCell>
              <TableCell>{row.actor?.email ?? "System"}</TableCell>
              <TableCell>{row.action}</TableCell>
              <TableCell>{auditTarget(row.target_type, row.target_id)}</TableCell>
              <TableCell>
                <details>
                  <summary>{compactJson(row.data).slice(0, 80)}</summary>
                  <pre>{JSON.stringify(row.data, null, 2)}</pre>
                </details>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HealthTab({ query }: { query: ReturnType<typeof useHealth> }) {
  if (query.isLoading) return <Skeleton className="h-64" />;
  if (query.error) return <LocalError error={query.error} />;
  const health = query.data;
  if (!health) return null;
  const heartbeats = [...health.heartbeats].sort(
    (left, right) => (right.age_s ?? -1) - (left.age_s ?? -1),
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <HealthCard
        title="Supervisor"
        ok={health.supervisor.alive}
        message={health.supervisor.error}
      />
      <HealthCard
        title="Redis"
        ok={health.redis.ok}
        message={health.redis.error}
        detail={`${health.redis.latency_ms ?? "—"} ms`}
      />
      <HealthCard
        title="Database"
        ok={health.db.ok}
        message={health.db.error}
        detail={`${health.db.latency_ms ?? "—"} ms`}
      />
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold">Workers</h2>
          {Object.entries(health.workers).map(([state, count]) => (
            <p key={state}>
              {state}: {count}
            </p>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold">Heartbeats</h2>
          {heartbeats.map((item) => (
            <p key={item.system} className={isStaleHeartbeat(item.age_s) ? "text-red-500" : ""}>
              #{item.system} {item.state}: {formatAge(item.age_s)}
            </p>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold">Markets</h2>
          {health.markets.map((market) => (
            <p key={market.key}>
              {market.key}: lag {formatAge(market.lag_s)}, heartbeat{" "}
              {formatAge(market.heartbeat_age_s)}, gaps {market.gaps}
              {market.last_error ? `, ${market.last_error}` : ""}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HealthCard({
  title,
  ok,
  message,
  detail,
}: {
  title: string;
  ok: boolean;
  message: string | null;
  detail?: string;
}) {
  return (
    <Card className={ok ? "" : "border-red-500"}>
      <CardContent className={ok ? "p-4" : "p-4 text-red-500"}>
        <h2 className="font-semibold">{title}</h2>
        <p>{ok ? "OK" : (message ?? "Unavailable")}</p>
        {detail ? <p>{detail}</p> : null}
      </CardContent>
    </Card>
  );
}
