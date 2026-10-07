import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { useLocationStore } from "../store/locationStore";
import { useAuthStore } from "../store/authStore";
import { DashboardStatCards } from "../components/dashboard/DashboardStatCards";
import { DashboardFollowUpAlerts } from "../components/dashboard/DashboardFollowUpAlerts";
import { ToastProvider } from "../components/ui";
import LocationsPage from "../app/(dashboard)/dashboard/locations/page";
import api from "../lib/api";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe("Location Store State Management", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useLocationStore.setState({
      locations: [],
      activeLocationId: null,
      isLoaded: false,
      isLoading: false,
      error: null,
    });
  });

  it("updates activeLocationId and persists to localStorage", () => {
    useLocationStore.getState().setActiveLocation("clinic-xyz");
    expect(useLocationStore.getState().activeLocationId).toBe("clinic-xyz");
    expect(localStorage.getItem("ekavyu_active_location_id")).toBe("clinic-xyz");

    useLocationStore.getState().setActiveLocation(null);
    expect(useLocationStore.getState().activeLocationId).toBe(null);
    expect(localStorage.getItem("ekavyu_active_location_id")).toBe(null);
  });

  it("fetches and normalizes locations from backend api", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { id: "clinic-1", name: "Ekavyu Main", city: "Bengaluru" },
          { id: "clinic-2", name: "Ekavyu Koramangala", city: "Bengaluru" },
        ],
      },
    } as any);

    const list = await useLocationStore.getState().fetchLocations();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("clinic-1");
    expect(list[0].name).toBe("Ekavyu Main");
    expect(list[1].id).toBe("clinic-2");
    expect(useLocationStore.getState().isLoaded).toBe(true);
  });
});

describe("Dashboard Modular Components", () => {
  it("renders Admin / Ops stat cards correctly", () => {
    const adminStats = {
      locations: 3,
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
    expect(screen.getByText("Active Locations")).toBeInTheDocument();
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
        adminStats={{ locations: 0, doctors: 0, receptionists: 0, appointments: 0, collections: 0, outstanding: 0 }}
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
        locationId: { name: "Ekavyu Indiranagar", id: "clinic-1" },
      },
    ];

    render(<DashboardFollowUpAlerts alerts={alerts} />);

    expect(screen.getByText("Clinical Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Due within 7 days")).toBeInTheDocument();
    expect(screen.getByText("Follow-Up Consultation with Dr. Ramesh Sharma")).toBeInTheDocument();
    expect(screen.getByText("Schedule Now")).toBeInTheDocument();
  });
});

describe("Locations Page Active and Archived Branch Lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: "admin-1",
        name: "Clinic Administrator",
        email: "admin@ekavyu.com",
        role: "admin",
        organization_id: "org-1",
        permissions: ["MANAGE_LOCATIONS", "VIEW_LOCATIONS"],
      },
      isAuthenticated: true,
      isLoading: false,
    });
    useLocationStore.setState({
      locations: [
        { id: "clinic-1", name: "Ekavyu Indiranagar", city: "Bengaluru", isActive: true },
      ],
      activeLocationId: "clinic-1",
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
              { id: "clinic-2", name: "Ekavyu Whitefield", city: "Bengaluru", isActive: false },
            ],
          },
        } as any;
      }
      return {
        data: {
          success: true,
          data: [
            { id: "clinic-1", name: "Ekavyu Indiranagar", city: "Bengaluru", isActive: true },
          ],
        },
      } as any;
    });

    const postSpy = vi.spyOn(api, "post").mockResolvedValue({
      data: { success: true, message: "Clinic branch reactivated successfully" },
    } as any);

    render(
      <ToastProvider>
        <LocationsPage />
      </ToastProvider>
    );

    // Wait for initial load and archived count badge to appear
    expect(await screen.findByText("1 Active Location")).toBeInTheDocument();
    expect(await screen.findByText(/1 Archived/i)).toBeInTheDocument();
    expect(screen.getByText("Ekavyu Indiranagar")).toBeInTheDocument();

    // Click on Archived Branches tab
    const archivedTab = screen.getByTestId("tab-archived-branches");
    await act(async () => {
      fireEvent.click(archivedTab);
    });

    // Archived branch row is displayed across responsive views (desktop table + mobile cards)
    const branchNames = await screen.findAllByText("Ekavyu Whitefield");
    expect(branchNames.length).toBeGreaterThan(0);

    const reactivateBtns = await screen.findAllByText("Reactivate Branch");
    expect(reactivateBtns.length).toBeGreaterThan(0);

    // Click reactivate button
    await act(async () => {
      fireEvent.click(reactivateBtns[0]);
    });
    expect(postSpy).toHaveBeenCalledWith("/onboarding/locations/clinic-2/reactivate");
  });
});
