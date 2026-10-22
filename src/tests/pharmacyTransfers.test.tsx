import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PharmacyTransfers } from "@/components/pharmacy/PharmacyTransfers";
import { parseTransfer, parseTransferReference } from "@/lib/pharmacyTransfers";
const source = "a".repeat(24), destination = "b".repeat(24), transferId = "d".repeat(24);
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const transfer = (fields: object = {}) => ({ id: transferId, organizationId: "c".repeat(24), sourceLocationId: source, destinationLocationId: destination, sourceMedicineId: "1".repeat(24), destinationMedicineId: "2".repeat(24), sourceBatchId: "3".repeat(24),
  sourceName: "Recorded product", destinationName: "Recorded product", unit: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 }, lot: { batchNumber: "ACTUAL-BATCH", expiryDate: "2099-12-31T18:30:00Z", costBasis: { totalPaise: 10001, receivedBaseUnits: 10, currency: "INR" } },
  quantity: 3, status: "draft", revision: 0, dispatchedQuantity: 0, receivedQuantity: 0, quarantinedQuantity: 0, lostQuantity: 0, returnedQuantity: 0, inTransitQuantity: 0, transportReference: "DELIVERY-42", reviewReference: "Actual transfer review", ...fields });
const response = (data: unknown) => ({ data: { data } });
const view = (locationId = source) => <PharmacyTransfers locationId={locationId} locations={[{ id: source, name: "Source branch" }, { id: destination, name: "Destination branch" }]} canStart />;
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  useAuthStore.setState({ user: { id: "operator", name: "Operator", role: "stock_manager", organization_id: "c".repeat(24), email: "operator@example.test", permissions: ["PHARMACY_TRANSFER", "PHARMACY_VIEW_COST"] } });
  vi.mocked(api.get).mockImplementation(async url => response(String(url).startsWith("/pharmacy/transfers?") ? { items: [transfer()], nextCursor: null } : transfer()));
});
it("requires reconciled branch quantities and preserves exact fractional cost", () => {
  expect(parseTransfer(transfer(), source).lot.costBasis).toEqual({ totalPaise: 10001, receivedBaseUnits: 10, currency: "INR" });
  expect(() => parseTransfer(transfer(), "e".repeat(24))).toThrow(/does not reconcile/);
  expect(() => parseTransfer(transfer({ status: "in_transit", dispatchedQuantity: 3, receivedQuantity: 2, inTransitQuantity: 2 }), source)).toThrow(/does not reconcile/);
  expect(() => parseTransfer(transfer({ status: "closed", dispatchedQuantity: 3, receivedQuantity: 2, inTransitQuantity: 1 }), source)).toThrow(/does not reconcile/);
});
it("rejects an opaque reference that loses its stage or source identity", () => {
  expect(parseTransferReference(JSON.stringify({ key: "reference-42", action: "receive", transferId }))).toEqual({ key: "reference-42", action: "receive", transferId });
  expect(() => parseTransferReference(JSON.stringify({ key: "reference-42", action: "receive" }))).toThrow(/needs review/);
});
it("loads current branch history without silently moving stock", async () => {
  render(view()); await screen.findByRole("button", { name: /DELIVERY-42/ }); expect(api.post).not.toHaveBeenCalled();
  expect(api.get).toHaveBeenCalledWith(`/pharmacy/transfers?locationId=${source}`);
});
it("prepares one explicitly mapped source batch and destination product without a clinical request", async () => {
  vi.mocked(api.get).mockImplementation(async url => {
    const value = String(url), branch = value.includes(`locationId=${destination}`) ? destination : source;
    return response(value.startsWith("/pharmacy/transfers?") ? { items: [], nextCursor: null }
      : value.startsWith("/pharmacy/transfer-products") ? { locationId: branch, items: [{ id: (branch === source ? "1" : "2").repeat(24), name: "Recorded product", identity: "Recorded formulation", stockQuantity: branch === source ? 10 : 0, unit: "tablet" }] }
      : { locationId: source, medicineId: "1".repeat(24), items: [{ id: "3".repeat(24), batchNumber: "ACTUAL-BATCH", quantity: 10, expiryDate: "2099-12-31T18:30:00Z", costBasis: { totalPaise: 10001, receivedBaseUnits: 10, currency: "INR" } }], nextCursor: null });
  });
  vi.mocked(api.post).mockImplementation(async (_url, _input, config) => response(transfer({ requestKey: (config!.headers as Record<string, string>)["Idempotency-Key"], eventId: "4".repeat(24) })));
  render(view()); await screen.findByRole("button", { name: "Refresh transfers" });
  const choose = async (label: string, option: RegExp) => { fireEvent.click(screen.getByRole("combobox", { name: label })); fireEvent.click(await screen.findByRole("option", { name: option })); };
  await choose("Destination branch", /Destination branch/); fireEvent.click(screen.getByRole("button", { name: "Search source products" }));
  await waitForReady("Source product", /Recorded product/); await choose("Source batch", /ACTUAL-BATCH/);
  fireEvent.click(screen.getByRole("button", { name: "Search destination products" })); await waitForReady("Destination product", /Recorded product/);
  fireEvent.change(screen.getByLabelText("Transfer base quantity"), { target: { value: "3" } }); fireEvent.change(screen.getByLabelText("Delivery document reference *"), { target: { value: "DELIVERY-42" } }); fireEvent.change(screen.getByLabelText("Transfer preparation review reference *"), { target: { value: "Actual transfer review" } });
  fireEvent.click(screen.getByRole("button", { name: "Prepare reviewed transfer" })); await screen.findByText("Transfer stage recorded");
  expect(api.post).toHaveBeenCalledWith("/pharmacy/transfers", { locationId: source, destinationLocationId: destination, sourceMedicineId: "1".repeat(24), destinationMedicineId: "2".repeat(24), sourceBatchId: "3".repeat(24), quantity: 3, transportReference: "DELIVERY-42", reviewReference: "Actual transfer review" }, expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }) }));
  expect(vi.mocked(api.get).mock.calls.every(([url]) => String(url).startsWith("/pharmacy/transfer"))).toBe(true);
  async function waitForReady(label: string, option: RegExp) { await waitFor(() => expect(screen.getByRole("combobox", { name: label })).not.toBeDisabled()); await choose(label, option); }
});
it("reads older custody events through the bounded history cursor", async () => {
  const cursor = "6".repeat(24);
  vi.mocked(api.get).mockImplementation(async url => response(String(url).startsWith("/pharmacy/transfers?") ? { items: [transfer()], nextCursor: null } : transfer({ nextEventsCursor: String(url).includes("eventCursor=") ? null : cursor,
    events: [{ id: "7".repeat(24), action: "create", revision: 0, quantity: 3, disposition: null, reviewReference: "Original physical document review", createdAt: "2026-10-21" }] })));
  render(view()); fireEvent.click(await screen.findByRole("button", { name: /DELIVERY-42/ })); fireEvent.click(await screen.findByRole("button", { name: "Older transfer stages" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/pharmacy/transfers/${transferId}?locationId=${source}&eventCursor=${cursor}`));
});
it("recovers a lost response with its saved stage key and unlocks the next stage only after acknowledgement", async () => {
  let recordedKey = "";
  vi.mocked(api.post).mockImplementation(async (_url, _input, config) => { recordedKey = (config!.headers as Record<string, string>)["Idempotency-Key"]; throw new Error("Response lost"); });
  vi.mocked(api.get).mockImplementation(async url => response(String(url).startsWith("/pharmacy/transfers?") ? { items: [transfer()], nextCursor: null }
    : String(url).startsWith("/pharmacy/transfer-operations/") ? transfer({ status: "approved", revision: 1, requestKey: recordedKey, eventId: "4".repeat(24) }) : transfer({ ...(recordedKey ? { status: "approved", revision: 1 } : {}) })));
  render(view()); fireEvent.click(await screen.findByRole("button", { name: /DELIVERY-42/ }));
  fireEvent.change(await screen.findByLabelText("Transfer stage review reference *"), { target: { value: "Actual branch review 42" } }); fireEvent.click(screen.getByRole("button", { name: "Approve both branches" }));
  await screen.findByText("Response lost");
  const saved = sessionStorage.getItem(`pharmacy-transfer:${JSON.stringify(["operator", "c".repeat(24), null])}:${source}`)!;
  expect(JSON.parse(saved)).toEqual({ key: recordedKey, action: "approve", transferId }); expect(saved).not.toContain("Actual branch review");
  fireEvent.click(screen.getByRole("button", { name: "Check transfer outcome" })); await screen.findByText("Transfer stage recorded");
  expect(screen.getByRole("button", { name: "Approve both branches" })).toBeDisabled(); fireEvent.click(screen.getByRole("button", { name: "Acknowledge recorded transfer stage" }));
  await screen.findByRole("button", { name: "Dispatch approved batch" }); expect(api.post).toHaveBeenCalledTimes(1);
});
it("retries an unchanged failed stage with the same body and idempotency key", async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error("Response lost")).mockImplementation(async (_url, _input, config) => response(transfer({ status: "approved", revision: 1, requestKey: (config!.headers as Record<string, string>)["Idempotency-Key"], eventId: "4".repeat(24) })));
  render(view()); fireEvent.click(await screen.findByRole("button", { name: /DELIVERY-42/ })); fireEvent.change(await screen.findByLabelText("Transfer stage review reference *"), { target: { value: "Actual reviewed approval" } }); fireEvent.click(screen.getByRole("button", { name: "Approve both branches" }));
  await screen.findByText("Response lost"); fireEvent.click(screen.getByRole("button", { name: "Retry same transfer stage" })); await screen.findByText("Transfer stage recorded");
  expect(vi.mocked(api.post).mock.calls[1]).toEqual(vi.mocked(api.post).mock.calls[0]);
});
it("clears private records on permission revocation without another stock request", async () => {
  render(view()); await screen.findByRole("button", { name: /DELIVERY-42/ }); const calls = vi.mocked(api.get).mock.calls.length;
  await act(async () => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } }));
  expect(screen.getByText("Transfer access required")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: /DELIVERY-42/ })).not.toBeInTheDocument(); expect(api.get).toHaveBeenCalledTimes(calls);
});
it("restores an opaque pending stage after reload and blocks a new physical command", async () => {
  const stored = `pharmacy-transfer:${JSON.stringify(["operator", "c".repeat(24), null])}:${source}`;
  sessionStorage.setItem(stored, JSON.stringify({ key: "existing-reference-42", action: "dispatch", transferId })); render(view());
  await screen.findByRole("button", { name: "Check transfer outcome" }); expect(screen.getByRole("button", { name: "Prepare reviewed transfer" })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
});
