import { validatePharmacyUnits } from "./pharmacyUnits";
import type { PurchaseDraft } from "@/services/pharmacyPurchase.service";

export interface PurchaseDeliveryLine { lineId: string; purchaseLineId: string; billed: string; free: string; batch: string; precision: string; expiry: string }
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function invalid(): never { throw new Error("Purchase quantities or receipt progress are incomplete. Reopen the purchase before continuing."); }

/** Presentation plan only; the existing receipt command rechecks current source quantities. */
export function purchaseReceivingPlan(purchase: PurchaseDraft) {
  if (!purchase || !["draft", "posted"].includes(purchase.status) || !whole(purchase.revision) || !Array.isArray(purchase.lines) || !purchase.lines.length || purchase.lines.length > 100 || new Set(purchase.lines.map(line => line.lineId)).size !== purchase.lines.length) invalid();
  const progress = purchase.receiptProgress;
  if (purchase.status === "posted" && (!Array.isArray(progress) || progress.length !== purchase.lines.length || new Set(progress.map(row => row.lineId)).size !== purchase.lines.length)) invalid();
  return purchase.lines.map(source => {
    let unit: ReturnType<typeof validatePharmacyUnits>;
    try { unit = validatePharmacyUnits(source.unitSnapshot); } catch { return invalid(); }
    if (!source.lineId || !source.medicineSnapshot?.name || !unit?.baseUnit || !unit.packUnit || !whole(unit.version) || unit.version < 1 || !whole(unit.unitsPerPack) || unit.unitsPerPack < 1 || unit.unitsPerPack > 1_000_000 ||
        ![source.packs, source.looseUnits, source.freePacks, source.freeLooseUnits, source.billedBaseUnits, source.freeBaseUnits].every(whole) ||
        source.looseUnits >= unit.unitsPerPack || source.freeLooseUnits >= unit.unitsPerPack || source.packs * unit.unitsPerPack + source.looseUnits !== source.billedBaseUnits ||
        source.freePacks * unit.unitsPerPack + source.freeLooseUnits !== source.freeBaseUnits || !Number.isSafeInteger(source.billedBaseUnits + source.freeBaseUnits) || source.billedBaseUnits + source.freeBaseUnits <= 0) invalid();
    const received = purchase.status === "posted" ? progress!.find(row => row.lineId === source.lineId) : { billedBaseUnits: 0, freeBaseUnits: 0, costPaise: 0 };
    if (!received || ![received.billedBaseUnits, received.freeBaseUnits, received.costPaise].every(whole) || received.billedBaseUnits > source.billedBaseUnits || received.freeBaseUnits > source.freeBaseUnits) invalid();
    return { source, billed: source.billedBaseUnits - received.billedBaseUnits, free: source.freeBaseUnits - received.freeBaseUnits };
  });
}

export function remainingDeliveryLines(purchase: PurchaseDraft): PurchaseDeliveryLine[] {
  return purchaseReceivingPlan(purchase).filter(row => row.billed + row.free > 0).map(row => ({ lineId: crypto.randomUUID(), purchaseLineId: row.source.lineId,
    billed: String(row.billed), free: String(row.free), batch: "", precision: "month", expiry: "" }));
}

export function purchaseDeliveryPayload(purchase: PurchaseDraft, reference: string, lines: PurchaseDeliveryLine[]) {
  if (purchase.status !== "posted") throw new Error("Post the supplier invoice before recording its delivery.");
  const plan = purchaseReceivingPlan(purchase), counts = new Map(plan.map(row => [row.source.lineId, { billed: 0, free: 0 }]));
  const deliveryReference = reference.trim().normalize("NFKC");
  if (deliveryReference.length < 3 || deliveryReference.length > 100 || /[\p{Cc}\p{Cf}]/u.test(deliveryReference) || !lines.length || lines.length > 100 || new Set(lines.map(line => line.lineId)).size !== lines.length) throw new Error("Record the actual delivery reference, positive whole billed/free base units, batch and printed expiry for each received line.");
  const captured = lines.map(line => {
    const billed = /^\d+$/.test(line.billed) ? Number(line.billed) : NaN, free = /^\d+$/.test(line.free) ? Number(line.free) : NaN;
    const total = counts.get(line.purchaseLineId), expiry = line.expiry, batchNumber = line.batch.trim();
    const iso = line.precision === "month" ? /^\d{4}-(0[1-9]|1[0-2])$/.test(expiry) : line.precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(expiry) && Number.isFinite(Date.parse(`${expiry}T12:00:00Z`)) && new Date(`${expiry}T12:00:00Z`).toISOString().slice(0, 10) === expiry;
    if (!total || !whole(billed) || !whole(free) || !Number.isSafeInteger(billed + free) || billed + free <= 0 || !batchNumber || batchNumber.length > 100 || !iso) throw new Error("Record the actual delivery reference, positive whole billed/free base units, batch and printed expiry for each received line.");
    total.billed += billed; total.free += free;
    const remaining = plan.find(row => row.source.lineId === line.purchaseLineId)!;
    if (!whole(total.billed) || !whole(total.free) || total.billed > remaining.billed || total.free > remaining.free) throw new Error(`Delivery lots exceed the remaining billed or free quantity for ${remaining.source.medicineSnapshot.name}. Reduce quantities for partial or split batches.`);
    return { lineId: line.lineId, purchaseLineId: line.purchaseLineId, billedBaseUnits: billed, freeBaseUnits: free, batchNumber, expiry: { precision: line.precision, value: expiry } };
  });
  return { locationId: purchase.locationId, expectedRevision: purchase.revision, deliveryReference, lines: captured };
}
