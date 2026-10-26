"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { strategyApiPath } from "@/lib/api/strategy";
import type {
  Account,
  AccountBalance,
  Backtest,
  BacktestEquity,
  BacktestJob,
  BacktestOrder,
  BacktestTrade,
  ChartPayload,
  Instrument,
  KillSwitch,
  PaginatedList,
  PortfolioSummary,
  PortfolioEquity,
  PortfolioOrder,
  PortfolioPosition,
  PortfolioTrade,
  StrategySummary,
  StrategyVersionDetail,
  StrategyVersionSummary,
  TradingSystem,
  SystemCommand,
  SystemEquity,
  SystemEventRow,
  SystemFill,
  SystemOrder,
  SystemPerformance,
  SystemPosition,
  SystemTrade,
  Venue,
} from "@/lib/api/types";

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function list<T>(value: T[] | PaginatedList<T>): PaginatedList<T> {
  return Array.isArray(value) ? { results: value, next: null, count: value.length } : value;
}

export function usePortfolioSummary(mode: string, period: string, includeStopped: boolean) {
  return useQuery({
    queryKey: queryKeys.portfolio.summary(mode, period, includeStopped),
    queryFn: () =>
      api.get<PortfolioSummary>(
        `/api/engine/v1/portfolio/summary/${queryString({
          mode,
          period,
          include_stopped: includeStopped ? "true" : "false",
        })}`,
      ),
    refetchInterval: 10_000,
  });
}
export function usePortfolioEquity(mode: string, from: string | undefined) {
  return useQuery({
    queryKey: queryKeys.portfolio.equity(mode, from ?? "all"),
    queryFn: () =>
      api.get<PortfolioEquity>(
        `/api/engine/v1/portfolio/equity/${queryString({ mode, from, interval: "1h" })}`,
      ),
    refetchInterval: 60_000,
  });
}
export type PortfolioTradeFilters = {
  mode: "paper" | "live";
  system?: string;
  side?: string;
  origin?: string;
  status?: "open" | "closed" | "all";
};
export function usePortfolioTradesInfinite(filters: PortfolioTradeFilters, refreshKey = 0) {
  return useInfiniteQuery({
    queryKey: queryKeys.portfolio.trades({ ...filters, refreshKey }),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      api.get<PaginatedList<PortfolioTrade>>(
        `/api/engine/v1/portfolio/trades/${queryString({ ...filters, cursor: String(pageParam) })}`,
      ),
    getNextPageParam: (page) =>
      page.next ? (new URL(page.next).searchParams.get("cursor") ?? undefined) : undefined,
    refetchInterval: (query) => (query.state.data?.pages.length === 1 ? 10_000 : false),
  });
}
export function usePortfolioOrders(mode: "paper" | "live") {
  return useQuery({
    queryKey: queryKeys.portfolio.orders(mode),
    queryFn: () =>
      api.get<PaginatedList<PortfolioOrder>>(
        `/api/engine/v1/portfolio/orders/${queryString({ mode, status: "open" })}`,
      ),
    refetchInterval: 10_000,
  });
}
export function usePortfolioPositions(mode: "paper" | "live") {
  return useQuery({
    queryKey: queryKeys.portfolio.positions(mode),
    queryFn: () =>
      api.get<PaginatedList<PortfolioPosition>>(
        `/api/engine/v1/portfolio/positions/${queryString({ mode })}`,
      ),
  });
}
export type SystemsFilters = {
  state?: string;
  mode?: string;
  account?: number;
  strategy?: string;
};
export function useSystems(filters: SystemsFilters) {
  return useQuery({
    queryKey: queryKeys.systems(filters),
    queryFn: () =>
      api.get<PaginatedList<TradingSystem>>(`/api/engine/v1/systems/${queryString(filters)}`),
  });
}
export function useSystemsInfinite(filters: SystemsFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.systems(filters),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      api.get<PaginatedList<TradingSystem>>(
        `/api/engine/v1/systems/${queryString({ ...filters, cursor: pageParam })}`,
      ),
    getNextPageParam: (page) => {
      if (!page.next) return undefined;
      return new URL(page.next).searchParams.get("cursor") ?? undefined;
    },
    refetchInterval: (query) => {
      const rows = query.state.data?.pages.flatMap((page) => page.results) ?? [];
      return rows.some((row) => row.desired_state !== row.state) ? 3_000 : false;
    },
  });
}
export function useSystem(id: number, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.system.detail(id),
    queryFn: () => api.get<TradingSystem>(`/api/engine/v1/systems/${id}/`),
    enabled: id > 0,
    refetchInterval: (query) =>
      options.poll && ["running", "starting", "stopping"].includes(query.state.data?.state ?? "")
        ? 5_000
        : false,
  });
}
type SystemQueryOptions = { enabled?: boolean; poll?: boolean };
function useSystemList<T>(
  id: number,
  resource: string,
  filters: Record<string, string>,
  key: readonly unknown[],
  options: SystemQueryOptions,
) {
  return useInfiniteQuery({
    queryKey: key,
    initialPageParam: "",
    enabled: options.enabled ?? true,
    queryFn: ({ pageParam }) =>
      api.get<PaginatedList<T>>(
        `/api/engine/v1/systems/${id}/${resource}/${queryString({ ...filters, cursor: String(pageParam) })}`,
      ),
    getNextPageParam: (page) =>
      page.next ? (new URL(page.next).searchParams.get("cursor") ?? undefined) : undefined,
    refetchInterval: options.poll ? 5_000 : false,
  });
}
export function useSystemOrders(
  id: number,
  filters: { status: "open" | "all"; origin?: string },
  options: SystemQueryOptions = {},
) {
  return useSystemList<SystemOrder>(
    id,
    "orders",
    filters,
    queryKeys.system.orders(id, filters),
    options,
  );
}
export function useSystemTrades(
  id: number,
  filters: { status: "open" | "closed" | "all"; origin?: string },
  options: SystemQueryOptions = {},
) {
  return useSystemList<SystemTrade>(
    id,
    "trades",
    filters,
    queryKeys.system.trades(id, filters),
    options,
  );
}
export function useSystemFills(
  id: number,
  filters: { origin?: string },
  options: SystemQueryOptions = {},
) {
  return useSystemList<SystemFill>(
    id,
    "fills",
    filters,
    queryKeys.system.fills(id, filters),
    options,
  );
}
export function useSystemEvents(
  id: number,
  filters: { severity?: string; kind?: string },
  options: SystemQueryOptions = {},
) {
  return useSystemList<SystemEventRow>(
    id,
    "events",
    filters,
    queryKeys.system.events(id, filters),
    options,
  );
}
export function useSystemCommands(
  id: number,
  filters: { status?: string },
  options: SystemQueryOptions = {},
) {
  return useSystemList<SystemCommand>(
    id,
    "commands",
    filters,
    queryKeys.system.commands(id, filters),
    options,
  );
}
export function useSystemPosition(id: number, options: SystemQueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.system.position(id),
    queryFn: () => api.get<SystemPosition>(`/api/engine/v1/systems/${id}/position/`),
    enabled: options.enabled ?? true,
    refetchInterval: options.poll ? 5_000 : false,
  });
}
export function useSystemEquity(id: number, options: SystemQueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.system.equity(id, "default"),
    queryFn: () => api.get<SystemEquity>(`/api/engine/v1/systems/${id}/equity/`),
    enabled: options.enabled ?? true,
    refetchInterval: options.poll ? 5_000 : false,
  });
}
export function useSystemChart(id: number, options: SystemQueryOptions = {}) {
  return useQuery({
    queryKey: queryKeys.system.chart(id, "default"),
    queryFn: () => api.get<ChartPayload>(`/api/engine/v1/systems/${id}/chart/`),
    enabled: options.enabled ?? true,
    refetchInterval: options.poll ? 5_000 : false,
  });
}
export function useSystemPerformance(
  id: number,
  from: string | undefined,
  options: SystemQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.system.performance(id, from ?? "all"),
    queryFn: () =>
      api.get<SystemPerformance>(
        `/api/engine/v1/systems/${id}/performance/${queryString({ from })}`,
      ),
    enabled: options.enabled ?? true,
    refetchInterval: options.poll ? 5_000 : false,
  });
}
export function useStrategies() {
  return useQuery({
    queryKey: queryKeys.strategies(),
    retry: false,
    queryFn: async () =>
      list(
        await api.get<StrategySummary[] | PaginatedList<StrategySummary>>(
          "/api/engine/v1/strategies/",
        ),
      ),
  });
}
export function useStrategy(key: string) {
  return useQuery({
    queryKey: queryKeys.strategy(key),
    retry: false,
    queryFn: () => api.get<StrategySummary>(strategyApiPath(key)),
  });
}
export function useStrategyVersions(key: string) {
  return useQuery({
    queryKey: queryKeys.strategyVersions(key),
    retry: false,
    queryFn: async () =>
      list(
        await api.get<StrategyVersionSummary[] | PaginatedList<StrategyVersionSummary>>(
          `${strategyApiPath(key)}versions/`,
        ),
      ),
  });
}
export function useStrategyVersion(key: string, version: string | null) {
  return useQuery({
    queryKey: queryKeys.strategyVersion(key, version ?? ""),
    retry: false,
    queryFn: () => api.get<StrategyVersionDetail>(`${strategyApiPath(key)}versions/${version}/`),
    enabled: version !== null,
  });
}
export function useBacktestsInfinite(filters: Record<string, string>) {
  return useInfiniteQuery({
    queryKey: queryKeys.backtests(filters),
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      api.get<PaginatedList<Backtest>>(
        `/api/engine/v1/backtests/${queryString({ ...filters, cursor: pageParam })}`,
      ),
    getNextPageParam: (page) => {
      if (!page.next) return undefined;
      return new URL(page.next).searchParams.get("cursor") ?? undefined;
    },
  });
}
export function useBacktests(filters: Record<string, string>) {
  return useBacktestsInfinite(filters);
}
export function useBacktest(id: number, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.backtest(id),
    queryFn: () => api.get<BacktestJob>(`/api/engine/v1/backtests/${id}/`),
    enabled: id > 0,
    refetchInterval: (query) =>
      options.poll &&
      (query.state.data?.status === "queued" || query.state.data?.status === "running")
        ? 2_000
        : false,
  });
}
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: async () =>
      list(await api.get<Account[] | PaginatedList<Account>>("/api/engine/v1/accounts/")),
  });
}
export function useAccount(id: number, options: { pollWhilePending?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.account(id),
    queryFn: () => api.get<Account>(`/api/engine/v1/accounts/${id}/`),
    refetchInterval: (query) =>
      options.pollWhilePending && query.state.data?.verification_pending ? 2_000 : false,
  });
}
export function useAccountBalance(id: number, options: { enabled?: boolean } = {}) {
  const startedAt = useRef<number | null>(null);
  return useQuery({
    queryKey: queryKeys.accountBalance(id),
    queryFn: () => api.get<AccountBalance>(`/api/engine/v1/accounts/${id}/balance/`),
    enabled: options.enabled ?? true,
    refetchInterval: (query) => {
      if (!query.state.data?.pending) return false;
      const started = startedAt.current ?? Date.now();
      startedAt.current = started;
      return Date.now() - started < 30_000 ? 2_000 : false;
    },
  });
}
export function useVenues() {
  return useQuery({
    queryKey: queryKeys.venues(),
    queryFn: async () =>
      list(await api.get<Venue[] | PaginatedList<Venue>>("/api/engine/v1/venues/")),
  });
}
export function useInstruments(filters: {
  venue?: string;
  kind?: string;
  search?: string;
  page_size?: number;
}) {
  return useQuery({
    queryKey: queryKeys.instruments(filters),
    queryFn: () =>
      api.get<PaginatedList<Instrument>>(`/api/engine/v1/instruments/${queryString(filters)}`),
  });
}
export function useBacktestEquity(id: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.backtestEquity(id),
    queryFn: () => api.get<BacktestEquity>(`/api/engine/v1/backtests/${id}/equity/`),
    enabled,
  });
}
export function useBacktestTrades(id: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.backtestTrades(id),
    queryFn: () => api.get<PaginatedList<BacktestTrade>>(`/api/engine/v1/backtests/${id}/trades/`),
    enabled,
  });
}
export function useBacktestOrders(id: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.backtestOrders(id),
    queryFn: () => api.get<PaginatedList<BacktestOrder>>(`/api/engine/v1/backtests/${id}/orders/`),
    enabled,
  });
}
export function useBacktestChart(id: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.backtestChart(id),
    queryFn: () => api.get<ChartPayload>(`/api/engine/v1/backtests/${id}/chart/`),
    enabled,
  });
}
export function useKillSwitches() {
  return useQuery({
    queryKey: queryKeys.risk(),
    queryFn: async () =>
      list(
        await api.get<KillSwitch[] | PaginatedList<KillSwitch>>("/api/engine/v1/kill-switches/"),
      ),
  });
}
export function useOperatorSystems() {
  return useQuery({
    queryKey: queryKeys.operator.systems(),
    queryFn: () => api.get<PaginatedList<TradingSystem>>("/api/engine/v1/operator/systems/"),
  });
}
export type CurrentUser = { email: string; is_staff: boolean };
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.get<CurrentUser>("/api/users/me/"),
  });
}
