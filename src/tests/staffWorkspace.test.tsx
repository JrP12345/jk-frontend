import { datePickerInput } from "./datePickerTestUtils";
﻿import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TeamManagement from "@/components/organization/TeamManagement";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), upload: vi.fn(), fetch: vi.fn(), activeLocationId: null as string | null, locations: [{ id: "clinic", name: "Sample clinic", city: "Surat" }] }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post, put: fixture.put, delete: fixture.delete } }));
vi.mock("@/hooks/useR2Upload", () => ({ useR2Upload: () => ({ uploadFile: fixture.upload }) }));
vi.mock("@/hooks/useOrganizationLocations", () => ({ useOrganizationLocations: () => ({ locations: fixture.locations, fetchLocations: fixture.fetch, activeLocationId: fixture.activeLocationId }) }));
vi.mock("@/components/clinical/RBACPermissionMatrix", () => ({ RBACPermissionMatrix: () => <p>Scoped permissions panel</p> }));
vi.mock("@/components/analytics/ExecutiveAnalytics", () => ({ ExecutiveAnalytics: () => <p>Existing insights panel</p> }));
const doctor = { id: "doctor", name: "Sample doctor", email: "doctor@example.test", phone: "9876543210", specialization: "General medicine", qualification: "MBBS", fees: 500, feeType: "fixed" };
const nurse = { id: "nurse", name: "Sample nurse", email: "nurse@example.test", role: "nurse", locationName: "Sample clinic" };
const assignment = { id: "assignment", doctorId: { id: "doctor" }, locationId: fixture.locations[0], fees: 500, feeType: "fixed", appointmentDuration: 15, workingHours: '{"Monday":[{"start":"09:00","end":"13:00"}]}', bookingMode: "sequential_queue" };
const response = (data: unknown) => ({ data: { data } });
const deferred = () => { let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function mount() { return render(<ToastProvider><TeamManagement organizationId="org" /></ToastProvider>); }
async function action(label: string) { fireEvent.click((await screen.findAllByRole("button", { name: "Actions for Sample doctor" }))[0]); fireEvent.click(await screen.findByRole("menuitem", { name: label })); }
async function newMember(role = "doctor") {
  fireEvent.click(screen.getByRole("button", { name: "Add Member" })); fireEvent.click(await screen.findByRole("button", { name: "Create a new account" }));
  const dialog = screen.getByRole("dialog", { name: "Add Team Member" });
  if (role !== "doctor") { fireEvent.click(within(dialog).getByRole("combobox", { name: "Role & Designation *" })); fireEvent.click(await screen.findByRole("option", { name: role, exact: true })); }
  fireEvent.change(within(dialog).getByLabelText("Full Name *"), { target: { value: "New member" } });
  fireEvent.change(within(dialog).getByLabelText("Email Address *"), { target: { value: "new@example.test" } });
  fireEvent.change(within(dialog).getByLabelText("Password *"), { target: { value: "Sample-password-123" } });
  return dialog;
}
beforeEach(() => {
  useAuthStore.setState({ user: { id: "admin", name: "Sample admin", email: "admin@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_STAFF", "VIEW_STAFF", "VIEW_LOCATIONS", "VIEW_ANALYTICS"] } });
  fixture.activeLocationId = null; fixture.fetch.mockReset().mockResolvedValue(fixture.locations);
  fixture.get.mockReset().mockImplementation(async (url: string) => response(url.includes("/onboarding/staff") ? { doctors: [doctor], nurses: [nurse] } : url.includes("doctorId=") ? [assignment] : url.includes("/doctors/assignments") ? [assignment] : []));
  fixture.post.mockReset().mockResolvedValue(response({ id: "new-doctor" })); fixture.put.mockReset().mockResolvedValue(response({})); fixture.delete.mockReset().mockResolvedValue(response({}));
  fixture.upload.mockReset().mockResolvedValue({ objectKey: "tenants/org/verified/photo.png", intentId: "photo" });
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:staff-photo"), revokeObjectURL: vi.fn() }));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps staff counts across workspace tabs and searches role-filtered results", async () => {
  mount(); await screen.findAllByText("Sample doctor");
  expect(screen.getByRole("tab", { name: /Staff\s*2/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Permissions" })); expect(screen.getByText("Scoped permissions panel")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Insights" })); expect(screen.getByText("Existing insights panel")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Staff\s*2/ }));
  fireEvent.click(screen.getByRole("combobox", { name: "Filter by role" })); fireEvent.click(await screen.findByRole("option", { name: "Nurses (1)" }));
  expect(screen.queryByText("Sample doctor")).not.toBeInTheDocument(); expect(screen.getAllByText("Sample nurse").length).toBeGreaterThan(0);
  expect(screen.getByRole("tab", { name: /Staff\s*2/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search staff" }), { target: { value: "missing" } });
  expect(screen.getAllByText("No team members match your filters.").length).toBeGreaterThan(0);
});

it("hides old staff immediately on location changes and ignores a late previous response", async () => {
  const view = mount(); await screen.findAllByText("Sample doctor");
  const previous = deferred(), next = deferred(); fixture.get.mockImplementation((url: string) => url.includes("locationId=first") ? previous.promise : url.includes("locationId=next") ? next.promise : Promise.resolve(response([])));
  fixture.activeLocationId = "first"; view.rerender(<ToastProvider><TeamManagement organizationId="org" /></ToastProvider>);
  expect(screen.queryByText("Sample doctor")).not.toBeInTheDocument();
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith(expect.stringContaining("locationId=first"), expect.anything()));
  fixture.activeLocationId = "next"; view.rerender(<ToastProvider><TeamManagement organizationId="org" /></ToastProvider>);
  await act(async () => next.resolve(response({ nurses: [{ ...nurse, name: "Next nurse" }] })));
  await screen.findAllByText("Next nurse");
  await act(async () => previous.resolve(response({ doctors: [doctor] })));
  expect(screen.queryByText("Sample doctor")).not.toBeInTheDocument();
});

it("offers retry after a failed staff read without treating it as an empty directory", async () => {
  const original = fixture.get.getMockImplementation()!; fixture.get.mockImplementation((url: string) => url.includes("/onboarding/staff") ? Promise.reject(new Error("offline")) : original(url));
  mount(); expect(await screen.findByText("Unable to load results")).toBeInTheDocument();
  expect(screen.queryByText("No team members yet. Add a member to get started.")).not.toBeInTheDocument();
  fixture.get.mockImplementation(original); fireEvent.click(screen.getByRole("button", { name: "Try again" })); await screen.findAllByText("Sample doctor");
});

it("creates a receptionist from the pinned form and preserves its sole location", async () => {
  mount(); await screen.findAllByText("Sample doctor"); const dialog = await newMember("Receptionist");
  fireEvent.click(within(dialog).getByRole("tab", { name: "Profile & practice" }));
  fireEvent.change(within(dialog).getByLabelText("Shift Schedule"), { target: { value: "Morning" } });
  const submit = within(dialog).getByRole("button", { name: "Add Team Member" }); expect((submit as HTMLButtonElement).form?.id).toBe("staff-form"); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/onboarding/receptionist?organizationId=org", expect.objectContaining({ name: "New member", email: "new@example.test", locationId: "clinic", shift: "Morning" })));
});

it("uploads Root's selected-organization staff photo before creating the member", async () => {
  useAuthStore.setState({ user: { id: "root", name: "Root", email: "root@example.test", role: "root" } });
  mount(); await screen.findAllByText("Sample doctor"); const dialog = await newMember("Receptionist");
  fireEvent.click(within(dialog).getByRole("tab", { name: "Profile & practice" }));
  const photo = new File(["synthetic photo"], "staff.png", { type: "image/png" });
  fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [photo] } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add Team Member" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/onboarding/receptionist?organizationId=org", expect.objectContaining({ image_url: "tenants/org/verified/photo.png", locationId: "clinic" })));
  expect(fixture.upload).toHaveBeenCalledWith(photo, { organizationId: "org", contentClass: "avatar" });
  expect(useAuthStore.getState().user).toMatchObject({ id: "root", role: "root" });
  expect(useAuthStore.getState().user?.organization_id).toBeUndefined();
  expect(screen.queryByText("Uploading photo")).not.toBeInTheDocument();
});

it("retains the selected photo and form on upload failure without creating a member", async () => {
  fixture.upload.mockRejectedValue(new Error("Upload failed"));
  mount(); await screen.findAllByText("Sample doctor"); const dialog = await newMember("Receptionist");
  fireEvent.click(within(dialog).getByRole("tab", { name: "Profile & practice" }));
  fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [new File(["photo"], "staff.png", { type: "image/png" })] } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add Team Member" }));
  await screen.findByText("Failed to save staff member");
  expect(fixture.post).not.toHaveBeenCalled();
  expect(screen.queryByText("Uploading photo")).not.toBeInTheDocument();
  expect(within(dialog).getByLabelText("Full Name *")).toHaveValue("New member");
  fixture.upload.mockResolvedValue({ objectKey: "tenants/org/verified/photo.png", intentId: "photo" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add Team Member" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledOnce());
});

it("does not create staff from an upload that finishes after the selected organization changes", async () => {
  const pending = deferred(); fixture.upload.mockReturnValue(pending.promise);
  const view = mount(); await screen.findAllByText("Sample doctor"); const dialog = await newMember("Receptionist");
  fireEvent.click(within(dialog).getByRole("tab", { name: "Profile & practice" }));
  fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [new File(["photo"], "staff.png", { type: "image/png" })] } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add Team Member" }));
  await waitFor(() => expect(fixture.upload).toHaveBeenCalledOnce());
  view.rerender(<ToastProvider><TeamManagement organizationId="other" /></ToastProvider>);
  await act(async () => pending.resolve({ objectKey: "tenants/org/verified/photo.png", intentId: "photo" }));
  expect(fixture.post).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Uploading photo")).not.toBeInTheDocument();
});

it("returns to the account tab for invalid fields and keeps edits after a failed save", async () => {
  mount(); await action("Edit Doctor"); const dialog = screen.getByRole("dialog", { name: "Update Doctor" });
  fireEvent.change(within(dialog).getByLabelText("Email Address *"), { target: { value: "invalid" } });
  fireEvent.click(within(dialog).getByRole("tab", { name: "Profile & practice" })); fireEvent.submit(document.getElementById("staff-form")!);
  expect(within(dialog).getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true"); expect(fixture.put).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText("Email Address *"), { target: { value: "edited@example.test" } });
  const save = deferred(); fixture.put.mockReturnValue(save.promise); fireEvent.click(within(dialog).getByRole("button", { name: "Update Profile" }));
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  await act(async () => save.reject(new Error("offline"))); expect(within(dialog).getByLabelText("Email Address *")).toHaveValue("edited@example.test");
});

it("edits the selected assignment and submits fees and hours through its pinned action", async () => {
  mount(); fireEvent.click((await screen.findAllByRole("button", { name: "Assignments for Sample doctor" }))[0]);
  const dialog = screen.getByRole("dialog", { name: /Location Assignments/ });
  fireEvent.click(await within(dialog).findByRole("button", { name: "Edit", exact: true }));
  const fee = within(dialog).getByLabelText(/Consultation Fee/); expect(fee).toHaveValue(500); fireEvent.change(fee, { target: { value: "650" } });
  const save = within(dialog).getByRole("button", { name: "Update Branch Assignment" }); expect((save as HTMLButtonElement).form?.id).toBe("doctor-assignment"); fireEvent.click(save);
  await waitFor(() => expect(fixture.put).toHaveBeenCalledExactlyOnceWith("/onboarding/doctors/assignments/assignment?organizationId=org", expect.objectContaining({ fees: 650, workingHours: assignment.workingHours, appointmentDuration: 15, bookingMode: "sequential_queue" })));
});

it("keeps leave unavailable after a failed read and supports retry before saving", async () => {
  const original = fixture.get.getMockImplementation()!; fixture.get.mockImplementation((url: string) => url.includes("/doctor-overrides") ? Promise.reject(new Error("offline")) : original(url));
  mount(); await action("Leave & holidays"); const dialog = screen.getByRole("dialog", { name: "Leave & holidays" });
  expect(await within(dialog).findByText("Leave could not be loaded")).toBeInTheDocument(); expect(within(dialog).getByRole("button", { name: "Save leave" })).toBeDisabled();
  fixture.get.mockImplementation(original); fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Save leave" })).toBeEnabled());
  fireEvent.change(datePickerInput(within(dialog).getByLabelText("Leave date *")), { target: { value: "2026-11-01" } }); fireEvent.change(within(dialog).getByLabelText("Reason *"), { target: { value: "Conference" } });
  const submit = within(dialog).getByRole("button", { name: "Save leave" }); expect((submit as HTMLButtonElement).form?.id).toBe("doctor-leave"); fireEvent.click(submit);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/doctor-overrides?organizationId=org", { doctorId: "doctor", locationId: "all", date: "2026-11-01", status: "unavailable", reason: "Conference" }));
});

it("cancels only the selected leave entry and preserves failures for retry", async () => {
  const original = fixture.get.getMockImplementation()!; fixture.get.mockImplementation((url: string) => url.includes("/doctor-overrides") ? Promise.resolve(response([{ id: "leave", date: "2026-11-01", reason: "Conference", locationId: fixture.locations[0] }])) : original(url));
  mount(); await action("Leave & holidays"); const dialog = screen.getByRole("dialog", { name: "Leave & holidays" });
  fireEvent.click(within(dialog).getByRole("tab", { name: /Scheduled/ }));
  const cancel = await within(dialog).findByRole("button", { name: "Cancel leave" }); fixture.delete.mockRejectedValueOnce(new Error("offline")); fireEvent.click(cancel);
  await screen.findAllByText("Could not cancel leave"); expect(within(dialog).getByText("Conference")).toBeInTheDocument(); fireEvent.click(cancel);
  await waitFor(() => expect(within(dialog).queryByText("Conference")).not.toBeInTheDocument()); expect(fixture.delete).toHaveBeenCalledWith("/doctor-overrides/leave?organizationId=org");
});

it("does not expose profile, leave or assignment mutations to a reader", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["VIEW_STAFF"] } }); mount(); await screen.findAllByText("Sample doctor");
  expect(screen.queryByRole("button", { name: "Add Member" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Actions for Sample doctor" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Assignments for Sample doctor" })).not.toBeInTheDocument(); expect(fixture.post).not.toHaveBeenCalled();
  expect(screen.queryByRole("tab", { name: "Permissions" })).not.toBeInTheDocument(); expect(screen.queryByRole("tab", { name: "Insights" })).not.toBeInTheDocument();
});

it("does not create an automatic assignment from a late account response after switching organization", async () => {
  mount(); await screen.findAllByText("Sample doctor"); const dialog = await newMember(); fireEvent.click(within(dialog).getByRole("tab", { name: "Profile & practice" }));
  fireEvent.change(within(dialog).getByLabelText("Specialization *"), { target: { value: "General medicine" } });
  const write = deferred(); fixture.post.mockReturnValue(write.promise); fireEvent.click(within(dialog).getByRole("button", { name: "Add Team Member" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledOnce());
  act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, organization_id: "other" } }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); await act(async () => write.resolve(response({ id: "created-doctor" })));
  expect(fixture.post).toHaveBeenCalledTimes(1);
});

it("preserves an assignment after failed removal and prevents duplicate requests on retry", async () => {
  mount(); fireEvent.click((await screen.findAllByRole("button", { name: "Assignments for Sample doctor" }))[0]);
  const dialog = screen.getByRole("dialog", { name: "Location Assignments" }); const remove = await within(dialog).findByRole("button", { name: "Remove" });
  fixture.delete.mockRejectedValueOnce(new Error("offline")); fireEvent.click(remove); await screen.findByText("Failed to remove assignment");
  expect(within(dialog).getByText("Sample clinic")).toBeInTheDocument(); const pending = deferred(); fixture.delete.mockReturnValue(pending.promise); fireEvent.click(remove); fireEvent.click(remove);
  expect(fixture.delete).toHaveBeenCalledTimes(2); expect(within(dialog).getByRole("button", { name: "Done" })).toBeDisabled();
  const original = fixture.get.getMockImplementation()!; fixture.get.mockImplementation((url: string) => url.includes("doctorId=") ? Promise.resolve(response([])) : original(url));
  await act(async () => pending.resolve(response({}))); await waitFor(() => expect(within(dialog).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument());
  expect(fixture.delete).toHaveBeenLastCalledWith("/onboarding/doctors/assignments/assignment?organizationId=org");
});

it("requires account deactivation confirmation and leaves a failed request available for retry", async () => {
  mount(); await action("Deactivate account"); const dialog = screen.getByRole("dialog", { name: "Deactivate Staff Account?" });
  expect(fixture.delete).not.toHaveBeenCalled(); fixture.delete.mockRejectedValueOnce(new Error("offline")); const confirm = within(dialog).getByRole("button", { name: "Deactivate Account" }); fireEvent.click(confirm);
  await screen.findByText("Staff could not be deactivated. Please retry."); expect(dialog).toBeInTheDocument();
  const pending = deferred(); fixture.delete.mockReturnValue(pending.promise); fireEvent.click(confirm); fireEvent.click(confirm);
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled(); expect(fixture.delete).toHaveBeenCalledTimes(2);
  await act(async () => pending.resolve(response({}))); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(fixture.delete).toHaveBeenLastCalledWith("/onboarding/staff/doctor?organizationId=org");
});
