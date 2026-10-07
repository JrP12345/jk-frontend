import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationsPage from "@/app/(dashboard)/dashboard/organizations/page";
import { ThemeProvider, ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganizationAISettings, OrganizationNotifications } from "@/components/organization/OrganizationConfiguration";
import WhatsAppSettingsCard from "@/app/(dashboard)/dashboard/settings/WhatsAppSettingsCard";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }));
const organization = { id: "org-a", name: "Current hospital", city: "Surat", status: "active", isActive: true };
const response = (records: unknown[]) => ({ data: { data: records } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const mount = () => render(<ThemeProvider><ToastProvider><OrganizationsPage /></ToastProvider></ThemeProvider>);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "root", name: "Root", email: "root@test", role: "root" }, isAuthenticated: true, isLoading: false, isLoggingOut: false });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Organization read sequence", () => {
  it("shows the directory skeleton before a successful empty response", async () => {
    const read = deferred<ReturnType<typeof response>>();
    vi.spyOn(api, "get").mockReturnValueOnce(read.promise);
    mount();
    expect(screen.getByRole("status", { name: "Loading organizations" })).toBeInTheDocument();
    expect(screen.queryByText("No organizations yet")).not.toBeInTheDocument();
    await act(async () => read.resolve(response([])));
    expect(await screen.findByText("No organizations yet")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading organizations" })).not.toBeInTheDocument();
  });

  it("retains the directory through a pending or failed refresh", async () => {
    const refresh = deferred<ReturnType<typeof response>>();
    vi.spyOn(api, "get").mockResolvedValueOnce(response([organization])).mockReturnValueOnce(refresh.promise);
    mount();
    expect(await screen.findByText(organization.name)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh organizations" }));
    expect(screen.getByText(organization.name)).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading organizations" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh organizations" })).toBeDisabled();
    await act(async () => refresh.reject(new Error("Connection unavailable")));
    expect(await screen.findByText("Unable to load organizations")).toBeInTheDocument();
    expect(screen.getByText(organization.name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("offers retry instead of treating a failed initial read as an empty directory", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(new Error("Connection unavailable")).mockResolvedValueOnce(response([]));
    mount();
    expect(await screen.findByText("Unable to load organizations")).toBeInTheDocument();
    expect(screen.queryByText("No organizations yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading organizations" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No organizations yet")).toBeInTheDocument();
  });

  it("hides cached directory data while changing the effective account", async () => {
    const next = deferred<ReturnType<typeof response>>();
    const get = vi.spyOn(api, "get").mockResolvedValueOnce(response([organization])).mockReturnValueOnce(next.promise);
    mount();
    expect(await screen.findByText(organization.name)).toBeInTheDocument();
    await act(async () => useAuthStore.setState({ user: { id: "admin-b", name: "Admin", email: "admin@test", role: "admin", organization_id: "org-b", permissions: ["MANAGE_ORGANIZATION"] } }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(organization.name)).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading organizations" })).toBeInTheDocument();
    await act(async () => next.resolve(response([{ ...organization, id: "org-b", name: "Next hospital" }])));
    expect(await screen.findByRole("heading", { name: "Next hospital" })).toBeInTheDocument();
  });

  it("ignores a late response from the previous account", async () => {
    const first = deferred<ReturnType<typeof response>>(), next = deferred<ReturnType<typeof response>>();
    const get = vi.spyOn(api, "get").mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    mount();
    await act(async () => useAuthStore.setState({ user: { id: "admin-b", name: "Admin", email: "admin@test", role: "admin", organization_id: "org-b", permissions: ["MANAGE_ORGANIZATION"] } }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await act(async () => next.resolve(response([{ ...organization, id: "org-b", name: "Next hospital" }])));
    expect(await screen.findByRole("heading", { name: "Next hospital" })).toBeInTheDocument();
    await act(async () => first.resolve(response([organization])));
    expect(screen.getByRole("heading", { name: "Next hospital" })).toBeInTheDocument();
    expect(screen.queryByText(organization.name)).not.toBeInTheDocument();
  });
});

describe("Settings waiting for an organization", () => {
  it.each([
    ["delivery", <OrganizationNotifications key="delivery" isRoot />],
    ["AI", <OrganizationAISettings key="ai" isRoot />],
    ["WhatsApp", <WhatsAppSettingsCard key="whatsapp" isRoot />],
  ])("shows a selection prompt for %s instead of a permanent loader", async (_name, settings) => {
    const get = vi.spyOn(api, "get");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><ToastProvider>{settings}</ToastProvider></QueryClientProvider>);
    expect(await screen.findByText("Choose an organization")).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    client.clear();
  });
});
