import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "@/app/(dashboard)/dashboard/patients/[id]/page";
import { ToastProvider } from "@/components/ui/Toast";

const fixture = vi.hoisted(() => ({ get: vi.fn(), patientId: "patient-one", organization: "organization-one" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: fixture.patientId }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: { id: "staff", role: "doctor", organization_id: fixture.organization, permissions: ["VIEW_PATIENTS"] } }) }));
vi.mock("@/components/ehr/PatientHistoryAccess", () => ({ default: () => null }));
vi.mock("@/components/clinical/PatientHeader", () => ({ PatientHeader: ({ patient }: { patient: { name: string; mrn?: string } }) => <div>{patient.name}{patient.mrn && <span>{patient.mrn}</span>}</div> }));
vi.mock("@/components/clinical/PatientOverviewCards", () => ({ PatientOverviewCards: () => null }));
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); fixture.get.mockReset(); });

describe("Patient profile read recovery", () => {
  it("distinguishes a failed read and retries with the same scoped request, without fabricating an MRN", async () => {
    fixture.get.mockRejectedValueOnce(new Error("offline"));
    fixture.get.mockImplementation(async () => ({ data: { data: [] } }));
    const view = render(<ToastProvider><Profile /></ToastProvider>);
    expect(await screen.findByRole("heading", { name: "Unable to load patient record" })).toBeInTheDocument();
    fixture.get.mockImplementation(async path => path === "/patients/patient-one"
      ? { data: { data: { patient: { id: fixture.patientId, organizationId: fixture.organization, name: "Review patient" }, appointments: [] } } }
      : { data: { data: [] } });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Patient profile: Review patient" });
    expect(fixture.get).toHaveBeenCalledWith("/patients/patient-one", { headers: {} });
    expect(view.container.textContent).not.toContain("MRN-PATIEN");
    expect(screen.queryByRole("button", { name: /Edit Demographics/ })).not.toBeInTheDocument();
  });
  it("ignores a late response after leaving the profile", async () => {
    let resolve!: (result: unknown) => void;
    fixture.get.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<ToastProvider><Profile /></ToastProvider>);
    view.unmount();
    resolve({ data: { data: { patient: { name: "Late profile" }, appointments: [] } } });
    await waitFor(() => expect(fixture.get).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Late profile")).not.toBeInTheDocument();
  });
});
