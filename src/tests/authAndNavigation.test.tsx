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
            email: "aarti@anant.health",
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

  it("enforces that only root superadmin can access /dashboard/audit", () => {
    // Root can access
    expect(hasRoutePermission("/dashboard/audit", "root", [])).toBe(true);

    // Admin, Doctor, Receptionist, Staff cannot access
    expect(hasRoutePermission("/dashboard/audit", "admin", ["VIEW_AUDIT_LOGS", "MANAGE_ORGANIZATION"])).toBe(false);
    expect(hasRoutePermission("/dashboard/audit", "doctor", ["VIEW_AUDIT_LOGS"])).toBe(false);
    expect(hasRoutePermission("/dashboard/audit", "receptionist", [])).toBe(false);
    expect(hasRoutePermission("/dashboard/audit", "patient", [])).toBe(false);
  });

  it("clears the auth loading state when refresh expiry is reported", () => {
    vi.spyOn(api, "post").mockResolvedValueOnce({ data: { success: true } } as any);
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    window.dispatchEvent(new Event("auth-expired"));

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    expect(api.post).toHaveBeenCalledWith("/auth/logout");
  });

  it("strictly denies guest role from all dashboard routes", () => {
    expect(hasRoutePermission("/dashboard", "guest", ["CREATE_APPOINTMENTS"])).toBe(false);
    expect(hasRoutePermission("/dashboard/patient-portal", "guest", ["CREATE_APPOINTMENTS"])).toBe(false);
    expect(hasRoutePermission("/dashboard/appointments", "guest", ["CREATE_APPOINTMENTS"])).toBe(false);
    expect(hasRoutePermission("/dashboard/settings", "guest", ["CREATE_APPOINTMENTS"])).toBe(false);
  });

  it("never authenticates guest session in authStore", async () => {
    // 1. checkAuth rejecting guest
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          user: {
            id: "guest-123",
            name: "Guest Visitor",
            email: "guest@example.com",
            role: "guest",
            permissions: ["CREATE_APPOINTMENTS"],
          },
        },
      },
    } as any);

    await useAuthStore.getState().checkAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();

    // 2. login rejecting guest
    useAuthStore.getState().login({
      id: "guest-456",
      name: "Guest Two",
      email: "guest2@example.com",
      role: "guest" as any,
      permissions: ["CREATE_APPOINTMENTS"],
    } as any);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("authenticates patient via email OTP session payload", () => {
    const patientUser = {
      id: "patient-email-999",
      name: "Radha Sharma",
      email: "radha@example.com",
      role: "patient",
      authMethod: "email_otp",
      permissions: ["VIEW_APPOINTMENTS", "VIEW_EHR"],
    };

    useAuthStore.getState().login(patientUser as any);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe("radha@example.com");
    expect(state.user?.role).toBe("patient");
    expect(hasRoutePermission("/dashboard/patient-portal", state.user!.role, state.user!.permissions)).toBe(true);
  });
});


