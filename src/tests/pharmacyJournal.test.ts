import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createSaleJournal, createCollectionJournal } from "@/lib/pharmacyCommandJournal";
import { clearPharmacyDrafts } from "@/lib/pharmacyDrafts";
const sale = { key: "original-sale-key", input: { locationId: "branch", expectedQuoteHash: "a".repeat(64), expectedProfileRevision: 1, expectedTotalPaise: 1500, invoiceDiscountPaise: 0, roundOffPaise: 0, lines: [{ lineId: "line", medicineId: "medicine", quantity: 1, expectedUnitVersion: 1, expectedStockRevision: 3, discountPaise: 0 }] } };
const collection = { key: "original-collection-key", invoiceId: "invoice", input: { locationId: "branch", expectedPaymentRevision: 0, expectedBalancePaise: 1500, manualConfirmed: true as const, cashTenderedPaise: 2000, entries: [{ componentId: "component", paymentMethod: "cash" as const, amountPaise: 1500 }] } };
beforeEach(async () => { vi.stubGlobal("indexedDB", undefined); sessionStorage.clear(); await clearPharmacyDrafts(); });
afterEach(() => vi.unstubAllGlobals());
it("preserves the confirmed branch mode on recovery instead of turning an untracked sale into a tracked command", async () => {
  const journal = createSaleJournal("user", "branch"); await journal.load();
  const input = { ...sale, input: { ...sale.input, expectedInventoryMode: "billing_only" as const } };
  await journal.save(input);
  expect((await createSaleJournal("user", "branch").load()).value).toEqual(input);
  expect(() => journal.save({ ...input, input: { ...input.input, expectedInventoryMode: "invalid" } } as unknown as typeof input)).toThrow(/inventory mode/);
});
it("restores the original issue payload and key across component loss without creating a new sale", async () => {
  const journal = createSaleJournal("user", "branch"); await journal.load(); await journal.save(sale);
  sale.input.lines[0].quantity = 2;
  const restored = createSaleJournal("user", "branch"); expect((await restored.load()).value).toMatchObject({ key: "original-sale-key", input: { lines: [{ quantity: 1 }] } });
  sale.input.lines[0].quantity = 1; await restored.save(null); expect((await createSaleJournal("user", "branch").load()).value).toBeNull();
});
it("freezes confirmed payment evidence separately and strips unrelated personal details", async () => {
  const journal = createCollectionJournal("user", "branch"); await journal.load();
  await journal.save({ ...collection, input: { ...collection.input, patientName: "Private patient", cardNumber: "Private card" } } as typeof collection);
  const restored = (await createCollectionJournal("user", "branch").load()).value;
  expect(restored).toEqual(collection); expect(JSON.stringify(restored)).not.toMatch(/Private|patientName|cardNumber/);
  expect((await createSaleJournal("user", "branch").load()).value).toBeNull();
});
it("rejects invalid monetary/quantity intents and erases authority-revoked intents", async () => {
  const journal = createSaleJournal("user", "branch"); await journal.load();
  expect(() => journal.save({ ...sale, input: { ...sale.input, expectedTotalPaise: -1 } })).toThrow(/review/);
  await journal.save(sale); await clearPharmacyDrafts(); await expect(journal.load()).rejects.toThrow(/workspace changed/);
});
it("retains the exact atomic bill and confirmed payment for same-key retry, excluding unrelated secrets", async () => {
  const journal = createSaleJournal("user", "branch"); await journal.load();
  await journal.save({ ...sale, input: { ...sale.input, payment: { ...collection.input, cardNumber: "Never retain this" } } } as typeof sale);
  const saved = (await createSaleJournal("user", "branch").load()).value;
  expect(saved?.input.payment).toEqual(collection.input);
  expect(saved?.key).toBe(sale.key);
  expect(JSON.stringify(saved)).not.toContain("cardNumber");
});

it("retains current-total confirmation, line amounts and the print request for an identical retry", async () => {
  const journal = createSaleJournal("user", "branch"); await journal.load();
  const input = { locationId: "branch", confirmationMode: "current_total" as const, includeDocument: true as const, expectedTotalPaise: 1500, invoiceDiscountPaise: 0, roundOffPaise: 0, lines: [{ lineId: "line", medicineId: "medicine", quantity: 1, expectedUnitVersion: 1, expectedLineTotalPaise: 1500, discountPaise: 0 }], payment: collection.input };
  await journal.save({ key: sale.key, input });
  expect((await createSaleJournal("user", "branch").load()).value).toEqual({ key: sale.key, input });
  expect(() => journal.save({ key: sale.key, input: { ...input, expectedQuoteHash: "a".repeat(64) } })).toThrow(/review/);
  expect(() => journal.save({ key: sale.key, input: { ...input, lines: [{ ...input.lines[0], expectedLineTotalPaise: -1 }] } })).toThrow(/review/);
});

it("retains a named customer's exact part-payment and owner exception for an identical retry", async () => {
  const journal = createSaleJournal("user", "branch"); await journal.load();
  const input = { ...sale.input, customerId: "customer", expectedCustomerRevision: 0, creditOverrideReference: "Owner verified exception", payment: { ...collection.input, entries: [{ ...collection.input.entries[0], amountPaise: 500 }] } };
  await journal.save({ key: sale.key, input });
  expect((await createSaleJournal("user", "branch").load()).value?.input).toEqual(input);
  expect(() => journal.save({ key: sale.key, input: { ...input, customerId: undefined, expectedCustomerRevision: undefined, creditOverrideReference: undefined } })).toThrow(/payment differs/);
});
it("preserves the pickup source on recovery and refuses to add a payment before handover", async () => {
  const journal = createSaleJournal("user", "branch"); await journal.load(); const input = { ...sale.input, pickup: { id: "a".repeat(24), revision: 0 } };
  await journal.save({ key: sale.key, input }); expect((await createSaleJournal("user", "branch").load()).value?.input.pickup).toEqual(input.pickup);
  expect(() => journal.save({ key: sale.key, input: { ...input, payment: collection.input } })).toThrow(/pickup source/);
});
