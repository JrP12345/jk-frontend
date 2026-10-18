import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamManagement from "@/components/organization/TeamManagement";
import { InviteOrganizationMember } from "@/components/organization/InviteOrganizationMember";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

const fixture = vi.hoisted(() => ({ locations: [{ id: "branch", name: "Only branch", city: "Surat" }], doctors: [] as Record<string, unknown>[], assignments: [] as Record<string, unknown>[], fetchLocations: vi.fn(), uploadFile: vi.fn() }));
vi.mock("@/hooks/useR2Upload", () => ({ useR2Upload: () => ({ uploadFile: fixture.uploadFile }) }));
vi.mock("@/hooks/useOrganizationLocations", () => ({ useOrganizationLocations: () => ({ locations: fixture.locations, fetchLocations: fixture.fetchLocations, activeLocationId: null }) }));
vi.mock("@/components/clinical/RBACPermissionMatrix", () => ({ RBACPermissionMatrix: () => null }));
vi.mock("@/components/analytics/ExecutiveAnalytics", () => ({ ExecutiveAnalytics: () => null }));
const admin = { id: "admin-user", name: "Owner Doctor", email: "owner@example.test", role: "admin", organization_id: "org", permissions: ["MANAGE_STAFF", "VIEW_STAFF", "VIEW_LOCATIONS", "MANAGE_ORGANIZATION"] };
const doctor = { ...admin, specialization: "General Physician", qualification: "MBBS", phone: "", experience_years: 5, fees: 600, feeType: "fixed" };
const response = (data: unknown) => ({ data: { data } });
function mount(element: React.ReactElement = <TeamManagement organizationId="org" embedded />) { return render(<ToastProvider>{element}</ToastProvider>); }
beforeEach(() => {
  fixture.locations = [{ id: "branch", name: "Only branch", city: "Surat" }]; fixture.doctors = []; fixture.assignments = [];
  fixture.fetchLocations.mockResolvedValue(fixture.locations);
  fixture.uploadFile.mockReset().mockResolvedValue({ objectKey: "doctors/profile.png", intentId: "upload-intent" });
  useAuthStore.setState({ user: admin, isAuthenticated: true });
  vi.spyOn(api, "get").mockImplementation(async path => response(String(path).includes("assignments") ? fixture.assignments : String(path).includes("/staff") ? { doctors: fixture.doctors } : []));
  vi.spyOn(api, "post").mockResolvedValue(response({ id: "doctor-profile-id", userId: admin.id }));
  vi.spyOn(api, "put").mockResolvedValue(response({}));
  vi.spyOn(api, "delete").mockResolvedValue(response({}));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Guided doctor setup", () => {
  it("uses one full-width photo control in doctor editing and retains upload and removal behavior", async () => {
    fixture.doctors = [{ ...doctor, image_url: "/existing-photo.png" }]; mount();
    fireEvent.click((await screen.findAllByTitle("Row Actions"))[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit Doctor" }));
    const dialog = screen.getByRole("dialog", { name: "Update Doctor" });
    expect(dialog.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(within(dialog).getByLabelText("Full Name *")).toHaveValue(doctor.name);
    fireEvent.click(within(dialog).getByRole("tab", { name: "Profile & practice" }));
    expect(within(dialog).getByText("Profile photo")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove file" }));
    expect(within(dialog).queryByRole("img", { name: "Preview" })).not.toBeInTheDocument();
    const image = new File(["photo"], "profile.png", { type: "image/png" });
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:profile"), revokeObjectURL: vi.fn() }));
    try {
      fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [image] } });
      expect(await within(dialog).findByRole("img", { name: "Preview" })).toHaveAttribute("src", "blob:profile");
      fireEvent.click(within(dialog).getByRole("button", { name: "Update Profile" }));
      await waitFor(() => expect(fixture.uploadFile).toHaveBeenCalledWith(image));
      await waitFor(() => expect(api.put).toHaveBeenCalledWith("/onboarding/doctor/admin-user?organizationId=org", expect.objectContaining({ name: doctor.name, image_url: "doctors/profile.png" })));
    } finally { cleanup(); vi.unstubAllGlobals(); }
  });

  it("continues a saved admin profile to a reviewed assignment using the User ID, carried fees and sole location", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Set up myself as a doctor" }));
    const profile = screen.getByRole("dialog", { name: "Set up myself as a doctor" });
    fireEvent.change(within(profile).getByLabelText(/Consultation Fee/), { target: { value: "650" } });
    fireEvent.click(within(profile).getByRole("button", { name: "Save profile & continue" }));
    const assignment = await screen.findByRole("dialog", { name: /Location Assignments/ });
    await waitFor(() => expect(within(assignment).getByRole("combobox", { name: "Select Location *" })).toHaveTextContent("Only branch"));
    expect(within(assignment).getByLabelText(/Consultation Fee/)).toHaveValue(650);
    expect(api.get).toHaveBeenCalledWith("/onboarding/doctors/assignments?doctorId=admin-user&organizationId=org", expect.anything());
    expect(api.post).toHaveBeenCalledTimes(1);
    fireEvent.click(within(assignment).getByRole("button", { name: "Assign Location" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/onboarding/doctors/assignments?organizationId=org", expect.objectContaining({ doctorId: admin.id, locationId: "branch", fees: 650, feeType: "fixed" })));
  });

  it("resumes an existing admin profile without creating or overwriting its profile", async () => {
    fixture.doctors = [doctor]; mount();
    fireEvent.click(await screen.findByRole("button", { name: "My doctor setup" }));
    const field = await screen.findByLabelText(/Consultation Fee/);
    expect(field).toHaveValue(600);
    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    expect(api.post).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled();
  });

  it.each(["free", "post_consultation"])("preserves the %s fee model on resumed setup", async feeType => {
    fixture.doctors = [{ ...doctor, feeType, fees: feeType === "free" ? 0 : 250 }]; mount();
    fireEvent.click(await screen.findByRole("button", { name: "My doctor setup" }));
    const dialog = screen.getByRole("dialog", { name: /Location Assignments/ });
    await within(dialog).findByRole("button", { name: "Assign Location" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Assign Location" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/onboarding/doctors/assignments?organizationId=org", expect.objectContaining({ feeType, fees: feeType === "free" ? 0 : 250 })));
  });

  it("requires a branch choice when more than one location is available", async () => {
    fixture.locations.push({ id: "second", name: "Second branch", city: "Surat" }); fixture.doctors = [doctor]; mount();
    fireEvent.click(await screen.findByRole("button", { name: "My doctor setup" }));
    expect(await screen.findByRole("combobox", { name: "Select Location *" })).toHaveTextContent("Choose a location...");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("recognizes populated _id assignments and avoids selecting an already assigned branch", async () => {
    fixture.doctors = [doctor]; fixture.assignments = [{ doctorId: { _id: admin.id }, locationId: { _id: "branch", name: "Only branch" }, isActive: true }]; mount();
    fireEvent.click(await screen.findByRole("button", { name: "My doctor setup" }));
    await screen.findByText(/already assigned to all active locations/);
    expect(screen.queryByRole("button", { name: "Assign Location" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Finish setup for/ })).not.toBeInTheDocument();
  });

  it("shows the exact missing assignment with a resume action and a no-location recovery link", async () => {
    fixture.doctors = [doctor]; fixture.locations = []; mount();
    fireEvent.click((await screen.findAllByRole("button", { name: "Finish setup for Owner Doctor" }))[0]);
    await screen.findByText("Create a location first");
    expect(screen.getByRole("link", { name: "Open location setup" })).toHaveAttribute("href", "/dashboard/organizations?organizationId=org&section=locations");
    expect(screen.queryByRole("button", { name: "Assign Location" })).not.toBeInTheDocument();
  });

  it("blocks guessed assignments after a failed read and supports retry", async () => {
    fixture.doctors = [doctor];
    vi.mocked(api.get).mockImplementation(async path => { if (String(path).includes("doctorId=")) throw new Error("offline"); return response(String(path).includes("/staff") ? { doctors: fixture.doctors } : []); });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "My doctor setup" }));
    await screen.findByText("Location assignments could not be loaded");
    expect(screen.queryByRole("button", { name: "Assign Location" })).not.toBeInTheDocument();
    vi.mocked(api.get).mockResolvedValue(response([]));
    fireEvent.click(screen.getByRole("button", { name: "Retry assignments" }));
    await screen.findByRole("button", { name: "Assign Location" });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("does not link the platform Root identity as the organization's doctor", async () => {
    useAuthStore.setState({ user: { ...admin, role: "root" } }); mount();
    expect(await screen.findByRole("button", { name: "Set up myself as a doctor" })).toBeDisabled();
    expect(screen.getByText(/use their organization session/)).toBeInTheDocument();
  });

  it("does not continue a late profile response after changing organization session", async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Set up myself as a doctor" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile & continue" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    await act(async () => { useAuthStore.setState({ user: { ...admin, organization_id: "other" } }); });
    await act(async () => { finish(response({ userId: admin.id })); });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Location Assignments/ })).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("does not refresh or reuse a committed assignment in a changed organization session", async () => {
    fixture.doctors = [doctor];
    let finish!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount(); fireEvent.click(await screen.findByRole("button", { name: "My doctor setup" }));
    fireEvent.click(await screen.findByRole("button", { name: "Assign Location" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    const readsBefore = vi.mocked(api.get).mock.calls.filter(([path]) => String(path).includes("doctorId=")).length;
    await act(async () => { useAuthStore.setState({ user: { ...admin, organization_id: "other" } }); });
    await act(async () => { finish(response({ id: "old-assignment" })); });
    expect(vi.mocked(api.get).mock.calls.filter(([path]) => String(path).includes("doctorId="))).toHaveLength(readsBefore);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Location Assignments/ })).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});

describe("Existing account entry", () => {
  it("offers both paths and uses the existing scoped invitation workflow", async () => {
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Add Member" }));
    expect(screen.getByRole("button", { name: "Create a new account" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use an existing account" }));
    const dialog = screen.getByRole("dialog", { name: "Invite organization member" });
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: "existing@example.test" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/onboarding/invitations?organizationId=org", { email: "existing@example.test", role: "nurse" }));
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("keeps the invitation open with entered details after delivery failure", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { message: "Try again later" } } });
    const onClose = vi.fn(); mount(<InviteOrganizationMember organizationId="org" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "existing@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
    await screen.findByText("Try again later");
    expect(screen.getByLabelText("Email")).toHaveValue("existing@example.test");
    expect(onClose).not.toHaveBeenCalled();
  });
});
