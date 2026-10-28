"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ApiError } from "@/lib/api/client";
import { useMe, useOperatorSystemsInfinite, useStrategies } from "@/lib/api/queries";
import type { OperatorSystem } from "@/lib/api/types";

const TAB_VALUES = ["systems", "strategies", "kill-switch", "audit", "health"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function tabValue(value: string | null): TabValue {
  return TAB_VALUES.includes(value as TabValue) ? (value as TabValue) : "systems";
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Unable to load operator data.";
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
  const systems = useOperatorSystemsInfinite(filters, { enabled: user.data?.is_staff === true });
  const activeTab = tabValue(search.get("tab"));
  const forbidden = user.data?.is_staff === false || isForbidden(systems.error);

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
          <OperatorSystemsTab
            filters={filters}
            setFilters={setFilters}
            systems={systems}
            ownEmail={user.data?.email ?? ""}
          />
        </TabsContent>
        {TAB_VALUES.filter((tab) => tab !== "systems").map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <Card>
              <CardContent className="p-6">
                This operator tab is coming in the next slice.
              </CardContent>
            </Card>
          </TabsContent>
        ))}
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
            <TableCell>{system.net_pnl}</TableCell>
            <TableCell>{heartbeatAge(system.heartbeat_at)}</TableCell>
            <TableCell>{system.manual_intervention ? "Yes" : "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
