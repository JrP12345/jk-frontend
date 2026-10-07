import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SetupRequestInbox from "@/components/organization/SetupRequestInbox";
import { hasRoutePermission } from "@/lib/routePermissions";

const fixture = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), user: { role: "root", impersonatedBy: null as null | { id: string } } }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, patch: fixture.patch } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
const entry = { id: "request", organization: "Care Clinic", city: "Pune", name: "Asha", email: "asha@example.test", planName: "Help me choose a plan", status: "new", createdAt: "2026-10-06T10:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); HTMLElement.prototype.scrollIntoView = vi.fn(); fixture.user = { role: "root", impersonatedBy: null }; });
afterEach(cleanup);
it("shows submitted contact details and lets root track follow-up", async () => {
  fixture.get.mockResolvedValueOnce({ data: { data: { items: [entry], nextCursor: null } } }).mockResolvedValue({ data: { data: { items: [], nextCursor: null } } });
  fixture.patch.mockResolvedValue({ data: { data: null } });
  render(<SetupRequestInbox />);
  expect(await screen.findByText("asha@example.test")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("combobox", { name: "Status for Care Clinic" }));
  fireEvent.click(screen.getByRole("option", { name: "Contacted" }));
  await waitFor(() => expect(fixture.patch).toHaveBeenCalledWith("/admin/setup-requests/request", { status: "contacted" }));
  expect(await screen.findByText("No new requests.")).toBeInTheDocument();
});
it("keeps a failed inbox read recoverable instead of claiming it is empty", async () => {
  fixture.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { data: { items: [entry], nextCursor: null } } });
  render(<SetupRequestInbox />);
  expect(await screen.findByText("Request inbox unavailable")).toBeInTheDocument();
  expect(screen.queryByText("No new requests.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Care Clinic")).toBeInTheDocument();
});
it.each(["admin", "patient"])("blocks %s from opening the inbox or reading contacts", role => {
  fixture.user.role = role;
  render(<SetupRequestInbox />);
  expect(screen.getByText("Root access required")).toBeInTheDocument();
  expect(fixture.get).not.toHaveBeenCalled();
  expect(hasRoutePermission("/dashboard/admin/setup-requests", role, ["MANAGE_ORGANIZATION"])).toBe(false);
});
it("requires root to leave impersonation before reviewing requests", () => {
  fixture.user.impersonatedBy = { id: "root" };
  render(<SetupRequestInbox />);
  expect(fixture.get).not.toHaveBeenCalled();
});
