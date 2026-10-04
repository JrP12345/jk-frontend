import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsultationClientWorkspace } from "@/app/(dashboard)/dashboard/consultations/[id]/ConsultationClientWorkspace";

const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post } }));
vi.mock("@/providers/EncounterProvider", () => ({ EncounterProvider: ({ children }: { children: import("react").ReactNode }) => children }));
vi.mock("@/components/clinical/EncounterWorkspace", () => ({ EncounterWorkspace: ({ patient }: { patient: { mrn: string } }) => <p>Recorded MRN: {patient.mrn || "Not listed"}</p> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Consultation entry identity", () => {
  it.each([undefined, "REAL-123"])("displays only the recorded MRN (%s) and retains appointment-derived context", async mrn => {
    fixture.get.mockImplementation(async (path: string) => ({ data: { data: path.includes("clinical-notes") ? [] : { patientId: { id: "patient", userId: { name: "Review patient" }, mrn }, clinicId: { id: "clinic" }, doctorId: { id: "doctor" } } } }));
    fixture.post.mockResolvedValue({ data: { data: { id: "encounter" } } });
    render(<ConsultationClientWorkspace appointmentId="appointment" initialPatientId="old-patient" initialClinicId="old-clinic" />);
    expect(await screen.findByRole("heading", { name: "Consultation: Review patient" })).toBeInTheDocument();
    expect(screen.getByText(`Recorded MRN: ${mrn || "Not listed"}`)).toBeInTheDocument();
    expect(fixture.post).toHaveBeenCalledWith("/encounters", { clinicId: "clinic", patientId: "patient", appointmentId: "appointment", encounterType: "opd" });
  });
  it("fails closed on direct appointment access errors without searching a paginated list or writing an encounter", async () => {
    fixture.get.mockRejectedValue({ response: { data: { message: "Access denied" } } });
    render(<ConsultationClientWorkspace appointmentId="appointment" />);
    expect(await screen.findByRole("heading", { name: "Consultation could not be opened" })).toBeInTheDocument();
    expect(fixture.get.mock.calls.filter(([path]) => path === "/appointments/appointment")).toHaveLength(1);
    expect(fixture.get).not.toHaveBeenCalledWith("/appointments");
    expect(fixture.post).not.toHaveBeenCalled();
  });
});
