import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
