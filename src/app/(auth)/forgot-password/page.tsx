"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicRequest } from "@/lib/api/client";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await publicRequest("/api/users/reset_password/", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    } catch {
      /* Neutral response prevents account enumeration. */
    }
    setSent(true);
    setLoading(false);
  }
  if (sent)
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          If an account exists for this address, we sent a password reset link.
        </p>
        <Link className="text-sm underline" href="/login">
          Back to sign in
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">Reset your password</h1>
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
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </Button>
      <Link className="block text-sm underline" href="/login">
        Back to sign in
      </Link>
    </form>
  );
}
