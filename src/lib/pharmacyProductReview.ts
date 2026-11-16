import api from "./api";
import { readMedicinePage } from "@/components/pharmacy/pharmacyWorkspace";

export const saleClassifications = ["general", "schedule_h", "schedule_h1", "schedule_x", "narcotic"] as const;
export type SaleClassification = typeof saleClassifications[number];
export type TaxTreatment = "taxable" | "exempt" | "nil_rated";
interface Evidence { reviewReference: string; confirmedBy: string; confirmedAt: string }
export interface SaleReview extends Evidence { scheduleType: SaleClassification }
export interface TaxReview extends Evidence { hsnCode: string; unitCode: string; gstRate: number; treatment: TaxTreatment }
export interface ProductReview {
  id: string; locationId: string; name: string; scheduleType: SaleClassification | "";
  hsnCode: string; gstRate: number | undefined; hasUnits: boolean;
  dispensingRevision: number; taxRevision: number; saleReview: SaleReview | null; taxReview: TaxReview | null;
}
export interface SaleReviewInput { scheduleType: SaleClassification; reviewReference: string }
export interface TaxReviewInput { hsnCode: string; unitCode: string; gstRate: number; treatment: TaxTreatment; reviewReference: string }
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length >= 3 && value.length <= 500;
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < Number.MAX_SAFE_INTEGER;
const evidence = (value: Partial<Evidence> | null | undefined): value is Evidence => Boolean(value && text(value.reviewReference) && typeof value.confirmedBy === "string" && value.confirmedBy && typeof value.confirmedAt === "string" && Number.isFinite(Date.parse(value.confirmedAt)));
const taxFields = (value: Partial<TaxReviewInput>): value is TaxReviewInput => typeof value.hsnCode === "string" && /^\d{4}(\d{2})?(\d{2})?$/.test(value.hsnCode) &&
  typeof value.unitCode === "string" && /^[A-Z]{3}$/.test(value.unitCode) && typeof value.gstRate === "number" && Number.isFinite(value.gstRate) && value.gstRate >= 0 && value.gstRate <= 100 &&
  ["taxable", "exempt", "nil_rated"].includes(value.treatment || "") && (value.treatment === "taxable" ? value.gstRate > 0 : value.gstRate === 0) && text(value.reviewReference);

export function parseProductReview(value: unknown, medicineId: string, locationId: string): ProductReview {
  const row = value as Record<string, unknown> | null;
  const dispensingRevision = row?.dispensingRevision === undefined ? 0 : row.dispensingRevision;
  const taxRevision = row?.taxRevision === undefined ? 0 : row.taxRevision;
  if (!row || row.id !== medicineId || row.locationId !== locationId || typeof row.name !== "string" || !row.name.trim() ||
      !revision(dispensingRevision) || !revision(taxRevision) ||
      row.scheduleType !== undefined && !saleClassifications.includes(row.scheduleType as SaleClassification)) throw new Error("Product review details could not be confirmed. Reload the product.");
  const sale = row.dispensingReview as SaleReview | undefined, tax = row.taxClassification as TaxReview | undefined;
  const units = row.unitDefinition as { version?: number; baseUnit?: string; packUnit?: string; unitsPerPack?: number } | undefined;
  return { id: medicineId, locationId, name: row.name, scheduleType: row.scheduleType as SaleClassification || "",
    hsnCode: typeof row.hsnCode === "string" ? row.hsnCode : "", gstRate: typeof row.gstRate === "number" && Number.isFinite(row.gstRate) ? row.gstRate : undefined,
    hasUnits: Boolean(units && Number.isSafeInteger(units.version) && units.version! >= 1 && units.baseUnit && units.packUnit && Number.isSafeInteger(units.unitsPerPack) && units.unitsPerPack! > 0),
    dispensingRevision, taxRevision,
    saleReview: evidence(sale) && saleClassifications.includes(sale.scheduleType) ? sale : null,
    taxReview: evidence(tax) && taxFields(tax) ? tax : null };
}
export async function readProductReview(medicineId: string, locationId: string, signal?: AbortSignal): Promise<ProductReview> {
  const page = await readMedicinePage(locationId, signal || new AbortController().signal, { medicineIds: [medicineId] });
  if (page.items.length !== 1) throw new Error("This product is unavailable at the selected branch. Reload the product list.");
  return parseProductReview(page.items[0], medicineId, locationId);
}
export async function saveSaleReview(product: ProductReview, input: SaleReviewInput) {
  const payload = { expectedRevision: product.dispensingRevision, scheduleType: input.scheduleType, reviewReference: input.reviewReference.trim() };
  if (!revision(payload.expectedRevision) || !saleClassifications.includes(payload.scheduleType) || !text(payload.reviewReference)) throw new Error("Choose the sale classification and enter a review reference of at least 3 characters.");
  const response = await api.put(`/pharmacy/medicines/${encodeURIComponent(product.id)}/dispensing-classification`, payload);
  const saved = response.data?.data;
  if (saved?.id !== product.id || saved.dispensingRevision !== product.dispensingRevision + 1 || saved.scheduleType !== payload.scheduleType || !evidence(saved.dispensingReview) ||
      saved.dispensingReview.scheduleType !== payload.scheduleType || saved.dispensingReview.reviewReference !== payload.reviewReference) throw new Error("Sale review save could not be confirmed.");
}
export async function saveTaxReview(product: ProductReview, input: TaxReviewInput) {
  const payload = { expectedRevision: product.taxRevision, hsnCode: input.hsnCode.trim(), unitCode: input.unitCode.trim().toUpperCase(), gstRate: input.gstRate, treatment: input.treatment, reviewReference: input.reviewReference.trim() };
  if (!revision(payload.expectedRevision) || !taxFields(payload)) throw new Error("Check the HSN, three-letter unit code, tax treatment, rate and review reference. Taxable products need a positive rate; exempt or nil-rated products need zero.");
  const response = await api.put(`/pharmacy/medicines/${encodeURIComponent(product.id)}/tax-classification`, payload);
  const saved = response.data?.data;
  if (saved?.id !== product.id || saved.taxRevision !== product.taxRevision + 1 || !evidence(saved.taxClassification) || !taxFields(saved.taxClassification) ||
      saved.hsnCode !== payload.hsnCode || saved.gstRate !== payload.gstRate || (["hsnCode", "unitCode", "gstRate", "treatment", "reviewReference"] as const).some(key => saved.taxClassification[key] !== payload[key])) throw new Error("Tax review save could not be confirmed.");
}
