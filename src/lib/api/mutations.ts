"use client";

import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { useRef } from "react";
import { api, apiRequest, ApiError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import type {
  Account,
  BacktestJob,
  CreateBacktestBody,
  SystemCreate,
  TradingSystem,
} from "@/lib/api/types";

export type IntentKeyState = { key: string };
export type IntentKeyEvent = "success" | "reset" | "retry";
export function createIntentKey(): IntentKeyState {
  return { key: crypto.randomUUID() };
}

type AccountUpdate = {
  label?: string;
  daily_loss_limit?: string | null;
  max_drawdown_pct?: number | null;
  breaker_policy?: "cancel_orders" | "flatten";
};

function useAccountInvalidation() {
  const client = useQueryClient();
  return async (id: number) => {
    await client.invalidateQueries({ queryKey: queryKeys.accounts() });
    await client.invalidateQueries({ queryKey: queryKeys.account(id) });
  };
}

export function useUpdateAccount(id: number) {
  const invalidate = useAccountInvalidation();
  return useMutation<Account, ApiError, AccountUpdate>({
    mutationFn: (body) => api.patch<Account>(`/api/engine/v1/accounts/${id}/`, body),
    onSuccess: () => invalidate(id),
  });
}

export function useVerifyAccount(id: number) {
  const invalidate = useAccountInvalidation();
  return useMutation<Account, ApiError, void>({
    mutationFn: () => api.post<Account>(`/api/engine/v1/accounts/${id}/verify/`),
    onSuccess: () => invalidate(id),
  });
}

export function useDeleteAccount(id: number) {
  const invalidate = useAccountInvalidation();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api.del<void>(`/api/engine/v1/accounts/${id}/`),
    onSuccess: () => invalidate(id),
  });
}
export function nextIntentKey(state: IntentKeyState, event: IntentKeyEvent): IntentKeyState {
  return event === "success" || event === "reset" ? createIntentKey() : state;
}

export function useIdempotentMutation<TData, TVars>(
  fn: (vars: TVars, idempotencyKey: string) => Promise<TData>,
  options?: UseMutationOptions<TData, ApiError, TVars>,
) {
  const key = useRef(createIntentKey());
  const mutation = useMutation<TData, ApiError, TVars>({
    ...options,
    mutationFn: (variables) => fn(variables, key.current.key),
    onSuccess: async (data, variables, onMutateResult, context) => {
      key.current = nextIntentKey(key.current, "success");
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
  return {
    ...mutation,
    reset: () => {
      key.current = nextIntentKey(key.current, "reset");
      mutation.reset();
    },
  };
}

export function useCreateBacktest() {
  const client = useQueryClient();
  return useIdempotentMutation<BacktestJob, CreateBacktestBody>(
    (body, idempotencyKey) =>
      apiRequest<BacktestJob>("POST", "/api/engine/v1/backtests/", { body, idempotencyKey }),
    {
      onSuccess: () => client.invalidateQueries({ queryKey: ["backtests"] }),
    },
  );
}

export function useCancelBacktest(id: number) {
  const client = useQueryClient();
  return useIdempotentMutation<BacktestJob, void>(
    (_, idempotencyKey) =>
      apiRequest<BacktestJob>("POST", `/api/engine/v1/backtests/${id}/cancel/`, {
        idempotencyKey,
      }),
    {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: queryKeys.backtest(id) });
        void client.invalidateQueries({ queryKey: ["backtests"] });
      },
    },
  );
}

export function useCreateSystem() {
  const client = useQueryClient();
  return useIdempotentMutation<TradingSystem, SystemCreate>(
    (body, idempotencyKey) =>
      apiRequest<TradingSystem>("POST", "/api/engine/v1/systems/", { body, idempotencyKey }),
    {
      onSuccess: () => client.invalidateQueries({ queryKey: ["systems"] }),
    },
  );
}

export function useStartSystem(id: number) {
  const client = useQueryClient();
  return useIdempotentMutation<TradingSystem, void>(
    (_, idempotencyKey) =>
      apiRequest<TradingSystem>("POST", `/api/engine/v1/systems/${id}/start/`, {
        idempotencyKey,
      }),
    {
      onSuccess: () => client.invalidateQueries({ queryKey: ["systems"] }),
    },
  );
}
