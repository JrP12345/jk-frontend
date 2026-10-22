import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyPurchaseOperations } from "@/components/pharmacy/PharmacyPurchaseOperations";
import type { PurchaseDraft } from "@/services/pharmacyPurchase.service";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const changed = vi.fn(), close = vi.fn();
const purchase: PurchaseDraft = { id: "purchase", locationId: "branch", supplierId: "supplier", supplierSnapshot: { name: "Saved supplier", address: "Saved address", revision: 0 },
  supplierInvoiceNumber: "INV-SAVED", invoiceDate: "2026-10-20", invoiceFY: "2026-2027", statedTotalPaise: 118, revision: 0, status: "draft", notes: "",
  lines: [{ lineId: "source-line-0001", medicineId: "medicine", expectedUnitVersion: 1, packs: 0, looseUnits: 3, freePacks: 0, freeLooseUnits: 1,
    billedBaseUnits: 3, freeBaseUnits: 1, baseAmountPaise: 100, discountPaise: 0, gstRateBps: 1800, hsnCode: "300490", sellingPricePaise: 1000,
    unitSnapshot: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 }, medicineSnapshot: { name: "Saved product", genericName: "Synthetic" } }] };
const posted: PurchaseDraft = { ...purchase, status: "posted", revision: 1, posting: { payablePaise: 118, postedAt: "2026-10-20T10:00:00Z", reviewReference: "Synthetic", costTreatment: "exclude_tax" }, receiptProgress: [{ lineId: "source-line-0001", billedBaseUnits: 0, freeBaseUnits: 0, costPaise: 0 }] };
const response = (data: unknown) => ({ data: { data } });
const mount = (record = purchase, canManage = true, canReceive = true) => render(<ToastProvider><PharmacyPurchaseOperations purchase={record} canManage={canManage} canReceive={canReceive} onClose={close} onChanged={changed} /></ToastProvider>);
function change(label: string, value: string) {
  const control = screen.getByLabelText(label), input = control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control;
  fireEvent.change(input, { target: { value } });
}
async function review() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Post saved supplier invoice" })).not.toBeDisabled());
  change("Reviewed supplier state code", "27"); change("Reviewed supplier GST split", "sgst"); change("Reviewed acquisition cost treatment", "exclude_tax"); change("Supplier eligibility and tax review reference", "Actual recorded review reference");
}
function receipt() {
  change("Actual delivery reference", "ACTUAL-DELIVERY"); change("Received billed base units 1", "2"); change("Received free base units 1", "1"); change("Printed batch 1", "ACTUAL-BATCH"); change("Printed expiry 1", "2099-12");
}
beforeEach(() => {
  useAuthStore.setState({ user: { id: "buyer", name: "Buyer", email: "buyer@example.test", role: "buyer", organization_id: "org", permissions: ["PHARMACY_PURCHASE", "PHARMACY_RECEIVE_STOCK"] } });
  sessionStorage.clear(); changed.mockReset(); close.mockReset();
  api.get.mockReset().mockImplementation(async (url: string) => url.includes("/parties/") ? response({ id: "supplier", revision: 5 }) : response({ items: [], nextCursor: null }));
  api.post.mockReset().mockImplementation(async (_url: string, _body: unknown, config: { headers: { "Idempotency-Key": string } }) => response({ purchaseId: purchase.id, requestKey: config.headers["Idempotency-Key"], payablePaise: 118, revision: 1 }));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.restoreAllMocks(); });

it("posts only the saved source revision with explicit review and acknowledges the confirmed reference", async () => {
  mount(); await review(); fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" }));
  await screen.findByText(/Supplier payable posted:/);
  expect(api.post).toHaveBeenCalledWith("/pharmacy/purchases/purchase/post", { locationId: "branch", expectedRevision: 0, expectedSupplierRevision: 5, supplierStateCode: "27", taxMode: "sgst", costTreatment: "exclude_tax", roundOffPaise: 0, reviewReference: "Actual recorded review reference" }, expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }));
  expect(changed).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Done with purchase operation" })); expect(changed).toHaveBeenCalledTimes(1); expect(sessionStorage.length).toBe(0);
});
it("freezes the original posting payload and reference after an uncertain save", async () => {
  api.post.mockRejectedValueOnce(new Error("offline")); mount(); await review(); fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" }));
  await screen.findByText("offline"); const first = api.post.mock.calls[0];
  expect(screen.queryByLabelText("Reviewed supplier state code")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry same purchase operation" })); await screen.findByText(/Supplier payable posted:/);
  expect(api.post.mock.calls[1]).toEqual(first);
  expect(JSON.stringify(sessionStorage.getItem(sessionStorage.key(0)!))).not.toMatch(/Saved supplier|review reference|taxMode|payable/);
});
it("retains an opaque reference after reload and recovers without issuing another command", async () => {
  api.post.mockRejectedValueOnce(new Error("timeout")); const firstView = mount(); await review(); fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" }));
  await screen.findByText("timeout"); const requestKey = api.post.mock.calls[0][2].headers["Idempotency-Key"]; firstView.unmount();
  api.get.mockImplementation(async (url: string) => url.includes("/operations/") ? response({ purchaseId: "purchase", requestKey, payablePaise: 118 }) : response({ id: "supplier", revision: 5 }));
  mount(); fireEvent.click(screen.getByRole("button", { name: "Check purchase result" })); await screen.findByText(/Supplier payable posted:/);
  expect(api.post).toHaveBeenCalledTimes(1); expect(api.get).toHaveBeenCalledWith(expect.stringContaining(`/operations/post/${requestKey}?locationId=branch`));
});
it("submits base quantities and printed expiry without accepting client acquisition-cost or payable overrides", async () => {
  api.post.mockImplementation(async (_url: string, _body: unknown, config: { headers: { "Idempotency-Key": string } }) => response({ purchaseId: "purchase", receiptId: "received", requestKey: config.headers["Idempotency-Key"] }));
  mount(posted); receipt(); fireEvent.click(screen.getByRole("button", { name: "Record purchase delivery" })); await screen.findByText("Delivery recorded.");
  expect(api.post.mock.calls[0][0]).toBe("/pharmacy/purchases/purchase/receipts");
  expect(api.post.mock.calls[0][1]).toMatchObject({ locationId: "branch", expectedRevision: 1, deliveryReference: "ACTUAL-DELIVERY", lines: [{ lineId: expect.any(String), purchaseLineId: "source-line-0001", billedBaseUnits: 2, freeBaseUnits: 1, batchNumber: "ACTUAL-BATCH", expiry: { precision: "month", value: "2099-12" } }] });
  expect(api.post.mock.calls[0][1]).not.toHaveProperty("payablePaise"); expect(api.post.mock.calls[0][1].lines[0]).not.toHaveProperty("costPaise");
});
it("requires recorded positive quantities and supports more than one delivery lot", async () => {
  mount(posted); fireEvent.click(screen.getByRole("button", { name: "Record purchase delivery" })); await screen.findByText(/positive whole billed/); expect(api.post).not.toHaveBeenCalled();
  receipt(); fireEvent.click(screen.getByRole("button", { name: "Add delivery lot" })); expect(screen.getByLabelText("Printed batch 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove delivery line 2" })); expect(screen.queryByLabelText("Printed batch 2")).not.toBeInTheDocument();
});
it("preserves delivery recovery and displays history when new receiving authority is absent", async () => {
  api.get.mockResolvedValue(response({ items: [{ id: "receipt", deliveryReference: "OLD-DELIVERY", receivedAt: "2026-10-20T10:00:00Z", lines: [{ lineId: "one", batchNumber: "OLD-BATCH", billedBaseUnits: 1, freeBaseUnits: 0, costPaise: 25, expiry: { value: "2099-12" } }] }], nextCursor: "next-page" }));
  mount(posted, true, false); await screen.findByText("OLD-DELIVERY"); expect(screen.getByText(/Batch OLD-BATCH/)).toHaveTextContent(/1 billed/);
  expect(screen.queryByRole("button", { name: "Record purchase delivery" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next delivery page" })); await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining("cursor=next-page")));
  expect(api.post).not.toHaveBeenCalled();
});
it("does not dispatch when the recovery reference cannot be persisted", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); });
  mount(); await review(); fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" })); await screen.findByText("storage unavailable"); expect(api.post).not.toHaveBeenCalled(); storage.mockRestore();
});
it("allows a validation correction under the same reference without starting another command identity", async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: "Round-off needs review" } } });
  mount(); await review(); fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" })); await screen.findByText("Round-off needs review");
  const first = api.post.mock.calls[0]; fireEvent.click(screen.getByRole("button", { name: "Correct details using same reference" }));
  change("Reviewed invoice round-off (INR)", "0.01"); fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" })); await screen.findByText(/Supplier payable posted:/);
  expect(api.post.mock.calls[1][2]).toEqual(first[2]); expect(api.post.mock.calls[1][1].roundOffPaise).toBe(1);
});
it("retains recovery for an incomplete server result instead of displaying an invented zero payable", async () => {
  api.post.mockImplementation(async (_url: string, _body: unknown, config: { headers: { "Idempotency-Key": string } }) => response({ purchaseId: "purchase", requestKey: config.headers["Idempotency-Key"] }));
  mount(); await review(); fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" }));
  await screen.findByText(/Purchase outcome could not be confirmed/); expect(screen.queryByText(/Supplier payable posted:/)).not.toBeInTheDocument(); expect(sessionStorage.length).toBe(1);
});
it("ignores a late confirmation after the account changes", async () => {
  let finish!: (value: unknown) => void; api.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); await review(); fireEvent.click(screen.getByRole("button", { name: "Post saved supplier invoice" })); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const requestKey = api.post.mock.calls[0][2].headers["Idempotency-Key"]; view.unmount(); useAuthStore.setState({ user: null });
  await act(async () => { finish(response({ purchaseId: "purchase", requestKey, payablePaise: 118 })); });
  expect(changed).not.toHaveBeenCalled(); expect(screen.queryByText(/Supplier payable posted:/)).not.toBeInTheDocument(); expect(sessionStorage.length).toBe(1);
});
