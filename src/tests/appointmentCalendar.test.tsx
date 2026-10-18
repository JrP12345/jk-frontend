import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppointmentCalendarView } from "@/components/clinical/AppointmentCalendarView";

const visit = { id: "visit", tokenNumber: 5, appointmentTime: "2026-10-18T20:00:00.000Z", status: "confirmed", patientId: { name: "Registered without login", phone: "9876543210" }, doctorId: { name: "Assigned practitioner" }, locationId: { name: "Care Clinic" } };
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("uses the selected facility's day and canonical patient identity in the agenda and details", () => {
  render(<AppointmentCalendarView appointments={[visit]} initialDate="2026-10-19" timeZone="Asia/Kolkata" />);
  fireEvent.click(screen.getByRole("button", { name: /Registered without login/ }));
  const dialog = screen.getByRole("dialog", { name: "Appointment #5" });
  expect(within(dialog).getByText("Registered without login")).toBeInTheDocument();
  expect(within(dialog).getByText(/9876543210/)).toBeInTheDocument();
  expect(within(dialog).getByText(/1:30:00 am/i)).toBeInTheDocument();
});

it("reports Monday-to-Sunday and full month ranges when changing calendar periods", () => {
  const range = vi.fn();
  render(<AppointmentCalendarView appointments={[]} initialDate="2026-10-18" onRangeChange={range} />);
  expect(range).toHaveBeenLastCalledWith("2026-10-18", "2026-10-18");
  fireEvent.click(screen.getByRole("button", { name: "week" }));
  expect(range).toHaveBeenLastCalledWith("2026-10-12", "2026-10-18");
  fireEvent.click(screen.getByRole("button", { name: "month" }));
  expect(range).toHaveBeenLastCalledWith("2026-10-01", "2026-10-31");
  fireEvent.click(screen.getByRole("button", { name: /Next/ }));
  expect(range).toHaveBeenLastCalledWith("2026-11-01", "2026-11-30");
});

it("makes every appointment on a crowded month date reachable through its daily agenda", () => {
  render(<AppointmentCalendarView appointments={Array.from({ length: 4 }, (_, index) => ({ ...visit, id: "visit-" + index, patientId: { name: "Patient " + index } }))} initialDate="2026-10-19" timeZone="Asia/Kolkata" />);
  fireEvent.click(screen.getByRole("button", { name: "month" }));
  fireEvent.click(screen.getByRole("button", { name: "October 19, 4 visits. Open day" }));
  expect(screen.getByRole("button", { name: "day" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: /Patient 3/ })).toBeInTheDocument();
});

it("does not offer rescheduling for a completed appointment or a reader without schedule access", () => {
  const reschedule = vi.fn();
  const { unmount } = render(<AppointmentCalendarView appointments={[{ ...visit, status: "completed" }]} initialDate="2026-10-19" timeZone="Asia/Kolkata" onRescheduleClick={reschedule} />);
  fireEvent.click(screen.getByRole("button", { name: /Registered without login/ }));
  expect(screen.queryByRole("button", { name: "Reschedule appointment" })).not.toBeInTheDocument();
  unmount();
  render(<AppointmentCalendarView appointments={[visit]} initialDate="2026-10-19" timeZone="Asia/Kolkata" onRescheduleClick={reschedule} canReschedule={false} />);
  fireEvent.click(screen.getByRole("button", { name: /Registered without login/ }));
  expect(screen.queryByRole("button", { name: "Reschedule appointment" })).not.toBeInTheDocument();
  expect(reschedule).not.toHaveBeenCalled();
});
