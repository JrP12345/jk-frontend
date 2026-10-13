import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Portal from "@/app/(dashboard)/dashboard/patient-portal/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), bloodGroup: undefined as string | undefined, role: 'patient' }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post, put: fixture.put } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: (selector?: (state: unknown) => unknown) => { const state = { user: { id: "patient-user", name: "Review patient", email: "patient@example.test", role: fixture.role } }; return selector ? selector(state) : state; } }));
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fixture.get.mockImplementation(async path => ({ data: { data: path === "/patient/me" ? { patient: { id: "patient", bloodGroup: fixture.bloodGroup } } : path === "/dpdp/organizations" ? { items: [], nextCursor: null } : path.includes("timeline") ? { events: [] } : [] } }));
  fixture.post.mockResolvedValue({ data: { success: true } });
  fixture.put.mockResolvedValue({ data: { success: true } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); fixture.bloodGroup = undefined; fixture.role = 'patient'; });
describe("Recorded patient blood group", () => {
  it('opens family privacy choices without requesting an unauthorized personal clinical profile', async () => {
    fixture.role = 'family_member';
    fixture.get.mockImplementation(async path => ({ data: { data: path === '/family' ? [{ relationshipId: 'family', relationship: 'guardian', patient: { id: 'dependent', name: 'Dependent' }, organizationPrivacyAvailable: true }] : { items: [{ id: 'clinic', name: 'Reviewed clinic', consentAuthority: true, dataRightsAuthority: false }], nextCursor: null } } }));
    render(<ToastProvider><Portal /></ToastProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Privacy choices for Dependent' }));
    await screen.findByRole('combobox', { name: 'Organization for privacy choices' });
    expect(fixture.get.mock.calls.some(([path]) => path === '/patient/me')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Edit Medical Info' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download Medical Records' })).not.toBeInTheDocument();
  });
  it.each([undefined, "AB-"])("preserves recorded or unknown blood group (%s) when saving other profile information", async bloodGroup => {
    fixture.bloodGroup = bloodGroup;
    render(<ToastProvider><Portal /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Medical Info" }));
    expect(screen.getByRole("combobox", { name: "Blood Group" })).toHaveTextContent(bloodGroup || "Not recorded");
    const form = screen.getByLabelText("Address").closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(fixture.put).toHaveBeenCalledWith("/patient/me", expect.objectContaining({ bloodGroup })));
  });
  it("does not invent a blood group when creating a family member", async () => {
    render(<ToastProvider><Portal /></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: /My Family/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add Family Member" }));
    fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "Family patient" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save Family Member" }).closest("form")!);
    await waitFor(() => expect(fixture.post).toHaveBeenCalled());
    expect(fixture.post.mock.calls[0][1]).not.toHaveProperty("bloodGroup");
  });
});

it("retains an uncertain self-book request across closing and reopening and reports its actual state", async () => {
  fixture.get.mockImplementation(async path => ({ data: { data: path === "/patient/me" ? { patient: { id: "patient" } } : path === "/public/locations" ? [{ id: "branch", name: "Care", timezone: "Asia/Kolkata", doctors: [{ id: "doctor", name: "Asha" }] }] : path.includes("/slots") ? { bookingMode: "sequential_queue" } : path === "/dpdp/organizations" ? { items: [], nextCursor: null } : path.includes("timeline") ? { events: [] } : [] } }));
  fixture.post.mockRejectedValueOnce({ response: { status: 503, data: { message: "Outcome unavailable" } } }).mockResolvedValueOnce({ data: { success: true, data: { appointment: { id: "visit", status: "pending_payment", paymentStatus: "pending" }, tokenNumber: 4 } } });
  render(<ToastProvider><Portal /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Book Appointment" }));
  const submit = await screen.findByRole("button", { name: "Record Visit & Get Token" });
  await waitFor(() => expect(submit).not.toBeDisabled());
  fireEvent.click(submit);
  expect(await screen.findByRole("alert")).toHaveTextContent(/Retry the submitted booking/);
  expect(screen.getByLabelText("Reason for Visit / Symptoms")).toBeDisabled();
  const command = fixture.post.mock.calls[0][1]; expect(command.clientRequestId).toMatch(/^[\da-f-]{36}$/);
  fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Book Appointment" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry Submitted Booking" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(2));
  expect(fixture.post.mock.calls[1][1]).toEqual(command);
  expect(await screen.findByText("Payment Pending")).toBeInTheDocument();
  expect(screen.queryByText("Appointment Confirmed")).not.toBeInTheDocument();
});

it("includes the selected family subject in canonical portal booking without using it for consent", async () => {
  fixture.get.mockImplementation(async path => ({ data: { data: path === "/patient/me" ? { patient: { id: "patient" } } : path === "/family" ? [{ relationship: "mother", patient: { id: "family-patient", name: "Family subject" } }] : path === "/public/locations" ? [{ id: "branch", name: "Care", doctors: [{ id: "doctor", name: "Asha" }] }] : path.includes("/slots") ? { bookingMode: "sequential_queue" } : path === "/dpdp/organizations" ? { items: [], nextCursor: null } : path.includes("timeline") ? { events: [] } : [] } }));
  fixture.post.mockResolvedValue({ data: { success: true, data: { appointment: { id: "visit", status: "pending", paymentStatus: "not_required" }, tokenNumber: 5 } } });
  render(<ToastProvider><Portal /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: /My Family/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Book for Family" }));
  const submit = await screen.findByRole("button", { name: "Record Visit & Get Token" });
  await waitFor(() => expect(submit).not.toBeDisabled()); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/patient-portal/self-book", expect.objectContaining({ forPatientId: "family-patient" })));
  expect(fixture.post.mock.calls[0][1]).not.toHaveProperty("consent");
});

it("reserves a currently offered scheduled slot before canonical booking", async () => {
  fixture.get.mockImplementation(async path => ({ data: { data: path === "/patient/me" ? { patient: { id: "patient" } } : path === "/public/locations" ? [{ id: "branch", name: "Care", timezone: "Asia/Kolkata", doctors: [{ id: "doctor", name: "Asha" }] }] : path.includes("/slots") ? { bookingMode: "time_slot", slots: [{ time: "10:30", available: true }, { time: "11:00", available: false }] } : path === "/dpdp/organizations" ? { items: [], nextCursor: null } : path.includes("timeline") ? { events: [] } : [] } }));
  fixture.post.mockImplementation(async path => ({ data: { data: path === "/appointments/lock-slot" ? { lockId: "reserved-slot" } : { appointment: { id: "visit", status: "pending", paymentStatus: "not_required" }, tokenNumber: 6 } } }));
  render(<ToastProvider><Portal /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Book Appointment" }));
  const slots = await screen.findByRole("combobox", { name: "Available appointment time" });
  await waitFor(() => expect(slots).not.toBeDisabled()); fireEvent.click(slots);
  fireEvent.click(await screen.findByRole("option", { name: "10:30" }));
  fireEvent.click(screen.getByRole("button", { name: "Record Visit & Get Token" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledTimes(2));
  expect(fixture.post.mock.calls[0][0]).toBe("/appointments/lock-slot");
  expect(fixture.post.mock.calls[1][1]).toMatchObject({ lockId: "reserved-slot", appointmentTime: expect.stringContaining("T05:00:00") });
});
