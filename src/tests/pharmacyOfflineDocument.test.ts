// @vitest-environment node
import crypto from "node:crypto";
import fs from "node:fs";
import { expect, it } from "vitest";
import { buildOfflinePharmacyDocument, PHARMACY_OFFLINE_DOCUMENT_SHA256, type OfflineDocumentInput } from "@/lib/generated/pharmacyOfflineDocument";
import { canPrintPharmacyInvoice } from "@/lib/pharmacyInvoice";
import { validateOfflineLedgerPricing } from "@/lib/pharmacyOfflinePricing";

const input = (): OfflineDocumentInput => ({ actorId: "a".repeat(24), issuedAt: "2026-11-15T06:00:00.000Z", financialYear: "2026-27", issuerRevision: 1, issuerReviewReference: "Synthetic issuer review",
  issuer: { legalName: "Synthetic pharmacy", address: "Synthetic address", stateCode: "24", registration: "unregistered", drugLicenceNumbers: ["SYNTHETIC"], authorisedSignatory: "Synthetic pharmacist" },
  invoiceDiscountPaise: 0, roundOffPaise: 0, lines: [{ lineId: "line-0001", discountPaise: 0,
    product: { id: "b".repeat(24), name: "Synthetic cotton", hsnSacCode: "300490", unitCode: "NOS", gstRateBps: 0, taxTreatment: "nil_rated", unitDefinition: { version: 1, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 } },
    allocations: [{ id: "c".repeat(24), medicineId: "b".repeat(24), batchNumber: "ORIGINAL", quantity: 3, expiryValue: "2027-12", expiryPrecision: "month", sellingPricePaise: 1500, mrpPaise: 2000 }] }] });
it("ships the exact captured-document source with a pinned digest", () => {
  const generated = fs.readFileSync("src/lib/generated/pharmacyOfflineDocument.ts", "utf8").split("\n").slice(2).join("\n").replace('from "./pharmacyCalculation"', 'from "./pharmacyCalculation.ts"');
  expect(crypto.createHash("sha256").update(generated).digest("hex")).toBe(PHARMACY_OFFLINE_DOCUMENT_SHA256);
  if (fs.existsSync("../backend/utilities/pharmacyOfflineDocument.ts")) expect(generated).toBe(fs.readFileSync("../backend/utilities/pharmacyOfflineDocument.ts", "utf8").replace(/\r\n/g, "\n"));
});
it("builds printable anonymous cash evidence and revalidates its captured pricing", () => {
  const f = input(), invoice = buildOfflinePharmacyDocument(f);
  expect(invoice.totalAmount).toBe(45); expect(invoice.amountPaid).toBe(45); expect(invoice.tax).toBe(0);
  expect(canPrintPharmacyInvoice({ ...invoice, invoiceNumber: "I00012627/000001", numberingVersion: 2 })).toBe(true);
  expect(validateOfflineLedgerPricing(invoice, f.lines.map(line => ({ lineId: line.lineId, medicineId: line.product.id, discountPaise: line.discountPaise }))).totals.payablePaise).toBe(4500);
});
it("aggregates differing lot prices and applies declared discounts without changing captured source prices", () => {
  const f = input(); f.lines[0].allocations[0].quantity = 2;
  f.lines[0].allocations.push({ ...f.lines[0].allocations[0], id: "d".repeat(24), batchNumber: "NEXT", quantity: 1, sellingPricePaise: 1600 });
  f.lines[0].discountPaise = 100; f.invoiceDiscountPaise = 50;
  const invoice = buildOfflinePharmacyDocument(f);
  expect(invoice.totalAmount).toBe(44.5); expect(invoice.items[0].batches.map(lot => lot.sellingPricePaise)).toEqual([1500, 1600]);
});
it.each(["mrp", "foreign-lot", "expired", "duplicate-lot", "financial-year", "free", "high-value"])("rejects unsupported or conflicting captured evidence: %s", variant => {
  const f = input(), lot = f.lines[0].allocations[0];
  if (variant === "mrp") lot.mrpPaise = 1000;
  if (variant === "foreign-lot") lot.medicineId = "d".repeat(24);
  if (variant === "expired") lot.expiryValue = "2026-10";
  if (variant === "duplicate-lot") f.lines[0].allocations.push({ ...lot });
  if (variant === "financial-year") f.financialYear = "2025-26";
  if (variant === "free") f.invoiceDiscountPaise = 4500;
  if (variant === "high-value") { lot.sellingPricePaise = 5_000_000; lot.mrpPaise = 5_000_000; }
  expect(() => buildOfflinePharmacyDocument(f)).toThrow();
});
