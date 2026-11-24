import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacyOnlinePayment } from "@/components/pharmacy/PharmacyOnlinePayment";
import { useAuthStore } from "@/store/authStore";
import { ToastProvider } from "@/components/ui";
import type { CounterInvoice } from "@/lib/pharmacyCollections";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const loader = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ default: api }));
vi.mock("@/lib/razorpay", () => ({ loadRazorpayScript: loader }));
const invoice = { id: "invoice", invoiceNumber: "I00012627/000001", locationId: "branch", paymentRevision: 0, balanceDue: 20, totalAmount: 20 } as CounterInvoice;
const intent = { id: "a".repeat(24), invoiceId: "invoice", locationId: "branch", keyId: "rzp_test_merchant", orderId: "order_Original", currency: "INR", amountPaise: 2000, state: "ready" };
const receipt = { receiptId: "receipt", invoiceId: "invoice", invoiceNumber: invoice.invoiceNumber, locationId: "branch", currency: "INR", actorId: "cashier", paidAt: "2026-11-22T08:00:00Z", creditedPaise: 0, collectedPaise: 2000, paidPaise: 2000, balancePaise: 0, revision: 1, cashTenderedPaise: 0, cashChangePaise: 0, status: "paid", evidenceMode: "provider_verified", providerEvidence: { intentId: intent.id, paymentId: "pay_Verified", capturedAt: "2026-11-22T07:59:00Z" }, shiftId: "d".repeat(24), drawerCode: "DRAWER-1", entries: [{ componentId: intent.id, amountPaise: 2000, paymentMethod: "upi", referenceNumber: "pay_Verified" }] };
const response = (data: unknown) => ({ data: { data } });
let options: Record<string, any>;
beforeEach(() => {
  sessionStorage.clear(); api.get.mockReset().mockResolvedValue(response({ locationId: "branch", intent: null })); api.post.mockReset(); loader.mockReset().mockResolvedValue(true); options = {};
  useAuthStore.setState({ user: { id: "cashier", name: "Cashier", role: "cashier", email: "cashier@example.test", organization_id: "org", permissions: ["PHARMACY_COLLECT_PAYMENT"] } });
  Object.defineProperty(window, "Razorpay", { configurable: true, writable: true, value: class { constructor(value: Record<string, any>) { options = value; } open() {} close() {} } });
});
afterEach(() => { vi.restoreAllMocks(); delete (window as Window & { Razorpay?: unknown }).Razorpay; });
async function open(onCollected = vi.fn()) { const view = render(<ToastProvider><PharmacyOnlinePayment invoice={invoice} disabled={false} onCollected={onCollected} /></ToastProvider>); fireEvent.click(screen.getByText("Verify an online payment with the pharmacy gateway")); await screen.findByRole("button", { name: "Start pharmacy online checkout" }); return { ...view, onCollected }; }
it("does not trust the popup result and accepts only a server-verified receipt", async () => {
  api.post.mockResolvedValueOnce(response(intent)).mockResolvedValueOnce(response({ ...intent, state: "posted", receipt })); const view = await open();
  await waitFor(() => expect(screen.getByRole("button", { name: "Start pharmacy online checkout" })).toBeEnabled()); fireEvent.click(screen.getByRole("button", { name: "Start pharmacy online checkout" }));
  await waitFor(() => expect(options.order_id).toBe("order_Original")); expect(view.onCollected).not.toHaveBeenCalled();
  await act(async () => { options.handler({ razorpay_payment_id: "pay_UntrustedPopup" }); });
  await waitFor(() => expect(view.onCollected).toHaveBeenCalledOnce()); expect(api.post.mock.calls[1][1]).toEqual({ locationId: "branch" }); expect(view.onCollected.mock.calls[0][0].providerEvidence.paymentId).toBe("pay_Verified");
});
it("reopens the existing provider order after reload without creating another charge", async () => {
  api.get.mockResolvedValue(response({ locationId: "branch", intent })); render(<ToastProvider><PharmacyOnlinePayment invoice={invoice} disabled={false} onCollected={vi.fn()} /></ToastProvider>); fireEvent.click(screen.getByText("Verify an online payment with the pharmacy gateway"));
  fireEvent.click(await screen.findByRole("button", { name: "Reopen original online checkout" })); await waitFor(() => expect(options.order_id).toBe("order_Original")); expect(api.post).not.toHaveBeenCalled();
});
it("keeps a captured payment needing review from being presented as paid", async () => {
  api.get.mockResolvedValue(response({ locationId: "branch", intent: { ...intent, state: "captured" } })); api.post.mockRejectedValue({ response: { data: { message: "Money captured; drawer needs reconciliation" } } });
  const collected = vi.fn(); render(<ToastProvider><PharmacyOnlinePayment invoice={invoice} disabled={false} onCollected={collected} /></ToastProvider>); fireEvent.click(screen.getByText("Verify an online payment with the pharmacy gateway"));
  fireEvent.click(await screen.findByRole("button", { name: "Verify captured payment" })); expect(await screen.findByText("Money captured; drawer needs reconciliation")).toBeInTheDocument(); expect(collected).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Reopen original online checkout" })).toBeDisabled();
});
