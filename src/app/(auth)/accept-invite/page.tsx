"use client";

import { Suspense, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { userFacingError } from "@/lib/userFacingError";
import { Button, Input, EkavyuLogo, Alert, LoadingState } from "@/components/ui";

function AcceptInvitation() {
  const token = useSearchParams().get("token") || "";
  const router = useRouter();
  const login = useAuthStore(state => state.login);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !token) return;
    if (!name.trim()) { setError("Enter your full name."); return; }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setError("Use at least 8 characters, including uppercase and lowercase letters, a number and a special character.");
      return;
    }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/auth/accept-invitation", { token, name: name.trim(), password, phone: phone.trim() || undefined });
      const user = response.data?.data?.user;
      if (!user) throw new Error("The account response was incomplete.");
      login(user);
      router.replace("/dashboard");
    } catch (failure: unknown) {
      const message = (failure as { response?: { data?: { message?: string; error?: string } } }).response?.data;
      setError(userFacingError(message?.message || message?.error, "We could not accept this invitation. It may have expired or already been used. Ask your administrator for a new link."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-surface-alt px-4 py-12 flex items-center justify-center text-text">
      <div className="w-full max-w-md space-y-5">
        <EkavyuLogo size="md" />
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Accept your staff invitation</h1>
          {!token ? (
            <>
              <Alert variant="warning">This link is missing its invitation token. Open the complete link from your invitation email or ask your administrator for a new one.</Alert>
              <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">Go to sign in</Link>
            </>
          ) : (
            <form onSubmit={accept} className="space-y-4">
              <p className="text-sm text-text-secondary">Set up your account to join the organization that invited you. Your access is determined by the invitation.</p>
              {error && <Alert variant="error">{error}</Alert>}
              <fieldset disabled={busy} className="space-y-4">
                <Input label="Full name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required />
                <Input label="Phone (optional)" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} />
                <Input label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={8} hint="At least 8 characters, with uppercase and lowercase letters, a number and a special character." required />
                <Input label="Confirm password" type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" required />
              </fieldset>
              <Button type="submit" fullWidth loading={busy}>Accept invitation</Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AcceptInvitationPage() {
  return <Suspense fallback={<LoadingState label="Loading invitation" fullPage />}><AcceptInvitation /></Suspense>;
}
