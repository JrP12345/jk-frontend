import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { isPharmacyPaper, readPharmacyPaper, rememberPharmacyPaper } from "@/lib/pharmacyPrintPreferences";
import { printOfflinePharmacyReceipt } from "@/lib/pharmacyOfflinePrint";
import type { StoredOfflineReceipt } from "@/lib/pharmacyOfflineLedger";

beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
it("remembers only valid branch-local paper preferences without retaining invoice data", () => {
  expect(readPharmacyPaper("branch")).toBe("A4");
  expect(rememberPharmacyPaper("branch", "58mm")).toBe(true);
  expect(readPharmacyPaper("branch")).toBe("58mm"); expect(readPharmacyPaper("other-branch")).toBe("A4");
  expect(localStorage.length).toBe(1); expect(localStorage.getItem(localStorage.key(0)!)).toBe("58mm");
  expect(isPharmacyPaper("60mm")).toBe(false); expect(rememberPharmacyPaper("", "A4")).toBe(false);
  localStorage.setItem(localStorage.key(0)!, "corrupt-value"); expect(readPharmacyPaper("branch")).toBe("A4");
});
it("falls back when preference storage is blocked so Save and current printing need no localStorage permission", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  expect(readPharmacyPaper("branch")).toBe("A4"); expect(rememberPharmacyPaper("branch", "80mm")).toBe(false);
});
function savedReceipt(): StoredOfflineReceipt {
  return { receipt: { scope: { locationId: "branch" }, invoice: {
    kind: "pharmacy", createdBy: "cashier", customerSnapshot: { anonymous: true }, documentVersion: 2, currency: "INR", invoiceNumber: "I00012627/000001", financialYear: "2026-27", issuedAt: "2026-11-16T06:00:00Z", status: "paid",
    subtotal: 20, tax: 0, cgstTotal: 0, sgstTotal: 0, totalAmount: 20,
    calculation: { policy: "pharmacy-paise-v2", currency: "INR", priceMode: "inclusive", taxMode: "none", totals: { lineDiscountPaise: 0, invoiceDiscountPaise: 0, roundOffPaise: 0, grossAmountPaise: 2000, payablePaise: 2000 } },
    taxDocument: { version: 2, kind: "ordinary_bill", issuer: { legalName: "Saved pharmacy", address: "Saved address", stateCode: "24", registration: "unregistered", drugLicenceNumbers: ["TEST"], authorisedSignatory: "Pharmacist" }, recipient: { name: "Walk-in customer", stateCode: "24" }, placeOfSupply: "24", reverseCharge: false, issuedAt: "2026-11-16T06:00:00Z", signatureMode: "manual_on_print" },
    items: [{ description: "Cotton <img onerror=alert(1)>", quantity: 2, amount: 10, hsnSacCode: "300490", unitCode: "NOS", gstRate: 0, baseAmountPaise: 2000, cgstPaise: 0, sgstPaise: 0, grossAmountPaise: 2000,
      unitSnapshot: { baseUnit: "piece", packUnit: "box", unitsPerPack: 10 }, batches: [{ batchNumber: "ORIGINAL", quantity: 2, expiryValue: "2099-12", expiryPrecision: "month", sellingPricePaise: 1000, mrpPaise: 1200 }] }],
  }, payment: { collectedPaise: 2000, cashTenderedPaise: 2500, changePaise: 500 } } } as StoredOfflineReceipt;
}
it.each(["A4", "80mm", "58mm"] as const)("prints the original public receipt at remembered %s without altering it", paper => {
  const original = savedReceipt(), before = JSON.stringify(original), nativePrint = vi.spyOn(window, "print").mockImplementation(() => {});
  rememberPharmacyPaper("branch", paper);
  printOfflinePharmacyReceipt(original); printOfflinePharmacyReceipt(original);
  const output = document.getElementById("pharmacy-final-paper")!;
  expect(output.dataset.paper).toBe(paper); expect(document.querySelectorAll(".offline-paper")).toHaveLength(1);
  expect(output).toHaveTextContent("ORIGINAL"); expect(output).toHaveTextContent("Cotton <img onerror=alert(1)>"); expect(output.querySelector("img,script")).toBeNull();
  expect(nativePrint).toHaveBeenCalledTimes(2); expect(JSON.stringify(original)).toBe(before);
});
it("retains the saved paper when native printing is unavailable or throws, allowing a later exact reprint", () => {
  const original = savedReceipt(), before = JSON.stringify(original);
  const nativePrint = vi.spyOn(window, "print").mockImplementation(() => {}); printOfflinePharmacyReceipt(original);
  const prior = document.getElementById("pharmacy-final-paper");
  Object.defineProperty(window, "print", { configurable: true, writable: true, value: undefined });
  expect(() => printOfflinePharmacyReceipt(original)).toThrow(/bill remains saved/i); expect(document.getElementById("pharmacy-final-paper")).toBe(prior);
  Object.defineProperty(window, "print", { configurable: true, writable: true, value: nativePrint });
  nativePrint.mockImplementationOnce(() => { throw new Error("Driver unavailable"); });
  expect(() => printOfflinePharmacyReceipt(original)).toThrow("Driver unavailable"); expect(document.getElementById("pharmacy-final-paper")).toHaveTextContent(original.receipt.invoice.invoiceNumber);
  nativePrint.mockImplementation(() => {}); printOfflinePharmacyReceipt(original); expect(JSON.stringify(original)).toBe(before);
});
