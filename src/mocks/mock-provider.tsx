"use client";

import { useEffect, useState } from "react";

export function MockProvider({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
  const [ready, setReady] = useState(!enabled);
  useEffect(() => {
    if (!enabled) return;
    import("@/mocks/browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "warn" }).then(() => setReady(true)),
    );
  }, [enabled]);
  return ready ? <>{children}</> : null;
}
