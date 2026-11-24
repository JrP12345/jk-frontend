"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import styles from "./PharmacyWorkspace.module.css";
type ExtractedRow = { line: number; description: string; productCode: string; quantity: string; unit: string; unitPrice: string; amount: string; taxRate: string; confidencePercent: number | null };
type Extraction = { id: string; locationId: string; supplierId: string; requestKey: string; status: string; failureReason?: string; extracted: { supplier: string; invoiceNumber: string; invoiceDate: string; invoiceTotal: string; rows: ExtractedRow[] } | null };
const errorMessage = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure as Error).message || "Invoice extraction is unavailable";
const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
export function PharmacyInvoiceExtraction({ locationId, supplierId, onCsv }: { locationId: string; supplierId: string; onCsv: (csv: string) => void }) {
  const [open, setOpen] = useState(false), scope = authScopeKey(useAuthStore(state => state.user));
  return <details className={styles.card} onToggle={event => setOpen(event.currentTarget.open)}><summary>Extract a supplier invoice PDF or photo</summary>{open && <ExtractionSession key={`${scope}:${locationId}:${supplierId}`} locationId={locationId} supplierId={supplierId} onCsv={onCsv} />}</details>;
}
function ExtractionSession({ locationId, supplierId, onCsv }: { locationId: string; supplierId: string; onCsv: (csv: string) => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), storageKey = `pharmacy-ocr:${scope}:${locationId}:${supplierId}`;
  const [file, setFile] = useState<File | null>(null), [consent, setConsent] = useState(false), [reviewed, setReviewed] = useState(false), [key, setKey] = useState<string | null>(null), [result, setResult] = useState<Extraction | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), alive = useRef(true), frozen = useRef<{ key: string; input: object } | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [missing, setMissing] = useState(false);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; try { const saved = sessionStorage.getItem(storageKey); if (saved && !/^[a-zA-Z0-9_-]{8,100}$/.test(saved)) throw Error("Saved extraction reference requires review"); setKey(saved); } catch (failure) { setError(errorMessage(failure)); } return () => { alive.current = false; }; }, [storageKey]);
  function validate(value: Extraction, expected: string) {
    if (!value || value.locationId !== locationId || value.supplierId !== supplierId || value.requestKey !== expected || !["submitting", "processing", "succeeded", "failed", "unknown"].includes(value.status) || value.status === "succeeded" && (!value.extracted || !Array.isArray(value.extracted.rows) || !value.extracted.rows.length || value.extracted.rows.length > 100)) throw Error("Extraction does not match the original request");
    return value;
  }
  async function check(reference = key) {
    if (!reference || lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const response = await api.get(`/pharmacy/invoice-extractions/${reference}`, { params: { locationId, supplierId } }); const value = validate(response.data?.data, reference); if (current()) setResult(value); }
    catch (failure) { if (current()) { setError(errorMessage(failure)); if ((failure as { response?: { status?: number } }).response?.status === 404) { setMissing(true); frozen.current = null; setCanRetry(false); } } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function start() {
    if (lock.current || !consent || !file || key && !frozen.current && !missing) return; lock.current = true; setBusy(true); setError("");
    try {
      if (!frozen.current) {
        if (!file.size || file.size > 4 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg"].includes(file.type)) throw Error("Choose a PDF, PNG or JPEG up to 4 MB");
        const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ""; for (let at = 0; at < bytes.length; at += 8192) binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
        const command = { key: key || crypto.randomUUID(), input: { locationId, supplierId, name: file.name, contentType: file.type, base64Data: btoa(binary), processingConfirmed: true } };
        if (!current()) return; sessionStorage.setItem(storageKey, command.key); frozen.current = command; setKey(command.key); setCanRetry(true); setMissing(false);
      }
      const command = frozen.current, response = await api.post("/pharmacy/invoice-extractions", command.input, { headers: { "Idempotency-Key": command.key } });
      if (response.data?.data?.requestKey !== command.key || response.data?.data?.locationId !== locationId || response.data?.data?.supplierId !== supplierId) throw Error("Extraction acceptance could not be confirmed. Check the same reference");
      if (current()) setResult(null);
    } catch (failure) { if (current()) setError(errorMessage(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function useText() {
    if (!result?.extracted || !reviewed) return;
    const csv = [["source", "ocrProductCode", "ocrQuantity", "ocrUnit", "ocrUnitPrice", "ocrAmount", "ocrTaxRate"], ...result.extracted.rows.map(row => [row.description || row.productCode, row.productCode, row.quantity, row.unit, row.unitPrice, row.amount, row.taxRate])].map(row => row.map(cell).join(",")).join("\r\n");
    onCsv(csv);
  }
  return <section className={styles.list}><p>Uses the configured Azure OCR service. Only upload a supplier invoice you are authorized to process. OCR text needs review against the original; pack quantities, GST, batch, expiry and prices are never approved automatically.</p>
    {error && <Alert variant="error" title="Invoice extraction needs attention">{error}</Alert>}
    {(!key || missing) && <fieldset className={styles.form} disabled={busy}>{missing && <p>No saved extraction was found. Select the original file to retry with the same reference.</p>}<Input label="Invoice PDF or photo" type="file" accept="application/pdf,image/png,image/jpeg" onChange={event => { setFile(event.target.files?.[0] || null); setConsent(false); }} /><Checkbox label="I authorize sending this supplier invoice to the configured OCR provider" checked={consent} onChange={event => setConsent(event.target.checked)} /><Button size="sm" disabled={!file || !consent} onClick={() => { void start(); }}>Extract invoice text</Button></fieldset>}
    {key && <><p className="break-all">Extraction reference: {key}</p><Button size="sm" disabled={busy} onClick={() => { void check(); }}>Check extraction status</Button>{!result && canRetry && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void start(); }}>Retry same extraction request</Button>}</>}
    {busy && <p role="status">Checking invoice extraction...</p>}{result && <p>Status: {result.status}. {result.failureReason}</p>}
    {result?.extracted && <><p>Extracted supplier: {result.extracted.supplier || "Unknown"} · Invoice: {result.extracted.invoiceNumber || "Unknown"} · Date: {result.extracted.invoiceDate || "Unknown"} · Total: {result.extracted.invoiceTotal || "Unknown"}</p><div className={styles.reportTable}><table><caption>Unreviewed invoice text</caption><thead><tr>{["Item", "Quantity", "Unit", "Unit price", "Amount", "Tax", "Confidence"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.extracted.rows.map(row => <tr key={row.line}><td>{row.description || row.productCode}</td><td>{row.quantity}</td><td>{row.unit}</td><td>{row.unitPrice}</td><td>{row.amount}</td><td>{row.taxRate}</td><td>{row.confidencePercent === null ? "Unknown" : `${row.confidencePercent}%`}</td></tr>)}</tbody></table></div><Checkbox label="I checked the extracted text against the original invoice; I will map units and review prices and tax next" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><Button size="sm" disabled={!reviewed || busy} onClick={useText}>Use reviewed text in CSV mapping</Button></>}
    {result && ["succeeded", "failed", "unknown"].includes(result.status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { sessionStorage.removeItem(storageKey); setKey(null); setResult(null); frozen.current = null; setCanRetry(false); setConsent(false); setReviewed(false); }}>Start a separate extraction</Button>}
  </section>;
}
