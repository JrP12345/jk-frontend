import { datePickerInput } from "./datePickerTestUtils";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PharmacyPage from "@/app/(dashboard)/dashboard/pharmacy/page";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";
import { prepareDispense, readMedicinePage } from "@/components/pharmacy/pharmacyWorkspace";
import { pharmacyActions } from "@/lib/pharmacyCapabilities";

const fixture = vi.hoisted(() => ({ capabilities: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), fetch: vi.fn(), locations: [{ id: "clinic", name: "Sample clinic", city: "Surat" }], activeLocationId: "clinic" as string | null }));
vi.mock("@/lib/api", () => ({ default: { get: (url: string, ...args: unknown[]) => url.endsWith("/capabilities") ? fixture.capabilities(url, ...args) : fixture.get(url, ...args), post: fixture.post, put: fixture.put, delete: fixture.delete } }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: Object.assign((selector?: (state: unknown) => unknown) => {
  const state = { locations: fixture.locations, fetchLocations: fixture.fetch, activeLocationId: fixture.activeLocationId, isLoading: false, error: null };
  return selector ? selector(state) : state;
}, { getState: () => ({ reset: () => {} }) }) }));
vi.mock("@/utils/audioChimes", () => ({ playChimeSound: vi.fn() }));
const medicine = { id: "medicine", locationId: "clinic", name: "Sample medicine 500mg", genericName: "Sample composition", batchNumber: "B-001", expiryDate: "2030-12-01", stockQuantity: 30, costPrice: 5, price: 10 };
const rx = { id: "prescription", medicineId: "medicine", name: medicine.name, dosage: "500 mg", frequency: "1-0-1", duration: "3 days", instructions: "After food" };
const partialRx = { ...rx, fulfillment: { mode: "quantity" as const, authorizedQuantity: 30, suppliedQuantity: 10, remainingQuantity: 20, baseUnit: "tablet", revision: 1, medicineId: "medicine" } };
const partialStock = { ...medicine, unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } };
it("sends exact remaining allowance and revision with a partial supply", () => {
  expect(prepareDispense([partialRx], [{ medicineId: "medicine", quantity: 20 }], [partialStock], "clinic").prescriptionAllocations).toEqual([
    { prescriptionId: "prescription", medicineId: "medicine", quantity: 20, expectedFulfillmentRevision: 1, expectedRemainingQuantity: 20 },
  ]);
});
it.each(["over allowance", "unit mismatch", "different medicine"])("blocks partial supply with %s", kind => {
  const selected = kind === "different medicine" ? { ...partialStock, id: "another" } : kind === "unit mismatch" ? { ...partialStock, unitDefinition: { ...partialStock.unitDefinition, baseUnit: "ml" } } : partialStock;
  expect(prepareDispense([partialRx], [{ medicineId: selected.id, quantity: kind === "over allowance" ? 21 : 10 }], [selected], "clinic").error).toMatch(/remaining authorized/);
});
const group = { encounterId: "aaaaaaaaaaaaaaaaaaaaaaaa", appointmentId: "bbbbbbbbbbbbbbbbbbbbbbbb", appointmentTime: "2026-10-18T10:00:00Z", tokenNumber: 7, patientId: { id: "patient", name: "Sample patient", phone: "9999999999" }, doctorId: { id: "doctor", name: "Sample doctor" }, prescriptions: [rx] };
const response = (data: unknown, headers: Record<string, string> = {}) => ({ data: { data }, headers });
const capabilities = (granted: string[], locationId = "clinic", enabled = true) => ({ locationId, enabled, moduleEnabled: true, mode: "configured", revision: 1,
  actions: Object.fromEntries(pharmacyActions.map(action => [action, granted.includes(action)])) });
const committed = (key: string) => ({ id: "invoice", invoiceNumber: "INV-RECOVERED", totalAmount: 140, balanceDue: 140,
  dispenseOperation: { version: 1, key, locationId: "clinic", invoiceId: "invoice", invoiceNumber: "INV-RECOVERED",
    addedAmount: 40, appendedToExisting: true, allocations: [{ medicineId: "medicine", quantity: 4, lineAmount: 40, batches: [] }] } });
const deferred = () => { let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tree = () => <ToastProvider><PharmacyPage /></ToastProvider>;
const mount = () => render(tree());
async function menu(label: string) { fireEvent.click((await screen.findAllByRole("button", { name: `Actions for ${medicine.name}` }))[0]); fireEvent.click(await screen.findByRole("menuitem", { name: label })); }
async function openDispense() { await screen.findAllByText(medicine.name); fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ })); fireEvent.click(screen.getAllByRole("button", { name: "Dispense", exact: true })[0]); await waitFor(() => expect(screen.queryByText("Loading prescribed stock...")).not.toBeInTheDocument()); return screen.getByRole("dialog", { name: "Dispense prescription" }); }
beforeEach(() => {
  localStorage.clear();
  fixture.locations = [{ id: "clinic", name: "Sample clinic", city: "Surat" }]; fixture.activeLocationId = "clinic";
  fixture.fetch.mockReset().mockResolvedValue(fixture.locations);
  fixture.capabilities.mockReset().mockImplementation(async (url: string) => {
    const permissions = useAuthStore.getState().user?.permissions || [];
    const actions = permissions.includes("MANAGE_MEDICINES") ? [...pharmacyActions].filter(action => action !== "manageSettings") : permissions.includes("VIEW_EHR") ? ["viewStock", "viewRxQueue", "readRegister"] : [];
    return response(capabilities(actions, url.split("/")[3]));
  });
  fixture.get.mockReset().mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [medicine] : url.startsWith("/pharmacy/pending") ? [group] : []));
  fixture.post.mockReset().mockImplementation(async (url: string, _body: unknown, config?: { headers: Record<string, string> }) => response(url === "/pharmacy/dispense" ? committed(config!.headers["Idempotency-Key"]) : {})); fixture.put.mockReset().mockResolvedValue(response({})); fixture.delete.mockReset().mockResolvedValue(response({}));
  useAuthStore.setState({ user: { id: "pharmacist", name: "Sample pharmacist", email: "sample@example.test", role: "pharmacist", organization_id: "org", permissions: ["MANAGE_MEDICINES", "VIEW_EHR"] } });
  vi.stubGlobal("WebSocket", class { close = vi.fn(); });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); });
it("shows supplied and remaining quantities and sends the current revision from the desk", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [partialStock] : url.startsWith("/pharmacy/pending") ? [{ ...group, prescriptions: [partialRx] }] : []));
  mount(); const dialog = await openDispense();
  expect(within(dialog).getByText("Authorized: 30 tablet. Supplied: 10. Remaining: 20.")).toBeInTheDocument();
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: `Quantity for ${rx.name}` }), { target: { value: "20" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/pharmacy/dispense", expect.objectContaining({ prescriptionAllocations: [expect.objectContaining({ quantity: 20, expectedFulfillmentRevision: 1, expectedRemainingQuantity: 20 })] }), expect.anything()));
});

it("keeps tab counts and filters inventory without a selector for the sole location", async () => {
  mount(); await screen.findAllByText(medicine.name); expect(screen.queryByRole("combobox", { name: "Pharmacy location" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ })); expect(screen.getAllByText("Sample patient").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("tab", { name: /Inventory\s*1/ })); fireEvent.change(screen.getByRole("searchbox", { name: "Search medicines" }), { target: { value: "missing" } });
  expect(screen.getAllByText("No medicines match these filters.").length).toBeGreaterThan(0); expect(screen.getByRole("tab", { name: /Inventory\s*1/ })).toBeInTheDocument();
});

it("opens the counter for sales-only staff without inventory, prescription or purchase access", async () => {
  useAuthStore.setState({ user: { id: "seller", name: "Seller", email: "seller@example.test", role: "cashier", organization_id: "org", permissions: ["PHARMACY_SELL"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), actions: { ...capabilities([]).actions, sell: true, viewSales: true, collect: false } }));
  fixture.get.mockResolvedValue(response({ items: [], nextCursor: null })); mount();
  await screen.findByRole("region", { name: "Pharmacy counter checkout" }); expect(screen.getByRole("tab", { name: "Counter sale" })).toHaveAttribute("aria-selected", "true");
  expect(fixture.get.mock.calls.some(([url]) => /medicines|pending-prescriptions|purchases/.test(url))).toBe(false); expect(screen.queryByRole("tab", { name: /Inventory/ })).not.toBeInTheDocument();
});
it("opens operational reports for report-only staff without clinical or catalogue requests", async () => {
  useAuthStore.setState({ user: { id: "reporter", name: "Reporter", email: "reporter@example.test", role: "stock", organization_id: "org", permissions: ["PHARMACY_VIEW_REPORTS"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), actions: { ...capabilities([]).actions, viewReports: true } }));
  fixture.get.mockResolvedValue(response({ locationId: "clinic", items: [{ kind: "movements", label: "Stock movements" }] }));
  mount(); await screen.findByLabelText("Operational report"); expect(screen.getByRole("tab", { name: "Reports & exports" })).toHaveAttribute("aria-selected", "true"); expect(fixture.get.mock.calls.every(([url]) => url === "/pharmacy/reports")).toBe(true);
});
it("opens branch transfers for transfer-and-cost staff without clinical or catalogue grants", async () => {
  useAuthStore.setState({ user: { id: "transfer-operator", name: "Transfer operator", email: "operator@example.test", role: "stock", organization_id: "org", permissions: ["PHARMACY_TRANSFER", "PHARMACY_VIEW_COST"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), actions: { ...capabilities([]).actions, transferStock: true, viewCost: true } }));
  fixture.get.mockResolvedValue(response({ items: [], nextCursor: null })); mount();
  await screen.findByRole("region", { name: "Pharmacy stock transfers" }); expect(screen.getByRole("tab", { name: "Stock transfers" })).toHaveAttribute("aria-selected", "true");
  expect(fixture.get.mock.calls.every(([url]) => String(url).startsWith("/pharmacy/transfers?"))).toBe(true);
});

it("opens reviewed dues import from explicit capabilities without a stock or clinical grant", async () => {
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_ORGANIZATION"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), importKinds: ["customer_dues"] }));
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/pharmacy/imports?") ? { items: [], nextCursor: null } : []));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Import source CSV" }));
  await screen.findByRole("dialog", { name: "Reviewed pharmacy import" });
  expect(screen.getByRole("combobox", { name: "Import kind" })).toHaveTextContent("Opening customer dues");
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/pharmacy/imports?locationId=clinic", expect.anything()));
  expect(fixture.get.mock.calls.some(([url]) => url.startsWith("/medicines") || url.includes("pending-prescriptions") || url.includes("/patients") || url.includes("/billing/"))).toBe(false);
});
it("opens physical drawers for till-only staff without requesting stock, patients or clinical billing", async () => {
  useAuthStore.setState({ user: { id: "drawer-operator", name: "Drawer operator", email: "drawer@example.test", role: "cashier", organization_id: "org", permissions: ["PHARMACY_CLOSE_TILL"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), actions: { ...capabilities([]).actions, viewTill: true, openTill: true, closeTill: true, moveTillCash: true } }));
  fixture.get.mockImplementation(async (url: string) => response(url.endsWith("/history") ? { items: [], nextCursor: null } : { active: null }));
  mount(); await screen.findByRole("region", { name: "Physical cash drawer" }); await screen.findByLabelText("Physical drawer code"); expect(screen.getByRole("tab", { name: "Cash drawer" })).toHaveAttribute("aria-selected", "true");
  expect(fixture.get.mock.calls.every(([url]) => url.startsWith("/pharmacy/till"))).toBe(true); expect(screen.queryByRole("tab", { name: /Inventory|Dispense|Sales & collections/ })).not.toBeInTheDocument();
});

it("opens returns for correction-only staff without stock or clinical access", async () => {
  useAuthStore.setState({ user: { id: "returns", name: "Returns operator", email: "returns@example.test", role: "cashier", organization_id: "org", permissions: ["PHARMACY_RETURN"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), actions: { ...capabilities([]).actions, viewReturns: true, processReturn: true, approveReturn: false } })); fixture.get.mockResolvedValue(response({ items: [], nextCursor: null })); mount();
  await screen.findByRole("region", { name: "Pharmacy sales returns" }); expect(screen.getByRole("tab", { name: "Returns" })).toHaveAttribute("aria-selected", "true"); expect(fixture.get.mock.calls.some(([url]) => /medicines|pending-prescriptions|purchases/.test(url))).toBe(false);
});
it("exposes finance for refund staff without clinical billing or inventory grants", async () => {
  useAuthStore.setState({ user: { id: "finance", name: "Finance operator", email: "finance@example.test", role: "cashier", organization_id: "org", permissions: ["PHARMACY_APPROVE_REFUND"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), actions: { ...capabilities([]).actions, viewReturns: true, approveReturn: true, viewSettlements: true, settle: true } })); fixture.get.mockResolvedValue(response({ items: [], nextCursor: null })); mount();
  fireEvent.click(await screen.findByRole("tab", { name: "Finance & dues" })); await screen.findByRole("region", { name: "Pharmacy finance and dues" }); expect(screen.getByRole("button", { name: "Find refundable bills" })).toBeInTheDocument(); expect(fixture.get.mock.calls.some(([url]) => /medicines|pending-prescriptions|purchases|billing/.test(url))).toBe(false);
});

it("loads catalogue pages only when requested and preserves the server total", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.includes("page=2") ? [{ ...medicine, id: "later", name: "Later formulation" }] : url.startsWith("/medicines") ? [medicine] : [], { "x-total-pages": "2", "x-total-count": "101" }));
  mount(); await screen.findAllByText(medicine.name); expect(screen.queryByText("Later formulation")).not.toBeInTheDocument();
  expect(fixture.get.mock.calls.some(([url]) => url.includes("page=2"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Next medicine page" })); await screen.findAllByText("Later formulation");
  expect(screen.getByRole("tab", { name: /Inventory\s*101/ })).toBeInTheDocument();
  expect(fixture.get).toHaveBeenCalledWith("/medicines?page=2&limit=100&locationId=clinic", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it("keeps a bounded page read separate from a failed later-page request", async () => {
  fixture.get.mockResolvedValueOnce(response([medicine], { "x-total-pages": "2" })).mockRejectedValueOnce(new Error("offline"));
  expect((await readMedicinePage("clinic", new AbortController().signal)).items).toEqual([medicine]);
  expect(fixture.get).toHaveBeenCalledTimes(1);
  await expect(readMedicinePage("clinic", new AbortController().signal, { page: 2 })).rejects.toThrow("offline");
});

it("keeps loaded stock on refresh failure and offers retry without enabling writes", async () => {
  mount(); await screen.findAllByText(medicine.name); fixture.get.mockRejectedValue(new Error("offline")); fireEvent.click(screen.getByRole("button", { name: "Refresh pharmacy" }));
  await screen.findByText("Inventory could not be loaded. Retry before changing stock or dispensing."); expect(screen.getAllByText(medicine.name).length).toBeGreaterThan(0); expect(screen.getByRole("button", { name: "Add medicine" })).toBeDisabled();
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [medicine] : [group])); fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Add medicine" })).toBeEnabled());
});

it("keeps inventory usable when the independent prescription read fails", async () => {
  fixture.get.mockImplementation(async (url: string) => { if (url.includes("pending-prescriptions")) throw new Error("offline"); return response([medicine]); });
  mount(); await screen.findAllByText(medicine.name); expect(screen.getByRole("button", { name: "Add medicine" })).toBeEnabled();
  fireEvent.click(screen.getByRole("tab", { name: "Dispense", exact: true })); await screen.findByText("Prescriptions could not be loaded. Please try again.");
  expect(screen.queryByText("No prescriptions awaiting dispensing.")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Dispense", exact: true })).not.toBeInTheDocument();
});

it("registers a zero-stock catalogue item without requiring cost, batch or expiry placeholders", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "catalogue_operator", permissions: ["PHARMACY_VIEW_STOCK", "PHARMACY_MANAGE_CATALOG"] } });
  fixture.capabilities.mockResolvedValue(response(capabilities(["viewStock", "manageCatalog"])));
  mount(); await screen.findAllByText(medicine.name); fireEvent.click(screen.getByRole("button", { name: "Add medicine" })); const dialog = screen.getByRole("dialog", { name: "Add medicine" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save medicine" })); expect(within(dialog).getByRole("tab", { name: "Medicine", selected: true })).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Medicine name *"), { target: { value: "New medicine" } }); fireEvent.change(within(dialog).getByLabelText("Generic composition *"), { target: { value: "New generic" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save medicine" })); expect(within(dialog).getByRole("tab", { name: "Units & codes", selected: true })).toBeInTheDocument();
  for (const [label, option] of [["Base unit", "tablet"], ["Pack unit", "strip"]]) { fireEvent.click(within(dialog).getByRole("combobox", { name: label })); fireEvent.click(await screen.findByRole("option", { name: option, exact: true })); }
  fireEvent.change(within(dialog).getByLabelText("Base units per pack"), { target: { value: "10" } });
  fireEvent.change(within(dialog).getByLabelText("Barcode aliases"), { target: { value: "000123, SKU-500" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save medicine" })); expect(within(dialog).getByRole("tab", { name: "Stock & pricing", selected: true })).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Retail price *"), { target: { value: "0" } });
  expect(within(dialog).queryByLabelText("Purchase cost *")).not.toBeInTheDocument(); expect(within(dialog).queryByLabelText("Expiry date *")).not.toBeInTheDocument();
  const submit = within(dialog).getByRole("button", { name: "Save medicine" }); expect((submit as HTMLButtonElement).form?.id).toBe("medicine-form"); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/medicines", expect.objectContaining({ name: "New medicine", genericName: "New generic", stockQuantity: 0, price: 0, locationId: "clinic", barcodes: ["000123", "SKU-500"], unitDefinition: { baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } })));
  for (const field of ["costPrice", "expiryDate", "batchNumber"]) expect(fixture.post.mock.calls[0][1]).not.toHaveProperty(field);
});

it("preserves edited medicine values after save failure", async () => {
  mount(); await menu("Edit medicine"); const dialog = screen.getByRole("dialog", { name: "Edit medicine" });
  fireEvent.change(within(dialog).getByLabelText("Medicine name *"), { target: { value: "Changed medicine" } }); fixture.put.mockRejectedValueOnce(new Error("offline")); fireEvent.click(within(dialog).getByRole("button", { name: "Save medicine" }));
  await screen.findByText("Could not save"); expect(within(dialog).getByLabelText("Medicine name *")).toHaveValue("Changed medicine");
});

it("validates and receives a batch for its actual medicine location", async () => {
  mount(); await menu("Add batch"); const dialog = screen.getByRole("dialog", { name: "Add batch" }); fireEvent.click(within(dialog).getByRole("button", { name: "Save batch" }));
  expect(await within(dialog).findByText("Check batch details")).toBeInTheDocument();
  for (const [label, value] of [["Unlinked inward reason *", "Synthetic unlinked receipt"], ["Batch number *", "B-NEW"], ["Expiry date *", "2030-12-01"], ["Quantity received *", "15"]]) {
    const control = within(dialog).getByLabelText(label);
    fireEvent.change(label === "Expiry date *" ? datePickerInput(control) : control, { target: { value } });
  }
  const submit = within(dialog).getByRole("button", { name: "Save batch" }); expect((submit as HTMLButtonElement).form?.id).toBe("batch-form"); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/pharmacy/batches", { medicineId: "medicine", locationId: "clinic", unlinkedInwardReason: "Synthetic unlinked receipt", batchNumber: "B-NEW", expiryDate: "2030-12-01", quantity: 15, purchaseCost: 5, sellingPrice: 10 }));
});

it("opens explicit receiving for a product with units without inventing its total acquisition cost", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [{ ...medicine, unitDefinition: { version: 1, baseUnit: "tablet", packUnit: "strip", unitsPerPack: 10 } }] : []));
  mount(); await menu("Add batch");
  const dialog = screen.getByRole("dialog", { name: "Receive stock" });
  expect(within(dialog).getByLabelText("Total acquisition cost (INR) *")).toHaveValue(null);
  expect(within(dialog).getByLabelText("Full packs (strip) *")).toHaveValue(0);
  expect(within(dialog).getByLabelText("Loose units (tablet) *")).toHaveValue(0);
  expect(within(dialog).getByLabelText("Printed expiry *")).toHaveValue("");
  expect(fixture.post).not.toHaveBeenCalled();
});

it("opens a purchase-only workspace without loading stock or clinical prescription data", async () => {
  useAuthStore.setState({ user: { id: "buyer", name: "Buyer", email: "buyer@example.test", role: "buyer", organization_id: "org", permissions: ["PHARMACY_PURCHASE"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), actions: { ...capabilities([]).actions, viewPurchases: true, managePurchases: true } }));
  fixture.get.mockImplementation(async (url: string) => { if (url.startsWith("/pharmacy/purchases?")) return response({ items: [], nextCursor: null }); throw new Error(`Unexpected access to ${url}`); });
  mount(); expect(await screen.findByRole("button", { name: "New purchase draft" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Inventory/ })).not.toBeInTheDocument(); expect(screen.queryByRole("tab", { name: /Dispense/ })).not.toBeInTheDocument();
  expect(fixture.get.mock.calls.every(([url]) => url.startsWith("/pharmacy/purchases?"))).toBe(true);
});
it("opens collection-only staff directly into sales without stock or clinical grants", async () => {
  useAuthStore.setState({ user: { id: "cashier", name: "Cashier", email: "cashier@example.test", role: "cashier", organization_id: "org", permissions: ["PHARMACY_COLLECT_PAYMENT"] } });
  fixture.capabilities.mockResolvedValue(response({ ...capabilities([]), actions: { ...capabilities([]).actions, viewSales: true, collect: true } }));
  fixture.get.mockImplementation(async (url: string) => { if (url.startsWith("/pharmacy/invoices?")) return response({ items: [], nextCursor: null }); throw new Error(`Unexpected access to ${url}`); });
  mount(); expect(await screen.findByRole("region", { name: "Pharmacy sales and collections" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Inventory|Dispense|Purchases/ })).not.toBeInTheDocument();
  await waitFor(() => expect(fixture.get).toHaveBeenCalled()); expect(fixture.get.mock.calls.every(([url]) => url.startsWith("/pharmacy/invoices?"))).toBe(true);
});

it("does not guess quantities or match similarly named formulations", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [medicine] : [{ ...group, prescriptions: [{ ...rx, medicineId: null }] }]));
  mount(); const dialog = await openDispense(); expect(within(dialog).getByRole("combobox")).toHaveTextContent("Leave pending"); expect(within(dialog).getByRole("spinbutton")).toBeDisabled(); expect(within(dialog).getByRole("button", { name: "Dispense & bill" })).toBeDisabled();
});

it("prevents duplicate dispensing while saving and submits selected prescriptions alone", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [medicine] : [{ ...group, prescriptions: [rx, { ...rx, id: "unselected", medicineId: null, name: "Another medicine" }] }]));
  mount(); const dialog = await openDispense(); expect(within(dialog).getByRole("spinbutton", { name: `Quantity for ${rx.name}` })).toHaveValue(null);
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: `Quantity for ${rx.name}` }), { target: { value: "4" } }); const pending = deferred(); fixture.post.mockReturnValue(pending.promise);
  const submit = within(dialog).getByRole("button", { name: "Dispense & bill" }); fireEvent.click(submit); fireEvent.click(submit); await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(1)); expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(fixture.post).toHaveBeenCalledWith("/pharmacy/dispense", expect.objectContaining({ prescriptionIds: ["prescription"], prescriptionAllocations: [{ prescriptionId: "prescription", medicineId: "medicine", quantity: 4 }], items: [{ medicineId: "medicine", quantity: 4 }], patientId: "patient", encounterId: group.encounterId, appointmentId: group.appointmentId, locationId: "clinic" }), { headers: { "Idempotency-Key": expect.any(String) } });
  const key = fixture.post.mock.calls[0][2].headers["Idempotency-Key"];
  await act(async () => pending.resolve(response(committed(key)))); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("keeps an uncertain dispense pinned while its result is unavailable", async () => {
  mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  fixture.post.mockRejectedValueOnce(new Error("response lost")); fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [{ ...medicine, stockQuantity: 26 }] : [])); fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
  await screen.findByText("Pending dispense outcome"); expect(within(dialog).getByRole("button", { name: "Dispense & bill" })).toBeDisabled(); expect(fixture.post).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry same dispense" })).toBeEnabled());
});

it("recovers the actual invoice after a response is lost without posting again", async () => {
  mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  fixture.post.mockRejectedValueOnce(new Error("response lost"));
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/pharmacy/dispense-operations/")
    ? committed(url.split("/").pop()!.split("?")[0]) : url.startsWith("/medicines") ? [medicine] : [group]));
  fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
  await screen.findByText("INV-RECOVERED"); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText(/to the existing bill/)).toBeInTheDocument(); expect(fixture.post).toHaveBeenCalledTimes(1);
  const key = fixture.post.mock.calls[0][2].headers["Idempotency-Key"];
  expect(Object.values(localStorage)).toEqual([key]);
  await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Done" })); expect(Object.values(localStorage)).not.toContain(key);
});

it("retries the frozen payload with the original key despite stale stock or prescription reads", async () => {
  mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  fixture.post.mockRejectedValueOnce(new Error("response lost")); fixture.get.mockRejectedValue(new Error("not confirmed"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
  const retry = await screen.findByRole("button", { name: "Retry same dispense" }); await waitFor(() => expect(retry).toBeEnabled());
  expect(within(dialog).getByRole("spinbutton")).toBeDisabled();
  fireEvent.click(retry); await screen.findByText("INV-RECOVERED");
  expect(fixture.post).toHaveBeenCalledTimes(2);
  expect(fixture.post.mock.calls[1]).toEqual(fixture.post.mock.calls[0]);
});

it("retains only the reference across reload and looks up the committed result without resubmitting", async () => {
  const view = mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  fixture.post.mockRejectedValueOnce(new Error("response lost")); fixture.get.mockRejectedValue(new Error("not confirmed"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
  await screen.findByText("Pending dispense outcome"); await waitFor(() => expect(screen.getByRole("button", { name: "Check outcome" })).toBeEnabled());
  const key = fixture.post.mock.calls[0][2].headers["Idempotency-Key"];
  view.unmount(); fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/pharmacy/dispense-operations/") ? committed(key) : url.startsWith("/medicines") ? [medicine] : []));
  mount(); await screen.findByText("INV-RECOVERED"); expect(fixture.post).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Retry same dispense" })).not.toBeInTheDocument();
});

it("keeps an unresolved reference after reload and blocks a new key when lookup has no committed result", async () => {
  const view = mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  fixture.post.mockRejectedValueOnce(new Error("response lost")); fixture.get.mockRejectedValue(new Error("not confirmed"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
  await screen.findByText("Pending dispense outcome"); await waitFor(() => expect(screen.getByRole("button", { name: "Check outcome" })).toBeEnabled());
  view.unmount(); fixture.get.mockImplementation(async (url: string) => { if (url.startsWith("/pharmacy/dispense-operations/")) throw new Error("No committed receipt visible"); return response(url.startsWith("/medicines") ? [medicine] : [group]); });
  mount(); await screen.findByText("Pending dispense outcome"); await screen.findAllByText(medicine.name);
  fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ }));
  for (const button of screen.getAllByRole("button", { name: "Dispense", exact: true })) expect(button).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Retry same dispense" })).not.toBeInTheDocument(); expect(fixture.post).toHaveBeenCalledTimes(1);
});

it("requires deletion confirmation and keeps failed deletion available for retry", async () => {
  mount(); await menu("Delete medicine"); const dialog = screen.getByRole("dialog", { name: "Delete medicine?" }); expect(fixture.delete).not.toHaveBeenCalled();
  fixture.delete.mockRejectedValueOnce(new Error("offline")); fireEvent.click(within(dialog).getByRole("button", { name: "Delete medicine" })); await screen.findByText("Could not save"); expect(dialog).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete medicine" })); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(fixture.delete).toHaveBeenLastCalledWith("/medicines/medicine");
});

it("cannot acknowledge a new pending reference using an older confirmed receipt", async () => {
  mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
  await screen.findByText("INV-RECOVERED"); await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toBeEnabled());
  const scope = Object.keys(localStorage).find(key => key.startsWith("ekavyu:pharmacy-dispense:"))!;
  const nextKey = crypto.randomUUID();
  act(() => { localStorage.setItem(scope, nextKey); window.dispatchEvent(new Event("storage")); });
  await screen.findByText("Pending dispense outcome");
  expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  expect(localStorage.getItem(scope)).toBe(nextKey);
  expect(screen.queryByRole("button", { name: "Retry same dispense" })).not.toBeInTheDocument();
});

it("retains the old reference but hides a late dispense result after changing location", async () => {
  const view = mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  const request = deferred(); fixture.post.mockReturnValueOnce(request.promise);
  fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" })); await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(1));
  const key = fixture.post.mock.calls[0][2].headers["Idempotency-Key"];
  fixture.locations.push({ id: "other", name: "Other branch", city: "Surat" }); fixture.activeLocationId = "other";
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [{ ...medicine, id: "other-med", locationId: "other", name: "Other stock" }] : []));
  view.rerender(tree()); await screen.findAllByText("Other stock");
  await act(async () => request.resolve(response(committed(key))));
  expect(screen.queryByText("INV-RECOVERED")).not.toBeInTheDocument();
  expect(screen.queryByText("Pending dispense outcome")).not.toBeInTheDocument();
  expect(Object.values(localStorage)).toContain(key);
});

it("does not dispatch a dispense when the recovery reference cannot be stored", async () => {
  mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  const store = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  try {
    fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
    await screen.findByText("Dispense not submitted"); expect(fixture.post).not.toHaveBeenCalled();
  } finally { store.mockRestore(); }
});

it("discards private dialogs and ignores late stock reads after location changes", async () => {
  const view = mount(); await screen.findAllByText(medicine.name); const oldRead = deferred(); fixture.get.mockReturnValue(oldRead.promise); fireEvent.click(screen.getByRole("button", { name: "Refresh pharmacy" }));
  fixture.locations.push({ id: "other", name: "Other clinic", city: "Surat" }); fixture.activeLocationId = "other"; fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [{ ...medicine, id: "other-med", locationId: "other", name: "Other stock" }] : [])); view.rerender(tree());
  expect(screen.queryByText(medicine.name)).not.toBeInTheDocument(); await screen.findAllByText("Other stock"); await act(async () => oldRead.resolve(response([medicine]))); expect(screen.queryByText(medicine.name)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add medicine" })); act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, organization_id: "other-org" } })); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("hides stock and dispensing writes from a reader and denies unauthorized pharmacy reads", async () => {
  const publicMedicine: Partial<typeof medicine> = { ...medicine }; delete publicMedicine.costPrice;
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [publicMedicine] : url.startsWith("/pharmacy/pending") ? [group] : []));
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["VIEW_EHR"] } }); mount(); await screen.findAllByText(medicine.name); expect(screen.queryByRole("button", { name: "Add medicine" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ })); expect(screen.queryByRole("button", { name: "Dispense", exact: true })).not.toBeInTheDocument(); fixture.get.mockClear();
  act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } })); expect(screen.getByText("Pharmacy access required")).toBeInTheDocument(); expect(fixture.get).not.toHaveBeenCalled();
});

it("lets a pharmacy cashier view stock without requesting prescriptions or opening a clinical socket", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "branch_cashier", permissions: ["PHARMACY_VIEW_STOCK"] } });
  fixture.capabilities.mockResolvedValue(response(capabilities(["viewStock"])));
  const socket = vi.fn(); vi.stubGlobal("WebSocket", socket);
  mount(); await screen.findAllByText(medicine.name);
  expect(screen.queryByRole("tab", { name: /Dispense/ })).not.toBeInTheDocument();
  expect(fixture.get.mock.calls.some(([url]) => url.includes("pending-prescriptions"))).toBe(false);
  expect(socket).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
});

it("uses effective receiving permission independently of catalogue and cost access", async () => {
  fixture.capabilities.mockResolvedValue(response(capabilities(["viewStock", "receiveStock"])));
  mount(); await screen.findAllByText(medicine.name);
  expect(screen.queryByRole("button", { name: "Add medicine" })).not.toBeInTheDocument();
  await menu("Add batch");
  expect(within(screen.getByRole("dialog", { name: "Add batch" })).getByLabelText("Purchase cost *")).toHaveValue(null);
  expect(screen.queryByRole("menuitem", { name: "Edit medicine" })).not.toBeInTheDocument();
});

it("saves catalogue edits without sending or displaying a cost outside the effective cost scope", async () => {
  fixture.capabilities.mockResolvedValue(response(capabilities(["viewStock", "manageCatalog"])));
  mount(); await screen.findAllByText(medicine.name); await menu("Edit medicine");
  const dialog = screen.getByRole("dialog", { name: "Edit medicine" });
  fireEvent.click(within(dialog).getByRole("tab", { name: "Stock & pricing" }));
  expect(within(dialog).queryByLabelText("Purchase cost *")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Save medicine" }));
  await waitFor(() => expect(fixture.put).toHaveBeenCalled());
  expect(fixture.put.mock.calls[0][1]).not.toHaveProperty("costPrice");
});

it("clears private records and closes stock forms when the capability check fails", async () => {
  mount(); await screen.findAllByText(medicine.name); await menu("Edit medicine");
  fixture.capabilities.mockRejectedValue(new Error("Access service unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh pharmacy" }));
  await screen.findByText("Pharmacy access unavailable");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.queryByText(medicine.name)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add medicine" })).not.toBeInTheDocument();
});

it("clears a stored cost prefill when the server revokes cost visibility during receiving", async () => {
  mount(); await screen.findAllByText(medicine.name); await menu("Add batch");
  const dialog = screen.getByRole("dialog", { name: "Add batch" });
  expect(within(dialog).getByLabelText("Purchase cost *")).toHaveValue(5);
  fixture.capabilities.mockResolvedValue(response(capabilities(["viewStock", "receiveStock"])));
  fireEvent.click(screen.getByRole("button", { name: "Refresh pharmacy" }));
  await waitFor(() => expect(within(dialog).getByLabelText("Purchase cost *")).toHaveValue(null));
});

it("drops a revoked prescription tab on refresh while retaining permitted inventory", async () => {
  mount(); await screen.findAllByText(medicine.name); fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ }));
  expect(screen.getAllByText("Sample patient").length).toBeGreaterThan(0);
  fixture.capabilities.mockResolvedValue(response(capabilities(["viewStock"])));
  fireEvent.click(screen.getByRole("button", { name: "Refresh pharmacy" }));
  await waitFor(() => expect(screen.queryByRole("tab", { name: /Dispense/ })).not.toBeInTheDocument());
  expect(screen.queryByText("Sample patient")).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Inventory/, selected: true })).toBeInTheDocument();
});

it("retains stock review on a disabled location and hides new activity", async () => {
  fixture.capabilities.mockResolvedValue(response(capabilities(["viewStock", "recoverDispense"], "clinic", false)));
  mount(); await screen.findAllByText(medicine.name);
  expect(screen.getByText("Pharmacy is disabled here")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add medicine" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Dispense/ })).not.toBeInTheDocument();
});

it("rejects an incomplete effective-permission response before requesting stock or prescriptions", async () => {
  fixture.capabilities.mockResolvedValue(response({ locationId: "clinic", enabled: true, actions: { viewStock: true } }));
  mount(); await screen.findByText("Pharmacy access unavailable"); expect(fixture.get).not.toHaveBeenCalled();
});

it("finds a barcode beyond the first catalogue page without fetching intervening pages", async () => {
  const later = { ...medicine, id: "later", name: "Later barcode formulation", barcodes: ["000123"] };
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? url.includes("search=000123") ? [later] : [medicine] : [], { "x-total-pages": url.includes("search=") ? "1" : "5", "x-total-count": url.includes("search=") ? "1" : "500" }));
  mount(); await screen.findAllByText(medicine.name);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search medicines" }), { target: { value: "000123" } });
  await screen.findAllByText(later.name);
  expect(fixture.get.mock.calls.some(([url]) => url.includes("search=000123"))).toBe(true);
  expect(fixture.get.mock.calls.some(([url]) => /page=[2-9]/.test(url))).toBe(false);
});

it("loads a prescribed stock ID beyond the visible catalogue page without a name guess", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? url.includes("medicineIds=") ? [medicine] : [{ ...medicine, id: "other", name: "Different first-page product" }] : url.startsWith("/pharmacy/pending") ? [group] : []));
  mount(); await screen.findAllByText("Different first-page product"); fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ }));
  fireEvent.click(screen.getAllByRole("button", { name: "Dispense", exact: true })[0]);
  await waitFor(() => expect(screen.queryByText("Loading prescribed stock...")).not.toBeInTheDocument());
  const dialog = screen.getByRole("dialog", { name: "Dispense prescription" });
  expect(within(dialog).getByRole("combobox", { name: `Stock for ${rx.name}` })).toHaveTextContent(medicine.name);
  expect(within(dialog).getByRole("spinbutton")).toHaveValue(null);
  expect(fixture.get.mock.calls.filter(([url]) => url.includes("medicineIds=medicine"))).toHaveLength(1);
});

it("does not finalize a dispense when a barcode scanner sends Enter in the lookup field", async () => {
  mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "2" } });
  expect(fireEvent.keyDown(within(dialog).getByRole("searchbox", { name: "Find stock by name or barcode" }), { key: "Enter", code: "Enter" })).toBe(false);
  expect(fixture.post).not.toHaveBeenCalled();
});

it("retains an explicitly selected medicine when searching for another stock item", async () => {
  mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "2" } });
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [{ ...medicine, id: "different", name: "Different searchable product" }] : url.startsWith("/pharmacy/pending") ? [group] : []));
  fireEvent.change(within(dialog).getByRole("searchbox", { name: "Find stock by name or barcode" }), { target: { value: "Different" } });
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Dispense & bill" })).toBeEnabled());
  expect(within(dialog).getByRole("combobox", { name: `Stock for ${rx.name}` })).toHaveTextContent(medicine.name);
  expect(within(dialog).getByRole("spinbutton")).toHaveValue(2);
});

it("aggregates repeated medicine selections, validates whole quantities and preserves pending IDs", () => {
  expect(prepareDispense([rx, { ...rx, id: "second" }], [{ medicineId: "medicine", quantity: 3 }, { medicineId: "medicine", quantity: 4 }], [medicine], "clinic")).toEqual({ items: [{ medicineId: "medicine", quantity: 7 }], prescriptionIds: ["prescription", "second"], prescriptionAllocations: [{ prescriptionId: "prescription", medicineId: "medicine", quantity: 3 }, { prescriptionId: "second", medicineId: "medicine", quantity: 4 }] });
  for (const value of [0, -1, 1.5, NaN, Infinity, 31]) expect(prepareDispense([rx], [{ medicineId: "medicine", quantity: value }], [medicine], "clinic").error).toBeTruthy();
  expect(prepareDispense([rx, { ...rx, id: "second" }], [{ medicineId: "medicine", quantity: 20 }, { medicineId: "medicine", quantity: 20 }], [medicine], "clinic").error).toContain("Not enough stock");
  expect(prepareDispense([rx], [{ medicineId: "medicine", quantity: 1 }], [medicine], "other").error).toContain("this location");
});

it("bounds the pinned dispense payload to the backend item and prescription limits", () => {
  const medicines = Array.from({ length: 101 }, (_, index) => ({ ...medicine, id: `medicine-${index}` }));
  const prescriptions = medicines.map((item, index) => ({ ...rx, id: `prescription-${index}`, medicineId: item.id }));
  const selections = medicines.map(item => ({ medicineId: item.id, quantity: 1 }));
  expect(prepareDispense(prescriptions, selections, medicines, "clinic").error).toContain("100 stock items");
  const repeated = Array.from({ length: 201 }, (_, index) => ({ ...rx, id: `prescription-${index}` }));
  const quantities = repeated.map(() => ({ medicineId: medicine.id, quantity: 1 }));
  expect(prepareDispense(repeated, quantities, [{ ...medicine, stockQuantity: 1000 }], "clinic").error).toContain("200 prescriptions");
  expect(prepareDispense(repeated.slice(0, 200), quantities.slice(0, 200), [{ ...medicine, stockQuantity: 1000 }], "clinic").items).toEqual([{ medicineId: medicine.id, quantity: 200 }]);
});
