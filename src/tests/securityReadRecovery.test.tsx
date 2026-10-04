import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Security from "@/app/(dashboard)/dashboard/security/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), user: { id: "owner", role: "admin", impersonatedBy: undefined as string | undefined } }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@simplewebauthn/browser", () => ({ browserSupportsWebAuthn: () => false, startRegistration: vi.fn() }));
afterEach(() => { cleanup(); fixture.get.mockReset(); fixture.user.impersonatedBy = undefined; });
it("retries a security read without claiming the account has no passkeys", async () => {
  fixture.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { data: [] } });
  render(<ToastProvider><Security /></ToastProvider>);
  expect(await screen.findByText("Security settings unavailable")).toBeInTheDocument();
  expect(screen.queryByText("No passkeys added yet.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No passkeys added yet.")).toBeInTheDocument();
  await waitFor(() => expect(fixture.get).toHaveBeenCalledTimes(2));
  expect(fixture.get).toHaveBeenLastCalledWith("/auth/passkeys");
});
it("does not read or manage another account's security during impersonation", () => {
  fixture.user.impersonatedBy = "root";
  render(<ToastProvider><Security /></ToastProvider>);
  expect(screen.getByText("Return to your own account to manage account security.")).toBeInTheDocument();
  expect(fixture.get).not.toHaveBeenCalled();
});
