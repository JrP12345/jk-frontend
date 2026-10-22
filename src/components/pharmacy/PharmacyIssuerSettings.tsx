"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { readPharmacyIssuer, savePharmacyIssuer, type PharmacyIssuerFields } from "@/lib/pharmacyIssuer";
import { useAuthStore } from "@/store/authStore";

const empty = (): PharmacyIssuerFields => ({ registration: "", legalName: "", address: "", stateCode: "", gstin: "", drugLicenceNumbers: [], authorisedSignatory: "", reviewReference: "", pricesIncludeTax: false, electronicReportingRequired: false, minimumHsnDigits: 4 });
interface Props { locationId: string; organizationId: string; disabled?: boolean; onBusyChange: (busy: boolean) => void }
export function PharmacyIssuerSettings(props: Props) {
  const user = useAuthStore(state => state.user);
  const [loadVersion, setLoadVersion] = useState(0);
  return <IssuerForm key={`${authScopeKey(user)}:${props.organizationId}:${props.locationId}:${loadVersion}`} {...props} onReload={() => setLoadVersion(value => value + 1)} />;
}
function IssuerForm({ locationId, organizationId, disabled, onBusyChange, onReload }: Props & { onReload: () => void }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user);
  const [fields, setFields] = useState(empty), [licences, setLicences] = useState("");
  const [revision, setRevision] = useState<number | null>(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [confirmed, setConfirmed] = useState(false);
  const alive = useRef(true), lock = useRef(false);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  const canManage = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!canManage || !organizationId) return () => controller.abort();
    readPharmacyIssuer(locationId, organizationId, controller.signal).then(profile => {
      if (!controller.signal.aborted) { setRevision(profile?.revision || 0); setFields(profile ? { ...profile, gstin: profile.gstin || "" } : empty()); setLicences(profile?.drugLicenceNumbers.join("\n") || ""); }
    }).catch(() => { if (!controller.signal.aborted) setError("Issuer details could not be confirmed. Reload before saving."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [locationId, organizationId, canManage]);
  const set = <K extends keyof PharmacyIssuerFields>(key: K, value: PharmacyIssuerFields[K]) => { setFields(previous => ({ ...previous, [key]: value })); setConfirmed(false); setNotice(""); };
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (lock.current || disabled || !confirmed || revision === null || !canManage || !current()) return;
    const numbers = licences.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (!["regular", "composition", "unregistered"].includes(fields.registration) || numbers.length < 1 || numbers.length > 10 || new Set(numbers).size !== numbers.length) { setError("Choose the registration and enter 1–10 distinct licence numbers, one per line."); return; }
    lock.current = true; setSaving(true); onBusyChange(true); setError(""); setNotice("");
    try {
      const result = await savePharmacyIssuer(locationId, organizationId, revision, { ...fields, drugLicenceNumbers: numbers });
      if (!result) throw new Error("Issuer save could not be confirmed");
      if (current()) { setRevision(result.revision); setFields({ ...result, gstin: result.gstin || "" }); setLicences(result.drugLicenceNumbers.join("\n")); setConfirmed(false); setNotice(result.issueSupported ? "Reviewed branch issuer details saved. Pharmacy access is configured separately." : "Details saved. Document issue is blocked by the declared pricing or electronic-reporting requirements."); }
    } catch (failure) { if (current()) { setRevision(null); setConfirmed(false); setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "Save outcome is uncertain. Reload the branch details before another save."); } }
    finally { lock.current = false; if (alive.current) { setSaving(false); onBusyChange(false); } }
  }
  return <form onSubmit={save} aria-label="Branch issuer and licence details" className="space-y-3">
    {loading && canManage && <p role="status">Loading branch issuer details...</p>}
    {error && <Alert variant="error" title="Issuer details unavailable">{error}</Alert>}
    {notice && <Alert variant="info" title="Branch issuer saved">{notice}</Alert>}
    <Button type="button" size="sm" variant="outline" disabled={saving || loading || disabled || !canManage} onClick={onReload}>Reload issuer details</Button>
    <fieldset disabled={loading || saving || disabled || !canManage || revision === null} className="space-y-3">
      <p className="text-sm text-text-secondary">Record the actual legal issuer, branch licences and professional review. These details do not grant staff access or activate a paid product.</p>
      <Select label="GST registration *" value={fields.registration} onChange={event => set("registration", event.target.value)} options={[{ value: "", label: "Choose registration" }, { value: "regular", label: "Regular" }, { value: "composition", label: "Composition" }, { value: "unregistered", label: "Unregistered" }]} />
      {([ ["legalName", "Legal issuer name *"], ["address", "Issuer address *"], ["stateCode", "Issuer state code *"], ["authorisedSignatory", "Authorised signatory *"], ["reviewReference", "Issuer review reference *"] ] as const).map(([key, label]) => <Input key={key} label={label} value={fields[key]} minLength={key === "stateCode" ? 2 : 3} maxLength={key === "stateCode" ? 2 : 500} required onChange={event => set(key, event.target.value)} />)}
      {fields.registration !== "unregistered" && <Input label="GSTIN *" value={fields.gstin} minLength={15} maxLength={15} required onChange={event => set("gstin", event.target.value.toUpperCase())} />}
      <Textarea label="Drug licence numbers (one per line) *" value={licences} maxLength={5010} required onChange={event => { setLicences(event.target.value); setConfirmed(false); }} />
      <Select label="Minimum HSN digits" value={String(fields.minimumHsnDigits)} onChange={event => set("minimumHsnDigits", Number(event.target.value))} options={[4, 6, 8].map(value => ({ value: String(value), label: String(value) }))} />
      <Checkbox label="Counter prices include tax" checked={fields.pricesIncludeTax} onChange={event => set("pricesIncludeTax", event.target.checked)} />
      <Checkbox label="This issuer requires electronic invoice reporting" checked={fields.electronicReportingRequired} onChange={event => set("electronicReportingRequired", event.target.checked)} />
      {(!fields.pricesIncludeTax || fields.electronicReportingRequired) && <p className="text-sm">These declared requirements block this pharmacy document path. Saving retains the actual requirements.</p>}
      <Checkbox label="I confirm these branch details and the actual review reference" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
      <Button type="submit" size="sm" loading={saving} disabled={!confirmed || !fields.registration}>Save branch issuer details</Button>
    </fieldset>
  </form>;
}
