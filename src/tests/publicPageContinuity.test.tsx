import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import LoginPage from "@/components/auth/LoginForm";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { useAuthStore } from "@/store/authStore";
import DoctorLoading from "@/app/doctor/[slug]/loading";
import FacilityLoading from "@/app/browse/[slug]/loading";

const fixture = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() }, toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => fixture.router, usePathname: () => "/browse" }));
vi.mock("@/components/ui", async original => ({ ...await original<typeof import("@/components/ui")>(), useToast: () => ({ toast: fixture.toast }) }));

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, isLoggingOut: false });
  window.history.replaceState(null, "", "/login");
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

it.each([
  [DoctorLoading, "Loading doctor profile"],
  [FacilityLoading, "Loading location and doctor details"],
] as const)("keeps slow profile navigation in the public frame: %s", (LoadingPage, label) => {
  render(<ThemeProvider><LoadingPage /></ThemeProvider>);
  expect(screen.getByRole("status", { name: label })).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("link", { name: "Ekavyu home" })).toHaveAttribute("href", "/");
});

it("keeps public navigation focused and links directly to practice setup", () => {
  render(<ThemeProvider><MarketplaceNavbar showSignUp showSearch={false} showProviderRequest /></ThemeProvider>);
  expect(screen.getByRole("link", { name: "Ekavyu home" })).toHaveAttribute("href", "/");
  expect(within(screen.getByRole("navigation", { name: "Practice setup" })).getByRole("link", { name: "List your practice" })).toHaveAttribute("href", "/onboarding?mode=new_org");
  expect(screen.queryByRole("link", { name: "For patients" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "For providers" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Toggle Menu" }));
  const menu = screen.getByRole("dialog", { name: "Navigation" });
  expect(within(menu).getByRole("link", { name: "List your practice" })).toHaveAttribute("href", "/onboarding?mode=new_org");
  expect(within(menu).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  const requestLink = within(menu).getByRole("link", { name: "List your practice" });
  requestLink.addEventListener("click", event => event.preventDefault(), { once: true });
  fireEvent.click(requestLink);
  expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
});

it("opens provider links in the staff panel and keeps patient registration distinct", () => {
  window.history.replaceState(null, "", "/login?audience=staff");
  render(<ThemeProvider><LoginPage /></ThemeProvider>);
  expect(screen.getByRole("tab", { name: "Staff" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("link", { name: "Request clinic setup" })).toHaveAttribute("href", "/onboarding?mode=new_org");
  expect(screen.getByRole("link", { name: "Start pharmacy onboarding" })).toHaveAttribute("href", "/pharmacy-start");
  fireEvent.click(screen.getByRole("tab", { name: "Patient" }));
  expect(screen.getByRole("link", { name: "Create patient account" })).toHaveAttribute("href", "/login?mode=register");
});

it("releases the phone account menu and scroll lock when resizing to desktop", () => {
  const initialWidth = window.innerWidth;
  useAuthStore.setState({ user: { id: "patient", name: "Patient", email: "patient@example.test", role: "patient" }, isAuthenticated: true });
  render(<ThemeProvider><MarketplaceNavbar /></ThemeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Toggle Menu" }));
  expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  fireEvent(window, new Event("resize"));
  expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  expect(document.body.style.position).not.toBe("fixed");
  Object.defineProperty(window, "innerWidth", { configurable: true, value: initialWidth });
});
