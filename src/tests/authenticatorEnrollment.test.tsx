import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthenticatorEnrollment } from "@/components/auth/AuthenticatorEnrollment";
const fixture = vi.hoisted(() => ({ post: vi.fn(), checkAuth: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: { post: fixture.post } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => fixture }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("starts setup explicitly and refreshes authoritative state only after a verified code", async () => {
  fixture.post.mockResolvedValueOnce({ data: { data: { secret: "TESTONLYKEY", qrCodeDataUrl: "data:image/png;base64,fixture" } } }).mockResolvedValueOnce({ data: { data: { twoFactorEnabled: true } } });
  render(<AuthenticatorEnrollment required />);
  expect(fixture.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
  fireEvent.change(await screen.findByLabelText("6-digit authenticator code"), { target: { value: "12a3456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
  await waitFor(() => expect(fixture.checkAuth).toHaveBeenCalledOnce());
  expect(fixture.post).toHaveBeenLastCalledWith("/onboarding/totp/verify", { token: "123456" });
  expect(screen.queryByText("TESTONLYKEY")).not.toBeInTheDocument();
});
it("keeps a failed code retryable and does not claim enrollment succeeded", async () => {
  fixture.post.mockResolvedValueOnce({ data: { data: { secret: "TESTONLYKEY", qrCodeDataUrl: "data:image/png;base64,fixture" } } }).mockRejectedValueOnce(new Error("offline"));
  render(<AuthenticatorEnrollment required />);
  fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
  fireEvent.change(await screen.findByLabelText("6-digit authenticator code"), { target: { value: "654321" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
  expect(await screen.findByText(/The code could not be verified/)).toBeInTheDocument();
  expect(fixture.checkAuth).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Verify and continue" })).toBeEnabled();
});
