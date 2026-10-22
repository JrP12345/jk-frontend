import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Locations from "@/components/organization/LocationManagement";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/authStore";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), fetch: vi.fn(), locations: [] as Record<string, unknown>[], error: null as string | null }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post, put: fixture.put, delete: fixture.delete } }));
vi.mock("@/hooks/useOrganizationLocations", () => ({ useOrganizationLocations: () => ({ locations: fixture.locations, fetchLocations: fixture.fetch, isLoading: false, error: fixture.error }) }));
vi.mock("@/components/dashboard/LocationQrPosterModal", () => ({ default: () => null }));
const location = { id: "clinic", organizationId: "org-a", slug: "sample-clinic", name: "Sample clinic", city: "Surat", address: "Sample address", phone: "9876543210", email: "clinic@example.test", facilityType: "clinic", timings: '{"Monday":[{"start":"09:00","end":"13:00"}]}', upiVpa: "clinic@bank", merchantName: "Sample clinic", isPublished: true };
const response = (data: unknown) => ({ data: { data } });
const deferred = () => { let resolve!: (value: unknown) => void; let reject!: (reason: unknown) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function mount(organizationId = "org-a") { return render(<ToastProvider><Locations organizationId={organizationId} embedded /></ToastProvider>); }
async function edit() { fireEvent.click((await screen.findAllByRole("button", { name: "Edit", exact: true }))[0]); return screen.getByRole("dialog", { name: "Edit Location" }); }
async function action(name: string) { fireEvent.click((await screen.findAllByRole("button", { name: "Actions for Sample clinic" }))[0]); fireEvent.click(await screen.findByRole("menuitem", { name, exact: true })); }
const tab = (dialog: HTMLElement, name: string) => fireEvent.click(within(dialog).getByRole("tab", { name, exact: true }));
beforeEach(() => {
  useAuthStore.setState({ user: { id: "admin", name: "Sample admin", email: "admin@example.test", role: "admin", organization_id: "org-a", permissions: ["VIEW_LOCATIONS", "MANAGE_LOCATIONS"] } });
  fixture.locations = [location]; fixture.error = null; fixture.fetch.mockReset().mockResolvedValue([location]); fixture.get.mockReset().mockResolvedValue(response([]));
  fixture.post.mockReset().mockResolvedValue(response({})); fixture.put.mockReset().mockResolvedValue(response({})); fixture.delete.mockReset().mockResolvedValue(response({}));
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("offers pharmacy settings on the existing clinic without requiring location-edit permission", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["VIEW_LOCATIONS", "PHARMACY_MANAGE_SETTINGS"] } });
  mount(); await action("Pharmacy settings");
  expect(screen.getByRole("dialog", { name: "Pharmacy settings" })).toBeInTheDocument();
  await waitFor(() => expect(fixture.get).toHaveBeenCalledWith("/pharmacy/locations/clinic/settings?organizationId=org-a", expect.anything()));
  expect(screen.queryByRole("button", { name: "Edit", exact: true })).not.toBeInTheDocument();
});

it("keeps active and archive counts while searching and uses the same controls for every location", async () => {
  fixture.locations = [location, { ...location, id: "branch", name: "Branch clinic", city: "Valsad", isPublished: false }];
  fixture.get.mockResolvedValue(response([{ ...location, id: "archived", name: "Closed clinic" }]));
  mount(); await screen.findByRole("tab", { name: /Archived\s*1/ });
  expect(screen.getByRole("tab", { name: /Active\s*2/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search locations" }), { target: { value: "Branch" } });
  expect(screen.queryByText("Sample clinic")).not.toBeInTheDocument(); expect(screen.getAllByText("Branch clinic").length).toBeGreaterThan(0);
  expect(screen.getByRole("tab", { name: /Active\s*2/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Archived\s*1/ }));
  expect(screen.getAllByText("No locations match your search.").length).toBeGreaterThan(0);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search locations" }), { target: { value: "" } });
  expect(screen.getAllByText("Closed clinic").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Edit", exact: true })).not.toBeInTheDocument();
});

it("saves edits across all four tabs using the pinned form action and organization scope", async () => {
  mount(); const dialog = await edit(); const save = within(dialog).getByRole("button", { name: "Save location" });
  expect((save as HTMLButtonElement).form?.id).toBe("location-settings");
  fireEvent.change(within(dialog).getByLabelText("Location Name *"), { target: { value: "Updated clinic" } });
  tab(dialog, "Hours"); fireEvent.change(within(dialog).getByLabelText("Branch timezone (optional)"), { target: { value: "Asia/Kolkata" } });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Parking", exact: true }));
  tab(dialog, "Payments"); fireEvent.change(within(dialog).getByLabelText("UPI address"), { target: { value: "updated@bank" } });
  fireEvent.change(within(dialog).getByLabelText("Merchant name"), { target: { value: "Updated merchant" } });
  tab(dialog, "Public page"); fireEvent.click(within(dialog).getByRole("checkbox", { name: "Publish location on Ekavyu" }));
  fireEvent.change(within(dialog).getByLabelText("Description"), { target: { value: "Updated description" } });
  tab(dialog, "Details"); expect(within(dialog).getByLabelText("Location Name *")).toHaveValue("Updated clinic");
  fireEvent.click(save);
  await waitFor(() => expect(fixture.put).toHaveBeenCalledExactlyOnceWith("/onboarding/locations/clinic?organizationId=org-a", expect.objectContaining({ name: "Updated clinic", timezone: "Asia/Kolkata", upiVpa: "updated@bank", merchantName: "Updated merchant", isPublished: false, description: "Updated description", amenities: ["Parking"], timings: location.timings })));
});

it("returns to the details tab for invalid values before attempting a save", async () => {
  mount(); const dialog = await edit();
  fireEvent.change(within(dialog).getByLabelText("Map coordinates (optional)"), { target: { value: "91, 500" } });
  tab(dialog, "Payments"); fireEvent.submit(document.getElementById("location-settings")!);
  expect(within(dialog).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  expect(await within(dialog).findByText(/Enter valid latitude, longitude/)).toBeVisible(); expect(fixture.put).not.toHaveBeenCalled();
});

it("retains form values after a failed save and blocks dismissal during the write", async () => {
  mount(); const dialog = await edit(); const pending = deferred(); fixture.put.mockReturnValue(pending.promise);
  fireEvent.change(within(dialog).getByLabelText("Location Name *"), { target: { value: "Keep this edit" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save location" }));
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Close modal" })).toBeDisabled();
  await act(async () => pending.reject(new Error("offline")));
  expect(within(dialog).getByLabelText("Location Name *")).toHaveValue("Keep this edit");
  expect(within(dialog).getByRole("button", { name: "Save location" })).toBeEnabled();
});

it("shows a failed archive read as unavailable and retries it", async () => {
  fixture.get.mockRejectedValue(new Error("offline")); mount();
  fireEvent.click(screen.getByRole("tab", { name: "Archived", exact: true }));
  expect(await screen.findByText("Unable to load results")).toBeInTheDocument();
  expect(screen.queryByText("No archived locations. Deactivated locations appear here.")).not.toBeInTheDocument();
  fixture.get.mockResolvedValue(response([{ ...location, id: "archive", name: "Archived clinic" }]));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findAllByText("Archived clinic"); expect(screen.getByRole("tab", { name: /Archived\s*1/ })).toBeInTheDocument();
});

it("deactivates only after confirmation and reactivates using the original scoped routes", async () => {
  mount(); await action("Deactivate location");
  const dialog = screen.getByRole("dialog", { name: "Deactivate Location?" }); expect(fixture.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate", exact: true }));
  await waitFor(() => expect(fixture.delete).toHaveBeenCalledExactlyOnceWith("/onboarding/locations/clinic?organizationId=org-a"));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fixture.get.mockResolvedValue(response([{ ...location, id: "archive" }]));
  fireEvent.click(screen.getByRole("button", { name: "Refresh locations" })); await screen.findByRole("tab", { name: /Archived\s*1/ });
  fireEvent.click(screen.getByRole("tab", { name: /Archived\s*1/ }));
  fireEvent.click(screen.getAllByRole("button", { name: "Reactivate", exact: true })[0]);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledExactlyOnceWith("/onboarding/locations/archive/reactivate?organizationId=org-a"));
});

it("keeps edit, publication and lifecycle mutations unavailable to a reader", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["VIEW_LOCATIONS"] } }); mount();
  await screen.findAllByText("Sample clinic"); expect(screen.queryByRole("button", { name: "Edit", exact: true })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Add location" })).not.toBeInTheDocument();
  await action("Website booking"); const dialog = screen.getByRole("dialog", { name: "Website booking" });
  expect(within(dialog).queryByRole("button", { name: "Unpublish page" })).not.toBeInTheDocument();
  expect(fixture.put).not.toHaveBeenCalled(); expect(fixture.delete).not.toHaveBeenCalled();
});

it("retries public-page readiness without enabling an unverified share link", async () => {
  const pending = deferred(); fixture.get.mockImplementation((url: string) => url.includes("/public/locations/") ? pending.promise : Promise.resolve(response([])));
  mount(); await action("Website booking"); const dialog = screen.getByRole("dialog", { name: "Website booking" });
  expect(within(dialog).getByRole("button", { name: "Copy link", exact: true })).toBeDisabled();
  await act(async () => pending.reject(new Error("offline"))); await within(dialog).findByText("Could not check the public page right now.");
  fixture.get.mockResolvedValue(response({ ...location, doctors: [], organization: { name: "Sample organization" } }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Copy link", exact: true })).toBeEnabled());
  expect((within(dialog).getByLabelText("Booking link") as HTMLInputElement).value).toContain("sample-clinic");
});

it("discards an old archived response and closes forms after changing organization", async () => {
  const previous = deferred(); fixture.get.mockReturnValue(previous.promise);
  const view = mount(); const dialog = await edit(); expect(dialog).toBeInTheDocument();
  fixture.locations = [{ ...location, id: "next", name: "Next clinic" }]; fixture.get.mockResolvedValue(response([{ ...location, id: "new-archive", name: "Next archive" }]));
  view.rerender(<ToastProvider><Locations organizationId="org-b" embedded /></ToastProvider>);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await screen.findByRole("tab", { name: /Archived\s*1/ });
  await act(async () => previous.resolve(response([{ ...location, name: "Old archive" }])));
  fireEvent.click(screen.getByRole("tab", { name: /Archived\s*1/ }));
  expect(screen.queryByText("Old archive")).not.toBeInTheDocument(); expect(screen.getAllByText("Next archive").length).toBeGreaterThan(0);
});

it("reveals required details when native validation runs from another tab", async () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Add location" }));
  const dialog = screen.getByRole("dialog", { name: "Add location" }); const name = within(dialog).getByLabelText("Location Name *");
  tab(dialog, "Payments"); fireEvent.invalid(name);
  expect(within(dialog).getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  await waitFor(() => expect(name).toHaveFocus()); expect(fixture.post).not.toHaveBeenCalled();
});

it("creates a location from the pinned action and keeps its organization and payment settings", async () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Add location" }));
  const dialog = screen.getByRole("dialog", { name: "Add location" });
  fireEvent.change(within(dialog).getByLabelText("Location Name *"), { target: { value: "New clinic" } });
  fireEvent.change(within(dialog).getByLabelText("City *"), { target: { value: "Valsad" } });
  tab(dialog, "Payments"); fireEvent.change(within(dialog).getByLabelText("UPI address"), { target: { value: "newclinic@bank" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save location" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledExactlyOnceWith("/onboarding/locations?organizationId=org-a", expect.objectContaining({ name: "New clinic", city: "Valsad", organizationId: "org-a", facilityType: "clinic", upiVpa: "newclinic@bank", latitude: null, longitude: null })));
});

it("shows organization-load failure to root and allows retry before creating a location", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "root", organization_id: undefined } });
  let fail = true; fixture.get.mockImplementation((url: string) => url === "/organizations" ? fail ? Promise.reject(new Error("offline")) : Promise.resolve(response([{ id: "org-a", name: "Sample organization" }])) : Promise.resolve(response([])));
  mount(""); fireEvent.click(screen.getByRole("button", { name: "Add location" })); const dialog = screen.getByRole("dialog", { name: "Add location" });
  expect(await within(dialog).findByText("Organizations could not be loaded.")).toBeInTheDocument();
  expect(within(dialog).getByRole("combobox", { name: "Organization *" })).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText("Location Name *"), { target: { value: "New clinic" } }); fireEvent.change(within(dialog).getByLabelText("City *"), { target: { value: "Surat" } });
  fireEvent.submit(document.getElementById("location-settings")!); expect(fixture.post).not.toHaveBeenCalled();
  fail = false; fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(dialog.querySelector('select option[value="org-a"]')).toBeInTheDocument());
  const trigger = within(dialog).getByRole("combobox", { name: "Organization *" }); const select = document.getElementById(trigger.id.replace(/-trigger$/, ""))!;
  fireEvent.change(select, { target: { value: "org-a" } }); fireEvent.click(within(dialog).getByRole("button", { name: "Save location" }));
  await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/onboarding/locations", expect.objectContaining({ organizationId: "org-a" })));
});
