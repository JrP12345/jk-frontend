import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

import HomeNavigation from "@/app/home/HomeNavigation";
import Home from "@/app/page";

const fixture = vi.hoisted(() => ({ cookies: new Map<string, string>(), authenticated: false, role: "patient" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ has: (name: string) => fixture.cookies.has(name), get: (name: string) => fixture.cookies.has(name) ? { value: fixture.cookies.get(name) } : undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ isAuthenticated: fixture.authenticated, user: fixture.authenticated ? { role: fixture.role } : null }) }));
vi.mock("@/components/ui/ThemeProvider", () => ({ ModeSwitcher: () => <button aria-label="Appearance">Appearance</button> }));
vi.mock("@/components/ui/EkavyuLogo", () => ({ default: () => <span>Ekavyu</span> }));
vi.mock("@/app/home/HomePricing", () => ({ default: () => <div>Current organization plans</div> }));

beforeEach(() => {
  fixture.cookies.clear(); fixture.authenticated = false; fixture.role = "patient";
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
});

describe("Public homepage entry", () => {
  it("renders the homepage with security headers for anonymous and booking guest visitors", async () => {
    for (const cookie of ["", "ekavyu_session=guest; access_token=booking-session"]) {
      const response = proxy(new NextRequest("https://app.example/", { headers: { cookie } }));
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
      expect(response.headers.get("x-nonce")).toBeTruthy();
    }
    fixture.cookies.set("ekavyu_session", "guest");
    fixture.cookies.set("access_token", "booking-session");
    render(await Home());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your care team.One clear workspace.");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Find care" }).every(link => link.getAttribute("href") === "/browse")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Request setup" }).every(link => link.getAttribute("href") === "/onboarding?mode=new_org")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Plans" })[0]).toHaveAttribute("href", "#plans");
  });

  it.each(["refresh_token", "access_token", "ekavyu_session"])("preserves the dashboard redirect for a signed-in %s session", name => {
    const response = proxy(new NextRequest("https://app.example/", { headers: { cookie: `${name}=session` } }));
    expect(response.headers.get("location")).toBe("https://app.example/dashboard");
  });

  it.each(["refresh_token", "access_token"])("preserves the page redirect when %s is present", async name => {
    fixture.cookies.set(name, "session");
    await expect(Home()).rejects.toThrow("redirect:/dashboard");
  });

  it("leaves dashboard authentication and expired login recovery intact", () => {
    expect(proxy(new NextRequest("https://app.example/dashboard")).headers.get("location")).toBe("https://app.example/login");
    const response = proxy(new NextRequest("https://app.example/login?expired=1", { headers: { cookie: "access_token=expired; ekavyu_session=1" } }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("access_token")?.value).toBe("");
  });
});

describe("Homepage interactions", () => {




  it("opens and closes mobile navigation, including Escape focus recovery", () => {
    render(<HomeNavigation />);
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    const navigation = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(navigation, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    fireEvent.click(screen.getAllByRole("link", { name: "For healthcare teams" })[1]);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("shows Dashboard for signed-in patients and clinic staff, and Sign in for booking guests", () => {
    fixture.authenticated = true;
    fixture.role = "doctor";
    const view = render(<HomeNavigation />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    fixture.role = "patient";
    view.rerender(<HomeNavigation />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    fixture.role = "guest";
    view.rerender(<HomeNavigation />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
