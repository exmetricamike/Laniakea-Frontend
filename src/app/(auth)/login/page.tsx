"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, publicRequest } from "@/lib/api/client";
import { setTokens } from "@/lib/auth";
import { safeNext } from "@/lib/auth-redirect";
type AuthResponse = { access: string; refresh: string };
function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await publicRequest<AuthResponse>("/api/jwt/create/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(result.access, result.refresh);
      router.replace(safeNext(search.get("next")));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Login failed");
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoFocus
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm text-[var(--muted-foreground)]">
        <Link
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          href="/forgot-password"
        >
          Forgot password?
        </Link>
        <Link
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          href="/register"
        >
          Create account
        </Link>
      </div>
    </form>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
