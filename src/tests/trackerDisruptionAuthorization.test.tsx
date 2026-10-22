import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Tracker from "@/app/track/[appointmentId]/page";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import api from "@/lib/api";
import { datePickerInput } from "./datePickerTestUtils";

vi.mock("next/navigation", () => ({ useParams: () => ({ appointmentId: "visit" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() }, getApiUrl: () => "http://localhost:5000/api" }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fixture") } }));
it("shows partial supply with the remaining quantity instead of a completed prescription", async () => {
  window.history.replaceState({}, "", "/track/visit#t=private-tracker-proof");
  const baseline = await api.get("/fixture");
  vi.mocked(api.get).mockResolvedValue({ ...baseline, data: { data: { ...baseline.data.data, status: "completed", pharmacyStatus: "partially_dispensed",
    consultationSummary: { completedAt: new Date().toISOString(), diagnoses: [], prescriptions: [{ id: "rx", medicineName: "Reviewed medicine", dosage: "As prescribed", duration: "30 days", frequency: "Daily", instructions: "", status: "active",
      fulfillment: { authorizedQuantity: 30, baseUnit: "tablet", suppliedQuantity: 10, remainingQuantity: 20 } }] } } } });
  render(<ThemeProvider><ToastProvider><Tracker /></ToastProvider></ThemeProvider>);
  expect(await screen.findByText("Prescription Partially Supplied")).toBeInTheDocument();
  expect(screen.getByText("Supplied 10 of 30 tablet; remaining 20")).toBeInTheDocument();
  expect(screen.queryByText("Medications Ready for Pickup")).not.toBeInTheDocument();
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/track/visit?action=cancel#t=private-tracker-proof");
  vi.stubGlobal("WebSocket", class { close() {} });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.mocked(api.get).mockResolvedValue({ data: { data: {
    appointmentId: "visit", tokenNumber: 1, status: "disruption_triage", patientName: "Patient", appointmentTime: new Date().toISOString(),
    appointmentType: "online", doctor: { id: "doctor", name: "Provider", specialization: "General" },
    location: { id: "clinic", name: "Clinic", city: "Surat", address: "Address", phone: "919999999999", timezone: "Asia/Kolkata" },
    currentlyServingToken: null, peopleAhead: 0, estimatedWaitMinutes: 0, estimatedCallTime: null, averageDuration: 15,
    isAdaptiveDuration: false, adaptiveSampleCount: 0, doctorAvailability: { status: "unavailable", isAvailable: false, reason: null, delayMinutes: 0 }, isToday: true,
  } }, headers: {} });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); window.history.replaceState({}, "", "/"); });

it("sends the private tracker proof when confirming a disruption cancellation", async () => {
  render(<ThemeProvider><ToastProvider><Tracker /></ToastProvider></ThemeProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm Cancellation" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/doctor-overrides/patient-action", expect.objectContaining({ appointmentId: "visit", action: "cancel" }), { headers: { "x-tracker-token": "private-tracker-proof" } }));
});

it('reports payment pending after a disruption reschedule', async () => {
  window.history.replaceState({}, '', '/track/visit?action=reschedule#t=private-tracker-proof');
  vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { newAppt: { status: 'pending_payment' } } } });
  render(<ThemeProvider><ToastProvider><Tracker /></ToastProvider></ThemeProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm Reschedule' }));
  expect(await screen.findByText('The replacement booking is recorded. Payment is required before confirmation.')).toBeInTheDocument();
});

it("uses the shared date picker and preserves branch-local bounds and the private reschedule proof", async () => {
  window.history.replaceState({}, "", "/track/visit?action=reschedule#t=private-tracker-proof");
  render(<ThemeProvider><ToastProvider><Tracker /></ToastProvider></ThemeProvider>);
  const trigger = await screen.findByRole("button", { name: "Select Date" });
  const input = datePickerInput(trigger);
  expect(input).toHaveAttribute("min", input.value);
  const date = input.value;
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  fireEvent.click(screen.getByRole("button", { name: "Confirm Reschedule" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/doctor-overrides/patient-action", expect.objectContaining({ appointmentId: "visit", action: "reschedule", targetDate: date }), { headers: { "x-tracker-token": "private-tracker-proof" } }));
});

it('keeps unanswered disruption available for a patient decision without an automatic cancellation threat', async () => {
  window.history.replaceState({}, '', '/track/visit#t=private-tracker-proof');
  render(<ThemeProvider><ToastProvider><Tracker /></ToastProvider></ThemeProvider>);
  expect(await screen.findByText(/select how you would like to proceed/i)).toBeInTheDocument();
  expect(screen.queryByText(/will be cancelled if no action/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reschedule/i })).toBeEnabled();
});

it.each([
  ["refunded", "Your appointment is cancelled and the refund has been processed."],
  ["refund_pending", "Your appointment is cancelled. Contact reception to confirm the pending refund."],
  ["pending", "Your appointment has been cancelled."],
])("reports the server's %s result without promising an unprocessed refund", async (paymentStatus, description) => {
  vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { paymentStatus } } });
  render(<ThemeProvider><ToastProvider><Tracker /></ToastProvider></ThemeProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm Cancellation" }));
  expect(await screen.findByText(description)).toBeInTheDocument();
});
