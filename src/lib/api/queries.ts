"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { strategyApiPath } from "@/lib/api/strategy";
import type {
  Account,
  AccountBalance,
  Backtest,
  Instrument,
  KillSwitch,
  PaginatedList,
  PortfolioSummary,
  Strategy,
  TradingSystem,
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

export function usePortfolioSummary(mode: string, period: string) {
  return useQuery({
    queryKey: queryKeys.portfolio.summary(mode, period),
    queryFn: () =>
      api.get<PortfolioSummary>(
        `/api/engine/v1/portfolio/summary/${queryString({ mode, period })}`,
      ),
  });
}
export function useSystems(filters: { mode?: string }) {
  return useQuery({
    queryKey: queryKeys.systems(filters),
    queryFn: () =>
      api.get<PaginatedList<TradingSystem>>(`/api/engine/v1/systems/${queryString(filters)}`),
  });
}
export function useSystem(id: number) {
  return useQuery({
    queryKey: queryKeys.system.detail(id),
    queryFn: () => api.get<TradingSystem>(`/api/engine/v1/systems/${id}/`),
  });
}
export function useStrategies() {
  return useQuery({
    queryKey: queryKeys.strategies(),
    queryFn: async () =>
      list(await api.get<Strategy[] | PaginatedList<Strategy>>("/api/engine/v1/strategies/")),
  });
}
export function useStrategy(key: string) {
  return useQuery({
    queryKey: queryKeys.strategy(key),
    queryFn: () => api.get<Strategy>(strategyApiPath(key)),
  });
}
export function useBacktests(filters: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.backtests(filters),
    queryFn: () =>
      api.get<PaginatedList<Backtest>>(`/api/engine/v1/backtests/${queryString(filters)}`),
  });
}
export function useBacktest(id: number) {
  return useQuery({
    queryKey: queryKeys.backtest(id),
    queryFn: () => api.get<Backtest>(`/api/engine/v1/backtests/${id}/`),
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
export function useInstruments(filters: { venue?: string; page_size?: number }) {
  return useQuery({
    queryKey: queryKeys.instruments(filters),
    queryFn: () =>
      api.get<PaginatedList<Instrument>>(`/api/engine/v1/instruments/${queryString(filters)}`),
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
