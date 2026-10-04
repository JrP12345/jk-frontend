"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Input, Select, Spinner } from "@/components/ui";
import { billingService, type SaaSPlan } from "@/services/billing.service";

export function OrganizationSetupRequest({ planKey }: { planKey: string }) {
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [planSlug, setPlanSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [prepared, setPrepared] = useState(false);
  const [form, setForm] = useState({ organization: "", city: "", name: "", email: "" });
  useEffect(() => {
    let current = true;
    setLoading(true); setFailed(false);
    billingService.getPlans().then(data => {
      if (!current) return;
      setPlans(data || []);
      setPlanSlug(data.find(plan => plan.slug === planKey || plan.id === planKey)?.slug || "");
    }).catch(() => { if (current) setFailed(true); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [planKey, attempt]);
  const plan = plans.find(item => item.slug === planSlug);
  const body = ["Organization setup request", "", `Organization: ${form.organization.trim()}`, `City: ${form.city.trim()}`, `Contact: ${form.name.trim()}`, `Email: ${form.email.trim()}`, `Requested plan: ${plan?.name || "Please help me choose a plan"}`, "", "Please contact me to discuss setup and trial terms."].join("\n");
  const draftUrl = `mailto:ekavyuofficial@gmail.com?subject=${encodeURIComponent("Ekavyu organization setup request")}&body=${encodeURIComponent(body)}`;
  const update = (field: keyof typeof form, value: string) => { setForm(previous => ({ ...previous, [field]: value })); setPrepared(false); };
  return <main className="min-h-dvh bg-surface-alt px-4 py-20 text-text">
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/pricing" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">Back to plans</Link>
      <Card className="rounded-xl border-border bg-surface p-5 sm:p-6 space-y-5">
        <header><h1 className="text-xl sm:text-2xl font-semibold">Request organization setup</h1><p className="mt-2 text-sm text-text-muted">Share your practice details with our team. A platform administrator provisions the organization after reviewing your request.</p></header>
        <p className="text-sm text-text-secondary">This form prepares an email draft. Your organization and trial are created after the setup is agreed.</p>
        {failed && <Alert variant="warning" title="Plans could not be loaded" action={<Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}>You can still request help choosing a plan.</Alert>}
        <form onSubmit={event => { event.preventDefault(); setPrepared(true); }} className="space-y-4">
          <Input label="Organization name" required maxLength={200} autoComplete="organization" value={form.organization} onChange={event => update("organization", event.target.value)} />
          <Input label="City" required maxLength={100} autoComplete="address-level2" value={form.city} onChange={event => update("city", event.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Contact name" required maxLength={100} autoComplete="name" value={form.name} onChange={event => update("name", event.target.value)} /><Input label="Contact email" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={event => update("email", event.target.value)} /></div>
          {loading ? <Spinner label="Loading plans" /> : <Select label="Requested plan" value={planSlug} onChange={event => { setPlanSlug(event.target.value); setPrepared(false); }} options={[{ value: "", label: "Help me choose a plan" }, ...plans.map(item => ({ value: item.slug, label: item.name }))]} />}
          {plan && <p className="text-sm text-text-muted">{plan.trialDays > 0 ? `The configured plan trial is ${plan.trialDays} days. The team will confirm your terms during setup.` : "The team will confirm activation and trial terms during setup."}</p>}
          <Button type="submit" className="w-full sm:w-auto" disabled={loading}>Prepare setup request</Button>
        </form>
        {prepared && <section aria-label="Prepared setup request" className="border-t border-border pt-4 space-y-3">
          <h2 className="text-base font-semibold">Send your request</h2>
          <p className="text-sm text-text-muted">Open the draft in your email app and send it to <span className="break-all">ekavyuofficial@gmail.com</span>. Nothing has been sent yet.</p>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface-alt p-3 text-sm font-sans">{body}</pre>
          <a href={draftUrl} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-brand-mist focus-visible:outline-2 focus-visible:outline-accent">Open email draft</a>
        </section>}
      </Card>
    </div>
  </main>;
}
