import { datePickerInput } from "./datePickerTestUtils";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AppointmentsPage from "@/app/(dashboard)/dashboard/appointments/page";
import { ToastProvider } from "@/components/ui/Toast";

const fixture = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), remove: vi.fn(), push: vi.fn(), fetchLocations: vi.fn(),
  user: { id: "desk", role: "receptionist", organization_id: "org", permissions: ["VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS"] },
}));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post, put: fixture.put, patch: fixture.patch, delete: fixture.remove } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: () => ({ activeLocationId: "clinic", locations: [{ id: "clinic", name: "Care Clinic", effectiveTimezone: "Asia/Kolkata" }], fetchLocations: fixture.fetchLocations }) }));
vi.mock("@/hooks/useWorkflowPreferences", () => ({ useWorkflowPreferences: () => ({ preferences: { registration: "full" } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fixture.push }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/dynamic", async () => {
  const { AppointmentCalendarView } = await import("@/components/clinical/AppointmentCalendarView");
  return { default: (loader: () => unknown) => String(loader).includes("AppointmentCalendarView") ? AppointmentCalendarView : () => null };
});

const doctor = { id: "doctor", name: "Assigned Doctor" };
const patient = { id: "patient", name: "Registered patient", phone: "9876543210" };
const visit = { id: "visit", patientId: patient, doctorId: doctor, locationId: { id: "clinic", name: "Care Clinic" }, status: "confirmed", tokenNumber: 12, appointmentTime: new Date().toISOString(), appointmentType: "reception" };
const response = (data: unknown) => ({ data: { data }, headers: { "x-total-count": "1", "x-total-pages": "1" } });
function defaultGet(url: string) {
  return Promise.resolve(response(url.startsWith("/appointments?") ? [visit] : url === "/onboarding/staff" ? { doctors: [doctor] } : url.includes("/assignments") ? [{ doctorId: doctor }] : url.includes("/slots?") ? { bookingMode: "sequential_queue", slots: [] } : url.startsWith("/patients?") ? [patient] : {}));
}
function mount() { return render(<ToastProvider><AppointmentsPage /></ToastProvider>); }
async function options(label: string) {
  fireEvent.click((await screen.findAllByRole("button", { name: "Options for Registered patient" }))[0]);
  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
}
async function bookingSchedule() {
  fireEvent.click(screen.getByRole("button", { name: "New booking" }));
  const dialog = await screen.findByRole("dialog", { name: "New appointment" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Search patients by name, email or mobile" }), { target: { value: "Registered" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Search", exact: true }));
  fireEvent.click(await within(dialog).findByRole("button", { name: "Select", exact: true }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Continue" })).toBeEnabled());
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  return dialog;
}
beforeEach(() => {
  fixture.user.role = "receptionist"; fixture.user.permissions = ["VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS"];
  fixture.get.mockReset().mockImplementation(defaultGet); fixture.post.mockReset().mockResolvedValue(response({ tokenNumber: 13 }));
  fixture.put.mockReset().mockResolvedValue(response({})); fixture.patch.mockReset().mockResolvedValue(response({}));
  fixture.remove.mockReset().mockResolvedValue(response({}));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps the toolbar and existing appointment mounted during a background refresh", async () => {
  let refresh: (() => void) | undefined;
  const interval = window.setInterval.bind(window);
  vi.spyOn(window, "setInterval").mockImplementation((handler, timeout, ...args) => {
    if (timeout === 15000) refresh = handler as () => void;
    return interval(handler, timeout, ...args);
  });
  mount();
  const card = (await screen.findAllByText(patient.name))[0].closest("article");
  const search = screen.getByRole("searchbox", { name: "Search all appointments" });
  let finish!: (data: unknown) => void;
  fixture.get.mockImplementation(url => url.startsWith("/appointments?") ? new Promise(resolve => { finish = resolve; }) : defaultGet(url));
  await act(async () => refresh?.());
  expect(card?.isConnected).toBe(true); expect(search.isConnected).toBe(true);
  expect(screen.queryByText("No appointments found")).not.toBeInTheDocument();
  await act(async () => finish(response([visit])));
  expect(card?.isConnected).toBe(true);
});

it("hides the previous result immediately after changing search and provides recovery on failure", async () => {
  mount(); await screen.findAllByText(patient.name);
  fixture.get.mockImplementation(url => url.startsWith("/appointments?") ? Promise.reject(new Error("offline")) : defaultGet(url));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search all appointments" }), { target: { value: "another patient" } });
  expect(screen.queryByText(patient.name)).not.toBeInTheDocument();
  expect(screen.queryByText("No appointments found")).not.toBeInTheDocument();
  await screen.findByText("Unable to load appointments");
  fixture.get.mockImplementation(defaultGet);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect((await screen.findAllByText(patient.name)).length).toBeGreaterThan(0);
});

it("requests the actual visible calendar range when navigating weeks", async () => {
  mount(); await screen.findAllByText(patient.name);
  fireEvent.click(screen.getByRole("button", { name: "Calendar", exact: true }));
  fireEvent.click(await screen.findByRole("button", { name: "week", exact: true }));
  await waitFor(() => expect(fixture.get.mock.calls.some(([url]) => url.includes("startDate=") && url.includes("endDate="))).toBe(true));
  const original = fixture.get.mock.calls.filter(([url]) => url.startsWith("/appointments?")).at(-1)![0];
  fireEvent.click(screen.getByRole("button", { name: /Next/ }));
  await waitFor(() => expect(fixture.get.mock.calls.filter(([url]) => url.startsWith("/appointments?")).at(-1)![0]).not.toBe(original));
  expect(screen.getByRole("button", { name: "week" })).toHaveAttribute("aria-pressed", "true");
});

it("does not offer administrative status changes to a patient", async () => {
  fixture.user.role = "patient"; fixture.user.permissions = [];
  mount(); await screen.findAllByText(patient.name);
  fireEvent.click(screen.getByRole("button", { name: "Options for Registered patient" }));
  expect(screen.queryByRole("menuitem", { name: "Mark Checked-In" })).not.toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Record no-show" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "New booking" })).not.toBeInTheDocument();
});

it("submits the pinned booking action with the chosen patient and facility time zone", async () => {
  mount(); const dialog = await bookingSchedule();
  const confirm = within(dialog).getByRole("button", { name: "Confirm booking" });
  await waitFor(() => expect(confirm).toBeEnabled());
  expect((confirm as HTMLButtonElement).form?.id).toBe("appointment-booking");
  fireEvent.click(confirm);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/appointments", expect.objectContaining({ locationId: "clinic", doctorId: "doctor", patientId: "patient", appointmentType: "reception", appointmentTime: expect.stringMatching(/T18:30:00\.000Z$/) })));
  expect(fixture.post).toHaveBeenCalledTimes(1);
});

it("fails closed while availability loads and when it cannot be fetched", async () => {
  let fail!: (error: unknown) => void;
  fixture.get.mockImplementation(url => url.includes("/slots?") ? new Promise((_resolve, reject) => { fail = reject; }) : defaultGet(url));
  mount(); const dialog = await bookingSchedule();
  const confirm = within(dialog).getByRole("button", { name: "Confirm booking" });
  expect(confirm).toBeDisabled();
  await act(async () => fail(new Error("offline")));
  expect(await within(dialog).findByText(/Availability could not be loaded/)).toBeInTheDocument();
  expect(confirm).toBeDisabled(); fireEvent.click(confirm); expect(fixture.post).not.toHaveBeenCalled();
  fixture.get.mockImplementation(defaultGet);
  fireEvent.click(within(dialog).getByRole("button", { name: "Retry availability" }));
  await waitFor(() => expect(confirm).toBeEnabled());
  expect(fixture.post).not.toHaveBeenCalled();
});

it("keeps the clinical dialog open during loading, then shows a retry error without invented findings", async () => {
  let fail!: (error: unknown) => void;
  fixture.get.mockImplementation(url => url.startsWith("/encounters/") ? new Promise((_resolve, reject) => { fail = reject; }) : defaultGet(url));
  mount(); await options("View Rx / EHR Summary");
  const dialog = await screen.findByRole("dialog", { name: "Clinical Consultation Record" });
  expect(within(dialog).getByText("Loading clinical record...")).toBeInTheDocument();
  await act(async () => fail(new Error("offline")));
  expect(await within(dialog).findByText("Clinical record unavailable")).toBeInTheDocument();
  expect(within(dialog).queryByText("Recorded summary")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("No diagnosis recorded.")).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /Print/ })).toBeDisabled();
});

it("requires explicit confirmation for arrival and blocks repeated status submissions", async () => {
  let finish!: (data: unknown) => void;
  fixture.put.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mount(); await options("Mark Checked-In");
  const dialog = await screen.findByRole("dialog", { name: "Change Appointment Status?" });
  expect(fixture.put).not.toHaveBeenCalled();
  const submit = within(dialog).getByRole("button", { name: "Update status" });
  fireEvent.click(submit); fireEvent.click(submit);
  expect(fixture.put).toHaveBeenCalledExactlyOnceWith("/appointments/visit/status", { status: "checked-in" });
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => finish(response({})));
});

it("releases the previous slot with its original scope and submits only the current reservation", async () => {
  fixture.get.mockImplementation(url => url.includes("/slots?") ? Promise.resolve(response({ bookingMode: "time_slot", slots: [{ time: "10:00", available: true }, { time: "10:15", available: true }] })) : defaultGet(url));
  fixture.post.mockImplementation(async (url, body) => response(url === "/appointments/lock-slot" ? { lockId: body.slotTime.includes("04:30") ? "first-lock" : "second-lock" } : { tokenNumber: 13 }));
  mount(); const dialog = await bookingSchedule();
  fireEvent.click(await within(dialog).findByRole("button", { name: "10:00", exact: true }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "10:15", exact: true })).toBeEnabled());
  fireEvent.click(within(dialog).getByRole("button", { name: "10:15", exact: true }));
  await waitFor(() => expect(fixture.remove).toHaveBeenCalledExactlyOnceWith("/appointments/lock-slot", { data: { lockId: "first-lock", slotTime: expect.stringMatching(/T04:30:00\.000Z$/), locationId: "clinic", doctorId: "doctor" } }));
  const confirm = within(dialog).getByRole("button", { name: "Confirm booking" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/appointments", expect.objectContaining({ lockId: "second-lock", appointmentTime: expect.stringMatching(/T04:45:00\.000Z$/) })));
});

it("keeps reschedule values after a failure and associates the pinned action with its form", async () => {
  fixture.patch.mockRejectedValue({ response: { data: { message: "Selected time is no longer available" } } });
  mount(); await options("Reschedule Appointment");
  const dialog = await screen.findByRole("dialog", { name: "Reschedule appointment #12" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Reason for Rescheduling (Optional)" }), { target: { value: "Patient requested this time" } });
  const submit = within(dialog).getByRole("button", { name: "Confirm reschedule" });
  expect((submit as HTMLButtonElement).form?.id).toBe("appointment-reschedule");
  fireEvent.click(submit);
  await waitFor(() => expect(fixture.patch).toHaveBeenCalledWith("/appointments/visit/reschedule", { newTime: expect.any(String), reason: "Patient requested this time" }));
  await screen.findByText("Selected time is no longer available");
  expect(within(dialog).getByRole("textbox", { name: "Reason for Rescheduling (Optional)" })).toHaveValue("Patient requested this time");
  expect(submit).toBeEnabled();
});

it("releases a held slot when the time is edited and does not submit its obsolete reservation", async () => {
  fixture.get.mockImplementation(url => url.includes("/slots?") ? Promise.resolve(response({ bookingMode: "time_slot", slots: [{ time: "10:00", available: true }] })) : defaultGet(url));
  fixture.post.mockImplementation(async url => response(url === "/appointments/lock-slot" ? { lockId: "held-slot" } : { tokenNumber: 13 }));
  mount(); const dialog = await bookingSchedule();
  fireEvent.click(await within(dialog).findByRole("button", { name: "10:00", exact: true }));
  const time = datePickerInput(within(dialog).getByLabelText("Selected time *"));
  await waitFor(() => expect(time).toBeEnabled());
  fireEvent.change(time, { target: { value: "10:30" } });
  await waitFor(() => expect(fixture.remove).toHaveBeenCalledWith("/appointments/lock-slot", { data: expect.objectContaining({ lockId: "held-slot", locationId: "clinic", doctorId: "doctor" }) }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm booking" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/appointments", expect.objectContaining({ appointmentTime: expect.stringMatching(/T05:00:00\.000Z$/) })));
  expect(fixture.post.mock.calls.find(([url]) => url === "/appointments")![1]).not.toHaveProperty("lockId");
});

it("does not reopen a clinical record after closing it while its response is pending", async () => {
  let finish!: (data: unknown) => void;
  fixture.get.mockImplementation(url => url.startsWith("/encounters/") ? new Promise(resolve => { finish = resolve; }) : defaultGet(url));
  mount(); await options("View Rx / EHR Summary");
  const dialog = await screen.findByRole("dialog", { name: "Clinical Consultation Record" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Close", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await act(async () => finish(response({ chiefComplaint: "Late record" })));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Late record")).not.toBeInTheDocument();
});
