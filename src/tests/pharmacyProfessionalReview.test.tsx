import { datePickerInput } from "./datePickerTestUtils";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PharmacyProfessionalReview } from "@/components/pharmacy/PharmacyProfessionalReview";
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
const response = (data: unknown) => ({ data: { data } });
const member = { id: "staff", name: "Registered staff", isActive: true, role: "pharmacy_pharmacist", source: "org_member" };
const review = { revision: 1, registrationNumber: "PHARM-001", council: "Council", address: "Actual professional address", reviewReference: "Actual registration evidence", validUntil: "2099-12-31T18:29:59.999Z", active: true };
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  api.get.mockImplementation(async path => response(String(path).endsWith("/members") ? { members: [member, { ...member, id: "inactive", name: "Inactive member", isActive: false }, { ...member, id: "patient", name: "Patient", role: "patient" }] } : null));
  api.put.mockImplementation(async (_path, body) => response({ ...body, revision: body.expectedRevision + 1 }));
});
async function choose() {
  const select = await screen.findByRole("combobox", { name: "Staff member" });
  await waitFor(() => expect(select).toBeEnabled()); fireEvent.click(select);
  expect(screen.queryByRole("option", { name: /Inactive member|Patient/ })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("option", { name: /Registered staff/ }));
  await waitFor(() => expect(screen.getByLabelText("Pharmacist registration number")).toBeEnabled());
}
it("uses current branch/staff identity and requires explicit evidence confirmation before activation", async () => {
  render(<PharmacyProfessionalReview organizationId="org" locationId="branch" onClose={vi.fn()} />); await choose();
  expect(api.get).toHaveBeenCalledWith("/pharmacy/locations/branch/professionals/staff/pharmacist", expect.any(Object));
  for (const [label, value] of [["Pharmacist registration number", "PHARM-001"], ["Registration council", "Council"], ["Professional address", "Actual professional address"], ["Registration evidence reference", "Actual registration evidence"], ["Registration review valid until", "2099-12-31"]]) fireEvent.change(label === "Registration review valid until" ? datePickerInput(screen.getByLabelText(label)) : screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByLabelText("Active registration review for this branch"));
  const save = screen.getByRole("button", { name: "Save registration review" }); expect(save).toBeDisabled();
  fireEvent.click(screen.getByLabelText("I reviewed the pharmacist registration evidence and branch assignment."));
  fireEvent.change(screen.getByLabelText("Registration evidence reference"), { target: { value: "New actual registration evidence" } });
  expect(save).toBeDisabled(); fireEvent.click(screen.getByLabelText("I reviewed the pharmacist registration evidence and branch assignment."));
  fireEvent.click(save); await screen.findByText("Registration review saved for this branch.");
  expect(api.put).toHaveBeenCalledWith("/pharmacy/locations/branch/professionals/staff/pharmacist", { expectedRevision: 0, registrationNumber: "PHARM-001", council: "Council", address: "Actual professional address", reviewReference: "New actual registration evidence", validUntil: "2099-12-31T23:59:59.999+05:30", active: true });
  expect(save).toBeDisabled();
});
it("reloads a conflicted review before another write and permits deactivation without inventing fresh evidence", async () => {
  api.get.mockImplementation(async path => response(String(path).endsWith("/members") ? { members: [member] } : review));
  api.put.mockRejectedValueOnce({ response: { status: 409, data: { message: "Professional review changed; reload before saving" } } });
  render(<PharmacyProfessionalReview organizationId="org" locationId="branch" onClose={vi.fn()} />); await choose();
  fireEvent.click(screen.getByLabelText("I reviewed the pharmacist registration evidence and branch assignment."));
  fireEvent.click(screen.getByRole("button", { name: "Save registration review" }));
  await screen.findByText("Professional review changed; reload before saving");
  expect(screen.getByRole("button", { name: "Save registration review" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reload saved review" }));
  await waitFor(() => expect(screen.getByLabelText("Pharmacist registration number")).toBeEnabled());
  fireEvent.click(screen.getByLabelText("Active registration review for this branch"));
  fireEvent.click(screen.getByRole("button", { name: "Save registration review" }));
  await screen.findByText(/Registration review deactivated/);
  expect(api.put.mock.calls[1][1]).toMatchObject({ expectedRevision: 1, active: false });
});
