import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { InquiryWorkspace } from "@/components/crm/InquiryWorkspace";

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const inquiry = { id: "inquiry", locationId: "branch", callerName: "Caller", phone: "", email: "", source: "unknown", sourceEvidence: "unknown", reasonForContact: "booking", requestedService: "", status: "open", ownerId: "staff",
  nextAction: { kind: "review", dueAt: "2026-10-10T12:00:00.000Z" }, revision: 2 };
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "staff", name: "Staff", email: "staff@example.test", role: "receptionist", organization_id: "org", permissions: ["VIEW_CRM", "MANAGE_CRM_INQUIRIES"] }, isAuthenticated: true });
  vi.spyOn(api, "get").mockImplementation(async path => ({ data: { data: String(path) === "/crm/locations" ? [{ id: "branch", name: "Only branch", effectiveTimezone: "Asia/Kolkata" }]
    : String(path) === "/crm/assignees" ? { items: [{ id: "staff", name: "Staff" }], truncated: false }
    : String(path) === "/crm/inquiries/inquiry" ? { inquiry, activities: [], nextActivityCursor: null } : { items: [inquiry], nextCursor: null } } }));
  vi.spyOn(api, "post").mockResolvedValue({ data: { data: { ...inquiry, revision: 0 } } });
  vi.spyOn(api, "patch").mockResolvedValue({ data: { data: { inquiry: { ...inquiry, revision: 3 } } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Inquiry workspace", () => {
  it('lets platform root explicitly open a CRM organization without impersonating staff', async () => {
    useAuthStore.setState({ user: { id: 'root', name: 'Root', email: 'root@example.test', role: 'root' } });
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'org', name: 'Clinic', status: 'active' }] } });
    const switchOrg = vi.fn().mockResolvedValue(undefined);
    const original = useAuthStore.getState().switchOrg;
    useAuthStore.setState({ switchOrg });
    try {
      render(<InquiryWorkspace />);
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'CRM organization' })).toBeEnabled());
      expect(api.get).not.toHaveBeenCalledWith('/crm/inquiries', expect.anything());
      fireEvent.click(screen.getByRole('combobox', { name: 'CRM organization' }));
      fireEvent.click(screen.getByRole('option', { name: 'Clinic' }));
      fireEvent.click(screen.getByRole('button', { name: 'Open organization CRM' }));
      await waitFor(() => expect(switchOrg).toHaveBeenCalledWith('org'));
    } finally { useAuthStore.setState({ switchOrg: original }); }
  });
  it('keeps an uncertain conversion across dialog close and resets it when workspace authority changes', async () => {
    const patientId = '1234567890abcdef12345678';
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ['VIEW_CRM', 'MANAGE_CRM_INQUIRIES', 'MANAGE_APPOINTMENTS'] } });
    const get = vi.mocked(api.get).getMockImplementation()!;
    vi.mocked(api.get).mockImplementation(async (path, config) => String(path).includes('/assignments')
      ? { data: { data: [{ doctorId: { id: 'doctor', name: 'Doctor' }, bookingMode: 'sequential_queue' }] } }
      : String(path).includes('/slots') ? { data: { data: { slots: [], isHoliday: false } } } : get(path, config));
    vi.mocked(api.post).mockRejectedValueOnce(new Error('response lost'));
    render(<InquiryWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open inquiry' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Convert inquiry to booking' }));
    fireEvent.change(screen.getByLabelText('Canonical patient reference'), { target: { value: patientId } });
    fireEvent.click(screen.getByRole('checkbox', { name: /I verified the patient identity/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Convert to booking' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Convert to booking' }));
    await screen.findByText(/booking result could not be confirmed/);
    const command = vi.mocked(api.post).mock.calls[0][1];
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Resume submitted booking' }));
    vi.mocked(api.post).mockRejectedValueOnce(new Error('response still lost'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry submitted conversion' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(command);
    await screen.findByText(/booking result could not be confirmed/);
    act(() => useAuthStore.setState({ user: { ...useAuthStore.getState().user!, permissions: ['VIEW_CRM'] } }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume submitted booking' })).not.toBeInTheDocument();
  });
  it("captures an anonymous inquiry with unknown source and converts the displayed branch time correctly", async () => {
    render(<InquiryWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Capture inquiry" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save inquiry" })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Next action due (Asia/Kolkata)"), { target: { value: "2026-10-10T17:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save inquiry" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/crm/inquiries", expect.objectContaining({ callerName: "", phone: "", source: "unknown", ownerId: "staff", locationId: "branch",
      nextAction: { kind: "review", dueAt: "2026-10-10T12:00:00.000Z" }, clientRequestId: expect.any(String) })));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Inquiry details" })).toBeInTheDocument();
  });
  it("keeps a failed inquiry submission locked and retries exactly the same command", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: "The result could not be confirmed" } } });
    render(<InquiryWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Capture inquiry" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save inquiry" })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Caller name (optional)"), { target: { value: "Retry caller" } });
    fireEvent.click(screen.getByRole("button", { name: "Save inquiry" }));
    await screen.findByText(/The result could not be confirmed/);
    await waitFor(() => expect(screen.getByRole("alert").parentElement).toHaveFocus());
    expect(screen.getByLabelText("Caller name (optional)")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry submitted inquiry" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(vi.mocked(api.post).mock.calls[0][1]);
  });
  it("uses the displayed revision for close and shows a server conflict without inventing success", async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { message: "Inquiry changed. Reload before saving." } } });
    render(<InquiryWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Open inquiry" }));
    fireEvent.click(await screen.findByRole("button", { name: "Update inquiry" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save inquiry update" })).toBeEnabled());
    fireEvent.click(screen.getByRole("combobox", { name: "Progress status" }));
    fireEvent.click(screen.getByRole("option", { name: "Close inquiry" }));
    fireEvent.click(screen.getByRole("button", { name: "Save inquiry update" }));
    await screen.findByText(/Inquiry changed. Reload before saving/);
    expect(api.patch).toHaveBeenCalledWith("/crm/inquiries/inquiry", expect.objectContaining({ expectedRevision: 2, status: "closed", closeReason: "resolved" }));
  });
  it("distinguishes a failed list from an empty queue and reloads the same filters", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("offline"));
    render(<InquiryWorkspace />);
    await screen.findByText(/The inquiry result could not be confirmed/);
    expect(screen.queryByText("No inquiries match these filters.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload inquiries" }));
    expect(await screen.findByRole("button", { name: "Open inquiry" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/crm/inquiries", expect.objectContaining({ params: { owner: "mine", status: "active", locationId: "", search: "", overdue: "false" } }));
  });
  it("blocks consumer access even if a client supplies CRM permission names", () => {
    useAuthStore.setState(state => ({ user: { ...state.user!, role: "patient" } }));
    render(<InquiryWorkspace />);
    expect(screen.getByText("An authorized staff CRM workspace is required.")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
