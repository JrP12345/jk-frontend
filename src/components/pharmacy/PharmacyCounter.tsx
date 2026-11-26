"use client";
import { PharmacyPackQuantity } from "./PharmacyPackQuantity";
import { packDescription } from "@/lib/pharmacyUnits";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Badge, Button, Card, CardDescription, CardTitle, ConfirmDialog, EmptyState, Input, Modal, QuantityInput, Tabs } from "@/components/ui";
import { Barcode, Search, ShoppingBasket, Plus, X, SlidersHorizontal, FileText, RotateCw, History } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useLatestRead } from "@/hooks/useLatestRead";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { counterProducts, counterCustomers, quoteCounter, issueCounter, recoverCounter, type CounterProduct, type CounterCustomer, type CounterIntent, type CounterQuote, type CounterResult, type CounterIssueInput } from "@/lib/pharmacyCounter";
import type { StaffPickup } from "@/lib/publicPharmacy";
import { PharmacyCounterFilters, matchesCounterType } from "./PharmacyCounterFilters";
import { PharmacyCounterRecentBills, useCounterOverview } from "./PharmacyCounterOverview";
import { PharmacyCounterCustomerHistory } from "./PharmacyCounterCustomerHistory";
import { PharmacyCounterCustomerForm } from "./PharmacyCounterCustomerForm";
import { PharmacyCustomerReminders } from "./PharmacyCustomerReminders";
import { PharmacyDrawerGate } from "./PharmacyDrawerGate";
import { PharmacySavedBillPrint } from "./PharmacySavedBillPrint";
import { PharmacyCounterPaymentEditor, type CounterPaymentAllocation } from "./PharmacyCounterPaymentEditor";
import { prepareCounterCollection } from "@/lib/pharmacyPayment";
import { prepareIssuedCheckoutPayment } from "@/lib/pharmacyPayment";
import { PharmacyCollections } from "./PharmacyCollections";
import type { CounterPaymentPreference } from "./PharmacyCollectionForm";
import { PharmacyProductReview } from "./PharmacyProductReview";
import { PharmacyCatalogueDiscovery } from "./PharmacyCatalogueDiscovery";
import { PharmacyCounterSkeleton } from "./PharmacyCounterSkeleton";
import { PharmacyCounterSaveStatus } from "./PharmacyCounterSaveStatus";
import { hasAnyPermission } from "@/lib/permissions";
import { money } from "./pharmacyWorkspace";
import pos from "./PharmacyCounter.module.css";
import { usePharmacyDraft } from "@/hooks/usePharmacyDraft";
import { type CounterDraft, type DraftCart } from "@/lib/pharmacyDrafts";
import { pendingCollectionReference, type CollectionReceipt, type CounterInvoice } from "@/lib/pharmacyCollections";
import { createPharmacyCatalogue, estimateDraft } from "@/lib/pharmacyCatalogue";
import { createSaleJournal } from "@/lib/pharmacyCommandJournal";
import { pharmacyConnectionFailure, usePharmacyReconnect } from "@/hooks/usePharmacyReconnect";
import { measurePharmacyStep } from "@/lib/pharmacySavePerformance";
import { usePharmacyCatalogueSync } from "@/hooks/usePharmacyCatalogueSync";
import { PharmacyOfflineCounterGate } from "./PharmacyOfflineCounterGate";
import { usePharmacyCounterAvailability } from "@/hooks/usePharmacyCounterAvailability";
import { PharmacyCounterAvailabilityNotice } from "./PharmacyCounterAvailabilityNotice";

type CartLine = { lineId: string; product: CounterProduct; packs: string; loose: string; discount: string };
type Cart = { pickup?: { id: string; revision: number }; lines: CartLine[]; customer: CounterCustomer | null; discount: string; billNumber?: number };
const productLabel = (product: CounterProduct) => `${product.name}${product.manufacturer ? ` (${product.manufacturer})` : ""}`;
const message = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Counter operation could not be confirmed. Keep the same reference.");
function savedKey(storageKey: string) {
  const key = sessionStorage.getItem(storageKey);
  if (key !== null && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new Error("Sale reference requires review before another issue.");
  return key;
}
interface Props { onViewHistory?: () => void; toolbarContext?: ReactNode; toolbarActions?: ReactNode; initialPickup?: StaffPickup | null; onPickupConsumed?: () => void; onPickupPrepared?: () => void; locationId: string; inventoryMode?: "tracked" | "billing_only"; canCollect: boolean; canOpenTill?: boolean; compact?: boolean; canManageCatalog?: boolean; canReviewProducts?: boolean; onProductReviewed?: () => void; onCreateLocal?: (name: string) => void; catalogueEditorOpen?: boolean; catalogueRevision?: number }
export function PharmacyCounter(props: Props) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user);
  return <PharmacyOfflineCounterGate key={`${scope}:${props.locationId}:${props.inventoryMode || "tracked"}`} organizationId={user?.organization_id} locationId={props.locationId} actorId={user?.id} canIssue={props.canCollect}>
    <CounterSession {...props} />
  </PharmacyOfflineCounterGate>;
}
function CounterSession({ onViewHistory, toolbarContext, toolbarActions, initialPickup, onPickupConsumed, onPickupPrepared, locationId, inventoryMode = "tracked", canCollect, canOpenTill = false, compact = false, canManageCatalog = false, canReviewProducts = false, onProductReviewed, onCreateLocal, catalogueEditorOpen = false, catalogueRevision = 0 }: Props) {
  const availability = usePharmacyCounterAvailability(locationId);
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-sale:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { key: savedKey(storageKey), error: "" }; } catch (failure) { return { key: null, error: message(failure) }; } });
  const [pending, setPending] = useState(initial.key), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [correctable, setCorrectable] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]), [customer, setCustomer] = useState<CounterCustomer | null>(null), [discount, setDiscount] = useState("0");
  const [held, setHeld] = useState<Cart[]>([]), [quote, setQuote] = useState<CounterQuote | null>(null), [outcome, setOutcome] = useState<CounterResult | null>(null);
  const [billNumber, setBillNumber] = useState(1), nextBillNumber = useRef(2);
  const [search, setSearch] = useState(""), [customerMode, setCustomerMode] = useState("walk-in"), [products, setProducts] = useState<CounterProduct[]>([]), [nextProduct, setNextProduct] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState(""), [customers, setCustomers] = useState<CounterCustomer[]>([]), [nextCustomer, setNextCustomer] = useState<string | null>(null);
  const [reminderCustomer, setReminderCustomer] = useState<string | null>(null);
  const [searching, setSearching] = useState(false), [searchError, setSearchError] = useState("");
  const [productLookupDone, setProductLookupDone] = useState(false), [customerLookupEmpty, setCustomerLookupEmpty] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<CounterCustomer | null>(null);
  const [creditOverride, setCreditOverride] = useState("");
  const [pickupLoadRetry, setPickupLoadRetry] = useState(0), [pickupLoadFailed, setPickupLoadFailed] = useState(false);
  const [pickup, setPickup] = useState<{ id: string; revision: number }>(), [pickupLoading, setPickupLoading] = useState(false);
  const initializedPickup = useRef<string | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [paymentEditor, setPaymentEditor] = useState(false), [advancedPayment, setAdvancedPayment] = useState<CounterPaymentAllocation | null>(null);
  const [customerError, setCustomerError] = useState(""), [customerLoading, setCustomerLoading] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [quoteError, setQuoteError] = useState(""), [quoteConflict, setQuoteConflict] = useState(false), [quoting, setQuoting] = useState(false), [addedMessage, setAddedMessage] = useState("");
  const [paymentReference, setPaymentReference] = useState(""), [drawerReady, setDrawerReady] = useState(false);
  const [drawerRevision, setDrawerRevision] = useState(0);
  const printRequested = useRef(false);
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);
  const [printDocument, setPrintDocument] = useState<CounterInvoice>();
  const [catalogue] = useState(() => createPharmacyCatalogue(scope, locationId, inventoryMode)), [journal] = useState(() => createSaleJournal(scope, locationId));
  const [catalogueVersion, setCatalogueVersion] = useState(0), [catalogueReady, setCatalogueReady] = useState(false), [journalReady, setJournalReady] = useState(false), [network, setNetwork] = useState("unknown");
  usePharmacyCatalogueSync(scope, locationId, catalogue, network === "online");
  const [recentInvoice, setRecentInvoice] = useState<string | null>(null), [lastSavedBill, setLastSavedBill] = useState<CounterResult | null>(null);
  const [viewRecentInvoice, setViewRecentInvoice] = useState<string | null>(null);
  const [priorPayment, setPriorPayment] = useState<string | null>(null);
  const overview = useCounterOverview(locationId, recentInvoice || "");
  const [onAccount, setOnAccount] = useState(false);
  const [preparingBill, setPreparingBill] = useState(false), [collectionVersion, setCollectionVersion] = useState(0);
  const [keyboardPicking, setKeyboardPicking] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("products"), [productFilter, setProductFilter] = useState<string[]>([]), [picked, setPicked] = useState(0);
  const [productResultsSnapshot, setProductResultsSnapshot] = useState<CounterProduct[] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CounterPaymentPreference["method"]>("cash"), [cashPreview, setCashPreview] = useState<string | null>(null);
  const [issuedPreference, setIssuedPreference] = useState<CounterPaymentPreference>();
  const [editingLineId, setEditingLineId] = useState<string | null>(null), [quoteDetailsOpen, setQuoteDetailsOpen] = useState(false), [closingHeld, setClosingHeld] = useState<number | null>(null);
  const initialBrowse = useRef(false);
  const customerPanel = useRef<HTMLElement>(null), discountInput = useRef<HTMLInputElement>(null), paymentPanel = useRef<HTMLDivElement>(null);
  const checkoutLock = useRef(false);
  const [clearOpen, setClearOpen] = useState(false), [clearingCart, setClearingCart] = useState(false), [collectionPending, setCollectionPending] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupFlight = useRef<{ key: string; repeats: number } | null>(null);
  const scanner = useRef<HTMLInputElement>(null), quantityInputs = useRef(new Map<string, HTMLInputElement>());
  const alive = useRef(true), lock = useRef(false), revision = useRef(0), frozen = useRef<{ key: string; input: CounterIssueInput } | null>(null);
  const beginLookup = useLatestRead(), beginCustomer = useLatestRead(), beginQuote = useLatestRead();
  const restoreDraft = useCallback((saved: CounterDraft) => {
    const unpack = (cart: DraftCart): Cart => ({ ...(cart.pickup ? { pickup: cart.pickup } : {}), lines: cart.lines, discount: cart.discount, billNumber: cart.billNumber, customer: cart.customerId ? { id: cart.customerId, name: "Recorded customer", address: "", revision: 0 } : null });
    const restoredNumber = saved.cart.billNumber || 1;
    setBillNumber(restoredNumber); nextBillNumber.current = Math.max(restoredNumber, ...saved.held.map((cart, index) => cart.billNumber || index + 2)) + 1;
    const cart = unpack(saved.cart); setPickup(cart.pickup); setLines(cart.lines); setDiscount(cart.discount); setCustomer(cart.customer); setCustomerMode(cart.customer ? "recorded" : "walk-in"); setHeld(saved.held.map(unpack));
  }, []);
  const packDraft = (cart: Cart): DraftCart => ({ ...(cart.pickup ? { pickup: cart.pickup } : {}), lines: cart.lines, discount: cart.discount, customerId: cart.customer?.id || null, billNumber: cart.billNumber });
  const draftValue: CounterDraft = { cart: packDraft({ lines, customer, discount, billNumber, ...(pickup ? { pickup } : {}) }), held: held.map(packDraft) };
  const draft = usePharmacyDraft(scope, locationId, draftValue, restoreDraft);
  const current = useCallback(() => alive.current && authScopeKey(useAuthStore.getState().user) === scope, [scope]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    void catalogue.load().then(() => { if (current()) { setCatalogueVersion(v => v + 1); setCatalogueReady(true); } });
    void journal.load().then(saved => {
      if (!current()) return;
      if (saved.value && saved.value.key === initial.key) { frozen.current = saved.value; setSubmitted(true); }
      setJournalReady(true);
    }).catch(failure => { if (current()) { setError(message(failure)); setJournalReady(true); } });
    try { sessionStorage.setItem("ekavyu-pharmacy-offline-context", JSON.stringify({ scope, locationId, inventoryMode, at: Date.now() })); } catch { /* Device draft status reports unavailable storage. */ }
  }, [catalogue, journal, initial.key, scope, locationId, inventoryMode, current]);
  const canReview = canReviewProducts && hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const restoring = !draft.ready || !journalReady || !catalogueReady;
  const editable = !restoring && !draft.error && !busy && !preparingBill && !clearingCart && !submitted && !outcome && !pickupLoading && !catalogueOpen && !catalogueEditorOpen && !addingCustomer && !paymentEditor && !(canReview && reviewing);
  function invalidate() { setCreditOverride(""); revision.current++; beginQuote(); setQuote(null); setQuoteError(""); setQuoting(false); setError(""); }
  useEffect(() => {
    if (!initialPickup || restoring || pending || outcome || initializedPickup.current === initialPickup.id) return;
    if (pickup?.id === initialPickup.id || held.some(cart => cart.pickup?.id === initialPickup.id)) { initializedPickup.current = initialPickup.id; onPickupConsumed?.(); return; }
    if (lines.length && held.length >= 3) { void Promise.resolve().then(() => { if (current()) setError("Hold or clear a cart before preparing this parcel; all held bill slots are in use."); }); return; }
    const controller = new AbortController();
    void (async () => {
      setPickupLoading(true); setPickupLoadFailed(false); setError("");
      try {
        const page = await counterProducts(locationId, { medicineIds: initialPickup.items.map(item => item.medicineId).join(",") }, controller.signal);
        if (controller.signal.aborted || !current()) return;
        const prepared = initialPickup.items.map(item => { const product = page.items.find(row => row.id === item.medicineId);
          if (!product?.eligible || !product.unitDefinition || item.unitVersion !== undefined && item.unitVersion !== product.unitDefinition.version) throw Error("A requested parcel product changed. Review the pickup request before billing.");
          return { lineId: crypto.randomUUID(), product, packs: "0", loose: String(item.quantity), discount: "0" };
        });
        if (lines.length) setHeld(previous => [...previous, { lines, customer, discount, billNumber, ...(pickup ? { pickup } : {}) }]);
        initializedPickup.current = initialPickup.id;
        setPickup({ id: initialPickup.id, revision: initialPickup.revision }); setLines(prepared); setCustomer(null); setCustomerMode("walk-in"); setDiscount("0"); setAdvancedPayment(null); setOnAccount(false); setQuote(null); setQuoteError("");
        onPickupConsumed?.();
      } catch (e) { if (!controller.signal.aborted && current()) { setPickupLoadFailed(true); setError(message(e)); } }
      finally { if (!controller.signal.aborted && current()) setPickupLoading(false); }
    })();
    return () => { controller.abort(); };
  }, [initialPickup, restoring, pending, outcome, pickup, lines, held, customer, discount, billNumber, locationId, current, pickupLoadRetry, onPickupConsumed]);
  function reviewProduct(id: string) { if (editable && canReview) { invalidate(); setReviewing(id); } }
  function productResults() {
    const frequentOnly = !productResultsSnapshot && !search.trim() && productFilter.includes("frequent");
    const displayProducts = productResultsSnapshot || (frequentOnly ? catalogue.frequent() : search.trim() || productLookupDone ? products : catalogue.find("").items);
    const visibleProducts = productResultsSnapshot ? [...displayProducts] : displayProducts.filter(product => (!productFilter.includes("frequent") || catalogue.frequency(product.id) > 0) && matchesCounterType(product.unitDefinition?.baseUnit || "", productFilter));
    if (!productResultsSnapshot && productFilter.includes("frequent")) visibleProducts.sort((a, b) => catalogue.frequency(b.id) - catalogue.frequency(a.id));
    return { frequentOnly, displayProducts, visibleProducts };
  }
  const [addedProduct, setAddedProduct] = useState<{ id: string; sequence: number } | null>(null);
  useEffect(() => {
    if (!addedProduct) return;
    const timer = setTimeout(() => setAddedProduct(null), 1000);
    return () => clearTimeout(timer);
  }, [addedProduct]);
  function add(product: CounterProduct, focusSearch = true) {
    if (pickup) { setError("Keep this parcel bill to its requested items. Hold or clear it before a separate purchase."); return; }
    if (!editable) return;
    if (product.saleBlocked) { setSearchError("This product is on a sale hold. Ask your organization administrator to review the recorded restriction."); return; }
    if (!product.eligible || !product.unitDefinition) { setSearchError("This product needs its reviewed prescription or inventory workflow."); return; }
    if (inventoryMode === "tracked" && product.stockQuantity === 0) { setSearchError("This product is out of stock in the current snapshot. Refresh products before adding it."); return; }
    if (!lines.some(line => line.product.id === product.id) && lines.length >= 100) { setSearchError("A counter invoice supports at most 100 distinct products."); return; }
    invalidate();
    catalogue.recordUse(product.id);
    setAddedProduct(previous => ({ id: product.id, sequence: (previous?.sequence || 0) + 1 }));
    setLines(previous => { const found = previous.find(line => line.product.id === product.id); return found ? previous.map(line => line.lineId === found.lineId ? { ...line, loose: String(Number(line.loose) + 1) } : line) : [...previous, { lineId: crypto.randomUUID(), product, packs: "0", loose: "1", discount: "0" }]; });
    // Recording a use changes the Frequent ranking. Keep the current rows where the
    // operator saw them until they deliberately search or change a filter.
    const visible = productResults().visibleProducts;
    setProductResultsSnapshot(visible.length ? visible : null);
    setSearch(""); setSearchError(""); setPicked(0); setKeyboardPicking(false); setAddedMessage(`Added 1 ${product.unitDefinition.baseUnit} of ${product.name} to cart.`);
    if (focusSearch) requestAnimationFrame(() => scanner.current?.focus());
    else scanner.current?.blur();
  }
  const exactLookup = /^\d+$/.test(search.trim());
  async function lookup(exact = false, cursor?: string, addExact = true, force = false) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const flightKey = JSON.stringify([search.trim(), exact, cursor || null]);
    if (lookupFlight.current?.key === flightKey) { if (exact && addExact) lookupFlight.current.repeats++; return; }
    const cached = !cursor && !force ? catalogue.find(search, exact) : null;
    if (cached?.items.length) {
      if (exact && addExact && cached.fresh && cached.items.length === 1 && cached.items[0].eligible && cached.items[0].unitDefinition) { add(cached.items[0]); return; }
      setProducts(cached.items); setNextProduct(cached.nextCursor); setProductLookupDone(true);
      if (cached.fresh || network === "offline") return;
    }
    const flight = { key: flightKey, repeats: 0 }; lookupFlight.current = flight;
    const request = beginLookup(), version = revision.current; setSearching(true); setSearchError(""); setProductLookupDone(false); setAddedMessage("");
    try {
      const page = await counterProducts(locationId, exact ? { barcode: search.trim() } : { search: search.trim(), cursor }, request.signal);
      if (!request.isCurrent() || version !== revision.current || lock.current) return;
      setNetwork("online"); catalogue.remember(page.items, search, exact, page.nextCursor, cursor); setCatalogueVersion(v => v + 1);
      if (exact && addExact) {
        if (page.items.length !== 1 || page.nextCursor) throw new Error("No unique product matches this exact barcode. Search the catalogue to review it.");
        const product = page.items[0];
        if (!product.eligible || !product.unitDefinition) { setProducts([product]); setNextProduct(null); setSearchError("This product needs a classification review or unit setup before counter sale."); }
        else for (let n = 0; n <= Math.min(flight.repeats, 99); n++) add(product);
      }
      else { setProducts(page.items); setNextProduct(page.nextCursor); setProductLookupDone(true); }
    } catch (failure) { if (request.isCurrent()) { if (pharmacyConnectionFailure(failure)) setNetwork("offline"); if (!cached?.items.length) setSearchError(message(failure)); } }
    finally { if (lookupFlight.current === flight) lookupFlight.current = null; if (request.isCurrent()) setSearching(false); }
  }
  const searchRead = useRef(lookup);
  useEffect(() => { searchRead.current = lookup; });
  const lastCatalogueRevision = useRef(catalogueRevision);
  useEffect(() => {
    if (!editable || lastCatalogueRevision.current === catalogueRevision) return;
    lastCatalogueRevision.current = catalogueRevision;
    // Revalidate products after the shared editor saves, without clearing the cart
    // or interpreting a numeric product name as an instruction to add a barcode.
    void searchRead.current(false, undefined, false, true);
  }, [catalogueRevision, editable]);
  useEffect(() => {
    if (!editable || initialBrowse.current) return;
    initialBrowse.current = true;
    if (network !== "offline" && !search.trim()) void searchRead.current(false, undefined, false);
  }, [editable, network, search]);
  useEffect(() => {
    if (!editable || exactLookup || search.trim().length < 2) return;
    const timer = setTimeout(() => { void searchRead.current(false); }, 150); searchTimer.current = timer;
    return () => clearTimeout(timer);
  }, [editable, exactLookup, search]);
  async function lookupCustomer(cursor?: string) {
    const request = beginCustomer(); setCustomerError(""); setCustomerLoading(true); setCustomers([]); setNextCustomer(null); setCustomerLookupEmpty(false);
    try { const page = await counterCustomers(locationId, customerSearch.trim(), cursor, request.signal); if (request.isCurrent()) { setCustomers(page.items); setNextCustomer(page.nextCursor); setCustomerLookupEmpty(page.items.length === 0); } }
    catch (failure) { if (request.isCurrent()) setCustomerError(message(failure)); }
    finally { if (request.isCurrent()) setCustomerLoading(false); }
  }
  const intent = useCallback((): CounterIntent => {
    const invoiceDiscountPaise = parseReceiptPaise(discount);
    if (invoiceDiscountPaise === null || !lines.length) throw new Error("Add products and enter valid discounts before requesting a quote.");
    return { locationId, ...(pickup ? { pickup } : {}), expectedInventoryMode: inventoryMode, ...(customer ? { customerId: customer.id } : {}), invoiceDiscountPaise, roundOffPaise: 0, lines: lines.map(line => {
      if (!/^\d+$/.test(line.packs) || !/^\d+$/.test(line.loose) || !line.product.unitDefinition) throw new Error("Enter whole pack and loose quantities.");
      const total = BigInt(line.packs) * BigInt(line.product.unitDefinition.unitsPerPack) + BigInt(line.loose), discountPaise = parseReceiptPaise(line.discount);
      if (total <= BigInt(0) || total > BigInt(Number.MAX_SAFE_INTEGER) || discountPaise === null) throw new Error("Use positive safe quantities and valid line discounts.");
      return { lineId: line.lineId, medicineId: line.product.id, quantity: Number(total), expectedUnitVersion: line.product.unitDefinition.version, discountPaise };
    }) };
  }, [customer, discount, lines, locationId, inventoryMode, pickup]);
  const refreshQuote = useCallback(async () => {
    let payload: CounterIntent;
    try { payload = intent(); } catch (failure) { setQuoteError(message(failure)); setQuoteConflict(true); setQuote(null); return; }
    const request = beginQuote(), version = revision.current; setQuoteError(""); setQuoting(true);
    try { const result = await quoteCounter(payload, request.signal); if (request.isCurrent() && version === revision.current) { setQuote(result); setNetwork("online"); catalogue.rememberQuote(result); setCatalogueVersion(v => v + 1); return result; } }
    catch (failure) { if (request.isCurrent() && version === revision.current) { setQuoteError(message(failure)); setQuoteConflict((failure as { response?: { status?: number } })?.response?.status === 409); setNetwork(pharmacyConnectionFailure(failure) ? "offline" : "online"); } }
    finally { if (request.isCurrent() && version === revision.current) setQuoting(false); }
  }, [beginQuote, intent, catalogue]);
  const estimate = catalogueVersion >= 0 ? estimateDraft(catalogue, lines, discount, locationId) : null;

  useEffect(() => {
    if (!editable || !lines.length || network === "offline" || quote || estimate) return;
    const timer = setTimeout(() => { void refreshQuote(); }, 150);
    return () => clearTimeout(timer);
  }, [editable, lines.length, refreshQuote, network, quote, estimate]);
  // Ordinary cart edits stay local. Missing display prices are fetched once; every Save revalidates fresh evidence.
  const pricing = editable && lines.length > 0 && !quote && !quoteError;
  function finishCart(result: CounterResult) {
    if (savedKey(storageKey) !== result.requestKey) throw Error("Sale reference changed; check the saved bill.");
    const sold = frozen.current?.input.lines || [];
    setCreditOverride(""); setPickup(undefined); catalogue.recordSale(sold); setCatalogueVersion(value => value + 1);
    if (inventoryMode === "tracked") setProducts(previous => previous.map(product => ({ ...product, stockQuantity: Math.max(0, product.stockQuantity - (sold.find(line => line.medicineId === product.id)?.quantity || 0)) })));
    if (printRequested.current) { setPrintDocument(result.document); setPrintInvoiceId(result.invoiceId); printRequested.current = false; }
    setPaymentReference(""); setDrawerReady(false);
    setBillNumber(nextBillNumber.current++);
    setOnAccount(false); setAdvancedPayment(null); setPaymentMethod("cash"); setCashPreview(null); setMobilePanel("products");
    sessionStorage.removeItem(storageKey); void journal.save(null).catch(() => {});
    frozen.current = null; setPending(null); setSubmitted(false); setOutcome(null); setCollectionPending(false); setLines([]); setQuote(null); setDiscount("0"); setCustomer(null); setCustomerMode("walk-in"); setAddedMessage(""); setError("");
    setSearch(""); setSearchError(""); setProductResultsSnapshot(null); setCustomerSearch(""); setCustomers([]); setNextCustomer(null); setCustomerLookupEmpty(false);
    requestAnimationFrame(() => scanner.current?.focus());
  }
  async function acceptSale(result: CounterResult, recovered = false) {
    setLastSavedBill(result);
    if (result.pickup) {
      // Persist the completed draft before navigation can unmount this counter.
      // A failed local write retains the original sale reference for read-only recovery.
      await draft.flush({ cart: { lines: [], customerId: null, discount: "0", billNumber: nextBillNumber.current }, held: held.map(packDraft) });
      if (!current()) return;
      setRecentInvoice(result.invoiceId); finishCart(result); onPickupPrepared?.(); return;
    }
    if (result.collection) { setRecentInvoice(result.invoiceId); finishCart(result); return; }
    if (!canCollect && !recovered) { setRecentInvoice(result.invoiceId); finishCart(result); return; }
    if (onAccount && frozen.current?.input.customerId && result.status === "unpaid") { setRecentInvoice(result.invoiceId); finishCart(result); }
    else if (result.totalPaise === 0 && result.status === "paid") { setRecentInvoice(result.invoiceId); finishCart(result); }
    else {
      if (!canCollect && printRequested.current) { setPrintInvoiceId(result.invoiceId); printRequested.current = false; }
      setOutcome(result); setMobilePanel("pay");
    }
  }
  async function issue(retry = false, prepared: CounterIssueInput | null = quote?.issueInput || null) {
    if (!current() || lock.current || outcome || !retry && !prepared) return;
    if (!retry && availability.blocked) { setError("Use the designated offline PC or reconcile its original session before issuing a new bill here."); return; }
    if (!retry) {
      setIssuedPreference({ method: paymentMethod, ...(paymentMethod === "cash" && cashPreview !== null ? { cashTendered: cashPreview } : {}) }); }
    lock.current = true; setBusy(true); setError(""); setCorrectable(false);
    try {
      if (savedKey(storageKey) !== pending) throw new Error("Sale reference changed. Check the saved result before another issue.");
      const key = pending || crypto.randomUUID();
      if (!pending) sessionStorage.setItem(storageKey, key);
      setPending(key);
      const payment = !retry && canCollect && !pickup && !onAccount && prepared && prepared.expectedTotalPaise > 0 ? advancedPayment ? allocatedPayment?.input || null : prepareIssuedCheckoutPayment(locationId, prepared.expectedTotalPaise, { method: paymentMethod, tender: paymentMethod === "cash" ? tenderPreview : "0", referenceNumber: paymentReference.trim(), expectedTotalPaise: prepared.expectedTotalPaise }) : null;
      if (!retry && canCollect && !pickup && !onAccount && prepared!.expectedTotalPaise > 0 && !payment) throw Error("Review the payment amount and actual receipt before saving.");
      const pinned = frozen.current || { key, input: JSON.parse(JSON.stringify({ ...prepared!, ...(creditOverride.trim() ? { creditOverrideReference: creditOverride.trim() } : {}), ...(printRequested.current ? { includeDocument: true } : {}), ...(payment ? { payment } : {}) })) as CounterIssueInput };
      // Both records are required before the request, but they are independent local
      // recovery writes. Persisting them together removes one serial storage wait.
      frozen.current = pinned; setSubmitted(true);
      await Promise.all([
        measurePharmacyStep("draft_write", () => draft.flush(draftValue)),
        measurePharmacyStep("intent_write", () => journal.save(pinned)),
      ]);
      if (!current()) return;
      revision.current++;
      const result = await measurePharmacyStep("save_request", () => issueCounter(pinned.input, pinned.key));
      if (current()) await acceptSale(result);
    } catch (failure) { if (current()) {
      const response = (failure as { response?: { status?: number; data?: { details?: { code?: string } } } })?.response;
      const status = response?.status || 0;
      if (status === 409 && response?.data?.details?.code === "COUNTER_TOTAL_CHANGED") {
        // This explicit response means the transaction rolled back. Ambiguous failures keep the frozen command.
        try {
          if (savedKey(storageKey) !== frozen.current?.key) throw Error("Sale reference changed; check the saved bill.");
          await journal.save(null);
          if (!current()) return;
          sessionStorage.removeItem(storageKey); frozen.current = null; setPending(null); setSubmitted(false); printRequested.current = false;
          setPaymentReference(""); await refreshQuote();
          if (current()) setError("The current total changed. Review the updated amount and payment, then Save again. Nothing has been billed or collected.");
        } catch (failure) { if (current()) setError(message(failure)); }
      } else { setError(message(failure)); setCorrectable([400, 409, 428].includes(status)); if (status === 428) { setDrawerReady(false); setDrawerRevision(value => value + 1); } }
    } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function checkout(print = false) {
    if (!canCheckout || checkoutLock.current) return;
    try {
      const unresolved = pendingCollectionReference(`pharmacy-collection:${referenceOwnerKey(user)}:${locationId}`);
      if (unresolved) { setPriorPayment(unresolved.invoiceId); setError("Resolve the earlier payment before saving another bill. This cart has not been billed."); return; }
    } catch (failure) { setError(message(failure)); return; }
    checkoutLock.current = true; setPreparingBill(true);
    try {
      await measurePharmacyStep("checkout", async () => {
      const shown = payable;
      // Normal local edits need one commit request. Missing prices still require an explicit quote.
      const checked: CounterIssueInput | undefined = quote?.issueInput || (estimate ? { ...intent(), confirmationMode: "current_total", expectedTotalPaise: estimate.totalPaise, ...(customer ? { expectedCustomerRevision: customer.revision } : {}), lines: intent().lines.map(line => ({ ...line, expectedLineTotalPaise: estimate.lines.find(price => price.lineId === line.lineId)!.grossPaise })) } : (await refreshQuote())?.issueInput);
      if (!checked || !current()) return;
      if (shown !== undefined && shown === checked.expectedTotalPaise) { printRequested.current = print; await issue(false, checked); }
      else { setError("The current total changed. Review the updated amount and payment, then Save again. Nothing has been billed or collected."); setPaymentReference(""); }
      });
    } finally { checkoutLock.current = false; if (current()) setPreparingBill(false); }
  }
  async function recover() {
    if (!current() || lock.current || !pending) return;
    // Recovery is read-only; a remembered payment choice must not authorize a new collection.
    lock.current = true; setBusy(true); setError(""); revision.current++;
    try { const result = await recoverCounter(locationId, pending); if (current()) await acceptSale(result, true); }
    catch (failure) { if (current()) setError(message(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  usePharmacyReconnect(network === "offline" || Boolean(pending && !outcome && !correctable), async () => { if (pending && !outcome) await recover(); else if (!outcome && !lock.current) { setNetwork("online"); } });
  function collected(receipt: CollectionReceipt) {
    if (!outcome || receipt.invoiceId !== outcome.invoiceId || !current()) return;
    setRecentInvoice(outcome.invoiceId);
    try { finishCart(outcome); } catch (failure) { setError(message(failure)); }
  }
  function newSale() {
    if (!outcome || busy || collectionPending) return;
    setOnAccount(false); setAdvancedPayment(null); setPaymentMethod("cash"); setCashPreview(null); setMobilePanel("products"); setPaymentReference(""); setDrawerReady(false); printRequested.current = false; setBillNumber(nextBillNumber.current++);
    try { if (savedKey(storageKey) !== outcome.requestKey) throw new Error("Sale reference changed; recover the saved result."); sessionStorage.removeItem(storageKey); void journal.save(null).catch(() => {}); frozen.current = null; setPending(null); setSubmitted(false); setOutcome(null); setLines([]); setPickup(undefined); setCustomer(null); setQuote(null); setDiscount("0"); setCustomerMode("walk-in"); setCustomers([]); setCustomerSearch(""); setAddedMessage(""); setError(""); requestAnimationFrame(() => scanner.current?.focus()); }
    catch (failure) { setError(message(failure)); }
  }
  async function clearCart() {
    if (!editable || pending) return;
    setClearingCart(true);
    try {
      await draft.flush({ cart: { lines: [], customerId: null, discount: "0", billNumber }, held: held.map(packDraft) });
      if (!current()) return;
      setPaymentMethod("cash"); setCashPreview(null); setPaymentReference(""); setOnAccount(false); setAdvancedPayment(null);
      invalidate(); setLines([]); setPickup(undefined); setCustomer(null); setCustomerMode("walk-in"); setDiscount("0");
      setCustomers([]); setCustomerSearch(""); setNextCustomer(null); setCustomerLookupEmpty(false); setEditingLineId(null); setQuoteDetailsOpen(false); setAddedMessage(""); setClearOpen(false);
      requestAnimationFrame(() => scanner.current?.focus());
    } catch (failure) { if (current()) { setError(message(failure)); setClearOpen(false); } }
    finally { if (current()) setClearingCart(false); }
  }
  function hold() { if (!editable || pending || !lines.length) return; if (held.length >= 3) { setError("Three bills are already on hold. Resume and finish one, or close a held bill using its close button, before creating another. Your current bill is unchanged."); return; } setOnAccount(false); setAdvancedPayment(null); setPaymentMethod("cash"); setCashPreview(null); setMobilePanel("products"); setPaymentReference(""); setHeld(previous => [...previous, { lines, customer, discount, billNumber, ...(pickup ? { pickup } : {}) }]); setBillNumber(nextBillNumber.current++); setLines([]); setPickup(undefined); setCustomer(null); setCustomerMode("walk-in"); setDiscount("0"); invalidate(); }
  function resume(index: number) {
    if (!editable || pending) return;
    const cart = held[index]; if (!cart) return; setPaymentReference(""); setOnAccount(false); setAdvancedPayment(null); setPaymentMethod("cash"); setCashPreview(null); setMobilePanel("cart");
    // Switching bills swaps drafts; it never issues an invoice or abandons an active cart.
    setHeld(previous => lines.length ? previous.map((row, n) => n === index ? { lines, customer, discount, billNumber, ...(pickup ? { pickup } : {}) } : row) : previous.filter((_, n) => n !== index));
    setBillNumber(cart.billNumber || index + 2);
    setPickup(cart.pickup); setLines(cart.lines); setCustomer(cart.customer); setCustomerMode(cart.customer ? "recorded" : "walk-in"); setDiscount(cart.discount); invalidate();
  }
  function addPacks(id: string, count: number) {
    if (!editable) return;
    const line = lines.find(row => row.lineId === id);
    if (!line || !/^\d+$/.test(line.packs)) { setError("Enter whole pack quantities first."); return; }
    const next = BigInt(line.packs) + BigInt(count);
    if (next * BigInt(line.product.unitDefinition!.unitsPerPack) > BigInt(Number.MAX_SAFE_INTEGER)) { setError("Pack quantity exceeds supported precision."); return; }
    invalidate(); setLines(previous => previous.map(row => row.lineId === id ? { ...row, packs: String(next) } : row));
  }
  function changeQuantity(id: string, value: string) { if (!editable) return; invalidate(); setLines(previous => previous.map(line => line.lineId === id ? { ...line, packs: "0", loose: value } : line)); }
  const { frequentOnly, displayProducts, visibleProducts } = productResults();
  const selectedProduct = visibleProducts[Math.min(picked, Math.max(0, visibleProducts.length - 1))];
  const payable = quote ? quote.calculation.totals.payablePaise : estimate?.totalPaise ?? (lines.length ? undefined : 0);
  const enteredDiscounts = [discount, ...lines.map(line => line.discount)].map(parseReceiptPaise);
  const discountTotal = quote ? quote.calculation.totals.lineDiscountPaise + quote.calculation.totals.invoiceDiscountPaise : enteredDiscounts.every(value => value !== null) ? enteredDiscounts.reduce<number>((sum, value) => sum + (value || 0), 0) : null;
  const editingLine = lines.find(line => line.lineId === editingLineId);
  const editingPrice = quote?.lines.find(line => line.lineId === editingLineId);
  const pieces = lines.reduce((sum, line) => /^\d+$/.test(line.packs) && /^\d+$/.test(line.loose) ? sum + BigInt(line.packs) * BigInt(line.product.unitDefinition?.unitsPerPack || 1) + BigInt(line.loose) : sum, BigInt(0));
  const tenderPreview = cashPreview ?? (payable === undefined ? "0" : String(payable / 100));
  const tenderPaise = parseReceiptPaise(tenderPreview);
  const changePaise = tenderPaise !== null && payable !== undefined ? tenderPaise - payable : null;
  const cashAmounts = [20, 50, 100, 200, 500, 2000, 5000, 10000].filter(value => payable !== undefined && value * 100 > payable).slice(0, 3);
  const allocatedPayment = advancedPayment && advancedPayment.totalPaise === payable && advancedPayment.customerId === (customer?.id || null) ? prepareCounterCollection({ locationId, paymentRevision: 0, balanceDue: payable / 100, customerSnapshot: { anonymous: !customer } }, advancedPayment.parts, advancedPayment.tender, !customer) : null;
  const allocationChanged = Boolean(advancedPayment && !allocatedPayment);
  const paymentReady = pickup ? true : advancedPayment ? drawerReady && Boolean(allocatedPayment?.input) : !canCollect || onAccount || payable === 0 || payable === undefined || (drawerReady && (paymentMethod === "cash" ? tenderPaise !== null && tenderPaise >= payable : paymentReference.trim().length >= 3));
  const canCheckout = !availability.blocked && paymentReady && editable && !priorPayment && lines.length > 0 && network !== "offline" && !preparingBill && !quoteError && (customerMode !== "recorded" || Boolean(customer)) && (!onAccount || Boolean(customer));
  function showPanel(panel: string, focus = false) {
    setMobilePanel(panel);
    if (focus) requestAnimationFrame(() => panel === "products" ? scanner.current?.focus() : customerPanel.current?.querySelector<HTMLElement>("button, input")?.focus());
  }
  const shortcuts = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    shortcuts.current = event => {
      if (document.querySelector('[role="dialog"], [role="menu"]') || event.metaKey || event.repeat) return;
      if (event.altKey) { if (/^[1-4]$/.test(event.key)) { event.preventDefault(); if (Number(event.key) > 1) resume(Number(event.key) - 2); } return; }
      const action = event.key === "F1" ? () => showPanel("products", true)
        : event.key === "F2" ? () => { if (editable && lines.length) { hold(); showPanel("products", true); } }
        : event.key === "F3" ? () => showPanel("pay", true)
        : event.key === "F4" ? () => { if (editable && lines.length) hold(); }
        : event.key === "F6" ? () => { showPanel("pay"); requestAnimationFrame(() => discountInput.current?.focus()); }
        : event.key === "F8" ? () => { showPanel("pay"); requestAnimationFrame(() => paymentPanel.current?.querySelector<HTMLButtonElement>("button")?.focus()); }
        : event.key === "F10" ? () => { if (canCheckout) void checkout(); }
        : event.ctrlKey && event.key === "Delete" ? () => { if (editable && (lines.length || pickup) && !pending) setClearOpen(true); } : null;
      if (action) { event.preventDefault(); action(); }
    };
  });
  useEffect(() => { const keydown = (event: KeyboardEvent) => shortcuts.current(event); window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown); }, []);
  if (restoring) return <PharmacyCounterSkeleton label="Loading pharmacy" />;
  const syncState = busy || preparingBill ? "Saving" : pending && !outcome ? correctable ? "Needs review" : "Check save result" : network === "offline" ? "Offline draft" : quoteError ? quoteConflict ? "Needs review" : "Price check failed" : error ? "Needs attention" : quote ? "Prices checked" : "Draft";
  return <section className={pos.counter} data-counter-ready data-save-state={busy ? "saving" : preparingBill ? "checking" : undefined} aria-label="Pharmacy counter checkout">
    <PharmacyCounterAvailabilityNotice snapshot={availability.snapshot} error={availability.error} checking={availability.checking} onRefresh={() => { void availability.refresh(); }} />
    <nav aria-label="Open counter bills" className={pos.bills}>
      <div className={pos.billTabs}>
      {toolbarContext && <div className={pos.billLocation}>{toolbarContext}</div>}
      <span className={pos.activeBill}>Bill {billNumber} · {customer ? "Recorded" : "Walk-in"}{payable !== undefined && <strong>{money(payable / 100)}</strong>}<Button size="sm" variant="ghost" className={pos.closeBill} disabled={!editable || (!lines.length && !pickup) || Boolean(pending)} aria-label="Clear current bill" title="Clear current bill" onClick={() => setClearOpen(true)}><X size={12} aria-hidden="true" /></Button></span>
      {held.map((cart, index) => <span className={pos.heldBill} key={index}><Button size="sm" variant="ghost" disabled={!editable || Boolean(pending)} onClick={() => resume(index)} aria-label={`Resume held cart ${index + 1} (${cart.lines.length} products)`}>Bill {cart.billNumber || index + 2} · {cart.customer ? "Recorded" : "Walk-in"}</Button><Button size="sm" variant="ghost" className={pos.closeBill} disabled={!editable || Boolean(pending)} aria-label={`Close held bill ${index + 1}`} onClick={() => setClosingHeld(index)}><X size={12} aria-hidden="true" /></Button></span>)}
      </div>
      <Button size="sm" variant="primary" className={pos.newBill} aria-label="New bill" title={held.length >= 3 ? "Three bills on hold: finish or close one to create another" : !lines.length ? "Current bill is already empty" : "New bill (F2)"} disabled={!editable || Boolean(pending) || !lines.length} onClick={() => { hold(); showPanel("products", true); }}><Plus size={18} aria-hidden="true" /><span className={pos.newBillLabel}>New bill <kbd>F2</kbd></span></Button>
      <Button size="sm" variant="ghost" className={pos.holdButton} aria-label="Hold cart" disabled={!editable || !lines.length || Boolean(pending)} onClick={hold}>Hold <kbd>F4</kbd></Button>
      {!compact && <span className={pos.counterLabel}>Counter sale</span>}
      <div role="status" aria-label="Bill save status" className={pos.billStatus}><span className={syncState === "Draft" ? "sr-only" : undefined}><Badge variant={["Needs review", "Needs attention", "Price check failed", "Check save result", "Offline draft"].includes(syncState) ? "warning" : "neutral"}>{syncState}</Badge></span>{network === "offline" && <a href="/pharmacy-offline.html" aria-label="Offline preparation">Open offline counter</a>}{toolbarActions}</div>
    </nav>
    {pickupLoadFailed && <Button size="sm" disabled={pickupLoading} onClick={() => setPickupLoadRetry(value => value + 1)}>Retry loading requested parcel</Button>}
    {pickupLoading && <p role="status">Loading requested parcel products...</p>}
    {pickup && <Alert variant="info" title="Preparing pickup parcel">The requested items will be billed once and linked to the parcel. Save does not record a payment.</Alert>}
    {network === "offline" && <Alert variant="warning" title="Working offline">Cached products and estimates remain available. Reconnect to validate and issue bills.<Button size="sm" variant="outline" disabled={busy || quoting} onClick={() => { if (pending) void recover(); else void refreshQuote(); }}>Retry connection</Button></Alert>}
    {error && (!pending || outcome) && <Alert variant="error" title="Counter needs attention">{error}</Alert>}
    {draft.error && <Alert variant="warning" title="Saved cart needs attention">{draft.error}<Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload saved draft</Button></Alert>}
    {pending && !outcome && !busy && <Alert variant="warning" title={correctable ? "Save needs review" : "Pending sale"}>{error && <p className="mb-2">{error}</p>}<p>Check whether this sale was saved before submitting it again. Original bill details are restored when available. Keep this reference and check the saved result before retrying.</p><p className="mt-2 break-all text-xs">Reference: {pending}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => { void recover(); }}>Check sale result</Button>{submitted && !correctable && <Button size="sm" disabled={busy} onClick={() => { void issue(true); }}>Retry same sale</Button>}{correctable && <Button size="sm" disabled={busy} variant="outline" onClick={() => { frozen.current = null; setSubmitted(false); setCorrectable(false); invalidate(); }}>Review rejected sale</Button>}</div></Alert>}
    <>
      <div className={pos.panels} data-mobile-panel={mobilePanel}>
        <section className={pos.products} aria-label="Counter products">
          <Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}>
            <div className={pos.productTools}>
              <form onSubmit={event => { event.preventDefault(); if (!editable) return; if (!exactLookup && selectedProduct?.eligible && selectedProduct.unitDefinition) add(selectedProduct); else void lookup(exactLookup || /^(?=.*\d)[A-Z0-9-]{6,}$/.test(search.trim())); }}>
                <div className={pos.search}>
                  <Input ref={scanner} disabled={!editable} aria-label="Scan barcode or search products" icon={<Barcode size={16} aria-hidden="true" />} iconRight={<Button type="button" variant="ghost" size="xs" aria-label="Search products" disabled={!editable} loading={searching} onClick={() => { setProductResultsSnapshot(null); void lookup(exactLookup, undefined, true, true); }}><Search size={15} aria-hidden="true" /></Button>} placeholder="Scan barcode or type medicine" title="F1 to search · Scan and press Enter to add" size="lg" containerClassName="min-w-0 flex-1" value={search} maxLength={100} onChange={event => { beginLookup(); lookupFlight.current = null; setSearching(false); setPicked(0); setKeyboardPicking(false); setAddedMessage(""); setProductResultsSnapshot(null); setSearch(event.target.value); const local = catalogue.find(event.target.value, /^\d+$/.test(event.target.value.trim())); setProducts(local.items); setNextProduct(local.nextCursor); setSearchError(""); setProductLookupDone(Boolean(local.items.length)); }} onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key) && visibleProducts.length) { event.preventDefault(); setKeyboardPicking(true); setPicked(value => (value + (event.key === "ArrowDown" ? 1 : -1) + visibleProducts.length) % visibleProducts.length); } }} />
                  <PharmacyCounterFilters value={productFilter} disabled={!editable} onChange={value => { setProductResultsSnapshot(null); setProductFilter(value); setPicked(0); setKeyboardPicking(false); }} />
                </div>
              </form>
              <p role="status" className="sr-only">{searching ? "Finding products..." : addedMessage}</p>
            </div>
            <div className={pos.productResults} aria-busy={searching} role="region" aria-label="Available products" tabIndex={0} onPointerDown={() => setKeyboardPicking(false)}>
              {searchError && <Alert variant="error" title="Lookup needs attention">{searchError}</Alert>}
              {productLookupDone && !displayProducts.length && !searching && !searchError && !frequentOnly && <EmptyState title={search.trim() ? "No products found" : "No products at this branch"} description="Try another name or check this branch's inventory." className="py-5" />}
              {!displayProducts.length && !productLookupDone && !searching && !frequentOnly && <EmptyState icon={<Search aria-hidden="true" />} title="Find a medicine" description="Type a name, scan a barcode or browse branch products." className="py-5" />}
              {frequentOnly && !displayProducts.length && !searching && <p className={pos.hint}>Products you add often appear here. Clear filters to browse all products.</p>}
              {displayProducts.length > 0 && !visibleProducts.length && <p className={pos.hint}>{productFilter.includes("frequent") ? "Products you add often appear here. Clear filters to browse all products." : "No products match these types. Clear filters or search again."}</p>}
              {visibleProducts.map((product, index) => { const snapshot = catalogue.price(product.id), observedRate = snapshot && snapshot.quantity > 0 ? snapshot.grossPaise / snapshot.quantity : null, cachedRate = observedRate ?? (Number.isSafeInteger(product.retailPricePaise) && product.retailPricePaise! >= 0 ? product.retailPricePaise! : null); return <article key={product.id} className={pos.product} data-picked={keyboardPicking && index === picked} data-added={addedProduct?.id === product.id || undefined}>
                {addedProduct?.id === product.id && <span key={addedProduct.sequence} className={pos.addedFeedback} aria-hidden="true" />}
                {product.eligible && !product.saleBlocked && product.unitDefinition ? <Button variant="ghost" disabled={!editable || inventoryMode === "tracked" && product.stockQuantity === 0} className={pos.productPick} aria-label={`Add ${productLabel(product)}`} onClick={event => add(product, event.detail === 0 || Boolean(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches))}><span className={pos.productBody}>
                  <span className={pos.productHeading}><strong>{product.name}{product.strength && !product.name.toLowerCase().includes(product.strength.toLowerCase()) && <span className={pos.strength}> {product.strength}</span>}</strong><strong className={pos.productRate} title={observedRate === null ? "Catalogue retail price; batch price is checked at billing" : "Last checked unit price; revalidated when saving"}>{cachedRate === null ? "—" : money(cachedRate / 100)}</strong></span>
                  <span className={pos.productMeta}><span title={[product.rackLocation ? `Rack ${product.rackLocation}` : "", product.manufacturer, snapshot?.batches[0] ? `Batch ${snapshot.batches[0].batchNumber} · Exp ${snapshot.batches[0].expiryValue}` : "Batch checked at billing", inventoryMode === "billing_only" ? "Stock not tracked" : `${product.stockQuantity} ${product.unitDefinition.baseUnit} in stock (snapshot)`].filter(Boolean).join(" · ")}>{product.rackLocation && <>Rack {product.rackLocation} · </>}{inventoryMode === "billing_only" ? "Stock not tracked" : product.stockQuantity === 0 ? "Out of stock" : `${product.stockQuantity} in stock`}{product.manufacturer && <> · {product.manufacturer}</>}{snapshot?.batches[0] && <> · {snapshot.batches[0].batchNumber} · {snapshot.batches[0].expiryValue}</>}</span><span>{cachedRate === null ? "Price at billing" : `/${product.unitDefinition.baseUnit}`} · {product.unitDefinition.packUnit} {product.unitDefinition.unitsPerPack}</span></span>
                </span></Button>
                : <div className={pos.blocked}><strong>{product.name}</strong>{product.saleBlocked ? <><p>{product.saleBlockReason || "This product is on a sale hold."} Ask your administrator to review Product / batch sale holds in Inventory.</p><Badge variant="warning">Sale hold</Badge></> : <><p>{!product.unitDefinition ? "Product units must be configured in Inventory." : "A sale classification review or authorized supply workflow is required."}{!canReview && " Ask your organization administrator to review this product."}</p>{canReview ? <Button size="sm" variant="outline" disabled={!editable} aria-label={`Review product ${product.name}`} onClick={() => reviewProduct(product.id)}>Review product</Button> : <Badge variant="warning">Product review required</Badge>}</>}</div>}
              </article>; })}
              {!search.trim() && !searching && <Button variant="ghost" size="sm" fullWidth aria-label="Browse branch products" disabled={!editable} onClick={() => { void lookup(false, undefined, false, true); }}>Refresh products</Button>}
              {canManageCatalog && <Button variant="outline" size="sm" fullWidth disabled={!editable || network !== "online"} onClick={() => { invalidate(); setCatalogueOpen(true); }}>Find in shared catalogue</Button>}
              {canManageCatalog && onCreateLocal && <Button variant="ghost" size="sm" fullWidth disabled={!editable || network !== "online"} onClick={() => { invalidate(); onCreateLocal(search.trim()); }}>Add custom product</Button>}
              {nextProduct && (!productFilter.includes("frequent") || search.trim()) && <Button size="sm" variant="outline" fullWidth disabled={!editable || searching} onClick={() => { void lookup(false, nextProduct); }}>Next product page</Button>}
            </div>

          </Card>
        </section>
        <section aria-label="Counter cart" className={pos.cart}>
          <Card padding="none" className={pos.panel} contentClassName={pos.panelContent}>
            <div className={pos.cartHeader}><div><CardTitle>Bill {billNumber}</CardTitle><p>{lines.length} {lines.length === 1 ? "product" : "products"} · {String(pieces)} units</p></div><div className={pos.cartHeaderActions}><Button size="sm" variant="ghost" disabled={!lines.length || quoting || !editable} aria-label="Refresh prices" title="Refresh prices" onClick={() => { void refreshQuote(); }}><RotateCw size={15} aria-hidden="true" /></Button><Button size="sm" variant="ghost" disabled={!quote} aria-label="Batch and tax details" title="Batch and tax details" onClick={() => setQuoteDetailsOpen(true)}><FileText size={15} aria-hidden="true" /></Button>{(lines.length > 0 || pickup) && <Button size="sm" variant="outline" disabled={!editable || Boolean(pending)} aria-label="Clear cart" onClick={() => setClearOpen(true)}>Clear <kbd>Ctrl+Del</kbd></Button>}</div></div>
            <div className={pos.columnHead} aria-hidden="true"><span>#</span><span>Product</span><span>Quantity</span><span>Rate</span><span>GST</span><span>Amount</span><span /></div>
            <div className={pos.cartLines} role="region" aria-label="Bill product list" tabIndex={0}><fieldset disabled={!editable} className={pos.cartFields} aria-label="Products and cart">
              {!lines.length && <EmptyState icon={<ShoppingBasket aria-hidden="true" />} title="Your cart is empty" description="Scan or select a medicine to begin." className={pos.emptyCart} />}
              {lines.map((line, index) => { const priced = quote?.lines.find(row => row.lineId === line.lineId), calculated = quote?.calculation.lines.find(row => row.lineId === line.lineId), estimated = estimate?.lines.find(row => row.lineId === line.lineId), gstRate = calculated?.gstRateBps ?? catalogue.price(line.product.id)?.gstRateBps, total = /^\d+$/.test(line.packs) && /^\d+$/.test(line.loose) ? String(BigInt(line.packs) * BigInt(line.product.unitDefinition!.unitsPerPack) + BigInt(line.loose)) : line.loose; return <fieldset className={pos.cartLine} data-added={addedProduct?.id === line.product.id || undefined} key={line.lineId} aria-label={`Cart ${productLabel(line.product)}`}>
                <span className={pos.lineNumber} aria-label="Item number">{index + 1}</span>
                <div className={pos.lineIdentity}><strong>{line.product.name}{line.product.strength && !line.product.name.toLowerCase().includes(line.product.strength.toLowerCase()) && <span className={pos.strength}> {line.product.strength}</span>}</strong><small className={pos.lineBatch} title={[line.product.rackLocation ? `Rack ${line.product.rackLocation}` : "", line.product.manufacturer, priced?.batches.map(lot => `Batch ${lot.batchNumber} · Exp ${lot.expiryValue}`).join("; ")].filter(Boolean).join(" · ")}>{line.product.rackLocation && <>Rack {line.product.rackLocation} · </>}{line.product.manufacturer && <>{line.product.manufacturer} · </>}{priced ? <>Batch {priced.batches[0]?.batchNumber} · Exp {priced.batches[0]?.expiryValue}{priced.batches.length > 1 ? ` · +${priced.batches.length - 1} more` : ""}</> : packDescription(line.product.unitDefinition!)}</small></div>
                <div className={pos.quantity}>
                  <QuantityInput variant="compact" ref={element => { if (element) quantityInputs.current.set(line.lineId, element); else quantityInputs.current.delete(line.lineId); }} label={`Quantity ${productLabel(line.product)}`} decreaseLabel={`Decrease quantity ${productLabel(line.product)}`} increaseLabel={`Increase quantity ${productLabel(line.product)}`} min={1} value={total} disabled={!editable || Boolean(pickup)} onValueChange={value => changeQuantity(line.lineId, value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); showPanel("products", true); } }} />
                <div className={pos.units}><span>{line.product.unitDefinition?.baseUnit}</span><Button size="sm" variant="ghost" onClick={() => addPacks(line.lineId, 1)}>+1 {line.product.unitDefinition?.packUnit} ({line.product.unitDefinition?.unitsPerPack})</Button>{line.product.unitDefinition?.outerPackUnit && <Button size="sm" variant="ghost" onClick={() => addPacks(line.lineId, line.product.unitDefinition!.packsPerOuter!)}>+1 {line.product.unitDefinition.outerPackUnit} ({line.product.unitDefinition.packsPerOuter! * line.product.unitDefinition.unitsPerPack})</Button>}</div></div>
                <div className={pos.linePrice} aria-label={`Pricing ${productLabel(line.product)}`}>
                  <div className={pos.unitRate}><span className="sr-only">Rate </span>{priced ? [...new Set(priced.batches.map(lot => lot.sellingPricePaise))].map(price => <small key={price}>{money(price / 100)}<span className={pos.priceUnit}> per {priced.unitSnapshot.baseUnit}</span></small>) : <small>{estimated ? <>{money(estimated.unitPaise / 100)}<span className={pos.priceUnit}> per {line.product.unitDefinition?.baseUnit}</span></> : network === "offline" ? "Price not cached" : "Calculating..."}</small>}</div>
                  <span className={pos.lineGst} title={quote ? "GST rate from the current quote" : "Last captured rate; checked at billing"}><span className="sr-only">GST </span>{gstRate === undefined ? "—" : `${gstRate / 100}%`}</span>
                  <strong className={pos.lineAmount}><span className="sr-only">Line total </span><span>{calculated ? money(calculated.grossAmountPaise / 100) : estimated ? money(estimated.grossPaise / 100) : "—"}</span></strong>
                </div>
                <div className={pos.lineActions}><Button size="sm" variant="ghost" className={pos.remove} disabled={!editable} aria-label={`Edit item ${productLabel(line.product)}`} title="Pack quantities and line discount" onClick={() => setEditingLineId(line.lineId)}><SlidersHorizontal size={14} aria-hidden="true" /></Button><Button size="sm" variant="ghost" className={pos.remove} disabled={!editable} onClick={() => { if (pickup && lines.length === 1) { void clearCart(); return; } invalidate(); setLines(previous => previous.filter(row => row.lineId !== line.lineId)); }} aria-label={`Remove ${productLabel(line.product)}`}><X size={16} aria-hidden="true" /></Button></div>

              </fieldset>; })}
            </fieldset></div>
            <dl className={pos.cartSummary} aria-label="Bill summary"><div><dt>Products</dt><dd>{lines.length}</dd></div><div><dt>Units</dt><dd>{String(pieces)}</dd></div><div><dt>GST</dt><dd>{quote ? money((quote.calculation.totals.cgstPaise + quote.calculation.totals.sgstPaise) / 100) : lines.length ? "At billing" : money(0)}</dd></div><div><dt>Discount</dt><dd>{discountTotal === null ? "—" : money(discountTotal / 100)}</dd></div><div><dt>Payable</dt><dd>{payable === undefined ? lines.length ? "—" : money(0) : money(payable / 100)}</dd></div></dl>
            <PharmacyCounterRecentBills state={overview} onOpen={setViewRecentInvoice} latest={lastSavedBill?.invoiceId === recentInvoice ? lastSavedBill : null} onHistory={onViewHistory} />
            <p role="status" className={pos.draftStatus}>{draft.status}</p>
          </Card>
        </section>
        <aside ref={customerPanel} className={pos.checkout} aria-label="Customer and billing">
          <Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}>
            {outcome ? <div className={pos.settlement}><p className="text-sm font-semibold">Bill {outcome.invoiceNumber} saved</p><PharmacyCollections key={`${outcome.invoiceId}:${collectionVersion}`} locationId={locationId} canCollect={canCollect} canOpenTill={canOpenTill} initialInvoiceId={outcome.invoiceId} checkoutOnly embeddedCheckout autoAcknowledge issuedTotalPaise={outcome.totalPaise} preference={issuedPreference} onCollected={collected} onPendingChange={setCollectionPending} /><Button size="sm" variant="outline" disabled={busy || collectionPending} onClick={newSale}>Start a separate sale</Button><Button size="sm" variant="ghost" disabled={collectionPending} onClick={() => { setCollectionVersion(value => value + 1); }}>Review saved payment</Button></div> : <>
            <CardTitle className={pos.sectionLabel}>Customer</CardTitle>
            <fieldset disabled={!editable} className={pos.customerFields} aria-label="Customer and quote">
              <div className={pos.customerScroll}>
            <Tabs variant="pills" activeTab={customerMode} scrollActiveIntoView={false} onChange={mode => { setOnAccount(false); beginCustomer(); setCustomerMode(mode); invalidate(); setCustomer(null); setCustomers([]); setNextCustomer(null); setCustomerLookupEmpty(false); setCustomerError(""); setCustomerLoading(false); }} tabs={[{ id: "walk-in", label: "Walk-in" }, { id: "recorded", label: "Recorded", disabled: Boolean(pickup) }]} />
            <p className={`${pos.customerHint} text-xs leading-relaxed text-text-secondary`}>{customerMode === "walk-in" ? "Paid in full at the counter." : "Link this bill to an existing customer. Choose Credit to leave the balance due."}</p>
            {customer && hasAnyPermission(user, "MANAGE_ORGANIZATION") && <details><summary className="text-xs">Owner credit exception</summary><Input label="Owner credit-policy override reference (optional)" value={creditOverride} minLength={3} maxLength={200} onChange={event => setCreditOverride(event.target.value)} hint="Use only after reviewing customer credit. The exception and your identity are audited." /></details>}
            {customer && <div className="rounded-xl bg-surface-alt p-3"><p className="break-words text-sm font-medium">{quote?.customer?.name || customer.name}</p><p className="mt-1 text-xs text-text-secondary">{customer.address}{customer.phone && <> · {customer.phone}</>}</p>{hasAnyPermission(user, "PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT", "MANAGE_ORGANIZATION") && <Button size="sm" variant="ghost" onClick={() => setHistoryCustomer(quote?.customer || customer)}>Customer history</Button>}<Button size="sm" variant="ghost" className="mt-2" onClick={() => { invalidate(); setCustomer(null); }}>Change customer</Button></div>}
            {customerMode === "recorded" && !customer && <form onSubmit={event => { event.preventDefault(); void lookupCustomer(); }} className={pos.customerLookup}><Input containerClassName={pos.customerLookupInput} aria-label="Find recorded customer" placeholder="Search by name or phone" value={customerSearch} maxLength={100} onChange={event => { beginCustomer(); setCustomerSearch(event.target.value); setCustomers([]); setNextCustomer(null); setCustomerLookupEmpty(false); setCustomerError(""); setCustomerLoading(false); }} /><Button size="sm" type="submit" variant="outline" aria-label="Search customers" title="Search customers" loading={customerLoading}><Search size={16} aria-hidden="true" /></Button>{hasAnyPermission(user, "PHARMACY_MANAGE_CUSTOMERS", "MANAGE_ORGANIZATION") && <Button size="sm" variant="outline" aria-label="Add customer" title="Add customer" disabled={!editable} onClick={() => setAddingCustomer(true)}><Plus size={16} aria-hidden="true" /></Button>}</form>}

            {customer && hasAnyPermission(user, "PHARMACY_MANAGE_CUSTOMERS", "MANAGE_ORGANIZATION") && <Button size="sm" variant="outline" onClick={() => setReminderCustomer(customer.id)}>Customer reminders</Button>}
            {customerError && <p role="alert" className="text-xs text-error">{customerError}</p>}
            {customers.map(row => <article className="space-y-2 rounded-xl border border-border p-3" key={row.id}><div className="break-words"><strong className="text-sm">{row.name}</strong><p className="mt-1 text-xs text-text-secondary">{row.address}{row.phone && <> · {row.phone}</>}</p></div><Button size="sm" variant="outline" fullWidth onClick={() => { beginCustomer(); invalidate(); setCustomer(row); setCustomers([]); setCustomerError(""); setCustomerLoading(false); }}>Select customer {row.name}</Button></article>)}
            {customerLookupEmpty && !customers.length && !customer && <p role="status" className="text-xs leading-relaxed text-text-secondary">No matching customers found. You can continue as a walk-in customer.</p>}
            {nextCustomer && <Button size="sm" variant="outline" fullWidth onClick={() => { void lookupCustomer(nextCustomer); }}>Next customer page</Button>}
            <Input ref={discountInput} containerClassName={pos.inlineMoney} aria-label="Invoice discount (INR)" label="Discount" prefix="₹" title="Invoice discount in rupees · F6" size="sm" type="number" min="0" step="0.01" value={discount} onChange={event => { invalidate(); setDiscount(event.target.value); }} />
            {customer && quote?.customer?.id === customer.id && Number.isSafeInteger(quote.customer.memberDiscountBps) && quote.customer.memberDiscountBps! > 0 && quote.customer.memberDiscountBps! <= 10000 && <Button size="sm" variant="outline" disabled={!editable || !quote} onClick={() => {
              if (!quote || !editable || !quote.customer?.memberDiscountBps) return;
              const base = BigInt(quote.calculation.totals.payablePaise) - BigInt(quote.calculation.totals.roundOffPaise) + BigInt(quote.calculation.totals.invoiceDiscountPaise);
              const paise = (base * BigInt(quote.customer.memberDiscountBps) + BigInt(5000)) / BigInt(10000);
              invalidate(); setDiscount(`${paise / BigInt(100)}.${String(paise % BigInt(100)).padStart(2, "0")}`);
            }}>Apply {quote.customer.memberDiscountBps! / 100}% member discount</Button>}

              {pickup ? <p className={pos.accountNote}>This saves an unpaid parcel bill and marks the request ready. Collect the actual payment at handover.</p> : canCollect ? <div className={pos.paymentPreview} ref={paymentPanel}>
                <h3 className="text-xs font-medium">Payment <kbd>F8</kbd></h3>
                <div className={pos.paymentMethods} role="group" aria-label="Preferred payment method">{(["cash", "upi", "card"] as const).map(method => <Button key={method} size="sm" variant={!advancedPayment && !onAccount && paymentMethod === method ? "primary" : "outline"} aria-pressed={!advancedPayment && !onAccount && paymentMethod === method} onClick={() => { setOnAccount(false); setAdvancedPayment(null); setPaymentMethod(method); setCashPreview(null); setPaymentReference(""); }}>{method === "cash" ? "Cash" : method === "upi" ? "UPI" : "Card"}</Button>)}<Button size="sm" variant={onAccount ? "primary" : "outline"} aria-pressed={onAccount} disabled={!customer} title={customer ? "Save this bill as an unpaid amount on the customer account" : "Select a recorded customer to use Credit"} onClick={() => setOnAccount(true)}>Credit</Button></div>
                {!advancedPayment && !onAccount && paymentMethod === "cash" && <><div className={pos.cashCards}><Input containerClassName={pos.receivedCard} aria-label="Cash received (INR)" label="Received" title="Cash actually received; extra cash is returned as change" size="sm" type="number" min="0" step="0.01" value={tenderPreview} onChange={event => setCashPreview(event.target.value)} /><dl className={pos.change} data-short={changePaise !== null && changePaise < 0 || undefined}><dt>{changePaise !== null && changePaise < 0 ? "Still to receive" : "Change to return"}</dt><dd>{changePaise === null ? "—" : money(Math.abs(changePaise) / 100)}</dd></dl></div><div className={pos.cashChips}><Button size="sm" variant="outline" aria-pressed={payable !== undefined && tenderPaise === payable} disabled={payable === undefined} onClick={() => setCashPreview(null)}><span>Exact{payable !== undefined && <small>{money(payable / 100)}</small>}</span></Button>{cashAmounts.map(value => <Button key={value} size="sm" variant="outline" aria-pressed={tenderPaise === value * 100} onClick={() => setCashPreview(String(value))}>{money(value)}</Button>)}</div></>}
                {!advancedPayment && !onAccount && paymentMethod !== "cash" && <Input label="Payment reference" aria-label="Verified payment reference" size="sm" required minLength={3} maxLength={200} value={paymentReference} onChange={event => setPaymentReference(event.target.value)} hint={`Verify ${paymentMethod === "upi" ? "UPI receipt" : "card approval"} before saving ${payable === undefined ? "" : money(payable / 100)}.`} />}
                {!onAccount && lines.length > 0 && payable !== 0 && <PharmacyDrawerGate key={drawerRevision} quietReady compact locationId={locationId} canOpen={canOpenTill} onReady={setDrawerReady} />}
                <Button size="sm" variant={advancedPayment ? "primary" : "outline"} disabled={!editable || payable === undefined || payable <= 0} onClick={() => setPaymentEditor(true)}>Split / part payment</Button>
                {advancedPayment && <p role="status" className={pos.accountNote}>{allocationChanged ? "Bill total or customer changed. Review the split payment before saving." : allocatedPayment?.problem || `${money((allocatedPayment?.total || 0) / 100)} received ? ${money((allocatedPayment?.remaining || 0) / 100)} due${allocatedPayment?.change ? ` ? Change ${money(allocatedPayment.change / 100)}` : ""}`}</p>}
                {onAccount && <p className={pos.accountNote}>This bill will remain due on {customer?.name || "the customer"}&apos;s account. No payment is recorded.</p>}

              </div> : <div className={pos.paymentNote}><strong>Bill only</strong><p>An authorized cashier can collect this bill from Sales & collections.</p></div>}
              </div>
              <div className={pos.checkoutBottom}>
            <p role="status" className="sr-only">{pricing && !estimate && network !== "offline" ? "Checking current prices and tax..." : estimate && !quote ? "Estimated prices · checked again at billing" : ""}</p>
            {quoteError && network !== "offline" && <Alert variant="error" title="Prices could not be calculated">{quoteError}{canReview && <p className="mt-2">If setup needs attention, check the product and batches in Inventory.</p>}<div className="mt-3"><Button size="sm" variant="outline" loading={quoting} onClick={() => { void refreshQuote(); }}>Retry prices</Button></div></Alert>}
            <dl className={pos.totals} aria-label="Checkout totals">
              <div className="flex justify-between gap-3"><dt className="text-text-secondary">Taxable value</dt><dd className="tabular-nums">{quote ? money(quote.calculation.totals.baseAmountPaise / 100) : estimate ? "Checked at billing" : lines.length ? "—" : money(0)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-text-secondary">GST</dt><dd className="tabular-nums">{quote ? money((quote.calculation.totals.cgstPaise + quote.calculation.totals.sgstPaise) / 100) : estimate ? "Included in price" : lines.length ? "—" : money(0)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-text-secondary">Discount</dt><dd className="tabular-nums">{discountTotal === null ? "—" : `−${money(discountTotal / 100)}`}</dd></div>
              <div className="flex justify-between gap-3 border-t border-dashed border-border pt-3 text-xl font-semibold"><dt>Total</dt><dd className="tabular-nums" aria-label="Bill total">{quote ? money(quote.calculation.totals.payablePaise / 100) : estimate ? money(estimate.totalPaise / 100) : lines.length ? "—" : money(0)}</dd></div>
            </dl>
            <div className="grid gap-2"><div className={pos.saveActions}><Button fullWidth aria-label="Save counter bill" title={inventoryMode === "billing_only" ? "Check current catalogue prices and supply details, save the bill and record the confirmed payment" : "Check current prices and stock, save the bill and record the confirmed payment"} loading={busy || preparingBill} disabled={!canCheckout} onClick={() => { void checkout(); }}>{busy ? "Saving..." : preparingBill ? "Checking..." : pickup ? "Save parcel bill" : canCollect && !onAccount && payable !== 0 ? "Confirm" : "Save bill"} <kbd>F10</kbd></Button><Button fullWidth variant="outline" aria-label="Save and print counter bill" disabled={!canCheckout} onClick={() => { void checkout(true); }} title="Save this bill and print it; confirms payment when collected">Print</Button></div>{busy || preparingBill ? <PharmacyCounterSaveStatus key={busy ? "saving" : "checking"} phase={busy ? "saving" : "checking"} inventoryMode={inventoryMode} paid={!pickup && canCollect && !onAccount && payable !== 0} /> : !pickup && canCollect && !onAccount ? null : <p className={pos.saveStatus}>{pickup ? "Save prepares the parcel; payment is collected at handover." : inventoryMode === "billing_only" ? "Prices and supply details are checked at Save." : "Prices and stock are checked at Save."}</p>}</div>

              </div>
            </fieldset>
        {quote && <section aria-label="Trusted counter quote" className="sr-only">Current prices and tax have been checked.</section>}
            </>}
          </Card>
        </aside>
      </div>
      <nav className={pos.mobileNav} data-history={Boolean(onViewHistory) || undefined} aria-label="Counter workspace panels">{onViewHistory && <Button variant="ghost" aria-label="Open bill history" title="Bill history" onClick={onViewHistory}><History size={18} aria-hidden="true" /></Button>}<Button variant={mobilePanel === "products" ? "outline" : "ghost"} aria-pressed={mobilePanel === "products"} onClick={() => showPanel("products")}>Products</Button><Button variant={mobilePanel === "cart" ? "outline" : "ghost"} aria-pressed={mobilePanel === "cart"} onClick={() => showPanel("cart")}>Cart ({lines.length})</Button><Button variant={mobilePanel === "pay" ? "outline" : "primary"} aria-pressed={mobilePanel === "pay"} onClick={() => showPanel("pay")}>Pay {payable === undefined ? "" : money(payable / 100)}</Button></nav>
      <footer className={pos.shortcutBar} aria-label="Counter keyboard shortcuts"><span><kbd>F1</kbd> Search</span><span><kbd>F2</kbd> New bill</span><span><kbd>F3</kbd> Customer</span><span><kbd>F4</kbd> Hold</span><span><kbd>F6</kbd> Discount</span><span><kbd>F8</kbd> Payment</span><span><kbd>F10</kbd> Save</span><span><kbd>↑</kbd><kbd>↓</kbd> Pick</span><span><kbd>Enter</kbd> Add</span><span><kbd>Alt+1–4</kbd> Switch bill</span></footer>
    </>
    {printInvoiceId && <PharmacySavedBillPrint key={printInvoiceId} invoiceId={printInvoiceId} locationId={locationId} savedDocument={printDocument} onClose={() => setPrintInvoiceId(null)} />}
    {historyCustomer && <PharmacyCounterCustomerHistory key={historyCustomer.id} customer={historyCustomer} locationId={locationId} onClose={() => setHistoryCustomer(null)} />}
    {paymentEditor && payable !== undefined && <PharmacyCounterPaymentEditor locationId={locationId} totalPaise={payable} customerId={customer?.id || null} initial={advancedPayment} onClose={() => setPaymentEditor(false)} onApply={value => { setAdvancedPayment(value); setOnAccount(false); setPaymentEditor(false); }} />}
    {addingCustomer && <PharmacyCounterCustomerForm locationId={locationId} onClose={() => setAddingCustomer(false)} onSelected={value => { invalidate(); setCustomer(value); setCustomerMode("recorded"); setAddingCustomer(false); setCustomers([]); }} />}
    {editingLine && <Modal open title="Edit item" description={editingLine.product.name} onClose={() => setEditingLineId(null)} size="md" footer={<Button size="sm" onClick={() => { setEditingLineId(null); requestAnimationFrame(() => scanner.current?.focus()); }}>Done</Button>}><fieldset disabled={!editable || Boolean(pickup)} className={pos.itemEditor}><p>{packDescription(editingLine.product.unitDefinition!)}</p><div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
                  <PharmacyPackQuantity ariaLabel={`Packs ${editingLine.product.name}`} label="Full packs" unit={editingLine.product.unitDefinition!} value={editingLine.packs} onChange={value => { invalidate(); setLines(previous => previous.map(row => row.lineId === editingLine.lineId ? { ...row, packs: value } : row)); }} onError={setError} />
                  <Input aria-label={`Loose units ${editingLine.product.name}`} label="Loose units" type="number" min="0" step="1" value={editingLine.loose} onChange={event => { invalidate(); setLines(previous => previous.map(row => row.lineId === editingLine.lineId ? { ...row, loose: event.target.value } : row)); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); setEditingLineId(null); showPanel("products", true); } }} />
                  <Input containerClassName="col-span-2 sm:col-span-1" aria-label={`Discount ${editingLine.product.name} (INR)`} label="Discount (INR)" type="number" min="0" step="0.01" value={editingLine.discount} onChange={event => { invalidate(); setLines(previous => previous.map(row => row.lineId === editingLine.lineId ? { ...row, discount: event.target.value } : row)); }} />
                </div>{editingPrice && <p className={pos.batchDetails}>{editingPrice.batches.map(lot => `Batch ${lot.batchNumber} · Exp ${lot.expiryValue} · ${lot.quantity} ${editingPrice.unitSnapshot.baseUnit}`).join("; ")}</p>}</fieldset></Modal>}
    {quoteDetailsOpen && quote && <Modal open title="Batch and tax details" size="lg" onClose={() => setQuoteDetailsOpen(false)}><Card contentClassName="gap-4">
          <CardDescription className="my-3">{quote.customer?.name || "Walk-in customer"}. {inventoryMode === "billing_only" ? "Prices and supply details are checked again when issuing the bill. Stock is not tracked." : "Prices are current; stock is checked again when issuing the bill."}</CardDescription>
          <div className="space-y-3">{quote.lines.map(line => <article key={line.lineId} className="space-y-1 break-words border-b border-border pb-3"><strong className="text-sm">{line.description} · {line.quantity} {line.unitSnapshot.baseUnit}</strong>{line.batches.map((lot, index) => <p key={index} className="text-xs leading-relaxed text-text-secondary">Batch {lot.batchNumber} · {lot.quantity} · Expiry {lot.expiryValue} · Unit price {money(lot.sellingPricePaise / 100)} · MRP {money(lot.mrpPaise / 100)}</p>)}</article>)}</div>
          <dl className="space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-text-secondary">Taxable value</dt><dd>{money(quote.calculation.totals.baseAmountPaise / 100)}</dd></div><div className="flex justify-between gap-3"><dt className="text-text-secondary">CGST</dt><dd>{money(quote.calculation.totals.cgstPaise / 100)}</dd></div><div className="flex justify-between gap-3"><dt className="text-text-secondary">SGST</dt><dd>{money(quote.calculation.totals.sgstPaise / 100)}</dd></div><div className="flex justify-between gap-3 border-t border-border pt-3 text-lg font-semibold"><dt>Total</dt><dd>{money(quote.calculation.totals.payablePaise / 100)}</dd></div></dl>
        </Card></Modal>}
    <ConfirmDialog open={closingHeld !== null} title="Close held bill?" description="Remove this held draft? The current bill will stay saved." confirmLabel="Close held bill" onClose={() => setClosingHeld(null)} onConfirm={() => { if (editable && !pending && closingHeld !== null) { setHeld(previous => previous.filter((_, index) => index !== closingHeld)); setClosingHeld(null); } }} />
    <ConfirmDialog open={clearOpen} loading={clearingCart} onClose={() => setClearOpen(false)} title="Clear this cart?" description={pickup ? "Remove this parcel from the cart. The medicine request stays in the pickup queue. Held carts stay saved." : "Remove the current items, customer and payment choices. Held carts stay saved."} confirmLabel="Clear cart" variant="danger" onConfirm={() => { void clearCart(); }} />
    {reminderCustomer && <PharmacyCustomerReminders key={`${scope}:${locationId}:${reminderCustomer}`} partyId={reminderCustomer} locationId={locationId} onClose={() => setReminderCustomer(null)} />}
    {priorPayment && <Modal open title="Resolve earlier payment" size="lg" onClose={() => setPriorPayment(null)}><PharmacyCollections locationId={locationId} canCollect={canCollect} canOpenTill={canOpenTill} initialInvoiceId={priorPayment} checkoutOnly embeddedCheckout autoAcknowledge onCollected={receipt => { if (receipt.invoiceId === priorPayment) { setPriorPayment(null); setError(""); } }} /></Modal>}
    {viewRecentInvoice && <PharmacyCollections locationId={locationId} canCollect={false} initialInvoiceId={viewRecentInvoice} focusOnly onInvoiceClose={() => setViewRecentInvoice(null)} />}
    {canReview && reviewing && <PharmacyProductReview medicineId={reviewing} locationId={locationId} onReviewed={invalidate} onClose={() => { setReviewing(null); onProductReviewed?.(); void lookup(exactLookup, undefined, false, true); }} />}
    {canManageCatalog && catalogueOpen && <PharmacyCatalogueDiscovery locationId={locationId} inventoryMode={inventoryMode} initialSearch={search} onClose={() => setCatalogueOpen(false)} onCreateLocal={onCreateLocal ? () => { setCatalogueOpen(false); onCreateLocal(search.trim()); } : undefined} onAdded={product => {
      setCatalogueOpen(false); setSearch(product.name); setProducts([]); setNextProduct(null); setProductLookupDone(false);
      setSearchError(inventoryMode === "tracked" ? "Product linked. Complete sale/tax review and receive actual stock in Inventory before billing." : "Product linked. Complete sale/tax review before billing; stock is not tracked.");
      if (canReview) setReviewing(product.id); onProductReviewed?.();
    }} />}
  </section>;
}
