import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import RegisterPage from "@/components/auth/PatientRegistrationForm";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { datePickerInput } from "./datePickerTestUtils";
import { useAuthStore } from "@/store/authStore";

const api = vi.hoisted(() => ({ post: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: api.replace }) }));
beforeEach(() => {
  api.post.mockReset().mockResolvedValue({ data: { success: true, data: {} } });
  api.replace.mockReset();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, authError: null });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

function enterDetails() {
  fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "Test Patient" } });
  fireEvent.change(screen.getByLabelText("Mobile Phone Number *"), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
}

it("freezes the requested destination and blocks repeated requests while delivery is pending", async () => {
  let finish!: (value: unknown) => void;
  api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<ThemeProvider><ToastProvider><RegisterPage /></ToastProvider></ThemeProvider>);
  enterDetails();
  expect(screen.getByLabelText("Mobile Phone Number *")).toBeDisabled();
  fireEvent.submit(screen.getByRole("button", { name: "Send verification code" }).closest("form")!);
  expect(api.post).toHaveBeenCalledOnce();
  await act(async () => finish({ data: { success: true, data: {} } }));
  expect(await screen.findByLabelText("6-Digit Verification Code *")).toBeEnabled();
});

it.each([
  { success: false, data: {} },
  { success: true, data: {} },
  { success: true, data: { twoFactorRequired: true, twoFactorToken: "synthetic-challenge" } },
  { success: true, data: { workspaceRequired: true, workspaceToken: "synthetic-workspace" } },
  { success: true, data: { user: { id: "guest", role: "guest" } } },
])("keeps rejected, incomplete and challenged verification recoverable without authenticating: %j", async response => {
  api.post.mockResolvedValueOnce({ data: { success: true, data: {} } }).mockResolvedValueOnce({ data: response });
  render(<ThemeProvider><ToastProvider><RegisterPage /></ToastProvider></ThemeProvider>);
  enterDetails();
  fireEvent.change(await screen.findByLabelText("6-Digit Verification Code *"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Complete Registration" }));
  expect(await screen.findByText("Code could not be verified")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Complete Registration" })).toBeEnabled();
  expect(screen.getByRole("link", { name: "Already registered? Sign in" })).toHaveAttribute("href", "/login");
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(api.replace).not.toHaveBeenCalled();
});

it("hands a verified account to the same dashboard entry as sign-in and prevents resubmission", async () => {
  api.post.mockResolvedValueOnce({ data: { success: true, data: {} } }).mockResolvedValueOnce({ data: { success: true, data: { user: { id: "patient", name: "Test Patient", role: "patient", email: "patient@example.test" } } } });
  render(<ThemeProvider><ToastProvider><RegisterPage /></ToastProvider></ThemeProvider>);
  enterDetails();
  fireEvent.change(await screen.findByLabelText("6-Digit Verification Code *"), { target: { value: "123456" } });
  const submit = screen.getByRole("button", { name: "Complete Registration" });
  fireEvent.click(submit);
  await waitFor(() => expect(api.replace).toHaveBeenCalledExactlyOnceWith("/dashboard"));
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(submit).toBeDisabled();
  fireEvent.submit(submit.closest("form")!);
  expect(api.post).toHaveBeenCalledTimes(2);
});

it("keeps registration details when delivery fails inside a successful HTTP response", async () => {
  api.post.mockResolvedValueOnce({ data: { success: true, data: { success: false } } });
  render(<ThemeProvider><ToastProvider><RegisterPage /></ToastProvider></ThemeProvider>);
  fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "Test Patient" } });
  fireEvent.change(screen.getByLabelText("Mobile Phone Number *"), { target: { value: "9876543210" } });
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  expect(await screen.findByText("Verification code could not be sent")).toBeInTheDocument();
  expect(screen.getByLabelText("Full Name *")).toHaveValue("Test Patient");
  expect(screen.getByLabelText("Mobile Phone Number *")).toHaveValue("9876543210");
  expect(screen.queryByLabelText("6-Digit Verification Code *")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send verification code" })).toBeEnabled();
  expect(api.post).toHaveBeenCalledOnce();
});

it("keeps a selected birth date and its autofill metadata through OTP verification", async () => {
  render(<ThemeProvider><ToastProvider><RegisterPage /></ToastProvider></ThemeProvider>);
  fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "Test Patient" } });
  fireEvent.change(screen.getByLabelText("Mobile Phone Number *"), { target: { value: "9876543210" } });
  const trigger = screen.getByRole("button", { name: /^Date of Birth/ });
  expect(datePickerInput(trigger)).toHaveAttribute("autocomplete", "bday");
  fireEvent.click(trigger);
  const popup = await screen.findByRole("dialog", { name: "Choose Date of Birth" });
  fireEvent.click(within(popup).getByRole("button", { name: String(new Date().getFullYear()), exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: "1990", exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: new Date().toLocaleDateString("en-US", { month: "long" }), exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: "Jan", exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: /15.*January.*1990|January.*15.*1990/ }));
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
  fireEvent.change(await screen.findByLabelText("6-Digit Verification Code *"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Complete Registration" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/auth/otp/verify", expect.objectContaining({ name: "Test Patient", dateOfBirth: "1990-01-15", otp: "123456", purpose: "authentication" })));
});
