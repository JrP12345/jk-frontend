"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { loadRazorpayScript } from "@/lib/razorpay";
import { validateCollectionReceipt, type CollectionReceipt, type CounterInvoice } from "@/lib/pharmacyCollections";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
type Intent = { id: string; locationId: string; invoiceId: string; keyId: string; orderId?: string; amountPaise: number; currency: string; state: string; reviewReason?: string };
type CheckoutInstance = { open: () => void; close: () => void };
type CheckoutConstructor = new (options: Record<string, unknown>) => CheckoutInstance;
export function PharmacyOnlinePayment({ invoice, disabled, onCollected }: { invoice: CounterInvoice; disabled: boolean; onCollected: (receipt: CollectionReceipt) => void }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Verify an online payment with the pharmacy gateway</summary>{open && <OnlineSession key={`${invoice.id}:${invoice.paymentRevision}`} invoice={invoice} disabled={disabled} onCollected={onCollected} />}</details>;
}
function OnlineSession({ invoice, disabled, onCollected }: { invoice: CounterInvoice; disabled: boolean; onCollected: (receipt: CollectionReceipt) => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), storageKey = `pharmacy-online:${scope}:${invoice.locationId}:${invoice.id}`;
  const [intent, setIntent] = useState<Intent | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [ready, setReady] = useState(false), [pendingKey, setPendingKey] = useState<string | null>(null);
  const alive = useRef(true), lock = useRef(false), popup = useRef<CheckoutInstance | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  const validate = (row: Intent) => { if (!row || row.locationId !== invoice.locationId || row.invoiceId !== invoice.id || !row.id || !/^rzp_(test|live)_/.test(row.keyId) || row.currency !== "INR" || !Number.isSafeInteger(row.amountPaise) || row.amountPaise <= 0 || !["creating", "ready", "unknown", "captured", "posted", "review"].includes(row.state)) throw Error("Online checkout could not be confirmed"); return row; };
  useEffect(() => { alive.current = true; const controller = new AbortController();
    try { const saved = sessionStorage.getItem(storageKey); if (saved && !/^[a-zA-Z0-9_-]{8,100}$/.test(saved)) throw Error("Online checkout reference needs review"); setPendingKey(saved); } catch (failure) { setError((failure as Error).message); }
    void api.get("/pharmacy/payment-intents", { params: { locationId: invoice.locationId, invoiceId: invoice.id }, signal: controller.signal }).then(response => { const data = response.data?.data; if (!data || data.locationId !== invoice.locationId || data.intent !== null && !data.intent) throw Error("Online checkout history could not be confirmed"); if (current()) { setIntent(data.intent ? validate(data.intent) : null); setReady(true); } }).catch(failure => { if (!controller.signal.aborted && current()) setError(failure?.response?.data?.message || failure.message); });
    return () => { alive.current = false; controller.abort(); popup.current?.close(); };
  }, [invoice.id, invoice.locationId, scope, storageKey]);
  function showError(failure: unknown) { if (current()) setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure as Error).message || "Payment needs reconciliation; do not collect again"); }
  async function confirm(row = intent) {
    if (!row || lock.current || disabled) return; lock.current = true; setBusy(true); setError("");
    try {
      const result = (await api.post(`/pharmacy/payment-intents/${row.id}/confirm`, { locationId: invoice.locationId })).data?.data;
      validate(result);
      if (current()) setIntent(result);
      if (result.state === "posted" && result.receipt) {
        const raw = result.receipt, receipt = validateCollectionReceipt({ ...raw, receiptId: raw.receiptId || raw._id });
        if (receipt.invoiceId !== invoice.id || receipt.locationId !== invoice.locationId || receipt.evidenceMode !== "provider_verified" || receipt.collectedPaise !== row.amountPaise) throw Error("Verified receipt does not match this online checkout");
        if (current()) { sessionStorage.removeItem(storageKey); onCollected(receipt); }
      } else if (current()) setError("No allocatable captured payment was confirmed. Check this original checkout before taking another payment.");
    } catch (failure) { showError(failure); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function checkout() {
    if (disabled || lock.current || !ready) return; lock.current = true; setBusy(true); setError("");
    try {
      let row = intent;
      if (!row) {
        const key = pendingKey || crypto.randomUUID(), amount = parseReceiptPaise(String(invoice.balanceDue));
        if (amount === null || amount <= 0) throw Error("Reload the current invoice balance");
        sessionStorage.setItem(storageKey, key); setPendingKey(key);
        row = validate((await api.post("/pharmacy/payment-intents", { locationId: invoice.locationId, invoiceId: invoice.id, expectedPaymentRevision: invoice.paymentRevision, expectedBalancePaise: amount }, { headers: { "Idempotency-Key": key } })).data?.data);
        if (current()) setIntent(row);
      }
      if (row.state !== "ready" || !row.orderId || row.amountPaise !== parseReceiptPaise(String(invoice.balanceDue))) throw Error(row.reviewReason || "Check the original payment status before opening checkout");
      if (!await loadRazorpayScript() || !current()) throw Error("Online checkout could not load; the original order remains available");
      const Razorpay = (window as Window & { Razorpay?: CheckoutConstructor }).Razorpay;
      if (!Razorpay) throw Error("Payment checkout is unavailable");
      const selected = row;
      popup.current = new Razorpay({ key: row.keyId, order_id: row.orderId, amount: row.amountPaise, currency: "INR", name: "Pharmacy payment", description: invoice.invoiceNumber, config: { display: { blocks: { pharmacy: { name: "UPI or card", instruments: [{ method: "upi" }, { method: "card" }] } }, sequence: ["block.pharmacy"], preferences: { show_default_blocks: false } } }, handler: () => { void confirm(selected); }, modal: { ondismiss: () => { if (current()) setError("Checkout closed. Check the original payment status before collecting another payment."); } } });
      popup.current.open();
    } catch (failure) { showError(failure); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  return <section className="space-y-3" aria-label="Pharmacy online payment"><p>The server checks the pharmacy merchant's captured payment before recording a receipt. A popup success message alone does not confirm payment. Funds captured against a changed bill remain for reconciliation.</p>{error && <Alert variant="warning" title="Online payment needs attention">{error}</Alert>}{intent && <p>Checkout {intent.id} · {intent.state}{intent.reviewReason ? ` · ${intent.reviewReason}` : ""}</p>}<div className="flex flex-wrap gap-2"><Button size="sm" disabled={disabled || busy || !ready || Boolean(intent && intent.state !== "ready")} onClick={() => { void checkout(); }}>{busy ? "Checking online checkout..." : intent ? "Reopen original online checkout" : "Start pharmacy online checkout"}</Button>{intent && <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => { void confirm(); }}>Verify captured payment</Button>}</div></section>;
}
