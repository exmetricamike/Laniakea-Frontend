"use client";
import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, publicRequest } from "@/lib/api/client";
function Form() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await publicRequest("/api/users/reset_password_confirm/", {
        method: "POST",
        body: JSON.stringify({
          uid: params.get("uid") ?? "",
          token: params.get("token") ?? "",
          new_password: password,
          re_new_password: confirm,
        }),
      });
      setDone(true);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Reset link is invalid or expired");
      setLoading(false);
    }
  }
  if (done)
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Password updated</h1>
        <Link className="text-sm underline" href="/login">
          Sign in with your new password
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-xl font-semibold">Set a new password</h1>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoFocus
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  );
}
