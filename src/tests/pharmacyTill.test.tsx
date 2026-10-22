import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyTill } from "@/components/pharmacy/PharmacyTill";
import { PharmacyDrawerGate } from "@/components/pharmacy/PharmacyDrawerGate";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { referenceOwnerKey } from "@/lib/authScope";
import { activeDrawer, submitDrawer } from "@/lib/pharmacyTill";
import { printElement } from "@/lib/printBrand";
import { drawerFixture as drawer } from "./fixtures/pharmacyDrawer";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
vi.mock("@/lib/printBrand", () => ({ printElement: vi.fn() }));
const response = (data: unknown) => ({ data: { data } });
const closed = { ...drawer, status: "closed", revision: 1, endedAt: "2026-10-21T10:00:00Z", closedByName: "Actual cashier", actualCashCounted: 100, cashVariance: 0, evidenceHash: "e".repeat(64) };
const storageKey = () => `pharmacy-drawer:${referenceOwnerKey(useAuthStore.getState().user)}:branch`;
const mount = (props = {}) => render(<ToastProvider><PharmacyTill locationId="branch" canOpen canClose canMove {...props} /></ToastProvider>);
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function select(label: string, value: string) { const control = screen.getByLabelText(label); fireEvent.change(control.getAttribute("role") === "combobox" ? document.getElementById(control.id.replace(/-trigger$/, ""))! : control, { target: { value } }); }
beforeEach(() => {
  useAuthStore.setState({ user: { id: drawer.cashierId, name: "Actual cashier", role: "cashier", email: "cashier@example.test", organization_id: drawer.organizationId, permissions: ["PHARMACY_CLOSE_TILL"] } });
  sessionStorage.clear(); api.get.mockReset().mockImplementation(async (url: string) => url.endsWith("/history") ? response({ items: [], nextCursor: null }) : response({ active: null }));
  api.post.mockReset().mockImplementation(async (_url: string, body: any, config: any) => response({ kind: "open", locationId: "branch", requestKey: config.headers["Idempotency-Key"], resultId: drawer.id, drawer: { ...drawer, openingFloatPaise: body.openingFloatPaise, drawerTotals: { ...drawer.drawerTotals, expectedCashPaise: body.openingFloatPaise } } }));
  vi.mocked(printElement).mockReset().mockResolvedValue();
});
it("opens only actual counted cash with an opaque stable reference and acknowledges the committed result", async () => {
  mount(); await screen.findByLabelText("Physical drawer code"); change("Physical drawer code", "COUNTER-1"); change("Counted opening cash", "0"); fireEvent.click(screen.getByRole("button", { name: "Open physical drawer" }));
  await screen.findByText("Drawer operation confirmed"); expect(api.post).toHaveBeenCalledWith("/pharmacy/till/open", { locationId: "branch", drawerCode: "COUNTER-1", openingFloatPaise: 0 }, { headers: { "Idempotency-Key": expect.any(String) } });
  expect(JSON.parse(sessionStorage.getItem(storageKey())!)).toEqual({ key: api.post.mock.calls[0][2].headers["Idempotency-Key"], kind: "open" }); expect(sessionStorage.getItem(storageKey())).not.toMatch(/openingFloat|cashier|Counted/);
  fireEvent.click(screen.getByRole("button", { name: "Done with drawer operation" })); await waitFor(() => expect(sessionStorage.getItem(storageKey())).toBeNull());
});
it("freezes an uncertain command, retries its original details, and preserves identity across reload", async () => {
  api.post.mockRejectedValueOnce(new Error("Synthetic timeout")); const view = mount(); await screen.findByLabelText("Physical drawer code"); change("Physical drawer code", "COUNTER-1"); change("Counted opening cash", "100"); fireEvent.click(screen.getByRole("button", { name: "Open physical drawer" })); await screen.findByText("Synthetic timeout");
  const ref = JSON.parse(sessionStorage.getItem(storageKey())!); expect(screen.getByLabelText("Physical drawer code")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry same drawer operation" })); await screen.findByText("Drawer operation confirmed"); expect(api.post.mock.calls[1]).toEqual(api.post.mock.calls[0]);
  view.unmount(); const original = api.get.getMockImplementation()!; api.get.mockImplementation(async (url: string, config: unknown) => url.includes("/till-operations/") ? response({ kind: "open", locationId: "branch", requestKey: ref.key, resultId: drawer.id, drawer }) : original(url, config));
  mount(); await screen.findByText("Pending drawer operation"); fireEvent.click(screen.getByRole("button", { name: "Check drawer result" })); await screen.findByText("Drawer operation confirmed"); expect(api.post).toHaveBeenCalledTimes(2);
});
it("does not issue a financial command when durable reference storage fails", async () => {
  mount(); await screen.findByLabelText("Physical drawer code"); change("Physical drawer code", "COUNTER-1"); change("Counted opening cash", "100"); const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Synthetic storage unavailable"); });
  try { fireEvent.click(screen.getByRole("button", { name: "Open physical drawer" })); await screen.findByText("Synthetic storage unavailable"); expect(api.post).not.toHaveBeenCalled(); } finally { spy.mockRestore(); }
});
it("explains closing variance, submits a source revision and prints only the saved close", async () => {
  api.get.mockImplementation(async (url: string) => url.endsWith("/history") ? response({ items: [], nextCursor: null }) : response({ active: drawer }));
  api.post.mockImplementation(async (_url: string, body: any, config: any) => response({ kind: "close", locationId: "branch", requestKey: config.headers["Idempotency-Key"], resultId: drawer.id, drawer: { ...closed, actualCashCounted: 99, cashVariance: -1, varianceReason: body.varianceReason } }));
  mount(); await screen.findByLabelText("Actual closing cash counted"); change("Actual closing cash counted", "99"); fireEvent.click(screen.getByRole("button", { name: "Close physical drawer" })); await screen.findByText("Count the actual closing cash and explain any difference"); expect(api.post).not.toHaveBeenCalled();
  change("Cash variance explanation", "Actual shortage reviewed"); fireEvent.click(screen.getByRole("button", { name: "Close physical drawer" })); await screen.findByText("Drawer operation confirmed"); expect(api.post.mock.calls[0][1]).toMatchObject({ expectedRevision: 0, countedCashPaise: 9900, varianceReason: "Actual shortage reviewed" });
  vi.mocked(printElement).mockRejectedValueOnce(new Error("Synthetic printer unavailable")); fireEvent.click(screen.getByRole("button", { name: "Print saved drawer close" })); await screen.findByText("Synthetic printer unavailable"); expect(api.post).toHaveBeenCalledOnce(); expect(screen.getByText(/Actual shortage reviewed/)).toBeInTheDocument();
});
it("requires movement source evidence and keeps exact paise and revision", async () => {
  api.get.mockImplementation(async (url: string) => url.endsWith("/history") ? response({ items: [], nextCursor: null }) : response({ active: drawer }));
  api.post.mockImplementation(async (_url: string, _body: unknown, config: any) => response({ kind: "movement", resultId: "d".repeat(24), locationId: "branch", requestKey: config.headers["Idempotency-Key"], drawer: { ...drawer, revision: 1 } }));
  mount(); await screen.findByLabelText("Actual cash movement amount"); change("Actual cash movement amount", "0.29"); select("Cash movement direction", "in"); change("Actual cash movement reference", "ACTUAL-REF-1"); change("Cash movement reason", "Actual counted top-up"); fireEvent.click(screen.getByRole("button", { name: "Record actual cash movement" })); await screen.findByText("Drawer operation confirmed"); expect(api.post.mock.calls[0][1]).toMatchObject({ expectedRevision: 0, amountPaise: 29, direction: "in", referenceNumber: "ACTUAL-REF-1", reviewReference: "Actual counted top-up" });
});
it("ignores an old write response after authorization changes while preserving the opaque reference", async () => {
  let finish!: (value: unknown) => void; api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const view = mount(); await screen.findByLabelText("Physical drawer code"); change("Physical drawer code", "COUNTER-1"); change("Counted opening cash", "100"); fireEvent.click(screen.getByRole("button", { name: "Open physical drawer" })); await waitFor(() => expect(api.post).toHaveBeenCalledOnce()); const ref = JSON.parse(sessionStorage.getItem(storageKey())!);
  act(() => { useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["PHARMACY_VIEW_REPORTS"] } }); });
  await act(async () => { finish(response({ kind: "open", resultId: drawer.id, locationId: "branch", requestKey: ref.key, drawer })); }); expect(screen.queryByText("Drawer operation confirmed")).not.toBeInTheDocument(); expect(sessionStorage.getItem(storageKey())).toContain(ref.key); view.unmount();
});
it("rejects a mismatched saved source and keeps its original recovery reference", async () => {
  const ref = { kind: "close", key: "original-close-reference", drawerId: drawer.id }; sessionStorage.setItem(storageKey(), JSON.stringify(ref));
  api.get.mockImplementation(async (url: string) => url.includes("/till-operations/") ? response({ kind: "close", resultId: "d".repeat(24), locationId: "branch", requestKey: ref.key, drawer: { ...closed, id: "d".repeat(24) } }) : url.endsWith("/history") ? response({ items: [], nextCursor: null }) : response({ active: drawer }));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Check drawer result" })); await screen.findByText("Drawer command source or state needs review"); expect(sessionStorage.getItem(storageKey())).toContain(ref.key); expect(api.post).not.toHaveBeenCalled();
});
it("fails collection readiness closed and allows a successful explicit recheck", async () => {
  const ready = vi.fn(); api.get.mockRejectedValueOnce(new Error("Synthetic drawer offline")); render(<ToastProvider><PharmacyDrawerGate locationId="branch" onReady={ready} /></ToastProvider>); await screen.findByText("Synthetic drawer offline"); expect(ready).toHaveBeenLastCalledWith(false);
  api.get.mockResolvedValueOnce(response({ active: drawer })); fireEvent.click(screen.getByRole("button", { name: "Recheck open drawer" })); await screen.findByText("Drawer COUNTER-1 open"); expect(ready).toHaveBeenLastCalledWith(true); expect(api.post).not.toHaveBeenCalled();
});
it("uses the shared billing drawer endpoints and preserves actual currency", async () => {
  api.get.mockImplementation(async (url: string) => url.endsWith("/history") ? response({ items: [], nextCursor: null }) : response({ active: { ...drawer, currency: "USD" } })); mount({ channel: "billing" }); await screen.findByText(/Expected cash.*\$100.00/); expect(api.get.mock.calls.some(([url]) => url === "/billing/till/drawers")).toBe(true); expect(api.get.mock.calls.some(([url]) => url.startsWith("/pharmacy/"))).toBe(false);
});
it("rejects malformed method totals and changed branch or close state", async () => {
  api.get.mockResolvedValueOnce(response({ active: { ...drawer, locationId: "other" } })); await expect(activeDrawer("branch")).rejects.toThrow(/another branch/);
  api.get.mockResolvedValueOnce(response({ active: { ...drawer, drawerTotals: { ...drawer.drawerTotals, incoming: {} } } })); await expect(activeDrawer("branch")).rejects.toThrow(/method totals/);
  api.post.mockResolvedValueOnce(response({ kind: "close", locationId: "branch", resultId: drawer.id, requestKey: "reference-1", drawer })); await expect(submitDrawer("branch", { kind: "close", key: "reference-1", drawerId: drawer.id }, {})).rejects.toThrow(/state needs review/);
});
