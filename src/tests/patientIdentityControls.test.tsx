import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PatientIdentityControls } from "@/components/patients/PatientIdentityControls";
import { AssociatePatientModal } from "@/components/patients/AssociatePatientModal";

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, writable: true, value: vi.fn() });
  useAuthStore.setState({ user: { id: "reviewer", name: "Reviewer", email: "reviewer@example.test", role: "admin", organization_id: "org",
    permissions: ["MANAGE_PATIENTS", "REVIEW_PATIENT_IDENTITY"] }, isAuthenticated: true });
  vi.spyOn(api, "get").mockImplementation(async path => ({ data: { data: String(path).endsWith("/contact")
    ? { phone: "9876500011", email: "", availability: "unknown", revision: 4 }
    : { items: [{ id: "claim", accountName: "Claimant", requestedAt: "2026-10-09T00:00:00Z" }], nextCursor: null } } }));
  vi.spyOn(api, "patch").mockResolvedValue({ data: { data: {} } });
  vi.spyOn(api, "post").mockResolvedValue({ data: { data: {} } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Patient organization contact and identity controls", () => {
  it("associates a provided canonical reference only after explicit identity verification", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: "branch", name: "Only branch" }] } });
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: "123456789012345678901234" } } });
    const associated = vi.fn();
    render(<AssociatePatientModal onClose={vi.fn()} onAssociated={associated} />);
    await waitFor(() => expect(screen.getByLabelText("Existing patient record reference")).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Existing patient record reference"), { target: { value: "123456789012345678901234" } });
    fireEvent.change(screen.getByLabelText("Identity verification reason"), { target: { value: "Independently verified the person and their authority." } });
    expect(screen.getByRole("button", { name: "Associate existing patient" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I independently verified/ }));
    fireEvent.click(screen.getByRole("button", { name: "Associate existing patient" }));
    await waitFor(() => expect(associated).toHaveBeenCalledWith("123456789012345678901234"));
    expect(api.post).toHaveBeenCalledWith("/patients/123456789012345678901234/associate", expect.objectContaining({ locationId: "branch", identityVerified: true, verificationMethod: "in_person", clientRequestId: expect.any(String) }));
    expect(api.post).toHaveBeenCalledTimes(1);
  });
  it("retains the correction and request identifier after a failure without pretending it saved", async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { message: "Contact changed. Reload before saving." } } });
    render(<PatientIdentityControls patientId="patient" />);
    fireEvent.click(await screen.findByRole("button", { name: "Correct organization contact" }));
    expect(screen.getByRole("button", { name: "Save contact correction" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Organization contact phone"), { target: { value: "9222233333" } });
    fireEvent.change(screen.getByLabelText("Correction reason"), { target: { value: "Patient corrected their organization contact." } });
    fireEvent.click(screen.getByRole("button", { name: "Save contact correction" }));
    expect(await screen.findByText("Contact changed. Reload before saving.")).toBeInTheDocument();
    expect(screen.getByLabelText("Organization contact phone")).toHaveValue("9222233333");
    fireEvent.click(screen.getByRole("button", { name: "Save contact correction" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    const first = vi.mocked(api.patch).mock.calls[0][1];
    expect(first).toMatchObject({ phone: "9222233333", expectedRevision: 4, reason: "Patient corrected their organization contact.", clientRequestId: expect.any(String) });
    expect(vi.mocked(api.patch).mock.calls[1][1]).toEqual(first);
    expect(api.post).not.toHaveBeenCalled();
  });
  it("requires explicit independent verification before approving and shows a server conflict", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: "Identity conflict requires review." } } });
    render(<PatientIdentityControls patientId="patient" />);
    fireEvent.click(await screen.findByRole("button", { name: "Review identity claim" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Identity review decision" }));
    fireEvent.click(await screen.findByRole("option", { name: "Approve verified identity" }));
    fireEvent.change(screen.getByLabelText("Identity review reason"), { target: { value: "Independently verified in person." } });
    expect(screen.getByRole("button", { name: "Record identity review" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I verified the person/ }));
    fireEvent.click(screen.getByRole("button", { name: "Record identity review" }));
    expect(await screen.findByText("Identity conflict requires review.")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/patients/patient/identity-claims/claim/review", expect.objectContaining({ decision: "approve", identityVerified: true }));
  });
  it("hides staff review controls from consumer accounts even with stale permissions", () => {
    useAuthStore.setState({ user: { id: "consumer", name: "Consumer", email: "consumer@example.test", role: "patient", permissions: ["MANAGE_PATIENTS", "REVIEW_PATIENT_IDENTITY"] } });
    const { container } = render(<PatientIdentityControls patientId="patient" />);
    expect(container).toBeEmptyDOMElement();
    expect(api.get).not.toHaveBeenCalled();
  });
});
