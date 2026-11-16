import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyPreparedCounter } from "@/components/pharmacy/PharmacyPreparedCounter";
import { ToastProvider } from "@/components/ui";
import { buildOfflinePharmacyDocument } from "@/lib/generated/pharmacyOfflineDocument";
import type { OfflineCartIntent } from "@/lib/pharmacyOfflineLedger";
import type { OfflineSessionControl } from "@/lib/pharmacyOfflineSession";

const sdk = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/lib/pharmacyOfflineCheckout", () => ({ openOfflineCheckout: sdk.open }));
vi.mock("@/components/pharmacy/PharmacySavedBillPrint", () => ({ PharmacySavedBillPrint: ({ savedDocument }: { savedDocument: { invoiceNumber: string } }) => <p data-testid="local-print">{savedDocument.invoiceNumber}</p> }));
const actorId = "a".repeat(24), productId = "b".repeat(24), authorityId = "12345678-1234-4123-8123-123456789012";
const control = { organizationId: "c".repeat(24), locationId: "d".repeat(24), actorId, deviceId: authorityId, authorityId, phase: "active" } as OfflineSessionControl;
const product = { id: productId, name: "Prepared cotton", genericName: "Cotton", availableQuantity: 20, stockQuantity: 20, barcodes: ["8901234567890"], unitDefinition: { version: 1, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 }, hsnSacCode: "300490", unitCode: "NOS", gstRateBps: 0, taxTreatment: "nil_rated" };
const lot = { id: "e".repeat(24), medicineId: productId, batchNumber: "PREPARED", expiryValue: "2099-12", expiryPrecision: "month" as const, quantity: 20, sellingPricePaise: 1500, mrpPaise: 2000 };
const issuer = { legalName: "Synthetic pharmacy", address: "Synthetic address", stateCode: "24", registration: "unregistered", drugLicenceNumbers: ["TEST"], authorisedSignatory: "Synthetic pharmacist" };
function sale(cart: OfflineCartIntent) {
  const issuedAt = "2026-11-15T06:00:00.000Z", invoice = buildOfflinePharmacyDocument({ actorId, issuedAt, financialYear: "2026-27", issuer, issuerRevision: 1, issuerReviewReference: "Synthetic review",
    invoiceDiscountPaise: cart.invoiceDiscountPaise, roundOffPaise: 0, lines: cart.lines.map(line => ({ lineId: line.lineId, product, allocations: [{ ...lot, quantity: line.quantity }], discountPaise: line.discountPaise })) });
  return { ...cart, leaseId: authorityId, invoice, lines: cart.lines.map(line => ({ lineId: line.lineId, medicineId: line.medicineId, discountPaise: line.discountPaise, allocations: [{ lotId: lot.id, quantity: line.quantity, expectedRevision: 0 }] })), payment: { manualConfirmed: true, cashTenderedPaise: cart.cashTenderedPaise, shiftId: "f".repeat(24), drawerCode: "TEST" } };
}
function fixture() {
  let savedDraft: unknown = null;
  const ledger = { checkoutState: vi.fn(async () => ({ active: true, policyCurrent: true, stopped: null })), activeSale: vi.fn(async () => null), readDraft: vi.fn(async () => null),
    saveDraft: vi.fn(async (value: unknown) => { savedDraft = value; }), finishSale: vi.fn(async () => {}), recent: vi.fn(async () => []), getProduct: vi.fn(async () => ({ quantity: 20 })), prepareSale: vi.fn(async (cart: OfflineCartIntent) => sale(cart)) };
  const runtime = { prepared: { products: [product], lots: [lot] }, ledger, sync: { flush: vi.fn(async () => ({ status: "idle" })), pause: vi.fn() }, close: vi.fn(),
    save: vi.fn(async (cart: OfflineCartIntent) => { const original = sale(cart); return { receipt: { ...original, version: 2, scope: control, sequence: 1, invoice: { ...original.invoice, invoiceNumber: "OWNER/000137" }, payment: { ...original.payment, collectedPaise: original.invoice.totalAmount * 100, changePaise: cart.cashTenderedPaise - original.invoice.totalAmount * 100 } }, digest: "a".repeat(64), deviceSignature: "A".repeat(86) }; }) };
  return { runtime, draft: () => savedDraft };
}
let f: ReturnType<typeof fixture>;
beforeEach(() => { vi.clearAllMocks(); f = fixture(); sdk.open.mockResolvedValue(f.runtime); });
afterEach(cleanup);
async function unlock() {
  render(<ToastProvider><PharmacyPreparedCounter control={control} actorId={actorId} /></ToastProvider>);
  fireEvent.change(screen.getByLabelText("Offline passphrase"), { target: { value: "Synthetic offline phrase" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock counter" }));
  await screen.findByRole("button", { name: "Add Prepared cotton" });
}
it("uses local prepared quantities and Save/Print without a server quote or collection dialog", async () => {
  await unlock(); fireEvent.click(screen.getByRole("button", { name: "Add Prepared cotton" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Quantity for Prepared cotton"), { target: { value: "3" } });
  expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Save & print" }));
  await screen.findByTestId("local-print");
  expect(f.runtime.save).toHaveBeenCalledTimes(1); expect(f.runtime.save.mock.calls[0][0]).toMatchObject({ actorId, cashTenderedPaise: 4500, lines: [{ medicineId: productId, quantity: 3 }] });
  expect(f.runtime.ledger.finishSale).toHaveBeenCalledTimes(1); expect(f.draft()).toMatchObject({ cart: [] }); expect(screen.getByText("Your cart is empty")).toBeVisible();
});
it("keeps held carts when another bill saves and prevents cash underpayment", async () => {
  await unlock(); fireEvent.click(screen.getByRole("button", { name: "Add Prepared cotton" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled());
  fireEvent.keyDown(window, { key: "F4" }); expect(await screen.findByRole("button", { name: /Held 1/ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Add Prepared cotton" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save counter bill" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Cash received (INR)"), { target: { value: "10" } }); expect(screen.getByRole("button", { name: "Save counter bill" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Cash received (INR)"), { target: { value: "20" } }); fireEvent.keyDown(window, { key: "F10" });
  await waitFor(() => expect(f.runtime.save).toHaveBeenCalledTimes(1)); await waitFor(() => expect(f.draft()).toMatchObject({ cart: [], held: [{ cart: [{ medicineId: productId }] }] }));
});
it("locks financial plaintext and refuses an operator other than the prepared actor", async () => {
  const view = render(<ToastProvider><PharmacyPreparedCounter control={control} actorId={"0".repeat(24)} /></ToastProvider>);
  expect(screen.getByRole("button", { name: "Unlock counter" })).toBeDisabled(); expect(sdk.open).not.toHaveBeenCalled(); view.unmount();
  await unlock(); fireEvent.click(screen.getByRole("button", { name: "Lock" }));
  expect(screen.getByRole("button", { name: "Unlock counter" })).toBeVisible(); expect(f.runtime.close).toHaveBeenCalled(); expect(screen.queryByRole("button", { name: "Add Prepared cotton" })).not.toBeInTheDocument();
});
