"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ApiError } from "@/lib/api/client";
import {
  useStrategies,
  useStrategy,
  useStrategyVersion,
  useStrategyVersions,
} from "@/lib/api/queries";
import type { StrategyMeta } from "@/lib/api/types";
import { formatJsonValue, paramsRows } from "@/lib/strategies/params";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Unable to load strategies.";
}

function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-md border border-red-500/40 p-4">
      <p>{errorMessage(error)}</p>
      <Button variant="outline" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}

function publishedAt(value: string | null | undefined) {
  if (!value) return { local: "—", utc: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { local: "—", utc: null };
  return { local: date.toLocaleDateString(), utc: date.toUTCString() };
}

function MetaBadges({ meta }: { meta: StrategyMeta }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={meta.live_capable ? "default" : "secondary"}>
        {meta.live_capable ? "Live capable" : "Backtest only"}
      </Badge>
      <Badge variant={meta.restart_safe ? "default" : "secondary"}>
        {meta.restart_safe ? "Restart safe" : "Not restart safe"}
      </Badge>
    </div>
  );
}

function StrategySkeletons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading strategies">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <Skeleton key={item} className="h-56" />
      ))}
    </div>
  );
}

export function StrategiesPage() {
  const query = useStrategies();
  if (query.isLoading) return <StrategySkeletons />;
  if (query.error) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  const strategies = query.data?.results ?? [];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Strategies</h1>
      {strategies.length === 0 ? (
        <Card>
          <CardContent className="p-6">No published strategies yet</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {strategies.map((strategy) => {
            const published = publishedAt(strategy.latest_version.published_at);
            return (
              <Card key={strategy.key} className="flex flex-col">
                <CardHeader className="space-y-3">
                  <CardTitle>{strategy.title}</CardTitle>
                  <p className="break-all font-mono text-xs text-[var(--muted-foreground)]">
                    {strategy.key}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {strategy.instrument_kinds.map((kind) => (
                      <Badge key={kind} variant="outline">
                        {kind}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <p className="text-sm">
                    Timeframes: {strategy.recommended_timeframes.join(", ") || "—"}
                  </p>
                  <p className="text-sm">
                    Latest: {strategy.latest_version.version} ·{" "}
                    {published.utc ? (
                      <span title={published.utc}>{published.local}</span>
                    ) : (
                      published.local
                    )}
                  </p>
                  <MetaBadges meta={strategy.latest_version.meta} />
                  <Button asChild className="w-full">
                    <Link href={`/strategies/${encodeURIComponent(strategy.key)}`}>
                      Open strategy
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Description({ markdown }: { markdown: string }) {
  return (
    <section className="space-y-3" aria-label="Description">
      {markdown.trim() === "" ? (
        <p className="text-[var(--muted-foreground)]">No description yet.</p>
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => {
            const valid = href && /^https?:\/\//i.test(href);
            return valid ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                {children}
              </a>
            ) : (
              <>{children}</>
            );
          },
          img: ({ alt }) => <>{alt ?? ""}</>,
          h1: ({ children }) => <h2 className="text-xl font-semibold">{children}</h2>,
          h2: ({ children }) => <h3 className="text-lg font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
          code: ({ children }) => (
            <code className="rounded bg-[var(--muted)] px-1 py-0.5">{children}</code>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          table: ({ children }) => (
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border bg-[var(--muted)] px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border px-3 py-2 align-top">{children}</td>,
          tr: ({ children }) => <tr className="border-b">{children}</tr>,
        }}
      >
        {markdown.trim() === "" ? "" : markdown}
      </ReactMarkdown>
    </section>
  );
}

function DetailError({ error, retry }: { error: unknown; retry: () => void }) {
  return <QueryError error={error} retry={retry} />;
}

export function StrategyDetailPage() {
  const { key } = useParams<{ key: string }>();
  const strategy = useStrategy(key);
  const versions = useStrategyVersions(key);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const version = selectedVersion ?? strategy.data?.latest_version.version ?? null;
  const detail = useStrategyVersion(key, version);

  if (strategy.isLoading) return <Skeleton className="h-80 w-full" />;
  if (strategy.error) {
    const notFound = strategy.error instanceof ApiError && strategy.error.status === 404;
    if (notFound || (strategy.error instanceof ApiError && strategy.error.status === 400)) {
      return (
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">Strategy not found</h1>
          <Link className="underline" href="/strategies">
            Back to strategies
          </Link>
        </div>
      );
    }
    return <QueryError error={strategy.error} retry={() => void strategy.refetch()} />;
  }
  if (!strategy.data) return null;

  const rows = paramsRows(detail.data?.params_schema, detail.data?.default_params);
  const detailFailure = detail.error ? (
    <DetailError error={detail.error} retry={() => void detail.refetch()} />
  ) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">{strategy.data.title}</h1>
        <p className="break-all font-mono text-sm text-[var(--muted-foreground)]">
          {strategy.data.key}
        </p>
        <div className="flex flex-wrap gap-2">
          {strategy.data.instrument_kinds.map((kind) => (
            <Badge key={kind}>{kind}</Badge>
          ))}
        </div>
        <p>Timeframes: {strategy.data.recommended_timeframes.join(", ") || "—"}</p>
        <p>Warmup bars: {strategy.data.warmup_bars}</p>
      </header>
      <Description markdown={strategy.data.description_md} />
      <Tabs defaultValue="versions" className="space-y-4">
        <TabsList className="flex flex-wrap gap-2" aria-label="Strategy details">
          {[
            ["versions", "Versions"],
            ["parameters", "Parameters"],
            ["meta", "META"],
            ["evidence", "Evidence"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded px-3 py-2 data-[state=active]:bg-[var(--muted)]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="versions">
          {versions.isLoading ? <Skeleton className="h-40 w-full" /> : null}
          {versions.error ? (
            <DetailError error={versions.error} retry={() => void versions.refetch()} />
          ) : null}
          {versions.data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Live capable</TableHead>
                  <TableHead>Restart safe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.data.results.map((item) => {
                  const published = publishedAt(item.published_at);
                  return (
                    <TableRow key={item.version}>
                      <TableCell>
                        <Button variant="ghost" onClick={() => setSelectedVersion(item.version)}>
                          {item.version}
                        </Button>
                      </TableCell>
                      <TableCell title={published.utc ?? undefined}>{published.local}</TableCell>
                      <TableCell>
                        {item.meta.live_capable ? "Live capable" : "Backtest only"}
                      </TableCell>
                      <TableCell>
                        {item.meta.restart_safe ? "Restart safe" : "Not restart safe"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </TabsContent>
        <TabsContent value="parameters">
          {detail.isLoading ? <Skeleton className="h-40 w-full" /> : null}
          {detailFailure}
          {detail.data ? (
            rows.length === 0 ? (
              <p>No parameters</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>Enum</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{formatJsonValue(row.defaultValue)}</TableCell>
                      <TableCell>{formatJsonValue(row.minimum)}</TableCell>
                      <TableCell>{formatJsonValue(row.maximum)}</TableCell>
                      <TableCell>{formatJsonValue(row.enumValues)}</TableCell>
                      <TableCell>{formatJsonValue(row.description)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : null}
        </TabsContent>
        <TabsContent value="meta">
          {detail.isLoading ? <Skeleton className="h-32 w-full" /> : null}
          {detailFailure}
          {detail.data ? (
            <div className="space-y-3">
              <MetaBadges meta={detail.data.meta} />
              {detail.data.meta.notes.length > 0 ? (
                <ul className="list-disc pl-5">
                  {detail.data.meta.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : (
                <p>No notes</p>
              )}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="evidence">
          {detail.isLoading ? <Skeleton className="h-32 w-full" /> : null}
          {detailFailure}
          {detail.data ? (
            detail.data.evidence.length === 0 ? (
              <p>No published evidence yet</p>
            ) : (
              <ul className="space-y-2">
                {detail.data.evidence.map((evidence) => (
                  <li key={evidence.backtest_id}>
                    <Link className="underline" href={`/backtests/${evidence.backtest_id}`}>
                      {evidence.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
