import api from "./api";
import { organizationPath } from "@/services/organization.service";
import { pharmacyNumberPrefix, type PharmacyNumberFormat } from "./pharmacyInvoiceNumberFormat";

export interface PharmacyNumberingSettings {
  organizationId: string; locationId: string; revision: number; financialYear: string;
  configuration: (PharmacyNumberFormat & { reviewReference: string }) | null;
  nextNumber: number | null; preview: string | null;
}
export function parsePharmacyNumbering(value: unknown, locationId: string, organizationId: string): PharmacyNumberingSettings {
  const row = value as PharmacyNumberingSettings | null;
  if (!row || row.locationId !== locationId || row.organizationId !== organizationId || !Number.isSafeInteger(row.revision) || row.revision < 0 ||
      !/^20\d{2}-\d{2}$/.test(row.financialYear)) throw new Error("Numbering settings do not match this branch. Reload before saving.");
  if (row.configuration === null) {
    if (row.revision !== 0 || row.nextNumber !== null || row.preview !== null) throw new Error("Default numbering could not be confirmed.");
  } else {
    const prefix = pharmacyNumberPrefix(row.configuration, row.financialYear), next = row.nextNumber;
    if (row.revision < 1 || !Number.isSafeInteger(next) || next! < 1 || next! > 10 ** row.configuration.digits ||
        typeof row.configuration.reviewReference !== "string" || row.configuration.reviewReference.length < 3 || row.configuration.reviewReference.length > 500 ||
        row.preview !== (next! < 10 ** row.configuration.digits ? `${prefix}${String(next).padStart(row.configuration.digits, "0")}` : null)) throw new Error("Next invoice number could not be confirmed. Reload before saving.");
  }
  return row;
}
const path = (locationId: string, organizationId: string) => organizationPath(`/pharmacy/locations/${encodeURIComponent(locationId)}/invoice-numbering`, organizationId);
export async function readPharmacyNumbering(locationId: string, organizationId: string, signal: AbortSignal) {
  return parsePharmacyNumbering((await api.get(path(locationId, organizationId), { signal })).data?.data, locationId, organizationId);
}
export async function savePharmacyNumbering(locationId: string, organizationId: string, expectedRevision: number, expectedFinancialYear: string, fields: PharmacyNumberFormat & { nextNumber: number; reviewReference: string }) {
  const payload = { expectedRevision, expectedFinancialYear, prefixTemplate: fields.prefixTemplate.trim().toUpperCase(), digits: fields.digits, resetPolicy: fields.resetPolicy, nextNumber: fields.nextNumber, reviewReference: fields.reviewReference.trim() };
  return parsePharmacyNumbering((await api.put(path(locationId, organizationId), payload)).data?.data, locationId, organizationId);
}
