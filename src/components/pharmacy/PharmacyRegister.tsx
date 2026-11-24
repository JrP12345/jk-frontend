"use client";
import { useState } from "react";
import { Alert, Button, Checkbox, DatePicker, Input, Select } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { exportRegister, readRegister, registerCsv, type RegisterFilters, type RegisterKind, type RegisterPage } from "@/lib/pharmacyRegister";
import { orderError } from "@/lib/pharmacyPurchaseOrders";
import styles from "./PharmacyWorkspace.module.css";
const evidenceLabels: Record<string, string> = { _id: "Register reference", patientName: "Recipient name", patientAddress: "Recipient address", doctorName: "Prescriber name", doctorAddress: "Prescriber address", doctorRegNumber: "Prescriber registration", dispensedByName: "Pharmacist name", pharmacistRegNumber: "Pharmacist registration", batchNumber: "Batch", captured_supply_evidence: "Original supply linkage", expiryDate: "Expiry cutoff", manufacturer: "Manufacturer", doctorCouncil: "Prescriber council", doctorReviewReference: "Prescriber review", pharmacistCouncil: "Pharmacist council", pharmacistReviewReference: "Pharmacist review", classificationReviewReference: "Medicine classification review", signatureMode: "Signature evidence", invoiceId: "Bill reference", dispenseId: "Supply reference", prescriptionId: "Clinic prescription reference", externalPrescriptionId: "Outside prescription reference" };
export function PharmacyRegister(props: { locationId: string; canExport: boolean }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <RegisterSession key={`${scope}:${props.locationId}:${props.canExport}`} {...props} />;
}
function RegisterSession({ locationId, canExport }: { locationId: string; canExport: boolean }) {
  const [kind, setKind] = useState<RegisterKind>("schedule_h1"), [start, setStart] = useState(""), [end, setEnd] = useState(""), [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState<{ result: RegisterPage; filters: RegisterFilters } | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [reviewed, setReviewed] = useState(false), [exported, setExported] = useState("");
  const begin = useLatestRead();
  function change(action: () => void) { begin(); setLoaded(null); setBusy(false); setError(""); setReviewed(false); setExported(""); action(); }
  async function load(page = 1) {
    const request = begin(), filters: RegisterFilters = { locationId, scheduleType: kind, startDate: start, endDate: end, search: search.trim() };
    setLoaded(null); setBusy(true); setError(""); setReviewed(false); setExported("");
    try { const result = await readRegister(filters, page, request.signal); if (request.isCurrent()) setLoaded({ result, filters }); }
    catch (failure) { if (request.isCurrent()) setError(orderError(failure)); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  async function download() {
    if (!loaded || !reviewed || !canExport || busy) return;
    const request = begin(); setBusy(true); setError(""); setExported("");
    try {
      const result = await exportRegister(loaded.filters, request.signal); if (!request.isCurrent()) return;
      const url = URL.createObjectURL(new Blob([registerCsv(result.records)], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
      try { link.href = url; link.download = `pharmacy-${kind}-${result.generatedAt.slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); }
      finally { link.remove(); URL.revokeObjectURL(url); }
      setExported(`Exported ${result.records.length} records matching these filters. Generated ${new Date(result.generatedAt).toLocaleString()}.`);
    } catch (failure) { if (request.isCurrent()) setError(orderError(failure)); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  return <section className={styles.list} aria-label="Pharmacy prescription register"><h2>Prescription registers</h2><p>Read captured dispensing records. Schedule H1 and Schedule H are separate registers. Entries cannot be edited here; missing evidence stays flagged for review.</p>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); void load(); }}><Select label="Register type" value={kind} onChange={event => change(() => setKind(event.target.value as RegisterKind))} options={[{ value: "schedule_h1", label: "Schedule H1" }, { value: "schedule_h", label: "Schedule H prescription register" }]} />
      <div className={styles.fieldGrid}><DatePicker label="Register start date" value={start} onChange={value => change(() => setStart(value))} /><DatePicker label="Register end date" value={end} onChange={value => change(() => setEnd(value))} /></div>
      <Input label="Search medicine, recipient, prescriber or batch" maxLength={200} value={search} onChange={event => change(() => setSearch(event.target.value))} /><Button size="sm" type="submit" disabled={busy}>Load register</Button>
    </form>{busy && <p role="status">Reading register…</p>}{error && <Alert variant="error" title="Register unavailable">{error}</Alert>}
    {loaded && <section aria-label="Reviewed register page"><p>{loaded.result.pagination.total} matching records · This page has {loaded.result.entries.length} records. Date filters use the selected branch’s business day. Displayed times use this device’s timezone.</p>
      {!loaded.result.entries.length && <p>No matching dispensing records.</p>}
      {loaded.result.entries.map(entry => <article className={styles.card} key={entry._id}><div className={styles.identity}><strong>{entry.medicineName}</strong><span>Batch {entry.batchNumber} · Quantity {entry.quantityDispensed} base units · {new Date(entry.dispensedAt).toLocaleString()}</span><span>Recipient: {entry.patientName} · {entry.patientAddress || "Address not recorded"}</span><span>Prescriber: {entry.doctorName || "Not recorded"} · {entry.doctorRegNumber || "Registration not recorded"}</span><span>Prescriber address: {entry.doctorAddress || "Not recorded"}</span><span>Supplied by: {entry.dispensedByName || "Not recorded"} · {entry.pharmacistRegNumber || "Registration not recorded"}</span>
        {entry.requiresReview && <Alert variant="warning" title="Captured evidence needs review">Missing: {entry.missingEvidence.map(key => evidenceLabels[key] || "Additional captured evidence").join(", ")}</Alert>}
        <details><summary>Source and professional evidence</summary><dl>{["_id", "expiryDate", "manufacturer", "doctorCouncil", "doctorReviewReference", "pharmacistCouncil", "pharmacistReviewReference", "classificationReviewReference", "signatureMode", "invoiceId", "dispenseId", "prescriptionId", "externalPrescriptionId"].map(key => <div key={key}><dt>{evidenceLabels[key]}</dt><dd className={styles.reference}>{String(entry[key] ?? "Not recorded")}</dd></div>)}</dl></details>
      </div></article>)}
      <div className={styles.actions}><Button size="sm" variant="outline" disabled={busy || loaded.result.pagination.page <= 1} onClick={() => { void load(loaded.result.pagination.page - 1); }}>Previous register page</Button><Button size="sm" variant="outline" disabled={busy || loaded.result.pagination.page >= loaded.result.pagination.totalPages || loaded.result.pagination.page >= 400} onClick={() => { void load(loaded.result.pagination.page + 1); }}>Next register page</Button></div>
      {canExport && <><Checkbox label="I reviewed the branch, register and filters and will keep the exported patient records secure" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><Button size="sm" variant="outline" disabled={!reviewed || busy} onClick={() => { void download(); }}>Export all matching register records</Button><p>Exports contain sensitive patient information and all matching records, up to 10,000 rows. A fresh export is recorded in the audit trail.</p></>}
    </section>}{exported && <p role="status">{exported}</p>}
  </section>;
}
