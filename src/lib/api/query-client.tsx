"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api/client";

function shouldRetry(failures: number, error: unknown): boolean {
  if (failures >= 2) return false;
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: shouldRetry } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
