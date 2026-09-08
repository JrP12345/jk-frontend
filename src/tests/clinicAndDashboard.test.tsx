import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { useClinicStore } from "../store/clinicStore";
import { DashboardStatCards } from "../components/dashboard/DashboardStatCards";
import { DashboardFollowUpAlerts } from "../components/dashboard/DashboardFollowUpAlerts";
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

    expect(screen.getByText("Today's Collections")).toBeInTheDocument();
    expect(screen.getByText("₹25,000")).toBeInTheDocument();
    expect(screen.getByText("Outstanding Balances")).toBeInTheDocument();
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

    expect(screen.getByText("Total Consultations")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Pending Queue")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Completed Visits")).toBeInTheDocument();
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
