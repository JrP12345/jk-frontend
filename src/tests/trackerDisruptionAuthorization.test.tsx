import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Tracker from "@/app/track/[appointmentId]/page";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import api from "@/lib/api";

vi.mock("next/navigation", () => ({ useParams: () => ({ appointmentId: "visit" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() }, getApiUrl: () => "http://localhost:5000/api" }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fixture") } }));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/track/visit?t=private-tracker-proof&action=cancel");
  vi.stubGlobal("WebSocket", class { close() {} });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.mocked(api.get).mockResolvedValue({ data: { data: {
    appointmentId: "visit", tokenNumber: 1, status: "disruption_triage", patientName: "Patient", appointmentTime: new Date().toISOString(),
    appointmentType: "online", doctor: { id: "doctor", name: "Provider", specialization: "General" },
    clinic: { id: "clinic", name: "Clinic", city: "Surat", address: "Address", phone: "919999999999", timezone: "Asia/Kolkata" },
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
