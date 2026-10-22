"use client";

import { MockProvider } from "@/mocks/mock-provider";
import { QueryProvider } from "@/lib/api/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MockProvider>
      <QueryProvider>{children}</QueryProvider>
    </MockProvider>
  );
}
