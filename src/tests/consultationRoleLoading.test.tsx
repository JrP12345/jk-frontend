import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConsultationsPage from "@/app/(dashboard)/dashboard/consultations/page";
import { ToastProvider } from "@/components/ui";
const fixture = vi.hoisted(() => ({ get: vi.fn(), user: { id: "doctor", role: "doctor", organization_id: "org", permissions: ["VIEW_EHR", "VIEW_APPOINTMENTS", "MANAGE_CLINICAL_NOTES"] } }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/store/locationStore", () => ({ useLocationStore: () => ({ activeLocationId: "branch" }) }));
vi.mock("@/hooks/useWorkflowPreferences", () => ({ useWorkflowPreferences: () => ({ preferences: { registration: "full", consultation: "full" }, loading: false }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("Consultation role loading", () => {
  it.each(["doctor", "family_member"])("loads %s records without staff directory or patient selector access", async role => {
    fixture.user.role = role;
    fixture.get.mockImplementation(async (path: string) => {
      if (path.includes("/staff") || path.startsWith("/patients")) throw { response: { status: 403 } };
      return { data: { data: path.includes("daily-summary") ? { appointments: 1, byStatus: { "checked-in": 1 } } : [{ id: "visit", status: "checked-in", appointmentTime: new Date().toISOString(), patientId: { id: "patient", name: "Authorized patient" }, doctorId: { id: "doctor", name: "Assigned doctor" } }] }, headers: { "x-total-pages": "2" } };
    });
    render(<ToastProvider><ConsultationsPage /></ToastProvider>);
    expect(await screen.findByRole("heading", { name: "Authorized patient" })).toBeInTheDocument();
    await waitFor(() => expect(fixture.get).toHaveBeenCalled());
    expect(fixture.get.mock.calls.some(([path]) => path.includes("/staff") || path.startsWith("/patients"))).toBe(false);
    if (role === "family_member") expect(fixture.get.mock.calls.some(([path]) => path.includes("daily-summary"))).toBe(false);
  });
});
