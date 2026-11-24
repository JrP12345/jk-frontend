"use client";
import { useRef, useState } from "react";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { preparePrescriptionFile, prescriptionFileDownload, readPrescriptionFiles, uploadPrescriptionFile, type PrescriptionFiles, type PrescriptionFileSource } from "@/lib/pharmacyPrescriptionAttachments";
import { orderError } from "@/lib/pharmacyPurchaseOrders";
export function PharmacyPrescriptionAttachments(props: { locationId: string; prescriptionId: string; canUpload: boolean; sourceKind?: PrescriptionFileSource }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <FileSession key={`${scope}:${props.locationId}:${props.prescriptionId}:${props.sourceKind || "outside"}:${props.canUpload}`} {...props} scope={scope} />;
}
function FileSession({ locationId, prescriptionId, canUpload, scope, sourceKind = "outside" }: { locationId: string; prescriptionId: string; canUpload: boolean; scope: string; sourceKind?: PrescriptionFileSource }) {
  const [data, setData] = useState<PrescriptionFiles | null>(null), [file, setFile] = useState<File | null>(null), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState("");
  const begin = useLatestRead(), lock = useRef(false), input = useRef<HTMLInputElement>(null);
  async function load() {
    if (lock.current) return; const request = begin(); setData(null); setBusy(true); setError("");
    try { const result = await readPrescriptionFiles(locationId, prescriptionId, request.signal, sourceKind); if (request.isCurrent()) setData(result); }
    catch (failure) { if (request.isCurrent()) setError(orderError(failure)); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  async function upload() {
    if (!file || !confirmed || !data?.uploadsAvailable || !canUpload || lock.current) return;
    lock.current = true; const request = begin(); setBusy(true); setError(""); setSaved("");
    const current = () => request.isCurrent() && authScopeKey(useAuthStore.getState().user) === scope;
    try {
      const prepared = await preparePrescriptionFile(file); if (!current()) return;
      const result = await uploadPrescriptionFile(locationId, prescriptionId, prepared, sourceKind); if (!current()) return;
      setData(value => value ? { ...value, items: [...value.items.filter(row => row.id !== result.id), result] } : value); setSaved(`Original file retained: ${result.name}`); setFile(null); setConfirmed(false); if (input.current) input.current.value = "";
    } catch (failure) { if (current()) setError(orderError(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function download(documentId: string) {
    if (lock.current) return; const request = begin(); setBusy(true); setError("");
    try {
      const result = await prescriptionFileDownload(locationId, prescriptionId, documentId, request.signal, sourceKind); if (!request.isCurrent()) return;
      const link = document.createElement("a"); link.href = result.url; link.download = result.name; link.target = "_blank"; link.rel = "noopener noreferrer";
      try { document.body.appendChild(link); link.click(); } finally { link.remove(); }
    } catch (failure) { if (request.isCurrent()) setError(orderError(failure)); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  return <section aria-label="Original prescription files" className="min-w-0 space-y-3 rounded-control border border-border p-3"><h3 className="text-sm font-semibold">Original prescription files</h3><p className="text-sm text-text-secondary">Retain the signed image or PDF with this reviewed source. Uploading a file does not authorize supply or change the remaining quantity.</p><Button size="sm" variant="outline" disabled={busy} onClick={() => { void load(); }}>Load prescription files</Button>
    {busy && <p role="status">Checking original file…</p>}{error && <Alert variant="error" title="File result needs attention">{error}</Alert>}{saved && <p role="status">{saved}</p>}
    {data && <>{!data.uploadsAvailable && <Alert variant="warning" title="Private file storage unavailable">The owner must configure private storage before files can be attached or downloaded.</Alert>}{!data.items.length && <p>No original files attached to this source.</p>}
      {data.items.map(row => <article key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2"><div className="min-w-0 break-words text-sm"><strong>{row.name}</strong><p>{Math.ceil(row.size / 1024)} KB · {row.state === "attached" ? "Retained" : "Pending — retry with the original file"}</p></div>{row.state === "attached" && row.custody.state === "retained" && <Button size="sm" variant="outline" disabled={busy || !data.uploadsAvailable} onClick={() => { void download(row.id); }}>Download {row.name}</Button>}</article>)}
      {canUpload && data.uploadsAvailable && <div className="space-y-3"><Input ref={input} label="Original signed prescription PDF or image" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { setFile(event.target.files?.[0] || null); setConfirmed(false); setError(""); setSaved(""); }} /><Checkbox label="I checked that this original file belongs to the selected prescription and recipient" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><Button size="sm" disabled={busy || !file || !confirmed} onClick={() => { void upload(); }}>Upload original prescription file</Button><p className="text-xs text-text-secondary">Up to 4 MB per file and 10 files per source, including pending uploads. After a timeout, retry the same original file and filename. Original clinical files are retained; there is no automatic deletion.</p></div>}
    </>}
  </section>;
}
