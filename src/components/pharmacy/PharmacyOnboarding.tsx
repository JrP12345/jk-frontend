"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Select } from "@/components/ui";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { readPharmacyTrials, startPharmacySetup, verifyPharmacySetup, resendPharmacySetup, completePharmacySetup, verifyPharmacySetupMfa, pharmacySetupStatus,
  parseStoredPharmacySetup, pharmacySetupError, type PharmacySetupAuth, type PharmacySetupProof, type PharmacyTrialOption } from "@/lib/pharmacyOnboarding";

export function PharmacyOnboarding() {
  const user = useAuthStore(state => state.user);
  return <SetupSession key={authScopeKey(user)} />;
}
function SetupSession() {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), router = useRouter();
  const storageKey = `ekavyu:pharmacy-onboarding:${referenceOwnerKey(user)}`;
  const [proof, setProof] = useState<PharmacySetupProof | null>(null), [phase, setPhase] = useState<"details" | "verify" | "ready" | "mfa">("details");
  const [options, setOptions] = useState<PharmacyTrialOption[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [resuming, setResuming] = useState(true), [storageError, setStorageError] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [planId, setPlanId] = useState(""), [ownerName, setOwnerName] = useState(user?.name || ""), [email, setEmail] = useState(user?.email || ""), [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState(""), [city, setCity] = useState(""), [address, setAddress] = useState(""), [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(""), [mfaToken, setMfaToken] = useState("");
  const alive = useRef(true), lock = useRef(false);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    readPharmacyTrials(controller.signal).then(rows => { if (!controller.signal.aborted) { setOptions(rows); setPlanId(rows[0]?.id || ""); } }).catch(failure => { if (!controller.signal.aborted) setError(pharmacySetupError(failure)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function resume() {
      let saved: PharmacySetupProof | null;
      try { saved = parseStoredPharmacySetup(sessionStorage.getItem(storageKey)); }
      catch (failure) { if (!cancelled) { setStorageError(true); setError(pharmacySetupError(failure)); setResuming(false); } return; }
      if (saved && !cancelled) {
        setProof(saved); setPhase("verify");
        try { const status = await pharmacySetupStatus(saved); if (!cancelled) setPhase(status.state === "pending" ? "verify" : "ready"); }
        catch (failure) { if (!cancelled) setError(pharmacySetupError(failure)); }
      }
      if (!cancelled) setResuming(false);
    }
    void resume();
    return () => { cancelled = true; };
  }, [storageKey]);
  async function work(callback: () => Promise<void>) {
    if (lock.current || resuming || !current()) return; lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await callback(); } catch (failure) { if (current()) setError(pharmacySetupError(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function signIn(result: PharmacySetupAuth) {
    if (!current()) return;
    if (result.twoFactorRequired) { setMfaToken(result.twoFactorToken!); setPhase("mfa"); setOtp(""); return; }
    const expected = result.user!;
    await useAuthStore.getState().checkAuth();
    const active = useAuthStore.getState().user;
    // checkAuth intentionally changes the scope; only its verified expected owner/workspace may finish this transition.
    if (active?.id !== expected.id || active.organization_id !== expected.organization_id || active.workspaceProfile !== "pharmacy") throw new Error("Sign in to the recorded pharmacy workspace to continue");
    sessionStorage.removeItem(storageKey); router.replace("/dashboard");
  }
  const selected = options.find(option => option.id === planId);
  function fresh() { if (busy || resuming) return; try { sessionStorage.removeItem(storageKey); } catch { setError("Allow session storage to keep a recoverable setup reference"); return; } setStorageError(false); setProof(null); setPhase("details"); setPassword(""); setOtp(""); setMfaToken(""); setError(""); setNotice("Review the current offer and request a fresh email code. A completed business is resumed through sign-in."); }
  return <main className="min-h-dvh bg-background px-4 py-8 sm:py-12"><section aria-label="Independent pharmacy signup" className="mx-auto max-w-xl space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-8">
    <div><Link href="/" className="font-semibold text-accent">Ekavyu</Link><h1 className="mt-4 text-2xl font-semibold">Start your pharmacy workspace</h1><p className="mt-2 text-sm text-text-secondary">Verify your business email, create one pharmacy branch, and secure staff access with an authenticator. Your existing account and patient records are retained.</p></div>
    {error && <Alert variant="error" title="Setup needs attention">{error}</Alert>}{notice && <Alert variant="info" title="Business setup">{notice}</Alert>}
    {resuming && <p role="status">Checking your saved setup...</p>}
    {storageError && <Button variant="outline" onClick={fresh}>Begin new verification</Button>}
    {user?.role === "root" ? <p>Use platform organization provisioning for this account. <Link href="/dashboard/organizations">Open organizations</Link></p> : <>
      {phase === "details" && <form aria-label="Pharmacy business details" className="space-y-4" onSubmit={event => { event.preventDefault(); if (!selected) return; void work(async () => {
        const result = await startPharmacySetup({ ownerName: ownerName.trim(), email: email.trim().toLowerCase(), ...(password ? { password } : {}), businessName: businessName.trim(), city: city.trim(), address: address.trim(), ...(phone.trim() ? { businessPhone: phone.trim() } : {}), planId: selected.id, planFingerprint: selected.fingerprint });
        if (!current()) return; sessionStorage.setItem(storageKey, JSON.stringify(result.proof)); setProof(result.proof); setPassword(""); setPhase("verify"); setNotice(result.deliveryAvailable ? "Check your email for the six-digit setup code. No business access is granted until verification." : "Email delivery is unavailable. Keep this reference and resend later.");
      }); }}>
        {loading && <p role="status">Loading published pharmacy trials...</p>}
        {!loading && !options.length && <Alert variant="info" title="Signup is not available">No reviewed pharmacy trial is currently published. Existing accounts can still sign in.</Alert>}
        <fieldset disabled={busy || resuming || loading || !options.length || storageError} className="min-w-0 space-y-4">
          <Select label="Published pharmacy trial *" value={planId} onChange={event => setPlanId(event.target.value)} options={options.map(option => ({ value: option.id, label: `${option.name} / ${option.trialDays} days` }))} />
          {selected && <p className="text-sm">{selected.trialDays}-day trial for one pharmacy branch. Current monthly total: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(selected.monthlyTotalPaise / 100)}. Configured staff limit: {selected.maxStaff}. Paid activation is a separate reviewed checkout.</p>}
          <Input label="Owner name *" value={ownerName} maxLength={120} minLength={2} required onChange={event => setOwnerName(event.target.value)} />
          <Input label="Business account email *" type="email" value={email} maxLength={254} required readOnly={Boolean(user?.email)} onChange={event => setEmail(event.target.value)} />
          {!user && <Input label="Password for a new account" type="password" autoComplete="new-password" value={password} maxLength={72} onChange={event => setPassword(event.target.value)} hint="Choose a strong password for a new identity. Existing account credentials are kept." />}
          <Input label="Business name *" value={businessName} minLength={2} maxLength={200} required onChange={event => setBusinessName(event.target.value)} />
          <Input label="City *" value={city} minLength={2} maxLength={100} required onChange={event => setCity(event.target.value)} />
          <Input label="Branch address *" value={address} minLength={5} maxLength={500} required onChange={event => setAddress(event.target.value)} />
          <Input label="Business phone" type="tel" value={phone} maxLength={30} onChange={event => setPhone(event.target.value)} />
          <p className="text-sm text-text-secondary">This setup is for India/INR businesses. Review actual issuer and operating licence details before enabling sales.</p>
          <Button type="submit" loading={busy} disabled={!selected}>Send business verification code</Button>
        </fieldset>
      </form>}
      {proof && phase === "verify" && <form className="space-y-3" aria-label="Verify business account email" onSubmit={event => { event.preventDefault(); void work(async () => { await verifyPharmacySetup(proof, otp); if (current()) { setPhase("ready"); setOtp(""); setNotice("Email verified. Create the reviewed pharmacy workspace to continue."); } }); }}>
        <Input label="Business email verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} value={otp} onChange={event => setOtp(event.target.value)} />
        <div className="flex flex-wrap gap-2"><Button type="submit" loading={busy}>Verify business email</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void work(async () => { const delivered = await resendPharmacySetup(proof); if (current()) setNotice(delivered ? "A new code was sent to your business email." : "Email delivery is unavailable. Retry later."); })}>Resend setup code</Button></div>
      </form>}
      {proof && phase === "ready" && <div className="space-y-3"><p>Email verification is recorded. Completion creates this one business or resumes its recorded result; it does not start another trial.</p><Button loading={busy} onClick={() => void work(async () => signIn(await completePharmacySetup(proof)))}>Create or resume pharmacy workspace</Button></div>}
      {phase === "mfa" && <form aria-label="Verify account authenticator" className="space-y-3" onSubmit={event => { event.preventDefault(); void work(async () => signIn(await verifyPharmacySetupMfa(mfaToken, otp))); }}>
        <p>Enter your existing account authenticator code to open the pharmacy workspace.</p><Input label="Authenticator code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy} value={otp} onChange={event => setOtp(event.target.value)} /><Button type="submit" loading={busy}>Verify authenticator and continue</Button>
      </form>}
      {proof && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void work(async () => { const status = await pharmacySetupStatus(proof); if (current()) { setPhase(status.state === "pending" ? "verify" : "ready"); setNotice(status.state === "provisioned" ? "The business is already recorded. Resume secure sign-in." : "Setup status refreshed."); } })}>Check saved setup</Button><Button size="sm" variant="ghost" disabled={busy} onClick={fresh}>Begin new verification</Button></div>}
    </>}
    <p className="text-sm"><Link href="/login" className="text-accent">Already have an account? Sign in</Link></p>
  </section></main>;
}
