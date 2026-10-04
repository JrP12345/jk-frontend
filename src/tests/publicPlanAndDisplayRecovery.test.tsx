import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Pricing from "@/app/pricing/page";
import QueueTV from "@/app/queue-tv/page";

const fixture = vi.hoisted(() => ({ getPlans: vi.fn(), get: vi.fn() }));
vi.mock("@/services/billing.service", () => ({ billingService: { getPlans: fixture.getPlans } }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/components/MarketplaceNavbar", () => ({ default: () => null }));
vi.mock("@/utils/audioChimes", () => ({ announcePatientToken: vi.fn() }));

const plan = {
  id: "custom", slug: "custom", name: "Custom practice", description: "Configured plan",
  monthlyPrice: 90, annualPrice: 960, currency: "USD", trialDays: 7,
  limits: { maxClinics: 3, maxDoctors: 8, maxStaff: 0, maxPatients: 700, maxAppointments: 900, maxStorageMB: 512 },
  features: { analytics: true, auditLogs: false, multiBranch: true, dataExport: false, apiAccess: false, aiFeatures: false },
};
afterEach(() => { cleanup(); vi.useRealTimers(); fixture.getPlans.mockReset(); fixture.get.mockReset(); });

describe("Configured public plans", () => {
  it("shows configured trial, currency and capacities without fixed promotional claims", async () => {
    fixture.getPlans.mockResolvedValue([plan]);
    render(<Pricing />);
    await screen.findByRole("heading", { name: plan.name });
    expect(screen.getByText("7-day free trial")).toBeInTheDocument();
    expect(screen.getByText("$90")).toBeInTheDocument();
    expect(screen.queryByText(/15-day/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Save 17%/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Request Custom practice setup/ })).toHaveAttribute("href", "/onboarding?mode=new_org&plan=custom");
    const card = screen.getByRole("article");
    expect(within(card).getByText("0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annual billing" }));
    expect(screen.getByText("$80")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annual billing" })).toHaveAttribute("aria-pressed", "true");
  });

  it("recovers a failed plan read and uses the approved sales destination", async () => {
    fixture.getPlans.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([{ ...plan, slug: "enterprise", trialDays: 0 }]);
    render(<Pricing />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Contact Sales" })).toHaveAttribute("href", "mailto:ekavyuofficial@gmail.com");
    expect(screen.getByText("No free trial")).toBeInTheDocument();
  });
});

describe("Waiting-room connection feedback", () => {
  it("does not claim a live or empty queue after failure and recovers on the next poll", async () => {
    vi.useFakeTimers();
    fixture.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { data: [] } });
    await act(async () => { render(<QueueTV />); });
    expect(screen.getByText("RECONNECTING")).toBeInTheDocument();
    expect(screen.queryByText("LIVE QUEUE")).not.toBeInTheDocument();
    expect(screen.queryByText("Doctor Ready for Next Consultation")).not.toBeInTheDocument();
    expect(screen.queryByText("Waiting Queue is Empty")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(screen.getByText("LIVE QUEUE")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dual" })).toHaveAttribute("aria-pressed", "true");
  });
});
