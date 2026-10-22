import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";
import { ExecutiveAnalytics } from "@/components/analytics/ExecutiveAnalytics";
import { ToastProvider } from "@/components/ui/Toast";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: fixture }));
vi.mock("@/components/ui", async importOriginal => ({
  ...await importOriginal<typeof import("@/components/ui")>(),
  ChartContainer: ({ title, children }: { title: string; children: React.ReactNode }) => <section aria-label={title}>{children}</section>,
  AreaChart: () => <div>Visit chart</div>, DonutChart: () => <div>Department chart</div>,
}));
const response = (data: unknown) => ({ data: { data } });
const roles = [{ name: "doctor", description: "Clinical care", permissions: ["VIEW_PATIENTS"], isSystemRole: true }, { name: "nurse", description: "Nursing care", permissions: ["VITALS_RECORD"], isSystemRole: true }];
const catalog = [{ code: "VIEW_PATIENTS", name: "View patients", description: "Read assigned patients", category: "Clinical" }, { code: "VITALS_RECORD", name: "Record vitals", description: "Record observations", category: "Clinical" }];
const users = [{ id: "sample", name: "Sample nurse", email: "sample@example.test", role: "nurse" }];
const mountRoles = () => render(<ToastProvider><RBACPermissionMatrix organizationId="org" users={users} onRefresh={vi.fn()} /></ToastProvider>);
beforeEach(() => {
  fixture.get.mockReset().mockImplementation(async (url: string) => response(url.includes("/role-presets") ? [] : url.includes("/roles") ? roles : catalog));
  fixture.post.mockReset().mockResolvedValue(response({ name: "Triage" })); fixture.put.mockReset().mockResolvedValue(response({}));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

it("submits a member role through its pinned footer and preserves the choice on failure", async () => {
  mountRoles(); fireEvent.click(await screen.findByRole("tab", { name: "Member roles (1)" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Edit Role" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Change member role" });
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Select Operational Role *" })); fireEvent.click(await screen.findByRole("option", { name: /DOCTOR/ }));
  fixture.put.mockRejectedValueOnce(new Error("offline")); const submit = within(dialog).getByRole("button", { name: "Save Role Assignment" });
  expect((submit as HTMLButtonElement).form?.id).toBe("staff-role"); fireEvent.click(submit);
  await screen.findByText("Update Failed"); expect(within(dialog).getByRole("combobox")).toHaveTextContent("DOCTOR");
  fireEvent.click(submit); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(fixture.put).toHaveBeenLastCalledWith("/users/sample/role?organizationId=org", { role: "doctor" });
});

it("keeps a pending role save open and prevents duplicate submissions", async () => {
  let finish!: (result: unknown) => void; fixture.put.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mountRoles(); fireEvent.click(await screen.findByRole("tab", { name: "Member roles (1)" })); fireEvent.click(screen.getAllByRole("button", { name: "Edit Role" })[0]);
  const dialog = screen.getByRole("dialog"); const submit = within(dialog).getByRole("button", { name: "Save Role Assignment" }); fireEvent.click(submit); fireEvent.click(submit);
  expect(fixture.put).toHaveBeenCalledTimes(1); expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.keyDown(document, { key: "Escape" }); expect(dialog).toBeInTheDocument();
  await act(async () => finish(response({})));
});

it("creates a custom role with the selected preset through its pinned footer", async () => {
  mountRoles(); fireEvent.click(await screen.findByRole("button", { name: "+ Create role" }));
  const dialog = screen.getByRole("dialog", { name: "Create custom role" });
  fireEvent.click(within(dialog).getByText("Combine role presets (optional)"));
  fireEvent.change(within(dialog).getByLabelText("Role Name *"), { target: { value: "Triage" } }); fireEvent.click(within(dialog).getByRole("button", { name: /Nursing & Triage/ }));
  const submit = within(dialog).getByRole("button", { name: "Create Custom Role" }); expect((submit as HTMLButtonElement).form?.id).toBe("staff-custom-role"); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/roles?organizationId=org", { name: "Triage", description: "", permissions: ["VITALS_RECORD"] }));
});

it("does not present a failed insights source as zero records and supports retry", async () => {
  fixture.get.mockRejectedValue(new Error("offline")); render(<ExecutiveAnalytics />);
  await screen.findByText(/Unable to load executive metrics/); expect(screen.queryByText("Billed amount")).not.toBeInTheDocument();
  fixture.get.mockImplementation(async (url: string) => response(url === "/appointments" ? [{ status: "completed" }] : url === "/invoices" ? [{ totalAmount: 500, amountPaid: 200 }] : []));
  fireEvent.click(screen.getByRole("button", { name: "Try Again" })); await screen.findByRole("heading", { name: "Practice insights" });
  expect(screen.getByText("Billed amount")).toBeInTheDocument(); expect(screen.getAllByText(/500/).length).toBeGreaterThan(0); expect(screen.getByText(/List limits may exclude older records/)).toBeInTheDocument();
  fixture.get.mockRejectedValue(new Error("offline")); fireEvent.click(screen.getByRole("button", { name: "Refresh" })); await screen.findByText("Insights could not be refreshed");
  expect(screen.getByText("Billed amount")).toBeInTheDocument(); expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
});

it("creates an opt-in pharmacy cashier role without EHR, cost or general billing grants", async () => {
  const permissions = ["VIEW_LOCATIONS", "PHARMACY_VIEW_STOCK", "PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT", "PHARMACY_CLOSE_TILL"];
  const expandedCatalog = [...catalog, ...permissions.map(code => ({ code, name: code, description: code, category: "Pharmacy" }))];
  fixture.get.mockImplementation(async (url: string) => response(url.includes("/role-presets") ? [{ name: "pharmacy_cashier", label: "Pharmacy cashier", permissions }] : url.includes("/roles") ? roles : expandedCatalog));
  mountRoles(); fireEvent.click(await screen.findByRole("button", { name: "+ Create role" }));
  const dialog = screen.getByRole("dialog", { name: "Create custom role" });
  fireEvent.click(within(dialog).getByText("Combine role presets (optional)"));
  fireEvent.change(within(dialog).getByLabelText("Role Name *"), { target: { value: "Branch cashier" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Pharmacy cashier/ }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Create Custom Role" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/roles?organizationId=org", { name: "Branch cashier", description: "", permissions }));
});

it("does not widen an explicit empty legacy preset when the permission catalogue grows", async () => {
  fixture.get.mockImplementation(async (url: string) => response(url.includes("/role-presets") ? [] : url.includes("/roles") ? [...roles, { name: "location_manager", permissions: [], description: "Reviewed empty role" }] : [...catalog, { code: "PHARMACY_VIEW_COST", name: "View costs", category: "Pharmacy" }]));
  mountRoles(); fireEvent.click(await screen.findByRole("button", { name: "+ Create role" }));
  const dialog = screen.getByRole("dialog", { name: "Create custom role" });
  fireEvent.click(within(dialog).getByText("Combine role presets (optional)"));
  fireEvent.click(within(dialog).getByRole("button", { name: /Practice manager/ }));
  expect(await screen.findByText("No Permissions Found")).toBeInTheDocument();
  expect(within(dialog).getAllByRole("checkbox").every(input => !(input as HTMLInputElement).checked)).toBe(true);
  expect(fixture.put).not.toHaveBeenCalled(); expect(fixture.post).not.toHaveBeenCalled();
});
