import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import RegisterPage from "@/app/(auth)/register/page";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { datePickerInput } from "./datePickerTestUtils";

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api", () => ({ default: api }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  api.post.mockReset().mockResolvedValue({ data: { success: false } });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

it("keeps a selected birth date and its autofill metadata through OTP verification", async () => {
  render(<ThemeProvider><ToastProvider><RegisterPage /></ToastProvider></ThemeProvider>);
  fireEvent.change(screen.getByLabelText("Full Name *"), { target: { value: "Test Patient" } });
  fireEvent.change(screen.getByLabelText("Mobile Phone Number *"), { target: { value: "9876543210" } });
  const trigger = screen.getByRole("button", { name: "Date of Birth" });
  expect(datePickerInput(trigger)).toHaveAttribute("autocomplete", "bday");
  fireEvent.click(trigger);
  const popup = await screen.findByRole("dialog", { name: "Choose Date of Birth" });
  fireEvent.click(within(popup).getByRole("button", { name: String(new Date().getFullYear()), exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: "1990", exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: new Date().toLocaleDateString("en-US", { month: "long" }), exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: "Jan", exact: true }));
  fireEvent.click(within(popup).getByRole("button", { name: /15.*January.*1990|January.*15.*1990/ }));
  fireEvent.click(screen.getByRole("button", { name: "Send Verification OTP" }));
  fireEvent.change(await screen.findByLabelText("6-Digit Verification Code *"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Complete Registration" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith("/auth/otp/verify", expect.objectContaining({ name: "Test Patient", dateOfBirth: "1990-01-15", otp: "123456", purpose: "authentication" })));
});
