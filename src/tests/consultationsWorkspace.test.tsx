import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Consultations from "@/app/(dashboard)/dashboard/consultations/page";
import { ToastProvider } from "@/components/ui";

const fixture = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), push: vi.fn(), fetchLocations: vi.fn(), focused: false, role: "doctor" }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, put: fixture.put, post: fixture.post } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fixture.push }) }));
vi.mock("@/hooks/useWorkflowPreferences", () => ({ useWorkflowPreferences: () => ({ preferences: { registration: "full", consultation: fixture.focused ? "focused" : "full" }, loading: false }) }));
const locations = [{ id: "clinic", name: "Sample clinic", timezone: "Asia/Kolkata" }];
vi.mock("@/store/locationStore", () => ({ useLocationStore: () => ({ activeLocationId: "clinic", locations, fetchLocations: fixture.fetchLocations }) }));
vi.mock("@/store/authStore", () => ({ useAuthStore: (selector?: (state: unknown) => unknown) => {
  const state = { user: { id: "doctor", role: fixture.role, organization_id: "org", permissions: ["VIEW_APPOINTMENTS", "MANAGE_CLINICAL_NOTES", "MANAGE_APPOINTMENTS", "MANAGE_QUEUE"] } };
  return selector ? selector(state) : state;
} }));
const visit = { id: "visit", status: "checked-in", patientId: { id: "patient", name: "Recorded patient" }, doctorId: { id: "doctor", name: "Assigned doctor" }, appointmentType: "walk-in" };
const response = (data: unknown) => ({ data: { data }, headers: {} });
function defaultGet(path: string) {
  return Promise.resolve(response(path.includes("assignments") ? [{ doctorId: { id: "doctor", name: "Assigned doctor" } }] : path.includes("daily-summary") ? { appointments: 1, byStatus: { "checked-in": 1 } } : [visit]));
}
function mount() { return render(<ToastProvider><Consultations /></ToastProvider>); }
beforeEach(() => {
  fixture.focused = false; fixture.role = "doctor";
  fixture.get.mockReset().mockImplementation(defaultGet); fixture.put.mockReset(); fixture.post.mockReset(); fixture.push.mockReset();
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(cleanup);

it.each([false, true])("keeps visits usable when daily counts fail (focused=%s) and never fabricates a token", async focused => {
  fixture.focused = focused;
  fixture.get.mockImplementation(path => path.includes("daily-summary") ? Promise.reject(new Error("offline")) : defaultGet(path));
  mount();
  const name = await screen.findByRole("heading", { name: visit.patientId.name });
  expect(screen.getByText("Counts unavailable")).toBeInTheDocument();
  expect(within(name.closest("article")!).getByText("—")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start consultation" })).toBeEnabled();
  expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument();
});

it.each([false, true])("hides the previous search results immediately (focused=%s)", async focused => {
  fixture.focused = focused; mount(); await screen.findByRole("heading", { name: visit.patientId.name });
  let finish!: (value: unknown) => void;
  fixture.get.mockImplementation(path => path.startsWith("/appointments?") ? new Promise(resolve => { finish = resolve; }) : defaultGet(path));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Different patient" } });
  expect(screen.queryByRole("heading", { name: visit.patientId.name })).not.toBeInTheDocument();
  await waitFor(() => expect(finish).toBeDefined());
  await act(async () => finish(response([{ ...visit, patientId: { id: "other", name: "Different patient" } }])));
  expect(await screen.findByRole("heading", { name: "Different patient" })).toBeInTheDocument();
});

it("keeps focused-mode rows visible while refreshing the same view", async () => {
  fixture.focused = true; mount(); await screen.findByRole("heading", { name: visit.patientId.name });
  fixture.get.mockImplementation(() => new Promise(() => {}));
  fireEvent.click(screen.getByRole("button", { name: "Refresh consultations" }));
  expect(screen.getByRole("heading", { name: visit.patientId.name })).toBeInTheDocument();
});

it.each([false, true])("keeps daily status counts visible while another tab loads (focused=%s)", async focused => {
  fixture.focused = focused; mount(); await screen.findByRole("heading", { name: visit.patientId.name });
  expect(screen.getByRole("tab", { name: /Waiting\s*1/ })).toBeInTheDocument();
  fixture.get.mockImplementation(path => path.startsWith("/appointments?") ? new Promise(() => {}) : defaultGet(path));
  fireEvent.click(screen.getByRole("tab", { name: /In visit/ }));
  expect(screen.getByRole("tab", { name: /Waiting\s*1/ })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /All\s*1/ })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: visit.patientId.name })).not.toBeInTheDocument();
});

it("confirms arrival in an accessible dialog and sends the explicit candidate on next-patient confirmation", async () => {
  fixture.focused = true;
  fixture.post.mockRejectedValueOnce({ response: { data: { details: "ARRIVAL_CONFIRMATION_REQUIRED", data: { id: "booked-visit", tokenNumber: 12 } } } }).mockResolvedValue(response({ id: "booked-visit" }));
  mount(); await screen.findByRole("heading", { name: visit.patientId.name });
  fireEvent.click(screen.getByRole("button", { name: "Next patient" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirm patient arrival" });
  expect(fixture.post).toHaveBeenCalledTimes(1);
  fireEvent.click(within(dialog).getByRole("button", { name: "Mark arrival and start" }));
  await waitFor(() => expect(fixture.push).toHaveBeenCalledWith("/dashboard/consultations/booked-visit"));
  expect(fixture.post.mock.calls[1]).toEqual(["/queue/call-next", { doctorId: "doctor", locationId: "clinic", requireArrivalConfirmation: true, confirmedAppointmentId: "booked-visit" }]);
});

it("keeps family members on their care-record view even when the organization uses focused consultations", async () => {
  fixture.focused = true; fixture.role = "family_member"; mount();
  expect(await screen.findByRole("button", { name: "Care records" })).toBeInTheDocument();
  expect(fixture.get.mock.calls.some(([path]) => path.includes("daily-summary") || path.includes("assignments"))).toBe(false);
  expect(screen.queryByRole("button", { name: "Next patient" })).not.toBeInTheDocument();
});
