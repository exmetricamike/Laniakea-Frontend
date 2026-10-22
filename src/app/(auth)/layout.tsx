export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-xl border bg-[var(--card)] p-8 shadow-sm">
        <div className="mb-7 flex items-center gap-2">
          <span aria-hidden className="size-5 rounded bg-[var(--primary)]" />
          <span className="font-bold tracking-tight">LANIAKEA</span>
        </div>
        {children}
      </section>
    </main>
  );
}
