import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RefundReconciliationAction } from "@/components/billing/RefundReconciliationAction";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({ default: { post: vi.fn() } }));
beforeEach(() => useAuthStore.setState({ user: { id: "cashier", name: "Cashier", email: "cashier@example.test", role: "cashier", organization_id: "org-a", permissions: ["MANAGE_BILLING"] } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each(["pending", "review", "processed"])("shows the %s result and reloads only after confirmation", async status => {
  vi.mocked(api.post).mockResolvedValue({ data: { data: { status, message: `Refund ${status}` } } });
  const reload = vi.fn();
  render(<RefundReconciliationAction appointmentId="appointment" onReconciled={reload} />);
  fireEvent.click(screen.getByRole("button", { name: "Check refund status" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`Refund ${status}`));
  expect(api.post).toHaveBeenCalledWith("/appointment-payments/reconcile-refund", { appointmentId: "appointment" });
  expect(reload).toHaveBeenCalledTimes(status === "processed" ? 1 : 0);
});
it("does not apply a queued confirmation after workspace changes", async () => {
  let finish!: (result: unknown) => void;
  vi.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const reload = vi.fn();
  render(<RefundReconciliationAction appointmentId="appointment" onReconciled={reload} />);
  const button = screen.getByRole("button", { name: "Check refund status" });
  fireEvent.click(button); fireEvent.click(button);
  expect(api.post).toHaveBeenCalledOnce();
  act(() => useAuthStore.setState({ user: null }));
  await act(async () => finish({ data: { data: { status: "processed", message: "Old confirmation" } } }));
  expect(screen.queryByText("Old confirmation")).not.toBeInTheDocument();
  expect(reload).not.toHaveBeenCalled();
});
it("reports a read failure without claiming a refund was issued", async () => {
  vi.mocked(api.post).mockRejectedValue(new Error("unavailable"));
  const reload = vi.fn();
  render(<RefundReconciliationAction appointmentId="appointment" onReconciled={reload} />);
  fireEvent.click(screen.getByRole("button", { name: "Check refund status" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Could not confirm"));
  expect(reload).not.toHaveBeenCalled();
});
