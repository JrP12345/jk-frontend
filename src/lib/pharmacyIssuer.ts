import api from "@/lib/api";
import { organizationPath } from "@/services/organization.service";

export interface PharmacyIssuerFields {
  registration: string; legalName: string; address: string; stateCode: string; gstin: string;
  drugLicenceNumbers: string[]; authorisedSignatory: string; reviewReference: string;
  pricesIncludeTax: boolean; electronicReportingRequired: boolean; minimumHsnDigits: number;
}
export interface PharmacyIssuerProfile extends PharmacyIssuerFields { organizationId: string; locationId: string; revision: number; issueSupported: boolean }
export function parsePharmacyIssuer(value: unknown, locationId: string, organizationId: string): PharmacyIssuerProfile | null {
  if (value === null) return null;
  const row = value as PharmacyIssuerProfile;
  if (!row || row.locationId !== locationId || row.organizationId !== organizationId || !Number.isSafeInteger(row.revision) || row.revision < 1 ||
      !["regular", "composition", "unregistered"].includes(row.registration) ||
      ![row.legalName, row.address, row.stateCode, row.authorisedSignatory, row.reviewReference].every(item => typeof item === "string" && item.length > 0 && item.length <= 500) ||
      row.gstin !== undefined && typeof row.gstin !== "string" || !Array.isArray(row.drugLicenceNumbers) || row.drugLicenceNumbers.length < 1 || row.drugLicenceNumbers.length > 10 ||
      row.drugLicenceNumbers.some(item => typeof item !== "string" || item.length < 3 || item.length > 500) ||
      typeof row.pricesIncludeTax !== "boolean" || typeof row.electronicReportingRequired !== "boolean" || ![4, 6, 8].includes(row.minimumHsnDigits) ||
      row.issueSupported !== (row.pricesIncludeTax && !row.electronicReportingRequired)) throw new Error("Issuer response does not match this organization and branch");
  return row;
}
const path = (locationId: string, organizationId: string) => organizationPath(`/pharmacy/locations/${encodeURIComponent(locationId)}/tax-profile`, organizationId);
export async function readPharmacyIssuer(locationId: string, organizationId: string, signal: AbortSignal) {
  return parsePharmacyIssuer((await api.get(path(locationId, organizationId), { signal })).data?.data, locationId, organizationId);
}
export async function savePharmacyIssuer(locationId: string, organizationId: string, expectedRevision: number, fields: PharmacyIssuerFields) {
  const payload = { expectedRevision, registration: fields.registration, legalName: fields.legalName.trim(), address: fields.address.trim(), stateCode: fields.stateCode.trim(),
    gstin: fields.registration === "unregistered" ? "" : fields.gstin.trim(), drugLicenceNumbers: fields.drugLicenceNumbers,
    authorisedSignatory: fields.authorisedSignatory.trim(), reviewReference: fields.reviewReference.trim(), pricesIncludeTax: fields.pricesIncludeTax,
    electronicReportingRequired: fields.electronicReportingRequired, minimumHsnDigits: fields.minimumHsnDigits };
  return parsePharmacyIssuer((await api.put(path(locationId, organizationId), payload)).data?.data, locationId, organizationId);
}
