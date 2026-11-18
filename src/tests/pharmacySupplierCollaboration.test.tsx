import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PharmacySupplierCollaboration } from "@/components/pharmacy/PharmacySupplierCollaboration";
import { PharmacySupplierWorkspace } from "@/components/pharmacy/PharmacySupplierWorkspace";
import SupplierOrderPage from "@/app/supplier-order/SupplierOrderPage";
import { ToastProvider } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { clearPharmacyDrafts } from "@/lib/pharmacyDrafts";
import { fileDocument, publicSupplierRequest, sendCollaboration, startSupplierDownload, supplierResponseLink, type PublicSupplierOrder, type SupplierCollaboration } from "@/lib/pharmacySupplierCollaboration";
import { orderFixture, orderId, orderLocationId, orderSupplier } from "./fixtures/pharmacyPurchaseOrder";
import api from "@/lib/api";
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() }, getApiUrl: () => "https://api.example.test/api" }));
const token = "a".repeat(64), expiry = "2026-12-20T12:00:00Z";
let collaboration: SupplierCollaboration;
let publicOrder: PublicSupplierOrder;
const result = (data: unknown) => ({ data: { data } });
const publicResult = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "Content-Type": "application/json" } });
const mount = (canManage = true) => render(<ToastProvider><PharmacySupplierCollaboration order={orderFixture({ state: "submitted", status: "submitted", revision: 1 })} canManage={canManage} onClose={vi.fn()} /></ToastProvider>);
const consent = () => fireEvent.click(screen.getByRole("checkbox", { name: /I verified the intended supplier/ }));
beforeEach(async () => {
  vi.clearAllMocks(); sessionStorage.clear(); await clearPharmacyDrafts(); vi.stubGlobal("indexedDB", undefined); Element.prototype.scrollIntoView = vi.fn();
  useAuthStore.setState({ user: { id: "buyer", name: "Buyer", email: "buyer@example.test", role: "purchaser", organization_id: "org", permissions: ["PHARMACY_PURCHASE"] } });
  collaboration = { orderId, revision: 1, access: null, documents: [], email: null, emailAvailable: true, storageAvailable: true, publicLinkOrigin: null, supplierEmail: "supplier@example.test" };
  const order = orderFixture(); publicOrder = { reference: order.reference, revision: 2, state: "submitted", status: "submitted", canRespond: true, canDispatch: true, canUpload: true, uploadsAvailable: true, quantities: [{ lineId: order.lines[0].lineId, invoiced: 0, received: 0 }], buyer: order.buyerSnapshot, supplierName: orderSupplier.name, notes: "", expiresAt: expiry,
    lines: [{ lineId: order.lines[0].lineId, name: "Synthetic medicine", quantity: 21, unit: "tablet", packUnit: "strip", unitsPerPack: 10 }], documents: [] };
  vi.mocked(api.get).mockImplementation(async () => result(collaboration));
  vi.mocked(api.post).mockImplementation(async (_url, body) => { const input = body as Record<string, unknown>; if (input.action === "issue") { collaboration = { ...collaboration, revision: 2, access: { active: true, expiresAt: expiry } }; return result({ token, expiresAt: expiry, revision: 2 }); } return result(collaboration); });
  vi.stubGlobal("fetch", vi.fn(async () => publicResult(publicOrder))); window.history.replaceState({}, "", `/supplier-order#${token}`); window.open = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });

it("creates a private expiring order link only after staff confirmation and offers deliberate sharing", async () => {
  mount(); await screen.findByText("No active supplier response link.");
  const button = screen.getByRole("button", { name: "Create / replace supplier link" }); expect(button).toBeDisabled(); consent(); fireEvent.click(button);
  await screen.findByLabelText("Private supplier response link"); expect(screen.getByLabelText("Private supplier response link")).toHaveValue(`${window.location.origin}/supplier-order#${token}`);
  expect(api.post).toHaveBeenCalledWith(`/pharmacy/purchase-orders/${orderId}/supplier-link`, { locationId: orderLocationId, expectedRevision: 1, action: "issue", expiresInHours: 72, confirmed: true }, expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }));
  expect(screen.getByRole("link", { name: "Share using WhatsApp" })).toHaveAttribute("rel", "noopener noreferrer"); expect(fetch).not.toHaveBeenCalled();
});

it("retains the frozen original supplier command across a lost response and remount", async () => {
  vi.mocked(api.post).mockRejectedValueOnce(Error("Network response lost")); const view = mount(); await screen.findByText("No active supplier response link."); consent(); fireEvent.click(screen.getByRole("button", { name: "Create / replace supplier link" }));
  await screen.findByText("Network response lost"); const original = structuredClone(vi.mocked(api.post).mock.calls[0]); view.unmount(); mount();
  fireEvent.click(await screen.findByRole("button", { name: "Retry original supplier request" })); await screen.findByLabelText("Private supplier response link"); expect(vi.mocked(api.post).mock.calls[1]).toEqual(original);
});

it("keeps supplier attachments internal by default and requires review instead of auto posting", async () => {
  mount(); await screen.findByText("No active supplier response link."); expect(screen.getByRole("checkbox", { name: /Share this attachment/ })).not.toBeChecked();
  fireEvent.change(screen.getByLabelText("Supplier document file"), { target: { files: [new File(["%PDF-1.7 synthetic"], "invoice.pdf", { type: "application/pdf" })] } }); fireEvent.click(screen.getByRole("button", { name: "Upload supplier document for review" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce()); const body = vi.mocked(api.post).mock.calls[0][1]; expect(body).toMatchObject({ locationId: orderLocationId, kind: "invoice", supplierVisible: false, confirmed: true, name: "invoice.pdf" }); expect(body).not.toHaveProperty("stockQuantity");
  await screen.findByText("Document retained for review. No purchase or stock was posted.");
});

it("allows viewers to see documents but hides all supplier write controls", async () => {
  mount(false); await screen.findByText("No active supplier response link."); expect(screen.queryByRole("button", { name: "Create / replace supplier link" })).not.toBeInTheDocument(); expect(screen.queryByLabelText("Supplier document file")).not.toBeInTheDocument();
});

it("sends capability tokens only in a noncached credential-free POST body and rejects malformed success", async () => {
  expect(supplierResponseLink(token, "https://supplier.example.test")).toBe(`https://supplier.example.test/supplier-order#${token}`); expect(() => supplierResponseLink(token, "javascript:alert(1)")).toThrow(/could not be confirmed/);
  await publicSupplierRequest("read", token); expect(fetch).toHaveBeenCalledWith("https://api.example.test/api/public/pharmacy-supplier-order/read", expect.objectContaining({ method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", body: JSON.stringify({ token }) }));
  expect(vi.mocked(fetch).mock.calls[0][0]).not.toContain(token);
  vi.mocked(api.post).mockResolvedValueOnce(result({})); await expect(sendCollaboration(orderId, { key: "original-key-123", kind: "supplier-link", input: { locationId: orderLocationId, action: "issue" } })).rejects.toThrow(/could not be confirmed/);
  await expect(fileDocument(new File(["script"], "file.html", { type: "text/html" }))).rejects.toThrow(/Choose a PDF/);
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { expect(this.href).toBe("https://private.example.test/file"); expect(this.download).toBe("invoice.pdf"); expect(this.referrerPolicy).toBe("no-referrer"); });
  startSupplierDownload({ url: "https://private.example.test/file", name: "invoice.pdf" }); expect(click).toHaveBeenCalledOnce(); expect(document.querySelector("a[download]")).toBeNull(); expect(() => startSupplierDownload({ url: "javascript:alert(1)", name: "bad" })).toThrow(/unavailable/);
});

it("lets a supplier confirm actual quantities without giving financial or stock actions", async () => {
  render(<ToastProvider><SupplierOrderPage /></ToastProvider>); await screen.findByText("PO-SYNTHETIC-1");
  expect(screen.queryByText(/Supplier balance/)).not.toBeInTheDocument(); const button = screen.getByRole("button", { name: "Confirm supplier details" }); expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I am the intended supplier/ })); fireEvent.change(screen.getByLabelText("Supplier confirmation reference"), { target: { value: "Supplier confirmation 123" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill ordered quantities when all are available" })); expect(screen.getByLabelText("Accepted Synthetic medicine (tablet)")).toHaveValue(21);
  const quantity = screen.getByLabelText("Accepted Synthetic medicine (tablet)"); fireEvent.change(quantity, { target: { value: "7" } }); fireEvent.click(button);
  await screen.findByText("Supplier details recorded. Pharmacy staff will review the order and actual goods.");
  const [, options] = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/respond"))!; expect(JSON.parse(String(options?.body))).toMatchObject({ token, input: { action: "respond", expectedRevision: 2, confirmed: true, reference: "Supplier confirmation 123", lines: [{ acceptedQuantity: 7 }] } });
});

it("retries an uncertain supplier response with its exact original request and key", async () => {
  vi.mocked(fetch).mockImplementation(async url => { if (String(url).endsWith("/respond")) throw Error("Uncertain response"); return publicResult(publicOrder); });
  render(<ToastProvider><SupplierOrderPage /></ToastProvider>); await screen.findByText("PO-SYNTHETIC-1"); fireEvent.click(screen.getByRole("checkbox", { name: /I am the intended supplier/ })); fireEvent.change(screen.getByLabelText("Supplier confirmation reference"), { target: { value: "Supplier 123" } }); fireEvent.click(screen.getByRole("button", { name: "Confirm supplier details" }));
  await screen.findByText("Uncertain response"); const original = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/respond"))!;
  vi.mocked(fetch).mockImplementation(async () => publicResult(publicOrder)); fireEvent.click(screen.getByRole("button", { name: "Retry original supplier submission" })); await screen.findByText(/Supplier details recorded/);
  const attempts = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/respond")); expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(original);
});

it("hides supplier changes when server permissions say the order is closed", async () => {
  publicOrder = { ...publicOrder, state: "closed", status: "closed", canRespond: false, canDispatch: false, canUpload: false };
  render(<ToastProvider><SupplierOrderPage /></ToastProvider>); await screen.findByText("This order is closed to supplier changes."); expect(screen.queryByRole("button", { name: "Confirm supplier details" })).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "Share document with pharmacy" })).toBeDisabled();
});

it("keeps supplier responses usable while unavailable file storage disables uploads", async () => {
  publicOrder = { ...publicOrder, uploadsAvailable: false };
  render(<ToastProvider><SupplierOrderPage /></ToastProvider>); await screen.findByText("Document uploads are currently unavailable. Share your invoice through your usual pharmacy contact.");
  expect(screen.getByLabelText("Document file")).toBeDisabled(); expect(screen.getByRole("button", { name: "Share document with pharmacy" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /I am the intended supplier/ })); expect(screen.getByRole("button", { name: "Confirm supplier details" })).toBeEnabled();
});

it("shows existing invoices, statement totals and actual credits together in the supplier workspace", async () => {
  const order = orderFixture({ state: "dispatched", status: "partially_received", invoiceCount: 1 }), onOrder = vi.fn(), onInvoice = vi.fn();
  vi.mocked(api.get).mockImplementation(async path => { const url = String(path); if (url.includes("purchase-orders?")) return result({ items: [order], nextCursor: null }); if (url.includes("/purchases?")) return result({ items: [{ id: "invoice-1", supplierInvoiceNumber: "ACTUAL-1", statedTotalPaise: 1000, status: "posted" }], nextCursor: null }); if (url.includes("/statement?")) return result({ supplierId: orderSupplier.id, locationId: orderLocationId, supplierName: orderSupplier.name, currency: "INR", purchases: [], openingBalances: [], returns: [], totals: { payablePaise: 1000, confirmedCreditPaise: 100, paidPaise: 200, duePaise: 700, pendingCreditPaise: 0, supplierRefundReceivablePaise: 0 } }); return result({ items: [{ id: "credit-1", referenceNumber: "CREDIT-1", kind: "supplier_credit", amountPaise: 100, paymentMethod: "none", recordedAt: expiry }], nextCursor: null }); });
  render(<ToastProvider><PharmacySupplierWorkspace supplier={orderSupplier} locationId={orderLocationId} onClose={vi.fn()} onOrder={onOrder} onInvoice={onInvoice} /></ToastProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Review order / dispatch PO-SYNTHETIC-1" })); expect(onOrder).toHaveBeenCalledWith(orderId);
  expect(screen.getByText("Fulfilment: partially received")).toBeVisible(); expect(screen.getByText(/Supplier stage dispatched/)).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Invoices" })); fireEvent.click(await screen.findByRole("button", { name: "Review invoice ACTUAL-1" })); expect(onInvoice).toHaveBeenCalledWith("invoice-1");
  fireEvent.click(screen.getByRole("tab", { name: "Statement / returns" })); await screen.findByText(/Due ₹7.00/);
  fireEvent.click(screen.getByRole("tab", { name: "Payments / credits" })); await screen.findByText("CREDIT-1"); expect(vi.mocked(api.get).mock.calls.some(([path]) => String(path).includes("section=events"))).toBe(true);
});

it("hides a previously opened order when the capability is revoked", async () => {
  render(<ToastProvider><SupplierOrderPage /></ToastProvider>); await screen.findByText("PO-SYNTHETIC-1");
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: "Supplier link expired or revoked" }), { status: 404 }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh supplier order" })); await screen.findByText("Supplier link expired or revoked"); expect(screen.queryByText("PO-SYNTHETIC-1")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Confirm supplier details" })).not.toBeInTheDocument();
});

it("pages supplier returns independently even when there are no invoice balances", async () => {
  vi.mocked(api.get).mockImplementation(async path => String(path).includes("/statement?") ? result({ supplierId: orderSupplier.id, locationId: orderLocationId, supplierName: orderSupplier.name, currency: "INR", purchases: [], openingBalances: [], returns: Array.from({ length: 26 }, (_, i) => ({ id: `return-${i}`, purchaseId: `purchase-${i}`, expectedCreditPaise: 100, confirmedCreditPaise: 0 })), totals: { payablePaise: 0, confirmedCreditPaise: 0, paidPaise: 0, duePaise: 0, pendingCreditPaise: 2600, supplierRefundReceivablePaise: 0 } }) : result({ items: [], nextCursor: null }));
  const onInvoice = vi.fn(); render(<ToastProvider><PharmacySupplierWorkspace supplier={orderSupplier} locationId={orderLocationId} onClose={vi.fn()} onOrder={vi.fn()} onInvoice={onInvoice} /></ToastProvider>);
  fireEvent.click(screen.getByRole("tab", { name: "Statement / returns" })); fireEvent.click(await screen.findByRole("button", { name: "Next supplier return page" }));
  const rows = screen.getAllByRole("button", { name: "Review returned purchase" }); expect(rows).toHaveLength(1); fireEvent.click(rows[0]); expect(onInvoice).toHaveBeenCalledWith("purchase-25");
});
