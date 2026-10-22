import api from "@/lib/api";

export interface Medicine {
  id: string; locationId: string; name: string; genericName: string; stockQuantity: number;
  price: number; costPrice?: number; expiryDate?: string | null; batchNumber?: string | null; reorderLevel?: number;
  manufacturer?: string; strength?: string; category?: string; scheduleType?: string; hsnCode?: string; gstRate?: number; barcodes?: string[];
  unitDefinition?: { version: number; baseUnit: string; packUnit: string; unitsPerPack: number };
}
export interface PrescriptionItem {
  id: string; medicineId: string | null; name: string; dosage: string; frequency: string; duration: string; instructions?: string;
  fulfillment?: { mode: "quantity" | "single"; authorizedQuantity: number | null; suppliedQuantity: number; remainingQuantity: number | null;
    baseUnit: string | null; revision: number; medicineId: string | null };
}
export interface PendingPrescription {
  encounterId: string; appointmentId: string | null; appointmentTime: string | null; tokenNumber?: number | null;
  patientId: { id: string; name: string; phone?: string }; doctorId: { id: string; name: string }; prescriptions: PrescriptionItem[];
}
export interface DispenseItem { medicineId: string; quantity: number }

export const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount || 0);
export const dateLabel = (value?: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not recorded";
export const expired = (value?: string | null) => Boolean(value && new Date(value).getTime() < Date.now());
export const lowStock = (medicine: Medicine) => medicine.stockQuantity <= (medicine.reorderLevel ?? 20);

export interface MedicinePage { items: Medicine[]; totalCount: number | null; totalPages: number; page: number }
/** Exactly one bounded request; search, pagination and prescribed-ID lookup stay on the server. */
export async function readMedicinePage(locationId: string, signal: AbortSignal, options: { page?: number; search?: string; stockFilter?: string; medicineIds?: string[] } = {}): Promise<MedicinePage> {
  const page = options.page ?? 1;
  const query = new URLSearchParams({ page: String(page), limit: "100" });
  if (locationId) query.set("locationId", locationId);
  if (options.search?.trim()) query.set("search", options.search.trim().slice(0, 100));
  if (options.stockFilter && options.stockFilter !== "all") query.set("stockFilter", options.stockFilter);
  if (options.medicineIds?.length) query.set("medicineIds", [...new Set(options.medicineIds)].slice(0, 100).join(","));
  const response = await api.get(`/medicines?${query}`, { signal });
  if (!Array.isArray(response.data?.data) || response.data.data.length > 100) throw new Error("Incomplete medicine catalog");
  const pages = Number(response.headers?.["x-total-pages"] ?? (response.data.data.length ? 1 : 0));
  const totalCount = response.headers?.["x-total-count"] !== undefined ? Number(response.headers["x-total-count"]) : null;
  if (!Number.isSafeInteger(pages) || pages < 0 || totalCount !== null && (!Number.isSafeInteger(totalCount) || totalCount < 0)) throw new Error("Invalid catalog pagination");
  return { items: response.data.data, page, totalPages: pages, totalCount };
}

/** Selected prescriptions alone become fulfilled; repeated stock selections are one atomic stock line. */
export function prepareDispense(prescriptions: PrescriptionItem[], selections: DispenseItem[], medicines: Medicine[], locationId: string) {
  const items = new Map<string, DispenseItem>();
  const prescriptionIds: string[] = [];
  const prescriptionAllocations: Array<{ prescriptionId: string; medicineId: string; quantity: number; expectedFulfillmentRevision?: number; expectedRemainingQuantity?: number }> = [];
  for (const [index, prescription] of prescriptions.entries()) {
    const selected = selections[index];
    if (!selected?.medicineId) continue;
    const medicine = medicines.find(item => item.id === selected.medicineId);
    if (!medicine || medicine.locationId !== locationId) return { error: "Choose stock from this location for every selected item." };
    if (!Number.isSafeInteger(selected.quantity) || selected.quantity <= 0) return { error: "Enter a positive whole quantity for every selected item." };
    const allowance = prescription.fulfillment;
    if (allowance?.mode === "quantity" && (!Number.isSafeInteger(allowance.revision) || allowance.revision < 0 || !Number.isSafeInteger(allowance.remainingQuantity) || allowance.remainingQuantity! < selected.quantity ||
        allowance.baseUnit !== medicine.unitDefinition?.baseUnit || allowance.medicineId && allowance.medicineId !== selected.medicineId)) return { error: `Check the remaining authorized quantity, medicine and base unit for ${prescription.name}.` };
    const quantity = (items.get(selected.medicineId)?.quantity || 0) + selected.quantity;
    if (!Number.isSafeInteger(quantity) || quantity > medicine.stockQuantity) return { error: `Not enough stock for ${medicine.name}. Available: ${medicine.stockQuantity}.` };
    items.set(selected.medicineId, { medicineId: selected.medicineId, quantity });
    prescriptionIds.push(prescription.id);
    prescriptionAllocations.push({ prescriptionId: prescription.id, medicineId: selected.medicineId, quantity: selected.quantity,
      ...(allowance?.mode === "quantity" ? { expectedFulfillmentRevision: allowance.revision, expectedRemainingQuantity: allowance.remainingQuantity! } : {}) });
  }
  if (!items.size) return { error: "Select at least one medicine to dispense." };
  if (items.size > 100 || prescriptionIds.length > 200) return { error: "Dispense up to 100 stock items and 200 prescriptions at a time." };
  return { items: Array.from(items.values()), prescriptionIds, prescriptionAllocations };
}
