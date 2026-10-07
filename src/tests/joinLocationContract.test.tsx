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
