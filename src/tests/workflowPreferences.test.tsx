import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }));
const initial = { id: "staff", role: "admin" as const, organization_id: "org-a", name: "Staff", email: "staff@test", permissions: ["MANAGE_ORGANIZATION"] };
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().login(initial);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => client.clear());
function Preferences({ name, organizationId }: { name: string; organizationId?: string }) {
  const { preferences, loading, error, reload } = useWorkflowPreferences(organizationId);
  return <div aria-label={name}>{loading ? "Loading" : error ? "Failed" : `${preferences.registration}:${preferences.consultation}:${preferences.currency}`}<button onClick={reload}>Retry {name}</button></div>;
}
function mount() { return render(<QueryClientProvider client={client}><Preferences name="layout" /><Preferences name="daily-work" /></QueryClientProvider>); }

it("shares one scoped preference read across layout and daily work and broadcasts manual reloads", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { registration: "essential", consultation: "focused", currency: "USD" } } });
  mount();
  await waitFor(() => expect(screen.getAllByText("essential:focused:USD")).toHaveLength(2));
  expect(api.get).toHaveBeenCalledOnce();
  vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { registration: "full", consultation: "full", currency: "INR" } } });
  await act(async () => screen.getByRole("button", { name: "Retry layout" }).click());
  await waitFor(() => expect(screen.getAllByText("full:full:INR")).toHaveLength(2));
  expect(api.get).toHaveBeenCalledTimes(2);
});

it("does not show or accept the previous workspace's preferences while the new read is pending", async () => {
  let resolveOld!: (response: unknown) => void, resolveNew!: (response: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve; }));
  mount();
  act(() => useAuthStore.getState().login({ ...initial, organization_id: "org-b" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => resolveOld({ data: { data: { registration: "essential", consultation: "focused" } } }));
  expect(screen.queryByText("essential:focused:INR")).not.toBeInTheDocument();
  await act(async () => resolveNew({ data: { data: { registration: "full", consultation: "full", currency: "USD" } } }));
  await waitFor(() => expect(screen.getAllByText("full:full:USD")).toHaveLength(2));
});

it("retries a failed read and excludes consumer sessions", async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { data: { registration: "essential" } } });
  mount();
  await waitFor(() => expect(screen.getAllByText("Failed")).toHaveLength(2));
  await act(async () => screen.getByRole("button", { name: "Retry daily-work" }).click());
  await waitFor(() => expect(screen.getAllByText("essential:full:INR")).toHaveLength(2));
  act(() => useAuthStore.getState().login({ ...initial, role: "family_member" }));
  expect(screen.getAllByText("full:full:INR")).toHaveLength(2);
  expect(api.get).toHaveBeenCalledTimes(2);
});

it("keeps ROOT selected-organization reads separate", async () => {
  useAuthStore.getState().login({ ...initial, role: "root", organization_id: undefined });
  vi.mocked(api.get).mockImplementation(async path => ({ data: { data: { currency: String(path).includes("org-b") ? "USD" : "INR" } } }));
  render(<QueryClientProvider client={client}><Preferences name="A" organizationId="org-a" /><Preferences name="B" organizationId="org-b" /></QueryClientProvider>);
  await screen.findByText("full:full:USD");
  expect(screen.getByText("full:full:INR")).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(2);
});
