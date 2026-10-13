import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import JoinLocationQueuePage from "@/app/join/[locationSlug]/page";
import LocationQrPosterModal from "@/components/dashboard/LocationQrPosterModal";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import api from "@/lib/api";
import QRCode from "qrcode";

const route = vi.hoisted(() => ({ push: vi.fn(), slug: "care-location" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locationSlug: route.slug }), useRouter: () => ({ push: route.push }) }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,cXI=") } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("loads a public slug and submits resolved location and doctor identities", async () => {
  const location = { id: "private-location", slug: route.slug, name: "Care", city: "Surat", address: "Reception", phone: "", doctors: [
    { id: "unavailable", name: "On leave", isAvailable: false, overrideStatus: "on_leave" },
    { id: "assigned-doctor", name: "Asha", specialization: "Medicine", isAvailable: true, appointmentDuration: 15 },
  ] };
  const read = vi.spyOn(api, "get").mockResolvedValue({ data: { success: true, data: location } });
  const write = vi.spyOn(api, "post").mockResolvedValue({ data: { success: true, data: { appointmentId: "visit", tokenNumber: 2, queuePosition: 2, trackingUrl: "/track/visit#t=capability" } } });
  render(<ThemeProvider><ToastProvider><JoinLocationQueuePage /></ToastProvider></ThemeProvider>);
  fireEvent.change(await screen.findByLabelText(/Full Name/), { target: { value: "Patient" } });
  fireEvent.change(screen.getByLabelText(/Mobile Number/), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: /Join Queue & Get Token/ }));
  await waitFor(() => expect(write).toHaveBeenCalledWith("/public/join-queue", expect.objectContaining({ locationId: "private-location", doctorId: "assigned-doctor", name: "Patient" })));
  expect(read).toHaveBeenCalledWith("/public/locations/care-location");
});

it("prints a QR link containing the public slug", async () => {
  render(<ToastProvider><LocationQrPosterModal open onClose={vi.fn()} location={{ id: "private-location", slug: "care-location", name: "Care" }} /></ToastProvider>);
  await waitFor(() => expect(QRCode.toDataURL).toHaveBeenCalledWith(`${window.location.origin}/join/care-location`, expect.anything()));
  expect(await screen.findByAltText("QR code to join live queue at Care")).toBeInTheDocument();
});

it("shows recovery when a location has no published slug", async () => {
  render(<ToastProvider><LocationQrPosterModal open onClose={vi.fn()} location={{ id: "private-location", name: "Care" }} /></ToastProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent(/Could not generate QR/);
  expect(QRCode.toDataURL).not.toHaveBeenCalled();
});

it("freezes an uncertain QR request and retries the same command with truthful payment pending copy", async () => {
  vi.spyOn(api, "get").mockResolvedValue({ data: { success: true, data: { id: "branch", name: "Care", doctors: [{ id: "doctor", name: "Asha", isAvailable: true }] } } });
  const write = vi.spyOn(api, "post").mockRejectedValueOnce({ response: { status: 503, data: { message: "Response unavailable" } } }).mockResolvedValueOnce({ data: { success: true, data: { appointmentId: "visit", status: "pending_payment", paymentStatus: "pending", tokenNumber: 3, trackingUrl: "/track/visit#t=original" } } });
  render(<ThemeProvider><ToastProvider><JoinLocationQueuePage /></ToastProvider></ThemeProvider>);
  fireEvent.change(await screen.findByLabelText(/Full Name/), { target: { value: "Walk-in patient" } });
  fireEvent.change(screen.getByLabelText(/Mobile Number/), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: /Join Queue & Get Token/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/outcome is unknown/);
  expect(screen.getByLabelText(/Full Name/)).toBeDisabled();
  const original = write.mock.calls[0][1]; expect(original.clientRequestId).toMatch(/^[\da-f-]{36}$/);
  fireEvent.click(screen.getByRole("button", { name: "Retry Submitted Visit" }));
  expect(await screen.findByRole("heading", { name: "Payment Pending" })).toBeInTheDocument();
  expect(write.mock.calls[1][1]).toEqual(original);
  expect(screen.getByText(/Ask reception to complete the required payment/)).toBeInTheDocument();
  expect(screen.queryByText("You're in the Queue!")).not.toBeInTheDocument();
});

it("allows a reviewed correction after a definitive QR rejection", async () => {
  vi.spyOn(api, "get").mockResolvedValue({ data: { success: true, data: { id: "branch", name: "Care", doctors: [{ id: "doctor", name: "Asha", isAvailable: true }] } } });
  vi.spyOn(api, "post").mockRejectedValue({ response: { status: 409, data: { message: "Contact requires reception identity review" } } });
  render(<ThemeProvider><ToastProvider><JoinLocationQueuePage /></ToastProvider></ThemeProvider>);
  fireEvent.change(await screen.findByLabelText(/Full Name/), { target: { value: "Walk-in patient" } });
  fireEvent.change(screen.getByLabelText(/Mobile Number/), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: /Join Queue & Get Token/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/reception identity review/);
  expect(screen.getByLabelText(/Full Name/)).not.toBeDisabled();
});
