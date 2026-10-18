"use client";
import { useState } from "react";
import api from "@/lib/api";
import { facilityTypeOptions } from "@/lib/facility";
import { Alert, Button, ImageUpload, Input, Modal, Select, Checkbox } from "@/components/ui";
import { saveWithBranding } from "@/services/organization.service";
import { COUNTRIES, countryOptions, type CountryCode } from "@/lib/countries";
import styles from "./OrganizationManagement.module.css";

export function CreateOrganization({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ org_name: "", city: "", countryCode: "IN", timezone: "Asia/Kolkata", plan: "starter", trial: "default", customDays: "", admin_name: "", admin_email: "", admin_password: "", location_name: "", facilityType: "clinic", sendWelcomeEmail: true });
  const [logo, setLogo] = useState<File | string | null>(null);
  const [cover, setCover] = useState<File | string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  function next() {
    if (!form.org_name.trim() || !form.city.trim() || /^[0-9+\s-]{6,}$/.test(form.city.trim())) { setError("Enter an organization name and a valid city."); return; }
    const days = form.trial === "custom" ? Number(form.customDays) : Number(form.trial);
    if (form.trial !== "default" && (!Number.isInteger(days) || days < 1 || days > 365)) { setError("Trial duration must be between 1 and 365 whole days."); return; }
    setError(""); setStep(2);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { next(); return; }
    setBusy(true); setError("");
    try {
      const response = await saveWithBranding([logo, cover], undefined, ([logo_url, image_url]) => api.post("/onboarding/organization", {
        org_name: form.org_name.trim(), city: form.city.trim(), countryCode: form.countryCode,
        currency: COUNTRIES[form.countryCode as CountryCode].currency, timezone: form.timezone,
        plan: form.plan, trialDays: form.trial === "default" ? undefined : Number(form.trial === "custom" ? form.customDays : form.trial),
        admin_name: form.admin_name.trim(), admin_email: form.admin_email.trim().toLowerCase(), admin_password: form.admin_password,
        location_name: form.location_name.trim() || undefined, facilityType: form.facilityType, sendWelcomeEmail: form.sendWelcomeEmail,
        logo_url: logo_url || undefined, image_url: image_url || undefined,
      }, { timeout: 60000 }));
      const id = response.data?.data?.organization?.id;
      if (!id) throw new Error("Organization creation response is incomplete. Refresh the list before retrying.");
      onCreated(id);
    } catch (err: unknown) { setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || (err as Error).message || "Could not create organization"); }
    finally { setBusy(false); }
  }
  return <Modal open={open} onClose={() => { if (!busy) onClose(); }} title="Add organization" size="lg" busy={busy} closeOnOverlay={!busy} description="Create the organization, primary location and administrator. Configure the rest after creation." footer={<div className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:items-center sm:justify-between"><Button variant="outline" disabled={busy} onClick={() => step === 2 ? setStep(1) : onClose()}>{step === 2 ? "Back" : "Cancel"}</Button><Button type="submit" form="create-organization-form" loading={busy} disabled={busy}>{step === 1 ? "Configure administrator" : "Create organization"}</Button></div>}>
    <ol className="mb-4 grid grid-cols-2 gap-2 text-sm" aria-label="Creation steps">{["Organization & tier", "Administrator"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${step === index + 1 ? "border-primary-500/30 bg-accent-subtle font-medium text-accent" : "border-border text-text-secondary"}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold" aria-hidden="true">{index + 1}</span><span className="min-w-0 [overflow-wrap:anywhere]">{label}</span></li>)}</ol>
    {error && <div className="mb-4"><Alert variant="error" title="Check organization setup">{error}</Alert></div>}
    <form id="create-organization-form" onSubmit={submit} className={`${styles.formContainer} space-y-4`} autoComplete="off">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        {step === 1 ? <>
          <Input label="Organization name" required value={form.org_name} onChange={(e) => change("org_name", e.target.value)} />
          <Select label="Primary location type" value={form.facilityType} options={[...facilityTypeOptions]} onChange={(e) => change("facilityType", e.target.value)} />
          <div className={styles.fieldGrid}><Input label="City" required value={form.city} onChange={(e) => change("city", e.target.value)} /><Select label="Country" value={form.countryCode} options={countryOptions} onChange={(e) => setForm({ ...form, countryCode: e.target.value, timezone: COUNTRIES[e.target.value as CountryCode].timezone })} /></div>
          <div className={styles.fieldGrid}>
          <Select label="Subscription tier" value={form.plan} options={[{ value: "starter", label: "Starter" }, { value: "professional", label: "Pro" }, { value: "enterprise", label: "Enterprise" }]} onChange={(e) => change("plan", e.target.value)} />
          <Select label="Free trial duration" value={form.trial} options={[{ value: "default", label: "Use plan default" }, { value: "7", label: "7 days" }, { value: "15", label: "15 days" }, { value: "30", label: "30 days" }, { value: "custom", label: "Custom duration" }]} onChange={(e) => change("trial", e.target.value)} />
          </div>
          {form.trial === "custom" && <Input label="Custom trial days" type="number" required min={1} max={365} step={1} value={form.customDays} onChange={(e) => change("customDays", e.target.value)} />}
          {form.plan === "enterprise" && form.trial === "default" && <p className="text-sm text-text-muted">Enterprise uses manual activation by default. Select days to start a trial.</p>}
          <details className="border-t border-border pt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-lg">Branding and location options</summary><div className="space-y-4 pt-3"><div className={styles.fieldGrid}><ImageUpload label="Organization logo" value={logo} onChange={setLogo} /><ImageUpload label="Cover photo" value={cover} onChange={setCover} /></div><Input label="Primary location name" hint="Uses the organization name when left blank." value={form.location_name} onChange={(e) => change("location_name", e.target.value)} /><Input label="Operating timezone" required value={form.timezone} onChange={(e) => change("timezone", e.target.value)} /></div></details>
        </> : <>
          <p className="rounded-xl bg-surface-alt p-3 text-sm leading-relaxed text-text-secondary [overflow-wrap:anywhere]"><strong className="text-text">{form.org_name}</strong> · {form.city} · {form.plan.toUpperCase()}</p>
          <Input label="Administrator name" required value={form.admin_name} onChange={(e) => change("admin_name", e.target.value)} />
          <Input label="Administrator email" required type="email" value={form.admin_email} onChange={(e) => change("admin_email", e.target.value)} />
          <Input label="Administrator password" required type="password" autoComplete="new-password" minLength={8} hint="Use uppercase, lowercase, a number and a symbol." value={form.admin_password} onChange={(e) => change("admin_password", e.target.value)} />
          <Checkbox checked={form.sendWelcomeEmail} onChange={(e) => setForm({ ...form, sendWelcomeEmail: e.target.checked })} label="Send a welcome email with the login link. Share the chosen password with the administrator separately." />
          <p className="text-sm text-text-muted">Default roles, modules, a primary location and the selected subscription are created automatically. The administrator configures MFA from their own account.</p>
        </>}
      </fieldset>
    </form>
  </Modal>;
}
