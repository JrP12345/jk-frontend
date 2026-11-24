import api from "./api";
import { verifiedFileCustody, type FileCustody } from "./pharmacyFileCustody";
export interface PrescriptionFile { id: string; name: string; contentType: string; size: number; sha256: string; state: "pending" | "attached"; attachedAt: string | null; custody: FileCustody }
export type PrescriptionFileSource = "outside" | "clinic";
const sourcePath = (kind: PrescriptionFileSource) => kind === "clinic" ? "clinic-prescriptions" : "external-prescriptions";
export interface PrescriptionFiles { sourceKind: PrescriptionFileSource; locationId: string; prescriptionId: string; uploadsAvailable: boolean; items: PrescriptionFile[] }
const mimes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export function verifiedPrescriptionFile(raw: unknown): PrescriptionFile {
  const row = raw as PrescriptionFile;
  if (!row || !/^[a-f\d]{24}$/i.test(row.id) || typeof row.name !== "string" || !row.name.trim() || row.name.length > 255 || !mimes.includes(row.contentType) || !Number.isSafeInteger(row.size) || row.size < 1 || row.size > 4 * 1024 * 1024 || !/^[a-f\d]{64}$/.test(row.sha256) || !["pending", "attached"].includes(row.state) || (row.state === "attached" ? typeof row.attachedAt !== "string" || !Number.isFinite(Date.parse(row.attachedAt)) : row.attachedAt !== null)) throw Error("Prescription file evidence could not be verified.");
  verifiedFileCustody(row.custody); return row;
}
export async function readPrescriptionFiles(locationId: string, prescriptionId: string, signal?: AbortSignal, sourceKind: PrescriptionFileSource = "outside"): Promise<PrescriptionFiles> {
  const response = await api.get(`/pharmacy/${sourcePath(sourceKind)}/${encodeURIComponent(prescriptionId)}/files`, { params: { locationId }, signal }), data = response.data?.data;
  if (!data || data.sourceKind !== sourceKind || data.locationId !== locationId || data.prescriptionId !== prescriptionId || typeof data.uploadsAvailable !== "boolean" || !Array.isArray(data.items) || data.items.length > 10) throw Error("Prescription files could not be loaded completely.");
  const items = data.items.map(verifiedPrescriptionFile); if (new Set(items.map((row: PrescriptionFile) => row.id)).size !== items.length) throw Error("Prescription file list repeats evidence."); return { ...data, items };
}
export async function preparePrescriptionFile(file: File) {
  if (!file.size || file.size > 4 * 1024 * 1024 || !mimes.includes(file.type) || !file.name.trim() || file.name.length > 255) throw Error("Choose a PDF, PNG, JPEG or WebP file up to 4 MB.");
  const base64Data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(Error("Original file could not be read.")); reader.onload = () => { const result = reader.result; if (typeof result !== "string" || !result.includes(",")) reject(Error("Original file could not be read.")); else resolve(result.slice(result.indexOf(",") + 1)); }; reader.readAsDataURL(file); });
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([file.name, file.type, base64Data])));
  const key = `rxfile-${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
  return { key, name: file.name, contentType: file.type, base64Data };
}
export async function uploadPrescriptionFile(locationId: string, prescriptionId: string, prepared: Awaited<ReturnType<typeof preparePrescriptionFile>>, sourceKind: PrescriptionFileSource = "outside") {
  const { key, ...file } = prepared;
  const response = await api.post(`/pharmacy/${sourcePath(sourceKind)}/${encodeURIComponent(prescriptionId)}/files`, { locationId, ...file, confirmed: true }, { headers: { "Idempotency-Key": key } });
  const result = verifiedPrescriptionFile(response.data?.data); if (result.state !== "attached" || result.custody.state !== "retained") throw Error("File is pending or removal is underway. Reload the original record before proceeding."); return result;
}
export async function prescriptionFileDownload(locationId: string, prescriptionId: string, documentId: string, signal?: AbortSignal, sourceKind: PrescriptionFileSource = "outside") {
  const response = await api.get(`/pharmacy/${sourcePath(sourceKind)}/${encodeURIComponent(prescriptionId)}/file-download`, { params: { locationId, documentId }, signal }), data = response.data?.data;
  const url = new URL(data?.url);
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.endsWith(".r2.cloudflarestorage.com") || typeof data.name !== "string" || data.expiresInSeconds !== 60) throw Error("Private file download could not be verified.");
  return { url: url.href, name: data.name as string };
}
