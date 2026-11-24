"use client";
import { useState } from "react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { historicalFileDownload, readPrescriptionFileHistory, type PrescriptionFilePage } from "@/lib/pharmacyFileHistory";
import { orderError } from "@/lib/pharmacyPurchaseOrders";
import { PharmacyFileCustody } from "./PharmacyFileCustody";
export function PharmacyFileHistory(props: { locationId: string; canManage: boolean }) {
  const scope = authScopeKey(useAuthStore(state => state.user)); return <FileHistorySession key={`${scope}:${props.locationId}:${props.canManage}`} {...props} />;
}
function FileHistorySession({ locationId, canManage }: { locationId: string; canManage: boolean }) {
  const [kind, setKind] = useState(""), [source, setSource] = useState(""), [data, setData] = useState<PrescriptionFilePage | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [changed, setChanged] = useState(false);
  const begin = useLatestRead();
  function invalidate() { begin(); setBusy(false); setData(null); setError(""); setChanged(false); }
  async function load(cursor?: string) { const request = begin(); setBusy(true); setData(null); setError(""); setChanged(false); try { const value = await readPrescriptionFileHistory(locationId, kind, source.trim(), cursor, request.signal); if (request.isCurrent()) setData(value); } catch (failure) { if (request.isCurrent()) setError(orderError(failure)); } finally { if (request.isCurrent()) setBusy(false); } }
  async function download(fileId: string) { const request = begin(); setBusy(true); setError(""); try { const value = await historicalFileDownload(locationId, fileId, request.signal); if (!request.isCurrent()) return; const link = document.createElement("a"); try { link.href = value.url; link.download = value.name; link.target = "_blank"; link.rel = "noopener noreferrer"; document.body.appendChild(link); link.click(); } finally { link.remove(); } } catch (failure) { if (request.isCurrent()) setError(orderError(failure)); } finally { if (request.isCurrent()) setBusy(false); } }
  return <section aria-label="Retained prescription file history" className="min-w-0 space-y-4"><header><h2 className="text-lg font-semibold">Prescription file history</h2><p>Browse retained originals, including superseded or archived prescription sources. Historical files do not authorize a new medicine supply.</p></header><div className="grid gap-3 sm:grid-cols-2"><Select label="Prescription file source" value={kind} disabled={busy} options={[{ value: "", label: "Clinic and outside prescriptions" }, { value: "clinic", label: "Clinic prescriptions" }, { value: "outside", label: "Outside prescriptions" }]} onChange={event => { invalidate(); setKind(event.target.value); }} /><Input label="Original prescription reference (optional)" value={source} maxLength={24} disabled={busy} onChange={event => { invalidate(); setSource(event.target.value); }} /></div><Button size="sm" disabled={busy} onClick={() => { void load(); }}>Load prescription file history</Button>
    {busy && <p role="status">Loading retained file evidence…</p>}{error && <Alert variant="error" title="File history needs attention">{error}</Alert>}{changed && <Alert variant="info" title="Custody changed">Reload file history for updated file status before downloading.</Alert>}
    {data && <>{!data.items.length && <p>No retained file records match these filters.</p>}{!data.uploadsAvailable && <p>Private storage is unavailable. File history remains visible.</p>}{data.items.map(row => <article key={row.id} className="min-w-0 space-y-3 rounded-control border border-border p-3"><div className="break-words"><h3 className="font-semibold">{row.name}</h3><p>{row.sourceKind === "clinic" ? "Clinic" : "Outside"} prescription · {new Date(row.createdAt).toLocaleString()} · {Math.ceil(row.size / 1024)} KB</p><p className="text-xs">Original source: {row.prescriptionId}</p><p>{row.custody.state === "purged" ? "File bytes removed; audit record retained" : row.custody.state === "purging" ? "File removal pending; access blocked" : row.state === "pending" ? "Upload pending; original-file retry required" : "Original file retained"}{row.custody.legalHold ? " · Legal hold" : ""}</p></div>
      {row.state === "attached" && row.custody.state === "retained" && <Button size="sm" variant="outline" disabled={busy || changed || !data.uploadsAvailable} onClick={() => { void download(row.id); }}>Download historical file {row.name}</Button>}
      {canManage && <PharmacyFileCustody locationId={locationId} fileId={row.id} onChanged={() => setChanged(true)} />}
    </article>)}{data.nextCursor && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void load(data.nextCursor!); }}>Next prescription file page</Button>}</>}
  </section>;
}
