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
  KillSwitch,
  ManualOrder,
  ModifyOrder,
  SystemCommand,
  SystemUpdate,
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
    { onSuccess: () => invalidateLifecycle(client, id) },
  );
}

async function invalidateLifecycle(client: ReturnType<typeof useQueryClient>, id: number) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["systems"] }),
    client.invalidateQueries({ queryKey: ["portfolio"] }),
    client.invalidateQueries({ queryKey: queryKeys.system.detail(id) }),
  ]);
}

function useRiskInvalidation() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.risk() }),
      client.invalidateQueries({ queryKey: ["systems"] }),
      client.invalidateQueries({ queryKey: ["system"] }),
      client.invalidateQueries({ queryKey: ["portfolio"] }),
      client.invalidateQueries({ queryKey: queryKeys.accounts() }),
      client.invalidateQueries({ queryKey: ["account"] }),
    ]);
  };
}

export function useStopSystem(id: number) {
  const client = useQueryClient();
  return useIdempotentMutation<TradingSystem, { policy: TradingSystem["stop_policy"] }>(
    (body, idempotencyKey) =>
      apiRequest<TradingSystem>("POST", `/api/engine/v1/systems/${id}/stop/`, {
        body,
        idempotencyKey,
      }),
    { onSuccess: () => invalidateLifecycle(client, id) },
  );
}

export function useAckSystem(id: number) {
  const client = useQueryClient();
  return useIdempotentMutation<TradingSystem, { note: string }>(
    (body, idempotencyKey) =>
      apiRequest<TradingSystem>("POST", `/api/engine/v1/systems/${id}/ack/`, {
        body,
        idempotencyKey,
      }),
    { onSuccess: () => invalidateLifecycle(client, id) },
  );
}

export function useSetKillSwitch() {
  const invalidate = useRiskInvalidation();
  return useIdempotentMutation<
    KillSwitch,
    { scope: "tenant" | "account"; target?: number; active: boolean; reason: string }
  >(
    (body, idempotencyKey) =>
      apiRequest<KillSwitch>("POST", "/api/engine/v1/kill-switches/", {
        body,
        idempotencyKey,
      }),
    { onSuccess: invalidate },
  );
}

export function useSetGlobalKillSwitch() {
  const invalidate = useRiskInvalidation();
  return useMutation<KillSwitch, ApiError, { active: boolean; reason: string }>({
    mutationFn: (body) => api.post<KillSwitch>("/api/engine/v1/kill-switches/global/", body),
    onSuccess: invalidate,
  });
}

export function useCancelOrder(systemId: number, orderId: number) {
  return useIdempotentMutation<SystemCommand, void>((_, idempotencyKey) =>
    apiRequest("DELETE", `/api/engine/v1/systems/${systemId}/orders/${orderId}/`, {
      idempotencyKey,
    }),
  );
}

export function useModifyOrder(systemId: number, orderId: number) {
  return useIdempotentMutation<SystemCommand, ModifyOrder>((body, idempotencyKey) =>
    apiRequest("PATCH", `/api/engine/v1/systems/${systemId}/orders/${orderId}/`, {
      body,
      idempotencyKey,
    }),
  );
}

export function useNewOrder(systemId: number) {
  return useIdempotentMutation<SystemCommand, ManualOrder>((body, idempotencyKey) =>
    apiRequest("POST", `/api/engine/v1/systems/${systemId}/orders/`, { body, idempotencyKey }),
  );
}

export function useClosePosition(systemId: number) {
  return useIdempotentMutation<SystemCommand, void>((_, idempotencyKey) =>
    apiRequest("POST", `/api/engine/v1/systems/${systemId}/close-position/`, {
      body: {},
      idempotencyKey,
    }),
  );
}

export function useUpdateSystem(id: number) {
  const client = useQueryClient();
  return useMutation<TradingSystem, ApiError, SystemUpdate>({
    mutationFn: (body) => api.patch<TradingSystem>(`/api/engine/v1/systems/${id}/`, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["system", id] }),
  });
}
