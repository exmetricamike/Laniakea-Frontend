"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { getAccess } from "@/lib/auth";

const noSubscribe = () => () => {};

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  // Server snapshot is "unknown" (null) so server and hydrating client render the same tree;
  // React then re-renders with the client snapshot (localStorage) without a mismatch.
  const hasToken = useSyncExternalStore(
    noSubscribe,
    () => getAccess() !== null,
    () => null,
  );

  useEffect(() => {
    if (hasToken !== false) return;
    const query = search.toString();
    const next = query ? `${pathname}?${query}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [hasToken, pathname, router, search]);

  if (!hasToken) return null;
  return <>{children}</>;
}
