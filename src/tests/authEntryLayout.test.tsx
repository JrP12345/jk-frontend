import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import AuthRouteLayout from "@/components/auth/AuthRouteLayout";
import AuthPageShell from "@/components/auth/AuthPageShell";
import AuthPageLoading from "@/components/auth/AuthPageLoading";

const fixture = vi.hoisted(() => ({ segment: "login" }));
vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => fixture.segment }));
vi.mock("@/components/ui", async original => ({ ...await original<typeof import("@/components/ui")>(), ModeSwitcher: () => <button>Appearance</button> }));
beforeEach(() => { fixture.segment = "login"; });

it("preserves the account frame and appearance control while only the entry form changes", () => {
  const view = render(<AuthRouteLayout><AuthPageShell><h1>Sign in form</h1></AuthPageShell></AuthRouteLayout>);
  const frame = screen.getByRole("main");
  const brand = screen.getByRole("complementary", { name: "About Ekavyu" });
  const appearance = screen.getByRole("button", { name: "Appearance" });
  fixture.segment = "register";
  view.rerender(<AuthRouteLayout><AuthPageShell wide><h1>Registration form</h1></AuthPageShell></AuthRouteLayout>);
  expect(screen.getByRole("main")).toBe(frame);
  expect(screen.getByRole("complementary", { name: "About Ekavyu" })).toBe(brand);
  expect(screen.getByRole("button", { name: "Appearance" })).toBe(appearance);
  expect(screen.getByRole("heading", { name: "Registration form" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Sign in form" })).not.toBeInTheDocument();
  expect(view.container.querySelectorAll("[data-auth-page]")).toHaveLength(1);
});

it("keeps destination loading inside the existing frame without another page shell", () => {
  const view = render(<AuthRouteLayout><AuthPageShell><h1>Sign in form</h1></AuthPageShell></AuthRouteLayout>);
  const frame = screen.getByRole("main");
  fixture.segment = "register";
  view.rerender(<AuthRouteLayout><AuthPageLoading registration /></AuthRouteLayout>);
  expect(screen.getByRole("main")).toBe(frame);
  expect(screen.getByRole("status", { name: "Loading registration" })).toHaveAttribute("aria-busy", "true");
  expect(view.container.querySelectorAll("[data-auth-page]")).toHaveLength(1);
});

it("leaves assisted setup and recovery pages in charge of their own framing", () => {
  fixture.segment = "onboarding";
  const view = render(<AuthRouteLayout><AuthPageShell wide><h1>Request setup</h1></AuthPageShell></AuthRouteLayout>);
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(view.container.querySelectorAll("[data-auth-content]")).toHaveLength(0);
});
