import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PatientPrivacyControls } from "@/components/patients/PatientPrivacyControls";

const consent = { revision: 3, noticeVersion: "communication-choices-2026-10-v1", purposes: [{ purpose: "COMMUNICATION_WHATSAPP", status: "UNKNOWN", reviewRequired: true }] };
const privacy = { revision: 5, request: { status: "requested" }, scope: "Organization CRM only. Shared identity and clinical records retained for separate review." };
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "reviewer", name: "Reviewer", email: "reviewer@example.test", role: "admin", organization_id: "org",
    permissions: ["RECORD_COMMUNICATION_CONSENT", "ADMINISTRATIVE_GOVERNANCE", "EXPORT_CRM"] }, isAuthenticated: true });
  vi.spyOn(api, "get").mockImplementation(async path => ({ data: { data: String(path).endsWith("consents") ? consent : privacy } }));
  vi.spyOn(api, "put").mockResolvedValue({ data: { data: {} } });
  vi.spyOn(api, "post").mockResolvedValue({ data: { data: {} } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Patient privacy workflows", () => {
  it("does not grant unknown choices on read and requires explicit evidence confirmation", async () => {
    render(<PatientPrivacyControls patientId="patient" />);
    expect(await screen.findByText(/UNKNOWN.*evidence/)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Record grant" }));
    fireEvent.change(screen.getByLabelText("Patient instruction or evidence"), { target: { value: "Patient confirmed the WhatsApp choice in person" } });
    expect(screen.getByRole("button", { name: "Record choice" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /patient's explicit choice/ }));
    fireEvent.click(screen.getByRole("button", { name: "Record choice" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/dpdp/consents", expect.objectContaining({ patientId: "patient", organizationId: "org",
      expectedRevision: 3, method: "in_person_confirmation", acknowledged: true, clientRequestId: expect.any(String), updates: [{ purpose: "COMMUNICATION_WHATSAPP", status: "GRANTED" }] })));
  });
  it("retains the exact submitted withdrawal after failure without showing a successful grant", async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { message: "Consent changed. Reload before saving." } } });
    render(<PatientPrivacyControls patientId="patient" />);
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    fireEvent.change(screen.getByLabelText("Patient instruction or evidence"), { target: { value: "Patient asked to stop WhatsApp service messages" } });
    fireEvent.click(screen.getByRole("button", { name: "Record choice" }));
    expect(await screen.findByText(/Consent changed. Reload/)).toBeInTheDocument();
    expect(screen.getByLabelText("Patient instruction or evidence")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry submitted request" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.put).mock.calls[1][1]).toEqual(vi.mocked(api.put).mock.calls[0][1]);
  });
  it("reviews erasure with a record-specific basis and explicit limited-scope confirmation", async () => {
    render(<PatientPrivacyControls patientId="patient" />);
    fireEvent.click(await screen.findByRole("button", { name: "Review privacy request" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Review decision" }));
    fireEvent.click(screen.getByRole("option", { name: "Erase eligible organization CRM data" }));
    fireEvent.change(screen.getByLabelText("Record-specific retention basis"), { target: { value: "Clinical records remain under separate retention review" } });
    fireEvent.change(screen.getByLabelText("Request or review reason"), { target: { value: "Eligible CRM data reviewed" } });
    expect(screen.getByRole("button", { name: "Record choice" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /confirm erasure/ }));
    fireEvent.click(screen.getByRole("button", { name: "Record choice" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/dpdp/privacy-request/review", expect.objectContaining({ expectedRevision: 5, decision: "fulfilled", scopeConfirmed: true })));
    expect(api.post).not.toHaveBeenCalled();
  });
  it("ignores late reads from a previous workspace", async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementation(path => String(path).endsWith("consents") ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: { data: privacy } }));
    render(<PatientPrivacyControls patientId="patient" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const previousFinish = finish;
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...consent, purposes: [{ purpose: "COMMUNICATION_WHATSAPP", status: "WITHDRAWN" }] } } });
    useAuthStore.setState(state => ({ user: { ...state.user!, organization_id: "other-org", permissions: ["RECORD_COMMUNICATION_CONSENT"] } }));
    expect(await screen.findByText("WITHDRAWN")).toBeInTheDocument();
    previousFinish({ data: { data: consent } });
    await waitFor(() => expect(screen.queryByText(/UNKNOWN.*evidence/)).not.toBeInTheDocument());
  });
  it("requires patients to choose an associated organization and hides unauthorized staff controls", async () => {
    useAuthStore.setState(state => ({ user: { ...state.user!, role: "patient", permissions: [] } }));
    vi.mocked(api.get).mockResolvedValue({ data: { data: { items: [{ id: "org", name: "Associated clinic" }], nextCursor: null } } });
    const view = render(<PatientPrivacyControls patientId="patient" />);
    await screen.findByRole("combobox", { name: "Organization for privacy choices" });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/dpdp/organizations", expect.objectContaining({ params: { patientId: "patient" } })));
    expect(api.get).toHaveBeenCalledTimes(1);
    useAuthStore.setState(state => ({ user: { ...state.user!, role: "cashier", permissions: ["VIEW_PATIENTS"] } }));
    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
  });
  it("downloads truthful export pages and continues only resources with remaining records", async () => {
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:test"); static revokeObjectURL = vi.fn(); });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let page = 0;
    vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).endsWith("export")
      ? { metadata: { truncated: page++ === 0, nextCursors: page === 1 ? { appointments: "next-appointment", invoices: null } : { appointments: null } }, clinicalRecords: {} }
      : String(path).endsWith("consents") ? consent : privacy } }));
    render(<PatientPrivacyControls patientId="patient" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Download organization export" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Download organization export" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download next export page" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/dpdp/export", { params: { patientId: "patient", organizationId: "org", resources: "appointments", appointmentsCursor: "next-appointment" } }));
    expect(await screen.findByText(/No further records remain/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download next export page" })).not.toBeInTheDocument();
  });
  it('opens only the separately granted family purposes in the selected organization', async () => {
    useAuthStore.setState(state => ({ user: { ...state.user!, role: 'family_member', permissions: [] } }));
    vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).endsWith('/organizations') ? { items: [{ id: 'org', name: 'Delegated clinic', consentAuthority: true, dataRightsAuthority: false }], nextCursor: null } : consent } }));
    render(<PatientPrivacyControls patientId="dependent" />);
    const selector = await screen.findByRole('combobox', { name: 'Organization for privacy choices' });
    fireEvent.click(selector); fireEvent.click(await screen.findByRole('option', { name: 'Delegated clinic' }));
    await screen.findByRole('button', { name: 'Record grant' });
    expect(screen.queryByRole('button', { name: 'Download organization export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request organization erasure review' })).not.toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.filter(([path]) => String(path).endsWith('/privacy-request'))).toHaveLength(0);
  });
});
