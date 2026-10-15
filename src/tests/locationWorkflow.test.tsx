import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { PatientEntryModal } from "@/components/appointments/PatientEntryModal";
import { VisitCompletion } from "@/components/clinical/VisitCompletion";
import { TodayPatients } from "@/components/appointments/TodayPatients";
import { VisitInvoices } from "@/components/billing/VisitInvoices";
import { SOAPNoteEditor } from "@/components/clinical/SOAPNoteEditor";
import { ToastProvider } from "@/components/ui";
import { locationTodayRange, validSingleChoice } from "@/lib/locationWorkflow";
import { hasRoutePermission } from "@/lib/routePermissions";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/clinical/PreviousVisitsSidebar", () => ({ PreviousVisitsSidebar: () => null }));

const doctor = { id: "doctor", name: "Assigned doctor" };
const assignment = { doctorId: doctor, isActive: true };
const patient = { id: "patient", name: "Canonical walk-in", phone: "9876500011", mrn: "REAL-12" };
function mount(element: React.ReactElement) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}><ToastProvider>{element}</ToastProvider></QueryClientProvider>); }

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, writable: true, value: vi.fn() });
  useAuthStore.setState({ user: { id: "desk", name: "Reception", email: "desk@test.com", role: "receptionist", organization_id: "org", permissions: ["MANAGE_PATIENTS", "MANAGE_APPOINTMENTS", "MANAGE_QUEUE", "MANAGE_BILLING", "VIEW_BILLING"] }, isAuthenticated: true });
  useLocationStore.setState({ locations: [{ id: "clinic", name: "Only location", city: "Surat", effectiveTimezone: "Asia/Kolkata" }], activeLocationId: "clinic", isLoaded: true, isLoading: false, error: null });
  vi.spyOn(api, "get").mockImplementation(async path => {
    const url = String(path);
    return { data: { data: url.includes("assignments") ? [assignment] : url.includes("/slots") ? { bookingMode: "sequential_queue", slots: [] } : [] }, headers: {} };
  });
  vi.spyOn(api, "post").mockImplementation(async path => ({ data: { data: path === "/patients" ? patient : { id: "appointment", status: "confirmed", tokenNumber: 12 } } }));
  vi.spyOn(api, "put").mockResolvedValue({ data: { data: {} } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); router.push.mockReset(); });

describe("Shared patient entry", () => {
  it('does not continue a late registration into a different workspace', async () => {
    let finish: ((value: unknown) => void) | undefined;
    vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const onBooked = vi.fn(), previous = useAuthStore.getState().user;
    mount(<PatientEntryModal open onClose={vi.fn()} onBooked={onBooked} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add visit' })).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Register a new patient' }));
    fireEvent.change(screen.getByLabelText('Patient name'), { target: { value: 'Private old workspace patient' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '9876500011' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add visit' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    try {
      await act(async () => { useAuthStore.setState({ user: { ...previous!, organization_id: 'different-org' } }); });
      await act(async () => { finish!({ data: { data: patient } }); });
      expect(vi.mocked(api.post).mock.calls.some(call => call[0] === '/appointments')).toBe(false);
      expect(onBooked).not.toHaveBeenCalled();
      expect(screen.queryByText('Canonical walk-in')).not.toBeInTheDocument();
    } finally { useAuthStore.setState({ user: previous }); }
  });
  it('preserves one immutable visit request after booking response loss and close/resume', async () => {
    let bookingAttempts = 0;
    vi.mocked(api.post).mockImplementation(async path => {
      if (path === '/patients') return { data: { data: patient } };
      if (++bookingAttempts === 1) throw new Error('Committed booking response lost');
      return { data: { data: { id: 'same-recorded-visit', status: 'pending_payment' } } };
    });
    const onBooked = vi.fn();
    function Entry() {
      const [open, setOpen] = useState(true);
      return <><PatientEntryModal open={open} onClose={() => setOpen(false)} onBooked={onBooked} /><button onClick={() => setOpen(true)}>Resume desk entry</button></>;
    }
    mount(<Entry />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add visit' })).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Register a new patient' }));
    fireEvent.change(screen.getByLabelText('Patient name'), { target: { value: 'Canonical walk-in' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '9876500011' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add visit' }));
    await screen.findByText(/Committed booking response lost/);
    const original = vi.mocked(api.post).mock.calls.find(call => call[0] === '/appointments')![1];
    expect(document.querySelector('fieldset')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume desk entry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted visit' }));
    await waitFor(() => expect(onBooked).toHaveBeenCalledWith('same-recorded-visit'));
    const bookings = vi.mocked(api.post).mock.calls.filter(call => call[0] === '/appointments');
    expect(bookings).toHaveLength(2);
    expect(bookings[1][1]).toEqual(original);
    expect(vi.mocked(api.post).mock.calls.filter(call => call[0] === '/patients')).toHaveLength(1);
    expect(api.put).not.toHaveBeenCalled();
  });
  it("retries uncertain registration using the same request identifier", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Registration response lost"));
    mount(<PatientEntryModal open onClose={vi.fn()} onBooked={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add visit" })).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Register a new patient" }));
    fireEvent.change(screen.getByLabelText("Patient name"), { target: { value: "Canonical walk-in" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9876500011" } });
    fireEvent.click(screen.getByRole("button", { name: "Add visit" }));
    expect(await screen.findByText(/Registration response lost/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry submitted visit" }));
    await waitFor(() => expect(vi.mocked(api.post).mock.calls.filter(call => call[0] === "/patients")).toHaveLength(2));
    const registrations = vi.mocked(api.post).mock.calls.filter(call => call[0] === "/patients");
    expect(registrations[1][1]).toEqual(registrations[0][1]);
  });
  it("infers only valid single options and retains minimum patient and booked visit after arrival failure", async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { message: "Arrival temporarily unavailable" } } }).mockResolvedValue({ data: { data: {} } });
    const onBooked = vi.fn();
    mount(<PatientEntryModal open onClose={vi.fn()} onBooked={onBooked} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add visit" })).toBeEnabled(), { timeout: 3000 });
    expect(screen.queryByLabelText("Doctor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Clinic")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Register a new patient" }));
    fireEvent.change(screen.getByLabelText("Patient name"), { target: { value: "Canonical walk-in" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9876500011" } });
    fireEvent.click(screen.getByRole("button", { name: "Add visit" }));
    expect(await screen.findByText(/Arrival temporarily unavailable/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/patients", { name: "Canonical walk-in", phone: "9876500011", locationId: "clinic", clientRequestId: expect.any(String) });
    expect(api.post).toHaveBeenCalledWith("/appointments", expect.objectContaining({ patientId: "patient", locationId: "clinic", doctorId: "doctor", appointmentType: "walk-in" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry arrival" }));
    await waitFor(() => expect(onBooked).toHaveBeenCalledWith("appointment"));
    expect(api.post).toHaveBeenCalledTimes(2); expect(api.put).toHaveBeenCalledTimes(2);
  });

  it("reuses searched patients for phone bookings and keeps multiple doctors explicit", async () => {
    vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).includes("assignments") ? [assignment, { doctorId: { id: "second", name: "Second doctor" }, isActive: true }] : String(path).includes("/slots") ? { bookingMode: "sequential_queue", slots: [] } : [patient] }, headers: {} }));
    const onBooked = vi.fn();
    mount(<PatientEntryModal open onClose={vi.fn()} onBooked={onBooked} />);
    const selector = await screen.findByRole("combobox", { name: "Doctor" });
    expect(selector).toHaveTextContent("Select doctor"); expect(screen.getByRole("button", { name: "Add visit" })).toBeDisabled();
    fireEvent.click(selector);
    fireEvent.click(await screen.findByRole("option", { name: "Second doctor" }));
    fireEvent.change(screen.getByLabelText("Find existing patient"), { target: { value: "9876500011" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("button", { name: /Canonical walk-in · 9876500011/ }));
    fireEvent.click(screen.getByRole("combobox", { name: "Visit source" }));
    fireEvent.click(await screen.findByRole("option", { name: "Phone / desk booking" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add visit" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add visit" }));
    await waitFor(() => expect(onBooked).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledTimes(1); expect(api.put).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith("/appointments", expect.objectContaining({ patientId: "patient", doctorId: "second", appointmentType: "reception" }));
  });

  it("offers canonical duplicate matches instead of ignoring the duplicate check", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: "Possible existing patient", details: { highConfidenceMatches: [patient] } } } });
    mount(<PatientEntryModal open onClose={vi.fn()} onBooked={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add visit" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Register a new patient" }));
    fireEvent.change(screen.getByLabelText("Patient name"), { target: { value: "Canonical walk-in" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9876500011" } });
    fireEvent.click(screen.getByRole("button", { name: "Add visit" }));
    expect(await screen.findByRole("button", { name: /Canonical walk-in · 9876500011/ })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});

describe("Focused consultation and full editor", () => {
  beforeEach(() => useAuthStore.setState({ user: { id: "doctor", name: "Doctor", email: "doctor@test.com", role: "doctor", permissions: ["MANAGE_CLINICAL_NOTES"] } }));
  it("completes with no note or medicine through the canonical lifecycle", async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    mount(<VisitCompletion appointmentId="appointment" doctorId="doctor" onCompleted={complete} onFullEditor={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete & next" }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(true));
    expect(api.put).toHaveBeenCalledWith("/appointments/appointment/status", { status: "completed", documentationMode: "optional", notes: "", symptoms: "", diagnosis: "", prescriptions: [], dispatchWhatsAppRx: false });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("requires explicit medicine dosing and carries actual entered content to the full editor", () => {
    const full = vi.fn();
    mount(<VisitCompletion appointmentId="appointment" doctorId="doctor" onCompleted={vi.fn()} onFullEditor={full} />);
    fireEvent.change(screen.getByLabelText("Visit note (optional)"), { target: { value: "Recorded short note" } });
    fireEvent.click(screen.getByRole("button", { name: "Add medicine" }));
    expect(screen.getByLabelText("Frequency")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Complete visit" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Medicine name"), { target: { value: "Recorded medicine" } });
    fireEvent.click(screen.getByRole("button", { name: "Full clinical editor" }));
    expect(full).toHaveBeenCalledWith(expect.objectContaining({ notes: "Recorded short note", medicines: [expect.objectContaining({ name: "Recorded medicine", frequency: "" })] }));
    expect(api.put).not.toHaveBeenCalled();
  });

  it("loads real saved SOAP content with its identity and vitals instead of a blank draft", () => {
    mount(<SOAPNoteEditor patientId="patient" locationId="clinic" encounterId="encounter" initialNoteId="note" initialNoteData={{
      subjective: { chiefComplaint: "Actual recorded complaint", historyOfPresentIllness: "Actual history", symptoms: ["Actual symptom"] }, objective: { physicalExamination: "Actual exam", observationIds: [{ code: "HR", value: "70" }] }, assessment: { diagnoses: [{ code: "CUSTOM", description: "Actual diagnosis" }] }, plan: { treatmentPlan: "Actual plan", prescriptionIds: [] }, status: "draft",
    }} />);
    expect(screen.getByDisplayValue("Actual recorded complaint")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Actual history")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Actual exam")).toBeInTheDocument();
    expect(screen.getByDisplayValue("70")).toBeInTheDocument();
    expect(screen.getByText("Draft saved to server")).toBeInTheDocument();
  });

  it("keeps the canonical prescription print action available after explicit medicines complete", async () => {
    mount(<VisitCompletion appointmentId="appointment" encounterId="encounter" doctorId="doctor" onCompleted={vi.fn().mockResolvedValue(undefined)} onFullEditor={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add medicine" }));
    for (const [label, value] of [["Medicine name", "Recorded medicine"], ["Dosage", "500 mg"], ["Frequency", "Once daily"], ["Duration", "2 days"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Complete visit" }));
    expect(await screen.findByRole("button", { name: "Print prescription" })).toBeInTheDocument();
    expect(api.put).toHaveBeenCalledWith("/appointments/appointment/status", expect.objectContaining({ prescriptions: [expect.objectContaining({ name: "Recorded medicine", dosage: "500 mg", frequency: "Once daily", duration: "2 days" })] }));
  });
});

describe("Today's existing visits and financial records", () => {
  it("allows appointment staff into the operational index while protecting clinical detail routes", () => {
    expect(hasRoutePermission("/dashboard/consultations", "receptionist", ["VIEW_APPOINTMENTS"])).toBe(true);
    expect(hasRoutePermission("/dashboard/consultations/appointment", "receptionist", ["VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS"])).toBe(false);
  });
  it("shows real walk-in names and scoped counts while reception cannot start clinical completion", async () => {
    vi.mocked(api.get).mockImplementation(async path => ({ headers: { "x-total-pages": "2" }, data: { data: String(path).includes("assignments") ? [assignment] : String(path).includes("daily-summary") ? { appointments: 32, completed: 8, byStatus: { "checked-in": 24, completed: 8 }, financialVisible: true, moneyByCurrency: [{ currency: "INR", collections: 350, outstanding: 700 }] } : [{ id: "appointment", patientId: patient, doctorId: doctor, status: "checked-in", appointmentType: "walk-in", tokenNumber: 12 }] } }));
    mount(<TodayPatients essentialEntry onDetailedView={vi.fn()} />);
    expect((await screen.findAllByText("Canonical walk-in")).length).toBeGreaterThan(0);
    expect(screen.getByText("8", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start consultation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to next page" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Rows per page" })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("limit=25"), expect.anything());
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("includeAppointments=false"), expect.anything());
  });

  it("pauses hidden-tab polling and reloads current visits immediately on return", async () => {
    let poll = () => {};
    vi.spyOn(globalThis, "setInterval").mockImplementation(((callback: () => void, delay: number) => {
      if (delay === 30000) poll = callback;
      return 1;
    }) as typeof setInterval);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.mocked(api.get).mockImplementation(async path => ({ headers: {}, data: { data: String(path).includes("assignments") ? [assignment] : String(path).includes("daily-summary") ? { completed: 8, byStatus: {} } : [{ id: "appointment", patientId: patient, doctorId: doctor, status: "checked-in", appointmentType: "walk-in" }] } }));
    mount(<TodayPatients onDetailedView={vi.fn()} />);
    await screen.findAllByText("Canonical walk-in");
    vi.mocked(api.get).mockClear();
    visibility.mockReturnValue("hidden");
    act(() => { for (let i = 0; i < 60; i++) poll(); window.dispatchEvent(new Event("focus")); });
    expect(api.get).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    console.log("PERF_HIDDEN_POLLING", JSON.stringify({ hiddenIntervals: 60, beforeRequests: 120, afterRequests: 0, returnRequests: 2 }));
  });

  it("records received money on the existing invoice and never books or creates an invoice", async () => {
    vi.mocked(api.get).mockResolvedValue({ headers: {}, data: { data: [{ id: "invoice", invoiceNumber: "REAL-INV", currency: "INR", totalAmount: 350, amountPaid: 100, balanceDue: 250, status: "partially_paid" }] } });
    const onPaid = vi.fn();
    mount(<VisitInvoices appointmentId="appointment" locationId="clinic" patientName="Patient" onClose={vi.fn()} onPaid={onPaid} />);
    const collect = await screen.findByRole("button", { name: /Record/ }); fireEvent.click(collect);
    await waitFor(() => expect(onPaid).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/invoices/invoice/payments", { amount: 250, paymentMethod: "cash" });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("clears the previous clinic's patients and totals while another clinic loads", async () => {
    useLocationStore.setState({ locations: [{ id: "clinic", name: "Only location", city: "Surat" }, { id: "second-clinic", name: "Second location", city: "Surat" }] });
    let releasePatients: (value: unknown) => void = () => {};
    const pendingPatients = new Promise(resolve => { releasePatients = resolve; });
    vi.mocked(api.get).mockImplementation(async path => {
      const url = String(path);
      if (url.includes("assignments")) return { data: { data: [assignment] }, headers: {} };
      if (url.includes("daily-summary")) return { data: { data: { completed: 8, byStatus: {} } }, headers: {} };
      if (url.includes("second-clinic")) return pendingPatients;
      return { data: { data: [{ id: "appointment", patientId: patient, doctorId: doctor, status: "checked-in", appointmentType: "walk-in" }] }, headers: {} };
    });
    mount(<TodayPatients onDetailedView={vi.fn()} />);
    await screen.findAllByText("Canonical walk-in");
    fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
    fireEvent.click(await screen.findByRole("option", { name: "Second location" }));
    expect(screen.queryByText("Canonical walk-in")).not.toBeInTheDocument();
    expect(screen.queryByText("8", { selector: "strong" })).not.toBeInTheDocument();
    releasePatients({ data: { data: [] }, headers: {} });
    await screen.findByText("No visits match this view.");
  });
});

describe("Existing clinic time and selection helpers", () => {
  it("uses the clinic day across a UTC date boundary and daylight saving time", () => {
    const india = new URLSearchParams(locationTodayRange("Asia/Kolkata", new Date("2026-10-03T20:00:00Z")));
    expect(india.get("startDate")).toBe("2026-10-03T18:30:00.000Z");
    const dst = new URLSearchParams(locationTodayRange("America/New_York", new Date("2026-11-01T12:00:00Z")));
    expect(new Date(dst.get("endDate")!).getTime() - new Date(dst.get("startDate")!).getTime() + 1).toBe(25 * 3600000);
  });
  it("retains a valid choice, infers exactly one and clears stale multi-option selections", () => {
    const id = (value: { id: string }) => value.id;
    expect(validSingleChoice([{ id: "a" }], id)).toBe("a");
    expect(validSingleChoice([{ id: "a" }, { id: "b" }], id)).toBe("");
    expect(validSingleChoice([{ id: "a" }, { id: "b" }], id, "b")).toBe("b");
    expect(validSingleChoice([{ id: "a" }, { id: "b" }], id, "gone")).toBe("");
  });
});
