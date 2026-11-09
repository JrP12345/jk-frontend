import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import VerifyEmailPage from "@/app/verify-email/page";

const fixture = vi.hoisted(() => ({ query: "", push: vi.fn(), post: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(fixture.query), useRouter: () => ({ push: fixture.push }) }));
vi.mock("@/lib/api", () => ({ default: { post: fixture.post } }));
vi.mock("@/components/ui", async original => ({ ...await original<typeof import("@/components/ui")>(), ModeSwitcher: () => null, useToast: () => ({ toast: fixture.toast }) }));
beforeEach(() => { vi.clearAllMocks(); fixture.query = "token=synthetic-reset&email=staff%40example.test"; });

function fillPasswords(confirmation = "StrongPassword123!") {
  fireEvent.change(screen.getByLabelText("New Password *"), { target: { value: "StrongPassword123!" } });
  fireEvent.change(screen.getByLabelText("Confirm New Password *"), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
}

describe("Password recovery in the shared account frame", () => {
  it("does not submit a missing token or mismatched password", () => {
    fixture.query = "";
    render(<ResetPasswordPage />);
    fillPasswords("DifferentPassword123!");
    expect(screen.getByText("Passwords do not match")).toBeVisible();
    expect(fixture.post).not.toHaveBeenCalled();
    fillPasswords();
    expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid Link" }));
    expect(fixture.post).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Browse locations" })).toHaveAttribute("href", "/browse");
  });

  it("uses the existing reset contract and offers sign-in after success", async () => {
    fixture.post.mockResolvedValue({ data: { success: true } });
    render(<ResetPasswordPage />);
    fillPasswords();
    await waitFor(() => expect(fixture.post).toHaveBeenCalledWith("/auth/reset-password", { token: "synthetic-reset", email: "staff@example.test", newPassword: "StrongPassword123!" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Password Updated" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Proceed to Sign In" }));
    expect(fixture.push).toHaveBeenCalledWith("/login");
  });

  it("retains the form when the server rejects an expired token", async () => {
    fixture.post.mockRejectedValue({ response: { data: { message: "Reset link expired" } } });
    render(<ResetPasswordPage />);
    fillPasswords();
    await waitFor(() => expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Reset Failed", description: "Reset link expired" })));
    expect(screen.getByRole("button", { name: "Update Password" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Password Updated" })).not.toBeInTheDocument();
  });
});

describe("Email verification in the shared account frame", () => {
  it("offers recovery without sending a verification request when no token is supplied", () => {
    fixture.query = "";
    render(<VerifyEmailPage />);
    expect(screen.getByRole("heading", { name: "Verification Link Missing" })).toBeVisible();
    expect(fixture.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Go to Login" }));
    expect(fixture.push).toHaveBeenCalledWith("/login");
  });

  it("verifies the supplied token and keeps sign-in as the next step", async () => {
    fixture.query = "token=synthetic-email";
    fixture.post.mockResolvedValue({ data: { success: true } });
    render(<VerifyEmailPage />);
    expect(await screen.findByRole("heading", { name: "Email Verified!" })).toBeVisible();
    expect(fixture.post).toHaveBeenCalledExactlyOnceWith("/auth/verify-email", { token: "synthetic-email" });
    fireEvent.click(screen.getByRole("button", { name: "Continue to Login" }));
    expect(fixture.push).toHaveBeenCalledWith("/login");
  });

  it("shows a rejected verification link without granting a session", async () => {
    fixture.post.mockRejectedValue({ response: { data: { message: "Verification link expired" } } });
    render(<VerifyEmailPage />);
    expect(await screen.findByRole("heading", { name: "Verification Failed" })).toBeVisible();
    expect(screen.getByText("Verification link expired")).toBeVisible();
    expect(fixture.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Return to Login" })).toBeEnabled();
  });
});
