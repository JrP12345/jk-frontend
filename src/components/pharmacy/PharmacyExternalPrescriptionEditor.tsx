"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, DatePicker, Input, Modal, QuantityInput } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { externalMedicines, recordExternalPrescription, type ExternalMedicine, type ExternalPrescription, type ExternalPrescriptionInput } from "@/lib/pharmacyExternalPrescriptions";
import { pickupError } from "@/lib/pharmacyPickup";

const fields = [
  ["reference", "Prescription reference", "text"], ["issuedOn", "Prescription date", "date"], ["validUntil", "Reviewed supply deadline", "date"],
  ["patientName", "Patient name", "text"], ["patientAddress", "Patient address", "text"], ["patientPhone", "Patient phone (optional)", "tel"],
  ["prescriberName", "Prescriber name", "text"], ["prescriberRegistration", "Prescriber registration number", "text"], ["prescriberCouncil", "Prescriber council", "text"],
  ["prescriberAddress", "Prescriber address", "text"], ["prescriberReviewReference", "Prescriber verification evidence reference", "text"], ["sourceReference", "Retained signed prescription reference", "text"],
] as const;
type Field = typeof fields[number][0];
type Selected = { product: ExternalMedicine; quantity: string; instructions: string };

export function PharmacyExternalPrescriptionEditor({ locationId, onClose, onSaved }: { locationId: string; onClose: () => void; onSaved: (row: ExternalPrescription) => void }) {
  const [values, setValues] = useState<Record<Field, string>>({ reference: "", issuedOn: "", validUntil: "", patientName: "", patientAddress: "", patientPhone: "", prescriberName: "", prescriberRegistration: "", prescriberCouncil: "", prescriberAddress: "", prescriberReviewReference: "", sourceReference: "" });
  const [search, setSearch] = useState(""), [products, setProducts] = useState<ExternalMedicine[]>([]), [selected, setSelected] = useState<Selected[]>([]);
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [searchError, setSearchError] = useState(""), [pending, setPending] = useState(false), [finding, setFinding] = useState(false);
  const begin = useLatestRead(), frozen = useRef<{ key: string; input: ExternalPrescriptionInput } | null>(null), lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const read = begin(), timer = setTimeout(() => {
      setFinding(true); setSearchError("");
      void externalMedicines(locationId, search.trim(), read.signal).then(rows => { if (read.isCurrent()) setProducts(rows); }).catch(failure => { if (read.isCurrent()) { setProducts([]); setSearchError(pickupError(failure)); } }).finally(() => { if (read.isCurrent()) setFinding(false); });
    }, 200);
    return () => clearTimeout(timer);
  }, [begin, locationId, search]);
  async function save() {
    if (lock.current || !alive.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (!frozen.current) {
        if (!confirmed || fields.some(([field]) => field !== "patientPhone" && !values[field].trim()) || !selected.length || selected.some(line => !/^\d+$/.test(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 1_000_000 || !line.instructions.trim())) throw Error("Complete the prescription evidence, original directions and permitted quantities, then confirm the review.");
        frozen.current = { key: crypto.randomUUID(), input: { ...values, locationId, reviewConfirmed: true, lines: selected.map(line => ({ medicineId: line.product.id, expectedUnitVersion: line.product.unitVersion, expectedDispensingRevision: line.product.dispensingRevision, quantity: Number(line.quantity), instructions: line.instructions.trim() })) } };
      }
      const row = await recordExternalPrescription(frozen.current.input, frozen.current.key);
      if (alive.current) onSaved(row);
    } catch (failure) {
      if (alive.current) {
        setError(pickupError(failure)); const status = (failure as { response?: { status?: number } })?.response?.status;
        const uncertain = Boolean(frozen.current && (!status || status >= 500)); setPending(uncertain); if (!uncertain) frozen.current = null;
      }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  function update(index: number, patch: Partial<Selected>) { setSelected(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); setConfirmed(false); }
  return <Modal open title="Review an outside prescription" description="For a registered pharmacist reviewing an actual signed prescription brought to this branch." size="xl" busy={busy} onClose={() => { if (!busy && !pending) onClose(); }} closeOnOverlay={!pending} footer={<><Button variant="outline" disabled={busy || pending} onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!pending && !confirmed} onClick={() => { void save(); }}>{pending ? "Retry same review" : "Record reviewed prescription"}</Button></>}>
    <div className="space-y-5">
      {error && <Alert variant="error" title={pending ? "Review outcome not confirmed" : "Review needs attention"}>{error}{pending && <p>Keep this form open and retry the same review. The original prescription reference prevents a second record at this branch.</p>}</Alert>}
      <p className="text-sm text-text-secondary">Enter the total quantity currently permitted for supply, accounting for any earlier supplies written on the prescription. Do not infer quantities from dosage text. Repeat authorizations, substitutions, Schedule X and narcotic supplies are not supported here.</p>
      <fieldset disabled={busy || pending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([field, label, type]) => type === "date" ? <DatePicker key={field} label={label} value={values[field]} required onChange={value => { setValues(current => ({ ...current, [field]: value })); setConfirmed(false); }} /> : <Input key={field} label={label} type={type} required={field !== "patientPhone"} value={values[field]} maxLength={field.endsWith("Address") ? 500 : 300} autoComplete="off" onChange={event => { setValues(current => ({ ...current, [field]: event.target.value })); setConfirmed(false); }} />)}</fieldset>
      <fieldset disabled={busy || pending} className="space-y-3"><legend className="mb-3 font-semibold">Prescribed medicines and permitted quantities</legend>
        <Input label="Find a reviewed medicine" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} placeholder="Search medicine or generic name" autoComplete="off" />
        {finding && <p role="status" className="text-sm">Finding medicines…</p>}{searchError && <p role="alert" className="text-sm text-error">{searchError}</p>}
        <ul className="max-h-44 divide-y divide-border overflow-auto rounded-control border border-border">{products.map(product => <li key={product.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-semibold">{product.name}</p><p className="text-xs text-text-secondary">{product.scheduleType.replaceAll("_", " ")} · per {product.baseUnit}</p></div><Button size="sm" variant="outline" disabled={selected.some(line => line.product.id === product.id) || selected.length >= 100} onClick={() => { setSelected(rows => [...rows, { product, quantity: "1", instructions: "" }]); setConfirmed(false); }}>Add {product.name}</Button></li>)}</ul>
        {!finding && !searchError && !products.length && <p className="text-sm text-text-secondary">No reviewed medicines found. Review classification and units in Inventory first.</p>}
        {selected.map((line, index) => <div key={line.product.id} className="grid items-end gap-3 rounded-control border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="space-y-3"><p className="font-semibold">{line.product.name}</p><Input label={`Original directions for ${line.product.name}`} value={line.instructions} maxLength={1000} onChange={event => update(index, { instructions: event.target.value })} /></div><div className="flex items-center gap-2"><QuantityInput variant="compact" label={`Permitted ${line.product.name} (${line.product.baseUnit})`} value={line.quantity} min={1} max={1_000_000} onValueChange={quantity => update(index, { quantity })} /><Button size="sm" variant="ghost" aria-label={`Remove ${line.product.name}`} onClick={() => { setSelected(rows => rows.filter((_, i) => i !== index)); setConfirmed(false); }}>Remove</Button></div></div>)}
      </fieldset>
      <Checkbox checked={confirmed} disabled={busy || pending} onChange={event => setConfirmed(event.target.checked)} label="I reviewed the signed prescription, patient and prescriber details, registration evidence, original directions, prior supplies and the remaining permitted quantities." description="The signed source is retained or referenced for inspection." />
    </div>
  </Modal>;
}
