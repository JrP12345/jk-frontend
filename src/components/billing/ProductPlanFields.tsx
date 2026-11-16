"use client";

import { Input, Select, Toggle } from "@/components/ui";
import type { CommercialPricing, ProductRates, SaaSPlan } from "@/services/billing.service";

const emptyRates = (): ProductRates => ({ clinicPaise: 0, pharmacyPaise: 0, pharmacyAddonPaise: 0, extraDoctorPaise: 0, additionalPharmacyPaise: null });
export const initialProductPricing = (): CommercialPricing => ({ revision: 1, monthly: emptyRates(), taxMode: "inclusive", taxRateBps: 0, includedDoctors: 0, doctorsPerAdditionalClinic: 0 });
const rates: Array<{ key: keyof ProductRates; label: string }> = [
  { key: "clinicPaise", label: "Clinic location" }, { key: "pharmacyPaise", label: "Standalone pharmacy" },
  { key: "pharmacyAddonPaise", label: "Pharmacy at a clinic" }, { key: "extraDoctorPaise", label: "Additional doctor seat" }, { key: "additionalPharmacyPaise", label: "Additional pharmacy branch" },
];
export function ProductPlanFields({ plan, onChange }: { plan: Partial<SaaSPlan>; onChange: (plan: Partial<SaaSPlan>) => void }) {
  const pricing = plan.commercialPricing || initialProductPricing();
  const update = (changes: Partial<CommercialPricing>) => onChange({ ...plan, commercialPricing: { ...pricing, ...changes }, currency: "INR" });
  return <div className="space-y-4 border-t border-border pt-4">
    <p className="text-sm leading-relaxed text-text-secondary">Set location-product prices in INR. Zero means free. The pharmacy trial uses the standalone pharmacy rate and configured trial duration; paid activation is separate.</p>
    <Select label="Base tier for product capacity" value={plan.legacyTier || "starter"} options={[{ value: "starter", label: "Starter" }, { value: "professional", label: "Pro" }, { value: "enterprise", label: "Enterprise" }]} onChange={event => onChange({ ...plan, legacyTier: event.target.value as SaaSPlan["legacyTier"] })} />
    {(["monthly", ...(pricing.annual ? ["annual"] as const : [])] as const).map(period => <fieldset key={period} className="space-y-3"><legend className="text-sm font-medium">{period === "monthly" ? "Monthly prices" : "Annual prices"}</legend><div className="grid gap-4 sm:grid-cols-2">{rates.map(rate => <Input key={rate.key} label={`${period === "monthly" ? "Monthly" : "Annual"} ${rate.label.toLowerCase()} (INR)`} type="number" min="0" max="1000000000" step="0.01" required={rate.key !== "additionalPharmacyPaise"} value={pricing[period]?.[rate.key] == null ? "" : pricing[period]![rate.key]! / 100} hint={rate.key === "additionalPharmacyPaise" ? "Leave blank when additional pharmacy branches are not offered." : undefined} onChange={event => update({ [period]: { ...pricing[period], [rate.key]: rate.key === "additionalPharmacyPaise" && !event.target.value.trim() ? null : Math.round(Number(event.target.value) * 100) } })} />)}</div></fieldset>)}
    <Toggle label="Configure annual product prices" checked={Boolean(pricing.annual)} onChange={checked => update({ annual: checked ? emptyRates() : null })} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Select label="Product tax treatment" value={pricing.taxMode} options={[{ value: "inclusive", label: "Prices include tax" }, { value: "exclusive", label: "Tax added to prices" }]} onChange={event => update({ taxMode: event.target.value as CommercialPricing["taxMode"] })} />
      <Input label="Product tax rate (%)" type="number" min="0" max="100" step="0.01" required value={pricing.taxRateBps / 100} onChange={event => update({ taxRateBps: Math.round(Number(event.target.value) * 100) })} />
      <Input label="Doctors included per first clinic" type="number" min="0" max="1000" step="1" required value={pricing.includedDoctors} onChange={event => update({ includedDoctors: Number(event.target.value) })} />
      <Input label="Doctors included per additional clinic" type="number" min="0" max="1000" step="1" required value={pricing.doctorsPerAdditionalClinic} onChange={event => update({ doctorsPerAdditionalClinic: Number(event.target.value) })} />
    </div>
  </div>;
}
