"use client";

import { useEffect, useState } from "react";
import { Download, RotateCw } from "lucide-react";
import { Alert, Badge, Button, Spinner, Tabs } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { supplierStatement, type SupplierStatement } from "@/lib/pharmacyFinance";
import { listOrders, orderError, type OrderSummary } from "@/lib/pharmacyPurchaseOrders";
import { downloadSupplierDocument, startSupplierDownload, supplierArchive } from "@/lib/pharmacySupplierCollaboration";
import { purchasePage, type PharmacyParty, type PurchaseDraft } from "@/services/pharmacyPurchase.service";
import { money } from "./pharmacyWorkspace";

type Archive = Awaited<ReturnType<typeof supplierArchive>>;

export function PharmacySupplierWorkspace(props: {
  supplier: PharmacyParty;
  locationId: string;
  onClose: () => void;
  onOrder: (id: string) => void;
  onInvoice: (id: string) => void;
}) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <Workspace key={`${scope}:${props.locationId}:${props.supplier.id}`} {...props} scope={scope} />;
}

function Workspace({
  supplier,
  locationId,
  onClose,
  onOrder,
  onInvoice,
  scope,
}: {
  supplier: PharmacyParty;
  locationId: string;
  onClose: () => void;
  onOrder: (id: string) => void;
  onInvoice: (id: string) => void;
  scope: string;
}) {
  const [tab, setTab] = useState("orders");
  const [cursor, setCursor] = useState<string>();
  const [next, setNext] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [invoices, setInvoices] = useState<PurchaseDraft[]>([]);
  const [archive, setArchive] = useState<Archive["items"]>([]);
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const read = useLatestRead();
  const key = `${tab}:${cursor || ""}:${attempt}`;
  const loading = loaded !== key;
  const [returnPage, setReturnPage] = useState(0);

  useEffect(() => {
    const request = read();
    const current = () => request.isCurrent() && authScopeKey(useAuthStore.getState().user) === scope;
    void (async () => {
      try {
        if (tab === "orders") {
          const result = await listOrders(locationId, "", cursor, supplier.id, request.signal);
          if (current()) {
            setOrders(result.items);
            setNext(result.nextCursor);
          }
        } else if (tab === "invoices") {
          const result = await purchasePage<PurchaseDraft>("purchases", locationId, { supplierId: supplier.id, cursor }, request.signal);
          if (current()) {
            setInvoices(result.items);
            setNext(result.nextCursor);
          }
        } else if (tab === "statement") {
          const result = await supplierStatement(supplier.id, locationId, request.signal);
          if (current()) {
            setStatement(result);
            setNext(null);
          }
        } else {
          const result = await supplierArchive(
            supplier.id,
            locationId,
            tab === "documents" ? "documents" : "events",
            cursor,
            request.signal
          );
          if (current()) {
            setArchive(result.items);
            setNext(result.nextCursor);
          }
        }
        if (current()) {
          setError("");
          setLoaded(key);
        }
      } catch (failure) {
        if (current()) {
          setError(orderError(failure));
          setLoaded(key);
        }
      }
    })();
    return () => {
      read();
    };
  }, [read, scope, locationId, supplier.id, tab, cursor, attempt, key]);

  async function download(orderId: string, documentId: string) {
    try {
      const result = await downloadSupplierDocument(orderId, locationId, documentId);
      if (authScopeKey(useAuthStore.getState().user) === scope) startSupplierDownload(result);
    } catch (failure) {
      setError(orderError(failure));
    }
  }

  return (
    <Modal
      open
      title={`Supplier workspace ${supplier.name}`}
      description={[supplier.address, supplier.phone, supplier.email].filter(Boolean).join(" · ")}
      onClose={onClose}
      size="xl"
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
          <Tabs
            variant="pills"
            scrollActiveIntoView={false}
            activeTab={tab}
            onChange={value => {
              setTab(value);
              setCursor(undefined);
              setPage(0);
              setReturnPage(0);
            }}
            tabs={[
              { id: "orders", label: "Orders / dispatch" },
              { id: "invoices", label: "Invoices" },
              { id: "statement", label: "Statement / returns" },
              { id: "events", label: "Payments / credits" },
              { id: "documents", label: "Documents" },
            ]}
          />
          <Button
            size="xs"
            variant="outline"
            icon={<RotateCw size={13} className={loading ? "animate-spin" : ""} aria-hidden="true" />}
            onClick={() => setAttempt(value => value + 1)}
          >
            Refresh supplier workspace
          </Button>
        </div>

        {loading ? (
          <div role="status" className="flex items-center gap-2 py-4 text-text-secondary">
            <Spinner size="sm" />
            Loading supplier records…
          </div>
        ) : error ? (
          <Alert variant="error" title="Supplier records unavailable">
            {error}
          </Alert>
        ) : (
          <div className="space-y-3">
            {tab === "orders" && (
              <>
                {!orders.length && <p className="py-6 text-center text-text-secondary">No orders for this supplier.</p>}
                {orders.map(row => (
                  <article
                    className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                    key={row.id}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-xs font-semibold text-text">{row.reference}</strong>
                        <Badge variant="neutral" size="sm">
                          Fulfilment: {row.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-text-secondary">
                        Supplier stage {row.state.replaceAll("_", " ")} · {row.invoiceCount} linked invoices
                      </p>
                    </div>
                    <Button size="xs" onClick={() => onOrder(row.id)}>
                      Review order / dispatch {row.reference}
                    </Button>
                  </article>
                ))}
              </>
            )}

            {tab === "invoices" && (
              <>
                {!invoices.length && <p className="py-6 text-center text-text-secondary">No supplier invoices.</p>}
                {invoices.map(row => (
                  <article
                    className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
                    key={row.id}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-xs font-semibold text-text">{row.supplierInvoiceNumber}</strong>
                        <Badge variant={row.status === "posted" ? "success" : "warning"} size="sm">
                          {row.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-text-secondary">
                        Supplier stated <span className="tabular-nums text-text">{money(row.statedTotalPaise / 100)}</span>
                      </p>
                    </div>
                    <Button size="xs" onClick={() => onInvoice(row.id)}>
                      Review invoice {row.supplierInvoiceNumber}
                    </Button>
                  </article>
                ))}
              </>
            )}

            {tab === "statement" && statement && (
              <div className="space-y-4">
                <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface-alt/50 p-3">
                  <p className="text-text-secondary">
                    Original obligations <span className="tabular-nums text-text">{money(statement.totals.payablePaise / 100)}</span> · Confirmed credits{" "}
                    <span className="tabular-nums text-text">{money(statement.totals.confirmedCreditPaise / 100)}</span> · Paid{" "}
                    <span className="tabular-nums text-text">{money(statement.totals.paidPaise / 100)}</span>
                  </p>
                  <p className="text-text-secondary">
                    <strong className="tabular-nums text-text">Due {money(statement.totals.duePaise / 100)}</strong> · Pending credits{" "}
                    <span className="tabular-nums text-text">{money(statement.totals.pendingCreditPaise / 100)}</span> · Refund receivable{" "}
                    <span className="tabular-nums text-text">{money(statement.totals.supplierRefundReceivablePaise / 100)}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-text">Invoice and opening balances</h3>
                  {[...statement.purchases, ...statement.openingBalances].slice(page * 25, (page + 1) * 25).map(row => (
                    <article
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3"
                      key={row.purchaseId || row.openingBalanceId}
                    >
                      <div>
                        <strong className="block text-xs font-semibold text-text">
                          {row.supplierInvoiceNumber || row.statementNumber}
                        </strong>
                        <span className="text-[11px] tabular-nums text-text-secondary">
                          Due {money(row.duePaise / 100)} · Paid {money(row.paidPaise / 100)}
                        </span>
                      </div>
                      {row.purchaseId && (
                        <Button size="xs" variant="outline" onClick={() => onInvoice(row.purchaseId!)}>
                          Review source {row.supplierInvoiceNumber}
                        </Button>
                      )}
                    </article>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {page > 0 && (
                      <Button size="xs" variant="outline" onClick={() => setPage(value => value - 1)}>
                        Previous balance page
                      </Button>
                    )}
                    {(page + 1) * 25 < statement.purchases.length + statement.openingBalances.length && (
                      <Button size="xs" variant="outline" onClick={() => setPage(value => value + 1)}>
                        Next balance page
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/70 pt-3">
                  <h3 className="text-xs font-semibold text-text">Returns and expected credits</h3>
                  <p className="text-[11px] text-text-secondary">
                    Expected credit changes no balance until an actual supplier credit note is recorded.
                  </p>
                  {statement.returns.slice(returnPage * 25, (returnPage + 1) * 25).map(row => (
                    <article
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3"
                      key={row.id}
                    >
                      <span className="tabular-nums text-text-secondary">
                        Expected {money(row.expectedCreditPaise / 100)} · Confirmed {money(row.confirmedCreditPaise / 100)}
                      </span>
                      <Button size="xs" variant="outline" onClick={() => onInvoice(row.purchaseId)}>
                        Review returned purchase
                      </Button>
                    </article>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {returnPage > 0 && (
                      <Button size="xs" variant="outline" onClick={() => setReturnPage(value => value - 1)}>
                        Previous supplier return page
                      </Button>
                    )}
                    {(returnPage + 1) * 25 < statement.returns.length && (
                      <Button size="xs" variant="outline" onClick={() => setReturnPage(value => value + 1)}>
                        Next supplier return page
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "events" && (
              <>
                {!archive.length && <p className="py-6 text-center text-text-secondary">No supplier payment or credit records.</p>}
                {archive.map(row => (
                  <article
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3"
                    key={row.id}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <strong className="block text-xs font-semibold text-text">{row.referenceNumber}</strong>
                      <small className="block text-[11px] text-text-secondary">
                        {row.kind?.replaceAll("_", " ")} · {row.paymentMethod} ·{" "}
                        {row.recordedAt ? new Date(row.recordedAt).toLocaleString("en-IN") : ""}
                      </small>
                    </div>
                    <strong className="text-xs font-semibold tabular-nums text-text">
                      {money((row.amountPaise || 0) / 100)}
                    </strong>
                  </article>
                ))}
              </>
            )}

            {tab === "documents" && (
              <>
                {!archive.length && <p className="py-6 text-center text-text-secondary">No retained supplier order documents.</p>}
                {archive.map(row => (
                  <section className="space-y-2 rounded-xl border border-border/70 bg-surface-alt/30 p-3" key={row.orderId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-text">{row.reference}</h3>
                      <Button size="xs" variant="outline" onClick={() => onOrder(row.orderId!)}>
                        Open source order {row.reference}
                      </Button>
                    </div>
                    {row.documents?.map(doc => (
                      <article
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-2.5"
                        key={doc.id}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <strong className="block text-xs font-medium text-text">{doc.name}</strong>
                          <small className="block text-[11px] text-text-secondary">
                            {doc.kind.replaceAll("_", " ")} ·{" "}
                            {doc.source === "supplier_link"
                              ? "Supplier upload; verify before posting"
                              : doc.supplierVisible
                                ? "Shared with supplier"
                                : "Internal"}
                          </small>
                        </div>
                        <Button
                          size="xs"
                          variant="outline"
                          icon={<Download size={13} aria-hidden="true" />}
                          onClick={() => {
                            void download(row.orderId!, doc.id);
                          }}
                        >
                          Download {doc.name}
                        </Button>
                      </article>
                    ))}
                  </section>
                ))}
              </>
            )}

            {tab !== "statement" && (cursor || next) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                {cursor ? (
                  <Button size="xs" variant="outline" onClick={() => setCursor(undefined)}>
                    First supplier page
                  </Button>
                ) : (
                  <span />
                )}
                {next && (
                  <Button size="xs" variant="outline" onClick={() => setCursor(next)}>
                    Next supplier page
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
