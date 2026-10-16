"use client";

import { useState } from "react";
import { Alert, Button, Card, Input } from "@/components/ui";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function AuthenticatorEnrollment({ required = false }: { required?: boolean }) {
  const { checkAuth, logout } = useAuthStore();
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    setBusy(true); setError("");
    try { setSetup((await api.post("/onboarding/totp/setup")).data.data); }
    catch (failure: unknown) { setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "Authenticator setup could not start. Sign in again and retry."); }
    finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !/^\d{6}$/.test(token)) return;
    setBusy(true); setError("");
    try {
      await api.post("/onboarding/totp/verify", { token });
      setSetup(null); setToken("");
      await checkAuth();
    } catch (failure: unknown) { setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "The code could not be verified. Check your authenticator and retry."); }
    finally { setBusy(false); }
  };
  return <Card className="p-4 sm:p-6 space-y-4 max-w-lg w-full mx-auto">
    <div><h2 className="text-xl font-bold">{required ? "Secure your workspace" : "Authenticator verification"}</h2>
      <p className="text-sm text-text-secondary mt-2">{required ? "Set up an authenticator before accessing patient information." : "Add an authenticator code to protect staff sign-in."}</p></div>
    {error && <Alert variant="error">{error}</Alert>}
    {!setup ? <Button onClick={start} loading={busy} disabled={busy}>Set up authenticator</Button> : <form onSubmit={verify} className="space-y-4">
      <p className="text-sm">Scan this code in your authenticator app, or enter the setup key manually.</p>
      {/* The server creates this short-lived data URI; it is never persisted by the client. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qrCodeDataUrl} alt="Authenticator setup QR code" width={200} height={200} className="mx-auto" />
      <div><p className="text-xs text-text-muted">Setup key · keep private</p><code className="block break-all text-sm select-all mt-1">{setup.secret}</code></div>
      <Input label="6-digit authenticator code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={event => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
      <Button type="submit" disabled={busy || !/^\d{6}$/.test(token)} loading={busy} className="w-full">Verify and continue</Button>
    </form>}
    <p className="text-xs text-text-muted">Keep access to your authenticator. If you lose it, contact your administrator for identity-verified recovery. Password reset does not remove this protection.</p>
    {required && <Button variant="ghost" disabled={busy} onClick={() => void logout()}>Sign out and use another account</Button>}
  </Card>;
}
