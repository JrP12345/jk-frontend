"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { formatCurrency } from "@/lib/currency";
import { organizationPath } from "@/services/organization.service";
import { billingService, type ProductPlan, type ProductQuote } from "@/services/billing.service";
import { useAuthStore } from "@/store/authStore";

const descriptions: Record<string, string> = { clinic: "Clinic location", pharmacy: "Standalone pharmacy", pharmacy_addon: "Pharmacy at clinic", extra_doctor: "Additional doctor seats" };
type ProductPurchase = (plan: ProductPlan, quote: ProductQuote) => void;
export function ProductQuotePanel({ organizationId, onPurchase, busy = false }: { organizationId?: string; onPurchase?: ProductPurchase; busy?: boolean }) {
  const user = useAuthStore(state => state.user);
  const [retry, setRetry] = useState(0);
  return <ProductQuoteWorkspace key={`${authScopeKey(user)}:${organizationId || user?.organization_id || ""}:${retry}`} organizationId={organizationId || user?.organization_id} onRetry={() => setRetry(value => value + 1)} onPurchase={onPurchase} busy={busy} />;
}
function ProductQuoteWorkspace({ organizationId, onRetry, onPurchase, busy }: { organizationId?: string; onRetry: () => void; onPurchase?: ProductPurchase; busy: boolean }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user);
  const [plans, setPlans] = useState<ProductPlan[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [planId, setPlanId] = useState(""), [cycle, setCycle] = useState<"monthly" | "annual">("monthly"), [doctors, setDoctors] = useState("0");
  const [products, setProducts] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<ProductQuote | null>(null), [error, setError] = useState(""), [quoting, setQuoting] = useState(false);
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void billingService.getProductPlans(controller.signal).then(async catalogue => {
      if (!catalogue.every(plan => plan.commercialFamily === "location_products" && Number.isSafeInteger(plan.commercialPricing?.revision))) throw new Error("Invalid product catalogue");
      if (controller.signal.aborted) return;
      if (catalogue.length && organizationId) {
        const response = await api.get(organizationPath("/onboarding/locations", organizationId), { signal: controller.signal });
        if (!Array.isArray(response.data?.data)) throw new Error("Locations could not be loaded");
        if (!controller.signal.aborted) setLocations(response.data.data);
      }
      if (!controller.signal.aborted) { setPlans(catalogue); if (catalogue.length === 1) setPlanId(catalogue[0].id); }
    }).catch(() => { if (!controller.signal.aborted) setLoadError("Product quotes could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [organizationId]);
  const selected = plans.find(plan => plan.id === planId);
  function changed() { setQuote(null); setError(""); }
  async function preview(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !organizationId || !selected || authScopeKey(useAuthStore.getState().user) !== scope) return;
    const seats = Number(doctors);
    if (!doctors.trim() || !Number.isSafeInteger(seats) || seats < 0 || seats > 1000) { setError("Enter a whole number of doctor seats from 0 to 1000."); return; }
    const selection = locations.filter(location => products[location.id]).map(location => ({ locationId: location.id,
      clinic: products[location.id] === "clinic" || products[location.id] === "both", pharmacy: products[location.id] === "pharmacy" || products[location.id] === "both" }));
    if (!selection.length) { setError("Select products for your locations before requesting a quote."); return; }
    lock.current = true; setQuoting(true); setError(""); setQuote(null);
    try {
      const result = await billingService.quoteProducts({ planId, priceRevision: selected.commercialPricing.revision, billingCycle: cycle, doctorSeats: seats, locations: selection }, organizationId);
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) setQuote(result);
    } catch (failure) {
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "The quote could not be confirmed. Review the selection and try again.");
    } finally { lock.current = false; if (alive.current) setQuoting(false); }
  }
  if (loading) return <p role="status">Checking location-product availability...</p>;
  if (loadError) return <Alert variant="error" title="Product quotes unavailable" action={<Button variant="outline" size="sm" onClick={onRetry}>Reload product catalogue</Button>}>{loadError}</Alert>;
  if (!plans.length) return null;
  return <Card><CardHeader><CardTitle>Location products</CardTitle><CardDescription>Preview clinic, pharmacy and doctor capacity for your locations. A quote does not change your subscription.</CardDescription></CardHeader><CardContent>
    <form onSubmit={preview} className="space-y-4">
      <fieldset disabled={quoting || busy} className="space-y-4">
        <Select label="Product catalogue" value={planId} onChange={event => { setPlanId(event.target.value); changed(); }} options={[{ value: "", label: "Select catalogue" }, ...plans.map(plan => ({ value: plan.id, label: plan.name }))]} />
        <Select label="Product billing cycle" value={cycle} onChange={event => { setCycle(event.target.value as "monthly" | "annual"); changed(); }} options={[{ value: "monthly", label: "Monthly" }, { value: "annual", label: "Annual (requires configured prices)" }]} />
        {locations.map(location => <Select key={location.id} label={`Products for ${location.name}`} value={products[location.id] || ""} onChange={event => { setProducts(previous => ({ ...previous, [location.id]: event.target.value })); changed(); }} options={[
          { value: "", label: "Select products" }, { value: "clinic", label: "Clinic" }, { value: "pharmacy", label: "Standalone pharmacy" }, { value: "both", label: "Clinic and pharmacy at this location" },
        ]} />)}
        <Input label="Required doctor seats" type="number" min="0" max="1000" step="1" value={doctors} onChange={event => { setDoctors(event.target.value); changed(); }} />
        <p className="text-sm text-text-secondary">Included doctor capacity and applicable taxes come from the selected catalogue. Every active location needs a selection.</p>
        <Button type="submit" loading={quoting} disabled={!selected || !organizationId || !locations.length}>Preview product quote</Button>
      </fieldset>
      {error && <Alert variant="error" title="Quote unavailable">{error}</Alert>}
      {quote && <section aria-label="Product quote" className="space-y-2 rounded-xl border border-border p-4">
        <ul className="space-y-1">{quote.lines.map(line => <li key={line.id} className="flex justify-between gap-3"><span>{descriptions[line.kind] || line.kind} × {line.quantity}</span><span>{formatCurrency(line.amountPaise / 100, quote.currency)}</span></li>)}</ul>
        <p>Tax: {formatCurrency(quote.taxPaise / 100, quote.currency)}</p><p className="font-semibold">Total: {formatCurrency(quote.totalPaise / 100, quote.currency)}</p>
        <p>Capacity: {quote.entitlements.maxLocations} locations, {quote.entitlements.maxDoctors} doctor seats, {quote.entitlements.maxStaff} staff.</p>
        <p className="text-sm text-text-secondary">Quote expires {new Date(quote.expiresAt).toLocaleString()}. Review the total before checkout. Renewals extend the same product selection; changes require the current product period to end.</p>
        {onPurchase && selected && <Button type="button" disabled={busy} onClick={() => {
          if (Date.parse(quote.expiresAt) <= Date.now()) { setQuote(null); setError("Quote expired. Preview the selection again before checkout."); return; }
          if (authScopeKey(useAuthStore.getState().user) === scope) onPurchase(selected, quote);
        }}>{quote.totalPaise === 0 ? "Activate reviewed free selection" : `Pay ${formatCurrency(quote.totalPaise / 100, quote.currency)}`}</Button>}
      </section>}
    </form>
  </CardContent></Card>;
}
