import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, ModeSwitcher } from "@/components/ui/ThemeProvider";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { orderNavigation } from "@/lib/navigationOrder";
import { ResumeTrackerLink } from "@/components/clinical/ResumeTrackerLink";
import { clearRecentTracker, getStoredTrackerToken, rememberTracker, rememberTrackerLink, useTrackerStore } from "@/store/trackerStore";
import { useAuthStore } from "@/store/authStore";

vi.mock("next/navigation", () => ({ usePathname: () => "/browse" }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  localStorage.clear(); sessionStorage.clear(); clearRecentTracker();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-mode");
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); clearRecentTracker(); });

describe("Theme toggle", () => {
  it.each(["segmented", "icon", "pill"] as const)("toggles %s from its current side and back", variant => {
    render(<ThemeProvider><ModeSwitcher variant={variant} /></ThemeProvider>);
    const button = screen.getByRole("button", { name: /switch to dark mode/i });
    fireEvent.click(button.querySelector("svg")!);
    expect(document.documentElement).toHaveAttribute("data-mode", "dark");
    expect(localStorage.getItem("jk-mode")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: /switch to light mode/i }).querySelectorAll("svg")[variant === "segmented" ? 1 : 0]);
    expect(document.documentElement).toHaveAttribute("data-mode", "light");
  });
});

function ToastActions() {
  const { toast } = useToast();
  return <><button onClick={() => toast({ title: "Appointment saved", description: "Your consultation has been reserved.", duration: 1000 })}>Save</button><button onClick={() => toast({ title: "Queue updated", description: "A longer message can wrap naturally without fixed-height overlap.", duration: 1000 })}>Update</button></>;
}
describe("Top-center transient notifications", () => {
  it("uses the visible header bottom and updates when navigation grows", () => {
    let bottom = 64;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) { return this.hasAttribute("data-app-header") ? { height: bottom, top: 0, bottom } as DOMRect : { width: 156 } as DOMRect; });
    render(<ToastProvider><header data-app-header>Navigation</header><ToastActions /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region.style.getPropertyValue("--toast-header-offset")).toBe("76px");
    bottom = 112;
    fireEvent.resize(window);
    expect(region.style.getPropertyValue("--toast-header-offset")).toBe("124px");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
  it("lets touch and keyboard users expand the stack without overlapping fixed-height cards", () => {
    render(<ToastProvider><ToastActions /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(within(region).queryByRole("group", { name: "Appointment saved" })).not.toBeInTheDocument();
    const expand = within(region).getByRole("button", { name: "Show 1 more" });
    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(within(region).getByRole("group", { name: "Appointment saved" })).toBeVisible();
    expect(within(region).getAllByRole("button", { name: "Dismiss notification" })).toHaveLength(2);
    fireEvent.click(within(region).getByRole("button", { name: "Clear all" }));
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });
  it("pauses dismissal during keyboard focus and resumes the remaining time", () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastActions /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    act(() => vi.advanceTimersByTime(400));
    act(() => screen.getByRole("button", { name: "Dismiss notification" }).focus());
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Save" }).focus());
    act(() => vi.advanceTimersByTime(599));
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });
});

describe("Role workflow ordering", () => {
  const items = [
    { href: "/dashboard", section: "Core Workspace" },
    { href: "/dashboard/queue", section: "Outpatient (OPD)" },
    { href: "/dashboard/appointments", section: "Outpatient (OPD)" },
    { href: "/dashboard/consultations", section: "Outpatient (OPD)" },
    { href: "/dashboard/laboratory", section: "Diagnostics & Pharmacy" },
    { href: "/dashboard/pharmacy", section: "Diagnostics & Pharmacy" },
    { href: "/dashboard/billing", section: "Billing & Finance" },
    { href: "/dashboard/notifications", section: "Account & Settings" },
    { href: "/dashboard/settings", section: "Account & Settings" },
  ];
  it.each([["doctor", "queue"], ["receptionist", "queue"], ["nurse", "queue"], ["lab_tech", "laboratory"], ["pharmacist", "pharmacy"], ["cashier", "billing"]])("puts %s primary work before utilities", (role, route) => {
    const ordered = orderNavigation(items, role);
    expect(ordered[0].href).toBe("/dashboard");
    expect(ordered[1].href).toBe("/dashboard/" + route);
    expect(ordered.at(-2)?.href).toBe("/dashboard/notifications");
    expect(new Set(ordered)).toEqual(new Set(items));
  });
  it("preserves the permission-filtered route set", () => {
    const allowed = items.filter(item => item.href !== "/dashboard/laboratory");
    expect(orderNavigation(allowed, "lab_tech").some(item => item.href === "/dashboard/laboratory")).toBe(false);
  });
});

describe("Tracker recovery", () => {
  it("keeps a private recovery link after the ticket closes and restores it after a page reload", () => {
    rememberTracker("appointment", "private-capability", null);
    useTrackerStore.setState({ recent: null });
    render(<ResumeTrackerLink />);
    expect(screen.getByRole("link", { name: "Reopen live appointment tracker" })).toHaveAttribute("href", "/track/appointment?t=private-capability");
    expect(localStorage.getItem("ekavyu-recent-tracker")).toBeNull();
  });
  it("does not show another account's remembered appointment", () => {
    rememberTracker("appointment", "private-capability", "another-user");
    render(<ResumeTrackerLink />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("rejects cross-origin and invalid tracker destinations", () => {
    rememberTrackerLink("https://example.com/track/appointment?t=private", null);
    rememberTrackerLink("/dashboard?t=private", null);
    expect(useTrackerStore.getState().recent).toBeNull();
  });
  it("removes expired recovery records and retains receipt access after completion", () => {
    rememberTracker("appointment", "private-capability", null);
    clearRecentTracker("appointment");
    expect(getStoredTrackerToken("appointment")).toBe("private-capability");
    expect(useTrackerStore.getState().recent).toBeNull();
    sessionStorage.setItem("ekavyu-recent-tracker", JSON.stringify({ appointmentId: "appointment", ownerId: null, expiresAt: Date.now() - 1 }));
    useTrackerStore.getState().hydrate();
    expect(useTrackerStore.getState().recent).toBeNull();
    expect(sessionStorage.getItem("ekavyu-recent-tracker")).toBeNull();
  });
});
