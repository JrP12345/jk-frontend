import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import AuthEntry from "@/components/auth/AuthEntry";
import AuthRouteLayout from "@/components/auth/AuthRouteLayout";
import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import { useAuthStore } from "@/store/authStore";

const fixture = vi.hoisted(() => ({ post: vi.fn(), replace: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: { post: fixture.post } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: fixture.replace }), useSelectedLayoutSegment: () => "login", redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/components/ui", async original => ({ ...await original<typeof import("@/components/ui")>(), useToast: () => ({ toast: fixture.toast }), ModeSwitcher: () => <button>Appearance</button> }));
vi.mock("@/components/auth/PasskeySignIn", () => ({ default: () => <button>Use passkey</button> }));

beforeEach(() => {
  vi.clearAllMocks();
  fixture.post.mockReset();
  window.history.replaceState(null, "", "/login");
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, isLoggingOut: false });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

it("switches forms in the same account frame and URL path without router navigation", () => {
  const view = render(<AuthRouteLayout><AuthEntry /></AuthRouteLayout>);
  const frame = screen.getByRole("main");
  const brand = screen.getByRole("complementary", { name: "About Ekavyu" });
  fireEvent.click(screen.getByRole("button", { name: "Create patient account" }));
  expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/login");
  expect(window.location.search).toBe("?mode=register");
  expect(screen.getByRole("main")).toBe(frame);
  expect(screen.getByRole("complementary", { name: "About Ekavyu" })).toBe(brand);
  fireEvent.click(screen.getByRole("button", { name: "Sign In", exact: true }));
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  expect(window.location.pathname + window.location.search).toBe("/login");
  expect(view.container.querySelectorAll("[data-auth-page]")).toHaveLength(1);
  expect(fixture.replace).not.toHaveBeenCalled();
  expect(fixture.post).not.toHaveBeenCalled();
});

it("renders registration directly from its canonical link and redirects the former route", async () => {
  render(<AuthRouteLayout>{await LoginPage({ searchParams: Promise.resolve({ mode: "register" }) })}</AuthRouteLayout>);
  expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  expect(() => RegisterPage()).toThrow("redirect:/login?mode=register");
});

it("opens staff sign-in directly without granting an authenticated session", async () => {
  render(<AuthRouteLayout>{await LoginPage({ searchParams: Promise.resolve({ audience: "staff" }) })}</AuthRouteLayout>);
  expect(screen.getByLabelText("Staff Email Address *")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Create patient account" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Request clinic setup" })).toHaveAttribute("href", "/onboarding?mode=new_org");
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(fixture.post).not.toHaveBeenCalled();
});

it("blocks audience and registration switches while a patient code request is pending", async () => {
  let finish!: (value: unknown) => void;
  fixture.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<AuthRouteLayout><AuthEntry /></AuthRouteLayout>);
  fireEvent.change(screen.getByLabelText("Email or mobile number"), { target: { value: "patient@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  expect(screen.getByRole("tab", { name: "Staff" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Create patient account" })).toBeDisabled();
  await act(async () => finish({ data: { success: false } }));
  expect(screen.getByRole("button", { name: "Create patient account" })).toBeEnabled();
  expect(fixture.post).toHaveBeenCalledExactlyOnceWith("/auth/otp/request", { email: "patient@example.test", purpose: "authentication" });
});

it("keeps staff MFA required and clears the password when leaving the staff form", async () => {
  fixture.post.mockResolvedValueOnce({ data: { success: true, data: { twoFactorRequired: true, twoFactorToken: "synthetic-challenge" } } });
  render(<AuthRouteLayout><AuthEntry initialAudience="staff" /></AuthRouteLayout>);
  fireEvent.change(screen.getByLabelText("Staff Email Address *"), { target: { value: "staff@example.test" } });
  fireEvent.change(screen.getByLabelText("Password *"), { target: { value: "SyntheticPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign In to Dashboard" }));
  expect(await screen.findByRole("dialog", { name: "Two-Factor Authentication" })).toBeVisible();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(fixture.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("tab", { name: "Patient" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Patient" })).toBeEnabled());
  fireEvent.click(screen.getByRole("tab", { name: "Patient" }));
  fireEvent.click(screen.getByRole("button", { name: "Create patient account" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign In", exact: true }));
  fireEvent.click(screen.getByRole("tab", { name: "Staff" }));
  expect(screen.getByLabelText("Password *")).toHaveValue("");
});
