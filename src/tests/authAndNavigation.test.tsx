import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../store/authStore";
import { useModuleStore } from "../store/moduleStore";
import { hasRoutePermission } from "../lib/routePermissions";
import api from "../lib/api";

describe("Frontend Auth Store & RBAC Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      activeClinicId: null,
    });
    useModuleStore.setState({
      modules: [],
      isLoaded: true,
      isLoading: false,
      error: null,
    });
  });

  it("authenticates user and populates role correctly", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          user: {
            id: "user-123",
            name: "Dr. Aarti Sharma",
            email: "aarti@ananta.health",
            role: "doctor",
            organization_id: "org-1",
            permissions: ["VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS", "VIEW_EHR", "MANAGE_CLINICAL_NOTES"],
          },
        },
      },
    } as any);

    await useAuthStore.getState().checkAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.name).toBe("Dr. Aarti Sharma");
    expect(state.user?.role).toBe("doctor");
  });

  it("enforces route permissions for doctors correctly", () => {
    const doctorPermissions = ["VIEW_APPOINTMENTS", "MANAGE_APPOINTMENTS", "VIEW_EHR", "MANAGE_CLINICAL_NOTES"];
    
    // Doctor should access consultations and appointments
    expect(hasRoutePermission("/dashboard/consultations", "doctor", doctorPermissions)).toBe(true);
    expect(hasRoutePermission("/dashboard/appointments", "doctor", doctorPermissions)).toBe(true);
    expect(hasRoutePermission("/dashboard", "doctor", doctorPermissions)).toBe(true);

    // Doctor without MANAGE_ORGANIZATION should be blocked from system settings
    expect(hasRoutePermission("/dashboard/settings", "doctor", doctorPermissions)).toBe(false);
    expect(hasRoutePermission("/dashboard/organizations", "doctor", doctorPermissions)).toBe(false);
  });

  it("enforces patient restricted navigation", () => {
    const patientPermissions = ["VIEW_APPOINTMENTS", "VIEW_EHR"];

    expect(hasRoutePermission("/dashboard", "patient", patientPermissions)).toBe(true);
    expect(hasRoutePermission("/dashboard/patient-portal", "patient", patientPermissions)).toBe(true);
    expect(hasRoutePermission("/dashboard/appointments", "patient", patientPermissions)).toBe(true);

    // Patients cannot access staff/admin pages
    expect(hasRoutePermission("/dashboard/staff", "patient", patientPermissions)).toBe(false);
    expect(hasRoutePermission("/dashboard/clinics", "patient", patientPermissions)).toBe(false);
    expect(hasRoutePermission("/dashboard/organizations", "patient", patientPermissions)).toBe(false);
  });
});
