import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PasskeySignIn from "@/components/auth/PasskeySignIn";

const fixture = vi.hoisted(() => ({ post: vi.fn(), start: vi.fn(), login: vi.fn(), push: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: { post: fixture.post } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fixture.push }) }));
vi.mock("@simplewebauthn/browser", () => ({ browserSupportsWebAuthn: () => true, startAuthentication: fixture.start }));
vi.mock("@/store/authStore", () => ({ useAuthStore: { getState: () => ({ login: fixture.login }) } }));
vi.mock("@/components/ui", async (importOriginal) => ({ ...await importOriginal<typeof import("@/components/ui")>(), useToast: () => ({ toast: fixture.toast }) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("isSecureContext", true); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("uses the browser assertion and signs in only after verification", async () => {
  fixture.post.mockResolvedValueOnce({ data: { data: { challenge: "challenge" } } }).mockResolvedValueOnce({ data: { data: { user: { id: "patient" } } } });
  fixture.start.mockResolvedValue({ id: "credential" });
  render(<PasskeySignIn onTwoFactor={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with a passkey" }));
  await vi.waitFor(() => expect(fixture.login).toHaveBeenCalledWith({ id: "patient" }));
  expect(fixture.start).toHaveBeenCalledWith({ optionsJSON: { challenge: "challenge" } });
  expect(fixture.post).toHaveBeenLastCalledWith("/auth/passkeys/login/verify", { response: { id: "credential" } });
  expect(fixture.push).toHaveBeenCalledWith("/dashboard");
});
it("keeps the second factor required and does not establish a session early", async () => {
  fixture.post.mockResolvedValueOnce({ data: { data: {} } }).mockResolvedValueOnce({ data: { data: { twoFactorRequired: true, twoFactorToken: "pending" } } });
  fixture.start.mockResolvedValue({ id: "credential" });
  const onTwoFactor = vi.fn();
  render(<PasskeySignIn onTwoFactor={onTwoFactor} />);
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with a passkey" }));
  await vi.waitFor(() => expect(onTwoFactor).toHaveBeenCalledWith("pending"));
  expect(fixture.login).not.toHaveBeenCalled();
});
it("explains cancellation instead of silently doing nothing", async () => {
  fixture.post.mockResolvedValue({ data: { data: {} } });
  fixture.start.mockRejectedValue(new DOMException("Cancelled", "NotAllowedError"));
  render(<PasskeySignIn onTwoFactor={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with a passkey" }));
  await vi.waitFor(() => expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Passkey sign-in was not completed" })));
  expect(fixture.login).not.toHaveBeenCalled();
});
it("explains the secure-context requirement before starting authentication", async () => {
  vi.stubGlobal("isSecureContext", false);
  render(<PasskeySignIn onTwoFactor={vi.fn()} />);
  expect(await screen.findByRole("button", { name: "Sign in with a passkey" })).toBeDisabled();
  expect(screen.getByText(/Passkeys need HTTPS/)).toBeInTheDocument();
  expect(fixture.post).not.toHaveBeenCalled();
});
