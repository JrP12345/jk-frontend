import api from "@/lib/api";

export interface Medicine {
  id: string; locationId: string; name: string; genericName: string; stockQuantity: number;
  price: number; costPrice: number; expiryDate: string; batchNumber: string; reorderLevel?: number;
}
export interface PrescriptionItem {
  id: string; medicineId: string | null; name: string; dosage: string; frequency: string; duration: string; instructions?: string;
}
export interface PendingPrescription {
  encounterId: string; appointmentId: string | null; appointmentTime: string | null; tokenNumber?: number | null;
  patientId: { id: string; name: string; phone?: string }; doctorId: { id: string; name: string }; prescriptions: PrescriptionItem[];
}
export interface DispenseItem { medicineId: string; quantity: number }

export const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount || 0);
export const dateLabel = (value?: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not recorded";
export const expired = (value: string) => Boolean(value && new Date(value).getTime() < Date.now());
export const lowStock = (medicine: Medicine) => medicine.stockQuantity <= (medicine.reorderLevel ?? 20);

/** The stock selector and alerts must not silently operate on only the first API page. */
export async function readMedicineCatalog(locationId: string, signal: AbortSignal): Promise<Medicine[]> {
  const medicines: Medicine[] = [];
  for (let page = 1; page <= 500; page++) {
    const query = new URLSearchParams({ page: String(page), limit: "100" });
    if (locationId) query.set("locationId", locationId);
    const response = await api.get(`/medicines?${query}`, { signal });
    if (!Array.isArray(response.data?.data)) throw new Error("Incomplete medicine catalog");
    medicines.push(...response.data.data);
    const pages = Number(response.headers?.["x-total-pages"] || 1);
    if (!Number.isFinite(pages) || pages < 0) throw new Error("Invalid catalog pagination");
    if (page >= pages) return medicines;
  }
  throw new Error("Medicine catalog exceeds the supported selection size");
}

/** Selected prescriptions alone become fulfilled; repeated stock selections are one atomic stock line. */
export function prepareDispense(prescriptions: PrescriptionItem[], selections: DispenseItem[], medicines: Medicine[], locationId: string) {
  const items = new Map<string, DispenseItem>();
  const prescriptionIds: string[] = [];
  for (const [index, prescription] of prescriptions.entries()) {
    const selected = selections[index];
    if (!selected?.medicineId) continue;
    const medicine = medicines.find(item => item.id === selected.medicineId);
    if (!medicine || medicine.locationId !== locationId) return { error: "Choose stock from this location for every selected item." };
    if (!Number.isSafeInteger(selected.quantity) || selected.quantity <= 0) return { error: "Enter a positive whole quantity for every selected item." };
    const quantity = (items.get(selected.medicineId)?.quantity || 0) + selected.quantity;
    if (!Number.isSafeInteger(quantity) || quantity > medicine.stockQuantity) return { error: `Not enough stock for ${medicine.name}. Available: ${medicine.stockQuantity}.` };
    items.set(selected.medicineId, { medicineId: selected.medicineId, quantity });
    prescriptionIds.push(prescription.id);
  }
  if (!items.size) return { error: "Select at least one medicine to dispense." };
  return { items: Array.from(items.values()), prescriptionIds };
}
