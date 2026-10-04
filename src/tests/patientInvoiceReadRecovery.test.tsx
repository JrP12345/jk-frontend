import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import Bills from "@/app/(dashboard)/dashboard/bills/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), user: { id: "patient", role: "patient" } }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
afterEach(() => { cleanup(); fixture.get.mockReset(); });
it("retries an invoice read without starting a payment or treating failure as empty", async () => {
  fixture.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { data: [] } });
  render(<ToastProvider><Bills /></ToastProvider>);
  expect(await screen.findByText("Your invoices could not be loaded. Please try again.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(fixture.get).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText("Your invoices could not be loaded. Please try again.")).not.toBeInTheDocument());
  expect(fixture.get).toHaveBeenLastCalledWith("/invoices");
});
