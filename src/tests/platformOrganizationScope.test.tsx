import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import UsersPage from "@/app/(dashboard)/dashboard/admin/users/page";
import OrganizationsPage from "@/app/(dashboard)/dashboard/organizations/page";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(window.location.search) }));
const organizations = [
  { id: "org-a", name: "Aurora Health", city: "Mumbai", plan: "starter", status: "active" },
  { id: "org-b", name: "Willow Clinic", city: "Delhi", plan: "professional", status: "active" },
];
const identity = { id: "staff-1", name: "Shared Staff", email: "staff@example.test", role: "nurse", isActive: true, memberships: organizations.map(org => ({ organizationId: org.id, organizationName: org.name, role: "nurse" })) };
function response(data: unknown) { return { data: { data } }; }
function mount(element: React.ReactElement) { return render(<ToastProvider>{element}</ToastProvider>); }
function userRequests() { return vi.mocked(api.get).mock.calls.filter(([path]) => String(path).startsWith("/admin/users?")); }
beforeEach(() => {
  useAuthStore.setState({ user: { id: "root-1", name: "Root", email: "root@example.test", role: "root" }, isAuthenticated: true, isLoading: false, impersonate: vi.fn().mockResolvedValue(undefined) });
  vi.spyOn(api, "get").mockImplementation(async path => response(path === "/organizations" ? organizations : { users: [identity], total: 1, totalPages: 1 }));
  vi.spyOn(api, "put").mockResolvedValue(response({}));
  vi.spyOn(api, "delete").mockResolvedValue(response({}));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); router.push.mockReset(); router.replace.mockReset(); window.history.replaceState(null, "", "/"); delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView; });

describe("Root organization and identity scope", () => {
  it("loads identities for the URL organization and links membership management to that workspace", async () => {
    window.history.replaceState(null, "", "/dashboard/admin/users?organizationId=org-b");
    mount(<UsersPage />);
    await screen.findAllByText(identity.email);
    expect(userRequests().every(([path]) => new URLSearchParams(String(path).split("?")[1]).get("organizationId") === "org-b")).toBe(true);
    expect(screen.getByRole("link", { name: /Manage organization membership/ })).toHaveAttribute("href", "/dashboard/organizations?organizationId=org-b&section=members");
    fireEvent.click(screen.getAllByRole("button", { name: "Login as" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Start login-as session" });
    expect(within(dialog).getByRole("combobox", { name: "Organization context" })).toHaveTextContent("Willow Clinic");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(useAuthStore.getState().impersonate).toHaveBeenCalledWith({ userId: identity.id, organizationId: "org-b" }));
  });

  it("writes global identity status only after explicit confirmation", async () => {
    window.history.replaceState(null, "", "/dashboard/admin/users?organizationId=org-b");
    mount(<UsersPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Deactivate identity" }))[0]);
    const dialog = screen.getByRole("dialog", { name: "Deactivate global identity?" });
    expect(dialog).toHaveTextContent("Account status applies across all organizations");
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/admin/users/staff-1/status", { isActive: false }));
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("preserves other URL parameters when selecting an organization", async () => {
    window.history.replaceState(null, "", "/dashboard/admin/users?source=directory");
    mount(<UsersPage />);
    await screen.findAllByText(identity.email);
    fireEvent.click(screen.getByRole("combobox", { name: "Filter by organization" }));
    fireEvent.click(await screen.findByRole("option", { name: "Willow Clinic" }));
    expect(router.replace).toHaveBeenCalledWith("/dashboard/admin/users?source=directory&organizationId=org-b", { scroll: false });
  });

  it("does not broaden an unavailable organization into an unscoped identity read", async () => {
    window.history.replaceState(null, "", "/dashboard/admin/users?organizationId=missing");
    mount(<UsersPage />);
    await screen.findByText("Selected organization unavailable");
    expect(userRequests()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Show all organizations" })).toBeInTheDocument();
  });

  it("rejects stale identities after the URL organization changes", async () => {
    let resolveOld!: (value: unknown) => void;
    const old = new Promise(resolve => { resolveOld = resolve; });
    vi.mocked(api.get).mockImplementation(async path => {
      if (path === "/organizations") return response(organizations);
      if (String(path).includes("organizationId=org-a")) return old;
      return response({ users: [{ ...identity, name: "Current Willow user" }], total: 1, totalPages: 1 });
    });
    window.history.replaceState(null, "", "/dashboard/admin/users?organizationId=org-a");
    const view = mount(<UsersPage />);
    await waitFor(() => expect(userRequests()).toHaveLength(1));
    window.history.replaceState(null, "", "/dashboard/admin/users?organizationId=org-b");
    view.rerender(<ToastProvider><UsersPage /></ToastProvider>);
    await screen.findAllByText("Current Willow user");
    await act(async () => resolveOld(response({ users: [{ ...identity, name: "Stale Aurora user" }], total: 100, totalPages: 4 })));
    expect(screen.queryByText("Stale Aurora user")).not.toBeInTheDocument();
  });

  it("denies global identity APIs to an organization admin", async () => {
    useAuthStore.setState({ user: { id: "admin-a", name: "Admin", email: "admin@example.test", role: "admin", organization_id: "org-a", permissions: ["MANAGE_ORGANIZATION"] } });
    mount(<UsersPage />);
    expect(screen.getByText("Restricted")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("ignores a forged organization override for organization administrators", async () => {
    useAuthStore.setState({ user: { id: "admin-a", name: "Admin", email: "admin@example.test", role: "admin", organization_id: "org-a", permissions: ["MANAGE_ORGANIZATION"] } });
    window.history.replaceState(null, "", "/dashboard/organizations?organizationId=org-b");
    mount(<OrganizationsPage />);
    await screen.findByRole("heading", { name: "Aurora Health" });
    expect(screen.queryByRole("heading", { name: "Willow Clinic" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Login as administrator" })).not.toBeInTheDocument();
  });

  it("retains the captured action target when workspace context changes", async () => {
    window.history.replaceState(null, "", "/dashboard/organizations?organizationId=org-a");
    const view = mount(<OrganizationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Suspend organization" }));
    window.history.replaceState(null, "", "/dashboard/organizations?organizationId=org-b");
    view.rerender(<ToastProvider><OrganizationsPage /></ToastProvider>);
    await screen.findByRole("heading", { name: "Willow Clinic" });
    const dialog = screen.getByRole("dialog", { name: "Change organization status?" });
    expect(dialog).toHaveTextContent("Aurora Health");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm status change" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/organizations/org-a", { status: "inactive" }));
  });

  it("discards another organization's unsaved branding draft on context change", async () => {
    window.history.replaceState(null, "", "/dashboard/organizations?organizationId=org-a&section=details");
    const view = mount(<OrganizationsPage />);
    const field = await screen.findByLabelText("Organization name");
    fireEvent.change(field, { target: { value: "Unsaved Aurora draft" } });
    window.history.replaceState(null, "", "/dashboard/organizations?organizationId=org-b&section=details");
    view.rerender(<ToastProvider><OrganizationsPage /></ToastProvider>);
    await waitFor(() => expect(screen.getByLabelText("Organization name")).toHaveValue("Willow Clinic"));
    expect(api.put).not.toHaveBeenCalled();
  });

  it("requires the captured organization name before permanent deletion", async () => {
    window.history.replaceState(null, "", "/dashboard/organizations?organizationId=org-a");
    mount(<OrganizationsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete organization" }));
    const dialog = screen.getByRole("dialog", { name: "Delete organization permanently?" });
    const submit = within(dialog).getByRole("button", { name: "Delete permanently" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Type Aurora Health to confirm"), { target: { value: "Willow Clinic" } });
    expect(submit).toBeDisabled();
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Type Aurora Health to confirm"), { target: { value: "Aurora Health" } });
    fireEvent.click(submit);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/organizations/org-a"));
  });
});
