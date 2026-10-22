"use client";

import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { useRef } from "react";
import { ApiError } from "@/lib/api/client";

export type IntentKeyState = { key: string };
export type IntentKeyEvent = "success" | "reset" | "retry";
export function createIntentKey(): IntentKeyState {
  return { key: crypto.randomUUID() };
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
