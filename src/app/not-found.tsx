import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-[var(--muted-foreground)]">The page you requested does not exist.</p>
        <Link className="underline" href="/portfolio">
          Go to portfolio
        </Link>
      </div>
    </main>
  );
}
