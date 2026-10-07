import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Teleconsultation from "@/app/(dashboard)/dashboard/teleconsultation/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), clipboard: vi.fn(), media: vi.fn(), user: { id: "doctor", role: "doctor" } }));
vi.mock("@/lib/api", () => ({ default: fixture }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: () => ({ activeLocationId: "clinic" }) }));
const appointment = { id: "appointment", appointmentTime: "2026-10-03T10:00:00Z", appointmentType: "online", status: "confirmed", patientId: { id: "patient", userId: { name: "Recorded patient" } }, doctorId: { id: "doctor", name: "Doctor" } };
const session = { id: "session", sessionRoomId: "TELE-random", status: "active", meetingUrl: "https://jitsi.example/TELE-random" };
beforeEach(() => {
  fixture.get.mockImplementation(async (url: string) => ({ data: { data: url.startsWith("/appointments") ? [appointment] : session } }));
  fixture.put.mockResolvedValue({ data: { data: session } }); fixture.clipboard.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: fixture.clipboard } });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: fixture.media } });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("uses the configured meeting URL and reports a clipboard failure accurately", async () => {
  render(<ToastProvider><Teleconsultation /></ToastProvider>);
  fireEvent.click((await screen.findAllByRole("button", { name: "Open consultation" }))[0]);
  expect(await screen.findByRole("link", { name: "Join video meeting" })).toHaveAttribute("href", session.meetingUrl);
  expect(fixture.media).not.toHaveBeenCalled();
  fixture.clipboard.mockRejectedValueOnce(new Error("denied"));
  fireEvent.click(screen.getByRole("button", { name: "Copy meeting link" }));
  expect(await screen.findByText("Could not copy link")).toBeInTheDocument();
  expect(fixture.clipboard).toHaveBeenCalledWith(session.meetingUrl);
});
it("shows an unavailable meeting for an invalid relative meeting placeholder", async () => {
  const invalidSession = { ...session, meetingUrl: "/dashboard/teleconsultation?room=old" };
  fixture.get.mockImplementation(async (url: string) => ({ data: { data: url.startsWith("/appointments") ? [appointment] : invalidSession } })); fixture.put.mockResolvedValue({ data: { data: invalidSession } });
  render(<ToastProvider><Teleconsultation /></ToastProvider>);
  fireEvent.click((await screen.findAllByRole("button", { name: "Open consultation" }))[0]);
  expect(await screen.findByText("Video meeting unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Join video meeting" })).not.toBeInTheDocument();
});
it("does not provision a session after a denied session read", async () => {
  fixture.get.mockImplementation(async (url: string) => { if (!url.startsWith("/appointments")) throw { response: { status: 403 } }; return { data: { data: [appointment] } }; });
  render(<ToastProvider><Teleconsultation /></ToastProvider>);
  fireEvent.click((await screen.findAllByRole("button", { name: "Open consultation" }))[0]);
  expect(await screen.findByText("Failed to Join Room")).toBeInTheDocument();
  expect(fixture.post).not.toHaveBeenCalled();
});
