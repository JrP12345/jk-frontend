import { datePickerInput } from "./datePickerTestUtils";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PharmacyPage from "@/app/(dashboard)/dashboard/pharmacy/page";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";
import { prepareDispense, readMedicineCatalog } from "@/components/pharmacy/pharmacyWorkspace";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), fetch: vi.fn(), locations: [{ id: "clinic", name: "Sample clinic", city: "Surat" }], activeLocationId: "clinic" as string | null }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post, put: fixture.put, delete: fixture.delete } }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: Object.assign((selector?: (state: unknown) => unknown) => {
  const state = { locations: fixture.locations, fetchLocations: fixture.fetch, activeLocationId: fixture.activeLocationId, isLoading: false, error: null };
  return selector ? selector(state) : state;
}, { getState: () => ({ reset: () => {} }) }) }));
vi.mock("@/utils/audioChimes", () => ({ playChimeSound: vi.fn() }));
const medicine = { id: "medicine", locationId: "clinic", name: "Sample medicine 500mg", genericName: "Sample composition", batchNumber: "B-001", expiryDate: "2030-12-01", stockQuantity: 30, costPrice: 5, price: 10 };
const rx = { id: "prescription", medicineId: "medicine", name: medicine.name, dosage: "500 mg", frequency: "1-0-1", duration: "3 days", instructions: "After food" };
const group = { encounterId: "aaaaaaaaaaaaaaaaaaaaaaaa", appointmentId: "bbbbbbbbbbbbbbbbbbbbbbbb", appointmentTime: "2026-10-18T10:00:00Z", tokenNumber: 7, patientId: { id: "patient", name: "Sample patient", phone: "9999999999" }, doctorId: { id: "doctor", name: "Sample doctor" }, prescriptions: [rx] };
const response = (data: unknown, headers: Record<string, string> = {}) => ({ data: { data }, headers });
const deferred = () => { let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tree = () => <ToastProvider><PharmacyPage /></ToastProvider>;
const mount = () => render(tree());
async function menu(label: string) { fireEvent.click((await screen.findAllByRole("button", { name: `Actions for ${medicine.name}` }))[0]); fireEvent.click(await screen.findByRole("menuitem", { name: label })); }
async function openDispense() { await screen.findAllByText(medicine.name); fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ })); fireEvent.click(screen.getAllByRole("button", { name: "Dispense", exact: true })[0]); return screen.getByRole("dialog", { name: "Dispense prescription" }); }
beforeEach(() => {
  fixture.locations = [{ id: "clinic", name: "Sample clinic", city: "Surat" }]; fixture.activeLocationId = "clinic";
  fixture.fetch.mockReset().mockResolvedValue(fixture.locations);
  fixture.get.mockReset().mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [medicine] : url.startsWith("/pharmacy/pending") ? [group] : []));
  fixture.post.mockReset().mockResolvedValue(response({})); fixture.put.mockReset().mockResolvedValue(response({})); fixture.delete.mockReset().mockResolvedValue(response({}));
  useAuthStore.setState({ user: { id: "pharmacist", name: "Sample pharmacist", email: "sample@example.test", role: "pharmacist", organization_id: "org", permissions: ["MANAGE_MEDICINES", "VIEW_EHR"] } });
  vi.stubGlobal("WebSocket", class { close = vi.fn(); });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); });

it("keeps tab counts and filters inventory without a selector for the sole location", async () => {
  mount(); await screen.findAllByText(medicine.name); expect(screen.queryByRole("combobox", { name: "Pharmacy location" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ })); expect(screen.getAllByText("Sample patient").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("tab", { name: /Inventory\s*1/ })); fireEvent.change(screen.getByRole("searchbox", { name: "Search medicines" }), { target: { value: "missing" } });
  expect(screen.getAllByText("No medicines match these filters.").length).toBeGreaterThan(0); expect(screen.getByRole("tab", { name: /Inventory\s*1/ })).toBeInTheDocument();
});

it("loads every catalog page so later medicines remain searchable and selectable", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.includes("page=2") ? [{ ...medicine, id: "later", name: "Later formulation" }] : url.startsWith("/medicines") ? [medicine] : [], { "x-total-pages": "2" }));
  mount(); await screen.findAllByText("Later formulation"); expect(screen.getByRole("tab", { name: /Inventory\s*2/ })).toBeInTheDocument();
  expect(fixture.get).toHaveBeenCalledWith("/medicines?page=2&limit=100&locationId=clinic", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it("does not return an incomplete catalog when a later page fails", async () => {
  fixture.get.mockResolvedValueOnce(response([medicine], { "x-total-pages": "2" })).mockRejectedValueOnce(new Error("offline"));
  await expect(readMedicineCatalog("clinic", new AbortController().signal)).rejects.toThrow("offline");
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

it("switches to invalid medicine fields and saves the complete scoped form through the pinned footer", async () => {
  mount(); await screen.findAllByText(medicine.name); fireEvent.click(screen.getByRole("button", { name: "Add medicine" })); const dialog = screen.getByRole("dialog", { name: "Add medicine" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save medicine" })); expect(within(dialog).getByRole("tab", { name: "Medicine", selected: true })).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Medicine name *"), { target: { value: "New medicine" } }); fireEvent.change(within(dialog).getByLabelText("Generic composition *"), { target: { value: "New generic" } });
  fireEvent.change(within(dialog).getByLabelText("Batch number *"), { target: { value: "B-NEW" } }); fireEvent.change(datePickerInput(within(dialog).getByLabelText("Expiry date *")), { target: { value: "2030-12-01" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save medicine" })); expect(within(dialog).getByRole("tab", { name: "Stock & pricing", selected: true })).toBeInTheDocument();
  for (const [label, value] of [["Purchase cost *", "5"], ["Retail price *", "10"], ["Stock quantity *", "0"]]) fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
  const submit = within(dialog).getByRole("button", { name: "Save medicine" }); expect((submit as HTMLButtonElement).form?.id).toBe("medicine-form"); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/medicines", expect.objectContaining({ name: "New medicine", genericName: "New generic", stockQuantity: 0, price: 10, costPrice: 5, batchNumber: "B-NEW", locationId: "clinic" })));
});

it("preserves edited medicine values after save failure", async () => {
  mount(); await menu("Edit medicine"); const dialog = screen.getByRole("dialog", { name: "Edit medicine" });
  fireEvent.change(within(dialog).getByLabelText("Medicine name *"), { target: { value: "Changed medicine" } }); fixture.put.mockRejectedValueOnce(new Error("offline")); fireEvent.click(within(dialog).getByRole("button", { name: "Save medicine" }));
  await screen.findByText("Could not save"); expect(within(dialog).getByLabelText("Medicine name *")).toHaveValue("Changed medicine");
});

it("validates and receives a batch for its actual medicine location", async () => {
  mount(); await menu("Add batch"); const dialog = screen.getByRole("dialog", { name: "Add batch" }); fireEvent.click(within(dialog).getByRole("button", { name: "Save batch" }));
  expect(await within(dialog).findByText("Check batch details")).toBeInTheDocument();
  for (const [label, value] of [["Batch number *", "B-NEW"], ["Expiry date *", "2030-12-01"], ["Quantity received *", "15"]]) {
    const control = within(dialog).getByLabelText(label);
    fireEvent.change(label === "Expiry date *" ? datePickerInput(control) : control, { target: { value } });
  }
  const submit = within(dialog).getByRole("button", { name: "Save batch" }); expect((submit as HTMLButtonElement).form?.id).toBe("batch-form"); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/pharmacy/batches", { medicineId: "medicine", locationId: "clinic", batchNumber: "B-NEW", expiryDate: "2030-12-01", quantity: 15, purchaseCost: 5, sellingPrice: 10 }));
});

it("does not guess quantities or match similarly named formulations", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [medicine] : [{ ...group, prescriptions: [{ ...rx, medicineId: null }] }]));
  mount(); const dialog = await openDispense(); expect(within(dialog).getByRole("combobox")).toHaveTextContent("Leave pending"); expect(within(dialog).getByRole("spinbutton")).toBeDisabled(); expect(within(dialog).getByRole("button", { name: "Dispense & bill" })).toBeDisabled();
});

it("prevents duplicate dispensing while saving and submits selected prescriptions alone", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [medicine] : [{ ...group, prescriptions: [rx, { ...rx, id: "unselected", medicineId: null, name: "Another medicine" }] }]));
  mount(); const dialog = await openDispense(); expect(within(dialog).getByRole("spinbutton", { name: `Quantity for ${rx.name}` })).toHaveValue(null);
  fireEvent.change(within(dialog).getByRole("spinbutton", { name: `Quantity for ${rx.name}` }), { target: { value: "4" } }); const pending = deferred(); fixture.post.mockReturnValue(pending.promise);
  const submit = within(dialog).getByRole("button", { name: "Dispense & bill" }); fireEvent.click(submit); fireEvent.click(submit); expect(fixture.post).toHaveBeenCalledTimes(1); expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(fixture.post).toHaveBeenCalledWith("/pharmacy/dispense", expect.objectContaining({ prescriptionIds: ["prescription"], items: [{ medicineId: "medicine", quantity: 4 }], patientId: "patient", encounterId: group.encounterId, appointmentId: group.appointmentId, locationId: "clinic" }));
  await act(async () => pending.resolve(response({}))); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("reconciles a failed dispense with the refreshed list before allowing another bill", async () => {
  mount(); const dialog = await openDispense(); fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
  fixture.post.mockRejectedValueOnce(new Error("response lost")); fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [{ ...medicine, stockQuantity: 26 }] : [])); fireEvent.click(within(dialog).getByRole("button", { name: "Dispense & bill" }));
  await within(dialog).findByText("Prescription changed"); expect(within(dialog).getByRole("button", { name: "Dispense & bill" })).toBeDisabled(); expect(fixture.post).toHaveBeenCalledTimes(1);
});

it("requires deletion confirmation and keeps failed deletion available for retry", async () => {
  mount(); await menu("Delete medicine"); const dialog = screen.getByRole("dialog", { name: "Delete medicine?" }); expect(fixture.delete).not.toHaveBeenCalled();
  fixture.delete.mockRejectedValueOnce(new Error("offline")); fireEvent.click(within(dialog).getByRole("button", { name: "Delete medicine" })); await screen.findByText("Could not save"); expect(dialog).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete medicine" })); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(fixture.delete).toHaveBeenLastCalledWith("/medicines/medicine");
});

it("discards private dialogs and ignores late stock reads after location changes", async () => {
  const view = mount(); await screen.findAllByText(medicine.name); const oldRead = deferred(); fixture.get.mockReturnValue(oldRead.promise); fireEvent.click(screen.getByRole("button", { name: "Refresh pharmacy" }));
  fixture.locations.push({ id: "other", name: "Other clinic", city: "Surat" }); fixture.activeLocationId = "other"; fixture.get.mockImplementation(async (url: string) => response(url.startsWith("/medicines") ? [{ ...medicine, id: "other-med", locationId: "other", name: "Other stock" }] : [])); view.rerender(tree());
  expect(screen.queryByText(medicine.name)).not.toBeInTheDocument(); await screen.findAllByText("Other stock"); await act(async () => oldRead.resolve(response([medicine]))); expect(screen.queryByText(medicine.name)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add medicine" })); act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, organization_id: "other-org" } })); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("hides stock and dispensing writes from a reader and denies unauthorized pharmacy reads", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["VIEW_EHR"] } }); mount(); await screen.findAllByText(medicine.name); expect(screen.queryByRole("button", { name: "Add medicine" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Dispense\s*1/ })); expect(screen.queryByRole("button", { name: "Dispense", exact: true })).not.toBeInTheDocument(); fixture.get.mockClear();
  act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } })); expect(screen.getByText("Pharmacy access required")).toBeInTheDocument(); expect(fixture.get).not.toHaveBeenCalled();
});

it("aggregates repeated medicine selections, validates whole quantities and preserves pending IDs", () => {
  expect(prepareDispense([rx, { ...rx, id: "second" }], [{ medicineId: "medicine", quantity: 3 }, { medicineId: "medicine", quantity: 4 }], [medicine], "clinic")).toEqual({ items: [{ medicineId: "medicine", quantity: 7 }], prescriptionIds: ["prescription", "second"] });
  for (const value of [0, -1, 1.5, NaN, Infinity, 31]) expect(prepareDispense([rx], [{ medicineId: "medicine", quantity: value }], [medicine], "clinic").error).toBeTruthy();
  expect(prepareDispense([rx, { ...rx, id: "second" }], [{ medicineId: "medicine", quantity: 20 }, { medicineId: "medicine", quantity: 20 }], [medicine], "clinic").error).toContain("Not enough stock");
  expect(prepareDispense([rx], [{ medicineId: "medicine", quantity: 1 }], [medicine], "other").error).toContain("this location");
});
