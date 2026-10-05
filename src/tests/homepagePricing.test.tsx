import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePricing from "@/app/home/HomePricing";
import type { SaaSPlan } from "@/services/billing.service";

const fixture = vi.hoisted(() => ({ getPlans: vi.fn() }));
vi.mock("@/services/billing.service", () => ({ billingService: { getPlans: fixture.getPlans } }));

const plan: SaaSPlan = {
  id: "configured", slug: "configured", name: "Configured practice", description: "A plan for your team",
  monthlyPrice: 90, annualPrice: 960, currency: "USD", trialDays: 7,
  status: "active", displayOrder: 1, isPopular: false,
  limits: { maxClinics: 3, maxDoctors: 8, maxStaff: 0, maxPatients: 700, maxAppointments: 900, maxStorageMB: 512 },
  features: { analytics: true, auditLogs: false, multiBranch: true, dataExport: false, apiAccess: false, aiFeatures: false },
};

function renderPricing() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><HomePricing /></QueryClientProvider>);
}

beforeEach(() => {
  fixture.getPlans.mockReset();
  vi.stubGlobal("IntersectionObserver", undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("Homepage pricing from the public plan source", () => {
  it("waits until the pricing section approaches the viewport and reuses the read when switching cycles", async () => {
    let enterViewport: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        enterViewport = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      disconnect = disconnect;
    });
    fixture.getPlans.mockResolvedValue([plan]);
    renderPricing();
    expect(fixture.getPlans).not.toHaveBeenCalled();
    await act(async () => { enterViewport?.(); });
    expect(await screen.findByRole("heading", { name: plan.name })).toBeInTheDocument();
    expect(screen.getByText("$90")).toBeInTheDocument();
    expect(screen.getByText("7-day free trial")).toBeInTheDocument();
    const card = screen.getByRole("article", { name: plan.name + " plan" });
    expect(within(card).getByText("Locations")).toBeInTheDocument();
    expect(within(card).getByText("0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Request Configured practice setup/ })).toHaveAttribute("href", "/onboarding?mode=new_org&plan=configured");
    fireEvent.click(screen.getByRole("button", { name: "Annual billing" }));
    expect(screen.getByText("$80")).toBeInTheDocument();
    expect(screen.getByText("Billed annually ($960/year)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annual billing" })).toHaveAttribute("aria-pressed", "true");
    expect(fixture.getPlans).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
  });

  it("shows an honest failure and recovers through the existing source without inventing prices", async () => {
    fixture.getPlans.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([plan]);
    renderPricing();
    expect(await screen.findByText("Plans couldn’t be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Talk to the team" })).toHaveAttribute("href", "mailto:ekavyuofficial@gmail.com");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("$90")).toBeInTheDocument();
    expect(fixture.getPlans).toHaveBeenCalledTimes(2);
  });

  it("does not fabricate tiers or free trials when no active plans are returned", async () => {
    fixture.getPlans.mockResolvedValue([]);
    renderPricing();
    expect(await screen.findByText("No active plans are listed right now.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByText(/free trial/)).not.toBeInTheDocument();
  });

  it("respects returned plan names, order, currency, trial terms and the approved enterprise contact", async () => {
    const enterprise = { ...plan, id: "enterprise", slug: "enterprise", name: "Hospital team", trialDays: 0, currency: "EUR", monthlyPrice: 123, isPopular: true };
    const custom = { ...plan, slug: "team & locations", name: "An organization plan with a longer configured name" };
    fixture.getPlans.mockResolvedValue([enterprise, custom]);
    renderPricing();
    await screen.findByRole("heading", { name: enterprise.name });
    expect(screen.getAllByRole("article").map(article => article.getAttribute("aria-label"))).toEqual([enterprise.name + " plan", custom.name + " plan"]);
    expect(screen.getByText(/123\s*€/)).toBeInTheDocument();
    expect(screen.getByText("No free trial")).toBeInTheDocument();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Sales" })).toHaveAttribute("href", "mailto:ekavyuofficial@gmail.com");
    expect(screen.getByRole("link", { name: /Request An organization plan/ })).toHaveAttribute("href", "/onboarding?mode=new_org&plan=team%20%26%20locations");
    expect(screen.getByRole("link", { name: "Compare every limit & feature" })).toHaveAttribute("href", "/pricing");
  });
});
