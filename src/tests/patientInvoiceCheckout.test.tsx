import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Bills from "@/app/(dashboard)/dashboard/bills/page";
import { ToastProvider } from "@/components/ui/Toast";
const fixture = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), sdk: vi.fn(), user: { id: "patient", role: "patient", name: "Patient", email: "patient@example.test" } }));
vi.mock("@/lib/api", () => ({ default: { get: fixture.get, post: fixture.post } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: () => ({ user: fixture.user }) }));
vi.mock("@/lib/razorpay", () => ({ loadRazorpayScript: fixture.sdk }));
const invoice = { id: "invoice", appointmentId: "appointment", invoiceNumber: "INV-1", totalAmount: 250, amountPaid: 0, currency: "INR", status: "unpaid", items: [], createdAt: "2026-10-01", locationId: { name: "Clinic" } };
const order = { keyId: "public-key", razorpayOrderId: "order", appointmentId: "appointment", amount: 250, currency: "INR" };
const proof = { razorpay_order_id: "order", razorpay_payment_id: "payment", razorpay_signature: "signature" };
let options: { handler: (value: typeof proof) => void; amount: number; modal: { ondismiss: () => void } };
const open = vi.fn();
beforeEach(() => {
  fixture.get.mockResolvedValue({ data: { data: [invoice] } }); fixture.sdk.mockResolvedValue(true);
  fixture.post.mockImplementation(async (url: string) => ({ data: { success: true, data: url.endsWith("create-order") ? order : null } }));
  vi.stubGlobal("Razorpay", class { constructor(value: typeof options) { options = value; } on() {} open = open; });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function start() {
  render(<ToastProvider><Bills /></ToastProvider>);
  fireEvent.click((await screen.findAllByRole("button", { name: /Pay Online/ }))[0]);
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
}
it("creates only a server order, blocks duplicates and waits for server verification", async () => {
  let finish!: (value: unknown) => void;
  fixture.post.mockImplementation((url: string) => url.endsWith("create-order") ? Promise.resolve({ data: { data: order } }) : new Promise(resolve => { finish = resolve; }));
  await start(); await waitFor(() => expect(open).toHaveBeenCalledOnce());
  expect(options.amount).toBe(25000);
  expect(fixture.post).toHaveBeenCalledWith("/appointment-payments/create-order", { appointmentId: "appointment" });
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
  await act(async () => { options.handler(proof); options.handler(proof); });
  expect(fixture.post).toHaveBeenCalledTimes(2);
  expect(fixture.post).toHaveBeenLastCalledWith("/appointment-payments/verify", { appointmentId: "appointment", razorpayOrderId: "order", razorpayPaymentId: "payment", razorpaySignature: "signature" });
  expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
  await act(async () => finish({ data: { success: true } }));
  expect(await screen.findByText("Payment confirmed")).toBeInTheDocument();
  expect(fixture.get).toHaveBeenCalledTimes(2);
});
it("retains failed verification for safe retry without creating another order", async () => {
  fixture.post.mockResolvedValueOnce({ data: { data: order } }).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: { success: true } });
  await start(); await waitFor(() => expect(open).toHaveBeenCalledOnce());
  await act(async () => options.handler(proof));
  const retry = await screen.findByRole("button", { name: "Check confirmation" });
  expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
  fireEvent.click(retry);
  expect(await screen.findByText("Payment confirmed")).toBeInTheDocument();
  expect(fixture.post.mock.calls.filter(([url]) => url.endsWith("create-order"))).toHaveLength(1);
});
it.each([
  { appointmentId: undefined }, { status: "partially_paid", amountPaid: 50, balanceDue: 200 }, { currency: "USD" }, { status: "cancelled" }, { status: "refunded" },
])("does not offer unsupported online collection for %j", async overrides => {
  fixture.get.mockResolvedValue({ data: { data: [{ ...invoice, ...overrides }] } });
  render(<ToastProvider><Bills /></ToastProvider>);
  await screen.findAllByText(/INV-1/);
  expect(screen.queryByRole("button", { name: /Pay Online/ })).not.toBeInTheDocument();
  expect(fixture.post).not.toHaveBeenCalled();
});
it("does not open checkout for changed amounts and allows dismissal without claiming success", async () => {
  fixture.post.mockResolvedValueOnce({ data: { data: { ...order, amount: 350 } } });
  await start();
  expect(await screen.findByText("Invoice details have changed. Refresh your invoices before paying.")).toBeInTheDocument();
  expect(open).not.toHaveBeenCalled();
  fixture.post.mockResolvedValueOnce({ data: { data: order } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
  await waitFor(() => expect(open).toHaveBeenCalledOnce());
  await act(async () => options.modal.ondismiss());
  expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue to payment" })).toBeEnabled();
});
it("does not open or verify checkout when the provider script fails", async () => {
  fixture.sdk.mockResolvedValueOnce(false);
  await start();
  expect(await screen.findByText("Checkout could not be loaded. Please try again.")).toBeInTheDocument();
  expect(open).not.toHaveBeenCalled();
  expect(fixture.post).toHaveBeenCalledTimes(1);
});
it("blocks another charge after an unexpected order callback", async () => {
  await start(); await waitFor(() => expect(open).toHaveBeenCalledOnce());
  await act(async () => options.handler({ ...proof, razorpay_order_id: "different-order" }));
  expect(await screen.findByText("Payment needs review")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
  expect(fixture.post).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
});
it("does not open a delayed checkout after leaving the invoice page", async () => {
  let finish!: (response: unknown) => void;
  fixture.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await start(); cleanup();
  await act(async () => finish({ data: { data: order } }));
  expect(fixture.sdk).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
