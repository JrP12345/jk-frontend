import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { OrganizationWorkflowPreferences } from "@/components/organization/OrganizationWorkflowPreferences";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { announcePatientToken } from "@/utils/audioChimes";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock("@/utils/audioChimes", async importOriginal => ({ ...await importOriginal<typeof import("@/utils/audioChimes")>(), announcePatientToken: vi.fn() }));
let client: QueryClient;
let saved: { registration: string; consultation: string; currency: string; queueChime: string; queueVoiceLanguage: string };
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
beforeEach(() => {
  vi.clearAllMocks();
  saved = { registration: "full", consultation: "full", currency: "INR", queueChime: "bell", queueVoiceLanguage: "en" };
  useAuthStore.getState().login({ id: "admin", name: "Admin", email: "admin@test", role: "admin", organization_id: "org-a", permissions: ["MANAGE_ORGANIZATION"] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.mocked(api.get).mockImplementation(async () => ({ data: { data: { ...saved } } }));
  vi.mocked(api.put).mockImplementation(async (_path, body) => { Object.assign(saved, body.workflowPreferences); return { data: { data: {} } }; });
});
afterEach(() => { cleanup(); client.clear(); });
function mount(organizationId = "org-a") {
  return render(<QueryClientProvider client={client}><ToastProvider><OrganizationWorkflowPreferences organizationId={organizationId} /></ToastProvider></QueryClientProvider>);
}
async function select(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option, exact: true }));
}

it("saves organization sound preferences without changing the clinical workflow and reloads them", async () => {
  mount();
  await screen.findByRole("combobox", { name: "Bell sound" });
  await select("Bell sound", "Mute / Silent Mode");
  fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith("/onboarding/organization/me?organizationId=org-a", { workflowPreferences: { queueChime: "mute" } }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save preferences" })).toBeDisabled());
  expect(screen.getByRole("combobox", { name: "Bell sound" })).toHaveTextContent("Mute / Silent Mode");
  expect(saved).toMatchObject({ registration: "full", consultation: "full", queueVoiceLanguage: "en" });
});

it("previews the chosen language on this device without saving or sending a notification", async () => {
  mount();
  await screen.findByRole("combobox", { name: "Announcement language" });
  await select("Announcement language", "English and Hindi");
  fireEvent.click(screen.getByRole("button", { name: "Preview announcement" }));
  expect(announcePatientToken).toHaveBeenCalledWith({ tokenNumber: 1, language: "both", chimeType: "bell" });
  expect(api.put).not.toHaveBeenCalled();
});

it("keeps root announcement edits scoped to the selected organization", async () => {
  useAuthStore.getState().login({ id: "root", name: "Root", email: "root@test", role: "root", permissions: [] });
  mount("org-b");
  await screen.findByRole("combobox", { name: "Announcement language" });
  await select("Announcement language", "Voice off");
  fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith("/onboarding/organization/me?organizationId=org-b", { workflowPreferences: { queueVoiceLanguage: "off" } }));
  expect(api.get).toHaveBeenCalledWith("/onboarding/organization/preferences?organizationId=org-b", expect.anything());
});
