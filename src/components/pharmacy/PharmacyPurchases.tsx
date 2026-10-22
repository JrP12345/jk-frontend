"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select, Tabs } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { purchasePage, readPurchase, saveParty, savePurchaseDraft, type PharmacyParty, type PurchaseDraft, type PurchaseLine } from "@/services/pharmacyPurchase.service";
import { money } from "./pharmacyWorkspace";
import api from "@/lib/api";
import styles from "./PharmacyWorkspace.module.css";
import { PharmacyPurchaseOperations } from "./PharmacyPurchaseOperations";

const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error instanceof Error ? error.message : "Reload the record before retrying.");
function useSave(onSaved: () => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const alive = useRef(true), lock = useRef(false), scope = authScopeKey(useAuthStore(state => state.user));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function save(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
    try { await action(); if (current()) onSaved(); }
    catch (failure) { if (current()) setError(errorMessage(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  return { busy, error, save, setError };
}
interface PurchaseProps { locationId: string; canManage: boolean; canReceive?: boolean }
export function PharmacyPurchases(props: PurchaseProps) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <PurchaseSession key={`${scope}:${props.locationId}`} {...props} />;
}
function PurchaseSession({ locationId, canManage, canReceive = false }: PurchaseProps) {
  const [tab, setTab] = useState("purchases"), [search, setSearch] = useState(""), [query, setQuery] = useState(""), [archived, setArchived] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(), [previous, setPrevious] = useState<Array<string | undefined>>([]), [next, setNext] = useState<string | null>(null);
  const [items, setItems] = useState<Array<PharmacyParty | PurchaseDraft>>([]), [loaded, setLoaded] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [party, setParty] = useState<PharmacyParty | "new" | null>(null), [draft, setDraft] = useState<PurchaseDraft | "new" | null>(null), [retry, setRetry] = useState(0);
  const [operation, setOperation] = useState<PurchaseDraft | null>(null);
  const beginRead = useLatestRead(), beginDetail = useLatestRead();
  const readKey = `${locationId}:${tab}:${query}:${cursor || ""}:${archived}`;
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setCursor(undefined); setPrevious([]); }, 250); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async () => {
    const request = beginRead(); setBusy(true); setError("");
    try {
      const page = await purchasePage<PharmacyParty | PurchaseDraft>(tab as "parties" | "purchases", locationId, { cursor, search: query, archived: tab === "parties" && archived }, request.signal);
      if (request.isCurrent()) { setItems(page.items); setNext(page.nextCursor); setLoaded(readKey); }
    } catch (failure) { if (request.isCurrent()) { setItems([]); setError(errorMessage(failure)); } }
    finally { if (request.isCurrent()) setBusy(false); }
  }, [beginRead, locationId, tab, cursor, query, archived, readKey]);
  useEffect(() => { void load(); }, [load, retry]);
  const saved = () => { setParty(null); setDraft(null); setOperation(null); setRetry(value => value + 1); };
  async function openDraft(id: string) {
    const request = beginDetail(); setError("");
    try { const result = await readPurchase(id, locationId); if (request.isCurrent()) { if (result.status === "posted") setOperation(result); else setDraft(result); } }
    catch (failure) { if (request.isCurrent()) setError(errorMessage(failure)); }
  }
  const visible = loaded === readKey ? items : [];
  return <section className={styles.list} aria-label="Purchases and business parties">
    <header className={styles.alertHeader}><h2>Purchases & parties</h2>{canManage && <div className={styles.actions}><Button size="sm" variant="outline" onClick={() => setParty("new")}>Add supplier / customer</Button><Button size="sm" onClick={() => setDraft("new")}>New purchase draft</Button></div>}</header>
    <p className={styles.summary}>Drafts record supplier invoices. Saving a draft does not receive stock or create a supplier balance.</p>
    <Tabs variant="pills" activeTab={tab} onChange={value => { setTab(value); setCursor(undefined); setPrevious([]); setSearch(""); setQuery(""); }} tabs={[{ id: "purchases", label: "Supplier invoices" }, { id: "parties", label: "Suppliers & customers" }]} />
    <Input type="search" label={tab === "parties" ? "Search business parties" : "Search supplier invoices"} maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
    {tab === "parties" && <Select label="Party status" value={archived ? "archived" : "active"} onChange={event => { setArchived(event.target.value === "archived"); setCursor(undefined); setPrevious([]); }} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />}
    {error && <Alert variant="error" title="Purchase records unavailable" action={<Button size="sm" onClick={() => setRetry(value => value + 1)}>Retry purchase records</Button>}>{error}</Alert>}
    {busy && <p role="status">Loading purchase records...</p>}
    {!busy && !error && visible.length === 0 && <p className={styles.empty}>{tab === "parties" ? "No business parties match this search." : "No purchase drafts match this search."}</p>}
    {visible.map(row => tab === "parties" ? <article className={styles.card} key={row.id}><div className={styles.identity}><strong>{(row as PharmacyParty).name}</strong><small>{(row as PharmacyParty).kinds.join(" / ")} · {(row as PharmacyParty).gstin || "Unregistered for GST"}</small><small>{(row as PharmacyParty).address}</small></div>{canManage && <Button size="sm" variant="outline" onClick={() => setParty(row as PharmacyParty)}>Edit {(row as PharmacyParty).name}</Button>}</article>
      : <article className={styles.card} key={row.id}><div className={styles.identity}><strong>{(row as PurchaseDraft).supplierInvoiceNumber}</strong><small>{(row as PurchaseDraft).supplierSnapshot.name} · {(row as PurchaseDraft).invoiceDate} · {(row as PurchaseDraft).status === "posted" ? "Posted" : "Draft"}</small><span>Supplier stated total: {money((row as PurchaseDraft).statedTotalPaise / 100)}</span></div><Button size="sm" variant="outline" onClick={() => { void openDraft(row.id); }}>Open {(row as PurchaseDraft).status === "posted" ? "purchase" : "draft"} {(row as PurchaseDraft).supplierInvoiceNumber}</Button></article>)}
    <div className={styles.actions}>{previous.length > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setCursor(previous.at(-1)); setPrevious(value => value.slice(0, -1)); }}>Previous purchase page</Button>}{next && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setPrevious(value => [...value, cursor]); setCursor(next); }}>Next purchase page</Button>}</div>
    {party && canManage && <PartyForm key={party === "new" ? "new-party" : party.id} current={party === "new" ? undefined : party} locationId={locationId} onClose={() => setParty(null)} onSaved={saved} />}
    {draft && <DraftForm key={draft === "new" ? "new-draft" : draft.id} current={draft === "new" ? undefined : draft} locationId={locationId} canManage={canManage} onClose={() => setDraft(null)} onSaved={saved} onPost={() => { if (draft !== "new") { setOperation(draft); setDraft(null); } }} />}
    {operation && <PharmacyPurchaseOperations key={operation.id} purchase={operation} canManage={canManage} canReceive={canReceive} onClose={() => setOperation(null)} onChanged={saved} />}
  </section>;
}
function PartyForm({ current, locationId, onClose, onSaved }: { current?: PharmacyParty; locationId: string; onClose: () => void; onSaved: () => void }) {
  const [key] = useState(() => crypto.randomUUID()), state = useSave(onSaved);
  const [form, setForm] = useState({ name: current?.name || "", kind: current?.kinds.length === 2 ? "both" : current?.kinds[0] || "supplier", address: current?.address || "", phone: current?.phone || "", email: current?.email || "", gstRegistration: current?.gstRegistration || "unregistered", gstin: current?.gstin || "", licence: current?.licence?.number || "", validUntil: current?.licence?.validUntil || "", archived: current?.archived || false });
  const edit = (field: keyof typeof form, value: string | boolean) => setForm(previous => ({ ...previous, [field]: value }));
  function submit(event: React.FormEvent) {
    event.preventDefault(); const supplier = form.kind !== "customer";
    if (!form.name.trim() || !form.address.trim() || supplier && !form.licence.trim()) { state.setError("Enter the business name, address and actual supplier licence details where applicable."); return; }
    void state.save(() => saveParty({ locationId, locationIds: current?.locationIds || [locationId], name: form.name, kinds: form.kind === "both" ? ["customer", "supplier"] : [form.kind], address: form.address, phone: form.phone, email: form.email,
      gstRegistration: form.gstRegistration as "registered" | "unregistered", ...(form.gstRegistration === "registered" ? { gstin: form.gstin } : {}), ...(supplier ? { licence: { number: form.licence, ...(form.validUntil ? { validUntil: form.validUntil } : {}) } } : {}), archived: form.archived }, key, current));
  }
  return <Modal open title={current ? "Edit business party" : "Add supplier / customer"} onClose={onClose} busy={state.busy} size="md" bodyClassName={styles.dialog} footer={<><Button variant="outline" size="sm" disabled={state.busy} onClick={onClose}>Cancel</Button><Button size="sm" type="submit" form="pharmacy-party-form" loading={state.busy}>Save business party</Button></>}>
    <form id="pharmacy-party-form" className={styles.form} onSubmit={submit} noValidate>{state.error && <Alert variant="error" title="Party was not confirmed">{state.error}</Alert>}<fieldset className={styles.form} disabled={state.busy}>
      <Input label="Business name *" value={form.name} maxLength={200} onChange={event => edit("name", event.target.value)} /><Select label="Party roles" value={form.kind} onChange={event => edit("kind", event.target.value)} options={[{ value: "supplier", label: "Supplier" }, { value: "customer", label: "Customer" }, { value: "both", label: "Supplier and customer" }]} />
      <Input label="Business address *" value={form.address} maxLength={500} onChange={event => edit("address", event.target.value)} /><div className={styles.fieldGrid}><Input label="Business phone" value={form.phone} onChange={event => edit("phone", event.target.value)} /><Input label="Business email" type="email" value={form.email} onChange={event => edit("email", event.target.value)} /></div>
      <Select label="GST registration" value={form.gstRegistration} onChange={event => edit("gstRegistration", event.target.value)} options={[{ value: "unregistered", label: "Unregistered" }, { value: "registered", label: "Registered" }]} />{form.gstRegistration === "registered" && <Input label="GSTIN *" value={form.gstin} maxLength={15} onChange={event => edit("gstin", event.target.value)} />}
      {form.kind !== "customer" && <div className={styles.fieldGrid}><Input label="Supplier licence number *" value={form.licence} maxLength={80} onChange={event => edit("licence", event.target.value)} /><Input label="Supplier licence valid until (if recorded)" type="date" value={form.validUntil} onChange={event => edit("validUntil", event.target.value)} /></div>}
      {current && <Select label="Business party status" value={form.archived ? "archived" : "active"} onChange={event => edit("archived", event.target.value === "archived")} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived; retain history" }]} />}
    </fieldset></form>
  </Modal>;
}
type Product = { id: string; name: string; price: number; hsnCode?: string; unitDefinition: { version: number; baseUnit: string; packUnit: string; unitsPerPack: number } };
type FormLine = { lineId: string; product: Product; packs: string; looseUnits: string; freePacks: string; freeLooseUnits: string; baseAmount: string; discount: string; gst: string; hsn: string; sellingPrice: string; mrp: string };
const numberFields = ["packs", "looseUnits", "freePacks", "freeLooseUnits"] as const;
function DraftForm({ current, locationId, canManage, onClose, onSaved, onPost }: { current?: PurchaseDraft; locationId: string; canManage: boolean; onClose: () => void; onSaved: () => void; onPost: () => void }) {
  const [key] = useState(() => crypto.randomUUID()), state = useSave(onSaved), beginSearch = useLatestRead(), beginParty = useLatestRead();
  const [supplierId, setSupplierId] = useState(current?.supplierId || ""), [parties, setParties] = useState<PharmacyParty[]>([]), [selectedParty, setSelectedParty] = useState<PharmacyParty | null>(null);
  const [partySearch, setPartySearch] = useState(""), [productSearch, setProductSearch] = useState(""), [products, setProducts] = useState<Product[]>([]), [productId, setProductId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [header, setHeader] = useState({ number: current?.supplierInvoiceNumber || "", date: current?.invoiceDate || "", total: current ? String(current.statedTotalPaise / 100) : "", notes: current?.notes || "" });
  const [lines, setLines] = useState<FormLine[]>(() => current?.lines.map(line => ({ lineId: line.lineId, product: { id: line.medicineId, name: line.medicineSnapshot.name, price: line.sellingPricePaise / 100, unitDefinition: line.unitSnapshot },
    packs: String(line.packs), looseUnits: String(line.looseUnits), freePacks: String(line.freePacks), freeLooseUnits: String(line.freeLooseUnits), baseAmount: String(line.baseAmountPaise / 100), discount: String(line.discountPaise / 100), gst: String(line.gstRateBps / 100), hsn: line.hsnCode, sellingPrice: String(line.sellingPricePaise / 100), mrp: line.mrpPaise === undefined ? "" : String(line.mrpPaise / 100) })) || []);
  useEffect(() => {
    const request = beginParty();
    const timer = setTimeout(() => { void purchasePage<PharmacyParty>("parties", locationId, { search: partySearch }, request.signal).then(page => { if (request.isCurrent()) setParties(page.items.filter(party => party.kinds.includes("supplier"))); }).catch(() => { if (request.isCurrent()) setSearchError("Suppliers could not be loaded. Retry the supplier search."); }); }, 250);
    return () => clearTimeout(timer);
  }, [beginParty, locationId, partySearch]);
  useEffect(() => {
    if (!current) return;
    let active = true;
    void api.get(`/pharmacy/parties/${current.supplierId}?locationId=${encodeURIComponent(locationId)}`).then(response => { if (active) setSelectedParty(response.data.data); }).catch(() => { if (active) setSearchError("The saved supplier needs review before editing this draft."); });
    return () => { active = false; };
  }, [current, locationId]);
  useEffect(() => {
    const request = beginSearch();
    const timer = setTimeout(() => { void purchasePage<Product>("purchase-products", locationId, { search: productSearch }, request.signal).then(page => {
      if (request.isCurrent()) setProducts(page.items.filter(product => product.unitDefinition));
    }).catch(() => { if (request.isCurrent()) setSearchError("Products could not be loaded. Retry the product search."); }); }, 250);
    return () => clearTimeout(timer);
  }, [beginSearch, locationId, productSearch]);
  const supplierOptions = [...parties, ...(selectedParty && !parties.some(party => party.id === selectedParty.id) ? [selectedParty] : [])];
  function addProduct() {
    const product = products.find(row => row.id === productId); if (!product || lines.length >= 100) return;
    setLines(previous => [...previous, { lineId: crypto.randomUUID(), product, packs: "0", looseUnits: "0", freePacks: "0", freeLooseUnits: "0", baseAmount: "", discount: "0", gst: "", hsn: product.hsnCode || "", sellingPrice: String(product.price), mrp: "" }]);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault(); if (!canManage || state.busy) return;
    const supplier = supplierOptions.find(party => party.id === supplierId), statedTotalPaise = parseReceiptPaise(header.total);
    if (!supplier || supplier.archived || !header.number.trim() || !header.date || statedTotalPaise === null || !lines.length) { state.setError("Select an active supplier, invoice number/date, stated total and at least one product."); return; }
    const captured: PurchaseLine[] = [];
    for (const line of lines) {
      const counts = numberFields.map(field => /^\d+$/.test(line[field]) ? Number(line[field]) : NaN), [packs, looseUnits, freePacks, freeLooseUnits] = counts, unit = line.product.unitDefinition;
      const baseAmountPaise = parseReceiptPaise(line.baseAmount), discountPaise = parseReceiptPaise(line.discount), gstRateBps = parseReceiptPaise(line.gst), sellingPricePaise = parseReceiptPaise(line.sellingPrice), mrpPaise = line.mrp.trim() ? parseReceiptPaise(line.mrp) : undefined;
      const total = (packs + freePacks) * unit.unitsPerPack + looseUnits + freeLooseUnits;
      if (counts.some(value => !Number.isSafeInteger(value) || value < 0) || looseUnits >= unit.unitsPerPack || freeLooseUnits >= unit.unitsPerPack || !Number.isSafeInteger(total) || total <= 0 || baseAmountPaise === null || discountPaise === null || discountPaise > baseAmountPaise || gstRateBps === null || gstRateBps > 10000 || sellingPricePaise === null || mrpPaise === null || mrpPaise !== undefined && sellingPricePaise > mrpPaise || !/^\d{4}(\d{2})?(\d{2})?$/.test(line.hsn)) { state.setError(`Check quantities, exact amounts, HSN and GST for ${line.product.name}.`); return; }
      captured.push({ lineId: line.lineId, medicineId: line.product.id, expectedUnitVersion: unit.version, packs, looseUnits, freePacks, freeLooseUnits, baseAmountPaise, discountPaise, gstRateBps, hsnCode: line.hsn, sellingPricePaise, ...(mrpPaise !== undefined ? { mrpPaise } : {}) });
    }
    void state.save(() => savePurchaseDraft({ locationId, supplierId, expectedSupplierRevision: supplier.revision, supplierInvoiceNumber: header.number.trim(), invoiceDate: header.date, statedTotalPaise, notes: header.notes, lines: captured }, key, current));
  }
  const disabled = state.busy || !canManage;
  return <Modal open title={current ? "Purchase draft" : "New purchase draft"} onClose={onClose} busy={state.busy} size="lg" bodyClassName={styles.dialog} footer={<><Button size="sm" variant="outline" disabled={state.busy} onClick={onClose}>Cancel</Button>{current && canManage && <Button size="sm" variant="outline" disabled={state.busy} onClick={onPost}>Review saved draft for posting</Button>}{canManage && <Button size="sm" type="submit" form="purchase-draft-form" loading={state.busy}>Save purchase draft</Button>}</>}>
    <form id="purchase-draft-form" className={styles.form} onSubmit={submit} noValidate>
      <p className={styles.summary}>Draft only. Record amounts from the supplier invoice; stock receiving and supplier balances are separate steps.</p>
      {current?.calculation ? <section aria-label="Saved purchase calculation" className={styles.summary}>
        <p>Saved amounts. Save edits and reopen to refresh.</p>
        <p>Base after discounts: {money(current.calculation.totals.baseAmountPaise / 100)}. GST: {money(current.calculation.totals.unallocatedTaxPaise / 100)}.</p>
        <p>Calculated total: {money(current.calculation.totals.payablePaise / 100)}. Supplier stated total: {money(current.statedTotalPaise / 100)}.</p>
        <p>Difference (stated − calculated): {money((current.statedTotalPaise - current.calculation.totals.payablePaise) / 100)}.</p>
        <p>GST split and supplier tax evidence need review before posting.</p>
      </section> : current && <p className={styles.summary}>No saved calculation. Save this draft to calculate its amounts.</p>}
      {state.error && <Alert variant="error" title="Draft was not confirmed">{state.error}</Alert>}{searchError && <Alert variant="warning" title="Draft lookup needs attention">{searchError}</Alert>}
      <fieldset className={styles.form} disabled={disabled}>
        <Input label="Search suppliers" maxLength={100} value={partySearch} onChange={event => { setPartySearch(event.target.value); setSearchError(""); }} /><Select label="Purchase supplier *" value={supplierId} onChange={event => { setSupplierId(event.target.value); setSelectedParty(supplierOptions.find(row => row.id === event.target.value) || null); }} options={[{ value: "", label: "Choose supplier" }, ...supplierOptions.map(party => ({ value: party.id, label: party.name, disabled: party.archived }))]} />
        {current && <p className={styles.meta}>Saved supplier snapshot: {current.supplierSnapshot.name}. {current.supplierSnapshot.address}</p>}
        <div className={styles.fieldGrid}><Input label="Supplier invoice number *" maxLength={80} value={header.number} onChange={event => setHeader({ ...header, number: event.target.value })} /><Input label="Supplier invoice date *" type="date" value={header.date} onChange={event => setHeader({ ...header, date: event.target.value })} /></div>
        <Input label="Supplier stated total (INR) *" type="number" min="0" step="0.01" value={header.total} onChange={event => setHeader({ ...header, total: event.target.value })} />
        <Input label="Search purchase products" maxLength={100} value={productSearch} onChange={event => { setProductSearch(event.target.value); setSearchError(""); }} /><Select label="Purchase product" value={productId} onChange={event => setProductId(event.target.value)} options={[{ value: "", label: "Choose product with recorded units" }, ...products.map(product => ({ value: product.id, label: product.name }))]} /><Button size="sm" variant="outline" disabled={!productId || lines.length >= 100} onClick={addProduct}>Add purchase line</Button>
        {lines.map((line, index) => { const edit = (field: keyof FormLine, value: string) => setLines(previous => previous.map(row => row.lineId === line.lineId ? { ...row, [field]: value } : row)); return <fieldset className={styles.rx} key={line.lineId} aria-label={`Purchase line ${index + 1}: ${line.product.name}`}>
          <div className={styles.rowHeading}><strong>{line.product.name}</strong><Button size="sm" variant="ghost" aria-label={`Remove purchase line ${index + 1}`} onClick={() => setLines(previous => previous.filter(row => row.lineId !== line.lineId))}>Remove</Button></div><p>1 {line.product.unitDefinition.packUnit} = {line.product.unitDefinition.unitsPerPack} {line.product.unitDefinition.baseUnit}</p>
          <div className={styles.fieldGrid}>{numberFields.map((field, count) => <Input key={field} label={["Billed packs", "Billed loose units", "Free packs", "Free loose units"][count]} type="number" min="0" step="1" value={line[field]} onChange={event => edit(field, event.target.value)} />)}</div>
          <div className={styles.fieldGrid}><Input label="Base amount before discount/tax (INR)" type="number" min="0" step="0.01" value={line.baseAmount} onChange={event => edit("baseAmount", event.target.value)} /><Input label="Line discount (INR)" type="number" min="0" step="0.01" value={line.discount} onChange={event => edit("discount", event.target.value)} /></div>
          <div className={styles.fieldGrid}><Input label="Invoice HSN" value={line.hsn} onChange={event => edit("hsn", event.target.value)} /><Input label="Invoice GST (%)" type="number" min="0" max="100" step="0.01" value={line.gst} onChange={event => edit("gst", event.target.value)} /></div>
          <div className={styles.fieldGrid}><Input label={`Selling price per ${line.product.unitDefinition.baseUnit} (INR)`} type="number" min="0" step="0.01" value={line.sellingPrice} onChange={event => edit("sellingPrice", event.target.value)} /><Input label={`MRP per ${line.product.unitDefinition.baseUnit} (INR)`} type="number" min="0" step="0.01" value={line.mrp} onChange={event => edit("mrp", event.target.value)} /></div>
        </fieldset>; })}
        <Input label="Purchase draft notes" maxLength={1000} value={header.notes} onChange={event => setHeader({ ...header, notes: event.target.value })} />
      </fieldset>
    </form>
  </Modal>;
}
