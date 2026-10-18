import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WhatsAppConnectionPanel from "@/app/(dashboard)/dashboard/settings/WhatsAppConnectionPanel";
import WhatsAppSettingsCard from "@/app/(dashboard)/dashboard/settings/WhatsAppSettingsCard";
import SettingsPage from "@/app/(dashboard)/dashboard/settings/page";
import { OrganizationNotifications } from "@/components/organization/OrganizationConfiguration";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { notificationService } from "@/services/notificationService";
import { whatsappSettingsService } from "@/services/whatsappSettings.service";
import api from "@/lib/api";
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams(window.location.search) }));
const health = { connection: { enabled: true, connectionStatus: "connected", wabaId: "saved-waba", hasToken: true, hasAppSecret: true }, pending: 0, today: [], messages: [], templates: [], issues: [] };
const clients: QueryClient[] = [];
function mount(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><ToastProvider>{element}</ToastProvider></QueryClientProvider>);
}
beforeEach(() => {
  useAuthStore.setState({ user: { id: "root-1", name: "Root", email: "root@example.test", role: "root" }, isAuthenticated: true, isLoading: false });
  vi.spyOn(api, "get").mockResolvedValue({ data: { data: health } });
  vi.spyOn(api, "patch").mockResolvedValue({ data: { message: "Saved" } });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); router.replace.mockReset(); router.push.mockReset(); window.history.replaceState(null, "", "/"); delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView; });

describe("platform messaging ownership", () => {
  it("keeps Root's selected shared organization health scoped to that organization", async () => {
    mount(<WhatsAppConnectionPanel isRoot organizationId="org-a" mode="shared" />);
    await screen.findByText("connected");
    expect(api.get).toHaveBeenCalledWith("/organization/whatsapp/health", { params: { organizationId: "org-a" } });
    expect(screen.queryByLabelText("Platform WABA ID")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save platform credentials" })).not.toBeInTheDocument();
  });

  it("allows shared platform credentials only in explicit Root platform settings", async () => {
    mount(<SettingsPage />);
    const save = await screen.findByRole("button", { name: "Save platform credentials" });
    await waitFor(() => expect(save).toBeEnabled());
    expect(api.get).toHaveBeenCalledWith("/admin/whatsapp/health", { params: undefined });
    fireEvent.change(screen.getByLabelText("Platform WABA ID"), { target: { value: "new-waba" } });
    fireEvent.click(save);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/whatsapp", expect.objectContaining({ enabled: true, wabaId: "new-waba" })));
  });

  it("cannot grant an organization admin platform access through props", async () => {
    useAuthStore.setState({ user: { id: "admin-a", name: "Admin", email: "admin@example.test", role: "admin", organization_id: "org-a" } });
    const view = mount(<WhatsAppConnectionPanel isRoot scope="platform" mode="shared" />);
    expect(view.container).toBeEmptyDOMElement();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("disables platform mutations when saved health cannot be loaded", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Offline"));
    mount(<WhatsAppConnectionPanel isRoot scope="platform" mode="shared" />);
    await screen.findByText(/Could not load connection details/);
    expect(screen.getByRole("button", { name: "Save platform credentials" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save platform credentials" }));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("keeps platform settings scoped to Root and links to the organization workspace", async () => {
    window.history.replaceState(null, "", "/dashboard/settings?organizationId=org-b&tab=billing");
    mount(<SettingsPage />);
    expect(screen.getByRole("link", { name: /Choose an organization/ })).toHaveAttribute("href", "/dashboard/organizations");
    expect(router.replace).not.toHaveBeenCalled();
    expect(api.get).toHaveBeenCalledWith("/admin/whatsapp/health", { params: undefined });
  });

  it("links an organization admin to their signed-in workspace without duplicate editors", () => {
    useAuthStore.setState({ user: { id: "admin-a", name: "Admin", email: "admin@example.test", role: "admin", organization_id: "org-a", permissions: ["MANAGE_ORGANIZATION"] } });
    window.history.replaceState(null, "", "/dashboard/settings?organizationId=org-b");
    mount(<SettingsPage />);
    expect(screen.getByRole("link", { name: /Open your organization/ })).toHaveAttribute("href", "/dashboard/organizations?organizationId=org-a&section=overview");
    expect(screen.queryByLabelText("Organization name")).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("loads Root's own notification preferences without organization credentials", async () => {
    vi.spyOn(notificationService, "getPreferences").mockResolvedValue({ userId: "root-1", channels: { email: false, inApp: true }, categories: { auth: true, organization: true, team: true, task: true, patient: true, billing: true, security: true, system: true } });
    const smtp = vi.spyOn(notificationService, "getSmtpConfig");
    const gateway = vi.spyOn(whatsappSettingsService, "getConfig");
    mount(<OrganizationNotifications isRoot personalOnly />);
    await screen.findByText("Delivery Channels");
    expect(notificationService.getPreferences).toHaveBeenCalledWith();
    expect(smtp).not.toHaveBeenCalled(); expect(gateway).not.toHaveBeenCalled();
    expect(screen.queryByText("Outbound Email Gateway (SMTP)")).not.toBeInTheDocument();
  });

  it("requires preference recovery before showing default save controls", async () => {
    vi.spyOn(notificationService, "getPreferences").mockRejectedValue(new Error("Offline"));
    mount(<OrganizationNotifications isRoot personalOnly />);
    await screen.findByText("Notification preferences unavailable");
    expect(screen.queryByRole("button", { name: /Save Preferences/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry preferences" })).toBeInTheDocument();
  });

  it("shows recovery instead of invented organization credits after a failed settings read", async () => {
    vi.spyOn(whatsappSettingsService, "getConfig").mockRejectedValue(new Error("Offline"));
    mount(<WhatsAppSettingsCard selectedOrgId="org-a" isRoot />);
    await screen.findByText("Organization WhatsApp settings unavailable");
    expect(screen.queryByRole("button", { name: "Save Settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry WhatsApp settings" })).toBeInTheDocument();
  });

  it("uses keyboard tabs to select personal alerts without changing organization scope", async () => {
    mount(<SettingsPage />);
    const tab = screen.getByRole("tab", { name: "WhatsApp" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tab.id);
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    expect(router.replace).toHaveBeenCalledWith("/dashboard/settings?tab=notifications", { scroll: false });
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("saves personal channel and category switches together without writing gateway credentials", async () => {
    window.history.replaceState(null, "", "/dashboard/settings?tab=notifications");
    vi.spyOn(notificationService, "getPreferences").mockResolvedValue({ userId: "root-1", channels: { email: false, inApp: true }, categories: { auth: true, organization: true, team: true, task: true, patient: true, billing: true, security: true, system: true } });
    const save = vi.spyOn(notificationService, "updatePreferences").mockResolvedValue({ userId: "root-1", channels: { email: true, inApp: true }, categories: { auth: true, organization: true, team: true, task: true, patient: true, billing: true, security: false, system: true } });
    mount(<SettingsPage />);
    const email = await screen.findByRole("switch", { name: "Email Notifications" });
    expect(email).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("switch")).toHaveLength(10);
    fireEvent.click(email);
    fireEvent.click(screen.getByRole("switch", { name: "Security" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ channels: { email: true, inApp: true }, categories: expect.objectContaining({ security: false, patient: true }) }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("submits credentials as a form, preserves blank saved secrets, and keeps checks explicit", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { message: "Checked" } });
    mount(<WhatsAppConnectionPanel isRoot scope="platform" mode="shared" />);
    const save = screen.getByRole("button", { name: "Save platform credentials" });
    await waitFor(() => expect(save).toBeEnabled());
    expect(screen.getByLabelText("System user access token")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Meta app secret")).toHaveAttribute("type", "password");
    fireEvent.change(screen.getByLabelText("Platform WABA ID"), { target: { value: " replacement-waba " } });
    fireEvent.submit(save.closest("form")!);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/whatsapp", { enabled: true, wabaId: "replacement-waba", phoneNumberId: undefined, accessToken: undefined, appSecret: undefined }));
    expect(post).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Test connection" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/admin/whatsapp/test", {}, { params: undefined }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sync templates" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Sync templates" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/admin/whatsapp/templates/sync", {}, { params: undefined }));
  });

  it("shows readable template and delivery records and does not invent queued counts after a failed read", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...health, templates: [{ name: "appointment_reminder_for_healthcare_organizations", language: "en_US", status: "APPROVED" }], messages: [{ _id: "message-1", recipientPhone: "+919876543210", createdAt: "2026-10-17T10:00:00Z", status: "failed", errorReason: "Recipient is unavailable" }] } } });
    const view = mount(<WhatsAppConnectionPanel isRoot scope="platform" mode="shared" />);
    const heading = await screen.findByRole("heading", { name: "appointment_reminder_for_healthcare_organizations" });
    const template = heading.closest("article")!;
    expect(within(template).getByText("APPROVED")).toBeInTheDocument();
    view.unmount();
    vi.mocked(api.get).mockRejectedValue(new Error("Offline"));
    mount(<WhatsAppConnectionPanel isRoot scope="platform" mode="shared" />);
    await screen.findByText("Could not load connection details.");
    expect(within(screen.getByLabelText("WhatsApp delivery summary")).getAllByText("\u2014")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sync templates" })).toBeDisabled();
  });
});
