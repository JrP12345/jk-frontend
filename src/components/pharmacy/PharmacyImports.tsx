"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { downloadImport, importError, inspectImport, listImports, pharmacyImportLabels, postImportChunk, previewImport, readImport, type ImportInspection, type ImportView, type PharmacyImportKind } from "@/lib/pharmacyImports";
import styles from "./PharmacyWorkspace.module.css";

const fieldLabel = (field: string) => ({ sourceId: "Actual source row ID", medicineId: "Existing product ID", partyId: "Existing party ID", sourceDate: "Actual source date (YYYY-MM-DD)",
  baseUnit: "Base unit", packUnit: "Pack unit", unitsPerPack: "Units per pack", packs: "Full packs", looseUnits: "Loose base units", batchNumber: "Printed batch", expiryPrecision: "Printed expiry precision (day/month)",
  expiry: "Printed expiry (YYYY-MM-DD / YYYY-MM)", purchaseTotal: "Total acquisition cost (INR)", sellingPrice: "Selling price per base unit (INR)", mrp: "MRP per base unit (INR)", amount: "Actual due (INR)",
  name: "Product name", genericName: "Generic/formulation", category: "Medicine form", scheduleType: "Source schedule classification", barcode: "Barcode", manufacturer: "Manufacturer", strength: "Strength", reorderLevel: "Reorder level" }[field] || field);
const currency = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
interface Props { locationId: string; allowedKinds: PharmacyImportKind[]; onCommitted: () => void }
export function PharmacyImports(props: Props) {
  const user = useAuthStore(state => state.user);
  return <ImportSession key={`${authScopeKey(user)}:${props.locationId}:${props.allowedKinds.join(",")}`} {...props} />;
}
function ImportSession({ locationId, allowedKinds, onCommitted }: Props) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user);
  const [kind, setKind] = useState<PharmacyImportKind>(allowedKinds[0] || "catalogue"), [csv, setCsv] = useState(""), [fileName, setFileName] = useState("");
  const [inspection, setInspection] = useState<ImportInspection | null>(null), [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileVersion, setFileVersion] = useState(0);
  const [sourceReference, setSourceReference] = useState(""), [reviewReference, setReviewReference] = useState("");
  const [view, setView] = useState<ImportView | null>(null), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listImports>>>({ items: [], nextCursor: null });
  const alive = useRef(true), lock = useRef(false), request = useRef<AbortController | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController(); request.current = controller;
    void listImports(locationId, undefined, controller.signal).then(result => { if (!controller.signal.aborted) setHistory(result); })
      .catch(async failure => { const message = await importError(failure); if (!controller.signal.aborted) setError(message); });
    return () => { alive.current = false; controller.abort(); request.current?.abort(); };
  }, [locationId]);
  async function perform(work: (signal: AbortSignal) => Promise<void>) {
    if (!current() || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    try { await work(controller.signal); }
    catch (failure) { const message = await importError(failure); if (current()) setError(message); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function newFile() { setView(null); setConfirmed(false); setCsv(""); setFileName(""); setInspection(null); setMapping({}); setError(""); setFileVersion(value => value + 1); }
  async function chooseFile(file: File | undefined) {
    if (!file) return;
    await perform(async signal => {
      setCsv(""); setFileName(""); setInspection(null); setMapping({}); setView(null); setConfirmed(false);
      if (file.size > 512000) throw new Error("Choose a UTF-8 CSV of at most 512,000 bytes and 200 source rows.");
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); } catch { throw new Error("Save the source as UTF-8 CSV before importing."); }
      if (!current()) return;
      const result = await inspectImport(locationId, kind, text, signal);
      if (current()) { setCsv(text); setFileName(file.name); setInspection(result); setMapping(Object.fromEntries(result.fields.filter(field => result.headers.includes(field)).map(field => [field, field]))); setView(null); setConfirmed(false); }
    });
  }
  async function preview(event: React.FormEvent) {
    event.preventDefault();
    await perform(async signal => {
      const result = await previewImport({ locationId, kind, csv, mapping: Object.fromEntries(Object.entries(mapping).filter(([, value]) => Boolean(value))), sourceReference, reviewReference }, signal);
      if (current()) { setView(result); setConfirmed(false); }
    });
  }
  async function open(id: string) {
    await perform(async signal => { const result = await readImport(locationId, id, signal); if (current()) { setView(result); setKind(result.kind); setConfirmed(false); } });
  }
  async function check() { if (view) await open(view.id); }
  async function post() {
    if (!view || !confirmed) return;
    const sourceKeys = view.units.filter(unit => ["unprocessed", "failed"].includes(unit.status)).slice(0, 10).map(unit => unit.sourceKey);
    await perform(async signal => {
      const result = await postImportChunk(view, sourceKeys, signal);
      if (current()) { setView(result); onCommitted(); }
    });
  }
  async function download() {
    if (!view) return;
    await perform(async signal => {
      const blob = await downloadImport(view, signal);
      if (!current()) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      try { anchor.href = url; anchor.download = "pharmacy-import-reconciliation.csv"; anchor.click(); } finally { URL.revokeObjectURL(url); }
    });
  }
  if (!allowedKinds.length) return <p>Current import source permissions are required.</p>;
  const pending = view?.units.filter(unit => ["unprocessed", "failed"].includes(unit.status)).length || 0;
  return <section aria-label="Reviewed pharmacy CSV import" className="space-y-4">
    <p className="text-sm text-text-secondary">Import up to 200 actual source rows. Catalogue creates empty products; opening stock requires explicit existing product IDs and units. Opening dues require existing party IDs and real dated evidence. Supply, tax and stock history are never inferred from an old sale bill.</p>
    {error && <Alert variant="error" title="Import needs attention">{error}</Alert>}
    {!view ? <form onSubmit={preview} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
      <Select label="Import kind" value={kind} onChange={event => { setKind(event.target.value as PharmacyImportKind); newFile(); }} options={allowedKinds.map(value => ({ value, label: pharmacyImportLabels[value] }))} />
      <Input label="UTF-8 source CSV" type="file" accept=".csv,text/csv" key={`${kind}:${fileVersion}`} onChange={event => { void chooseFile(event.target.files?.[0]); }} />
      {fileName && <p>{fileName}: {inspection?.rowCount} source rows.</p>}
      <Input label="Actual source/count reference *" value={sourceReference} maxLength={50} onChange={event => setSourceReference(event.target.value)} required />
      <Input label="Source review reference *" value={reviewReference} maxLength={200} onChange={event => setReviewReference(event.target.value)} required />
      {inspection && <div className={styles.fieldGrid}>{inspection.fields.map(field => <Select key={field} label={`${fieldLabel(field)}${inspection.optionalFields.includes(field) ? " (optional)" : " *"}`} value={mapping[field] || ""}
        onChange={event => setMapping(previous => ({ ...previous, [field]: event.target.value }))} options={[{ value: "", label: "Select CSV column" }, ...inspection.headers.map(header => ({ value: header, label: header }))]} />)}</div>}
      <Button type="submit" loading={busy} disabled={!csv || !inspection || !sourceReference.trim() || reviewReference.trim().length < 3 || inspection.fields.some(field => !inspection.optionalFields.includes(field) && !mapping[field])}>Preview source import</Button>
    </fieldset></form> : <div className="space-y-4">
      <div className={styles.rowHeading}><div><strong>{pharmacyImportLabels[view.kind]}</strong><p>{view.sourceReference}</p><p className="text-sm">Review: {view.reviewReference}</p></div><Button variant="outline" disabled={busy} onClick={newFile}>Start another file</Button></div>
      <p role="status">{view.counts.posted} posted, {view.counts.invalid} invalid, {view.counts.failed} failed or needing review, {view.counts.unprocessed} unprocessed source units.</p>
      <p className="text-sm">Totals cover {view.totals.validRows} valid preview rows; {view.totals.invalidRows} rows are excluded. {view.kind === "opening_stock" ? `Acquisition cost ${currency(view.totals.acquisitionPaise)}. ${view.totals.baseQuantities.map(item => `${item.quantity} ${item.baseUnit}`).join("; ")}` : view.kind.endsWith("dues") ? `Actual opening dues ${currency(view.totals.duesPaise)}.` : "Products are created with zero stock; dispensing and tax approvals remain separate."}</p>
      {view.kind === "opening_stock" && <p className="text-sm">Each product and all its opening lots post together. Review every lot in that product group; any invalid lot prevents the whole group from posting.</p>}
      <div className={styles.reportTable}><table><thead><tr><th>Source line</th><th>Actual source ID</th><th>State</th><th>Review/error</th></tr></thead><tbody>{view.rows.map(row => {
        const unit = view.units.find(item => item.sourceKey === row.sourceKey)!;
        return <tr key={row.sourceLine}><td>{row.sourceLine}</td><td>{row.sourceId || "Missing"}</td><td>{unit.status}</td><td>{row.error || unit.error || (unit.status === "posted" ? "Original source result recorded" : unit.status === "invalid" ? "Another row in this product group needs review" : "Reviewed source; awaiting posting")}</td></tr>;
      })}</tbody></table></div>
      {pending > 0 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I confirm these valid sources match the reviewed physical stock or actual opening dues. Post only valid source units.</label>}
      <div className={styles.actions}><Button disabled={busy || !confirmed || !pending} loading={busy} onClick={() => { void post(); }}>Post next {Math.min(10, pending)} source units</Button>
        <Button variant="outline" disabled={busy} onClick={() => { void check(); }}>Check saved import</Button><Button variant="outline" disabled={busy} onClick={() => { void download(); }}>Download reconciliation CSV</Button></div>
      <p className="text-sm text-text-secondary">After a connection failure, check this saved import before retrying. Posted source facts cannot be overwritten by changing the file, mapping or review reference. Use the existing reviewed stock/credit correction workflow for a posted error.</p>
    </div>}
    <details><summary>Saved imports for this operator</summary><div className="space-y-2 pt-2">{history.items.length ? history.items.map(item => <Button key={item.id} variant="outline" size="sm" disabled={busy} onClick={() => { void open(item.id); }}>{pharmacyImportLabels[item.kind]} — {new Date(item.createdAt).toLocaleString()}</Button>) : <p>No saved imports on this page.</p>}
      <div className={styles.actions}><Button variant="outline" size="sm" disabled={busy} onClick={() => { void perform(async signal => { const result = await listImports(locationId, undefined, signal); if (current()) setHistory(result); }); }}>Reload saved imports</Button>
        {history.nextCursor && <Button variant="outline" size="sm" disabled={busy} onClick={() => { void perform(async signal => { const result = await listImports(locationId, history.nextCursor!, signal); if (current()) setHistory(result); }); }}>Older imports</Button>}</div>
    </div></details>
  </section>;
}
