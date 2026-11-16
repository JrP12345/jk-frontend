import api from "./api";
import type { CounterInvoice } from "./pharmacyCollections";
import { canPrintPharmacyInvoice } from "./pharmacyInvoice";

export interface ExternalMedicine { id: string; name: string; genericName: string; scheduleType: string; baseUnit: string; unitVersion: number; dispensingRevision: number }
export interface ExternalPrescriptionInput {
  locationId: string; reference: string; issuedOn: string; validUntil: string; patientName: string; patientAddress: string; patientPhone: string;
  prescriberName: string; prescriberAddress: string; prescriberRegistration: string; prescriberCouncil: string; prescriberReviewReference: string; sourceReference: string; reviewConfirmed: boolean;
  lines: Array<{ medicineId: string; quantity: number; expectedUnitVersion: number; expectedDispensingRevision: number; instructions: string }>;
}
export interface ExternalPrescriptionSummary { id: string; locationId?: string; reference: string; patientName: string; revision: number; status: "approved" | "completed" | "cancelled"; validUntil: string }
export interface ExternalPrescription extends ExternalPrescriptionSummary, Omit<ExternalPrescriptionInput, "lines" | "locationId"> {
  locationId: string; reviewedAt: string;
  lines: Array<ExternalPrescriptionInput["lines"][number] & { name: string; baseUnit: string; supplied: number }>;
  supplies: Array<{ invoiceId: string; invoiceNumber: string; suppliedAt: string; lines: Array<{ medicineId: string; quantity: number }> }>;
}
export function parseExternalPrescription(raw: ExternalPrescription, locationId: string) {
  if (!raw || !raw.id || raw.locationId !== locationId || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || !["approved", "completed", "cancelled"].includes(raw.status) || !Number.isFinite(Date.parse(raw.validUntil)) ||
    !raw.patientName || !raw.patientAddress || !raw.prescriberName || !raw.prescriberRegistration || !Array.isArray(raw.lines) || !raw.lines.length || raw.lines.length > 100 || new Set(raw.lines.map(line => line.medicineId)).size !== raw.lines.length ||
    raw.lines.some(line => !line.medicineId || !line.name || !line.baseUnit || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || !Number.isSafeInteger(line.supplied) || line.supplied < 0 || line.supplied > line.quantity || !Number.isSafeInteger(line.expectedUnitVersion) || line.expectedUnitVersion < 1) || !Array.isArray(raw.supplies) || raw.supplies.length > 100) throw Error("Prescription evidence is incomplete. Reload before supplying.");
  return raw;
}
export async function externalPrescriptions(locationId: string, cursor?: string, signal?: AbortSignal) {
  const page = (await api.get("/pharmacy/external-prescriptions", { params: { locationId, ...(cursor ? { cursor } : {}) }, signal })).data?.data;
  if (!Array.isArray(page?.items) || page.items.length > 25 || page.items.some((row: ExternalPrescriptionSummary) => !row.id || !row.reference || !row.patientName || !["approved", "completed", "cancelled"].includes(row.status)) || page.nextCursor !== null && typeof page.nextCursor !== "string") throw Error("Prescription list could not be verified");
  return page as { items: ExternalPrescriptionSummary[]; nextCursor: string | null };
}
export async function readExternalPrescription(locationId: string, id: string, signal?: AbortSignal) { return parseExternalPrescription((await api.get(`/pharmacy/external-prescriptions/${encodeURIComponent(id)}`, { params: { locationId }, signal })).data?.data, locationId); }
export async function recordExternalPrescription(input: ExternalPrescriptionInput, key: string) { return parseExternalPrescription((await api.post("/pharmacy/external-prescriptions", input, { headers: { "Idempotency-Key": key } })).data?.data, input.locationId); }
export async function cancelExternalPrescription(row: ExternalPrescription) { return parseExternalPrescription((await api.post(`/pharmacy/external-prescriptions/${row.id}/cancel`, { locationId: row.locationId, expectedRevision: row.revision })).data?.data, row.locationId); }
export async function readExternalPrescriptionBill(locationId: string, invoiceId: string) {
  const bill = (await api.get(`/pharmacy/external-prescription-invoices/${encodeURIComponent(invoiceId)}`, { params: { locationId } })).data?.data as CounterInvoice;
  if (bill?.id !== invoiceId || bill.locationId !== locationId || !canPrintPharmacyInvoice(bill)) throw Error("Saved prescription bill is incomplete; do not print");
  return bill;
}
export async function externalMedicines(locationId: string, search: string, signal?: AbortSignal) {
  const page = (await api.get("/pharmacy/external-prescriptions/products", { params: { locationId, search }, signal })).data?.data;
  if (!Array.isArray(page?.items) || page.items.length > 50 || page.items.some((row: ExternalMedicine) => !row.id || !row.name || !row.baseUnit || !Number.isSafeInteger(row.unitVersion) || row.unitVersion < 1 || !Number.isSafeInteger(row.dispensingRevision) || row.dispensingRevision < 1 || !["general", "schedule_h", "schedule_h1"].includes(row.scheduleType))) throw Error("Reviewed medicines could not be loaded");
  return page.items as ExternalMedicine[];
}
