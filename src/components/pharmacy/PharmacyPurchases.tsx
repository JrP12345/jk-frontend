"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Info, Plus, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, DatePicker, Input, Select, Spinner, Tabs } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { PharmacyDetailLoadingSheet } from "./PharmacyDetailLoader";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import {
  purchasePage,
  readPurchase,
  saveParty,
  savePurchaseDraft,
  type PharmacyParty,
  type PurchaseDraft,
  type PurchaseLine,
  type PurchaseProduct,
} from "@/services/pharmacyPurchase.service";
import { packDescription } from "@/lib/pharmacyUnits";
import { hasAnyPermission } from "@/lib/permissions";
import { purchaseReceivingPlan } from "@/lib/pharmacyReceiving";
import type { ShortbookDraftSeed } from "@/lib/pharmacyShortbook";
import api from "@/lib/api";
import { money } from "./pharmacyWorkspace";
import { PharmacyPackQuantity } from "./PharmacyPackQuantity";
import { PharmacyPurchaseOperations } from "./PharmacyPurchaseOperations";
import { PharmacyPurchaseCsv } from "./PharmacyPurchaseCsv";
import { PharmacyShortbook } from "./PharmacyShortbook";
import { PharmacyPurchaseOrders } from "./PharmacyPurchaseOrders";
import { PharmacySupplierWorkspace } from "./PharmacySupplierWorkspace";
import { PharmacySupplierRates } from "./PharmacySupplierRates";

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (error instanceof Error ? error.message : "Reload the record before retrying.");

function useSave(onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const lock = useRef(false);
  const scope = authScopeKey(useAuthStore(state => state.user));
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function save<T>(action: () => Promise<T>, afterSaved?: (result: T) => void) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
    try {
      const result = await action();
      if (current()) {
        if (afterSaved) afterSaved(result);
        else onSaved();
      }
    } catch (failure) {
      if (current()) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }
  return { busy, error, save, setError };
}

interface PurchaseProps {
  locationId: string;
  canManage: boolean;
  canReceive?: boolean;
  canViewCost?: boolean;
  initialShortbookProduct?: PurchaseProduct;
}

export function PharmacyPurchases(props: PurchaseProps) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <PurchaseSession key={`${scope}:${props.locationId}:${props.initialShortbookProduct?.id || ""}`} {...props} />;
}

function PurchaseSession({
  locationId,
  canManage,
  canReceive = false,
  canViewCost = false,
  initialShortbookProduct,
}: PurchaseProps) {
  const [tab, setTab] = useState(initialShortbookProduct ? "shortbook" : "purchases");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [draftSeed, setDraftSeed] = useState<ShortbookDraftSeed>();
  const [orderSeed, setOrderSeed] = useState<ShortbookDraftSeed>();
  const [supplierWorkspace, setSupplierWorkspace] = useState<PharmacyParty | null>(null);
  const [initialOrderId, setInitialOrderId] = useState<string>();
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<Array<string | undefined>>([]);
  const [next, setNext] = useState<string | null>(null);
  const [items, setItems] = useState<Array<PharmacyParty | PurchaseDraft>>([]);
  const [loaded, setLoaded] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [party, setParty] = useState<PharmacyParty | "new" | null>(null);
  const [draft, setDraft] = useState<PurchaseDraft | "new" | null>(null);
  const [retry, setRetry] = useState(0);
  const [operation, setOperation] = useState<PurchaseDraft | null>(null);
  const [openingPurchase, setOpeningPurchase] = useState<{ id: string; label?: string; supplierName?: string } | null>(null);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [openingError, setOpeningError] = useState("");
  const beginRead = useLatestRead();
  const beginDetail = useLatestRead();
  const readKey = `${locationId}:${tab}:${query}:${cursor || ""}:${archived}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setCursor(undefined);
      setPrevious([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const request = beginRead();
    setBusy(true);
    setError("");
    if (tab === "shortbook" || tab === "orders" || tab === "rates") {
      setItems([]);
      setNext(null);
      setBusy(false);
      return;
    }
    try {
      const page = await purchasePage<PharmacyParty | PurchaseDraft>(
        tab as "parties" | "purchases",
        locationId,
        { cursor, search: query, archived: tab === "parties" && archived },
        request.signal
      );
      if (request.isCurrent()) {
        setItems(page.items);
        setNext(page.nextCursor);
        setLoaded(readKey);
      }
    } catch (failure) {
      if (request.isCurrent()) {
        setItems([]);
        setError(errorMessage(failure));
      }
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }, [beginRead, locationId, tab, cursor, query, archived, readKey]);

  useEffect(() => {
    void load();
  }, [load, retry]);

  const saved = () => {
    setDraftSeed(undefined);
    setParty(null);
    setDraft(null);
    setOperation(null);
    setRetry(value => value + 1);
  };

  function closeOpeningPurchase() {
    beginDetail();
    setOpeningLoading(false);
    setOpeningPurchase(null);
    setOpeningError("");
  }

  async function openDraft(id: string, preview?: PurchaseDraft) {
    const request = beginDetail();
    setDraft(null);
    setOperation(null);
    setError("");
    setOpeningError("");
    setOpeningPurchase(preview ? { id, label: preview.supplierInvoiceNumber, supplierName: preview.supplierSnapshot.name } : { id });
    setOpeningLoading(true);
    try {
      const result = await readPurchase(id, locationId);
      if (request.isCurrent()) {
        setOpeningPurchase(null);
        if (result.status === "posted") setOperation(result);
        else setDraft(result);
      }
    } catch (failure) {
      if (request.isCurrent()) setOpeningError(errorMessage(failure));
    } finally {
      if (request.isCurrent()) setOpeningLoading(false);
    }
  }

  const visible = loaded === readKey ? items : [];

  return (
    <section className="min-w-0 space-y-3" aria-label="Purchases and business parties">
      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 px-3 py-3 md:px-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text md:text-base">Purchases &amp; parties</h2>
            <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
              Drafts record supplier invoices. Saving a draft does not receive stock or create a supplier balance.
            </p>
          </div>
          {canManage && (
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
              <Button
                size="xs"
                variant="outline"
                className="flex-1 sm:flex-none"
                icon={<UserPlus size={14} aria-hidden="true" />}
                onClick={() => setParty("new")}
              >
                Add supplier / customer
              </Button>
              <Button
                size="xs"
                className="flex-1 sm:flex-none"
                icon={<Plus size={14} aria-hidden="true" />}
                onClick={() => {
                  setDraftSeed(undefined);
                  setDraft("new");
                }}
              >
                New purchase draft
              </Button>
            </div>
          )}
        </header>

        <Tabs
          variant="underline"
          scrollActiveIntoView={false}
          activeTab={tab}
          onChange={value => {
            setTab(value);
            setCursor(undefined);
            setPrevious([]);
            setSearch("");
            setQuery("");
          }}
          tabs={[
            { id: "purchases", label: "Supplier invoices" },
            { id: "orders", label: "Purchase orders" },
            { id: "parties", label: "Suppliers & customers" },
            { id: "shortbook", label: "Shortbook" },
            ...(canViewCost ? [{ id: "rates", label: "Compare supplier rates" }] : []),
          ]}
        />

        {tab === "rates" ? (
          canViewCost ? (
            <PharmacySupplierRates
              locationId={locationId}
              onInvoice={id => {
                void openDraft(id);
              }}
            />
          ) : (
            <p className="p-4 text-xs text-text-secondary">Acquisition-cost access is required.</p>
          )
        ) : tab === "orders" ? (
          <PharmacyPurchaseOrders
            locationId={locationId}
            canManage={canManage}
            seed={orderSeed}
            initialOrderId={initialOrderId}
            onSeedClosed={() => setOrderSeed(undefined)}
            onOpenInvoice={id => {
              void openDraft(id);
            }}
          />
        ) : tab === "shortbook" ? (
          <PharmacyShortbook
            locationId={locationId}
            canManage={canManage}
            initialProduct={initialShortbookProduct}
            onDraft={seed => {
              setDraftSeed(seed);
              setDraft("new");
            }}
            onOrder={seed => {
              setInitialOrderId(undefined);
              setOrderSeed(seed);
              setTab("orders");
            }}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2.5 border-b border-border/60 bg-surface-alt/40 p-3 sm:flex-row sm:items-end md:px-4">
              <div className="min-w-0 flex-1">
                <Input
                  size="sm"
                  type="search"
                  icon={<Search size={15} aria-hidden="true" />}
                  label={tab === "parties" ? "Search business parties" : "Search supplier invoices"}
                  placeholder={tab === "parties" ? "Search suppliers & customers" : "Search supplier invoices"}
                  maxLength={100}
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </div>
              {tab === "parties" && (
                <div className="w-full sm:w-44">
                  <Select
                    size="sm"
                    label="Party status"
                    value={archived ? "archived" : "active"}
                    onChange={event => {
                      setArchived(event.target.value === "archived");
                      setCursor(undefined);
                      setPrevious([]);
                    }}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "archived", label: "Archived" },
                    ]}
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 md:px-4">
                <Alert
                  variant="error"
                  title="Purchase records unavailable"
                  action={
                    <Button size="xs" variant="outline" onClick={() => setRetry(value => value + 1)}>
                      Retry purchase records
                    </Button>
                  }
                >
                  {error}
                </Alert>
              </div>
            )}

            {busy && (
              <div role="status" className="flex items-center gap-2 px-3 py-4 text-xs text-text-secondary md:px-4">
                <Spinner size="sm" />
                Loading purchase records...
              </div>
            )}

            {!busy && !error && visible.length === 0 && (
              <p className="px-3 py-10 text-center text-xs text-text-secondary md:px-4">
                {tab === "parties" ? "No business parties match this search." : "No purchase drafts match this search."}
              </p>
            )}

            {visible.length > 0 && (
              <div className="divide-y divide-border/60">
                {visible.map(row =>
                  tab === "parties" ? (
                    <article
                      key={row.id}
                      className="flex flex-col gap-2.5 px-3 py-3 transition-colors hover:bg-surface-hover/40 sm:flex-row sm:items-center sm:justify-between md:px-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <strong className="text-xs font-semibold text-text [overflow-wrap:anywhere]">
                            {(row as PharmacyParty).name}
                          </strong>
                          <Badge variant="neutral" size="sm">
                            {(row as PharmacyParty).kinds.join(" / ")}
                          </Badge>
                          <Badge variant={(row as PharmacyParty).gstin ? "info" : "outline"} size="sm">
                            {(row as PharmacyParty).gstin || "Unregistered for GST"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-text-secondary [overflow-wrap:anywhere]">
                          {(row as PharmacyParty).address}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        {(row as PharmacyParty).kinds.includes("supplier") && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setSupplierWorkspace(row as PharmacyParty)}
                          >
                            Supplier workspace {(row as PharmacyParty).name}
                          </Button>
                        )}
                        {canManage && (
                          <Button size="xs" variant="outline" onClick={() => setParty(row as PharmacyParty)}>
                            Edit {(row as PharmacyParty).name}
                          </Button>
                        )}
                      </div>
                    </article>
                  ) : (
                    <article
                      key={row.id}
                      className="flex flex-col gap-2.5 px-3 py-3 transition-colors hover:bg-surface-hover/40 sm:flex-row sm:items-center sm:justify-between md:px-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <strong className="text-xs font-semibold text-text [overflow-wrap:anywhere]">
                            {(row as PurchaseDraft).supplierInvoiceNumber}
                          </strong>
                          <Badge variant={(row as PurchaseDraft).status === "posted" ? "success" : "warning"} size="sm">
                            {(row as PurchaseDraft).status === "posted" ? "Posted" : "Draft"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-text-secondary [overflow-wrap:anywhere]">
                          {(row as PurchaseDraft).supplierSnapshot.name} · {(row as PurchaseDraft).invoiceDate}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                        <span className="text-xs font-semibold tabular-nums text-text">
                          Supplier stated total: {money((row as PurchaseDraft).statedTotalPaise / 100)}
                        </span>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            void openDraft(row.id, row as PurchaseDraft);
                          }}
                        >
                          Open {(row as PurchaseDraft).status === "posted" ? "purchase" : "draft"}{" "}
                          {(row as PurchaseDraft).supplierInvoiceNumber}
                        </Button>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}

            {(previous.length > 0 || next) && (
              <footer className="flex items-center justify-between gap-2 border-t border-border/70 bg-surface-alt/40 px-3 py-2.5 md:px-4">
                {previous.length > 0 ? (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setCursor(previous.at(-1));
                      setPrevious(value => value.slice(0, -1));
                    }}
                  >
                    Previous purchase page
                  </Button>
                ) : (
                  <span />
                )}
                {next && (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setPrevious(value => [...value, cursor]);
                      setCursor(next);
                    }}
                  >
                    Next purchase page
                  </Button>
                )}
              </footer>
            )}
          </>
        )}
      </Card>

      {supplierWorkspace && (
        <PharmacySupplierWorkspace
          supplier={supplierWorkspace}
          locationId={locationId}
          onClose={() => setSupplierWorkspace(null)}
          onOrder={id => {
            setSupplierWorkspace(null);
            setInitialOrderId(id);
            setOrderSeed(undefined);
            setTab("orders");
          }}
          onInvoice={id => {
            setSupplierWorkspace(null);
            void openDraft(id);
          }}
        />
      )}
      {party && canManage && (
        <PartyForm
          key={party === "new" ? "new-party" : party.id}
          current={party === "new" ? undefined : party}
          locationId={locationId}
          onClose={() => setParty(null)}
          onSaved={saved}
        />
      )}
      {draft && (
        <DraftForm
          seed={draft === "new" ? draftSeed : undefined}
          key={draft === "new" ? "new-draft" : draft.id}
          current={draft === "new" ? undefined : draft}
          locationId={locationId}
          canManage={canManage}
          onClose={() => {
            setDraft(null);
            setDraftSeed(undefined);
          }}
          onSaved={saved}
          onContinue={result => {
            setOperation(result);
            setDraft(null);
          }}
        />
      )}
      <PharmacyDetailLoadingSheet
        open={Boolean(!draft && !operation && (openingLoading || openingError))}
        size="xl"
        title={openingPurchase?.label ? `Loading ${openingPurchase.label}` : "Loading purchase"}
        description={openingPurchase?.supplierName}
        label="Loading purchase details..."
        error={!openingLoading ? openingError : ""}
        errorTitle="Purchase details unavailable"
        onRetry={openingPurchase?.id && !openingLoading && openingError ? () => { void openDraft(openingPurchase.id); } : undefined}
        onClose={closeOpeningPurchase}
      />

      {operation && (
        <PharmacyPurchaseOperations
          key={operation.id}
          purchase={operation}
          canManage={canManage}
          canReceive={canReceive}
          onClose={saved}
          onChanged={saved}
          onReorder={seed => {
            setOperation(null);
            setOrderSeed(seed);
            setTab("orders");
          }}
        />
      )}
    </section>
  );
}

function PartyForm({
  current,
  locationId,
  onClose,
  onSaved,
}: {
  current?: PharmacyParty;
  locationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const state = useSave(onSaved);
  const owner = hasAnyPermission(useAuthStore(state => state.user), "MANAGE_ORGANIZATION");
  const [memberDiscount, setMemberDiscount] = useState(String((current?.memberDiscountBps || 0) / 100));
  const [memberEdited, setMemberEdited] = useState(false);
  const [creditLimit, setCreditLimit] = useState(
    current?.creditPolicy?.limitPaise === undefined ? "" : String(current.creditPolicy.limitPaise / 100)
  );
  const [creditDays, setCreditDays] = useState(
    current?.creditPolicy?.termsDays === undefined ? "" : String(current.creditPolicy.termsDays)
  );
  const [blockOverdue, setBlockOverdue] = useState(current?.creditPolicy?.blockOverdue || false);
  const [creditEdited, setCreditEdited] = useState(false);
  const [form, setForm] = useState({
    name: current?.name || "",
    kind: current?.kinds.length === 2 ? "both" : current?.kinds[0] || "supplier",
    address: current?.address || "",
    phone: current?.phone || "",
    email: current?.email || "",
    gstRegistration: current?.gstRegistration || "unregistered",
    gstin: current?.gstin || "",
    licence: current?.licence?.number || "",
    validUntil: current?.licence?.validUntil || "",
    archived: current?.archived || false,
  });
  const edit = (field: keyof typeof form, value: string | boolean) =>
    setForm(previous => ({ ...previous, [field]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const supplier = form.kind !== "customer";
    if (!form.name.trim() || !form.address.trim() || (supplier && !form.licence.trim())) {
      state.setError("Enter the business name, address and actual supplier licence details where applicable.");
      return;
    }
    const limit = creditLimit.trim() ? parseReceiptPaise(creditLimit) : undefined;
    const memberBps = parseReceiptPaise(memberDiscount);
    if (memberEdited && (memberBps === null || memberBps > 10000)) {
      state.setError("Enter a member discount from 0 to 100 percent, with at most two decimal places.");
      return;
    }
    if (
      creditEdited &&
      (limit === null ||
        (creditDays && (!/^\d+$/.test(creditDays) || Number(creditDays) < 1 || Number(creditDays) > 365)) ||
        (blockOverdue && !creditDays))
    ) {
      state.setError("Enter a valid credit limit and actual terms from 1 to 365 days for an overdue rule.");
      return;
    }
    void state.save(() =>
      saveParty(
        {
          locationId,
          locationIds: current?.locationIds || [locationId],
          name: form.name,
          kinds: form.kind === "both" ? ["customer", "supplier"] : [form.kind],
          address: form.address,
          phone: form.phone,
          email: form.email,
          gstRegistration: form.gstRegistration as "registered" | "unregistered",
          ...(form.gstRegistration === "registered" ? { gstin: form.gstin } : {}),
          ...(supplier ? { licence: { number: form.licence, ...(form.validUntil ? { validUntil: form.validUntil } : {}) } } : {}),
          archived: form.archived,
          ...(owner && memberEdited && form.kind !== "supplier" && memberBps !== null ? { memberDiscountBps: memberBps } : {}),
          ...(owner && creditEdited && form.kind !== "supplier"
            ? {
                creditPolicy:
                  creditLimit || creditDays || blockOverdue
                    ? {
                        ...(limit !== undefined && limit !== null ? { limitPaise: limit } : {}),
                        ...(creditDays ? { termsDays: Number(creditDays) } : {}),
                        blockOverdue,
                      }
                    : null,
              }
            : {}),
        },
        key,
        current
      )
    );
  }

  return (
    <Modal
      open
      title={current ? "Edit business party" : "Add supplier / customer"}
      description={current ? current.name : undefined}
      onClose={onClose}
      busy={state.busy}
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={state.busy} onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="pharmacy-party-form" className="flex-1 sm:flex-none" loading={state.busy}>
            Save business party
          </Button>
        </div>
      }
    >
      <form id="pharmacy-party-form" className="space-y-4" onSubmit={submit} noValidate>
        {state.error && (
          <Alert variant="error" title="Party was not confirmed">
            {state.error}
          </Alert>
        )}
        <fieldset className="space-y-4" disabled={state.busy}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              size="sm"
              label="Business name *"
              value={form.name}
              maxLength={200}
              onChange={event => edit("name", event.target.value)}
            />
            <Select
              size="sm"
              label="Party roles"
              value={form.kind}
              onChange={event => edit("kind", event.target.value)}
              options={[
                { value: "supplier", label: "Supplier" },
                { value: "customer", label: "Customer" },
                { value: "both", label: "Supplier and customer" },
              ]}
            />
          </div>

          <Input
            size="sm"
            label="Business address *"
            value={form.address}
            maxLength={500}
            onChange={event => edit("address", event.target.value)}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input size="sm" label="Business phone" value={form.phone} onChange={event => edit("phone", event.target.value)} />
            <Input
              size="sm"
              label="Business email"
              type="email"
              value={form.email}
              onChange={event => edit("email", event.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/40 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                size="sm"
                label="GST registration"
                value={form.gstRegistration}
                onChange={event => edit("gstRegistration", event.target.value)}
                options={[
                  { value: "unregistered", label: "Unregistered" },
                  { value: "registered", label: "Registered" },
                ]}
              />
              {form.gstRegistration === "registered" && (
                <Input
                  size="sm"
                  label="GSTIN *"
                  value={form.gstin}
                  maxLength={15}
                  onChange={event => edit("gstin", event.target.value)}
                />
              )}
            </div>

            {form.kind !== "customer" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  size="sm"
                  label="Supplier licence number *"
                  value={form.licence}
                  maxLength={80}
                  onChange={event => edit("licence", event.target.value)}
                />
                <DatePicker
                  size="sm"
                  label="Supplier licence valid until (if recorded)"
                  value={form.validUntil}
                  onChange={value => edit("validUntil", value)}
                />
              </div>
            )}
          </div>

          {form.kind !== "supplier" && (
            <div className="space-y-3">
              <details className="group overflow-hidden rounded-xl border border-border/70 bg-surface-alt/30">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-text select-none hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
                  <span>Optional customer credit rules</span>
                  <ChevronDown
                    size={14}
                    className="shrink-0 text-text-secondary transition-transform duration-150 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="space-y-3 border-t border-border/60 p-3 text-xs">
                  <p className="leading-relaxed text-text-secondary">
                    Shared across this customer&apos;s visible branches. Leave empty for no limit. Existing invoices keep their recorded due
                    dates; rules apply to new credit.
                  </p>
                  <fieldset disabled={!owner} className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        size="sm"
                        label="Customer credit limit (INR, optional)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={creditLimit}
                        onChange={e => {
                          setCreditLimit(e.target.value);
                          setCreditEdited(true);
                        }}
                      />
                      <Input
                        size="sm"
                        label="Customer credit terms (days, optional)"
                        type="number"
                        min="1"
                        max="365"
                        step="1"
                        value={creditDays}
                        onChange={e => {
                          setCreditDays(e.target.value);
                          setCreditEdited(true);
                        }}
                      />
                    </div>
                    <Checkbox
                      label="Block new credit while an invoice is overdue"
                      checked={blockOverdue}
                      onChange={e => {
                        setBlockOverdue(e.target.checked);
                        setCreditEdited(true);
                      }}
                    />
                  </fieldset>
                  {!owner && <p className="text-text-secondary">Only the organization owner may change these rules.</p>}
                </div>
              </details>

              <Input
                size="sm"
                label="Member discount (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={memberDiscount}
                disabled={!owner}
                hint="Owner-set suggested invoice discount. The cashier reviews and applies it to a priced bill."
                onChange={event => {
                  setMemberDiscount(event.target.value);
                  setMemberEdited(true);
                }}
              />
            </div>
          )}

          {current && (
            <Select
              size="sm"
              label="Business party status"
              value={form.archived ? "archived" : "active"}
              onChange={event => edit("archived", event.target.value === "archived")}
              options={[
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived; retain history" },
              ]}
            />
          )}
        </fieldset>
      </form>
    </Modal>
  );
}

type Product = PurchaseProduct;
type FormLine = {
  lineId: string;
  product: Product;
  packs: string;
  looseUnits: string;
  freePacks: string;
  freeLooseUnits: string;
  baseAmount: string;
  discount: string;
  gst: string;
  hsn: string;
  sellingPrice: string;
  mrp: string;
};

const importedFormLine = (line: PurchaseLine, product: Product): FormLine => ({
  lineId: line.lineId,
  product,
  packs: String(line.packs),
  looseUnits: String(line.looseUnits),
  freePacks: String(line.freePacks),
  freeLooseUnits: String(line.freeLooseUnits),
  baseAmount: String(line.baseAmountPaise / 100),
  discount: String(line.discountPaise / 100),
  gst: String(line.gstRateBps / 100),
  hsn: line.hsnCode,
  sellingPrice: String(line.sellingPricePaise / 100),
  mrp: line.mrpPaise === undefined ? "" : String(line.mrpPaise / 100),
});

const numberFields = ["packs", "looseUnits", "freePacks", "freeLooseUnits"] as const;

function DraftForm({
  current,
  locationId,
  canManage,
  onClose,
  onSaved,
  onContinue,
  seed,
}: {
  current?: PurchaseDraft;
  locationId: string;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
  onContinue: (result: PurchaseDraft) => void;
  seed?: ShortbookDraftSeed;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const state = useSave(onSaved);
  const beginSearch = useLatestRead();
  const beginParty = useLatestRead();
  const [supplierId, setSupplierId] = useState(current?.supplierId || "");
  const [parties, setParties] = useState<PharmacyParty[]>([]);
  const [selectedParty, setSelectedParty] = useState<PharmacyParty | null>(null);
  const [partySearch, setPartySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [header, setHeader] = useState({
    number: current?.supplierInvoiceNumber || "",
    date: current?.invoiceDate || "",
    total: current ? String(current.statedTotalPaise / 100) : "",
    notes: current?.notes || seed?.notes || "",
  });
  const [lines, setLines] = useState<FormLine[]>(
    () =>
      current?.lines.map(line => ({
        lineId: line.lineId,
        product: {
          id: line.medicineId,
          name: line.medicineSnapshot.name,
          price: line.sellingPricePaise / 100,
          unitDefinition: line.unitSnapshot,
        },
        packs: String(line.packs),
        looseUnits: String(line.looseUnits),
        freePacks: String(line.freePacks),
        freeLooseUnits: String(line.freeLooseUnits),
        baseAmount: String(line.baseAmountPaise / 100),
        discount: String(line.discountPaise / 100),
        gst: String(line.gstRateBps / 100),
        hsn: line.hsnCode,
        sellingPrice: String(line.sellingPricePaise / 100),
        mrp: line.mrpPaise === undefined ? "" : String(line.mrpPaise / 100),
      })) ||
      seed?.lines.map(({ product, quantity }) => ({
        lineId: crypto.randomUUID(),
        product,
        packs: String(Math.floor(quantity / product.unitDefinition.unitsPerPack)),
        looseUnits: String(quantity % product.unitDefinition.unitsPerPack),
        freePacks: "0",
        freeLooseUnits: "0",
        baseAmount: "",
        discount: "0",
        gst: "",
        hsn: product.hsnCode || "",
        sellingPrice: String(product.price),
        mrp: "",
      })) ||
      []
  );

  useEffect(() => {
    const request = beginParty();
    const timer = setTimeout(() => {
      void purchasePage<PharmacyParty>("parties", locationId, { search: partySearch }, request.signal)
        .then(page => {
          if (request.isCurrent()) setParties(page.items.filter(party => party.kinds.includes("supplier")));
        })
        .catch(() => {
          if (request.isCurrent()) setSearchError("Suppliers could not be loaded. Retry the supplier search.");
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [beginParty, locationId, partySearch]);

  useEffect(() => {
    if (!current) return;
    let active = true;
    void api
      .get(`/pharmacy/parties/${current.supplierId}?locationId=${encodeURIComponent(locationId)}`)
      .then(response => {
        if (active) setSelectedParty(response.data.data);
      })
      .catch(() => {
        if (active) setSearchError("The saved supplier needs review before editing this draft.");
      });
    return () => {
      active = false;
    };
  }, [current, locationId]);

  useEffect(() => {
    const request = beginSearch();
    const timer = setTimeout(() => {
      void purchasePage<Product>("purchase-products", locationId, { search: productSearch }, request.signal)
        .then(page => {
          if (request.isCurrent()) setProducts(page.items.filter(product => product.unitDefinition));
        })
        .catch(() => {
          if (request.isCurrent()) setSearchError("Products could not be loaded. Retry the product search.");
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [beginSearch, locationId, productSearch]);

  const supplierOptions = [
    ...parties,
    ...(selectedParty && !parties.some(party => party.id === selectedParty.id) ? [selectedParty] : []),
  ];

  function addProduct() {
    const product = products.find(row => row.id === productId);
    if (!product || lines.length >= 100) return;
    setLines(previous => [
      ...previous,
      {
        lineId: crypto.randomUUID(),
        product,
        packs: "0",
        looseUnits: "0",
        freePacks: "0",
        freeLooseUnits: "0",
        baseAmount: "",
        discount: "0",
        gst: "",
        hsn: product.hsnCode || "",
        sellingPrice: String(product.price),
        mrp: "",
      },
    ]);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || state.busy || importOpen) return;
    const supplier = supplierOptions.find(party => party.id === supplierId);
    const statedTotalPaise = parseReceiptPaise(header.total);
    if (!supplier || supplier.archived || !header.number.trim() || !header.date || statedTotalPaise === null || !lines.length) {
      state.setError("Select an active supplier, invoice number/date, stated total and at least one product.");
      return;
    }
    const captured: PurchaseLine[] = [];
    for (const line of lines) {
      const counts = numberFields.map(field => (/^\d+$/.test(line[field]) ? Number(line[field]) : NaN));
      const [packs, looseUnits, freePacks, freeLooseUnits] = counts;
      const unit = line.product.unitDefinition;
      const baseAmountPaise = parseReceiptPaise(line.baseAmount);
      const discountPaise = parseReceiptPaise(line.discount);
      const gstRateBps = parseReceiptPaise(line.gst);
      const sellingPricePaise = parseReceiptPaise(line.sellingPrice);
      const mrpPaise = line.mrp.trim() ? parseReceiptPaise(line.mrp) : undefined;
      const total = (packs + freePacks) * unit.unitsPerPack + looseUnits + freeLooseUnits;
      if (
        counts.some(value => !Number.isSafeInteger(value) || value < 0) ||
        looseUnits >= unit.unitsPerPack ||
        freeLooseUnits >= unit.unitsPerPack ||
        !Number.isSafeInteger(total) ||
        total <= 0 ||
        baseAmountPaise === null ||
        discountPaise === null ||
        discountPaise > baseAmountPaise ||
        gstRateBps === null ||
        gstRateBps > 10000 ||
        sellingPricePaise === null ||
        mrpPaise === null ||
        (mrpPaise !== undefined && sellingPricePaise > mrpPaise) ||
        !/^\d{4}(\d{2})?(\d{2})?$/.test(line.hsn)
      ) {
        state.setError(`Check quantities, exact amounts, HSN and GST for ${line.product.name}.`);
        return;
      }
      captured.push({
        lineId: line.lineId,
        medicineId: line.product.id,
        expectedUnitVersion: unit.version,
        packs,
        looseUnits,
        freePacks,
        freeLooseUnits,
        baseAmountPaise,
        discountPaise,
        gstRateBps,
        hsnCode: line.hsn,
        sellingPricePaise,
        ...(mrpPaise !== undefined ? { mrpPaise } : {}),
      });
    }
    const continueAfter = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "continue";
    void state.save(async () => {
      const result = await savePurchaseDraft(
        {
          locationId,
          supplierId,
          expectedSupplierRevision: supplier.revision,
          supplierInvoiceNumber: header.number.trim(),
          invoiceDate: header.date,
          statedTotalPaise,
          notes: header.notes,
          lines: captured,
        },
        key,
        current
      );
      if (continueAfter) purchaseReceivingPlan(result);
      return result;
    }, continueAfter ? onContinue : undefined);
  }

  const disabled = state.busy || !canManage;

  return (
    <Modal
      open
      title={current ? "Purchase draft" : "New purchase draft"}
      description={current ? `${current.supplierInvoiceNumber} · ${current.supplierSnapshot.name}` : undefined}
      onClose={onClose}
      busy={state.busy}
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={state.busy} onClick={onClose}>
            Cancel
          </Button>
          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                type="submit"
                form="purchase-draft-form"
                disabled={state.busy || importOpen}
              >
                Save purchase draft
              </Button>
              <Button
                size="sm"
                type="submit"
                value="continue"
                form="purchase-draft-form"
                disabled={importOpen}
                loading={state.busy}
              >
                Save &amp; continue
              </Button>
            </>
          )}
        </div>
      }
    >
      <form id="purchase-draft-form" className="space-y-4" onSubmit={submit} noValidate>
        <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface-alt/50 p-3 text-xs leading-relaxed text-text-secondary">
          {seed && (
            <p className="font-medium text-text">
              Quantities copied from the shortbook. Select the actual supplier and enter its invoice number, amounts and tax. Shortages
              remain open until reviewed.
            </p>
          )}
          <p className="flex items-start gap-1.5">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Draft only. Record amounts from the supplier invoice; stock receiving and supplier balances are separate steps.</span>
          </p>
        </div>

        {current?.calculation ? (
          <section
            aria-label="Saved purchase calculation"
            className="space-y-1.5 rounded-xl border border-border bg-surface-alt/40 p-3 text-xs leading-relaxed"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="font-semibold text-text">Saved amounts. Save edits and reopen to refresh.</strong>
              <Badge variant="neutral" size="sm">
                Saved totals
              </Badge>
            </div>
            <p className="text-text-secondary">
              Base after discounts: <strong className="tabular-nums text-text">{money(current.calculation.totals.baseAmountPaise / 100)}</strong>.
              GST: <strong className="tabular-nums text-text">{money(current.calculation.totals.unallocatedTaxPaise / 100)}</strong>.
            </p>
            <p className="text-text-secondary">
              Calculated total: <strong className="tabular-nums text-text">{money(current.calculation.totals.payablePaise / 100)}</strong>.
              Supplier stated total: <strong className="tabular-nums text-text">{money(current.statedTotalPaise / 100)}</strong>.
            </p>
            <p className="text-text-secondary">
              Difference (stated − calculated):{" "}
              <strong className="tabular-nums text-text">
                {money((current.statedTotalPaise - current.calculation.totals.payablePaise) / 100)}
              </strong>
              .
            </p>
            <p className="text-[11px] text-text-secondary">GST split and supplier tax evidence need review before posting.</p>
          </section>
        ) : (
          current && (
            <p className="rounded-xl border border-border/70 bg-surface-alt/40 p-3 text-xs text-text-secondary">
              No saved calculation. Save this draft to calculate its amounts.
            </p>
          )
        )}

        {state.error && (
          <Alert variant="error" title="Draft was not confirmed">
            {state.error}
          </Alert>
        )}
        {searchError && (
          <Alert variant="warning" title="Draft lookup needs attention">
            {searchError}
          </Alert>
        )}

        <fieldset className="space-y-4" disabled={disabled}>
          <div className="space-y-3 rounded-xl border border-border/70 bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-text">Supplier &amp; invoice details</h3>
              {canManage && !importOpen && (
                <Button
                  size="xs"
                  variant="outline"
                  icon={<Upload size={13} aria-hidden="true" />}
                  disabled={!supplierId || lines.length >= 100}
                  onClick={() => {
                    setImportNotice("");
                    setImportOpen(true);
                  }}
                >
                  Import purchase CSV
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                size="sm"
                label="Search suppliers"
                value={partySearch}
                maxLength={100}
                onChange={event => {
                  setPartySearch(event.target.value);
                  setSearchError("");
                }}
              />
              <Select
                size="sm"
                label="Purchase supplier *"
                value={supplierId}
                onChange={event => {
                  setSupplierId(event.target.value);
                  setSelectedParty(supplierOptions.find(row => row.id === event.target.value) || null);
                }}
                options={[
                  { value: "", label: "Choose supplier" },
                  ...supplierOptions.map(party => ({ value: party.id, label: party.name, disabled: party.archived })),
                ]}
              />
            </div>

            {current && (
              <p className="text-[11px] text-text-secondary">
                Saved supplier snapshot: {current.supplierSnapshot.name}. {current.supplierSnapshot.address}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                size="sm"
                label="Supplier invoice number *"
                maxLength={80}
                value={header.number}
                onChange={event => setHeader({ ...header, number: event.target.value })}
              />
              <DatePicker
                size="sm"
                label="Supplier invoice date *"
                value={header.date}
                onChange={value => setHeader({ ...header, date: value })}
              />
              <Input
                size="sm"
                label="Supplier stated total (INR) *"
                type="number"
                min="0"
                step="0.01"
                value={header.total}
                onChange={event => setHeader({ ...header, total: event.target.value })}
              />
            </div>
          </div>

          {importOpen && (
            <PharmacyPurchaseCsv
              key={supplierId}
              locationId={locationId}
              supplierId={supplierId}
              remaining={100 - lines.length}
              onCancel={() => setImportOpen(false)}
              onApply={rows => {
                if (rows.length + lines.length > 100 || rows.some(row => !row.line || !row.product || row.error)) return;
                setLines(previous => [...previous, ...rows.map(row => importedFormLine(row.line!, row.product!))]);
                setImportOpen(false);
                setImportNotice(`${rows.length} CSV lines added. Review and save this draft; stock has not been received.`);
              }}
            />
          )}

          {importNotice && (
            <p role="status" className="rounded-lg border border-border/70 bg-surface-alt px-3 py-2 text-xs text-text">
              {importNotice}
            </p>
          )}

          <div className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-text">Invoice lines</h3>
              <Badge variant="neutral" size="sm">
                {lines.length} / 100
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Input
                size="sm"
                label="Search purchase products"
                maxLength={100}
                value={productSearch}
                onChange={event => {
                  setProductSearch(event.target.value);
                  setSearchError("");
                }}
              />
              <Select
                size="sm"
                label="Purchase product"
                value={productId}
                onChange={event => setProductId(event.target.value)}
                options={[
                  { value: "", label: "Choose product with recorded units" },
                  ...products.map(product => ({ value: product.id, label: product.name })),
                ]}
              />
              <Button size="sm" variant="outline" disabled={!productId || lines.length >= 100} onClick={addProduct}>
                Add purchase line
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const edit = (field: keyof FormLine, value: string) =>
                setLines(previous => previous.map(row => (row.lineId === line.lineId ? { ...row, [field]: value } : row)));
              return (
                <fieldset
                  className="space-y-3 rounded-xl border border-border bg-surface p-3"
                  key={line.lineId}
                  aria-label={`Purchase line ${index + 1}: ${line.product.name}`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2">
                    <div className="min-w-0">
                      <strong className="block text-xs font-semibold text-text">{line.product.name}</strong>
                      <p className="mt-0.5 text-[11px] text-text-secondary">{packDescription(line.product.unitDefinition)}</p>
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="shrink-0 text-error-text"
                      icon={<Trash2 size={13} aria-hidden="true" />}
                      aria-label={`Remove purchase line ${index + 1}`}
                      onClick={() => setLines(previous => previous.filter(row => row.lineId !== line.lineId))}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {numberFields.map((field, count) =>
                      field === "packs" || field === "freePacks" ? (
                        <PharmacyPackQuantity
                          key={field}
                          size="sm"
                          unit={line.product.unitDefinition}
                          label={field === "packs" ? "Billed packs" : "Free packs"}
                          value={line[field]}
                          onChange={value => edit(field, value)}
                          onError={state.setError}
                        />
                      ) : (
                        <Input
                          key={field}
                          size="sm"
                          label={["Billed packs", "Billed loose units", "Free packs", "Free loose units"][count]}
                          type="number"
                          min="0"
                          step="1"
                          value={line[field]}
                          onChange={event => edit(field, event.target.value)}
                        />
                      )
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      size="sm"
                      label="Base amount before discount/tax (INR)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.baseAmount}
                      onChange={event => edit("baseAmount", event.target.value)}
                    />
                    <Input
                      size="sm"
                      label="Line discount (INR)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.discount}
                      onChange={event => edit("discount", event.target.value)}
                    />
                    <Input size="sm" label="Invoice HSN" value={line.hsn} onChange={event => edit("hsn", event.target.value)} />
                    <Input
                      size="sm"
                      label="Invoice GST (%)"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={line.gst}
                      onChange={event => edit("gst", event.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Input
                      size="sm"
                      label={`Selling price per ${line.product.unitDefinition.baseUnit} (INR)`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.sellingPrice}
                      onChange={event => edit("sellingPrice", event.target.value)}
                    />
                    <Input
                      size="sm"
                      label={`MRP per ${line.product.unitDefinition.baseUnit} (INR)`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.mrp}
                      onChange={event => edit("mrp", event.target.value)}
                    />
                  </div>
                </fieldset>
              );
            })}
          </div>

          <Input
            size="sm"
            label="Purchase draft notes"
            maxLength={1000}
            value={header.notes}
            onChange={event => setHeader({ ...header, notes: event.target.value })}
          />
        </fieldset>
      </form>
    </Modal>
  );
}
