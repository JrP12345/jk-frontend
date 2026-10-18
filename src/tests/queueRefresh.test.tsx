import { act, cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import QueuePage from "@/app/(dashboard)/dashboard/queue/page";
import { ToastProvider } from "@/components/ui/Toast";

const fixture = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), user: { id: "reception", name: "Reception", role: "receptionist", organization_id: "org-a", permissions: ["MANAGE_QUEUE", "VIEW_APPOINTMENTS", "COMMUNICATE_PATIENTS"] },
  locations: [{ id: "clinic", name: "Care Clinic" }], fetchLocations: vi.fn(),
  preferences: { registration: "essential", queueChime: "bell", queueVoiceLanguage: "en" },
  announce: vi.fn(), push: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post, put: fixture.put } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: () => ({ activeLocationId: "clinic", fetchLocations: fixture.fetchLocations }) }));
vi.mock("@/hooks/useWorkflowPreferences", () => ({ useWorkflowPreferences: () => ({ preferences: fixture.preferences }) }));
vi.mock("@/utils/audioChimes", async importOriginal => ({ ...await importOriginal<typeof import("@/utils/audioChimes")>(), announcePatientToken: fixture.announce, playChimeSound: vi.fn() }));
vi.mock("@/utils/websocket", () => ({ createReconnectingSocket: () => ({ close: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fixture.push }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/dashboard/queue" }));
vi.mock("@/components/ui", async importOriginal => ({ ...await importOriginal<typeof import("@/components/ui")>(), SkeletonCard: () => <div data-testid="queue-loading">Loading queue</div> }));
beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openTracker() {
  fireEvent.click((await screen.findAllByRole("button", { name: "More patient actions" }))[0]);
  fireEvent.click(await screen.findByRole("menuitem", { name: "Send live tracker" }));
}

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
  await openTracker();
  fireEvent.click(screen.getByRole("button", { name: "Queue Live Tracker" }));
  const error = await screen.findByText("The result could not be confirmed. Retry the same submitted request.");
  expect(error.closest("[tabindex]" )).toHaveFocus();
  expect(screen.getByPlaceholderText("+919876543210")).toBeDisabled();
  const original = fixture.post.mock.calls[0][1];
  expect(original.clientRequestId).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  await openTracker();
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
    fireEvent.click(screen.getAllByRole("button", { name: "More patient actions" })[0]);
    expect(screen.queryByRole("menuitem", { name: "Send live tracker" })).not.toBeInTheDocument();
  } finally { fixture.user.permissions = previous; }
});
it("discards pending tracker UI and its eventual toast when the workspace changes", async () => {
  let finish: ((value: unknown) => void) | undefined;
  fixture.post.mockReset().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<ToastProvider><QueuePage /></ToastProvider>);
  await openTracker();
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

function queueFixture(sessionStatus = "not_started") {
  const appointment = (id: string, name: string, tokenNumber: number, status = "checked-in") => ({
    id, locationId: "clinic", doctorId: { id: "doctor", name: "Doctor" },
    patientId: { id: `patient-${id}`, name, phone: `98765432${tokenNumber}`, gender: "female" },
    appointmentTime: new Date().toISOString(), appointmentType: "in_person", status, tokenNumber,
    queuePosition: tokenNumber, paymentStatus: "paid",
  });
  const patients = [appointment("a", "Ananya Shah", 11), appointment("b", "Bina Patel", 12), appointment("c", "Chitra Rao", 13), appointment("parked", "Deepa Mehta", 14, "standby"), appointment("done", "Esha Desai", 15, "completed")];
  fixture.fetchLocations.mockResolvedValue(fixture.locations);
  fixture.put.mockReset().mockResolvedValue({ data: { data: {} } });
  fixture.get.mockImplementation(async (url: string) => ({ data: { data: url === "/onboarding/staff" ? { doctors: [{ id: "doctor", name: "Doctor" }, { id: "other-doctor", name: "Other Doctor" }] } : url.startsWith("/queue?") ? patients : url.startsWith("/queue/status") ? { isPaused: false, opdSession: { status: sessionStatus } } : url.startsWith("/appointments/follow-ups") ? { items: [], metrics: { totalCount: 0, dueTodayCount: 0, upcomingCount: 0, overdueCount: 0 } } : [] } }));
  return patients;
}

it("opens patient actions without replacing the card and closes the menu before opening standby", async () => {
  queueFixture();
  fixture.post.mockReset();
  render(<ToastProvider><QueuePage /></ToastProvider>);
  const card = (await screen.findByText("Ananya Shah")).closest('[class*="patientCard"]') as HTMLElement;
  const trigger = within(card).getByRole("button", { name: "More patient actions" });
  fireEvent.click(trigger);
  expect(await screen.findByRole("menuitem", { name: "Move up" })).toBeDisabled();
  fireEvent.click(screen.getByRole("menuitem", { name: "Move to standby" }));
  expect(await screen.findByRole("dialog", { name: "Move Token #11 to Standby" })).toBeInTheDocument();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(card.isConnected).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  expect(fixture.post).not.toHaveBeenCalled();
});

it("shows a single doctor and location as context while keeping the queue date editable", async () => {
  queueFixture();
  const read = fixture.get.getMockImplementation()!;
  fixture.get.mockImplementation((url: string) => url === "/onboarding/staff" ? Promise.resolve({ data: { data: { doctors: [{ id: "doctor", name: "Doctor" }] } } }) : read(url));
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Ananya Shah");
  const scope = screen.getByRole("region", { name: "Queue selection" });
  expect(scope).toHaveTextContent("Care Clinic");
  expect(scope).toHaveTextContent("Doctor");
  expect(within(scope).queryByRole("combobox")).not.toBeInTheDocument();
  expect(within(scope).queryByRole("button", { name: "Change queue filters" })).not.toBeInTheDocument();
  const changeDate = within(scope).getByRole("button", { name: "Change queue date" });
  fireEvent.click(changeDate);
  expect(changeDate).toHaveAttribute("aria-expanded", "true");
  const datePicker = within(scope).getByRole("button", { name: "Queue date", exact: true });
  expect(datePicker).toBeEnabled();
  fireEvent.click(datePicker);
  expect(datePicker).toHaveAttribute("aria-expanded", "true");
  expect(await screen.findByRole("button", { name: "Next Month" })).toBeInTheDocument();
});

it("offers only the location selector when several locations share one doctor", async () => {
  queueFixture();
  fixture.fetchLocations.mockResolvedValue([...fixture.locations, { id: "branch", name: "Branch Clinic" }]);
  const read = fixture.get.getMockImplementation()!;
  fixture.get.mockImplementation((url: string) => url === "/onboarding/staff" ? Promise.resolve({ data: { data: { doctors: [{ id: "doctor", name: "Doctor" }] } } }) : read(url));
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Ananya Shah");
  fireEvent.click(screen.getByRole("button", { name: "Change queue filters" }));
  expect(screen.queryByRole("combobox", { name: "Doctor" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
  fireEvent.click(await screen.findByRole("option", { name: "Branch Clinic" }));
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith(expect.stringMatching(/\/queue\?.*locationId=branch/), expect.anything()));
});

it("searches canonical patient names, phone numbers and tokens across the queue tabs", async () => {
  queueFixture();
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Ananya Shah");
  const search = screen.getByRole("searchbox", { name: "Find patient in queue" });
  fireEvent.change(search, { target: { value: "bina" } });
  expect(screen.getByText("Bina Patel")).toBeInTheDocument();
  expect(screen.queryByText("Ananya Shah")).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: "9876543213" } });
  expect(screen.getByText("Chitra Rao")).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "#11" } });
  expect(screen.getByText("Ananya Shah")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Standby" }));
  expect(search).toHaveValue("");
  expect(screen.getByText("Deepa Mehta")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Processed" }));
  expect(screen.getByText("Esha Desai")).toBeInTheDocument();
  expect(screen.queryByText("Deepa Mehta")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Recalls" }));
  expect(await screen.findByText("No Follow-Up Records Found")).toBeInTheDocument();
  expect(screen.queryByRole("searchbox", { name: "Find patient in queue" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Call Next" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Queue controls" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Queue summary")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Queue tools" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("tab", { name: "Queue", exact: true }));
  expect(screen.getByRole("button", { name: "Call Next" })).toBeInTheDocument();
  expect(screen.getByLabelText("Queue summary")).toBeInTheDocument();
});

it("preserves the original queue position when a filtered patient is moved up", async () => {
  queueFixture();
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Chitra Rao");
  fireEvent.change(screen.getByRole("searchbox", { name: "Find patient in queue" }), { target: { value: "Chitra" } });
  fireEvent.click(screen.getByRole("button", { name: "More patient actions" }));
  const moveUp = await screen.findByRole("menuitem", { name: "Move up" });
  expect(moveUp).toBeEnabled();
  fireEvent.click(moveUp);
  await waitFor(() => expect(fixture.put).toHaveBeenCalledWith("/queue/reorder", expect.objectContaining({ orderedAppointmentIds: ["a", "c", "b"], doctorId: "doctor", locationId: "clinic" })));
});

it("disables calling and hides prior patients when a newly selected doctor's queue fails", async () => {
  queueFixture();
  const read = fixture.get.getMockImplementation()!;
  let reject: ((error: Error) => void) | undefined;
  fixture.get.mockImplementation((url: string) => url.startsWith("/queue?") && url.includes("doctorId=other-doctor") ? new Promise((_resolve, fail) => { reject = fail; }) : read(url));
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Ananya Shah");
  expect(screen.getByRole("button", { name: "Call Next" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Change queue filters" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Doctor" }));
  fireEvent.click(await screen.findByRole("option", { name: "Dr. Other Doctor" }));
  expect(screen.getByRole("button", { name: "Call Next" })).toBeDisabled();
  expect(screen.queryByText("Ananya Shah")).not.toBeInTheDocument();
  await waitFor(() => expect(reject).toBeDefined());
  await act(async () => { reject!(new Error("offline")); });
  expect(await screen.findByText("Queue information is unavailable for this selection. Refresh to retry.")).toBeInTheDocument();
  expect(screen.queryByText("Ananya Shah")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Call Next" })).toBeDisabled();
});

it("keeps critical vitals and emergency escalation visible with supporting actions collapsed", async () => {
  const patients = queueFixture();
  Object.assign(patients[0], { vitals: { spO2: 88, bpSystolic: 182, bpDiastolic: 115 } });
  render(<ToastProvider><QueuePage /></ToastProvider>);
  expect(await screen.findByText(/Critical Vitals MEWS Alert/i)).toBeVisible();
  expect(screen.getByRole("button", { name: "Escalate to STAT Next" })).toBeVisible();
  expect(screen.getAllByRole("button", { name: "More patient actions" })[0]).toHaveAttribute("aria-expanded", "false");
  expect(fixture.post).not.toHaveBeenCalledWith(expect.stringContaining("emergency"), expect.anything());
});

it("omits empty vitals and keeps partial measurements readable with recording actions available", async () => {
  const patients = queueFixture();
  Object.assign(patients[0], { vitals: {} });
  Object.assign(patients[1], { vitals: { pulse: 76, bpSystolic: 128 } });
  render(<ToastProvider><QueuePage /></ToastProvider>);
  const emptyCard = (await screen.findByText("Ananya Shah")).closest('[class*="patientCard"]') as HTMLElement;
  expect(within(emptyCard).queryByLabelText("Recorded vitals")).not.toBeInTheDocument();
  fireEvent.click(within(emptyCard).getByRole("button", { name: "More patient actions" }));
  expect(await screen.findByRole("menuitem", { name: "Record vitals" })).toBeEnabled();
  const partialCard = screen.getByText("Bina Patel").closest('[class*="patientCard"]') as HTMLElement;
  const measurements = within(partialCard).getByLabelText("Recorded vitals");
  expect(measurements).toHaveTextContent("HR76 bpm");
  expect(measurements).toHaveTextContent("128/—");
  expect(measurements).not.toHaveTextContent("SpO₂");
  expect(measurements).not.toHaveTextContent("Temp");
  expect(within(partialCard).getByRole("button", { name: "Edit Vitals" })).toBeEnabled();
});

it("uses saved organization announcements instead of a browser's previous bell choice", async () => {
  queueFixture();
  const previous = { ...fixture.preferences };
  fixture.preferences.queueChime = "mute";
  fixture.preferences.queueVoiceLanguage = "hi";
  fixture.announce.mockClear();
  localStorage.setItem("ekavyu_queue_chime_sound", "gong");
  try {
    render(<ToastProvider><QueuePage /></ToastProvider>);
    await screen.findByText("Ananya Shah");
    fireEvent.click(screen.getAllByRole("button", { name: "Call In", exact: true })[0]);
    expect(fixture.announce).toHaveBeenCalledWith(expect.objectContaining({ tokenNumber: 11, chimeType: "mute", language: "hi" }));
    expect(screen.queryByRole("combobox", { name: "Queue chime" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Voice announcement language" })).not.toBeInTheDocument();
  } finally { Object.assign(fixture.preferences, previous); localStorage.removeItem("ekavyu_queue_chime_sound"); }
});

it("lists tools individually, closes the menu on selection and links admins to organization settings", async () => {
  queueFixture();
  const previous = fixture.user.permissions;
  fixture.user.permissions = [...previous, "MANAGE_ORGANIZATION"];
  try {
    render(<ToastProvider><QueuePage /></ToastProvider>);
    await screen.findByText("Ananya Shah");
    const trigger = screen.getByRole("button", { name: "Queue tools" });
    fireEvent.click(trigger);
    const items = await screen.findAllByRole("menuitem");
    expect(items.map(item => item.textContent)).toEqual(["Refresh queue", "Availability", "Preview poster", "ABHA registration", "Certificates", "Start OPD", "Announcement settings"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Availability" }));
    expect(await screen.findByRole("dialog", { name: "Doctor availability" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Announcement settings" }));
    expect(fixture.push).toHaveBeenCalledWith("/dashboard/organizations?organizationId=org-a&section=configuration");
  } finally { fixture.user.permissions = previous; }
});

it("opens the break dialog from the session menu without ending or mutating the queue", async () => {
  queueFixture("active");
  fixture.post.mockReset();
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Ananya Shah");
  fireEvent.click(screen.getByRole("button", { name: "Session", exact: true }));
  expect(await screen.findByRole("menuitem", { name: "End OPD and reconcile" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Take break" }));
  expect(await screen.findByRole("dialog", { name: /Take a break/ })).toBeInTheDocument();
  expect(fixture.post).not.toHaveBeenCalled();
});

it("keeps navigation and search mounted while a different queue loads", async () => {
  queueFixture();
  const read = fixture.get.getMockImplementation()!;
  let finish: ((response: unknown) => void) | undefined;
  fixture.get.mockImplementation((url: string) => url.startsWith("/queue?") && url.includes("doctorId=other-doctor") ? new Promise(resolve => { finish = resolve; }) : read(url));
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Ananya Shah");
  const tabs = screen.getByRole("tablist");
  const search = screen.getByRole("searchbox", { name: "Find patient in queue" });
  fireEvent.click(screen.getByRole("button", { name: "Change queue filters" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Doctor" }));
  fireEvent.click(await screen.findByRole("option", { name: "Dr. Other Doctor" }));
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.getByRole("tablist")).toBe(tabs);
  expect(screen.getByRole("searchbox", { name: "Find patient in queue" })).toBe(search);
  expect(screen.queryByText("Ananya Shah")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Call Next" })).toBeDisabled();
  await act(async () => { finish!({ data: { data: [] } }); });
  expect(screen.getByRole("tablist")).toBe(tabs);
  expect(screen.getByRole("searchbox", { name: "Find patient in queue" })).toBe(search);
});

it("keeps the tab navigation mounted and focused when changing views", async () => {
  queueFixture();
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Ananya Shah");
  const tabs = screen.getByRole("tablist");
  const recalls = screen.getByRole("tab", { name: "Recalls" });
  recalls.focus();
  fireEvent.click(recalls);
  expect(screen.getByRole("tablist")).toBe(tabs);
  expect(recalls).toHaveFocus();
  await screen.findByRole("group", { name: "Follow-up filters" });
  fireEvent.click(screen.getByRole("button", { name: "Queue tools" }));
  expect(await screen.findByRole("menuitem", { name: "Refresh queue" })).toBeInTheDocument();
});

it("starts OPD from the queue tools menu using the selected location and doctor", async () => {
  queueFixture();
  fixture.post.mockReset().mockResolvedValue({ data: { data: {} } });
  render(<ToastProvider><QueuePage /></ToastProvider>);
  await screen.findByText("Ananya Shah");
  fireEvent.click(screen.getByRole("button", { name: "Queue tools" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Start OPD" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/queue/session/start", { locationId: "clinic", doctorId: "doctor" }));
  expect(fixture.post).toHaveBeenCalledTimes(1);
});
