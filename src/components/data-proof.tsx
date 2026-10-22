"use client";

import { ApiError } from "@/lib/api/client";

export function DataProof({
  loading,
  isLoading,
  error,
  children,
  retry,
}: {
  loading?: boolean;
  isLoading?: boolean;
  error: unknown;
  children: React.ReactNode;
  retry?: () => void | Promise<unknown>;
}) {
  if (loading ?? isLoading) return <p aria-label="Loading data">Loading…</p>;
  if (error) {
    const message = error instanceof ApiError ? error.message : "Unable to load data";
    return (
      <div role="alert">
        <p>{message}</p>
        <button onClick={() => retry?.()}>Retry</button>
      </div>
    );
  }
  return <p>{children}</p>;
}
