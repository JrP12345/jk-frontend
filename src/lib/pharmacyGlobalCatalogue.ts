import api from "@/lib/api";
import type { PurchaseProduct } from "@/services/pharmacyPurchase.service";

export interface GlobalCatalogueProduct {
  id: string; name: string; genericName: string; composition: string; strength: string; dosageForm: string;
  manufacturer: string; packSize: string; barcodes: string[]; provider: string; sourceId: string; release: string; revision: number; alreadyAdded: boolean;
  supplierName?: string; sourceUpdatedOn?: string;
  sourceIds?: { product?: string; generic?: string; supplier?: string; substances?: string[]; dosageForms?: string[]; routes?: string[] };
}
export interface GlobalCataloguePage { items: GlobalCatalogueProduct[]; nextCursor: string | null; sourceNotice: string }
export async function searchGlobalProducts(locationId: string, search: string, cursor?: string, signal?: AbortSignal): Promise<GlobalCataloguePage> {
  const params = new URLSearchParams({ locationId, search, ...(cursor ? { cursor } : {}) });
  // Numeric scans use exact barcode matching; literal name searches never become regex input.
  if (/^\d{6,64}$/.test(search.trim())) { params.delete("search"); params.set("barcode", search.trim()); }
  const { data } = await api.get(`/pharmacy/catalogue/global?${params}`, { signal });
  const page = data?.data;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.items.some((item: GlobalCatalogueProduct) => !/^[a-f\d]{24}$/.test(item.id) || !item.name || !Number.isSafeInteger(item.revision)) || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Catalogue response is incomplete");
  return page;
}
export interface CatalogueAdoption { locationId: string; expectedRevision: number; sellingPricePaise?: number; category?: string;
  unitDefinition?: { baseUnit: string; packUnit: string; unitsPerPack: number; outerPackUnit?: string; packsPerOuter?: number }; genericName?: string; confirmedIdentity: true;
  billingSupply?: { batchNumber: string; expiry: { precision: "month"; value: string }; mrpPaise: number } }
export async function adoptCatalogueProduct(id: string, input: CatalogueAdoption): Promise<PurchaseProduct> {
  const { data } = await api.post(`/pharmacy/catalogue/global/${id}/adopt`, input);
  const medicine = data?.data?.medicine;
  if (!medicine || !/^[a-f\d]{24}$/.test(medicine.id) || !medicine.unitDefinition || !Number.isSafeInteger(medicine.unitDefinition.version)) throw new Error("Add result is incomplete. Check the branch catalogue before retrying.");
  return medicine;
}
