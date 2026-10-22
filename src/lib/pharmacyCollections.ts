import api from "@/lib/api";
import type { IssuedPharmacyInvoice } from "./pharmacyInvoice";

export type CollectionMethod = "cash" | "upi" | "card";
export interface CollectionEntry { componentId: string; amountPaise: number; paymentMethod: CollectionMethod; referenceNumber?: string }
export interface CollectionInput {
  locationId: string; expectedPaymentRevision: number; expectedBalancePaise: number;
  manualConfirmed: true; cashTenderedPaise: number; entries: CollectionEntry[];
}
export interface CounterInvoice extends Omit<IssuedPharmacyInvoice, "taxDocument"> {
  taxDocument?: IssuedPharmacyInvoice["taxDocument"];
  id: string; locationId: string; paymentRevision: number; amountPaid: number; balanceDue: number;
  creditedPaise?: number; refundedPaise?: number; returnRevision?: number;
  openingBalanceId?: string;
  openingBalanceSnapshot?: { amountPaise: number; sourceDate: string; sourceReference: string; reviewReference: string; issuer: { legalName: string; address: string; drugLicenceNumbers: string[] } };
}
export interface CollectionReceipt {
  receiptId: string; invoiceId: string; invoiceNumber: string; locationId: string; currency: "INR";
  actorId: string; shiftId: string; drawerCode: string; paidAt: string; collectedPaise: number; paidPaise: number; balancePaise: number; creditedPaise: number;
  revision: number; cashTenderedPaise: number; cashChangePaise: number;
  status: "paid" | "partially_paid"; evidenceMode: "staff_confirmed_manual"; entries: CollectionEntry[];
  requestKey?: string;
}
export interface InvoiceSummary { id: string; invoiceNumber: string; status: string; totalAmount: number; currency: string; documentVersion?: number; customerSnapshot?: { anonymous: boolean; name?: string } }
export function validateCollectionReceipt(value: unknown): CollectionReceipt {
  const result = value as CollectionReceipt | null;
  if (!result || [result.receiptId, result.invoiceId, result.invoiceNumber, result.locationId, result.actorId].some(value => typeof value !== "string" || !value) || result.currency !== "INR" ||
      !/^[a-f\d]{24}$/i.test(result.shiftId || "") || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(result.drawerCode || "") ||
      !["paid", "partially_paid"].includes(result.status) || result.evidenceMode !== "staff_confirmed_manual" || typeof result.paidAt !== "string" || !Number.isFinite(new Date(result.paidAt).getTime()) ||
      [result.collectedPaise, result.paidPaise, result.balancePaise, result.creditedPaise, result.revision, result.cashTenderedPaise, result.cashChangePaise].some(value => !Number.isSafeInteger(value) || value < 0) ||
      result.collectedPaise <= 0 || result.collectedPaise > result.paidPaise || !Array.isArray(result.entries) || !result.entries.length || result.entries.length > 10 ||
      result.entries.some(entry => !entry.componentId || !["cash", "upi", "card"].includes(entry.paymentMethod) || !Number.isSafeInteger(entry.amountPaise) || entry.amountPaise <= 0 || entry.paymentMethod !== "cash" && !entry.referenceNumber) ||
      new Set(result.entries.map(entry => entry.componentId)).size !== result.entries.length ||
      result.entries.reduce((sum, entry) => sum + entry.amountPaise, 0) !== result.collectedPaise ||
      result.cashTenderedPaise - result.entries.filter(entry => entry.paymentMethod === "cash").reduce((sum, entry) => sum + entry.amountPaise, 0) !== result.cashChangePaise ||
      (result.status === "paid") !== (result.balancePaise === 0)) throw new Error("Collection receipt could not be confirmed. Keep the same reference.");
  return result;
}
export async function readCounterInvoice(id: string, locationId: string, signal?: AbortSignal) {
  const response = await api.get(`/pharmacy/invoices/${encodeURIComponent(id)}?locationId=${encodeURIComponent(locationId)}`, { signal }), invoice = response.data?.data as CounterInvoice;
  if (!invoice || invoice.id !== id || invoice.kind !== "pharmacy" || invoice.locationId !== locationId ||
      !Number.isSafeInteger(invoice.paymentRevision) || invoice.paymentRevision < 0 ||
      [invoice.balanceDue, invoice.amountPaid, invoice.totalAmount].some(value => !Number.isFinite(value) || value < 0)) throw new Error("Counter invoice could not be loaded completely");
  return invoice;
}
export async function collectionInvoicePage(locationId: string, cursor?: string, signal?: AbortSignal): Promise<{ items: InvoiceSummary[]; nextCursor: string | null }> {
  const response = await api.get(`/pharmacy/invoices?locationId=${encodeURIComponent(locationId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }), page = response.data?.data;
  if (!page || !Array.isArray(page.items) || page.items.length > 25 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Counter invoice page could not be loaded completely");
  return page;
}
export async function collectionReceiptPage(invoiceId: string, locationId: string, cursor?: string, signal?: AbortSignal): Promise<{ items: CollectionReceipt[]; nextCursor: string | null }> {
  const response = await api.get(`/pharmacy/invoices/${encodeURIComponent(invoiceId)}/collections?locationId=${encodeURIComponent(locationId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }), page = response.data?.data;
  if (!page || !Array.isArray(page.items) || page.items.length > 20 || page.nextCursor !== null && typeof page.nextCursor !== "string") throw new Error("Collection history could not be loaded completely");
  const items = page.items.map(validateCollectionReceipt);
  if (items.some((receipt: CollectionReceipt) => receipt.invoiceId !== invoiceId || receipt.locationId !== locationId)) throw new Error("Collection history scope differs from the selected bill");
  return { ...page, items };
}
export async function submitPharmacyCollection(invoiceId: string, input: CollectionInput, key: string, full = false) {
  const response = await api.post(`/pharmacy/invoices/${encodeURIComponent(invoiceId)}/${full ? "pay" : "collections"}`, input, { headers: { "Idempotency-Key": key } });
  const receipt = validateCollectionReceipt(response.data?.data);
  if (receipt.invoiceId !== invoiceId || receipt.locationId !== input.locationId || receipt.requestKey !== key) throw new Error("Collection result scope needs review. Keep the same reference.");
  return receipt;
}
export async function recoverPharmacyCollection(locationId: string, key: string) {
  const response = await api.get(`/pharmacy/collection-operations/${encodeURIComponent(key)}?locationId=${encodeURIComponent(locationId)}`), receipt = validateCollectionReceipt(response.data?.data);
  if (receipt.locationId !== locationId || receipt.requestKey !== key) throw new Error("Collection result scope needs review. Keep the same reference.");
  return receipt;
}
