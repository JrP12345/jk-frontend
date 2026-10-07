"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Alert, Button, Card, Input, Select, LoadingState, Skeleton } from "@/components/ui";
import { billingService, type SaaSPlan } from "@/services/billing.service";

export function OrganizationSetupRequest({ planKey }: { planKey: string }) {
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [planSlug, setPlanSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const inFlight = useRef(false);
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
  const update = (field: keyof typeof form, value: string) => { setForm(previous => ({ ...previous, [field]: value })); requestKey.current = null; setSubmitError(null); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || submitted) return;
    inFlight.current = true; setSubmitting(true); setSubmitError(null);
    requestKey.current ||= crypto.randomUUID();
    try {
      await api.post("/public/setup-requests", { ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])), planSlug, requestKey: requestKey.current });
      setSubmitted(true);
    } catch (error: unknown) {
      setSubmitError((error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Your request could not be submitted. Please try again.");
    } finally { inFlight.current = false; setSubmitting(false); }
  };
  return <main className="min-h-dvh bg-surface-alt px-4 py-20 text-text">
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/pricing" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">Back to plans</Link>
      <Card className="rounded-xl border-border bg-surface p-5 sm:p-6 space-y-5">
        <header><h1 className="page-title">Request organization setup</h1><p className="mt-2 text-sm text-text-muted">Share your practice details with our team. A platform administrator provisions the organization after reviewing your request.</p></header>
        <p className="text-sm text-text-secondary">Your request goes directly to our team. We will contact you to confirm your setup and plan.</p>
        {failed && <Alert variant="warning" title="Plans could not be loaded" action={<Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}>You can still request help choosing a plan.</Alert>}
        {!submitted && <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={submitting} className="space-y-4">
          <Input label="Organization name" required maxLength={200} autoComplete="organization" value={form.organization} onChange={event => update("organization", event.target.value)} />
          <Input label="City" required maxLength={100} autoComplete="address-level2" value={form.city} onChange={event => update("city", event.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Contact name" required maxLength={100} autoComplete="name" value={form.name} onChange={event => update("name", event.target.value)} /><Input label="Contact email" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={event => update("email", event.target.value)} /></div>
          {loading ? <LoadingState label="Loading plans"><Skeleton height="4rem" /></LoadingState> : <Select label="Requested plan" value={planSlug} onChange={event => { setPlanSlug(event.target.value); requestKey.current = null; setSubmitError(null); }} options={[{ value: "", label: "Help me choose a plan" }, ...plans.map(item => ({ value: item.slug, label: item.name }))]} />}
          {plan && <p className="text-sm text-text-muted">{plan.trialDays > 0 ? `The configured plan trial is ${plan.trialDays} days. The team will confirm your terms during setup.` : "The team will confirm activation and trial terms during setup."}</p>}
          {submitError && <Alert variant="error" title="Request not submitted">{submitError}</Alert>}
          <Button type="submit" className="w-full sm:w-auto" disabled={loading} loading={submitting}>Submit setup request</Button>
          </fieldset>
        </form>}
        {submitted && <section aria-label="Setup request received" role="status" className="rounded-xl bg-surface-alt p-5 space-y-3">
          <h2 className="text-lg font-semibold">Request received</h2>
          <p className="text-sm text-text-secondary">Our team will review your practice details and contact you at <span className="break-all font-medium">{form.email.trim()}</span>. Your organization will be activated once the setup is confirmed.</p>
          <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-accent">Back to home</Link>
        </section>}
      </Card>
    </div>
  </main>;
}
