import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PharmacyIssuerSettings } from "@/components/pharmacy/PharmacyIssuerSettings";
import { parsePharmacyIssuer } from "@/lib/pharmacyIssuer";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), put: vi.fn() } }));
const profile = (locationId = "branch-a", revision = 1) => ({ organizationId: "org", locationId, revision, registration: "regular", legalName: "Recorded issuer", address: "Recorded branch address", stateCode: "27", gstin: "27ABCDE1234F1Z5", drugLicenceNumbers: ["REVIEWED-LICENCE"], authorisedSignatory: "Recorded signatory", reviewReference: "Actual professional review 42", pricesIncludeTax: true, electronicReportingRequired: false, minimumHsnDigits: 6, issueSupported: true });
const response = (data: unknown) => ({ data: { data } });
const busy = vi.fn();
const form = (locationId = "branch-a") => <PharmacyIssuerSettings locationId={locationId} organizationId="org" onBusyChange={busy} />;
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: "owner", name: "Owner", role: "admin", email: "owner@example.test", organization_id: "org", permissions: ["MANAGE_ORGANIZATION"] } });
  vi.mocked(api.get).mockResolvedValue(response(profile()));
  vi.mocked(api.put).mockImplementation(async (_url, input) => response({ ...profile(), ...(input as object), revision: 2 }));
});
it("loads the actual branch details without silently saving or enabling access", async () => {
  render(form()); await screen.findByDisplayValue("Recorded issuer");
  expect(api.get).toHaveBeenCalledWith("/pharmacy/locations/branch-a/tax-profile?organizationId=org", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(screen.getByRole("button", { name: "Save branch issuer details" })).toBeDisabled(); expect(api.put).not.toHaveBeenCalled();
});
it("saves reviewed values against the loaded revision and excludes response metadata", async () => {
  render(form()); await screen.findByDisplayValue("Recorded issuer");
  fireEvent.change(screen.getByLabelText("Issuer review reference *"), { target: { value: "  Actual review 43  " } });
  fireEvent.click(screen.getByRole("checkbox", { name: "I confirm these branch details and the actual review reference" }));
  fireEvent.click(screen.getByRole("button", { name: "Save branch issuer details" }));
  await screen.findByText("Reviewed branch issuer details saved. Pharmacy access is configured separately.");
  const payload = vi.mocked(api.put).mock.calls[0][1] as Record<string, unknown>;
  expect(payload).toMatchObject({ expectedRevision: 1, reviewReference: "Actual review 43", drugLicenceNumbers: ["REVIEWED-LICENCE"] });
  for (const key of ["organizationId", "locationId", "revision", "issueSupported", "confirmedBy", "confirmedAt"]) expect(payload).not.toHaveProperty(key);
  expect(busy.mock.calls.map(([value]) => value)).toEqual([true, false]);
});
it("requires reload after an uncertain save and uses the subsequently confirmed revision", async () => {
  vi.mocked(api.put).mockRejectedValueOnce(new Error("Connection lost")); render(form()); await screen.findByDisplayValue("Recorded issuer");
  fireEvent.click(screen.getByRole("checkbox", { name: "I confirm these branch details and the actual review reference" })); fireEvent.click(screen.getByRole("button", { name: "Save branch issuer details" }));
  await screen.findByText("Save outcome is uncertain. Reload the branch details before another save."); expect(screen.getByRole("button", { name: "Save branch issuer details" })).toBeDisabled();
  vi.mocked(api.get).mockResolvedValue(response(profile("branch-a", 2))); fireEvent.click(screen.getByRole("button", { name: "Reload issuer details" })); await screen.findByDisplayValue("Recorded issuer");
  fireEvent.click(screen.getByRole("checkbox", { name: "I confirm these branch details and the actual review reference" })); fireEvent.click(screen.getByRole("button", { name: "Save branch issuer details" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2)); expect(vi.mocked(api.put).mock.calls[1][1]).toMatchObject({ expectedRevision: 2 });
});
it("clears branch details immediately and ignores a late previous-branch response", async () => {
  let resolve!: (value: unknown) => void; vi.mocked(api.get).mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
  const view = render(form()); vi.mocked(api.get).mockResolvedValue(response({ ...profile("branch-b"), legalName: "Second issuer" })); view.rerender(form("branch-b"));
  await screen.findByDisplayValue("Second issuer"); await act(async () => resolve(response(profile())));
  expect(screen.queryByDisplayValue("Recorded issuer")).not.toBeInTheDocument(); expect(screen.getByDisplayValue("Second issuer")).toBeInTheDocument();
});
it("clears private details when account authority is revoked", async () => {
  render(form()); await screen.findByDisplayValue("Recorded issuer"); await act(async () => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: [] } }));
  expect(screen.queryByDisplayValue("Recorded issuer")).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Save branch issuer details" })).toBeDisabled(); expect(api.put).not.toHaveBeenCalled();
});
it("retains unsupported actual requirements and reports that document issue is blocked", async () => {
  vi.mocked(api.put).mockImplementation(async (_url, input) => response({ ...profile(), ...(input as object), revision: 2, issueSupported: false })); render(form()); await screen.findByDisplayValue("Recorded issuer");
  fireEvent.click(screen.getByRole("checkbox", { name: "This issuer requires electronic invoice reporting" })); fireEvent.click(screen.getByRole("checkbox", { name: "I confirm these branch details and the actual review reference" })); fireEvent.click(screen.getByRole("button", { name: "Save branch issuer details" }));
  await screen.findByText("Details saved. Document issue is blocked by the declared pricing or electronic-reporting requirements.");
});
it.each(["branch", "organization", "support flag"])("rejects an issuer response with a different %s", kind => {
  const value = { ...profile(), ...(kind === "branch" ? { locationId: "branch-b" } : kind === "organization" ? { organizationId: "foreign" } : { issueSupported: false }) };
  expect(() => parsePharmacyIssuer(value, "branch-a", "org")).toThrow(/does not match/);
});
