"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, CardDescription, CardTitle, ConfirmDialog, EmptyState, Input, Modal, QuantityInput, Select, Tabs } from "@/components/ui";
import { Barcode, Search, ShoppingBasket, Plus, X, SlidersHorizontal, FileText, RotateCw } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useLatestRead } from "@/hooks/useLatestRead";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { counterProducts, counterCustomers, quoteCounter, issueCounter, recoverCounter, type CounterProduct, type CounterCustomer, type CounterIntent, type CounterQuote, type CounterResult, type CounterIssueInput } from "@/lib/pharmacyCounter";
import { PharmacyCounterFilters } from "./PharmacyCounterFilters";
import { PharmacyCounterRecentBills, useCounterOverview } from "./PharmacyCounterOverview";
import { PharmacyCounterCustomerHistory } from "./PharmacyCounterCustomerHistory";
import { PharmacyDrawerGate } from "./PharmacyDrawerGate";
import { PharmacySavedBillPrint } from "./PharmacySavedBillPrint";
import { prepareIssuedCheckoutPayment } from "@/lib/pharmacyPayment";
import { PharmacyCollections } from "./PharmacyCollections";
import type { CounterPaymentPreference } from "./PharmacyCollectionForm";
import { PharmacyProductReview } from "./PharmacyProductReview";
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

type CartLine = { lineId: string; product: CounterProduct; packs: string; loose: string; discount: string };
type Cart = { lines: CartLine[]; customer: CounterCustomer | null; discount: string; billNumber?: number };
const productLabel = (product: CounterProduct) => `${product.name}${product.manufacturer ? ` (${product.manufacturer})` : ""}`;
const message = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Counter operation could not be confirmed. Keep the same reference.");
function savedKey(storageKey: string) {
  const key = sessionStorage.getItem(storageKey);
  if (key !== null && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new Error("Sale reference requires review before another issue.");
  return key;
}
interface Props { locationId: string; inventoryMode?: "tracked" | "billing_only"; canCollect: boolean; canOpenTill?: boolean; compact?: boolean; canReviewProducts?: boolean; onProductReviewed?: () => void }
export function PharmacyCounter(props: Props) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user);
  return <PharmacyOfflineCounterGate key={`${scope}:${props.locationId}:${props.inventoryMode || "tracked"}`} organizationId={user?.organization_id} locationId={props.locationId} actorId={user?.id} canIssue={props.canCollect}>
    <CounterSession {...props} />
  </PharmacyOfflineCounterGate>;
}
function CounterSession({ locationId, inventoryMode = "tracked", canCollect, canOpenTill = false, compact = false, canReviewProducts = false, onProductReviewed }: Props) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-sale:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { key: savedKey(storageKey), error: "" }; } catch (failure) { return { key: null, error: message(failure) }; } });
  const [pending, setPending] = useState(initial.key), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [correctable, setCorrectable] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]), [customer, setCustomer] = useState<CounterCustomer | null>(null), [discount, setDiscount] = useState("0");
  const [held, setHeld] = useState<Cart[]>([]), [quote, setQuote] = useState<CounterQuote | null>(null), [outcome, setOutcome] = useState<CounterResult | null>(null);
  const [billNumber, setBillNumber] = useState(1), nextBillNumber = useRef(2);
  const [search, setSearch] = useState(""), [lookupMode, setLookupMode] = useState("auto"), [customerMode, setCustomerMode] = useState("walk-in"), [products, setProducts] = useState<CounterProduct[]>([]), [nextProduct, setNextProduct] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState(""), [customers, setCustomers] = useState<CounterCustomer[]>([]), [nextCustomer, setNextCustomer] = useState<string | null>(null);
  const [searching, setSearching] = useState(false), [searchError, setSearchError] = useState("");
  const [productLookupDone, setProductLookupDone] = useState(false), [customerLookupEmpty, setCustomerLookupEmpty] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<CounterCustomer | null>(null);
  const [customerError, setCustomerError] = useState(""), [customerLoading, setCustomerLoading] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState(""), [quoteConflict, setQuoteConflict] = useState(false), [quoting, setQuoting] = useState(false), [addedMessage, setAddedMessage] = useState("");
  const [paymentReference, setPaymentReference] = useState(""), [drawerReady, setDrawerReady] = useState(false);
  const [drawerRevision, setDrawerRevision] = useState(0);
  const printRequested = useRef(false);
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);
  const [printDocument, setPrintDocument] = useState<CounterInvoice>();
  const [catalogue] = useState(() => createPharmacyCatalogue(scope, locationId, inventoryMode)), [journal] = useState(() => createSaleJournal(scope, locationId));
  const [catalogueVersion, setCatalogueVersion] = useState(0), [catalogueReady, setCatalogueReady] = useState(false), [journalReady, setJournalReady] = useState(false), [network, setNetwork] = useState("unknown");
  const branchCatalogue = usePharmacyCatalogueSync(scope, locationId, catalogue, network === "online");
  const [recentInvoice, setRecentInvoice] = useState<string | null>(null), [viewReceipt, setViewReceipt] = useState(false);
  const [viewRecentInvoice, setViewRecentInvoice] = useState<string | null>(null);
  const [priorPayment, setPriorPayment] = useState<string | null>(null);
  const overview = useCounterOverview(locationId, recentInvoice || "");
  const [onAccount, setOnAccount] = useState(false), [recentDue, setRecentDue] = useState<CounterResult | null>(null);
  const [preparingBill, setPreparingBill] = useState(false), [collectionVersion, setCollectionVersion] = useState(0);
  const [mobilePanel, setMobilePanel] = useState("products"), [productFilter, setProductFilter] = useState("all"), [picked, setPicked] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<CounterPaymentPreference["method"]>("cash"), [cashPreview, setCashPreview] = useState<string | null>(null);
  const [issuedPreference, setIssuedPreference] = useState<CounterPaymentPreference>();
  const [editingLineId, setEditingLineId] = useState<string | null>(null), [quoteDetailsOpen, setQuoteDetailsOpen] = useState(false), [closingHeld, setClosingHeld] = useState<number | null>(null);
  const initialBrowse = useRef(false);
  const customerPanel = useRef<HTMLElement>(null), discountInput = useRef<HTMLInputElement>(null), paymentPanel = useRef<HTMLDivElement>(null);
  const checkoutLock = useRef(false);
  const [clearOpen, setClearOpen] = useState(false), [collectionPending, setCollectionPending] = useState(false), [lastReceipt, setLastReceipt] = useState<CollectionReceipt | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupFlight = useRef<{ key: string; repeats: number } | null>(null);
  const scanner = useRef<HTMLInputElement>(null), quantityInputs = useRef(new Map<string, HTMLInputElement>());
  const alive = useRef(true), lock = useRef(false), revision = useRef(0), frozen = useRef<{ key: string; input: CounterIssueInput } | null>(null);
  const beginLookup = useLatestRead(), beginCustomer = useLatestRead(), beginQuote = useLatestRead();
  const restoreDraft = useCallback((saved: CounterDraft) => {
    const unpack = (cart: DraftCart): Cart => ({ lines: cart.lines, discount: cart.discount, billNumber: cart.billNumber, customer: cart.customerId ? { id: cart.customerId, name: "Recorded customer", address: "", revision: 0 } : null });
    const restoredNumber = saved.cart.billNumber || 1;
    setBillNumber(restoredNumber); nextBillNumber.current = Math.max(restoredNumber, ...saved.held.map((cart, index) => cart.billNumber || index + 2)) + 1;
    const cart = unpack(saved.cart); setLines(cart.lines); setDiscount(cart.discount); setCustomer(cart.customer); setCustomerMode(cart.customer ? "recorded" : "walk-in"); setHeld(saved.held.map(unpack));
  }, []);
  const packDraft = (cart: Cart): DraftCart => ({ lines: cart.lines, discount: cart.discount, customerId: cart.customer?.id || null, billNumber: cart.billNumber });
  const draftValue: CounterDraft = { cart: packDraft({ lines, customer, discount, billNumber }), held: held.map(packDraft) };
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
  const editable = !restoring && !draft.error && !busy && !preparingBill && !submitted && !outcome && !(canReview && reviewing);
  function invalidate() { revision.current++; beginQuote(); setQuote(null); setQuoteError(""); setQuoting(false); setError(""); }
  function reviewProduct(id: string) { if (editable && canReview) { invalidate(); setReviewing(id); } }
  function add(product: CounterProduct) {
    if (!editable) return;
    if (!product.eligible || !product.unitDefinition) { setSearchError("This product needs its reviewed prescription or inventory workflow."); return; }
    if (inventoryMode === "tracked" && product.stockQuantity === 0) { setSearchError("This product is out of stock in the current snapshot. Refresh products before adding it."); return; }
    if (!lines.some(line => line.product.id === product.id) && lines.length >= 100) { setSearchError("A counter invoice supports at most 100 distinct products."); return; }
    invalidate();
    catalogue.recordUse(product.id);
    setLines(previous => { const found = previous.find(line => line.product.id === product.id); return found ? previous.map(line => line.lineId === found.lineId ? { ...line, loose: String(Number(line.loose) + 1) } : line) : [...previous, { lineId: crypto.randomUUID(), product, packs: "0", loose: "1", discount: "0" }]; });
    setSearch(""); setSearchError(""); setProducts([]); setNextProduct(null); setProductLookupDone(false); setPicked(0); setAddedMessage(`Added 1 ${product.unitDefinition.baseUnit} of ${product.name} to cart.`); requestAnimationFrame(() => scanner.current?.focus());
  }
  const exactLookup = lookupMode === "barcode" || lookupMode === "auto" && /^\d+$/.test(search.trim());
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
    return { locationId, expectedInventoryMode: inventoryMode, ...(customer ? { customerId: customer.id } : {}), invoiceDiscountPaise, roundOffPaise: 0, lines: lines.map(line => {
      if (!/^\d+$/.test(line.packs) || !/^\d+$/.test(line.loose) || !line.product.unitDefinition) throw new Error("Enter whole pack and loose quantities.");
      const total = BigInt(line.packs) * BigInt(line.product.unitDefinition.unitsPerPack) + BigInt(line.loose), discountPaise = parseReceiptPaise(line.discount);
      if (total <= BigInt(0) || total > BigInt(Number.MAX_SAFE_INTEGER) || discountPaise === null) throw new Error("Use positive safe quantities and valid line discounts.");
      return { lineId: line.lineId, medicineId: line.product.id, quantity: Number(total), expectedUnitVersion: line.product.unitDefinition.version, discountPaise };
    }) };
  }, [customer, discount, lines, locationId, inventoryMode]);
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
    catalogue.recordSale(sold); setCatalogueVersion(value => value + 1);
    if (inventoryMode === "tracked") setProducts(previous => previous.map(product => ({ ...product, stockQuantity: Math.max(0, product.stockQuantity - (sold.find(line => line.medicineId === product.id)?.quantity || 0)) })));
    if (printRequested.current) { setPrintDocument(result.document); setPrintInvoiceId(result.invoiceId); printRequested.current = false; }
    setPaymentReference(""); setDrawerReady(false);
    setBillNumber(nextBillNumber.current++);
    setOnAccount(false); setPaymentMethod("cash"); setCashPreview(null); setMobilePanel("products");
    sessionStorage.removeItem(storageKey); void journal.save(null).catch(() => {});
    frozen.current = null; setPending(null); setSubmitted(false); setOutcome(null); setCollectionPending(false); setLines([]); setQuote(null); setDiscount("0"); setCustomer(null); setCustomerMode("walk-in"); setAddedMessage(""); setError("");
    setSearch(""); setSearchError(""); setCustomerSearch(""); setCustomers([]); setNextCustomer(null); setCustomerLookupEmpty(false);
    requestAnimationFrame(() => scanner.current?.focus());
  }
  function acceptSale(result: CounterResult, recovered = false) {
    if (result.collection) { setLastReceipt(result.collection); setRecentDue(null); setRecentInvoice(result.invoiceId); finishCart(result); return; }
    if (!canCollect && !recovered) { setLastReceipt(null); setRecentInvoice(result.invoiceId); finishCart(result); return; }
    if (onAccount && frozen.current?.input.customerId && result.status === "unpaid") { setRecentDue(result); setLastReceipt(null); setRecentInvoice(result.invoiceId); finishCart(result); }
    else if (result.totalPaise === 0 && result.status === "paid") { setLastReceipt(null); setRecentInvoice(result.invoiceId); finishCart(result); }
    else {
      if (!canCollect && printRequested.current) { setPrintInvoiceId(result.invoiceId); printRequested.current = false; }
      setOutcome(result); setMobilePanel("pay");
    }
  }
  async function issue(retry = false, prepared: CounterIssueInput | null = quote?.issueInput || null) {
    if (!current() || lock.current || outcome || !retry && !prepared) return;
    if (!retry) {
      setRecentDue(null); setIssuedPreference({ method: paymentMethod, ...(paymentMethod === "cash" && cashPreview !== null ? { cashTendered: cashPreview } : {}) }); }
    lock.current = true; setBusy(true); setError(""); setCorrectable(false);
    try {
      await measurePharmacyStep("draft_write", () => draft.flush(draftValue));
      if (!current()) return;
      if (savedKey(storageKey) !== pending) throw new Error("Sale reference changed. Check the saved result before another issue.");
      const key = pending || crypto.randomUUID();
      if (!pending) sessionStorage.setItem(storageKey, key);
      setPending(key);
      const payment = !retry && canCollect && !onAccount && prepared && prepared.expectedTotalPaise > 0 ? prepareIssuedCheckoutPayment(locationId, prepared.expectedTotalPaise, { method: paymentMethod, tender: paymentMethod === "cash" ? tenderPreview : "0", referenceNumber: paymentReference.trim(), expectedTotalPaise: prepared.expectedTotalPaise }) : null;
      if (!retry && canCollect && !onAccount && prepared!.expectedTotalPaise > 0 && !payment) throw Error("Review the payment amount and actual receipt before saving.");
      const pinned = frozen.current || { key, input: JSON.parse(JSON.stringify({ ...prepared!, ...(printRequested.current ? { includeDocument: true } : {}), ...(payment ? { payment } : {}) })) as CounterIssueInput };
      await measurePharmacyStep("intent_write", () => journal.save(pinned));
      if (!current()) return;
      frozen.current = pinned; setSubmitted(true); revision.current++;
      const result = await measurePharmacyStep("save_request", () => issueCounter(pinned.input, pinned.key));
      if (current()) acceptSale(result);
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
    try { const result = await recoverCounter(locationId, pending); if (current()) acceptSale(result, true); }
    catch (failure) { if (current()) setError(message(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  usePharmacyReconnect(network === "offline" || Boolean(pending && !outcome && !correctable), async () => { if (pending && !outcome) await recover(); else if (!outcome && !lock.current) { setNetwork("online"); } });
  function collected(receipt: CollectionReceipt) {
    if (!outcome || receipt.invoiceId !== outcome.invoiceId || !current()) return;
    setLastReceipt(receipt); setRecentInvoice(outcome.invoiceId);
    try { finishCart(outcome); } catch (failure) { setError(message(failure)); }
  }
  function newSale() {
    if (!outcome || busy || collectionPending) return;
    setOnAccount(false); setPaymentMethod("cash"); setCashPreview(null); setMobilePanel("products"); setPaymentReference(""); setDrawerReady(false); printRequested.current = false; setBillNumber(nextBillNumber.current++);
    try { if (savedKey(storageKey) !== outcome.requestKey) throw new Error("Sale reference changed; recover the saved result."); sessionStorage.removeItem(storageKey); void journal.save(null).catch(() => {}); frozen.current = null; setPending(null); setSubmitted(false); setOutcome(null); setLines([]); setCustomer(null); setQuote(null); setLastReceipt(null); setDiscount("0"); setCustomerMode("walk-in"); setCustomers([]); setCustomerSearch(""); setAddedMessage(""); setError(""); requestAnimationFrame(() => scanner.current?.focus()); }
    catch (failure) { setError(message(failure)); }
  }
  function hold() { if (!editable || pending || !lines.length || held.length >= 3) return; setOnAccount(false); setPaymentMethod("cash"); setCashPreview(null); setMobilePanel("products"); setPaymentReference(""); setHeld(previous => [...previous, { lines, customer, discount, billNumber }]); setBillNumber(nextBillNumber.current++); setLines([]); setCustomer(null); setCustomerMode("walk-in"); setDiscount("0"); invalidate(); }
  function resume(index: number) {
    if (!editable || pending) return;
    const cart = held[index]; if (!cart) return; setPaymentReference(""); setOnAccount(false); setPaymentMethod("cash"); setCashPreview(null); setMobilePanel("cart");
    // Switching bills swaps drafts; it never issues an invoice or abandons an active cart.
    setHeld(previous => lines.length ? previous.map((row, n) => n === index ? { lines, customer, discount, billNumber } : row) : previous.filter((_, n) => n !== index));
    setBillNumber(cart.billNumber || index + 2);
    setLines(cart.lines); setCustomer(cart.customer); setCustomerMode(cart.customer ? "recorded" : "walk-in"); setDiscount(cart.discount); invalidate();
  }
  function changeQuantity(id: string, value: string) { if (!editable) return; invalidate(); setLines(previous => previous.map(line => line.lineId === id ? { ...line, packs: "0", loose: value } : line)); }
  const frequentOnly = !search.trim() && productFilter === "frequent";
  const displayProducts = frequentOnly ? catalogue.frequent() : search.trim() || productLookupDone ? products : catalogue.find("").items;
  const visibleProducts = displayProducts.filter(product => productFilter === "all" || (productFilter === "frequent" ? catalogue.frequency(product.id) > 0 : productFilter === "other" ? !["tablet", "capsule", "ml"].includes(product.unitDefinition?.baseUnit || "") : product.unitDefinition?.baseUnit === productFilter));
  if (productFilter === "frequent") visibleProducts.sort((a, b) => catalogue.frequency(b.id) - catalogue.frequency(a.id));
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
  const paymentReady = !canCollect || onAccount || payable === 0 || payable === undefined || (drawerReady && (paymentMethod === "cash" ? tenderPaise !== null && tenderPaise >= payable : paymentReference.trim().length >= 3));
  const canCheckout = paymentReady && editable && !priorPayment && lines.length > 0 && network !== "offline" && !preparingBill && !quoteError && (customerMode !== "recorded" || Boolean(customer)) && (!onAccount || Boolean(customer));
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
        : event.key === "F2" ? () => { if (editable && lines.length && held.length < 3) { hold(); showPanel("products", true); } }
        : event.key === "F3" ? () => showPanel("pay", true)
        : event.key === "F4" ? () => { if (editable && lines.length && held.length < 3) hold(); }
        : event.key === "F6" ? () => { showPanel("pay"); requestAnimationFrame(() => discountInput.current?.focus()); }
        : event.key === "F8" ? () => { showPanel("pay"); requestAnimationFrame(() => paymentPanel.current?.querySelector<HTMLButtonElement>("button")?.focus()); }
        : event.key === "F10" ? () => { if (canCheckout) void checkout(); }
        : event.ctrlKey && event.key === "Delete" ? () => { if (editable && lines.length && !pending) setClearOpen(true); } : null;
      if (action) { event.preventDefault(); action(); }
    };
  });
  useEffect(() => { const keydown = (event: KeyboardEvent) => shortcuts.current(event); window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown); }, []);
  if (restoring) return <PharmacyCounterSkeleton label="Loading pharmacy" />;
  const syncState = busy || preparingBill ? "Saving" : pending && !outcome ? correctable ? "Needs review" : "Check save result" : network === "offline" ? "Offline draft" : quoteError ? quoteConflict ? "Needs review" : "Price check failed" : error ? "Needs attention" : quote ? "Prices checked" : "Draft";
  return <section className={pos.counter} data-counter-ready data-save-state={busy ? "saving" : preparingBill ? "checking" : undefined} aria-label="Pharmacy counter checkout">
    <nav aria-label="Open counter bills" className={pos.bills}>
      <span className={pos.activeBill}>Bill {billNumber} · {customer ? "Recorded" : "Walk-in"}{payable !== undefined && <strong>{money(payable / 100)}</strong>}<Button size="sm" variant="ghost" className={pos.closeBill} disabled={!editable || !lines.length || Boolean(pending)} aria-label="Clear current bill" title="Clear current bill" onClick={() => setClearOpen(true)}><X size={12} aria-hidden="true" /></Button></span>
      {held.map((cart, index) => <span className={pos.heldBill} key={index}><Button size="sm" variant="ghost" disabled={!editable || Boolean(pending)} onClick={() => resume(index)} aria-label={`Resume held cart ${index + 1} (${cart.lines.length} products)`}>Bill {cart.billNumber || index + 2} · {cart.customer ? "Recorded" : "Walk-in"}</Button><Button size="sm" variant="ghost" className={pos.closeBill} disabled={!editable || Boolean(pending)} aria-label={`Close held bill ${index + 1}`} onClick={() => setClosingHeld(index)}><X size={12} aria-hidden="true" /></Button></span>)}
      <Button size="sm" variant="ghost" disabled={!editable || Boolean(pending) || !lines.length || held.length >= 3} onClick={() => { hold(); showPanel("products", true); }}><Plus size={14} aria-hidden="true" />New bill <kbd>F2</kbd></Button>
      <Button size="sm" variant="ghost" aria-label="Hold cart" disabled={!editable || !lines.length || held.length >= 3 || Boolean(pending)} onClick={hold}>Hold <kbd>F4</kbd></Button>
      {recentInvoice && <Button size="sm" variant="ghost" className={pos.lastBill} onClick={() => setViewReceipt(true)} aria-label="View last saved bill"><span role="status">{lastReceipt ? `${lastReceipt.balancePaise ? "Received" : "Paid"} ${lastReceipt.invoiceNumber} · ${money(lastReceipt.collectedPaise / 100)}` : recentDue ? `Saved on account · ${money(recentDue.totalPaise / 100)}` : "Last saved bill"}</span></Button>}
      {!compact && <span className={pos.counterLabel}>Counter sale</span>}
      <div role="status" aria-label="Bill save status" className={pos.billStatus}><Badge variant={["Needs review", "Needs attention", "Price check failed", "Check save result", "Offline draft"].includes(syncState) ? "warning" : "neutral"}>{syncState}</Badge><a href="/pharmacy-offline.html" title="Prepare cached drafts when offline" aria-label="Offline preparation">Offline draft</a></div>
    </nav>
    {network === "offline" && <Alert variant="warning" title="Working offline">Cached products and estimates remain available. Reconnect to validate and issue bills.<Button size="sm" variant="outline" disabled={busy || quoting} onClick={() => { if (pending) void recover(); else void refreshQuote(); }}>Retry connection</Button></Alert>}
    {error && (!pending || outcome) && <Alert variant="error" title="Counter needs attention">{error}</Alert>}
    {draft.error && <Alert variant="warning" title="Saved cart needs attention">{draft.error}<Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload saved draft</Button></Alert>}
    {pending && !outcome && !busy && <Alert variant="warning" title={correctable ? "Save needs review" : "Pending sale"}>{error && <p className="mb-2">{error}</p>}<p>Check whether this sale was saved before submitting it again. Original bill details are restored when available. Keep this reference and check the saved result before retrying.</p><p className="mt-2 break-all text-xs">Reference: {pending}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => { void recover(); }}>Check sale result</Button>{submitted && !correctable && <Button size="sm" disabled={busy} onClick={() => { void issue(true); }}>Retry same sale</Button>}{correctable && <Button size="sm" disabled={busy} variant="outline" onClick={() => { frozen.current = null; setSubmitted(false); setCorrectable(false); invalidate(); }}>Review rejected sale</Button>}</div></Alert>}
    <>
      <div className={pos.panels} data-mobile-panel={mobilePanel}>
        <section className={pos.products} aria-label="Counter products">
          <Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}>
            <div className={pos.productTools}>
              <form onSubmit={event => { event.preventDefault(); if (!exactLookup && selectedProduct?.eligible && selectedProduct.unitDefinition) add(selectedProduct); else void lookup(exactLookup); }}>
                <div className={pos.search}>
                  <Input ref={scanner} aria-label="Scan barcode or search products" icon={<Barcode size={16} aria-hidden="true" />} iconRight={<Button type="button" variant="ghost" size="xs" aria-label="Search products" loading={searching} onClick={() => { void lookup(exactLookup, undefined, true, true); }}><Search size={15} aria-hidden="true" /></Button>} placeholder="Scan barcode or type medicine" title="F1 to search · Scan and press Enter to add" size="lg" containerClassName="min-w-0 flex-1" value={search} maxLength={100} onChange={event => { beginLookup(); lookupFlight.current = null; setSearching(false); setPicked(0); setAddedMessage(""); setSearch(event.target.value); const local = catalogue.find(event.target.value, lookupMode === "barcode" || lookupMode === "auto" && /^\d+$/.test(event.target.value.trim())); setProducts(local.items); setNextProduct(local.nextCursor); setSearchError(""); setProductLookupDone(Boolean(local.items.length)); }} onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key) && visibleProducts.length) { event.preventDefault(); setPicked(value => (value + (event.key === "ArrowDown" ? 1 : -1) + visibleProducts.length) % visibleProducts.length); } }} />
                </div>
              </form>
              <PharmacyCounterFilters>{[{ id: "frequent", label: "Frequent" }, { id: "all", label: "All" }, { id: "tablet", label: "Tablets" }, { id: "capsule", label: "Capsules" }, { id: "ml", label: "Liquids" }, { id: "other", label: "Other" }].map(filter => <Button size="sm" disabled={!editable} variant={productFilter === filter.id ? "primary" : "outline"} key={filter.id} aria-pressed={productFilter === filter.id} onClick={() => { setProductFilter(filter.id); setPicked(0); }}>{filter.label}</Button>)}<Select disabled={!editable} aria-label="Product lookup mode" size="sm" variant="flush" fullWidth={false} containerClassName={pos.lookupMode} value={lookupMode} onChange={event => { beginLookup(); lookupFlight.current = null; setSearching(false); setLookupMode(event.target.value); setProducts([]); setNextProduct(null); setProductLookupDone(false); }} options={[{ value: "auto", label: "Auto lookup" }, { value: "name", label: "By name" }, { value: "barcode", label: "Exact barcode" }]} /></PharmacyCounterFilters>
              <p role="status" className="sr-only">{searching ? "Finding products..." : addedMessage}</p>
            </div>
            <div className={pos.productResults} aria-busy={searching} role="region" aria-label="Available products" tabIndex={0}>
              {searchError && <Alert variant="error" title="Lookup needs attention">{searchError}</Alert>}
              {productLookupDone && !displayProducts.length && !searching && !searchError && !frequentOnly && <EmptyState title={search.trim() ? "No products found" : "No products at this branch"} description="Try another name or check this branch's inventory." className="py-5" />}
              {!displayProducts.length && !productLookupDone && !searching && !frequentOnly && <EmptyState icon={<Search aria-hidden="true" />} title="Find a medicine" description="Type a name, scan a barcode or browse branch products." className="py-5" />}
              {frequentOnly && !displayProducts.length && !searching && <p className={pos.hint}>Products you add often appear here. Choose All to browse.</p>}
              {displayProducts.length > 0 && !visibleProducts.length && <p className={pos.hint}>{productFilter === "frequent" ? "Products you add often appear here. Choose All to browse." : "No products with this unit in the current results. Choose All or search again."}</p>}
              {visibleProducts.map((product, index) => { const snapshot = catalogue.price(product.id), observedRate = snapshot && snapshot.quantity > 0 ? snapshot.grossPaise / snapshot.quantity : null, cachedRate = observedRate ?? (Number.isSafeInteger(product.retailPricePaise) && product.retailPricePaise! >= 0 ? product.retailPricePaise! : null); return <article key={product.id} className={pos.product} data-picked={index === picked}>
                {product.eligible && product.unitDefinition ? <Button variant="ghost" disabled={!editable || inventoryMode === "tracked" && product.stockQuantity === 0} className={pos.productPick} aria-label={`Add ${productLabel(product)}`} onClick={() => add(product)}><span className={pos.productBody}>
                  <span className={pos.productHeading}><strong>{product.name}{product.strength && !product.name.toLowerCase().includes(product.strength.toLowerCase()) && <span className={pos.strength}> {product.strength}</span>}</strong><strong className={pos.productRate} title={observedRate === null ? "Catalogue retail price; batch price is checked at billing" : "Last checked unit price; revalidated when saving"}>{cachedRate === null ? "—" : money(cachedRate / 100)}</strong></span>
                  <span className={pos.productMeta}><span title={[product.rackLocation ? `Rack ${product.rackLocation}` : "", product.manufacturer, snapshot?.batches[0] ? `Batch ${snapshot.batches[0].batchNumber} · Exp ${snapshot.batches[0].expiryValue}` : "Batch checked at billing", inventoryMode === "billing_only" ? "Stock not tracked" : `${product.stockQuantity} ${product.unitDefinition.baseUnit} in stock (snapshot)`].filter(Boolean).join(" · ")}>{product.rackLocation && <>Rack {product.rackLocation} · </>}{inventoryMode === "billing_only" ? "Stock not tracked" : product.stockQuantity === 0 ? "Out of stock" : `${product.stockQuantity} in stock`}{product.manufacturer && <> · {product.manufacturer}</>}{snapshot?.batches[0] && <> · {snapshot.batches[0].batchNumber} · {snapshot.batches[0].expiryValue}</>}</span><span>{cachedRate === null ? "Price at billing" : `/${product.unitDefinition.baseUnit}`} · {product.unitDefinition.packUnit} {product.unitDefinition.unitsPerPack}</span></span>
                </span></Button>
                : <div className={pos.blocked}><strong>{product.name}</strong><p>{!product.unitDefinition ? "Product units must be configured in Inventory." : "A sale classification review or authorized supply workflow is required."}{!canReview && " Ask your organization administrator to review this product."}</p>{canReview ? <Button size="sm" variant="outline" disabled={!editable} aria-label={`Review product ${product.name}`} onClick={() => reviewProduct(product.id)}>Review product</Button> : <Badge variant="warning">Product review required</Badge>}</div>}
              </article>; })}
              {!search.trim() && !searching && <Button variant="ghost" size="sm" fullWidth aria-label="Browse branch products" disabled={!editable} onClick={() => { void lookup(false, undefined, false, true); }}>Refresh products</Button>}
              {nextProduct && (productFilter !== "frequent" || search.trim()) && <Button size="sm" variant="outline" fullWidth disabled={!editable || searching} onClick={() => { void lookup(false, nextProduct); }}>Next product page</Button>}
            </div>
            <div className={pos.catalogueStatus} aria-label="Offline product catalogue">
              <small title={branchCatalogue.status.checkedAt ? `Last complete refresh: ${new Date(branchCatalogue.status.checkedAt).toLocaleString()}. Availability and prices are checked at Save.` : "Recent products remain cached. Prepare the branch catalogue for wider offline search."}>
                {branchCatalogue.busy ? `Updating offline products · ${branchCatalogue.progress}` : branchCatalogue.status.complete ? `${branchCatalogue.status.count.toLocaleString()} offline products · ${new Date(branchCatalogue.status.checkedAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${branchCatalogue.status.durable ? "" : " · memory only"}` : "Offline products · recent only"}
              </small>
              <Button variant="ghost" size="xs" disabled={network !== "online" || branchCatalogue.busy} onClick={() => { void branchCatalogue.refresh(); }}> {branchCatalogue.status.complete ? "Update offline products" : "Prepare offline products"}</Button>
              {branchCatalogue.status.error && <small>Refresh incomplete. {branchCatalogue.status.complete ? "Previous catalogue retained." : "Use online search or recent products."}</small>}
            </div>
          </Card>
        </section>
        <section aria-label="Counter cart" className={pos.cart}>
          <Card padding="none" className={pos.panel} contentClassName={pos.panelContent}>
            <div className={pos.cartHeader}><div><CardTitle>Bill {billNumber}</CardTitle><p>{lines.length} {lines.length === 1 ? "product" : "products"} · {String(pieces)} units</p></div><div className={pos.cartHeaderActions}><Button size="sm" variant="ghost" disabled={!lines.length || quoting || !editable} aria-label="Refresh prices" title="Refresh prices" onClick={() => { void refreshQuote(); }}><RotateCw size={15} aria-hidden="true" /></Button><Button size="sm" variant="ghost" disabled={!quote} aria-label="Batch and tax details" title="Batch and tax details" onClick={() => setQuoteDetailsOpen(true)}><FileText size={15} aria-hidden="true" /></Button>{lines.length > 0 && <Button size="sm" variant="outline" disabled={!editable || Boolean(pending)} aria-label="Clear cart" onClick={() => setClearOpen(true)}>Clear <kbd>Ctrl+Del</kbd></Button>}</div></div>
            <div className={pos.columnHead} aria-hidden="true"><span>#</span><span>Product</span><span>Quantity</span><span>Rate</span><span>GST</span><span>Amount</span><span /></div>
            <div className={pos.cartLines} role="region" aria-label="Bill product list" tabIndex={0}><fieldset disabled={!editable} className={pos.cartFields} aria-label="Products and cart">
              {!lines.length && <EmptyState icon={<ShoppingBasket aria-hidden="true" />} title="Your cart is empty" description="Scan or select a medicine to begin." className={pos.emptyCart} />}
              {lines.map((line, index) => { const priced = quote?.lines.find(row => row.lineId === line.lineId), calculated = quote?.calculation.lines.find(row => row.lineId === line.lineId), estimated = estimate?.lines.find(row => row.lineId === line.lineId), gstRate = calculated?.gstRateBps ?? catalogue.price(line.product.id)?.gstRateBps, total = /^\d+$/.test(line.packs) && /^\d+$/.test(line.loose) ? String(BigInt(line.packs) * BigInt(line.product.unitDefinition!.unitsPerPack) + BigInt(line.loose)) : line.loose; return <fieldset className={pos.cartLine} key={line.lineId} aria-label={`Cart ${productLabel(line.product)}`}>
                <span className={pos.lineNumber} aria-label="Item number">{index + 1}</span>
                <div className={pos.lineIdentity}><strong>{line.product.name}{line.product.strength && !line.product.name.toLowerCase().includes(line.product.strength.toLowerCase()) && <span className={pos.strength}> {line.product.strength}</span>}</strong><small className={pos.lineBatch} title={[line.product.rackLocation ? `Rack ${line.product.rackLocation}` : "", line.product.manufacturer, priced?.batches.map(lot => `Batch ${lot.batchNumber} · Exp ${lot.expiryValue}`).join("; ")].filter(Boolean).join(" · ")}>{line.product.rackLocation && <>Rack {line.product.rackLocation} · </>}{line.product.manufacturer && <>{line.product.manufacturer} · </>}{priced ? <>Batch {priced.batches[0]?.batchNumber} · Exp {priced.batches[0]?.expiryValue}{priced.batches.length > 1 ? ` · +${priced.batches.length - 1} more` : ""}</> : inventoryMode === "billing_only" ? "Supply details checked at billing" : "Batch assigned at billing"}</small></div>
                <div className={pos.quantity}>
                  <QuantityInput variant="compact" ref={element => { if (element) quantityInputs.current.set(line.lineId, element); else quantityInputs.current.delete(line.lineId); }} label={`Quantity ${productLabel(line.product)}`} decreaseLabel={`Decrease quantity ${productLabel(line.product)}`} increaseLabel={`Increase quantity ${productLabel(line.product)}`} min={1} value={total} disabled={!editable} onValueChange={value => changeQuantity(line.lineId, value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); showPanel("products", true); } }} />
                <div className={pos.units}><span>{line.product.unitDefinition?.baseUnit}</span><Button size="sm" variant="ghost" onClick={() => { invalidate(); setLines(previous => previous.map(row => row.lineId === line.lineId ? { ...row, packs: String(Number(row.packs || 0) + 1) } : row)); }}>+1 {line.product.unitDefinition?.packUnit} ({line.product.unitDefinition?.unitsPerPack})</Button></div></div>
                <div className={pos.linePrice} aria-label={`Pricing ${productLabel(line.product)}`}>
                  <div className={pos.unitRate}><span className="sr-only">Rate </span>{priced ? [...new Set(priced.batches.map(lot => lot.sellingPricePaise))].map(price => <small key={price}>{money(price / 100)}<span className="sr-only"> per {priced.unitSnapshot.baseUnit}</span></small>) : <small>{estimated ? <>{money(estimated.unitPaise / 100)}<span className="sr-only"> per {line.product.unitDefinition?.baseUnit}</span></> : network === "offline" ? "Price not cached" : "Calculating..."}</small>}</div>
                  <span className={pos.lineGst} title={quote ? "GST rate from the current quote" : "Last captured rate; checked at billing"}><span className="sr-only">GST </span>{gstRate === undefined ? "—" : `${gstRate / 100}%`}</span>
                  <strong className={pos.lineAmount}><span className="sr-only">Line total </span><span>{calculated ? money(calculated.grossAmountPaise / 100) : estimated ? money(estimated.grossPaise / 100) : "—"}</span></strong>
                </div>
                <div className={pos.lineActions}><Button size="sm" variant="ghost" className={pos.remove} disabled={!editable} aria-label={`Edit item ${productLabel(line.product)}`} title="Pack quantities and line discount" onClick={() => setEditingLineId(line.lineId)}><SlidersHorizontal size={14} aria-hidden="true" /></Button><Button size="sm" variant="ghost" className={pos.remove} onClick={() => { invalidate(); setLines(previous => previous.filter(row => row.lineId !== line.lineId)); }} aria-label={`Remove ${productLabel(line.product)}`}><X size={16} aria-hidden="true" /></Button></div>

              </fieldset>; })}
            </fieldset></div>
            <dl className={pos.cartSummary} aria-label="Bill summary"><div><dt>Products</dt><dd>{lines.length}</dd></div><div><dt>Units</dt><dd>{String(pieces)}</dd></div><div><dt>GST</dt><dd>{quote ? money((quote.calculation.totals.cgstPaise + quote.calculation.totals.sgstPaise) / 100) : lines.length ? "At billing" : money(0)}</dd></div><div><dt>Discount</dt><dd>{discountTotal === null ? "—" : money(discountTotal / 100)}</dd></div><div><dt>Payable</dt><dd>{payable === undefined ? lines.length ? "—" : money(0) : money(payable / 100)}</dd></div></dl>
            <PharmacyCounterRecentBills state={overview} onOpen={setViewRecentInvoice} />
            <p role="status" className={pos.draftStatus}>{draft.status}</p>
          </Card>
        </section>
        <aside ref={customerPanel} className={pos.checkout} aria-label="Customer and billing">
          <Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}>
            {outcome ? <div className={pos.settlement}><p className="text-sm font-semibold">Bill {outcome.invoiceNumber} saved</p><PharmacyCollections key={`${outcome.invoiceId}:${collectionVersion}`} locationId={locationId} canCollect={canCollect} canOpenTill={canOpenTill} initialInvoiceId={outcome.invoiceId} checkoutOnly embeddedCheckout autoAcknowledge issuedTotalPaise={outcome.totalPaise} preference={issuedPreference} onCollected={collected} onPendingChange={setCollectionPending} /><Button size="sm" variant="outline" disabled={busy || collectionPending} onClick={newSale}>Start a separate sale</Button><Button size="sm" variant="ghost" disabled={collectionPending} onClick={() => { setCollectionVersion(value => value + 1); }}>Review saved payment</Button></div> : <>
            <CardTitle className={pos.sectionLabel}>Customer</CardTitle>
            <fieldset disabled={!editable} className={pos.customerFields} aria-label="Customer and quote">
              <div className={pos.customerScroll}>
            <Tabs variant="pills" activeTab={customerMode} scrollActiveIntoView={false} onChange={mode => { setOnAccount(false); beginCustomer(); setCustomerMode(mode); invalidate(); setCustomer(null); setCustomers([]); setNextCustomer(null); setCustomerLookupEmpty(false); setCustomerError(""); setCustomerLoading(false); }} tabs={[{ id: "walk-in", label: "Walk-in" }, { id: "recorded", label: "Recorded" }]} />
            <p className={`${pos.customerHint} text-xs leading-relaxed text-text-secondary`}>{customerMode === "walk-in" ? "Paid in full at the counter." : "Link this bill to an existing customer. Choose Credit to leave the balance due."}</p>
            {customer && <div className="rounded-xl bg-surface-alt p-3"><p className="break-words text-sm font-medium">{quote?.customer?.name || customer.name}</p><p className="mt-1 text-xs text-text-secondary">{customer.address}{customer.phone && <> · {customer.phone}</>}</p>{hasAnyPermission(user, "PHARMACY_SELL", "PHARMACY_COLLECT_PAYMENT", "MANAGE_ORGANIZATION") && <Button size="sm" variant="ghost" onClick={() => setHistoryCustomer(quote?.customer || customer)}>Customer history</Button>}<Button size="sm" variant="ghost" className="mt-2" onClick={() => { invalidate(); setCustomer(null); }}>Change customer</Button></div>}
            {customerMode === "recorded" && !customer && <form onSubmit={event => { event.preventDefault(); void lookupCustomer(); }} className="space-y-2"><Input label="Find recorded customer" icon={<Search size={16} aria-hidden="true" />} placeholder="Search by name or phone" value={customerSearch} maxLength={100} onChange={event => { beginCustomer(); setCustomerSearch(event.target.value); setCustomers([]); setNextCustomer(null); setCustomerLookupEmpty(false); setCustomerError(""); setCustomerLoading(false); }} /><Button size="sm" type="submit" variant="outline" fullWidth loading={customerLoading}>Search customers</Button></form>}
            {customerError && <p role="alert" className="text-xs text-error">{customerError}</p>}
            {customers.map(row => <article className="space-y-2 rounded-xl border border-border p-3" key={row.id}><div className="break-words"><strong className="text-sm">{row.name}</strong><p className="mt-1 text-xs text-text-secondary">{row.address}{row.phone && <> · {row.phone}</>}</p></div><Button size="sm" variant="outline" fullWidth onClick={() => { beginCustomer(); invalidate(); setCustomer(row); setCustomers([]); setCustomerError(""); setCustomerLoading(false); }}>Select customer {row.name}</Button></article>)}
            {customerLookupEmpty && !customers.length && !customer && <p role="status" className="text-xs leading-relaxed text-text-secondary">No matching customers found. You can continue as a walk-in customer.</p>}
            {nextCustomer && <Button size="sm" variant="outline" fullWidth onClick={() => { void lookupCustomer(nextCustomer); }}>Next customer page</Button>}
            <Input ref={discountInput} containerClassName={pos.inlineMoney} aria-label="Invoice discount (INR)" label="Discount" prefix="₹" title="Invoice discount in rupees · F6" size="sm" type="number" min="0" step="0.01" value={discount} onChange={event => { invalidate(); setDiscount(event.target.value); }} />

              {canCollect ? <div className={pos.paymentPreview} ref={paymentPanel}>
                <h3 className="text-xs font-medium">Payment <kbd>F8</kbd></h3>
                <div className={pos.paymentMethods} role="group" aria-label="Preferred payment method">{(["cash", "upi", "card"] as const).map(method => <Button key={method} size="sm" variant={!onAccount && paymentMethod === method ? "primary" : "outline"} aria-pressed={!onAccount && paymentMethod === method} onClick={() => { setOnAccount(false); setPaymentMethod(method); setCashPreview(null); setPaymentReference(""); }}>{method === "cash" ? "Cash" : method === "upi" ? "UPI" : "Card"}</Button>)}<Button size="sm" variant={onAccount ? "primary" : "outline"} aria-pressed={onAccount} disabled={!customer} title={customer ? "Save this bill as an unpaid amount on the customer account" : "Select a recorded customer to use Credit"} onClick={() => setOnAccount(true)}>Credit</Button></div>
                {!onAccount && paymentMethod === "cash" && <><div className={pos.cashCards}><Input containerClassName={pos.receivedCard} aria-label="Cash received (INR)" label="Received" title="Cash actually received; extra cash is returned as change" size="sm" type="number" min="0" step="0.01" value={tenderPreview} onChange={event => setCashPreview(event.target.value)} /><dl className={pos.change} data-short={changePaise !== null && changePaise < 0 || undefined}><dt>{changePaise !== null && changePaise < 0 ? "Still to receive" : "Change to return"}</dt><dd>{changePaise === null ? "—" : money(Math.abs(changePaise) / 100)}</dd></dl></div><div className={pos.cashChips}><Button size="sm" variant="outline" aria-pressed={payable !== undefined && tenderPaise === payable} disabled={payable === undefined} onClick={() => setCashPreview(null)}><span>Exact{payable !== undefined && <small>{money(payable / 100)}</small>}</span></Button>{cashAmounts.map(value => <Button key={value} size="sm" variant="outline" aria-pressed={tenderPaise === value * 100} onClick={() => setCashPreview(String(value))}>{money(value)}</Button>)}</div></>}
                {!onAccount && paymentMethod !== "cash" && <Input label="Payment reference" aria-label="Verified payment reference" size="sm" required minLength={3} maxLength={200} value={paymentReference} onChange={event => setPaymentReference(event.target.value)} hint={`Verify ${paymentMethod === "upi" ? "UPI receipt" : "card approval"} before saving ${payable === undefined ? "" : money(payable / 100)}.`} />}
                {!onAccount && lines.length > 0 && payable !== 0 && <PharmacyDrawerGate key={drawerRevision} quietReady compact locationId={locationId} canOpen={canOpenTill} onReady={setDrawerReady} />}
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
            <div className="grid gap-2"><div className={pos.saveActions}><Button fullWidth aria-label="Save counter bill" title={inventoryMode === "billing_only" ? "Check current catalogue prices and supply details, save the bill and record the confirmed payment" : "Check current prices and stock, save the bill and record the confirmed payment"} loading={busy || preparingBill} disabled={!canCheckout} onClick={() => { void checkout(); }}>{busy ? "Saving..." : preparingBill ? "Checking..." : "Save"} <kbd>F10</kbd></Button><Button fullWidth variant="outline" aria-label="Save and print counter bill" disabled={!canCheckout} onClick={() => { void checkout(true); }}>Save &amp; print</Button></div>{busy || preparingBill ? <PharmacyCounterSaveStatus key={busy ? "saving" : "checking"} phase={busy ? "saving" : "checking"} inventoryMode={inventoryMode} paid={canCollect && !onAccount && payable !== 0} /> : <p className={pos.saveStatus}>{canCollect && !onAccount ? "Save confirms this payment." : inventoryMode === "billing_only" ? "Prices and supply details are checked at Save." : "Prices and stock are checked at Save."}</p>}</div>

              </div>
            </fieldset>
        {quote && <section aria-label="Trusted counter quote" className="sr-only">Current prices and tax have been checked.</section>}
            </>}
          </Card>
        </aside>
      </div>
      <nav className={pos.mobileNav} aria-label="Counter workspace panels"><Button variant={mobilePanel === "products" ? "outline" : "ghost"} aria-pressed={mobilePanel === "products"} onClick={() => showPanel("products")}>Products</Button><Button variant={mobilePanel === "cart" ? "outline" : "ghost"} aria-pressed={mobilePanel === "cart"} onClick={() => showPanel("cart")}>Cart ({lines.length})</Button><Button variant="primary" aria-pressed={mobilePanel === "pay"} onClick={() => showPanel("pay")}>Pay {payable === undefined ? "" : money(payable / 100)}</Button></nav>
      <footer className={pos.shortcutBar} aria-label="Counter keyboard shortcuts"><span><kbd>F1</kbd> Search</span><span><kbd>F2</kbd> New bill</span><span><kbd>F3</kbd> Customer</span><span><kbd>F4</kbd> Hold</span><span><kbd>F6</kbd> Discount</span><span><kbd>F8</kbd> Payment</span><span><kbd>F10</kbd> Save</span><span><kbd>↑</kbd><kbd>↓</kbd> Pick</span><span><kbd>Enter</kbd> Add</span><span><kbd>Alt+1–4</kbd> Switch bill</span></footer>
    </>
    {printInvoiceId && <PharmacySavedBillPrint key={printInvoiceId} invoiceId={printInvoiceId} locationId={locationId} savedDocument={printDocument} onClose={() => setPrintInvoiceId(null)} />}
    {historyCustomer && <PharmacyCounterCustomerHistory key={historyCustomer.id} customer={historyCustomer} locationId={locationId} onClose={() => setHistoryCustomer(null)} />}
    {editingLine && <Modal open title="Edit item" description={editingLine.product.name} onClose={() => setEditingLineId(null)} size="md" footer={<Button size="sm" onClick={() => { setEditingLineId(null); requestAnimationFrame(() => scanner.current?.focus()); }}>Done</Button>}><fieldset disabled={!editable} className={pos.itemEditor}><p>1 {editingLine.product.unitDefinition?.packUnit} = {editingLine.product.unitDefinition?.unitsPerPack} {editingLine.product.unitDefinition?.baseUnit}</p><div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
                  <Input aria-label={`Packs ${editingLine.product.name}`} label="Full packs" type="number" min="0" step="1" value={editingLine.packs} onChange={event => { invalidate(); setLines(previous => previous.map(row => row.lineId === editingLine.lineId ? { ...row, packs: event.target.value } : row)); }} />
                  <Input aria-label={`Loose units ${editingLine.product.name}`} label="Loose units" type="number" min="0" step="1" value={editingLine.loose} onChange={event => { invalidate(); setLines(previous => previous.map(row => row.lineId === editingLine.lineId ? { ...row, loose: event.target.value } : row)); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); setEditingLineId(null); showPanel("products", true); } }} />
                  <Input containerClassName="col-span-2 sm:col-span-1" aria-label={`Discount ${editingLine.product.name} (INR)`} label="Discount (INR)" type="number" min="0" step="0.01" value={editingLine.discount} onChange={event => { invalidate(); setLines(previous => previous.map(row => row.lineId === editingLine.lineId ? { ...row, discount: event.target.value } : row)); }} />
                </div>{editingPrice && <p className={pos.batchDetails}>{editingPrice.batches.map(lot => `Batch ${lot.batchNumber} · Exp ${lot.expiryValue} · ${lot.quantity} ${editingPrice.unitSnapshot.baseUnit}`).join("; ")}</p>}</fieldset></Modal>}
    {quoteDetailsOpen && quote && <Modal open title="Batch and tax details" size="lg" onClose={() => setQuoteDetailsOpen(false)}><Card contentClassName="gap-4">
          <CardDescription className="my-3">{quote.customer?.name || "Walk-in customer"}. {inventoryMode === "billing_only" ? "Prices and supply details are checked again when issuing the bill. Stock is not tracked." : "Prices are current; stock is checked again when issuing the bill."}</CardDescription>
          <div className="space-y-3">{quote.lines.map(line => <article key={line.lineId} className="space-y-1 break-words border-b border-border pb-3"><strong className="text-sm">{line.description} · {line.quantity} {line.unitSnapshot.baseUnit}</strong>{line.batches.map((lot, index) => <p key={index} className="text-xs leading-relaxed text-text-secondary">Batch {lot.batchNumber} · {lot.quantity} · Expiry {lot.expiryValue} · Unit price {money(lot.sellingPricePaise / 100)} · MRP {money(lot.mrpPaise / 100)}</p>)}</article>)}</div>
          <dl className="space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-text-secondary">Taxable value</dt><dd>{money(quote.calculation.totals.baseAmountPaise / 100)}</dd></div><div className="flex justify-between gap-3"><dt className="text-text-secondary">CGST</dt><dd>{money(quote.calculation.totals.cgstPaise / 100)}</dd></div><div className="flex justify-between gap-3"><dt className="text-text-secondary">SGST</dt><dd>{money(quote.calculation.totals.sgstPaise / 100)}</dd></div><div className="flex justify-between gap-3 border-t border-border pt-3 text-lg font-semibold"><dt>Total</dt><dd>{money(quote.calculation.totals.payablePaise / 100)}</dd></div></dl>
        </Card></Modal>}
    <ConfirmDialog open={closingHeld !== null} title="Close held bill?" description="Remove this held draft? The current bill will stay saved." confirmLabel="Close held bill" onClose={() => setClosingHeld(null)} onConfirm={() => { if (editable && !pending && closingHeld !== null) { setHeld(previous => previous.filter((_, index) => index !== closingHeld)); setClosingHeld(null); } }} />
    <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} title="Clear this cart?" description="Remove the current items and discounts. Held carts will stay saved." confirmLabel="Clear cart" variant="danger" onConfirm={() => { if (!editable || pending) return; setPaymentMethod("cash"); setCashPreview(null); invalidate(); setLines([]); setCustomer(null); setCustomerMode("walk-in"); setDiscount("0"); setClearOpen(false); scanner.current?.focus(); }} />
    {viewReceipt && recentInvoice && <PharmacyCollections locationId={locationId} canCollect={false} initialInvoiceId={recentInvoice} focusOnly onInvoiceClose={() => setViewReceipt(false)} />}
    {priorPayment && <Modal open title="Resolve earlier payment" size="lg" onClose={() => setPriorPayment(null)}><PharmacyCollections locationId={locationId} canCollect={canCollect} canOpenTill={canOpenTill} initialInvoiceId={priorPayment} checkoutOnly embeddedCheckout autoAcknowledge onCollected={receipt => { if (receipt.invoiceId === priorPayment) { setPriorPayment(null); setError(""); } }} /></Modal>}
    {viewRecentInvoice && <PharmacyCollections locationId={locationId} canCollect={false} initialInvoiceId={viewRecentInvoice} focusOnly onInvoiceClose={() => setViewRecentInvoice(null)} />}
    {canReview && reviewing && <PharmacyProductReview medicineId={reviewing} locationId={locationId} onReviewed={invalidate} onClose={() => { setReviewing(null); onProductReviewed?.(); void lookup(exactLookup, undefined, false, true); }} />}
  </section>;
}
