import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";
import { PharmacyHome } from "@/components/pharmacy/PharmacyHome";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { isCounterSalesUser } from "@/lib/pharmacyCapabilities";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const permissions = ["VIEW_LOCATIONS", "PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT", "PHARMACY_CLOSE_TILL"];
const roles = [{ name: "admin", description: "Owner", permissions: ["MANAGE_ORGANIZATION"], isSystemRole: true }, { name: "pharmacy_counter_sales", description: "Counter staff", permissions, isSystemRole: false }];
const preset = { name: "pharmacy_counter_sales", label: "Counter sales only", permissions };
const catalog = [...permissions, "MANAGE_MEDICINES"].map(code => ({ code, name: code, category: "Pharmacy", description: code }));
const member = { id: "vimal", name: "Vimal", email: "vimal@example.test", role: "pharmacist" };
const response = (data: unknown) => ({ data: { data } });
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url: string) => response(url.startsWith("/roles") ? roles.slice(0, 1) : url === "/permissions" ? catalog : [preset]));
  api.post.mockResolvedValue(response({ name: "pharmacy_counter_sales" }));
  api.put.mockResolvedValue(response({}));
  useAuthStore.setState({ user: { id: "owner", name: "Owner", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["ADMINISTRATIVE_GOVERNANCE"] } });
  Element.prototype.scrollIntoView = vi.fn();
});
const mount = () => render(<ToastProvider><RBACPermissionMatrix users={[member]} onRefresh={vi.fn()} organizationId="org" /></ToastProvider>);

it("creates a narrow role from the server template only after review and replaces broader draft grants", async () => {
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Create counter sales role" }));
  const dialog = screen.getByRole("dialog", { name: "Create custom role" });
  expect(api.post).not.toHaveBeenCalled();
  expect(within(dialog).getByLabelText("Role Name *")).toHaveValue("pharmacy_counter_sales");
  const broad = within(dialog).getByRole("checkbox", { name: /MANAGE_MEDICINES/ }); fireEvent.click(broad); expect(broad).toBeChecked();
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Pharmacy access template" }));
  fireEvent.click(await screen.findByRole("option", { name: "Counter sales only", exact: true }));
  expect(broad).not.toBeChecked();
  fireEvent.click(within(dialog).getByRole("button", { name: "Create Custom Role", exact: true }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/roles?organizationId=org", expect.objectContaining({ name: "pharmacy_counter_sales", permissions })));
});

it("does not silently create a partial sales role if the permission catalogue is incomplete", async () => {
  api.get.mockImplementation(async (url: string) => response(url.startsWith("/roles") ? roles.slice(0, 1) : url === "/permissions" ? catalog.filter(item => item.code !== "PHARMACY_COLLECT_PAYMENT") : [preset]));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Create counter sales role" }));
  expect(await screen.findByText("Access template unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Create custom role" })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});

it("keeps a counter-only home free of owner setup links without requests or writes", () => {
  useAuthStore.setState({ user: { id: "seller", name: "Seller", email: "seller@example.test", role: "pharmacy_counter_sales", workspaceProfile: "pharmacy", organization_id: "org", permissions } });
  render(<PharmacyHome />);
  expect(screen.getByRole("link", { name: "Open counter sales" })).toHaveAttribute("href", "/dashboard/pharmacy");
  expect(screen.getAllByRole("link")).toHaveLength(1); expect(api.get).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
  expect(isCounterSalesUser({ role: "root", permissions })).toBe(false);
  expect(isCounterSalesUser({ role: "custom", permissions: [...permissions, "PHARMACY_MANAGE_CUSTOMERS"] })).toBe(true);
  expect(isCounterSalesUser({ role: "custom", permissions: [...permissions, "PHARMACY_VIEW_COST"] })).toBe(false);
});

it("reviews an existing role instead of duplicating it and assigns it through the scoped member-role API", async () => {
  api.get.mockImplementation(async (url: string) => response(url.startsWith("/roles") ? roles : url === "/permissions" ? catalog : [preset]));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Review counter sales role" }));
  expect(screen.getByRole("combobox", { name: "Role permissions" })).toHaveTextContent("PHARMACY_COUNTER_SALES");
  expect(screen.queryByRole("dialog", { name: "Create custom role" })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "Member roles (1)" }));
  fireEvent.click((await screen.findAllByRole("button", { name: "Edit Role", exact: true }))[0]);
  const dialog = screen.getByRole("dialog", { name: "Change member role" });
  fireEvent.click(within(dialog).getByRole("combobox", { name: "Select Operational Role *" }));
  fireEvent.click(await screen.findByRole("option", { name: /PHARMACY_COUNTER_SALES/ }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Save Role Assignment" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith("/users/vimal/role?organizationId=org", { role: "pharmacy_counter_sales" }));
});
