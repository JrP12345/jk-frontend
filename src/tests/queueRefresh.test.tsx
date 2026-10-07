import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import QueuePage from "@/app/(dashboard)/dashboard/queue/page";
import { ToastProvider } from "@/components/ui/Toast";

const fixture = vi.hoisted(() => ({
  get: vi.fn(), user: { id: "reception", name: "Reception", role: "receptionist", permissions: ["MANAGE_QUEUE", "VIEW_APPOINTMENTS"] },
  locations: [{ id: "clinic", name: "Care Clinic" }], fetchLocations: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: () => ({ activeLocationId: "clinic", fetchLocations: fixture.fetchLocations }) }));
vi.mock("@/hooks/useWorkflowPreferences", () => ({ useWorkflowPreferences: () => ({ preferences: { registration: "essential" } }) }));
vi.mock("@/utils/websocket", () => ({ createReconnectingSocket: () => ({ close: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/dashboard/queue" }));
vi.mock("@/components/ui", async importOriginal => ({ ...await importOriginal<typeof import("@/components/ui")>(), SkeletonCard: () => <div data-testid="queue-loading">Loading queue</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps the existing queue mounted during polling and updates it after the response", async () => {
  let poll: (() => void) | undefined;
  vi.spyOn(globalThis, "setInterval").mockImplementation(((callback: () => void, delay: number) => { if (delay === 15000) poll = callback; return 1; }) as typeof setInterval);
  fixture.fetchLocations.mockResolvedValue(fixture.locations);
  const appointment = { id: "appointment", locationId: "clinic", doctorId: { id: "doctor", name: "Doctor" }, patientId: { id: "patient", gender: "female", userId: { name: "Queue Patient", email: "", phone: "" } }, appointmentTime: new Date().toISOString(), appointmentType: "in_person", status: "checked-in", tokenNumber: 1, queuePosition: 1 };
  let resolveRefresh: ((value: unknown) => void) | undefined;
  let queueReads = 0;
  fixture.get.mockImplementation((url: string) => {
    if (url === "/onboarding/staff") return Promise.resolve({ data: { data: { doctors: [{ id: "doctor", name: "Doctor" }] } } });
    if (url.startsWith("/queue?")) {
      queueReads++;
      if (queueReads > 1) return new Promise(resolve => { resolveRefresh = resolve; });
      return Promise.resolve({ data: { data: [appointment] } });
    }
    return Promise.resolve({ data: { data: url.startsWith("/queue/status") ? { isPaused: false } : [] } });
  });
  render(<ToastProvider><QueuePage /></ToastProvider>);
  const patientRow = (await screen.findAllByText("Queue Patient"))[0];
  expect(screen.queryByTestId("queue-loading")).not.toBeInTheDocument();
  expect(poll).toBeDefined();
  await act(async () => { poll!(); });
  expect(patientRow.isConnected).toBe(true);
  expect(screen.queryByTestId("queue-loading")).not.toBeInTheDocument();
  await act(async () => { resolveRefresh!({ data: { data: [{ ...appointment, patientId: { ...appointment.patientId, userId: { ...appointment.patientId.userId, name: "Updated Patient" } } }] } }); });
  expect(screen.getAllByText("Updated Patient").length).toBeGreaterThan(0);
});
