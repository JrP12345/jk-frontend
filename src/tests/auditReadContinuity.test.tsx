import { datePickerInput } from "./datePickerTestUtils";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Audit from "@/app/(dashboard)/dashboard/audit/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), allowed: true, user: { id: "root", role: "root" } }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/lib/permissions", () => ({ canViewAuditLogs: () => fixture.allowed }));
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); fixture.get.mockReset(); fixture.allowed = true; });
function base(url: string) {
  return { data: { data: url === "/organizations" ? [{ id: "new-org", name: "New organization" }] : url.startsWith("/onboarding/staff") ? { allStaff: [{ id: "doctor-user", name: "Recorded doctor", role: "doctor" }, { id: "nurse", name: "Nurse", role: "nurse" }] } : [] } };
}
it("uses grouped staff user identities in the audit query", async () => {
  fixture.get.mockImplementation(async (url: string) => base(url));
  render(<ToastProvider><Audit /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  fireEvent.click(screen.getByRole("combobox", { name: "Doctor / Staff" }));
  fireEvent.click(await screen.findByRole("option", { name: "Recorded doctor" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/audit-logs?doctorId=doctor-user&limit=100", expect.objectContaining({ signal: expect.any(AbortSignal) })));
});
it("discards a staff response from the previous organization", async () => {
  let old!: (value: unknown) => void;
  fixture.get.mockImplementation((url: string) => url === "/onboarding/staff" ? new Promise(resolve => { old = resolve; }) : Promise.resolve(base(url)));
  render(<ToastProvider><Audit /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Organization" })).toBeEnabled());
  fireEvent.click(screen.getByRole("combobox", { name: "Organization" }));
  fireEvent.click(await screen.findByRole("option", { name: "New organization" }));
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/onboarding/staff?organizationId=new-org", expect.anything()));
  await act(async () => old({ data: { data: { doctors: [{ id: "old", name: "Old organization doctor" }] } } }));
  fireEvent.click(screen.getByRole("combobox", { name: "Doctor / Staff" }));
  expect(await screen.findByRole("option", { name: "Recorded doctor" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Old organization doctor" })).not.toBeInTheDocument();
});
it("offers retry on audit failure and does not fetch for a denied identity", async () => {
  fixture.get.mockImplementation(async (url: string) => { if (url.startsWith("/audit-logs")) throw new Error("offline"); return base(url); });
  const view = render(<ToastProvider><Audit /></ToastProvider>);
  expect(await screen.findAllByText("Audit events could not be loaded. Please try again.")).not.toHaveLength(0);
  fixture.get.mockImplementation(async (url: string) => base(url));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByText("Audit events could not be loaded. Please try again.")).not.toBeInTheDocument());
  view.unmount(); fixture.allowed = false; fixture.get.mockClear();
  render(<ToastProvider><Audit /></ToastProvider>);
  expect(screen.getByText("Access Denied")).toBeInTheDocument();
  expect(fixture.get).not.toHaveBeenCalled();
});

it("keeps draft filters separate from the applied query on refresh and clears the applied scope", async () => {
  fixture.get.mockImplementation(async (url: string) => base(url));
  render(<ToastProvider><Audit /></ToastProvider>);
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh audit log" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.change(datePickerInput(screen.getByLabelText("Start Date")), { target: { value: "2026-10-01" } });
  fireEvent.change(datePickerInput(screen.getByLabelText("End Date")), { target: { value: "2026-10-17" } });
  expect(screen.queryByText(/filters applied/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/audit-logs?startDate=2026-10-01&endDate=2026-10-17&limit=100", expect.anything()));
  expect(screen.getByRole("button", { name: "Filters, 2 applied" })).toHaveAttribute("aria-expanded", "true");
  fireEvent.change(datePickerInput(screen.getByLabelText("Start Date")), { target: { value: "2026-09-01" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh audit log" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Refresh audit log" }));
  await waitFor(() => expect(fixture.get).toHaveBeenLastCalledWith("/audit-logs?startDate=2026-10-01&endDate=2026-10-17&limit=100", expect.anything()));
  await waitFor(() => expect(screen.getByRole("button", { name: "Apply Filters" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
  await waitFor(() => expect(fixture.get).toHaveBeenLastCalledWith("/audit-logs?limit=100", expect.anything()));
  expect(datePickerInput(screen.getByLabelText("Start Date"))).toHaveValue("");
  expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
});

it("searches events while keeping loaded summaries accurate and sensitive metadata hidden", async () => {
  const log = { id: "event-a", action: "SETTING_UPDATE", category: "ADMIN", targetModel: "Organization", createdAt: "2026-10-17T10:00:00Z", userId: { id: "root", name: "Root Admin", email: "root@example.test", role: "root" }, details: { setting: "Booking enabled", password: "never-render-password", accessToken: "never-render-token", raw: { nested: true } } };
  fixture.get.mockImplementation(async (url: string) => url.startsWith("/audit-logs") ? { data: { data: [log, { ...log, id: "event-b", action: "LOGIN", category: "AUTH", userId: null, details: null }] } } : base(url));
  render(<ToastProvider><Audit /></ToastProvider>);
  const card = await screen.findByRole("article", { name: "setting update by Root Admin" });
  expect(within(card).getByText("root@example.test")).toBeInTheDocument();
  expect(within(card).getByText("Booking enabled")).toBeInTheDocument();
  expect(screen.queryByText("never-render-password")).not.toBeInTheDocument();
  expect(screen.queryByText("never-render-token")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search audit events" }), { target: { value: "root@example.test" } });
  expect(screen.queryByRole("article", { name: "login by System" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Loaded audit event summary")).toHaveTextContent("Events loaded2Categories2Actors2");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search audit events" }), { target: { value: "no match" } });
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(screen.getAllByText("No audit logs match your search or filters.").length).toBeGreaterThan(0);
});

it("does not present pending or failed event counts as zero", async () => {
  let reject!: (error: Error) => void;
  fixture.get.mockImplementation((url: string) => url.startsWith("/audit-logs") ? new Promise((_resolve, fail) => { reject = fail; }) : Promise.resolve(base(url)));
  render(<ToastProvider><Audit /></ToastProvider>);
  const summary = screen.getByLabelText("Loaded audit event summary");
  expect(within(summary).getAllByText("\u2014")).toHaveLength(3);
  await act(async () => reject(new Error("offline")));
  expect(within(summary).getAllByText("\u2014")).toHaveLength(3);
  expect(screen.queryByText("No audit events recorded yet.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});
