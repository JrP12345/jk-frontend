import api from "@/lib/api";

export interface PharmacyParty {
  id: string; locationIds: string[]; name: string; kinds: string[]; address: string; phone: string; email: string;
  gstRegistration: "registered" | "unregistered"; gstin?: string; licence?: { number: string; validUntil?: string }; archived: boolean; revision: number;
}
export interface PurchaseLine {
  lineId: string; medicineId: string; expectedUnitVersion: number; packs: number; looseUnits: number; freePacks: number; freeLooseUnits: number;
  baseAmountPaise: number; discountPaise: number; gstRateBps: number; hsnCode: string; sellingPricePaise: number; mrpPaise?: number;
}
export interface PurchaseDraft {
  id: string; locationId: string; supplierId: string; supplierSnapshot: { name: string; revision: number; address: string; gstin?: string };
  supplierInvoiceNumber: string; invoiceDate: string; invoiceFY: string; statedTotalPaise: number; revision: number; status: "draft" | "posted"; notes: string;
  lines: Array<PurchaseLine & { billedBaseUnits: number; freeBaseUnits: number; unitSnapshot: { version: number; baseUnit: string; packUnit: string; unitsPerPack: number }; medicineSnapshot: { name: string; genericName: string; strength?: string } }>;
  calculation?: PurchaseCalculation;
  posting?: { payablePaise: number; postedAt: string; reviewReference: string; costTreatment: "include_tax" | "exclude_tax" };
  receiptCount?: number;
  receiptProgress?: Array<{ lineId: string; billedBaseUnits: number; freeBaseUnits: number; costPaise: number }>;
}
export interface PurchaseCalculation {
  policy: "pharmacy-paise-v2"; currency: "INR"; priceMode: "exclusive"; taxMode: "unallocated";
  totals: { amountBeforeDiscountPaise: number; lineDiscountPaise: number; invoiceDiscountPaise: number; baseAmountPaise: number;
    cgstPaise: number; sgstPaise: number; utgstPaise: number; igstPaise: number; unallocatedTaxPaise: number; grossAmountPaise: number; roundOffPaise: number; payablePaise: number };
}
function validateCalculation(draft: PurchaseDraft) {
  const value = draft.calculation;
  if (value === undefined) return; // Drafts saved before T16 have no calculated snapshot.
  const fields = ["amountBeforeDiscountPaise", "lineDiscountPaise", "invoiceDiscountPaise", "baseAmountPaise", "cgstPaise", "sgstPaise", "utgstPaise", "igstPaise", "unallocatedTaxPaise", "grossAmountPaise", "payablePaise"] as const;
  if (!value || value.policy !== "pharmacy-paise-v2" || value.currency !== "INR" || value.priceMode !== "exclusive" || value.taxMode !== "unallocated" ||
      !value.totals || fields.some(field => !Number.isSafeInteger(value.totals[field]) || value.totals[field] < 0) ||
      !Number.isSafeInteger(value.totals.roundOffPaise) || Math.abs(value.totals.roundOffPaise) > 99) throw new Error("Saved purchase calculation could not be loaded. Reload the record before continuing.");
}
export type PurchaseDraftInput = { locationId: string; supplierId: string; expectedSupplierRevision: number; supplierInvoiceNumber: string; invoiceDate: string; statedTotalPaise: number; notes: string; lines: PurchaseLine[] };
export type PartyInput = Omit<PharmacyParty, "id" | "revision"> & { locationId: string };
export interface PurchasePage<T> { items: T[]; nextCursor: string | null }
export async function purchasePage<T>(kind: "parties" | "purchases" | "purchase-products", locationId: string, options: { search?: string; cursor?: string; archived?: boolean } = {}, signal?: AbortSignal): Promise<PurchasePage<T>> {
  const query = new URLSearchParams({ locationId, limit: "25" });
  if (options.search?.trim()) query.set("search", options.search.trim().slice(0, 100));
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.archived) query.set("archived", "true");
  const response = await api.get(`/pharmacy/${kind}?${query}`, { signal }), result = response.data?.data;
  if (!result || !Array.isArray(result.items) || result.items.length > 25 || result.nextCursor !== null && typeof result.nextCursor !== "string") throw new Error("Purchase records could not be loaded completely");
  return result;
}
export async function readPurchase(id: string, locationId: string) {
  const response = await api.get(`/pharmacy/purchases/${encodeURIComponent(id)}?locationId=${encodeURIComponent(locationId)}`), result = response.data?.data as PurchaseDraft;
  if (!result || result.id !== id || result.locationId !== locationId || !["draft", "posted"].includes(result.status) || !Array.isArray(result.lines) || !result.lines.length || result.lines.length > 100 ||
      result.status === "posted" && (!result.posting || !Number.isSafeInteger(result.posting.payablePaise) || result.posting.payablePaise < 0 || !Array.isArray(result.receiptProgress))) throw new Error("Purchase record could not be reopened");
  validateCalculation(result);
  return result;
}
export async function savePurchaseDraft(input: PurchaseDraftInput, key: string, current?: PurchaseDraft) {
  const response = current ? await api.put(`/pharmacy/purchases/${current.id}`, { ...input, expectedRevision: current.revision }) : await api.post("/pharmacy/purchases", input, { headers: { "Idempotency-Key": key } });
  const result = response.data?.data as PurchaseDraft;
  if (!result || !result.id || result.locationId !== input.locationId || result.status !== "draft" || !Number.isSafeInteger(result.revision)) throw new Error("Draft save could not be confirmed. Reopen the draft before starting another.");
  validateCalculation(result);
  return result;
}
export async function saveParty(input: PartyInput, key: string, current?: PharmacyParty) {
  const response = current ? await api.put(`/pharmacy/parties/${current.id}`, { ...input, expectedRevision: current.revision }) : await api.post("/pharmacy/parties", input, { headers: { "Idempotency-Key": key } });
  const result = response.data?.data as PharmacyParty;
  if (!result?.id || !Number.isSafeInteger(result.revision)) throw new Error("Party save could not be confirmed. Check the existing records before creating another.");
  return result;
}
