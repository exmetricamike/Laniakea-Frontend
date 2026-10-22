import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { Suspense } from "react";
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </Suspense>
  );
}
