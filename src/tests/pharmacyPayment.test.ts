import { expect, it } from "vitest";
import { prepareCheckoutPayment, prepareCounterCollection, prepareIssuedCheckoutPayment, type PaymentPart } from "@/lib/pharmacyPayment";
import type { CounterInvoice } from "@/lib/pharmacyCollections";
const invoice = { locationId: "branch", paymentRevision: 2, balanceDue: 75, customerSnapshot: { anonymous: false } } as CounterInvoice;
const part = (amount = "75", method: PaymentPart["paymentMethod"] = "cash", id = "one"): PaymentPart => ({ componentId: id, amount, paymentMethod: method, referenceNumber: method === "cash" ? "" : "VERIFIED-123" });
it("prepares a conditional initial receipt without loading a full new invoice", () => {
  const payment = { method: "cash" as const, tender: "100", referenceNumber: "", expectedTotalPaise: 7500 };
  expect(prepareIssuedCheckoutPayment("branch", 7500, payment)).toMatchObject({ locationId: "branch", expectedPaymentRevision: 0, expectedBalancePaise: 7500, manualConfirmed: true, cashTenderedPaise: 10000 });
  expect(prepareIssuedCheckoutPayment("branch", 7600, payment)).toBeNull();
  expect(prepareIssuedCheckoutPayment("branch", 0, payment)).toBeNull();
  expect(prepareIssuedCheckoutPayment("branch", 7500, { ...payment, tender: "74" })).toBeNull();
  expect(prepareIssuedCheckoutPayment("branch", 7500, { ...payment, method: "card" })).toBeNull();
});
it("binds the one-step confirmed payment to the unchanged saved invoice balance", () => {
  const bill = { ...invoice, amountPaid: 0, totalAmount: 75 };
  const payment = { method: "cash" as const, tender: "100", referenceNumber: "", expectedTotalPaise: 7500 };
  expect(prepareCheckoutPayment(bill, payment)).toMatchObject({ manualConfirmed: true, expectedBalancePaise: 7500, cashTenderedPaise: 10000 });
  expect(prepareCheckoutPayment({ ...bill, amountPaid: 1 }, payment)).toBeNull();
  expect(prepareCheckoutPayment({ ...bill, balanceDue: 74 }, payment)).toBeNull();
  expect(prepareCheckoutPayment({ ...bill, totalAmount: 76 }, payment)).toBeNull();
  expect(prepareCheckoutPayment(bill, { ...payment, tender: "74" })).toBeNull();
  expect(prepareCheckoutPayment(bill, { ...payment, method: "upi" })).toBeNull();
});
it("collects the bill amount and returns change from cash handed over", () => {
  const result = prepareCounterCollection(invoice, [part()], "100", true);
  expect(result).toMatchObject({ problem: "", total: 7500, change: 2500, remaining: 0 });
  expect(result.input).toMatchObject({ expectedPaymentRevision: 2, expectedBalancePaise: 7500, cashTenderedPaise: 10000, manualConfirmed: true });
});
it.each(["upi", "card"] as const)("requires a verified %s reference and ignores stale cash input", method => {
  expect(prepareCounterCollection(invoice, [part("75", method)], "bad", true).input).toMatchObject({ cashTenderedPaise: 0 });
  expect(prepareCounterCollection(invoice, [{ ...part("75", method), referenceNumber: "" }], "0", true).input).toBeNull();
});
it("allows partial payment only for recorded customers", () => {
  expect(prepareCounterCollection(invoice, [part("25")], "25", false)).toMatchObject({ problem: "", remaining: 5000 });
  expect(prepareCounterCollection(invoice, [part("25")], "25", true).input).toBeNull();
  expect(prepareCounterCollection({ ...invoice, customerSnapshot: { anonymous: true } }, [part("25")], "25", false).input).toBeNull();
});
it("balances mixed cash and digital payments exactly and calculates cash change", () => {
  const result = prepareCounterCollection(invoice, [part("20"), part("30", "upi", "two"), part("25", "card", "three")], "50", true);
  expect(result).toMatchObject({ problem: "", cash: 2000, change: 3000, total: 7500, remaining: 0 });
});
it.each(["", "0", "-1", "1.001", "NaN", "9007199254740992"])("refuses invalid monetary amount %s", amount => {
  expect(prepareCounterCollection(invoice, [part(amount)], "100", false).input).toBeNull();
});
it("rejects overcollection, insufficient cash, duplicate components and too many methods", () => {
  expect(prepareCounterCollection(invoice, [part("76")], "100", true).input).toBeNull();
  expect(prepareCounterCollection(invoice, [part()], "74.99", true).input).toBeNull();
  expect(prepareCounterCollection(invoice, [part("25"), part("50")], "75", true).input).toBeNull();
  expect(prepareCounterCollection(invoice, [], "0", false).input).toBeNull();
  expect(prepareCounterCollection(invoice, Array.from({ length: 11 }, (_, i) => part("1", "cash", String(i))), "11", false).input).toBeNull();
});
