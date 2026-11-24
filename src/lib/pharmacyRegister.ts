import api from "./api";
import { dailyDate } from "./pharmacyDailyOverview";
export type RegisterKind = "schedule_h1" | "schedule_h";
export interface RegisterFilters { locationId: string; scheduleType: RegisterKind; startDate: string; endDate: string; search: string }
export interface RegisterEntry {
  _id: string; organizationId: string; locationId: string; medicineName: string; scheduleType: RegisterKind; batchNumber: string; quantityDispensed: number; dispensedAt: string;
  patientName: string; patientAddress?: string; doctorName?: string; doctorAddress?: string; doctorRegNumber?: string; dispensedByName?: string; pharmacistRegNumber?: string;
  requiresReview: boolean; missingEvidence: string[]; [key: string]: unknown;
}
export interface RegisterPage { entries: RegisterEntry[]; pagination: { total: number; page: number; limit: number; totalPages: number } }
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const fail = (): never => { throw Error("Register response could not be verified. Reload the selected branch and filters."); };
function query(filters: RegisterFilters) {
  if (!filters.locationId || !["schedule_h1", "schedule_h"].includes(filters.scheduleType) || filters.search.length > 200 || Boolean(filters.startDate) !== Boolean(filters.endDate) || filters.startDate && (!dailyDate(filters.startDate) || !dailyDate(filters.endDate) || filters.startDate > filters.endDate)) throw Error("Select both valid dates in order, or leave both empty.");
  const params = new URLSearchParams({ locationId: filters.locationId, scheduleType: filters.scheduleType });
  if (filters.startDate) { params.set("startDate", filters.startDate); params.set("endDate", filters.endDate); } if (filters.search.trim()) params.set("search", filters.search.trim()); return params;
}
function entries(raw: unknown, filters: RegisterFilters, maximum: number): RegisterEntry[] {
  if (!Array.isArray(raw) || raw.length > maximum) return fail();
  const seen = new Set<string>();
  for (const entry of raw as RegisterEntry[]) {
    if (!entry || typeof entry._id !== "string" || !/^[a-f\d]{24}$/i.test(entry._id) || seen.has(entry._id) || entry.locationId !== filters.locationId || entry.scheduleType !== filters.scheduleType || !Number.isFinite(Date.parse(entry.dispensedAt)) || !whole(entry.quantityDispensed) || entry.quantityDispensed < 1 || typeof entry.medicineName !== "string" || typeof entry.patientName !== "string" || typeof entry.batchNumber !== "string" || typeof entry.requiresReview !== "boolean" || !Array.isArray(entry.missingEvidence) || entry.missingEvidence.some(field => typeof field !== "string") || entry.requiresReview !== Boolean(entry.missingEvidence.length)) return fail();
    seen.add(entry._id);
  }
  return raw;
}
export async function readRegister(filters: RegisterFilters, page: number, signal?: AbortSignal): Promise<RegisterPage> {
  const params = query(filters); params.set("page", String(page)); params.set("limit", "25");
  const response = await api.get(`/pharmacy/schedule-h1-register?${params}`, { signal }), body = response.data, pagination = body?.pagination;
  if (!pagination || ![pagination.total, pagination.page, pagination.limit, pagination.totalPages].every(whole) || pagination.page !== page || pagination.limit !== 25 || pagination.totalPages !== Math.ceil(pagination.total / 25)) return fail();
  const rows = entries(body.data, filters, 25); if (rows.length !== Math.min(25, Math.max(0, pagination.total - (page - 1) * 25))) return fail();
  return { entries: rows, pagination };
}
export async function exportRegister(filters: RegisterFilters, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/schedule-h1-register/export?${query(filters)}`, { signal }), data = response.data?.data;
  if (!data || data.locationId !== filters.locationId || data.scheduleType !== filters.scheduleType || !Number.isFinite(Date.parse(data.generatedAt)) || data.filters?.startDate !== (filters.startDate || null) || data.filters?.endDate !== (filters.endDate || null) || data.filters?.search !== filters.search.trim()) return fail();
  const records = entries(data.records, filters, 10000); if (data.totalRecords !== records.length) return fail(); return { generatedAt: data.generatedAt as string, records };
}
const columns = ["_id", "recordVersion", "dispensedAt", "scheduleType", "medicineName", "genericName", "manufacturer", "batchNumber", "expiryDate", "quantityDispensed", "patientName", "patientAddress", "patientPhone", "doctorName", "doctorAddress", "doctorRegNumber", "doctorCouncil", "doctorReviewReference", "doctorReviewRevision", "dispensedByName", "pharmacistRegNumber", "pharmacistCouncil", "pharmacistReviewReference", "pharmacistReviewRevision", "classificationReviewReference", "signatureMode", "organizationId", "locationId", "medicineId", "batchId", "batchKey", "invoiceId", "dispenseId", "externalPrescriptionId", "externalPrescriptionRevision", "patientId", "doctorId", "prescriptionId", "encounterId", "clinicalNoteId", "dispensedBy", "requiresReview", "missingEvidence"];
function csvCell(value: unknown) { let text = Array.isArray(value) ? value.join("; ") : String(value ?? ""); if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; }
export function registerCsv(records: RegisterEntry[]) { return "\uFEFF" + [columns.map(csvCell).join(","), ...records.map(row => columns.map(key => csvCell(row[key])).join(","))].join("\r\n"); }
