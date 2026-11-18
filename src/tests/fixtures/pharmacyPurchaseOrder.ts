import type { PurchaseOrder } from "@/lib/pharmacyPurchaseOrders";
export const orderLocationId = "a".repeat(24), orderSupplierId = "b".repeat(24), orderProductId = "c".repeat(24), orderId = "d".repeat(24), orderInvoiceId = "e".repeat(24);
export const orderSupplier = { id: orderSupplierId, locationIds: [orderLocationId], name: "Synthetic supplier", kinds: ["supplier"], address: "Supplier address", phone: "9000000000", email: "supplier@example.test", gstRegistration: "unregistered" as const, licence: { number: "SYNTHETIC" }, archived: false, revision: 0 };
export const orderProduct = { id: orderProductId, name: "Synthetic medicine", genericName: "Synthetic salt", price: 123, unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } };
export function orderFixture(changes: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return { id: orderId, reference: "PO-SYNTHETIC-1", locationId: orderLocationId, supplierId: orderSupplierId, supplierSnapshot: orderSupplier,
    buyerSnapshot: { name: "Synthetic pharmacy", branch: "Branch one", address: "Branch address" }, createdAt: "2026-11-17T06:00:00Z", revision: 0, invoiceCount: 0, state: "draft", status: "draft", notes: "", invoices: [],
    lines: [{ lineId: "order-line-0001", medicineId: orderProductId, medicineSnapshot: { name: orderProduct.name, genericName: orderProduct.genericName }, unitSnapshot: orderProduct.unitDefinition, packs: 2, looseUnits: 1, quantity: 21 }],
    comparison: [{ lineId: "order-line-0001", medicineId: orderProductId, name: orderProduct.name, baseUnit: "tablet", ordered: 21, accepted: null, invoiced: 0, received: 0, pendingInvoice: 21, pendingReceipt: 0, shortAccepted: null, overInvoiced: 0 }], ...changes };
}
