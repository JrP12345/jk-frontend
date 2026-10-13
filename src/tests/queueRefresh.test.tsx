import { act, cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import QueuePage from "@/app/(dashboard)/dashboard/queue/page";
import { ToastProvider } from "@/components/ui/Toast";

const fixture = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), user: { id: "reception", name: "Reception", role: "receptionist", organization_id: "org-a", permissions: ["MANAGE_QUEUE", "VIEW_APPOINTMENTS", "COMMUNICATE_PATIENTS"] },
  locations: [{ id: "clinic", name: "Care Clinic" }], fetchLocations: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: () => ({ activeLocationId: "clinic", fetchLocations: fixture.fetchLocations }) }));
vi.mock("@/hooks/useWorkflowPreferences", () => ({ useWorkflowPreferences: () => ({ preferences: { registration: "essential" } }) }));
vi.mock("@/utils/websocket", () => ({ createReconnectingSocket: () => ({ close: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/dashboard/queue" }));
vi.mock("@/components/ui", async importOriginal => ({ ...await importOriginal<typeof import("@/components/ui")>(), SkeletonCard: () => <div data-testid="queue-loading">Loading queue</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('requires the shared arrival confirmation before calling a booked patient', async () => {
  fixture.fetchLocations.mockResolvedValue(fixture.locations);
  fixture.get.mockImplementation(async url => ({ data: { data: String(url) === '/onboarding/staff'
    ? { doctors: [{ id: 'doctor', name: 'Doctor' }] } : String(url).startsWith('/queue/status') ? { isPaused: false } : [] } }));
  fixture.post.mockReset();
  const missingArrival = { response: { data: { error: 'ARRIVAL_CONFIRMATION_REQUIRED', data: { id: 'booked', tokenNumber: 7 } } } };
  fixture.post.mockRejectedValueOnce(missingArrival).mockRejectedValueOnce(missingArrival)
    .mockResolvedValue({ data: { data: null, message: 'No waiting patients' } });
  render(<ToastProvider><QueuePage /></ToastProvider>);
  const callNext = await screen.findByRole('button', { name: 'Call Next' });
  await waitFor(() => expect(callNext).toBeEnabled());
  fireEvent.click(callNext);
  expect(await screen.findByRole('dialog', { name: 'Confirm booked patient arrival' })).toHaveTextContent('Token #7');
  expect(fixture.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  expect(fixture.post).toHaveBeenCalledTimes(1);
  fireEvent.click(callNext);
  await screen.findByRole('dialog', { name: 'Confirm booked patient arrival' });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm arrival and call' }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(3));
  expect(fixture.post.mock.calls[2]).toEqual(['/queue/call-next', expect.objectContaining({ confirmedAppointmentId: 'booked', requireArrivalConfirmation: true })]);
});

it('shows the canonical patient in the clinical queue and completion dialog without a login account', async () => {
  const originalRole = fixture.user.role;
  fixture.user.role = 'doctor';
  fixture.get.mockImplementation(async path => {
    const url = String(path);
    if (url.includes('/assignments')) return { data: { data: [{ doctorId: { id: 'doctor', name: 'Clinician' } }] } };
    if (url.startsWith('/queue?')) return { data: { data: [{ id: 'visit', patientId: { id: 'canonical', name: 'Canonical bedside patient' }, doctorId: { id: 'doctor', name: 'Clinician' }, status: 'in-consultation', tokenNumber: 8, appointmentTime: new Date().toISOString() }] } };
    return { data: { data: url.startsWith('/queue/status') ? { isPaused: false } : [] } };
  });
  try {
    render(<ToastProvider><QueuePage /></ToastProvider>);
    await screen.findAllByText('Canonical bedside patient');
    fireEvent.click(screen.getByRole('button', { name: 'Conclude Visit' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Canonical bedside patient');
    expect(screen.queryByText('Patient Record')).not.toBeInTheDocument();
  } finally { fixture.user.role = originalRole; }
});

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

it("freezes an uncertain tracker request across close/reopen and uses its original identifier", async () => {
  fixture.fetchLocations.mockResolvedValue(fixture.locations);
  fixture.post.mockReset().mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce({ data: { data: { status: "pending" }, message: "Message queued; delivery is reported separately" } });
  const appointment = { id: "tracker-appointment", locationId: "clinic", doctorId: { id: "doctor", name: "Doctor" }, patientId: { id: "patient", name: "Tracker Patient", phone: "+919876543210", userId: { name: "Tracker Patient" } }, appointmentTime: new Date().toISOString(), appointmentType: "in_person", status: "checked-in", tokenNumber: 2, queuePosition: 2 };
  fixture.get.mockImplementation((url: string) => Promise.resolve({ data: { data: url === "/onboarding/staff" ? { doctors: [{ id: "doctor", name: "Doctor" }] } : url.startsWith("/queue?") ? [appointment] : url.startsWith("/queue/status") ? { isPaused: false } : [] } }));
  render(<ToastProvider><QueuePage /></ToastProvider>);
  fireEvent.click((await screen.findAllByTitle("Queue live tracking link via WhatsApp"))[0]);
  fireEvent.click(screen.getByRole("button", { name: "Queue Live Tracker" }));
  const error = await screen.findByText("The result could not be confirmed. Retry the same submitted request.");
  expect(error.closest("[tabindex]" )).toHaveFocus();
  expect(screen.getByPlaceholderText("+919876543210")).toBeDisabled();
  const original = fixture.post.mock.calls[0][1];
  expect(original.clientRequestId).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  fireEvent.click(screen.getAllByTitle("Queue live tracking link via WhatsApp")[0]);
  fireEvent.click(screen.getByRole("button", { name: "Retry submitted tracker" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(2));
  expect(fixture.post.mock.calls[1][1]).toEqual(original);
  expect(await screen.findByText("Tracker message pending")).toBeInTheDocument();
});

it("hides tracker dispatch when current communication authority is absent", async () => {
  const previous = fixture.user.permissions;
  fixture.user.permissions = ['MANAGE_QUEUE', 'VIEW_APPOINTMENTS'];
  try {
    render(<ToastProvider><QueuePage /></ToastProvider>);
    await screen.findAllByText('Tracker Patient');
    expect(screen.queryByTitle('Queue live tracking link via WhatsApp')).not.toBeInTheDocument();
  } finally { fixture.user.permissions = previous; }
});
it("discards pending tracker UI and its eventual toast when the workspace changes", async () => {
  let finish: ((value: unknown) => void) | undefined;
  fixture.post.mockReset().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<ToastProvider><QueuePage /></ToastProvider>);
  fireEvent.click((await screen.findAllByTitle('Queue live tracking link via WhatsApp'))[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Queue Live Tracker' }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(1));
  const original = fixture.user.organization_id; fixture.user.organization_id = 'org-b';
  try {
    view.rerender(<ToastProvider><QueuePage /></ToastProvider>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => { finish!({ data: { data: { status: 'pending' } } }); });
    expect(screen.queryByText('Tracker message pending')).not.toBeInTheDocument();
  } finally { fixture.user.organization_id = original; }
});
