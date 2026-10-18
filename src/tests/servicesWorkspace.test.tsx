import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Catalog from "@/app/(dashboard)/dashboard/billing/services/page";
import { ToastProvider } from "@/components/ui/Toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { emptyServiceForm, readServiceCatalog, validateServiceForm } from "@/components/billing/serviceCatalog";

const service = { _id: "service", code: "CONS", name: "Sample consultation", category: "consultation", department: "General", price: 100, hsnSacCode: "999312", gstRate: 0, isActive: true };
const response = (data: unknown, headers: Record<string, string> = {}) => ({ data: { data }, headers });
const mount = () => render(<ToastProvider><Catalog /></ToastProvider>);
const deferred = () => { let resolve!: (value: unknown) => void; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
async function menu(name: string) {
  fireEvent.click((await screen.findAllByRole("button", { name: `Actions for ${service.name}` }))[0]);
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}
beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  useAuthStore.setState({ user: { id: "manager", name: "Sample manager", email: "manager@example.test", role: "staff", organization_id: "org-a", permissions: ["MANAGE_BILLING"] } });
  vi.spyOn(api, "get").mockResolvedValue(response([service]));
  vi.spyOn(api, "post").mockResolvedValue(response({}));
  vi.spyOn(api, "put").mockResolvedValue(response({}));
  vi.spyOn(api, "delete").mockResolvedValue(response({}));
});
afterEach(() => { vi.restoreAllMocks(); act(() => useAuthStore.setState({ user: null })); });

it("keeps counts across tabs and combines local name/code/tax search with category filters", async () => {
  const lab = { ...service, _id: "lab", code: "LAB", name: "Sample blood test", category: "lab_test", hsnSacCode: "999999", isActive: false };
  vi.mocked(api.get).mockResolvedValue(response([service, lab])); mount(); await screen.findAllByText(lab.name);
  fireEvent.click(screen.getByRole("tab", { name: /Inactive\s*1/ }));
  expect(screen.queryByText(service.name)).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /All\s*2/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search services" }), { target: { value: "999999" } });
  expect(screen.getAllByText(lab.name).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(screen.getByLabelText("Category"));
  fireEvent.click(await screen.findByRole("option", { name: "Consultation", exact: true }));
  expect(screen.getAllByText("No services match these filters.").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Add default services" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getAllByText(service.name).length).toBeGreaterThan(0); expect(api.get).toHaveBeenCalledTimes(1);
});

it("loads every API page before displaying complete counts", async () => {
  const later = { ...service, _id: "later", name: "Later service", code: "LATER" };
  vi.mocked(api.get).mockImplementation(async url => response(url.includes("page=2") ? [later] : [service], { "x-total-pages": "2" }));
  mount(); await screen.findAllByText(later.name);
  expect(screen.getByRole("tab", { name: /All\s*2/ })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith("/service-catalog?page=2&limit=100", expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it("does not expose an incomplete catalog if a later page fails", async () => {
  vi.mocked(api.get).mockResolvedValueOnce(response([service], { "x-total-pages": "2" })).mockRejectedValueOnce(new Error("offline"));
  await expect(readServiceCatalog(new AbortController().signal)).rejects.toThrow("offline");
});

it("retains loaded services after refresh failure and provides a persistent retry", async () => {
  mount(); await screen.findAllByText(service.name);
  vi.mocked(api.get).mockRejectedValueOnce(new Error("Offline")); fireEvent.click(screen.getByRole("button", { name: "Refresh services" }));
  await screen.findByText("Services could not be loaded. Check your connection and try again.");
  expect(screen.getAllByText(service.name).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Add service" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByText("Catalog unavailable")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Add service" })).toBeEnabled();
});

it("validates across form tabs, preserves values and saves a zero price through the pinned footer", async () => {
  mount(); await screen.findAllByText(service.name); fireEvent.click(screen.getByRole("button", { name: "Add service" }));
  const dialog = screen.getByRole("dialog", { name: "Add service" });
  fireEvent.click(within(dialog).getByRole("tab", { name: "Pricing & tax" })); fireEvent.click(within(dialog).getByRole("button", { name: "Save service" }));
  expect(within(dialog).getByRole("tab", { name: "Service", selected: true })).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Service name *"), { target: { value: " Free review " } });
  fireEvent.change(within(dialog).getByLabelText("Service code *"), { target: { value: " free " } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save service" }));
  expect(within(dialog).getByRole("tab", { name: "Pricing & tax", selected: true })).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Base price (INR) *"), { target: { value: "0" } });
  fireEvent.click(within(dialog).getByRole("tab", { name: "Service" }));
  expect(within(dialog).getByLabelText("Service name *")).toHaveValue(" Free review ");
  const save = within(dialog).getByRole("button", { name: "Save service" }); expect((save as HTMLButtonElement).form?.id).toBe("service-form"); fireEvent.click(save);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/service-catalog", expect.objectContaining({ code: "FREE", name: "Free review", price: 0, gstRate: 0, isActive: true })));
});

it("preserves inactive status and existing tax rates when editing, while blocking duplicate submissions and dismissal", async () => {
  vi.mocked(api.get).mockResolvedValue(response([{ ...service, isActive: false, gstRate: 7.5 }])); mount(); await menu("Edit service");
  const dialog = screen.getByRole("dialog", { name: "Edit service" }); expect(within(dialog).getByLabelText("Service code *")).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("tab", { name: "Pricing & tax" })); expect(within(dialog).getByLabelText("GST rate")).toHaveTextContent("7.5%");
  const pending = deferred(); vi.mocked(api.put).mockReturnValue(pending.promise as ReturnType<typeof api.put>);
  const save = within(dialog).getByRole("button", { name: "Save service" }); fireEvent.click(save); fireEvent.click(save);
  expect(api.put).toHaveBeenCalledTimes(1); expect(api.put).toHaveBeenCalledWith("/service-catalog/service", expect.objectContaining({ isActive: false, gstRate: 7.5 }));
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.keyDown(document, { key: "Escape" }); expect(dialog).toBeInTheDocument();
  await act(async () => pending.resolve(response({}))); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("keeps entered values after a failed save", async () => {
  mount(); await menu("Edit service"); const dialog = screen.getByRole("dialog", { name: "Edit service" });
  fireEvent.change(within(dialog).getByLabelText("Service name *"), { target: { value: "Changed name" } });
  vi.mocked(api.put).mockRejectedValueOnce(new Error("Offline")); fireEvent.click(within(dialog).getByRole("button", { name: "Save service" }));
  await within(dialog).findByText("Your request could not be completed. Check the catalog before retrying.");
  expect(within(dialog).getByLabelText("Service name *")).toHaveValue("Changed name"); expect(within(dialog).getByRole("button", { name: "Save service" })).toBeEnabled();
});

it("explains a duplicate code without losing the new service draft", async () => {
  mount(); await screen.findAllByText(service.name); fireEvent.click(screen.getByRole("button", { name: "Add service" }));
  const dialog = screen.getByRole("dialog", { name: "Add service" });
  fireEvent.change(within(dialog).getByLabelText("Service name *"), { target: { value: "Another consultation" } });
  fireEvent.change(within(dialog).getByLabelText("Service code *"), { target: { value: "CONS" } });
  fireEvent.click(within(dialog).getByRole("tab", { name: "Pricing & tax" }));
  fireEvent.change(within(dialog).getByLabelText("Base price (INR) *"), { target: { value: "150" } });
  vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save service" }));
  await within(dialog).findByText("This service code is already in use. Choose another code or edit the existing service.");
  fireEvent.click(within(dialog).getByRole("tab", { name: "Service" }));
  expect(within(dialog).getByLabelText("Service code *")).toHaveValue("CONS");
  expect(within(dialog).getByLabelText("Service name *")).toHaveValue("Another consultation");
});

it("confirms deactivation and keeps a failed operation available for retry", async () => {
  mount(); await menu("Deactivate"); const dialog = screen.getByRole("dialog", { name: "Deactivate service?" });
  expect(api.delete).not.toHaveBeenCalled(); vi.mocked(api.delete).mockRejectedValueOnce(new Error("Offline"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" })); await screen.findByText("Could not save");
  expect(dialog).toBeInTheDocument(); fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(api.delete).toHaveBeenCalledWith("/service-catalog/service");
});

it("reactivates an inactive service without changing its rate", async () => {
  vi.mocked(api.get).mockResolvedValue(response([{ ...service, isActive: false }])); mount(); await menu("Reactivate");
  fireEvent.click(within(screen.getByRole("dialog", { name: "Reactivate service?" })).getByRole("button", { name: "Reactivate" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith("/service-catalog/service", { isActive: true }));
});

it("confirms default provisioning and denies unauthorized reads", async () => {
  vi.mocked(api.get).mockResolvedValue(response([])); mount(); fireEvent.click(await screen.findByRole("button", { name: "Add default services" }));
  const dialog = screen.getByRole("dialog", { name: "Add default services?" }); expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Add defaults" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/service-catalog/seed"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  vi.mocked(api.get).mockClear(); act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } }));
  expect(screen.getByText("Billing access required")).toBeInTheDocument(); expect(api.get).not.toHaveBeenCalled();
});

it("discards private drafts and ignores mutation completions when organization changes", async () => {
  mount(); await menu("Edit service"); const oldWrite = deferred(); vi.mocked(api.put).mockReturnValue(oldWrite.promise as ReturnType<typeof api.put>);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save service" }));
  vi.mocked(api.get).mockResolvedValue(response([{ ...service, name: "Other organization service" }]));
  act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, organization_id: "org-b" } }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(screen.queryByText(service.name)).not.toBeInTheDocument();
  await screen.findAllByText("Other organization service"); const reads = vi.mocked(api.get).mock.calls.length;
  await act(async () => oldWrite.resolve(response({})));
  expect(screen.queryByText("Service updated")).not.toBeInTheDocument(); expect(api.get).toHaveBeenCalledTimes(reads);
});

it("rejects malformed pricing and required fields while allowing a valid zero tariff", () => {
  const form = { ...emptyServiceForm(), name: "Review", code: "REVIEW", price: "0" };
  expect(validateServiceForm(form)).toBeNull();
  for (const price of ["", "-1", "NaN", "Infinity", "1.234", "1e100"]) expect(validateServiceForm({ ...form, price })?.tab).toBe("pricing");
  for (const gstRate of ["", "-1", "29", "NaN"]) expect(validateServiceForm({ ...form, gstRate })?.tab).toBe("pricing");
  expect(validateServiceForm({ ...form, name: "  " })?.tab).toBe("service"); expect(validateServiceForm({ ...form, category: "invalid" })?.tab).toBe("service");
});
