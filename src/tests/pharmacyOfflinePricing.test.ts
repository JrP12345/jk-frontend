// @vitest-environment node
import { createHash } from "node:crypto";
import fs from "node:fs";
import { expect, it } from "vitest";
import { calculatePharmacyDocument, PHARMACY_CALCULATION_ENGINE_SHA256, type PharmacyCalculationInput } from "@/lib/generated/pharmacyCalculation";
import { validateOfflineLedgerPricing, type OfflinePricedLine } from "@/lib/pharmacyOfflinePricing";
import type { IssuedPharmacyInvoice } from "@/lib/pharmacyInvoice";

function fixture(prices = [11800, 10500], rates = [1800, 500], invoiceDiscountPaise = 0, discountPaise = 0, registration = "regular") {
  const intent: OfflinePricedLine[] = prices.map((_, i) => ({ lineId: `line-0000${i}`, medicineId: `product-${i}`, discountPaise }));
  const input: PharmacyCalculationInput = { policy: "pharmacy-paise-v2", currency: "INR", priceMode: "inclusive", taxMode: registration === "regular" ? "sgst" : "none",
    invoiceDiscountPaise, lines: prices.map((price, i) => ({ lineId: intent[i].lineId, quantity: 1, unitPrice: { numeratorPaise: price, denominatorUnits: 1 }, gstRateBps: rates[i], lineDiscountPaise: discountPaise })) };
  const calculation = calculatePharmacyDocument(input), total = calculation.totals;
  const invoice: Omit<IssuedPharmacyInvoice, "invoiceNumber"> = {
    kind: "pharmacy", createdBy: "operator", customerSnapshot: { anonymous: true }, documentVersion: 2, financialYear: "2026-27", issuedAt: "2026-11-15T06:00:00.000Z",
    currency: "INR", status: "paid", subtotal: total.baseAmountPaise / 100, totalAmount: total.payablePaise / 100,
    tax: (total.cgstPaise + total.sgstPaise) / 100, cgstTotal: total.cgstPaise / 100, sgstTotal: total.sgstPaise / 100, calculation,
    taxDocument: { version: 2, kind: registration === "unregistered" ? "ordinary_bill" : registration === "composition" || rates.every(rate => rate === 0) ? "bill_of_supply" : rates.some(rate => rate === 0) ? "invoice_cum_bill_of_supply" : "tax_invoice",
      issuer: { legalName: "Synthetic pharmacy", address: "Synthetic address", stateCode: "24", registration, drugLicenceNumbers: ["synthetic"], authorisedSignatory: "Synthetic pharmacist" },
      recipient: { name: "Walk-in customer", stateCode: "24" }, placeOfSupply: "24", reverseCharge: false, issuedAt: "2026-11-15T06:00:00.000Z", signatureMode: "manual_on_print" },
    items: calculation.lines.map((line, i) => ({ description: `Product ${i}`, quantity: 1, amount: line.baseAmountPaise / 100, hsnSacCode: "300490", unitCode: "NOS", gstRate: rates[i] / 100,
      baseAmountPaise: line.baseAmountPaise, cgstPaise: line.cgstPaise, sgstPaise: line.sgstPaise, grossAmountPaise: line.grossAmountPaise,
      batches: [{ batchNumber: `B${i}`, expiryValue: "2027-12", expiryPrecision: "month", sellingPricePaise: prices[i], mrpPaise: prices[i], quantity: 1 }] })),
  };
  return { invoice, intent, calculation };
}
it("pins the committed browser engine to its source digest without a runtime server dependency", () => {
  const artifact = fs.readFileSync("src/lib/generated/pharmacyCalculation.ts", "utf8");
  const source = artifact.split("\n").slice(2).join("\n");
  expect(createHash("sha256").update(source).digest("hex")).toBe(PHARMACY_CALCULATION_ENGINE_SHA256);
  expect(source).not.toMatch(/^import\s/m);
  const serverSource = "../backend/utilities/pharmacyCalculation.ts";
  if (fs.existsSync(serverSource)) expect(source).toBe(fs.readFileSync(serverSource, "utf8").replace(/\r\n/g, "\n"));
});
it("recomputes mixed GST and invoice discount from captured prices using the server policy", () => {
  const f = fixture([11800, 10500], [1800, 500], 2230);
  expect(validateOfflineLedgerPricing(f.invoice, f.intent).totals).toMatchObject({ baseAmountPaise: 18000, cgstPaise: 1035, sgstPaise: 1035, payablePaise: 20070 });
});
it.each(["unregistered", "composition"])("keeps %s cash supplies tax-free", registration => {
  const f = fixture([1500], [0], 100, 50, registration);
  expect(validateOfflineLedgerPricing(f.invoice, f.intent).totals).toMatchObject({ baseAmountPaise: 1350, payablePaise: 1350, cgstPaise: 0, sgstPaise: 0 });
});
it("rejects a balanced bill whose saved prices are lower than the actual lot prices", () => {
  const f = fixture([1500], [0], 0, 0, "unregistered");
  f.invoice.items[0].batches![0].sellingPricePaise = 2000; f.invoice.items[0].batches![0].mrpPaise = 2000;
  expect(() => validateOfflineLedgerPricing(f.invoice, f.intent)).toThrow(/captured calculation/);
});
it("rejects balanced but incorrectly split GST, missing total components and forged line calculation", () => {
  const f = fixture([7], [1800]);
  f.invoice.items[0].cgstPaise = 1; f.invoice.items[0].sgstPaise = 0; f.invoice.cgstTotal = 0.01; f.invoice.sgstTotal = 0;
  expect(() => validateOfflineLedgerPricing(f.invoice, f.intent)).toThrow();
  const missing = fixture(); delete (missing.invoice.calculation!.totals as unknown as Record<string, unknown>).baseAmountPaise;
  expect(() => validateOfflineLedgerPricing(missing.invoice, missing.intent)).toThrow();
  const forged = fixture(); forged.calculation.lines[0].invoiceDiscountPaise = 5;
  expect(() => validateOfflineLedgerPricing(forged.invoice, forged.intent)).toThrow();
});
it("rejects undisclosed line discounts, duplicate identities and issuer/document mismatches", () => {
  const f = fixture(); f.intent[0].discountPaise = 1;
  expect(() => validateOfflineLedgerPricing(f.invoice, f.intent)).toThrow();
  const duplicate = fixture(); duplicate.intent[1].lineId = duplicate.intent[0].lineId;
  expect(() => validateOfflineLedgerPricing(duplicate.invoice, duplicate.intent)).toThrow(/unique/);
  const product = fixture(); product.intent[1].medicineId = product.intent[0].medicineId;
  expect(() => validateOfflineLedgerPricing(product.invoice, product.intent)).toThrow();
  const issuer = fixture(); issuer.invoice.taxDocument.issuer.registration = "unregistered";
  expect(() => validateOfflineLedgerPricing(issuer.invoice, issuer.intent)).toThrow();
  const kind = fixture(); kind.invoice.taxDocument.kind = "ordinary_bill";
  expect(() => validateOfflineLedgerPricing(kind.invoice, kind.intent)).toThrow();
});
it("uses the weighted whole-paise value of multiple lots, including pack quantities", () => {
  const f = fixture([10001], [1800]);
  const item = f.invoice.items[0]; item.quantity = 3;
  item.amount = item.baseAmountPaise / 3 / 100;
  item.batches = [{ ...item.batches![0], sellingPricePaise: 3333, mrpPaise: 4000, quantity: 2 }, { ...item.batches![0], batchNumber: "NEXT", sellingPricePaise: 3335, mrpPaise: 4000, quantity: 1 }];
  const calc = calculatePharmacyDocument({ policy: "pharmacy-paise-v2", currency: "INR", priceMode: "inclusive", taxMode: "sgst", lines: [{ lineId: f.intent[0].lineId, quantity: 3, unitPrice: { numeratorPaise: 10001, denominatorUnits: 3 }, gstRateBps: 1800 }] });
  f.invoice.calculation = calc;
  expect(validateOfflineLedgerPricing(f.invoice, f.intent).totals.payablePaise).toBe(10001);
  item.batches[0].sellingPricePaise = 4001;
  expect(() => validateOfflineLedgerPricing(f.invoice, f.intent)).toThrow();
});
it("rejects unsafe multiplication and anonymous high-value bills before ledger mutation", () => {
  const large = fixture([5_000_000], [0], 0, 0, "unregistered");
  expect(() => validateOfflineLedgerPricing(large.invoice, large.intent)).toThrow();
  const overflow = fixture(); overflow.invoice.items[0].batches![0].quantity = Number.MAX_SAFE_INTEGER;
  overflow.invoice.items[0].quantity = Number.MAX_SAFE_INTEGER;
  expect(() => validateOfflineLedgerPricing(overflow.invoice, overflow.intent)).toThrow();
});
