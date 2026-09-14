import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { useClinicStore } from "../store/clinicStore";
import { useAuthStore } from "../store/authStore";
import { DashboardStatCards } from "../components/dashboard/DashboardStatCards";
import { DashboardFollowUpAlerts } from "../components/dashboard/DashboardFollowUpAlerts";
import { ToastProvider } from "../components/ui";
import ClinicsPage from "../app/(dashboard)/dashboard/clinics/page";
import api from "../lib/api";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Clinic Store State Management", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useClinicStore.setState({
      clinics: [],
      activeClinicId: null,
      isLoaded: false,
      isLoading: false,
      error: null,
    });
  });

  it("updates activeClinicId and persists to localStorage", () => {
    useClinicStore.getState().setActiveClinic("clinic-xyz");
    expect(useClinicStore.getState().activeClinicId).toBe("clinic-xyz");
    expect(localStorage.getItem("ananta_active_clinic_id")).toBe("clinic-xyz");

    useClinicStore.getState().setActiveClinic(null);
    expect(useClinicStore.getState().activeClinicId).toBe(null);
    expect(localStorage.getItem("ananta_active_clinic_id")).toBe(null);
  });

  it("fetches and normalizes clinics from backend api", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { _id: "clinic-1", name: "Ananta Main", city: "Bengaluru" },
          { id: "clinic-2", name: "Ananta Koramangala", city: "Bengaluru" },
        ],
      },
    } as any);

    const list = await useClinicStore.getState().fetchClinics();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("clinic-1");
    expect(list[0].name).toBe("Ananta Main");
    expect(list[1].id).toBe("clinic-2");
    expect(useClinicStore.getState().isLoaded).toBe(true);
  });
});

describe("Dashboard Modular Components", () => {
  it("renders Admin / Ops stat cards correctly", () => {
    const adminStats = {
      clinics: 3,
      doctors: 8,
      receptionists: 4,
      appointments: 45,
      collections: 25000,
      outstanding: 5000,
    };

    render(
      <DashboardStatCards
        role="admin"
        canViewOpsDashboard={true}
        loading={false}
        adminStats={adminStats}
        doctorStats={{ total: 0, completed: 0, pending: 0 }}
        patientStats={{ appointmentsCount: 0, unpaidBills: 0 }}
      />
    );

    expect(screen.getByText("Collections")).toBeInTheDocument();
    expect(screen.getByText("₹25,000")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("₹5,000")).toBeInTheDocument();
    expect(screen.getByText("Active Clinics")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders Doctor stat cards correctly", () => {
    const doctorStats = {
      total: 12,
      completed: 7,
      pending: 5,
    };

    render(
      <DashboardStatCards
        role="doctor"
        canViewOpsDashboard={false}
        loading={false}
        adminStats={{ clinics: 0, doctors: 0, receptionists: 0, appointments: 0, collections: 0, outstanding: 0 }}
        doctorStats={doctorStats}
        patientStats={{ appointmentsCount: 0, unpaidBills: 0 }}
      />
    );

    expect(screen.getByText("Total Visits")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders Patient follow-up recommendation alerts", () => {
    const alerts = [
      {
        id: "appt-101",
        followUpTimeline: "7 days",
        appointmentTime: new Date().toISOString(),
        doctorId: { name: "Ramesh Sharma", id: "doc-1" },
        clinicId: { name: "Ananta Indiranagar", id: "clinic-1" },
      },
    ];

    render(<DashboardFollowUpAlerts alerts={alerts} />);

    expect(screen.getByText("Clinical Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Due within 7 days")).toBeInTheDocument();
    expect(screen.getByText("Follow-Up Consultation with Dr. Ramesh Sharma")).toBeInTheDocument();
    expect(screen.getByText("Schedule Now")).toBeInTheDocument();
  });
});

describe("Clinics Page Active and Archived Branch Lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: "admin-1",
        name: "Clinic Administrator",
        email: "admin@ananta.com",
        role: "admin",
        organization_id: "org-1",
        permissions: ["MANAGE_CLINICS", "VIEW_CLINICS"],
      },
      isAuthenticated: true,
      isLoading: false,
    });
    useClinicStore.setState({
      clinics: [
        { id: "clinic-1", name: "Ananta Indiranagar", city: "Bengaluru", isActive: true },
      ],
      activeClinicId: "clinic-1",
      isLoaded: true,
      isLoading: false,
      error: null,
    });
  });

  it("switches to archived branches and triggers reactivation", async () => {
    vi.spyOn(api, "get").mockImplementation(async (url: string) => {
      if (url.includes("status=inactive")) {
        return {
          data: {
            success: true,
            data: [
              { id: "clinic-2", name: "Ananta Whitefield", city: "Bengaluru", isActive: false },
            ],
          },
        } as any;
      }
      return {
        data: {
          success: true,
          data: [
            { id: "clinic-1", name: "Ananta Indiranagar", city: "Bengaluru", isActive: true },
          ],
        },
      } as any;
    });

    const postSpy = vi.spyOn(api, "post").mockResolvedValue({
      data: { success: true, message: "Clinic branch reactivated successfully" },
    } as any);

    render(
      <ToastProvider>
        <ClinicsPage />
      </ToastProvider>
    );

    // Wait for initial load and archived count badge to appear
    expect(await screen.findByText("1 Active Location")).toBeInTheDocument();
    expect(await screen.findByText(/1 Archived/i)).toBeInTheDocument();
    expect(screen.getByText("Ananta Indiranagar")).toBeInTheDocument();

    // Click on Archived Branches tab
    const archivedTab = screen.getByTestId("tab-archived-branches");
    await act(async () => {
      fireEvent.click(archivedTab);
    });

    // Archived branch row is displayed across responsive views (desktop table + mobile cards)
    const branchNames = await screen.findAllByText("Ananta Whitefield");
    expect(branchNames.length).toBeGreaterThan(0);

    const reactivateBtns = await screen.findAllByText("Reactivate Branch");
    expect(reactivateBtns.length).toBeGreaterThan(0);

    // Click reactivate button
    await act(async () => {
      fireEvent.click(reactivateBtns[0]);
    });
    expect(postSpy).toHaveBeenCalledWith("/onboarding/clinics/clinic-2/reactivate");
  });
});

