"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey, referenceOwnerKey } from "@/lib/authScope";
import { useLatestRead } from "@/hooks/useLatestRead";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { counterProducts, counterCustomers, quoteCounter, issueCounter, recoverCounter, type CounterProduct, type CounterCustomer, type CounterIntent, type CounterQuote, type CounterResult, type CounterIssueInput } from "@/lib/pharmacyCounter";
import { PharmacyCollections } from "./PharmacyCollections";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";

type CartLine = { lineId: string; product: CounterProduct; packs: string; loose: string; discount: string };
type Cart = { lines: CartLine[]; customer: CounterCustomer | null; discount: string };
const message = (failure: unknown) => (failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure instanceof Error ? failure.message : "Counter operation could not be confirmed. Keep the same reference.");
function savedKey(storageKey: string) {
  const key = sessionStorage.getItem(storageKey);
  if (key !== null && !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new Error("Sale reference requires review before another issue.");
  return key;
}
export function PharmacyCounter({ locationId, canCollect }: { locationId: string; canCollect: boolean }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <CounterSession key={`${scope}:${locationId}`} locationId={locationId} canCollect={canCollect} />;
}
function CounterSession({ locationId, canCollect }: { locationId: string; canCollect: boolean }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), storageKey = `pharmacy-sale:${referenceOwnerKey(user)}:${locationId}`;
  const [initial] = useState(() => { try { return { key: savedKey(storageKey), error: "" }; } catch (failure) { return { key: null, error: message(failure) }; } });
  const [pending, setPending] = useState(initial.key), [error, setError] = useState(initial.error), [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false), [correctable, setCorrectable] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]), [customer, setCustomer] = useState<CounterCustomer | null>(null), [discount, setDiscount] = useState("0");
  const [held, setHeld] = useState<Cart[]>([]), [quote, setQuote] = useState<CounterQuote | null>(null), [outcome, setOutcome] = useState<CounterResult | null>(null);
  const [barcode, setBarcode] = useState(""), [search, setSearch] = useState(""), [products, setProducts] = useState<CounterProduct[]>([]), [nextProduct, setNextProduct] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState(""), [customers, setCustomers] = useState<CounterCustomer[]>([]), [nextCustomer, setNextCustomer] = useState<string | null>(null);
  const [searching, setSearching] = useState(false), [searchError, setSearchError] = useState("");
  const scanner = useRef<HTMLInputElement>(null), quantityInputs = useRef(new Map<string, HTMLInputElement>());
  const alive = useRef(true), lock = useRef(false), revision = useRef(0), frozen = useRef<{ key: string; input: CounterIssueInput } | null>(null);
  const beginLookup = useLatestRead(), beginCustomer = useLatestRead(), beginQuote = useLatestRead();
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const editable = !busy && !submitted && !outcome;
  function invalidate() { revision.current++; setQuote(null); setError(""); }
  function add(product: CounterProduct) {
    if (!editable) return;
    if (!product.eligible || !product.unitDefinition) { setSearchError("This product needs its reviewed prescription or inventory workflow."); return; }
    if (!lines.some(line => line.product.id === product.id) && lines.length >= 100) { setSearchError("A counter invoice supports at most 100 distinct products."); return; }
    invalidate(); const found = lines.find(line => line.product.id === product.id), id = found?.lineId || crypto.randomUUID();
    setLines(previous => found ? previous.map(line => line.lineId === id ? { ...line, loose: String(Number(line.loose) + 1) } : line) : [...previous, { lineId: id, product, packs: "0", loose: "1", discount: "0" }]);
    setBarcode(""); setSearchError(""); requestAnimationFrame(() => { quantityInputs.current.get(id)?.focus(); quantityInputs.current.get(id)?.select(); });
  }
  async function lookup(exact = false, cursor?: string) {
    const request = beginLookup(), version = revision.current; setSearching(true); setSearchError("");
    try {
      const page = await counterProducts(locationId, exact ? { barcode: barcode.trim() } : { search: search.trim(), cursor }, request.signal);
      if (!request.isCurrent() || version !== revision.current || lock.current) return;
      if (exact) { if (page.items.length !== 1 || page.nextCursor) throw new Error("No unique product matches this exact barcode. Search the catalogue to review it."); add(page.items[0]); }
      else { setProducts(page.items); setNextProduct(page.nextCursor); }
    } catch (failure) { if (request.isCurrent()) setSearchError(message(failure)); }
    finally { if (request.isCurrent()) setSearching(false); }
  }
  async function lookupCustomer(cursor?: string) {
    const request = beginCustomer(); setSearchError("");
    try { const page = await counterCustomers(locationId, customerSearch.trim(), cursor, request.signal); if (request.isCurrent()) { setCustomers(page.items); setNextCustomer(page.nextCursor); } }
    catch (failure) { if (request.isCurrent()) setSearchError(message(failure)); }
  }
  function intent(): CounterIntent {
    const invoiceDiscountPaise = parseReceiptPaise(discount);
    if (invoiceDiscountPaise === null || !lines.length) throw new Error("Add products and enter valid discounts before requesting a quote.");
    return { locationId, ...(customer ? { customerId: customer.id } : {}), invoiceDiscountPaise, roundOffPaise: 0, lines: lines.map(line => {
      if (!/^\d+$/.test(line.packs) || !/^\d+$/.test(line.loose) || !line.product.unitDefinition) throw new Error("Enter whole pack and loose quantities.");
      const total = BigInt(line.packs) * BigInt(line.product.unitDefinition.unitsPerPack) + BigInt(line.loose), discountPaise = parseReceiptPaise(line.discount);
      if (total <= BigInt(0) || total > BigInt(Number.MAX_SAFE_INTEGER) || discountPaise === null) throw new Error("Use positive safe quantities and valid line discounts.");
      return { lineId: line.lineId, medicineId: line.product.id, quantity: Number(total), expectedUnitVersion: line.product.unitDefinition.version, discountPaise };
    }) };
  }
  async function refreshQuote() {
    const request = beginQuote(), version = revision.current; setError(""); setQuote(null);
    try { const result = await quoteCounter(intent(), request.signal); if (request.isCurrent() && version === revision.current) setQuote(result); }
    catch (failure) { if (request.isCurrent() && version === revision.current) setError(message(failure)); }
  }
  async function issue(retry = false) {
    if (!current() || lock.current || outcome || !retry && !quote) return;
    lock.current = true; setBusy(true); setError(""); setCorrectable(false);
    try {
      if (savedKey(storageKey) !== pending) throw new Error("Sale reference changed. Check the saved result before another issue.");
      const key = pending || crypto.randomUUID();
      if (!pending) sessionStorage.setItem(storageKey, key);
      setPending(key);
      const pinned = frozen.current || { key, input: JSON.parse(JSON.stringify(quote!.issueInput)) as CounterIssueInput };
      frozen.current = pinned; setSubmitted(true); revision.current++;
      const result = await issueCounter(pinned.input, pinned.key);
      if (current()) { setOutcome(result); setQuote(null); setLines([]); setCustomer(null); }
    } catch (failure) { if (current()) { setError(message(failure)); setCorrectable([400, 409].includes((failure as { response?: { status?: number } })?.response?.status || 0)); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function recover() {
    if (!current() || lock.current || !pending) return;
    lock.current = true; setBusy(true); setError(""); revision.current++;
    try { const result = await recoverCounter(locationId, pending); if (current()) { setOutcome(result); setQuote(null); setLines([]); setCustomer(null); } }
    catch (failure) { if (current()) setError(message(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  function newSale() {
    if (!outcome || busy) return;
    try { if (savedKey(storageKey) !== outcome.requestKey) throw new Error("Sale reference changed; recover the saved result."); sessionStorage.removeItem(storageKey); frozen.current = null; setPending(null); setSubmitted(false); setOutcome(null); setDiscount("0"); setError(""); scanner.current?.focus(); }
    catch (failure) { setError(message(failure)); }
  }
  function hold() { if (!editable || !lines.length || held.length >= 3) return; setHeld(previous => [...previous, { lines, customer, discount }]); setLines([]); setCustomer(null); setDiscount("0"); invalidate(); }
  function resume(index: number) { if (!editable || lines.length) return; const cart = held[index]; setLines(cart.lines); setCustomer(cart.customer); setDiscount(cart.discount); setHeld(previous => previous.filter((_, n) => n !== index)); invalidate(); }
  return <section className={styles.list} aria-label="Pharmacy counter checkout">
    <header><h2>Counter sale</h2><p>Reviewed ordinary products only. Quotes reserve no stock. Issue the bill, then confirm money actually received.</p></header>
    {error && <Alert variant="error" title="Counter needs attention">{error}</Alert>}
    {pending && !outcome && <Alert variant="warning" title="Pending sale"><p>Reference: {pending}</p><p>Check this result before issuing another bill. After reload, re-enter original details under this same reference if the result is unavailable.</p><Button size="sm" disabled={busy} onClick={() => { void recover(); }}>Check sale result</Button>{submitted && <Button size="sm" disabled={busy} onClick={() => { void issue(true); }}>Retry same sale</Button>}{correctable && <Button size="sm" disabled={busy} variant="outline" onClick={() => { frozen.current = null; setSubmitted(false); setCorrectable(false); invalidate(); }}>Review rejected sale</Button>}</Alert>}
    {outcome ? <><Alert variant="success" title="Counter invoice saved"><p>Invoice {outcome.invoiceNumber} · {money(outcome.totalPaise / 100)}</p><p>Reference: {outcome.requestKey}. Stock was recorded once. Any uncollected amount remains due.</p><Button size="sm" disabled={busy} onClick={newSale}>Start a separate sale</Button></Alert><PharmacyCollections locationId={locationId} canCollect={canCollect} initialInvoiceId={outcome.invoiceId} /></> : <>
      <fieldset disabled={!editable} className={styles.form}>
        <form onSubmit={event => { event.preventDefault(); if (barcode.trim()) void lookup(true); }} className={styles.actions}><Input ref={scanner} label="Scan product barcode" value={barcode} maxLength={100} onChange={event => setBarcode(event.target.value)} hint="Scanner Enter performs exact barcode lookup, preserving leading zeroes." /><Button size="sm" type="submit" disabled={searching || !barcode.trim()}>Add scanned product</Button></form>
        <form onSubmit={event => { event.preventDefault(); void lookup(); }} className={styles.actions}><Input label="Search counter products" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /><Button size="sm" type="submit" disabled={searching}>Search products</Button></form>
        {searching && <p role="status">Finding products...</p>}{searchError && <Alert variant="error" title="Lookup needs attention">{searchError}</Alert>}
        {products.map(product => <article className={styles.card} key={product.id}><div className={styles.identity}><strong>{product.name} {product.strength}</strong><small>{product.genericName} · {product.stockQuantity} base units</small></div><Button size="sm" disabled={!product.eligible} onClick={() => add(product)}>{product.eligible ? `Add ${product.name}` : "Reviewed workflow required"}</Button></article>)}{nextProduct && <Button size="sm" onClick={() => { void lookup(false, nextProduct); }}>Next product page</Button>}
        <section aria-label="Counter cart"><h3>Cart</h3>{!lines.length && <p>Scan or search for a product to begin.</p>}{lines.map(line => <fieldset className={styles.rx} key={line.lineId} aria-label={`Cart ${line.product.name}`}><strong>{line.product.name}</strong><p>1 {line.product.unitDefinition?.packUnit} = {line.product.unitDefinition?.unitsPerPack} {line.product.unitDefinition?.baseUnit}</p><div className={styles.fieldGrid}>
          <Input label={`Packs ${line.product.name}`} type="number" min="0" step="1" value={line.packs} onChange={event => { invalidate(); setLines(previous => previous.map(row => row.lineId === line.lineId ? { ...row, packs: event.target.value } : row)); }} />
          <Input ref={element => { if (element) quantityInputs.current.set(line.lineId, element); else quantityInputs.current.delete(line.lineId); }} label={`Loose units ${line.product.name}`} type="number" min="0" step="1" value={line.loose} onChange={event => { invalidate(); setLines(previous => previous.map(row => row.lineId === line.lineId ? { ...row, loose: event.target.value } : row)); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); scanner.current?.focus(); } }} />
          <Input label={`Discount ${line.product.name} (INR)`} type="number" min="0" step="0.01" value={line.discount} onChange={event => { invalidate(); setLines(previous => previous.map(row => row.lineId === line.lineId ? { ...row, discount: event.target.value } : row)); }} /></div><Button size="sm" variant="ghost" onClick={() => { invalidate(); setLines(previous => previous.filter(row => row.lineId !== line.lineId)); }}>Remove {line.product.name}</Button></fieldset>)}</section>
        <Input label="Invoice discount (INR)" type="number" min="0" step="0.01" value={discount} onChange={event => { invalidate(); setDiscount(event.target.value); }} />
        <form onSubmit={event => { event.preventDefault(); void lookupCustomer(); }} className={styles.actions}><Input label="Find recorded customer" value={customerSearch} maxLength={100} onChange={event => setCustomerSearch(event.target.value)} /><Button size="sm" type="submit">Search customers</Button></form>
        <p>Customer: {customer?.name || "Walk-in customer (full settlement required)"}</p>{customer && <Button size="sm" variant="outline" onClick={() => { invalidate(); setCustomer(null); }}>Use walk-in customer</Button>}
        {customers.map(row => <article className={styles.card} key={row.id}><div className={styles.identity}><strong>{row.name}</strong><small>{row.address}</small></div><Button size="sm" onClick={() => { invalidate(); setCustomer(row); setCustomers([]); }}>Select customer {row.name}</Button></article>)}{nextCustomer && <Button size="sm" onClick={() => { void lookupCustomer(nextCustomer); }}>Next customer page</Button>}
        <div className={styles.actions}><Button size="sm" disabled={!lines.length} onClick={() => { void refreshQuote(); }}>Review current quote</Button><Button size="sm" variant="outline" disabled={!lines.length || held.length >= 3 || Boolean(pending)} onClick={hold}>Hold cart</Button></div>
        {held.map((cart, index) => <Button key={index} size="sm" variant="outline" disabled={Boolean(lines.length)} onClick={() => resume(index)}>Resume held cart {index + 1} ({cart.lines.length} products)</Button>)}{held.length > 0 && <p>Held carts stay in this tab until you leave it or reload. Resume always needs a fresh quote.</p>}
      </fieldset>
      {quote && <section aria-label="Trusted counter quote" className={styles.rx}><h3>Current quote</h3><p>Customer: {quote.customer?.name || "Walk-in customer"}</p>{quote.lines.map(line => <article key={line.lineId}><strong>{line.description} · {line.quantity} {line.unitSnapshot.baseUnit}</strong>{line.batches.map((lot, index) => <p key={index}>Batch {lot.batchNumber} · {lot.quantity} · Expiry {lot.expiryValue} · Unit price {money(lot.sellingPricePaise / 100)} · MRP {money(lot.mrpPaise / 100)}</p>)}</article>)}<p>Taxable value {money(quote.calculation.totals.baseAmountPaise / 100)} · CGST {money(quote.calculation.totals.cgstPaise / 100)} · SGST {money(quote.calculation.totals.sgstPaise / 100)}</p><strong>Total {money(quote.calculation.totals.payablePaise / 100)}</strong><Button size="sm" disabled={!editable} onClick={() => { void issue(); }}>Confirm and issue counter invoice</Button></section>}
    </>}
  </section>;
}
