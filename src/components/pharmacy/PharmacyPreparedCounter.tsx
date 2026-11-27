"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Input, Modal, QuantityInput } from "@/components/ui";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { normalizeBarcodeInput } from "@/lib/pharmacyBarcode";
import { PharmacyBarcodeScanDialog } from "./PharmacyBarcodeScanDialog";
import { openOfflineCheckout } from "@/lib/pharmacyOfflineCheckout";
import type { OfflineSessionControl } from "@/lib/pharmacyOfflineSession";
import type { OfflineCartIntent, OfflineCounterDraft, OfflineLedgerSale, StoredOfflineReceipt } from "@/lib/pharmacyOfflineLedger";
import type { IssuedPharmacyInvoice } from "@/lib/pharmacyInvoice";
import type { CounterInvoice } from "@/lib/pharmacyCollections";
import type { OfflineSyncState } from "@/lib/pharmacyOfflineSync";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { PharmacyCounterFilters, matchesCounterType } from "./PharmacyCounterFilters";
import { PharmacySavedBillPrint } from "./PharmacySavedBillPrint";
import { money } from "./pharmacyWorkspace";
import pos from "./PharmacyCounter.module.css";

type Runtime = Awaited<ReturnType<typeof openOfflineCheckout>>;
const empty = (): OfflineCounterDraft => ({ version: 1, cart: [], invoiceDiscount: "0", tender: "" });
const cleared = (value: OfflineCounterDraft): OfflineCounterDraft => ({ ...empty(), held: value.held || [] });
const failureMessage = (failure: unknown) => failure instanceof Error ? failure.message : "Recover this original local Save before billing again.";
/** Same counter layout, quantity control, discounts and saved-document printer.
 * The prepared mode alone owns local issuance; ordinary online checkout keeps
 * its existing transaction and recovery path.
 */
export function PharmacyPreparedCounter({ control, actorId, canIssue = true }: { control: OfflineSessionControl; actorId: string; canIssue?: boolean }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null), running = useRef<Runtime | null>(null), alive = useRef(true), lock = useRef(false);
  const [phrase, setPhrase] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [draft, setDraft] = useState<OfflineCounterDraft>(empty), [search, setSearch] = useState(""), [filter, setFilter] = useState<string[]>([]), [picked, setPicked] = useState(0), [panel, setPanel] = useState("products");
  const [quote, setQuote] = useState<OfflineLedgerSale | null>(null), [frozen, setFrozen] = useState<OfflineLedgerSale | null>(null), [stopped, setStopped] = useState(false);
  const [recent, setRecent] = useState<StoredOfflineReceipt[]>([]), [sync, setSync] = useState<OfflineSyncState>({ status: "idle", imported: 0 });
  const [editing, setEditing] = useState<string | null>(null), historyRevision = useRef(0);
  const [print, setPrint] = useState<CounterInvoice>(), [quantities, setQuantities] = useState(new Map<string, number>());
  const [cameraScanOpen, setCameraScanOpen] = useState(false);
  const scanner = useRef<HTMLInputElement>(null), discountInput = useRef<HTMLInputElement>(null), tenderInput = useRef<HTMLInputElement>(null), draftWrite = useRef<Promise<void>>(Promise.resolve());
  const scanHandler = useRef<(code: string) => void>(() => {});
  useEffect(() => {
    scanHandler.current = (code: string) => {
      const clean = normalizeBarcodeInput(code);
      if (!clean || !runtime) return;
      setSearch(clean);
      setPicked(0);
      const match = runtime.prepared.products.find(product => product.barcodes.includes(clean));
      if (match && (quantities.get(match.id) ?? match.availableQuantity) > 0) {
        add(match);
      }
    };
  });
  useBarcodeScanner({
    enabled: Boolean(runtime && canIssue && !stopped && !busy && !frozen && !editing && !cameraScanOpen),
    inputRef: scanner,
    onScan: code => scanHandler.current(code),
  });
  const indexes = useMemo(() => {
    const products = new Map(runtime?.prepared.products.map(product => [product.id, product]) || []), lots = new Map<string, NonNullable<Runtime>["prepared"]["lots"][number]>();
    for (const lot of runtime?.prepared.lots || []) if (!lots.has(lot.medicineId)) lots.set(lot.medicineId, lot);
    const search = [...products.values()].map(product => ({ product, fields: [product.name, product.genericName].map(value => value.normalize("NFKC").toLowerCase()) }));
    return { products, lots, search };
  }, [runtime]);
  const normalized = search.normalize("NFKC").trim().toLowerCase(), exact = /^\d{8,}$/.test(normalized);
  const visible = useMemo(() => {
    const result: Array<Runtime["prepared"]["products"][number]> = [], terms = normalized.split(/\s+/).filter(Boolean);
    if (terms.length > 8) return result;
    for (const { product, fields } of indexes.search) {
      if (!matchesCounterType(product.unitDefinition.baseUnit, filter)) continue;
      if (exact ? !product.barcodes.includes(normalized) : !terms.every(term => fields.some(value => value.includes(term)))) continue;
      result.push(product); if (result.length === 25) break;
    }
    return result;
  }, [indexes, normalized, exact, filter]);
  const matching = quote && quote.lines.length === draft.cart.length && quote.invoice.calculation?.totals.invoiceDiscountPaise === parseReceiptPaise(draft.invoiceDiscount) && quote.lines.every((line, index) => {
    const wanted = draft.cart[index]; return wanted && wanted.lineId === line.lineId && wanted.medicineId === line.medicineId && parseReceiptPaise(wanted.discount) === line.discountPaise && /^\d+$/.test(wanted.quantity) && Number(wanted.quantity) === line.allocations.reduce((sum, row) => sum + row.quantity, 0);
  }) ? quote : null;
  const editable = Boolean(runtime && runtime.persistent !== false && canIssue && sync.status !== "review" && !sync.issuanceStopped && !stopped && !busy && !frozen), payable = matching?.invoice.totalAmount, tender = draft.tender || (payable === undefined ? "0" : String(payable)), tenderPaise = parseReceiptPaise(tender);
  const totalPaise = payable === undefined ? undefined : Math.round(payable * 100), ready = editable && Boolean(matching) && tenderPaise !== null && totalPaise !== undefined && tenderPaise >= totalPaise;
  const selected = visible[Math.min(picked, Math.max(0, visible.length - 1))];
  function clearPlaintext() { running.current?.close(); running.current = null; setRuntime(null); setDraft(empty()); setQuote(null); setFrozen(null); setRecent([]); setPrint(undefined); setPhrase(""); setQuantities(new Map()); }
  useEffect(() => { alive.current = true; return () => { alive.current = false; running.current?.close(); }; }, []);
  useEffect(() => {
    if (!runtime) return;
    let idle: ReturnType<typeof setTimeout>;
    const touch = () => { clearTimeout(idle); idle = setTimeout(clearPlaintext, 15 * 60_000); }; touch();
    window.addEventListener("keydown", touch); window.addEventListener("pointerdown", touch);
    const flush = () => { void runtime.sync.flush().catch(() => {}); }, timer = setInterval(flush, 5000); window.addEventListener("online", flush); flush();
    return () => { clearTimeout(idle); clearInterval(timer); window.removeEventListener("keydown", touch); window.removeEventListener("pointerdown", touch); window.removeEventListener("online", flush); };
    // The unlocked runtime owns this operator/authority until lock or unmount.
  }, [runtime]);
  function saveDraft(value: OfflineCounterDraft) {
    if (!running.current) return Promise.reject(new Error("Unlock this counter first."));
    const ledger = running.current.ledger;
    draftWrite.current = draftWrite.current.catch(() => {}).then(() => ledger.saveDraft(value)); return draftWrite.current;
  }
  useEffect(() => {
    if (!runtime || frozen || busy || stopped) return;
    const timer = setTimeout(() => { void saveDraft(draft).catch(failure => { if (alive.current) setError(failureMessage(failure)); }); }, 180);
    return () => clearTimeout(timer);
  }, [draft, runtime, frozen, busy, stopped]);
  function intent(commandId = crypto.randomUUID()): OfflineCartIntent {
    const discount = parseReceiptPaise(draft.invoiceDiscount);
    if (discount === null || !draft.cart.length) throw new Error("Add products and valid discounts.");
    return { commandId, actorId, invoiceDiscountPaise: discount, roundOffPaise: 0, cashTenderedPaise: tenderPaise ?? 0, lines: draft.cart.map(line => {
      const amount = parseReceiptPaise(line.discount), quantity = Number(line.quantity);
      if (!/^\d+$/.test(line.quantity) || !Number.isSafeInteger(quantity) || quantity < 1 || amount === null) throw new Error("Use whole positive quantities and valid discounts.");
      return { lineId: line.lineId, medicineId: line.medicineId, quantity, discountPaise: amount };
    }) };
  }
  useEffect(() => {
    if (!runtime || frozen || busy || stopped || !draft.cart.length) return;
    let active = true;
    const timer = setTimeout(() => {
      try { void runtime.ledger.prepareSale(intent()).then(value => { if (active) { setQuote(value); setError(""); } }).catch(failure => { if (active) { setQuote(null); setError(failureMessage(failure)); } }); }
      catch (failure) { setQuote(null); setError(failureMessage(failure)); }
    }, 100);
    return () => { active = false; clearTimeout(timer); };
    // Tender does not change product allocations or the paise calculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, draft.cart, draft.invoiceDiscount, frozen, busy, stopped]);
  async function refreshRecent(current: Runtime) { const version = ++historyRevision.current, rows = await current.ledger.recent(5); if (alive.current && running.current === current && version === historyRevision.current) setRecent(rows); }
  function printable(original: StoredOfflineReceipt): CounterInvoice { return { ...original.receipt.invoice, id: `offline-${original.receipt.commandId}`, locationId: control.locationId, paymentRevision: 1, amountPaid: original.receipt.payment.collectedPaise / 100, balanceDue: 0 }; }
  async function unlock() {
    if (lock.current || control.actorId !== actorId) return;
    lock.current = true; setBusy(true); setError("");
    let current: Runtime | undefined;
    try {
      current = await openOfflineCheckout(control, actorId, phrase, state => { if (alive.current) setSync(state); });
      if (!alive.current) { current.close(); return; }
      const state = await current.ledger.checkoutState(), active = await current.ledger.activeSale(), saved = await current.ledger.readDraft();
      running.current = current; setRuntime(current); setStopped(Boolean(state.stopped || state.reviewRequired) || !state.policyCurrent);
      if (state.reviewRequired) setError("A sale-control or synchronization review paused new billing in this session. Retain its original receipts, resolve the review and reconcile the session before preparing another.");
      if (active?.saved) { const blank = cleared(saved || empty()); await current.ledger.saveDraft(blank); await current.ledger.finishSale(active.sale.commandId); setDraft(blank); }
      else if (active) { setFrozen(active.sale); setQuote(active.sale); setDraft({ version: 1, cart: active.sale.lines.map(line => ({ lineId: line.lineId, medicineId: line.medicineId, quantity: String(line.allocations.reduce((sum, allocation) => sum + allocation.quantity, 0)), discount: String(line.discountPaise / 100) })), invoiceDiscount: String(active.sale.invoice.calculation!.totals.invoiceDiscountPaise / 100), tender: String(active.sale.payment.cashTenderedPaise / 100), held: saved?.held || [] }); }
      else setDraft(saved || empty());
      await refreshRecent(current);
    } catch (failure) { current?.close(); running.current = null; setRuntime(null); if (alive.current) setError(failureMessage(failure)); }
    finally { lock.current = false; if (alive.current) { setPhrase(""); setBusy(false); } }
  }
  async function checkout(printBill = false) {
    if (!runtime || !canIssue || runtime.persistent === false || lock.current || !ready && !frozen) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await saveDraft(draft);
      const command = intent(frozen?.commandId), original = await runtime.save(command);
      if (!alive.current || running.current !== runtime) return;
      const blank = cleared(draft); await saveDraft(blank); await runtime.ledger.finishSale(original.receipt.commandId);
      setDraft(blank); setQuote(null); setFrozen(null); setSearch(""); setPanel("products");
      if (printBill) setPrint(printable(original));
      // Auxiliary history failure must not turn a committed invoice into a failed Save.
      setRecent(previous => [original, ...previous.filter(row => row.receipt.commandId !== original.receipt.commandId)].slice(0, 5));
      void refreshRecent(runtime).catch(() => { if (alive.current && running.current === runtime) setError(`Bill ${original.receipt.invoice.invoiceNumber} is saved on this PC. Recent bills could not refresh; use the saved bill below to reprint.`); });
      void runtime.sync.flush().catch(() => {}); requestAnimationFrame(() => scanner.current?.focus());
    } catch (failure) {
      if (alive.current) { setError(failureMessage(failure)); const active = await runtime.ledger.activeSale().catch(() => null); if (active) { setFrozen(active.sale); setQuote(active.sale); } }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  function add(product: NonNullable<typeof selected>) {
    if (!editable) return;
    setDraft(previous => ({ ...previous, cart: previous.cart.some(line => line.medicineId === product.id) ? previous.cart.map(line => line.medicineId === product.id ? { ...line, quantity: String(Number(line.quantity || 0) + 1) } : line) : [...previous.cart, { lineId: crypto.randomUUID(), medicineId: product.id, quantity: "1", discount: "0" }] })); setSearch(""); setPicked(0); scanner.current?.focus();
  }
  function hold() {
    if (!editable || !draft.cart.length || (draft.held?.length || 0) >= 3) return;
    setDraft(previous => ({ ...empty(), held: [...(previous.held || []), { cart: previous.cart, invoiceDiscount: previous.invoiceDiscount, tender: previous.tender }] })); setQuote(null); setPanel("products");
  }
  function resume(index: number) {
    if (!editable || !draft.held?.[index]) return;
    setDraft(previous => {
      const held = [...(previous.held || [])], next = held[index];
      if (previous.cart.length) held[index] = { cart: previous.cart, invoiceDiscount: previous.invoiceDiscount, tender: previous.tender }; else held.splice(index, 1);
      return { version: 1, ...next, held };
    }); setQuote(null);
  }
  const shortcuts = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    shortcuts.current = event => { if (event.metaKey || event.repeat || document.querySelector('[role="dialog"]')) return;
      if (event.key === "F1") { event.preventDefault(); setPanel("products"); scanner.current?.focus(); }
      if (event.key === "F2" || event.key === "F4") { event.preventDefault(); hold(); }
      if (event.key === "F8") { event.preventDefault(); setPanel("pay"); tenderInput.current?.focus(); }
      if (event.key === "F6") { event.preventDefault(); setPanel("pay"); discountInput.current?.focus(); }
      if (event.key === "F10") { event.preventDefault(); if (ready || frozen) void checkout(); }
    };
  });
  useEffect(() => { const handle = (event: KeyboardEvent) => shortcuts.current(event); window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle); }, []);
  useEffect(() => {
    if (!runtime) return;
    let active = true;
    void Promise.all(visible.map(async product => { const balance = await runtime.ledger.getProduct(product.id); return [product.id, Math.max(0, product.availableQuantity - (product.stockQuantity - (balance?.quantity ?? product.stockQuantity)))] as const; }))
      .then(values => { if (active) setQuantities(new Map(values)); }).catch(() => {});
    return () => { active = false; };
    // At most the visible 25 product balances are read. No catalogue-wide decrypt on each keypress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, search, filter, recent]);
  if (!runtime) return <Card padding="sm"><p className="font-semibold">Unlock prepared cash counter</p><p className="text-sm text-text-secondary">{control.actorId === actorId ? "Use your offline passphrase. No internet is required to unlock or save ordinary cash bills." : "The original prepared operator must unlock this PC."}</p>{error && <Alert variant="error" title="Counter could not be unlocked">{error}</Alert>}<Input label="Offline passphrase" type="password" autoComplete="off" value={phrase} maxLength={128} onChange={event => setPhrase(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void unlock(); }} /><Button disabled={busy || phrase.length < 12 || control.actorId !== actorId} loading={busy} onClick={() => { void unlock(); }}>Unlock counter</Button></Card>;
  const invoice = matching?.invoice as IssuedPharmacyInvoice | undefined, editingLine = draft.cart.find(line => line.lineId === editing);
  return <section className={pos.counter} data-counter-ready aria-label="Prepared pharmacy cash counter">
    {runtime.persistent === false && <Alert variant="warning" title="Durable browser storage is unavailable">Existing bills remain available for synchronization and backup. Allow persistent site storage in the enrolled browser, then lock and unlock this counter before issuing another bill.</Alert>}
    {sync.status === "review" && <Alert variant="warning" title="Synchronization needs review">{sync.message} New billing is paused until the original session is reconciled.</Alert>}
    {sync.issuanceStopped && <Alert variant="warning" title="Prepared billing stopped">The server stopped new issuance for this preparation. Synchronize the original bills, close this session and prepare again after reviewing sale holds. Original receipts are retained.</Alert>}
    <p className={pos.hint}>{sync.controlsCheckedAt ? `Sale controls last checked ${new Date(sync.controlsCheckedAt).toLocaleString()}.` : "Sale controls come from the original preparation; no fresh server check is confirmed."} A disconnected PC cannot receive new holds.</p>
    <nav className={pos.bills} aria-label="Prepared counter bill"><span className={pos.activeBill}>Walk-in · Cash<strong>{payable === undefined ? "—" : money(payable)}</strong></span>{(draft.held || []).map((cart, index) => <Button key={index} variant="outline" size="sm" disabled={!editable} onClick={() => resume(index)}>Held {index + 1} · {cart.cart.length} products</Button>)}<Button size="sm" variant="ghost" disabled={!editable || !draft.cart.length || (draft.held?.length || 0) >= 3} onClick={hold}>New bill <kbd>F2</kbd></Button><span className={pos.billStatus}><Badge variant={sync.status === "review" || stopped ? "warning" : "neutral"}>{stopped ? "Stopped · sync required" : sync.status === "review" ? "Sync needs review" : sync.status === "retry" || sync.status === "offline" ? "Saved locally · sync pending" : sync.status === "syncing" ? "Synchronizing" : "Prepared counter"}</Badge><Button size="sm" variant="ghost" onClick={clearPlaintext}>Lock</Button></span></nav>
    {error && <Alert variant="error" title="Original bill needs attention">{error}{frozen && <div className="mt-2 flex gap-2"><Button size="sm" disabled={busy} onClick={() => { void checkout(); }}>Recover original Save</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { void runtime.ledger.finishSale(frozen.commandId, true).then(() => setFrozen(null)).catch(failure => setError(failureMessage(failure))); }}>Cancel unissued intent</Button></div>}</Alert>}
    <div className={pos.panels} data-mobile-panel={panel}>
      <section className={pos.products} aria-label="Prepared products"><Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}><div className={pos.productTools}><div className={pos.search}><Input containerClassName="min-w-0 flex-1" ref={scanner} aria-label="Scan barcode or search prepared medicine" placeholder="Scan barcode or search medicine" value={search} disabled={!editable} maxLength={100} onChange={event => { setSearch(event.target.value); setPicked(0); }} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setPicked(value => Math.max(0, Math.min(visible.length - 1, value + (event.key === "ArrowDown" ? 1 : -1)))); } else if (event.key === "Enter") { event.preventDefault(); if (selected && (!exact || visible.length === 1)) add(selected); } }} /><Button type="button" size="sm" variant="outline" aria-label="Scan barcode with camera" title="Scan barcode with camera" disabled={!editable} onClick={() => setCameraScanOpen(true)}><Camera size={16} aria-hidden="true" /></Button><PharmacyCounterFilters value={filter} onChange={value => { setFilter(value); setPicked(0); }} disabled={!editable} frequent={false} /></div></div><div className={pos.productResults}>{visible.map((product, index) => { const lot = indexes.lots.get(product.id); return <article className={pos.product} data-picked={index === picked} key={product.id}><Button variant="ghost" className={pos.productPick} aria-label={`Add ${product.name}`} disabled={!editable || quantities.get(product.id) === 0} onClick={() => add(product)}><span className={pos.productBody}><span className={pos.productHeading}><strong>{product.name}</strong><strong className={pos.productRate}>{lot ? money(lot.sellingPricePaise / 100) : "—"}</strong></span><span className={pos.productMeta}><span>{quantities.get(product.id) ?? product.availableQuantity} assigned · {lot?.batchNumber}</span><span>/{product.unitDefinition.baseUnit} · {product.unitDefinition.packUnit} {product.unitDefinition.unitsPerPack}</span></span></span></Button></article>; })}{!visible.length && <p className={pos.hint}>No prepared ordinary medicines match this search.</p>}</div></Card></section>
      <section className={pos.cart} aria-label="Local bill"><Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}><div className={pos.cartHeader}><div><h3>Current bill</h3><p>{draft.cart.length} products · Cash</p></div><Button size="sm" variant="outline" disabled={!editable} onClick={() => setDraft(cleared(draft))}>Clear</Button></div><div className={pos.columnHead}><span>#</span><span>Product</span><span>Quantity</span><span>Rate</span><span>GST</span><span>Amount</span><span /></div><div className={pos.cartLines}>{draft.cart.map((line, index) => { const product = indexes.products.get(line.medicineId), priced = invoice?.items[index]; return <article className={pos.cartLine} key={line.lineId}><span className={pos.lineNumber}>{index + 1}</span><div className={pos.lineIdentity}><strong>{product?.name || "Original product"}</strong><p className={pos.hint}>{priced?.batches?.map(lot => `${lot.batchNumber} · ${lot.expiryValue}`).join(", ") || "Selecting owned batches"}</p></div><div className={pos.quantity}><QuantityInput variant="compact" label={`Quantity for ${product?.name || "product"}`} min={1} value={line.quantity} disabled={!editable} onValueChange={quantity => setDraft(previous => ({ ...previous, cart: previous.cart.map(row => row.lineId === line.lineId ? { ...row, quantity } : row) }))} /><div className={pos.units}><span>{product?.unitDefinition.baseUnit}</span>{product && <Button size="xs" variant="ghost" disabled={!editable} onClick={() => setDraft(previous => ({ ...previous, cart: previous.cart.map(row => row.lineId === line.lineId ? { ...row, quantity: String(Number(row.quantity || 0) + product.unitDefinition.unitsPerPack) } : row) }))}>+1 {product.unitDefinition.packUnit} ({product.unitDefinition.unitsPerPack})</Button>}</div></div><span className={pos.unitRate}>{priced ? money(priced.amount) : "—"}</span><span className={pos.lineGst}>{priced ? `${priced.gstRate}%` : "—"}</span><strong className={pos.lineAmount}>{priced ? money(priced.grossAmountPaise / 100) : "—"}</strong><div className={pos.lineActions}><Button size="sm" variant="ghost" aria-label={`Edit discount for ${product?.name || "product"}`} disabled={!editable} onClick={() => setEditing(line.lineId)}>⋯</Button><Button size="sm" variant="ghost" aria-label={`Remove ${product?.name || "product"}`} disabled={!editable} onClick={() => setDraft(previous => ({ ...previous, cart: previous.cart.filter(row => row.lineId !== line.lineId) }))}>×</Button></div></article>; })}{!draft.cart.length && <EmptyState title="Your cart is empty" description="Scan or choose a prepared medicine." className={pos.emptyCart} />}</div><div className={pos.recentBills}><h3>Recent bills · This PC</h3><div className={pos.recentList}>{recent.map(row => <Button key={row.receipt.commandId} size="sm" variant="ghost" onClick={() => setPrint(printable(row))}>{row.receipt.invoice.invoiceNumber} · {money(row.receipt.invoice.totalAmount)}</Button>)}</div></div></Card></section>
      <aside className={pos.checkout} aria-label="Cash payment"><Card padding="sm" className={pos.panel} contentClassName={pos.panelContent}><div className={pos.customerFields}><div className={pos.customerScroll}><p className={pos.sectionLabel}>Customer</p><strong>Walk-in · Cash</strong><p>Paid in full at this counter. Other payment and prescription workflows are available after this offline session is reconciled.</p><Input ref={discountInput} label="Invoice discount (INR)" value={draft.invoiceDiscount} disabled={!editable} inputMode="decimal" onChange={event => setDraft(previous => ({ ...previous, invoiceDiscount: event.target.value }))} /><div className={pos.cashCards}><div className={pos.receivedCard}><Input ref={tenderInput} label="Cash received (INR)" inputMode="decimal" value={tender} disabled={!editable} onChange={event => setDraft(previous => ({ ...previous, tender: event.target.value }))} /></div><dl className={pos.change}><dt>Change to return</dt><dd>{totalPaise !== undefined && tenderPaise !== null ? money(Math.max(0, tenderPaise - totalPaise) / 100) : "—"}</dd></dl></div><div className="flex flex-wrap gap-1">{[payable ?? 0, ...[20, 50, 100, 200, 500, 2000].filter(value => payable !== undefined && value > payable).slice(0, 3)].map((amount, index) => <Button key={`${amount}:${index}`} size="xs" variant="outline" disabled={!editable} onClick={() => setDraft(previous => ({ ...previous, tender: String(amount) }))}>{index === 0 ? "Exact " : ""}{money(amount)}</Button>)}</div></div><div className={pos.checkoutBottom}><dl className={pos.totals}><div><dt>Taxable value</dt><dd>{invoice ? money(invoice.subtotal) : "—"}</dd></div><div><dt>GST</dt><dd>{invoice ? money(invoice.tax) : "—"}</dd></div><div><dt>Total</dt><dd>{payable === undefined ? "—" : money(payable)}</dd></div></dl><div className={pos.saveActions}><Button aria-label="Save counter bill" fullWidth disabled={!ready} loading={busy} onClick={() => { void checkout(); }}>Save <kbd>F10</kbd></Button><Button fullWidth variant="outline" disabled={!ready} onClick={() => { void checkout(true); }}>Save &amp; print</Button></div><p className={pos.saveStatus}>Save confirms cash received and commits this bill on this PC. Synchronization runs separately.</p></div></div></Card></aside>
    </div><nav className={pos.mobileNav} aria-label="Prepared counter panels"><Button variant="outline" onClick={() => setPanel("products")}>Products</Button><Button variant="outline" onClick={() => setPanel("cart")}>Cart ({draft.cart.length})</Button><Button onClick={() => setPanel("pay")}>Pay {payable === undefined ? "" : money(payable)}</Button></nav>
    {editingLine && <Modal open title="Product discount" onClose={() => setEditing(null)} size="sm"><Input label="Line discount (INR)" inputMode="decimal" value={editingLine.discount} disabled={!editable} onChange={event => setDraft(previous => ({ ...previous, cart: previous.cart.map(line => line.lineId === editingLine.lineId ? { ...line, discount: event.target.value } : line) }))} /><Button variant="outline" size="sm" onClick={() => setEditing(null)}>Done</Button></Modal>}
    {print && <PharmacySavedBillPrint key={print.id} invoiceId={print.id} locationId={control.locationId} savedDocument={print} onClose={() => setPrint(undefined)} />}
    <PharmacyBarcodeScanDialog
      open={cameraScanOpen}
      title="Scan prepared product barcode"
      onClose={() => setCameraScanOpen(false)}
      onDetected={code => {
        const clean = normalizeBarcodeInput(code);
        setSearch(clean);
        const match = runtime?.prepared.products.find(product => product.barcodes.includes(clean));
        if (match && (quantities.get(match.id) ?? match.availableQuantity) > 0) {
          add(match);
        }
      }}
    />
  </section>;
}
