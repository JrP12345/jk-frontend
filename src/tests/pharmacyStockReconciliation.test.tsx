import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { PharmacyStockReconciliation } from "@/components/pharmacy/PharmacyStockReconciliation";
import { countCsvTemplate, importCountCsv, stockCountStorageKey } from "@/lib/pharmacyStockReconciliation";
import { clearPharmacyDrafts } from "@/lib/pharmacyDrafts";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const locationId = "a".repeat(24), productId = "b".repeat(24), batchId = "c".repeat(24);
const path = `/pharmacy/locations/${locationId}/stock-reconciliation`;
const snapshot = { locationId, snapshotHash: "d".repeat(64), revision: 2, products: [{ id: productId, name: "Cotton", archived: false, quantity: 10, revision: 1, unit: { version: 1, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 }, pricePaise: 1500, billingSupply: null, lots: [{ id: batchId, batchNumber: "ACTUAL-LOT", expiry: { precision: "month" as const, value: "2099-12" }, quantity: 10, status: "active" }] }] };
const summary = { locationId, products: 1, changedProducts: 1, beforeUnits: 10, countedUnits: 6, newLots: 0 };
const envelope = (data: unknown) => ({ data: { data } });
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubGlobal("indexedDB", undefined); sessionStorage.clear(); await clearPharmacyDrafts();
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_ORGANIZATION", "MANAGE_MEDICINES"] } });
  vi.mocked(api.get).mockResolvedValue(envelope(snapshot));
  vi.mocked(api.post).mockImplementation(async (url, body, config) => envelope(String(url).includes("preview") ? { ...summary, previewHash: "e".repeat(64) } : { ...summary, inventoryMode: "tracked", revision: 3, requestKey: config?.headers?.["Idempotency-Key"] }));
});
afterEach(() => vi.unstubAllGlobals());
const mount = (completed = vi.fn()) => render(<PharmacyStockReconciliation locationId={locationId} onClose={vi.fn()} onCompleted={completed} />);
async function prepare() {
  await screen.findByLabelText("Physical count reference *");
  fireEvent.change(screen.getByLabelText("Physical count reference *"), { target: { value: "Actual shelf count" } });
  fireEvent.change(screen.getByLabelText("Actual piece: Cotton / ACTUAL-LOT"), { target: { value: "6" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview differences" }));
  await screen.findByText("Count preview");
}

it("requires explicit batch counts, previews without commit, and invalidates confirmation when a count changes", async () => {
  mount(); await screen.findByLabelText("Physical count reference *");
  fireEvent.change(screen.getByLabelText("Physical count reference *"), { target: { value: "Count reference" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview differences" }));
  await screen.findByText(/Enter the actual count/); expect(api.post).not.toHaveBeenCalled();
  await prepare();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Confirm count & enable tracking" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Confirm count & enable tracking" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Actual piece: Cotton / ACTUAL-LOT"), { target: { value: "7" } });
  expect(screen.queryByRole("button", { name: "Confirm count & enable tracking" })).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
});

it("confirms the exact preview once and keeps controls locked until the server commits", async () => {
  const completed = vi.fn(); mount(completed); await prepare(); fireEvent.click(screen.getByRole("checkbox"));
  let finish!: (value: unknown) => void;
  const post = vi.mocked(api.post).getMockImplementation()!;
  vi.mocked(api.post).mockImplementation((url, body, config) => String(url).endsWith("/commit") ? new Promise(resolve => { finish = async () => resolve(await post(url, body, config)); }) : post(url, body, config));
  fireEvent.click(screen.getByRole("button", { name: "Confirm count & enable tracking" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(completed).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Close count" })).toBeDisabled();
  expect(vi.mocked(api.post).mock.calls[1][1]).toMatchObject({ confirmed: true, previewHash: "e".repeat(64), counts: [{ medicineId: productId, lots: [{ batchId, quantity: 6 }] }] });
  await act(async () => finish(undefined));
  await waitFor(() => expect(completed).toHaveBeenCalledOnce());
  expect(sessionStorage.getItem(stockCountStorageKey(authScopeKey(useAuthStore.getState().user), locationId))).toBeNull();
});

it("recovers a lost-response count after remount without submitting a second command", async () => {
  vi.mocked(api.post).mockImplementation(async url => {
    if (String(url).endsWith("/commit")) throw Error("Response lost");
    return envelope({ ...summary, previewHash: "e".repeat(64) });
  });
  const view = mount(); await prepare(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Confirm count & enable tracking" }));
  await screen.findByText("Response lost");
  const key = vi.mocked(api.post).mock.calls[1][2]?.headers?.["Idempotency-Key"];
  view.unmount();
  vi.mocked(api.get).mockResolvedValue(envelope({ ...summary, inventoryMode: "tracked", revision: 3, requestKey: key }));
  const completed = vi.fn(); mount(completed);
  fireEvent.click(await screen.findByRole("button", { name: "Check count result" }));
  await waitFor(() => expect(completed).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.get).toHaveBeenLastCalledWith(path + `/operations/${key}`);
});

it("retries an uncertain count with the original key and original quantities", async () => {
  const normal = vi.mocked(api.post).getMockImplementation()!; let failed = false;
  vi.mocked(api.post).mockImplementation(async (url, body, config) => { if (String(url).endsWith("/commit") && !failed) { failed = true; throw Error("Connection lost"); } return normal(url, body, config); });
  const completed = vi.fn(); mount(completed); await prepare(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Confirm count & enable tracking" }));
  await screen.findByText("Connection lost"); fireEvent.click(screen.getByRole("button", { name: "Retry same count" }));
  await waitFor(() => expect(completed).toHaveBeenCalledOnce());
  expect(vi.mocked(api.post).mock.calls[2]).toEqual(vi.mocked(api.post).mock.calls[1]);
});

it("allows recount only after an explicit stale-snapshot rollback", async () => {
  vi.mocked(api.post).mockImplementation(async url => {
    if (String(url).endsWith("/commit")) throw { response: { status: 409, data: { message: "Count changed", details: { code: "COUNT_SNAPSHOT_CHANGED" } } } };
    return envelope({ ...summary, previewHash: "e".repeat(64) });
  });
  mount(); await prepare(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Confirm count & enable tracking" }));
  fireEvent.click(await screen.findByRole("button", { name: "Reload rejected count" }));
  await screen.findByLabelText("Actual piece: Cotton / ACTUAL-LOT"); expect(api.post).toHaveBeenCalledTimes(2);
});

it("adds actual printed batch evidence without submitting a supplier purchase or changing inventory before preview", async () => {
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Add counted batch" }));
  const dialog = screen.getByRole("dialog", { name: "Add actual counted batch" });
  fireEvent.change(within(dialog).getByLabelText("Actual printed batch"), { target: { value: "PRINTED-2" } });
  fireEvent.change(within(dialog).getByLabelText("Actual count (piece)"), { target: { value: "3" } });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel batch" }));
});

it("imports owned batch counts with quoted labels and rejects missing, duplicate, foreign and formula quantities", () => {
  const value = { ...snapshot, products: [{ ...snapshot.products[0], name: '=HYPERLINK("unsafe") , cotton' }] };
  const template = countCsvTemplate(value);
  expect(template).toContain('"\'=HYPERLINK(""unsafe"") , cotton"');
  expect(importCountCsv(template + "6", value)).toEqual({ [batchId]: "6" });
  for (const bad of [template, template + "=1+1", template + "-1", template + "1.5", template.replace(batchId, "f".repeat(24)) + "6", template + "6\r\n" + template.split("\r\n")[1] + "6"])
    expect(() => importCountCsv(bad, value)).toThrow();
  expect(importCountCsv(template + "0", value)).toEqual({ [batchId]: "0" });
});
