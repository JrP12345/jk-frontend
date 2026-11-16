import { describe, expect, it } from "vitest";
import { purchaseDeliveryPayload, purchaseReceivingPlan, remainingDeliveryLines, type PurchaseDeliveryLine } from "@/lib/pharmacyReceiving";
import type { PurchaseDraft } from "@/services/pharmacyPurchase.service";

const posted: PurchaseDraft = { id: "purchase", locationId: "branch", supplierId: "supplier", supplierSnapshot: { name: "Supplier", address: "Recorded address", revision: 1 },
  supplierInvoiceNumber: "INV-TEST", invoiceDate: "2026-10-20", invoiceFY: "2026-2027", statedTotalPaise: 100, revision: 2, status: "posted", notes: "",
  posting: { payablePaise: 100, postedAt: "2026-10-20T10:00:00Z", reviewReference: "Recorded review", costTreatment: "exclude_tax" },
  lines: [{ lineId: "source-line-0001", medicineId: "medicine", expectedUnitVersion: 1, packs: 2, looseUnits: 3, freePacks: 1, freeLooseUnits: 0,
    billedBaseUnits: 23, freeBaseUnits: 10, baseAmountPaise: 100, discountPaise: 0, gstRateBps: 0, hsnCode: "300490", sellingPricePaise: 15,
    unitSnapshot: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 }, medicineSnapshot: { name: "Medicine", genericName: "Synthetic" } }],
  receiptProgress: [{ lineId: "source-line-0001", billedBaseUnits: 3, freeBaseUnits: 4, costPaise: 20 }] };
const lot = (overrides: Partial<PurchaseDeliveryLine> = {}): PurchaseDeliveryLine => ({ lineId: "delivery-line-0001", purchaseLineId: posted.lines[0].lineId, billed: "20", free: "6", batch: "ACTUAL-BATCH", precision: "month", expiry: "2099-12", ...overrides });

it("plans remaining quantities from captured pack conversion and recorded billed/free progress", () => {
  expect(purchaseReceivingPlan(posted)).toMatchObject([{ billed: 20, free: 6 }]);
  const lines = remainingDeliveryLines(posted); expect(lines).toMatchObject([{ purchaseLineId: posted.lines[0].lineId, billed: "20", free: "6", batch: "", expiry: "" }]);
  expect(lines[0].lineId).toBeTruthy();
  expect(purchaseReceivingPlan({ ...posted, status: "draft", receiptProgress: undefined })).toMatchObject([{ billed: 23, free: 10 }]);
});

it("does not infer missing receipt progress as zero or accept inconsistent conversions", () => {
  for (const receiptProgress of [undefined, [], [{ lineId: "other", billedBaseUnits: 0, freeBaseUnits: 0, costPaise: 0 }], [{ ...posted.receiptProgress![0], billedBaseUnits: 24 }], [{ ...posted.receiptProgress![0], freeBaseUnits: -1 }]]) {
    expect(() => purchaseReceivingPlan({ ...posted, receiptProgress })).toThrow(/incomplete/);
  }
  expect(() => purchaseReceivingPlan({ ...posted, revision: NaN })).toThrow(/incomplete/);
  expect(() => purchaseReceivingPlan({ ...posted, lines: [{ ...posted.lines[0], billedBaseUnits: 22 }] })).toThrow(/incomplete/);
  expect(() => purchaseReceivingPlan({ ...posted, lines: [{ ...posted.lines[0], unitSnapshot: { ...posted.lines[0].unitSnapshot, unitsPerPack: 0 } }] })).toThrow(/incomplete/);
  expect(() => purchaseReceivingPlan({ ...posted, lines: [posted.lines[0], posted.lines[0]] })).toThrow(/incomplete/);
});

it("omits complete source lines while preserving the remaining free quantity", () => {
  expect(remainingDeliveryLines({ ...posted, receiptProgress: [{ ...posted.receiptProgress![0], billedBaseUnits: 23, freeBaseUnits: 10 }] })).toEqual([]);
  expect(remainingDeliveryLines({ ...posted, receiptProgress: [{ ...posted.receiptProgress![0], billedBaseUnits: 23 }] })).toMatchObject([{ billed: "0", free: "6" }]);
});

it("builds the existing receipt command with stable lot identities and no cost or payable overrides", () => {
  const payload = purchaseDeliveryPayload(posted, "  ACTUAL-DELIVERY  ", [lot({ billed: "12", free: "0" }), lot({ lineId: "delivery-line-0002", billed: "8", free: "6", batch: "SECOND-BATCH" })]);
  expect(payload).toEqual({ locationId: "branch", expectedRevision: 2, deliveryReference: "ACTUAL-DELIVERY", lines: [
    { lineId: "delivery-line-0001", purchaseLineId: "source-line-0001", billedBaseUnits: 12, freeBaseUnits: 0, batchNumber: "ACTUAL-BATCH", expiry: { precision: "month", value: "2099-12" } },
    { lineId: "delivery-line-0002", purchaseLineId: "source-line-0001", billedBaseUnits: 8, freeBaseUnits: 6, batchNumber: "SECOND-BATCH", expiry: { precision: "month", value: "2099-12" } }
  ] });
});

it("checks billed and free totals independently across split lots", () => {
  expect(() => purchaseDeliveryPayload(posted, "DELIVERY", [lot({ billed: "12" }), lot({ lineId: "other-lot", billed: "9", free: "0" })])).toThrow(/exceed/);
  expect(() => purchaseDeliveryPayload(posted, "DELIVERY", [lot({ billed: "10", free: "3" }), lot({ lineId: "other-lot", billed: "10", free: "4" })])).toThrow(/exceed/);
});

describe("actual delivery validation", () => {
  it.each([
    { billed: "1.5" }, { billed: "-1" }, { billed: "9007199254740992" }, { billed: "0", free: "0" }, { purchaseLineId: "unknown" },
    { batch: " " }, { expiry: "2099-13" }, { precision: "day", expiry: "2099-02-29" }, { precision: "year", expiry: "2099" }
  ])("rejects invalid lot %j before dispatch", change => {
    expect(() => purchaseDeliveryPayload(posted, "DELIVERY", [lot(change)])).toThrow(/actual delivery reference/);
  });
  it("accepts printed leap-day expiry and partial quantities", () => {
    expect(purchaseDeliveryPayload(posted, "DELIVERY", [lot({ billed: "1", free: "0", precision: "day", expiry: "2028-02-29" })]).lines[0].expiry).toEqual({ precision: "day", value: "2028-02-29" });
  });
  it("requires a posted source, actual reference and unique lot identities", () => {
    expect(() => purchaseDeliveryPayload({ ...posted, status: "draft" }, "DELIVERY", [lot()])).toThrow(/Post the supplier invoice/);
    expect(() => purchaseDeliveryPayload(posted, " ", [lot()])).toThrow(/actual delivery reference/);
    expect(() => purchaseDeliveryPayload(posted, "DELIVERY", [lot(), lot()])).toThrow(/actual delivery reference/);
  });
});
