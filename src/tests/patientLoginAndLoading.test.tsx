import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";
import LoginLoading from "@/app/(auth)/login/loading";
import RootLoading from "@/app/loading";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

const { push, replace, toast } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("@/components/auth/PasskeySignIn", () => ({ default: () => <button type="button">Use passkey</button> }));
vi.mock("@/components/ui", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/components/ui")>(),
  useToast: () => ({ toast }),
  ModeSwitcher: () => null,
}));

const patient = { id: "patient-1", role: "patient" as const, name: "Patient", email: "patient@example.com", permissions: [] };

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
});
afterEach(() => vi.restoreAllMocks());

describe("Patient identifier sign in", () => {
  it("detects email without a method selector and verifies the same normalized destination", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: { data: {} } }).mockResolvedValueOnce({ data: { data: { user: patient } } });
    render(<LoginPage />);
    expect(screen.queryByRole("button", { name: "Mobile Phone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Email Address" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Email or mobile number" }), { target: { value: " Patient@Example.COM " } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification OTP" }));
    expect(await screen.findByText("patient@example.com")).toBeInTheDocument();
    expect(post).toHaveBeenNthCalledWith(1, "/auth/otp/request", { email: "patient@example.com", purpose: "authentication" });
    fireEvent.change(screen.getByRole("textbox", { name: /6-Digit Verification OTP/ }), { target: { value: "482910" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & Sign In" }));
    await waitFor(() => expect(post).toHaveBeenNthCalledWith(2, "/auth/otp/verify", { email: "patient@example.com", otp: "482910", purpose: "authentication" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it.each(["9876543210", "+91 (98765) 43210", "09876543210"])("detects and normalizes mobile input %s", async (identifier) => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { data: {} } });
    render(<LoginPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email or mobile number" }), { target: { value: identifier } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification OTP" }));
    expect(await screen.findByText("+91 9876543210")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/auth/otp/request", { phone: "9876543210", purpose: "authentication" });
  });

  it.each(["bad@email", "abc9876543210", "12345"])("rejects malformed input %s without requesting a code", async (identifier) => {
    const post = vi.spyOn(api, "post");
    render(<LoginPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email or mobile number" }), { target: { value: identifier } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification OTP" }));
    expect(screen.getByText("Enter a valid email address or 10-digit mobile number.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("clears the old verification state when changing from email to phone", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { data: {} } });
    render(<LoginPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email or mobile number" }), { target: { value: patient.email } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification OTP" }));
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Email or mobile number" }), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification OTP" }));
    expect(await screen.findByText("+91 9876543210")).toBeInTheDocument();
    expect(post).toHaveBeenNthCalledWith(2, "/auth/otp/request", { phone: "9876543210", purpose: "authentication" });
    expect(screen.getByRole("textbox", { name: /6-Digit Verification OTP/ })).toHaveValue("");
  });

  it("blocks duplicate code requests and tab changes while the request is pending", async () => {
    let resolveRequest!: (value: unknown) => void;
    const post = vi.spyOn(api, "post").mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
    render(<LoginPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email or mobile number" }), { target: { value: patient.email } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification OTP" }));
    const pending = screen.getByRole("button", { name: "Sending code…" });
    expect(pending).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Staff Email/ })).toBeDisabled();
    fireEvent.click(pending);
    expect(post).toHaveBeenCalledOnce();
    await act(async () => resolveRequest({ data: { data: {} } }));
    expect(await screen.findByRole("button", { name: "Verify & Sign In" })).toBeEnabled();
  });

  it("preserves staff email/password sign in", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { data: { user: { ...patient, role: "doctor" } } } });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("tab", { name: /Staff Email/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Staff Email Address/ }), { target: { value: "doctor@example.com" } });
    fireEvent.change(screen.getByLabelText("Password *"), { target: { value: "test-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In to Dashboard" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/auth/login", { email: "doctor@example.com", password: "test-only-password" }));
  });

  it("keeps staff two-factor verification loading separate from patient code requests", async () => {
    let resolveVerification!: (value: unknown) => void;
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: { data: { twoFactorRequired: true, twoFactorToken: "test-challenge" } } })
      .mockImplementationOnce(() => new Promise(resolve => { resolveVerification = resolve; }));
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("tab", { name: /Staff Email/ }));
    fireEvent.change(screen.getByRole("textbox", { name: /Staff Email Address/ }), { target: { value: "root@example.com" } });
    fireEvent.change(screen.getByLabelText("Password *"), { target: { value: "test-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In to Dashboard" }));
    const otp = await screen.findByRole("textbox", { name: /6-Digit OTP Code/ });
    fireEvent.change(otp, { target: { value: "482910" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify & Sign In" }));
    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
    expect(otp).toBeDisabled();
    expect(post).toHaveBeenNthCalledWith(2, "/auth/login/verify-2fa", { twoFactorToken: "test-challenge", otp: "482910" });
    await act(async () => resolveVerification({ data: { data: { user: { ...patient, role: "root" } } } }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("Page loading feedback", () => {
  it("provides a destination skeleton for login instead of the generic splash", () => {
    render(<LoginLoading />);
    expect(screen.getByRole("status", { name: "Loading sign in" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Loading platform content...")).not.toBeInTheDocument();
  });

  it("provides one accessible status for the full-page fallback", () => {
    render(<RootLoading />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Loading…" })).toHaveClass("min-h-dvh");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
