import api from "./api";
export interface FileCustody { revision: number; state: "retained" | "purging" | "purged"; retainUntil: string | null; legalHold: boolean; pendingUploads: number; purgedAt: string | null }
export interface FileRemovalInput { locationId: string; expectedRevision: number; confirmedIrreversibleRemoval: true; reviewReference: string }
export interface FileCustodyRecord extends FileCustody { fileId: string; locationId: string; policyReference: string; reviewReference: string; holdReason: string; removal?: { key: string; input: FileRemovalInput } | null }
const iso = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function verifiedFileCustody(value: unknown): FileCustody {
  const row = value as FileCustody;
  if (!row || !Number.isSafeInteger(row.revision) || row.revision < 0 || !["retained", "purging", "purged"].includes(row.state) || row.retainUntil !== null && !iso(row.retainUntil) || typeof row.legalHold !== "boolean" || !Number.isSafeInteger(row.pendingUploads) || row.pendingUploads < 0 || row.pendingUploads > 20 || (row.state === "purged" ? !iso(row.purgedAt) : row.purgedAt !== null) || row.state !== "retained" && (row.legalHold || row.pendingUploads)) throw Error("File retention evidence could not be verified. Reload the original record.");
  return row;
}
function record(value: unknown, locationId: string, fileId: string): FileCustodyRecord {
  const row = value as FileCustodyRecord; verifiedFileCustody(row);
  if (row.fileId !== fileId || row.locationId !== locationId || [row.policyReference, row.reviewReference, row.holdReason].some(text => typeof text !== "string" || text.length > 1000)) throw Error("File custody record does not match this branch and original file.");
  if (row.removal) { const removal = row.removal; if (!/^[a-zA-Z0-9_-]{8,100}$/.test(removal.key) || removal.input?.locationId !== locationId || removal.input.confirmedIrreversibleRemoval !== true || !Number.isSafeInteger(removal.input.expectedRevision) || removal.input.expectedRevision < 0 || typeof removal.input.reviewReference !== "string" || removal.input.reviewReference.trim().length < 3) throw Error("Original removal recovery evidence needs review."); }
  return row;
}
export async function readFileCustody(locationId: string, fileId: string, signal?: AbortSignal) { return record((await api.get(`/pharmacy/prescription-files/${encodeURIComponent(fileId)}/custody`, { params: { locationId }, signal })).data?.data, locationId, fileId); }
export async function updateFileCustody(locationId: string, fileId: string, input: { expectedRevision: number; retainUntil: string | null; legalHold: boolean; policyReference: string; reviewReference: string; holdReason: string; confirmed: true }) { return record((await api.put(`/pharmacy/prescription-files/${encodeURIComponent(fileId)}/custody`, { locationId, ...input })).data?.data, locationId, fileId); }
export async function reconcileFileUploads(locationId: string, fileId: string, expectedRevision: number, reviewReference: string) { return record((await api.post(`/pharmacy/prescription-files/${encodeURIComponent(fileId)}/reconcile-uploads`, { locationId, expectedRevision, confirmedProviderRequestsSettled: true, reviewReference })).data?.data, locationId, fileId); }
export async function removeFileBytes(fileId: string, key: string, input: FileRemovalInput) {
  const value = (await api.post(`/pharmacy/prescription-files/${encodeURIComponent(fileId)}/remove-bytes`, input, { headers: { "Idempotency-Key": key } })).data?.data; verifiedFileCustody(value);
  if (value.fileId !== fileId || value.locationId !== input.locationId || value.requestKey !== key || value.state !== "purged") throw Error("File removal is not confirmed. Reload and recover the original request."); return value as FileCustody;
}
export function retentionTimestamp(value: string) {
  const timestamp = `${value}:00.000Z`; if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !iso(timestamp)) throw Error("Enter the reviewed UTC date and time, or retain indefinitely."); return timestamp;
}
