"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Tabs } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { supplierStatement, type SupplierStatement } from "@/lib/pharmacyFinance";
import { listOrders, orderError, type OrderSummary } from "@/lib/pharmacyPurchaseOrders";
import { downloadSupplierDocument, startSupplierDownload, supplierArchive } from "@/lib/pharmacySupplierCollaboration";
import { purchasePage, type PharmacyParty, type PurchaseDraft } from "@/services/pharmacyPurchase.service";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
type Archive = Awaited<ReturnType<typeof supplierArchive>>;
export function PharmacySupplierWorkspace(props: { supplier: PharmacyParty; locationId: string; onClose: () => void; onOrder: (id: string) => void; onInvoice: (id: string) => void }) {
  const scope = authScopeKey(useAuthStore(state => state.user)); return <Workspace key={`${scope}:${props.locationId}:${props.supplier.id}`} {...props} scope={scope} />;
}
function Workspace({ supplier, locationId, onClose, onOrder, onInvoice, scope }: { supplier: PharmacyParty; locationId: string; onClose: () => void; onOrder: (id: string) => void; onInvoice: (id: string) => void; scope: string }) {
  const [tab, setTab] = useState("orders"), [cursor, setCursor] = useState<string>(), [next, setNext] = useState<string | null>(null), [orders, setOrders] = useState<OrderSummary[]>([]), [invoices, setInvoices] = useState<PurchaseDraft[]>([]), [archive, setArchive] = useState<Archive["items"]>([]), [statement, setStatement] = useState<SupplierStatement | null>(null), [error, setError] = useState(""), [loaded, setLoaded] = useState(""), [attempt, setAttempt] = useState(0), [page, setPage] = useState(0);
  const read = useLatestRead(), key = `${tab}:${cursor || ""}:${attempt}`, loading = loaded !== key;
  const [returnPage, setReturnPage] = useState(0);
  useEffect(() => { const request = read(); const current = () => request.isCurrent() && authScopeKey(useAuthStore.getState().user) === scope;
    void (async () => { try {
      if (tab === "orders") { const result = await listOrders(locationId, "", cursor, supplier.id, request.signal); if (current()) { setOrders(result.items); setNext(result.nextCursor); } }
      else if (tab === "invoices") { const result = await purchasePage<PurchaseDraft>("purchases", locationId, { supplierId: supplier.id, cursor }, request.signal); if (current()) { setInvoices(result.items); setNext(result.nextCursor); } }
      else if (tab === "statement") { const result = await supplierStatement(supplier.id, locationId, request.signal); if (current()) { setStatement(result); setNext(null); } }
      else { const result = await supplierArchive(supplier.id, locationId, tab === "documents" ? "documents" : "events", cursor, request.signal); if (current()) { setArchive(result.items); setNext(result.nextCursor); } }
      if (current()) { setError(""); setLoaded(key); }
    } catch (failure) { if (current()) { setError(orderError(failure)); setLoaded(key); } } })(); return () => { read(); };
  }, [read, scope, locationId, supplier.id, tab, cursor, attempt, key]);
  async function download(orderId: string, documentId: string) { try { const result = await downloadSupplierDocument(orderId, locationId, documentId); if (authScopeKey(useAuthStore.getState().user) === scope) startSupplierDownload(result); } catch (failure) { setError(orderError(failure)); } }
  return <Modal open title={`Supplier workspace ${supplier.name}`} onClose={onClose} size="lg" bodyClassName={styles.dialog}>
    <p>{supplier.address}{supplier.phone ? ` · ${supplier.phone}` : ""}{supplier.email ? ` · ${supplier.email}` : ""}</p>
    <Tabs variant="pills" activeTab={tab} onChange={value => { setTab(value); setCursor(undefined); setPage(0); setReturnPage(0); }} tabs={[{ id: "orders", label: "Orders / dispatch" }, { id: "invoices", label: "Invoices" }, { id: "statement", label: "Statement / returns" }, { id: "events", label: "Payments / credits" }, { id: "documents", label: "Documents" }]} />
    <Button size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>Refresh supplier workspace</Button>
    {loading ? <p role="status">Loading supplier records…</p> : error ? <Alert variant="error" title="Supplier records unavailable">{error}</Alert> : <>
      {tab === "orders" && <>{!orders.length && <p>No orders for this supplier.</p>}{orders.map(row => <article className={styles.card} key={row.id}><div className={styles.identity}><strong>{row.reference}</strong><small>Fulfilment: {row.status.replaceAll("_", " ")}</small><small>Supplier stage {row.state.replaceAll("_", " ")} · {row.invoiceCount} linked invoices</small></div><Button size="sm" onClick={() => onOrder(row.id)}>Review order / dispatch {row.reference}</Button></article>)}</>}
      {tab === "invoices" && <>{!invoices.length && <p>No supplier invoices.</p>}{invoices.map(row => <article className={styles.card} key={row.id}><div className={styles.identity}><strong>{row.supplierInvoiceNumber}</strong><small>{row.status} · Supplier stated {money(row.statedTotalPaise / 100)}</small></div><Button size="sm" onClick={() => onInvoice(row.id)}>Review invoice {row.supplierInvoiceNumber}</Button></article>)}</>}
      {tab === "statement" && statement && <><p>Original obligations {money(statement.totals.payablePaise / 100)} · Confirmed credits {money(statement.totals.confirmedCreditPaise / 100)} · Paid {money(statement.totals.paidPaise / 100)}</p><p><strong>Due {money(statement.totals.duePaise / 100)}</strong> · Pending credits {money(statement.totals.pendingCreditPaise / 100)} · Refund receivable {money(statement.totals.supplierRefundReceivablePaise / 100)}</p>
        <h3>Invoice and opening balances</h3>{[...statement.purchases, ...statement.openingBalances].slice(page * 25, (page + 1) * 25).map(row => <article className={styles.card} key={row.purchaseId || row.openingBalanceId}><strong>{row.supplierInvoiceNumber || row.statementNumber}</strong><span>Due {money(row.duePaise / 100)} · Paid {money(row.paidPaise / 100)}</span>{row.purchaseId && <Button size="sm" variant="outline" onClick={() => onInvoice(row.purchaseId!)}>Review source {row.supplierInvoiceNumber}</Button>}</article>)}<div className={styles.actions}>{page > 0 && <Button size="sm" onClick={() => setPage(value => value - 1)}>Previous balance page</Button>}{(page + 1) * 25 < statement.purchases.length + statement.openingBalances.length && <Button size="sm" onClick={() => setPage(value => value + 1)}>Next balance page</Button>}</div>
        <h3>Returns and expected credits</h3><p>Expected credit changes no balance until an actual supplier credit note is recorded.</p>{statement.returns.slice(returnPage * 25, (returnPage + 1) * 25).map(row => <article className={styles.card} key={row.id}><span>Expected {money(row.expectedCreditPaise / 100)} · Confirmed {money(row.confirmedCreditPaise / 100)}</span><Button size="sm" variant="outline" onClick={() => onInvoice(row.purchaseId)}>Review returned purchase</Button></article>)}<div className={styles.actions}>{returnPage > 0 && <Button size="sm" onClick={() => setReturnPage(value => value - 1)}>Previous supplier return page</Button>}{(returnPage + 1) * 25 < statement.returns.length && <Button size="sm" onClick={() => setReturnPage(value => value + 1)}>Next supplier return page</Button>}</div>
      </>}
      {tab === "events" && <>{!archive.length && <p>No supplier payment or credit records.</p>}{archive.map(row => <article className={styles.card} key={row.id}><div className={styles.identity}><strong>{row.referenceNumber}</strong><small>{row.kind?.replaceAll("_", " ")} · {row.paymentMethod} · {row.recordedAt ? new Date(row.recordedAt).toLocaleString("en-IN") : ""}</small></div><strong>{money((row.amountPaise || 0) / 100)}</strong></article>)}</>}
      {tab === "documents" && <>{!archive.length && <p>No retained supplier order documents.</p>}{archive.map(row => <section className={styles.list} key={row.orderId}><h3>{row.reference}</h3>{row.documents?.map(doc => <article className={styles.card} key={doc.id}><div className={styles.identity}><strong>{doc.name}</strong><small>{doc.kind.replaceAll("_", " ")} · {doc.source === "supplier_link" ? "Supplier upload; verify before posting" : doc.supplierVisible ? "Shared with supplier" : "Internal"}</small></div><Button size="sm" variant="outline" onClick={() => { void download(row.orderId!, doc.id); }}>Download {doc.name}</Button></article>)}<Button size="sm" variant="outline" onClick={() => onOrder(row.orderId!)}>Open source order {row.reference}</Button></section>)}</>}
      {tab !== "statement" && <div className={styles.actions}>{cursor && <Button size="sm" onClick={() => setCursor(undefined)}>First supplier page</Button>}{next && <Button size="sm" onClick={() => setCursor(next)}>Next supplier page</Button>}</div>}
    </>}
  </Modal>;
}
