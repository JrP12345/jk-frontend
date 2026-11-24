import api from "./api";
import { verifiedPrescriptionFile, type PrescriptionFile, type PrescriptionFileSource } from "./pharmacyPrescriptionAttachments";
export interface HistoricalPrescriptionFile extends PrescriptionFile { sourceKind: PrescriptionFileSource; prescriptionId: string; createdAt: string }
export interface PrescriptionFilePage { locationId: string; uploadsAvailable: boolean; items: HistoricalPrescriptionFile[]; nextCursor: string | null }
const id = (value: unknown) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
export async function readPrescriptionFileHistory(locationId: string, sourceKind: string, prescriptionId: string, cursor?: string, signal?: AbortSignal): Promise<PrescriptionFilePage> {
  if (sourceKind && !["clinic", "outside"].includes(sourceKind) || prescriptionId && !id(prescriptionId)) throw Error("Use the original prescription reference, or leave it blank to browse file history.");
  const value = (await api.get("/pharmacy/prescription-files", { params: { locationId, ...(sourceKind ? { sourceKind } : {}), ...(prescriptionId ? { prescriptionId } : {}), ...(cursor ? { cursor } : {}) }, signal })).data?.data as PrescriptionFilePage;
  if (!value || value.locationId !== locationId || typeof value.uploadsAvailable !== "boolean" || !Array.isArray(value.items) || value.items.length > 25 || value.nextCursor !== null && !id(value.nextCursor) || new Set(value.items.map(row => row.id)).size !== value.items.length) throw Error("Prescription file history could not be verified completely.");
  for (const row of value.items) { verifiedPrescriptionFile(row); if (!id(row.prescriptionId) || !["outside", "clinic"].includes(row.sourceKind) || sourceKind && row.sourceKind !== sourceKind || prescriptionId && row.prescriptionId !== prescriptionId || !Number.isFinite(Date.parse(row.createdAt))) throw Error("Prescription file history differs from the reviewed source filters."); }
  return value;
}
export async function historicalFileDownload(locationId: string, fileId: string, signal?: AbortSignal) {
  const value = (await api.get(`/pharmacy/prescription-files/${encodeURIComponent(fileId)}/download`, { params: { locationId }, signal })).data?.data, url = new URL(value?.url);
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.endsWith(".r2.cloudflarestorage.com") || typeof value.name !== "string" || value.expiresInSeconds !== 60) throw Error("Historical file download could not be verified."); return { url: url.href, name: value.name as string };
}
