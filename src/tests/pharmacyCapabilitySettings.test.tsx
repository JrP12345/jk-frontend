import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { pharmacyActions } from "@/lib/pharmacyCapabilities";
import { PharmacyCapabilitySettings } from "@/components/pharmacy/PharmacyCapabilitySettings";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
const caps = (revision = 0) => ({ locationId: "clinic", enabled: true, moduleEnabled: true, revision, mode: "legacy_included",
  actions: Object.fromEntries(pharmacyActions.map(action => [action, action === "manageSettings"])) });
const response = (data: unknown) => ({ data: { data } });
const mount = (onSaved = vi.fn(), onClose = vi.fn()) => render(<PharmacyCapabilitySettings location={{ id: "clinic", name: "Existing clinic" }} organizationId="org" onSaved={onSaved} onClose={onClose} />);
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: "manager", name: "Manager", email: "manager@example.test", role: "branch_manager", organization_id: "org", permissions: ["PHARMACY_MANAGE_SETTINGS"] } });
  vi.mocked(api.get).mockResolvedValue(response(caps()));
  vi.mocked(api.patch).mockResolvedValue(response(caps(1)));
});

it("requires an actual review reference and saves against the existing location and revision", async () => {
  const onSaved = vi.fn(), onClose = vi.fn(); mount(onSaved, onClose);
  const toggle = await screen.findByRole("checkbox", { name: "Enable pharmacy at this location" });
  expect(screen.getByRole("button", { name: "Save pharmacy settings" })).toBeDisabled();
  fireEvent.click(toggle); fireEvent.change(screen.getByLabelText("Review reference *"), { target: { value: "  Local review 42  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save pharmacy settings" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce()); expect(onClose).toHaveBeenCalledOnce();
  expect(api.patch).toHaveBeenCalledWith("/pharmacy/locations/clinic/settings?organizationId=org", { enabled: false, expectedRevision: 0, reviewReference: "Local review 42" });
});
it("keeps issuer administration restricted to organization managers and does not load it for branch settings staff", async () => {
  mount(); await screen.findByRole("checkbox"); expect(screen.queryByRole("button", { name: "Review issuer and licence details" })).not.toBeInTheDocument();
  expect(vi.mocked(api.get).mock.calls.every(([url]) => String(url).includes("/settings"))).toBe(true);
});
it("opens owner issuer review for the same branch without changing its capability or creating a location", async () => {
  useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ["MANAGE_ORGANIZATION"] } });
  vi.mocked(api.get).mockImplementation(async url => response(String(url).includes("/tax-profile") ? null : caps()));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Review issuer and licence details" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/pharmacy/locations/clinic/tax-profile?organizationId=org", expect.anything()));
  const issuer = screen.getByRole("form", { name: "Branch issuer and licence details" });
  expect(issuer.parentElement?.closest("form")).toBeNull(); expect(api.patch).not.toHaveBeenCalled();
});
it("requires reload after a conflict and uses the refreshed revision for the next save", async () => {
  vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 409, data: { message: "Reload newer settings" } } });
  mount(); await screen.findByRole("checkbox");
  fireEvent.change(screen.getByLabelText("Review reference *"), { target: { value: "Review 42" } }); fireEvent.click(screen.getByRole("button", { name: "Save pharmacy settings" }));
  await screen.findByText("Reload newer settings"); expect(screen.getByRole("button", { name: "Save pharmacy settings" })).toBeDisabled();
  vi.mocked(api.get).mockResolvedValue(response(caps(3)));
  fireEvent.click(screen.getByRole("button", { name: "Reload settings" })); await screen.findByRole("checkbox");
  fireEvent.change(screen.getByLabelText("Review reference *"), { target: { value: "Review 43" } }); fireEvent.click(screen.getByRole("button", { name: "Save pharmacy settings" }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.patch).mock.calls[1][1]).toMatchObject({ expectedRevision: 3 });
});
it("disables saving when settings are unavailable or malformed", async () => {
  vi.mocked(api.get).mockResolvedValue(response({ enabled: true })); mount();
  await screen.findByText("Settings unavailable"); expect(screen.getByRole("button", { name: "Save pharmacy settings" })).toBeDisabled();
  expect(api.patch).not.toHaveBeenCalled();
});
it("does not save after the effective account loses the settings permission", async () => {
  mount(); await screen.findByRole("checkbox");
  fireEvent.change(screen.getByLabelText("Review reference *"), { target: { value: "Review 42" } });
  await act(async () => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } }));
  fireEvent.click(screen.getByRole("button", { name: "Save pharmacy settings" })); expect(api.patch).not.toHaveBeenCalled();
});
