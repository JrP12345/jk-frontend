"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input, Select } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { pharmacyNumberPrefix, type PharmacyNumberFormat } from "@/lib/pharmacyInvoiceNumberFormat";
import { readPharmacyNumbering, savePharmacyNumbering, type PharmacyNumberingSettings } from "@/lib/pharmacyInvoiceNumbering";
import { useAuthStore } from "@/store/authStore";

interface Props { locationId: string; organizationId: string; disabled?: boolean; onBusyChange: (busy: boolean) => void }
export function PharmacyInvoiceNumberingSettings(props: Props) {
  const user = useAuthStore(state => state.user), [reload, setReload] = useState(0);
  return <NumberingForm key={`${authScopeKey(user)}:${props.organizationId}:${props.locationId}:${reload}`} {...props} onReload={() => setReload(value => value + 1)} />;
}
function NumberingForm({ locationId, organizationId, disabled, onBusyChange, onReload }: Props & { onReload: () => void }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), canManage = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const [settings, setSettings] = useState<PharmacyNumberingSettings | null>(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [format, setFormat] = useState<PharmacyNumberFormat>({ prefixTemplate: "", digits: 6, resetPolicy: "financial_year" });
  const [next, setNext] = useState("1"), [reference, setReference] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const alive = useRef(true), lock = useRef(false), current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!canManage) return () => controller.abort();
    readPharmacyNumbering(locationId, organizationId, controller.signal).then(row => {
      if (!controller.signal.aborted) { setSettings(row); if (row.configuration) setFormat(row.configuration); setNext(String(row.nextNumber ?? 1)); }
    }).catch(() => { if (!controller.signal.aborted) setError("Invoice numbering could not be loaded. Reload before saving."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [locationId, organizationId, canManage]);
  function edit<K extends keyof PharmacyNumberFormat>(key: K, value: PharmacyNumberFormat[K]) { setFormat(previous => ({ ...previous, [key]: value })); setConfirmed(false); setNotice(""); }
  let preview = "", problem = "";
  try {
    if (settings) {
      const prefix = pharmacyNumberPrefix(format, settings.financialYear), sequence = Number(next);
      if (!/^[1-9]\d{0,8}$/.test(next) || sequence >= 10 ** format.digits) throw new Error("Enter a next number that fits the selected digits.");
      preview = `${prefix}${String(sequence).padStart(format.digits, "0")}`;
    }
  } catch (failure) { problem = (failure as Error).message; }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || disabled || !settings || !confirmed || !canManage || !current() || problem || reference.trim().length < 3) return;
    lock.current = true; setSaving(true); onBusyChange(true); setError(""); setNotice("");
    try {
      const saved = await savePharmacyNumbering(locationId, organizationId, settings.revision, settings.financialYear, { ...format, nextNumber: Number(next), reviewReference: reference });
      if (current()) { setSettings(saved); setFormat(saved.configuration!); setNext(String(saved.nextNumber)); setReference(""); setConfirmed(false); setNotice(`Numbering saved. Next available invoice: ${saved.preview ?? "series exhausted"}.`); }
    } catch (failure) {
      if (current()) { setSettings(null); setConfirmed(false); setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "Save outcome is uncertain. Reload numbering to confirm it before another save."); }
    } finally { lock.current = false; if (alive.current) { setSaving(false); onBusyChange(false); } }
  }
  return <form onSubmit={save} aria-label="Branch invoice numbering" className="space-y-3">
    {loading && canManage && <p role="status">Loading invoice numbering...</p>}
    {error && <Alert variant="error" title="Numbering unavailable">{error}</Alert>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <Button type="button" size="sm" variant="outline" disabled={loading || saving || disabled || !canManage} onClick={onReload}>Reload invoice numbering</Button>
    <fieldset disabled={loading || saving || disabled || !settings || !canManage} className="space-y-3">
      <p className="text-sm text-text-secondary">Choose a distinct branch series for pharmacy bills. Issued bills keep their original numbers. Next-number previews can change while another cashier bills.</p>
      {settings?.configuration === null && <p className="text-sm">This branch currently uses system numbering.</p>}
      <Input label="Invoice prefix *" value={format.prefixTemplate} placeholder="PJP/{FY}/" maxLength={20} required onChange={event => edit("prefixTemplate", event.target.value.toUpperCase())} />
      <p className="text-sm text-text-secondary">End the prefix with / or -. For yearly numbering, use {'{FY}'} once: PJP/{'{FY}'}/ becomes PJP/26-27/. Full numbers can contain up to 16 characters.</p>
      <Select label="Sequence reset" value={format.resetPolicy} onChange={event => edit("resetPolicy", event.target.value as PharmacyNumberFormat["resetPolicy"])} options={[{ value: "financial_year", label: "Every financial year (April–March)" }, { value: "continuous", label: "Continue across financial years" }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Number of digits" value={String(format.digits)} onChange={event => edit("digits", Number(event.target.value))} options={Array.from({ length: 9 }, (_, n) => ({ value: String(n + 1), label: String(n + 1) }))} />
        <Input label="Next invoice number *" inputMode="numeric" value={next} pattern="[1-9][0-9]{0,8}" maxLength={9} required onChange={event => { setNext(event.target.value); setConfirmed(false); setNotice(""); }} />
      </div>
      {settings && <p className="text-sm" aria-live="polite">{preview ? `Preview (${settings.financialYear}): ${preview}` : problem}</p>}
      <p className="text-sm text-text-secondary">Used or reserved numbers cannot be reused. A yearly series starts at 1 next financial year; the next number above applies to this year.</p>
      <p className="text-sm text-text-secondary">Numbering changes require reconciliation first if this branch has an enrolled PC with reserved numbers.</p>
      <p className="text-sm text-text-secondary">Numbering changes require reconciliation first if this branch has an enrolled PC with reserved numbers.</p>
      <Input label="Numbering review reference *" value={reference} minLength={3} maxLength={500} required onChange={event => { setReference(event.target.value); setConfirmed(false); }} />
      <Checkbox label="I confirm this branch series and next number" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
      <Button type="submit" size="sm" loading={saving} disabled={!confirmed || Boolean(problem) || !preview || reference.trim().length < 3}>Save invoice numbering</Button>
    </fieldset>
  </form>;
}
