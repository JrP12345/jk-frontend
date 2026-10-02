"use client";
import { useState } from "react";
import api from "@/lib/api";
import { Alert, Button, ImageUpload, Input, Modal, Select } from "@/components/ui";
import { saveWithBranding } from "@/services/organization.service";

const countries = { IN: ["India", "INR", "Asia/Kolkata"], US: ["United States", "USD", "America/New_York"], CA: ["Canada", "CAD", "America/Toronto"], GB: ["United Kingdom", "GBP", "Europe/London"], AE: ["United Arab Emirates", "AED", "Asia/Dubai"] };
export function CreateOrganization({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ org_name: "", city: "", countryCode: "IN", timezone: "Asia/Kolkata", plan: "starter", trial: "default", customDays: "", admin_name: "", admin_email: "", admin_password: "", clinic_name: "", sendWelcomeEmail: true });
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
        currency: countries[form.countryCode as keyof typeof countries][1], timezone: form.timezone,
        plan: form.plan, trialDays: form.trial === "default" ? undefined : Number(form.trial === "custom" ? form.customDays : form.trial),
        admin_name: form.admin_name.trim(), admin_email: form.admin_email.trim().toLowerCase(), admin_password: form.admin_password,
        clinic_name: form.clinic_name.trim() || undefined, sendWelcomeEmail: form.sendWelcomeEmail,
        logo_url: logo_url || undefined, image_url: image_url || undefined,
      }, { timeout: 60000 }));
      const id = response.data?.data?.organization?.id;
      if (!id) throw new Error("Organization creation response is incomplete. Refresh the list before retrying.");
      onCreated(id);
    } catch (err: unknown) { setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || (err as Error).message || "Could not create organization"); }
    finally { setBusy(false); }
  }
  return <Modal open={open} onClose={() => { if (!busy) onClose(); }} title="Add organization" size="lg" busy={busy} closeOnOverlay={!busy} description="Create the organization, primary location and administrator. Configure the rest after creation." footer={<div className="flex w-full items-center justify-between gap-3"><Button variant="outline" disabled={busy} onClick={() => step === 2 ? setStep(1) : onClose()}>{step === 2 ? "Back" : "Cancel"}</Button><Button type="submit" form="create-organization-form" loading={busy} disabled={busy}>{step === 1 ? "Configure administrator" : "Create organization"}</Button></div>}>
    <ol className="mb-5 flex gap-5 text-sm" aria-label="Creation steps"><li aria-current={step === 1 ? "step" : undefined} className={step === 1 ? "font-semibold text-accent" : "text-text-muted"}>1. Organization & tier</li><li aria-current={step === 2 ? "step" : undefined} className={step === 2 ? "font-semibold text-accent" : "text-text-muted"}>2. Administrator</li></ol>
    {error && <div className="mb-4"><Alert variant="error" title="Check organization setup">{error}</Alert></div>}
    <form id="create-organization-form" onSubmit={submit} className="space-y-4" autoComplete="off">
      <fieldset disabled={busy} className="space-y-4">
        {step === 1 ? <>
          <Input label="Organization name" required value={form.org_name} onChange={(e) => change("org_name", e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2"><Input label="City" required value={form.city} onChange={(e) => change("city", e.target.value)} /><Select label="Country" value={form.countryCode} options={Object.entries(countries).map(([value, [label]]) => ({ value, label }))} onChange={(e) => setForm({ ...form, countryCode: e.target.value, timezone: countries[e.target.value as keyof typeof countries][2] })} /></div>
          <Select label="Subscription tier" value={form.plan} options={[{ value: "starter", label: "Starter" }, { value: "pro", label: "Pro" }, { value: "enterprise", label: "Enterprise" }]} onChange={(e) => change("plan", e.target.value)} />
          <Select label="Free trial duration" value={form.trial} options={[{ value: "default", label: "Use plan default" }, { value: "7", label: "7 days" }, { value: "15", label: "15 days" }, { value: "30", label: "30 days" }, { value: "custom", label: "Custom duration" }]} onChange={(e) => change("trial", e.target.value)} />
          {form.trial === "custom" && <Input label="Custom trial days" type="number" required min={1} max={365} step={1} value={form.customDays} onChange={(e) => change("customDays", e.target.value)} />}
          {form.plan === "enterprise" && form.trial === "default" && <p className="text-sm text-text-muted">Enterprise uses manual activation by default. Select days to start a trial.</p>}
          <details className="border-t border-border pt-2"><summary className="cursor-pointer py-2 text-sm font-medium">Branding and location options</summary><div className="space-y-4 pt-3"><div className="grid gap-4 sm:grid-cols-2"><ImageUpload label="Organization logo" value={logo} onChange={setLogo} /><ImageUpload label="Cover photo" value={cover} onChange={setCover} /></div><Input label="Primary location name" hint="Uses the organization name when left blank." value={form.clinic_name} onChange={(e) => change("clinic_name", e.target.value)} /><Input label="Operating timezone" required value={form.timezone} onChange={(e) => change("timezone", e.target.value)} /></div></details>
        </> : <>
          <p className="text-sm text-text-secondary"><strong>{form.org_name}</strong> · {form.city} · {form.plan.toUpperCase()}</p>
          <Input label="Administrator name" required value={form.admin_name} onChange={(e) => change("admin_name", e.target.value)} />
          <Input label="Administrator email" required type="email" value={form.admin_email} onChange={(e) => change("admin_email", e.target.value)} />
          <Input label="Administrator password" required type="password" autoComplete="new-password" minLength={8} hint="Use uppercase, lowercase, a number and a symbol." value={form.admin_password} onChange={(e) => change("admin_password", e.target.value)} />
          <label className="flex gap-3 items-start text-sm py-2"><input type="checkbox" checked={form.sendWelcomeEmail} onChange={(e) => setForm({ ...form, sendWelcomeEmail: e.target.checked })} className="mt-1" /><span>Send a welcome email with the login link. Share the chosen password with the administrator separately.</span></label>
          <p className="text-sm text-text-muted">Default roles, modules, a primary location and the selected subscription are created automatically. The administrator configures MFA from their own account.</p>
        </>}
      </fieldset>
    </form>
  </Modal>;
}
