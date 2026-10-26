"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { formatDistanceToNow } from "date-fns";
import { Check, LoaderCircle, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  credentialInputProps,
  fractionToPercent,
  parsePositiveInt,
  percentToFraction,
  permissionExplanation,
} from "@/lib/accounts";
import { apiRequest, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useDeleteAccount, useUpdateAccount, useVerifyAccount } from "@/lib/api/mutations";
import { useAccount, useAccountBalance, useAccounts, useVenues } from "@/lib/api/queries";
import type { Account, Venue } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { KillSwitchDialog } from "@/components/controls/kill-switch-dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function actionError(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return "Too many attempts, wait a minute.";
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

function clearCredentialInputs(form: HTMLFormElement | null) {
  form?.querySelectorAll<HTMLInputElement>("input[data-credential]").forEach((input) => {
    input.value = "";
  });
}

function StatusBadge({ account }: { account: Account }) {
  const verified = account.status === "verified";
  const invalid = account.status === "invalid";
  return (
    <Badge variant={invalid ? "destructive" : verified ? "default" : "secondary"}>
      {verified ? <Check className="mr-1 size-3" aria-hidden /> : null}
      {invalid ? <X className="mr-1 size-3" aria-hidden /> : null}
      {account.status}
    </Badge>
  );
}

function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-md border border-red-500/40 p-4">
      <p>{actionError(error)}</p>
      <Button variant="outline" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}

function CredentialFields({ venue }: { venue: Venue | null }) {
  if (!venue) return null;
  return venue.credential_fields.map((field) => (
    <div key={field.name} className="space-y-2">
      <Label htmlFor={`credential-${field.name}`}>{field.label}</Label>
      <Input
        id={`credential-${field.name}`}
        name={field.name}
        data-credential
        required
        {...credentialInputProps(field)}
      />
    </div>
  ));
}

export function AccountsPage() {
  const accounts = useAccounts();
  if (accounts.isLoading) return <Skeleton className="h-56 w-full" />;
  if (accounts.error)
    return <QueryError error={accounts.error} retry={() => void accounts.refetch()} />;
  const rows = accounts.data?.results ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Button asChild>
          <Link href="/accounts/new">Add account</Link>
        </Button>
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p>No exchange accounts yet.</p>
            <Button asChild>
              <Link href="/accounts/new">Add account</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Venue</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Testnet</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Systems</TableHead>
              <TableHead>Kill switch</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((account) => (
              <TableRow key={account.id}>
                <TableCell>{account.venue}</TableCell>
                <TableCell>
                  <Link className="underline" href={`/accounts/${account.id}`}>
                    {account.label}
                  </Link>
                </TableCell>
                <TableCell>
                  {account.is_testnet ? <Badge variant="secondary">Testnet</Badge> : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge account={account} />
                </TableCell>
                <TableCell>{account.systems_count}</TableCell>
                <TableCell>
                  {account.kill_switch.active ? (
                    <Badge variant="destructive">Kill switch on</Badge>
                  ) : (
                    <Badge variant="secondary">Kill switch off</Badge>
                  )}
                  <AccountKillSwitch account={account} />
                </TableCell>
                <TableCell>{new Date(account.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function AccountKillSwitch({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="ml-2" size="sm" variant="outline" onClick={() => setOpen(true)}>
        {account.kill_switch.active ? "Deactivate" : "Activate"}
      </Button>
      <KillSwitchDialog
        key={`account-${account.id}-${open}`}
        open={open}
        onOpenChange={setOpen}
        scope="account"
        active={account.kill_switch.active}
        accountId={account.id}
        label={account.label}
      />
    </>
  );
}

export function NewAccountPage() {
  const venues = useVenues();
  const router = useRouter();
  const client = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [venueId, setVenueId] = useState("");
  const [testnet, setTestnet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const venue = venues.data?.results.find((item) => item.id === venueId) ?? null;

  useEffect(() => () => clearCredentialInputs(formRef.current), []);
  function selectVenue(value: string) {
    setVenueId(value);
    setTestnet(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!venue) return;
    setError(null);
    setErrors({});
    const form = event.currentTarget;
    const data = new FormData(form);
    const credentials = Object.fromEntries(
      venue.credential_fields.map((field) => [field.name, data.get(field.name)]),
    );
    try {
      const account = await apiRequest<Account>("POST", "/api/engine/v1/accounts/", {
        body: { venue: venue.id, label: data.get("label"), is_testnet: testnet, credentials },
        idempotencyKey: crypto.randomUUID(),
      });
      clearCredentialInputs(form);
      await client.invalidateQueries({ queryKey: queryKeys.accounts() });
      try {
        await apiRequest<Account>("POST", `/api/engine/v1/accounts/${account.id}/verify/`, {
          idempotencyKey: crypto.randomUUID(),
        });
        router.push(`/accounts/${account.id}?verifying=1`);
      } catch (verifyError) {
        const code =
          verifyError instanceof ApiError && verifyError.code ? verifyError.code : "failed";
        router.push(`/accounts/${account.id}?verify_error=${encodeURIComponent(code)}`);
      }
    } catch (submitError) {
      setErrors(fieldMessages(submitError));
      setError(actionError(submitError));
    }
  }

  if (venues.isLoading) return <Skeleton className="h-72 w-full" />;
  if (venues.error) return <QueryError error={venues.error} retry={() => void venues.refetch()} />;
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Add account</h1>
      <Card>
        <CardContent className="p-6">
          <form ref={formRef} className="space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Select value={venueId} onValueChange={selectVenue}>
                <SelectTrigger id="venue">
                  <SelectValue placeholder="Choose a venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.data?.results.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.venue ? <p role="alert">{errors.venue}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" required />
              {errors.label ? <p role="alert">{errors.label}</p> : null}
            </div>
            <CredentialFields venue={venue} />
            {errors.credentials ? <p role="alert">{errors.credentials}</p> : null}
            {venue?.has_testnet ? (
              <div className="flex items-center gap-3">
                <Switch id="testnet" checked={testnet} onCheckedChange={setTestnet} />
                <Label htmlFor="testnet">Use testnet</Label>
              </div>
            ) : null}
            <p className="text-sm text-[var(--muted-foreground)]">
              Use a trade-only API key. Keys that can withdraw are refused.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={!venue}>
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

type SettingsValues = {
  label: string;
  daily_loss_limit: string;
  max_drawdown_pct: string;
  breaker_policy: "cancel_orders" | "flatten";
};

export function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = parsePositiveInt(params.id);
  const search = useSearchParams();
  const router = useRouter();
  if (!accountId)
    return (
      <div>
        <h1 className="text-2xl font-semibold">Account not found</h1>
      </div>
    );
  return (
    <AccountDetailContent id={accountId} router={router} verifyError={search.get("verify_error")} />
  );
}

function AccountDetailContent({
  id,
  router,
  verifyError,
}: {
  id: number;
  router: ReturnType<typeof useRouter>;
  verifyError: string | null;
}) {
  const account = useAccount(id, { pollWhilePending: true });
  const balance = useAccountBalance(id, { enabled: Boolean(account.data) });
  const venues = useVenues();
  const update = useUpdateAccount(id);
  const verify = useVerifyAccount(id);
  const remove = useDeleteAccount(id);
  const client = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [balanceTimedOut, setBalanceTimedOut] = useState(false);
  const replaceForm = useRef<HTMLFormElement>(null);
  const settings = useForm<SettingsValues>();
  const breakerPolicy = useWatch({ control: settings.control, name: "breaker_policy" });
  const current = account.data;
  const venue = venues.data?.results.find((item) => item.id === current?.venue) ?? null;

  useEffect(() => () => clearCredentialInputs(replaceForm.current), []);
  useEffect(() => {
    if (!current || settings.formState.isDirty) return;
    settings.reset({
      label: current.label,
      daily_loss_limit: current.risk.daily_loss_limit ?? "",
      max_drawdown_pct: fractionToPercent(current.risk.max_drawdown_pct),
      breaker_policy: current.risk.breaker_policy,
    });
  }, [current, settings]);
  useEffect(() => {
    if (!balance.data?.pending) return;
    const timer = window.setTimeout(() => setBalanceTimedOut(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [balance.data?.pending]);

  if (account.isLoading) return <Skeleton className="h-96 w-full" />;
  if (account.error)
    return <QueryError error={account.error} retry={() => void account.refetch()} />;
  if (!current) return null;
  const explanation = permissionExplanation(current.permissions);
  const verifyMessage =
    verifyError === "rate_limited" ? "Too many attempts, wait a minute." : verifyError;

  async function saveSettings(values: SettingsValues) {
    const fraction = percentToFraction(values.max_drawdown_pct);
    if (values.max_drawdown_pct !== "" && fraction === null) {
      settings.setError("max_drawdown_pct", { message: "Enter a value from 0 to 100." });
      return;
    }
    try {
      await update.mutateAsync({
        label: values.label,
        daily_loss_limit: values.daily_loss_limit || null,
        max_drawdown_pct: fraction,
        breaker_policy: values.breaker_policy,
      });
      settings.reset(values);
      setActionMessage("Settings saved.");
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, message] of Object.entries(fieldMessages(error))) {
          if (field in settings.getValues()) {
            settings.setError(field as keyof SettingsValues, { message });
          }
        }
      }
      setActionMessage(actionError(error));
    }
  }

  async function replaceCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!venue) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const credentials = Object.fromEntries(
      venue.credential_fields.map((field) => [field.name, data.get(field.name)]),
    );
    try {
      await apiRequest<Account>("PATCH", `/api/engine/v1/accounts/${id}/`, {
        body: { credentials },
        idempotencyKey: crypto.randomUUID(),
      });
      clearCredentialInputs(form);
      await client.invalidateQueries({ queryKey: queryKeys.account(id) });
      await apiRequest<Account>("POST", `/api/engine/v1/accounts/${id}/verify/`, {
        idempotencyKey: crypto.randomUUID(),
      });
      setActionMessage("Credentials replaced. Verifying…");
    } catch (error) {
      setActionMessage(actionError(error));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{current.label}</h1>
        <span>{current.venue}</span>
        {current.is_testnet ? <Badge variant="secondary">Testnet</Badge> : null}
        <StatusBadge account={current} />
      </div>
      {verifyError ? (
        <div role="alert" className="rounded-md border border-amber-500/50 p-4">
          Verification could not start: {verifyMessage}. Try again in a minute.
        </div>
      ) : null}
      {actionMessage ? <p role="status">{actionMessage}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            Trade:{" "}
            {current.permissions?.trade === true
              ? "yes"
              : current.permissions?.trade === false
                ? "no"
                : "unknown"}
          </p>
          <p>
            Withdraw:{" "}
            {current.permissions?.withdraw === true
              ? "yes"
              : current.permissions?.withdraw === false
                ? "no"
                : "unknown"}
          </p>
          {explanation ? (
            <p role="alert" className="text-red-400">
              {explanation}
            </p>
          ) : null}
          {current.probe_error ? (
            <p role="alert" className="text-amber-400">
              {current.probe_error}
            </p>
          ) : null}
          {current.verification_pending ? (
            <p className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              Verifying…
            </p>
          ) : null}
          <Button
            disabled={current.verification_pending || verify.isPending}
            onClick={() =>
              verify.mutate(undefined, { onError: (error) => setActionMessage(actionError(error)) })
            }
          >
            Verify again
          </Button>
        </CardContent>
      </Card>
      <Card data-testid="balance-card">
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {balance.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : balance.error ? (
            <QueryError error={balance.error} retry={() => void balance.refetch()} />
          ) : balanceTimedOut && balance.data?.pending ? (
            <p>Balance not available yet</p>
          ) : balance.data?.pending ? (
            <p className="text-[var(--muted-foreground)]">Fetching balance…</p>
          ) : balance.data?.error ? (
            <p role="alert" className="text-amber-400">
              {balance.data.error}
            </p>
          ) : !balance.data?.balances.length ? (
            <p className="text-[var(--muted-foreground)]">No balances</p>
          ) : (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Currency</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Free</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balance.data?.balances.map((row) => (
                    <TableRow key={row.currency}>
                      <TableCell>{row.currency}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.free}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {balance.data?.as_of ? (
                <time title={`${balance.data.as_of} UTC`}>
                  {formatDistanceToNow(new Date(balance.data.as_of), { addSuffix: true })}
                </time>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={settings.handleSubmit(saveSettings)}>
            <div className="space-y-1">
              <Label htmlFor="settings-label">Label</Label>
              <Input
                id="settings-label"
                {...settings.register("label", { required: "Label is required." })}
              />
              {settings.formState.errors.label ? (
                <p role="alert">{settings.formState.errors.label.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="daily-loss">Daily loss limit</Label>
              <Input id="daily-loss" {...settings.register("daily_loss_limit")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="drawdown">Max drawdown (%)</Label>
              <Input id="drawdown" inputMode="decimal" {...settings.register("max_drawdown_pct")} />
              {settings.formState.errors.max_drawdown_pct ? (
                <p role="alert">{settings.formState.errors.max_drawdown_pct.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="breaker">Breaker policy</Label>
              <Select
                value={breakerPolicy}
                onValueChange={(value) =>
                  settings.setValue("breaker_policy", value as SettingsValues["breaker_policy"])
                }
              >
                <SelectTrigger id="breaker">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cancel_orders">Cancel orders</SelectItem>
                  <SelectItem value="flatten">Flatten</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={update.isPending}>
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            {current.credentials_set ? "Credentials set" : "No credentials set"}{" "}
            {current.credential_hint}
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Replace credentials</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Replace credentials</DialogTitle>
              <DialogDescription>Existing credentials are replaced immediately.</DialogDescription>
              <form ref={replaceForm} className="mt-4 space-y-4" onSubmit={replaceCredentials}>
                <CredentialFields venue={venue} />
                <Button type="submit">Replace credentials</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Risk controls</CardTitle>
        </CardHeader>
        <CardContent>
          {current.kill_switch.active ? (
            <Badge variant="destructive">Kill switch on</Badge>
          ) : (
            <Badge variant="secondary">Kill switch off</Badge>
          )}
          <AccountKillSwitch account={current} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Systems</CardTitle>
        </CardHeader>
        <CardContent>{current.systems_count} systems use this account.</CardContent>
      </Card>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Delete account</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {current.label}?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          <div className="mt-5 flex justify-end gap-3">
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() =>
                  remove.mutate(undefined, {
                    onSuccess: () => router.push("/accounts"),
                    onError: (error) => setActionMessage(actionError(error)),
                  })
                }
              >
                Delete
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
