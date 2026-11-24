import { expect, it } from "vitest";
import { deliveryManifestTemplate, parseDeliveryManifest } from "@/lib/pharmacyDeliveryManifest";
import type { PurchaseDraft } from "@/services/pharmacyPurchase.service";
const purchase = (count = 1): PurchaseDraft => ({ id: "purchase", locationId: "branch", supplierId: "supplier", supplierSnapshot: { name: "Supplier", address: "Address", revision: 1 }, supplierInvoiceNumber: "BILL-1", invoiceDate: "2026-11-23", invoiceFY: "2026-2027", statedTotalPaise: 100, revision: 2, status: "posted", notes: "",
  lines: Array.from({ length: count }, (_, i) => ({ lineId: `purchase-line-${i}`, medicineId: `medicine-${i}`, expectedUnitVersion: 2, packs: 10, looseUnits: 0, freePacks: 1, freeLooseUnits: 0, billedBaseUnits: 100, freeBaseUnits: 10, baseAmountPaise: 100, discountPaise: 0, gstRateBps: 0, hsnCode: "300490", sellingPricePaise: 15, unitSnapshot: { version: 2, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10, outerPackUnit: "box", packsPerOuter: 10 }, medicineSnapshot: { name: `Medicine ${i}`, genericName: "Synthetic" } })),
  receiptProgress: Array.from({ length: count }, (_, i) => ({ lineId: `purchase-line-${i}`, billedBaseUnits: 0, freeBaseUnits: 0, costPaise: 0 })) });
function completed(value: PurchaseDraft) { return deliveryManifestTemplate(value).replaceAll(',"","month",""', ',"ACTUAL-BATCH","month","2099-12"'); }
it("prepares 50 original invoice lines with separate billed/free quantities and actual lots", () => {
  const value = purchase(50), lines = parseDeliveryManifest(value, completed(value));
  expect(lines).toHaveLength(50); expect(new Set(lines.map(row => row.lineId)).size).toBe(50);
  expect(lines[49]).toMatchObject({ purchaseLineId: "purchase-line-49", billed: "100", free: "10", batch: "ACTUAL-BATCH", precision: "month", expiry: "2099-12" });
});
it("requires staff-entered batch and expiry, with no inferred defaults", () => { const value = purchase(); expect(() => parseDeliveryManifest(value, deliveryManifestTemplate(value))).toThrow(/actual delivery/); });
it.each(["purchase", "branch", "supplier", "Medicine 0", "box"])("rejects changed source identity %s", text => {
  const value = purchase(); expect(() => parseDeliveryManifest(value, completed(value).replace(`"${text}"`, '"other"'))).toThrow(/differs/);
});
it("rejects stale revisions, excess billed/free quantities, malformed CSV and impossible dates", () => {
  const value = purchase(), file = completed(value);
  expect(() => parseDeliveryManifest({ ...value, revision: 3 }, file)).toThrow(/differs/);
  for (const input of [file.replace('"100","10"', '"101","10"'), file.replace('"100","10"', '"100","11"'), file.replace('"2099-12"', '"2099-13"'), `${file},"extra"`, file.slice(0, -1), file.replace('"ACTUAL-BATCH"', '"ACTUAL-BATCH"oops')]) expect(() => parseDeliveryManifest(value, input)).toThrow();
});
it("accepts two genuinely separate batches while retaining the source allowance", () => {
  const value = purchase(), [head, row] = completed(value).split("\r\n"), first = row.replace('"100","10"', '"60","0"'), second = row.replace('"100","10"', '"40","10"').replace('"ACTUAL-BATCH"', '"SECOND-BATCH"');
  expect(parseDeliveryManifest(value, [head, first, second].join("\r\n"))).toHaveLength(2);
  expect(() => parseDeliveryManifest(value, [head, row, row].join("\r\n"))).toThrow(/exceed/);
});
it("preserves quoted product names and accepts reordered complete headers", () => {
  const value = purchase(); value.lines[0].medicineSnapshot.name = 'Medicine, "quoted"';
  expect(parseDeliveryManifest(value, completed(value))).toHaveLength(1);
  value.lines[0].medicineSnapshot.name = "=FORMULA";
  const file = completed(value); expect(file).toContain("'=FORMULA"); expect(parseDeliveryManifest(value, file)).toHaveLength(1);
  const plain = completed(purchase()).replace(/^\uFEFF/, "").split("\r\n").map(row => row.split(",").reverse().join(",")).join("\r\n"); expect(parseDeliveryManifest(purchase(), plain)).toHaveLength(1);
});
