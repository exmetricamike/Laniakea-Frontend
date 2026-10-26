"use client";

import Link from "next/link";
import { useState } from "react";
import { KillSwitchDialog } from "@/components/controls/kill-switch-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccounts, useKillSwitches, useMe, useSystemsInfinite } from "@/lib/api/queries";
import type { KillSwitch } from "@/lib/api/types";

type Scope = "tenant" | "account" | "global";

function SwitchRow({
  scope,
  label,
  target,
  row,
}: {
  scope: Scope;
  label: string;
  target?: number;
  row?: KillSwitch;
}) {
  const [open, setOpen] = useState(false);
  const active = row?.active ?? false;
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell>
        <Badge variant={active ? "destructive" : "secondary"}>{active ? "on" : "off"}</Badge>
      </TableCell>
      <TableCell>{row?.reason ?? "—"}</TableCell>
      <TableCell>{row?.set_by ?? "—"}</TableCell>
      <TableCell>{row?.set_at ? new Date(row.set_at).toLocaleString() : "—"}</TableCell>
      <TableCell>
        <Button size="sm" onClick={() => setOpen(true)}>
          {active ? "Deactivate" : "Activate"}
        </Button>
      </TableCell>
      <KillSwitchDialog
        key={`${scope}-${target ?? "global"}-${open}`}
        open={open}
        onOpenChange={setOpen}
        scope={scope}
        active={active}
        accountId={target}
        label={label}
      />
    </TableRow>
  );
}

export function RiskPage() {
  const switches = useKillSwitches();
  const accounts = useAccounts();
  const user = useMe();
  const systems = useSystemsInfinite({});
  const rows = systems.data?.pages.flatMap((page) => page.results) ?? [];
  const find = (scope: KillSwitch["scope"], target?: number) =>
    switches.data?.results.find(
      (row) => row.scope === scope && (scope !== "account" || row.target === target),
    );
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Risk</h1>
      <Card>
        <CardHeader>
          <CardTitle>Kill switches</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Set by</TableHead>
                <TableHead>Set at</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SwitchRow scope="tenant" label="Tenant — all my systems" row={find("tenant")} />
              {accounts.data?.results.map((account) => (
                <SwitchRow
                  key={account.id}
                  scope="account"
                  target={account.id}
                  label={`${account.label} (${account.venue})`}
                  row={find("account", account.id)}
                />
              ))}
              {user.data?.is_staff ? (
                <SwitchRow scope="global" label="Global" row={find("global")} />
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Per-system limits</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Max order</TableHead>
                <TableHead>Max position</TableHead>
                <TableHead>Max leverage</TableHead>
                <TableHead>Orders/min</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((system) => (
                <TableRow key={system.id}>
                  <TableCell>
                    <Link className="underline" href={`/systems/${system.id}`}>
                      {system.name}
                    </Link>
                  </TableCell>
                  <TableCell>{system.mode}</TableCell>
                  <TableCell>{system.state}</TableCell>
                  <TableCell>{system.risk.max_order_notional ?? "—"}</TableCell>
                  <TableCell>{system.risk.max_position_notional ?? "—"}</TableCell>
                  <TableCell>{system.risk.max_leverage ?? "—"}</TableCell>
                  <TableCell>{system.risk.max_orders_per_minute ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {systems.hasNextPage ? (
            <Button className="mt-4" variant="outline" onClick={() => void systems.fetchNextPage()}>
              Load more
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
