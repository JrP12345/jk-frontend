import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FollowUpRecallRegister } from "@/components/clinical/FollowUpRecallRegister";
import { ToastProvider } from "@/components/ui";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const item = { id: "review", tokenNumber: 12, patient: { id: "patient", name: "Ananya Shah", phone: "9876543210" }, doctor: { id: "doctor", name: "Doctor" }, appointmentTime: "2026-10-18T09:00:00Z", status: "completed", statusCategory: "due_today", recallCount: 0 };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { items: [item], metrics: { totalCount: 8, dueTodayCount: 3, upcomingCount: 4, overdueCount: 1 } } } });
});
afterEach(cleanup);
function mount() { return render(<ToastProvider><FollowUpRecallRegister locationId="clinic" doctorId="doctor" /></ToastProvider>); }

it("combines counts and timeframe filtering in one set of four controls", async () => {
  mount();
  await screen.findByText("Ananya Shah");
  const filters = within(screen.getByRole("group", { name: "Follow-up filters" }));
  expect(filters.getAllByRole("button")).toHaveLength(4);
  expect(filters.getByRole("button", { name: "All follow-ups" })).toHaveTextContent("8");
  expect(filters.getByRole("button", { name: "Due today" })).toHaveTextContent("3");
  fireEvent.click(filters.getByRole("button", { name: "Next 7 days" }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/appointments/follow-ups?locationId=clinic&doctorId=doctor&timeframe=upcoming"));
  expect(filters.getByRole("button", { name: "Next 7 days" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(filters.getByRole("button", { name: "Overdue" }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/appointments/follow-ups?locationId=clinic&doctorId=doctor&timeframe=overdue"));
  fireEvent.click(filters.getByRole("button", { name: "All follow-ups" }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/appointments/follow-ups?locationId=clinic&doctorId=doctor"));
  expect(api.post).not.toHaveBeenCalled();
});

it("submits recall search with its selected timeframe and organization location scope", async () => {
  mount();
  await screen.findByText("Ananya Shah");
  fireEvent.click(screen.getByRole("button", { name: "Due today", exact: true }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search follow-up patients" }), { target: { value: "Ananya Shah" } });
  fireEvent.submit(screen.getByRole("search", { name: "Search follow-ups" }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/appointments/follow-ups?locationId=clinic&doctorId=doctor&timeframe=today&search=Ananya+Shah"));
  expect(api.post).not.toHaveBeenCalled();
});
