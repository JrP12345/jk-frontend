"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, DatePicker, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { adoptCatalogueProduct, searchGlobalProducts, type GlobalCataloguePage, type GlobalCatalogueProduct } from "@/lib/pharmacyGlobalCatalogue";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import type { PurchaseProduct } from "@/services/pharmacyPurchase.service";
import styles from "./PharmacyWorkspace.module.css";

interface Props { locationId: string; inventoryMode?: "tracked" | "billing_only"; initialSearch?: string; onClose: () => void; onAdded: (product: PurchaseProduct) => void; onCreateLocal?: () => void }
const message = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error instanceof Error ? error.message : "Catalogue unavailable");
export function PharmacyCatalogueDiscovery(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <CatalogueSession key={`${scope}:${props.locationId}`} {...props} />;
}
function CatalogueSession({ locationId, inventoryMode = "tracked", initialSearch = "", onClose, onAdded, onCreateLocal }: Props) {
  const [search, setSearch] = useState(initialSearch.slice(0, 100)), [cursor, setCursor] = useState<string>();
  const [page, setPage] = useState<GlobalCataloguePage | null>(null), [selected, setSelected] = useState<GlobalCatalogueProduct | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ genericName: "", category: "", baseUnit: "", packUnit: "", unitsPerPack: "", price: "", batchNumber: "", expiry: "", mrp: "" }), [confirmed, setConfirmed] = useState(false);
  const beginRead = useLatestRead(), lock = useRef(false), alive = useRef(true);
  const scope = authScopeKey(useAuthStore(state => state.user));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const request = beginRead();
    const timer = setTimeout(() => {
      void searchGlobalProducts(locationId, search, cursor, request.signal).then(result => {
        if (request.isCurrent()) { setPage(result); setError(""); setLoading(false); }
      }).catch(failure => { if (request.isCurrent()) { setError(message(failure)); setLoading(false); } });
    }, 250);
    return () => { clearTimeout(timer); beginRead(); };
  }, [locationId, search, cursor, attempt, beginRead]);
  const change = (field: keyof typeof form, value: string) => { setConfirmed(false); setForm(previous => ({ ...previous, [field]: value })); };
  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !confirmed || lock.current) return;
    const parsed = selected.alreadyAdded ? 0 : parseReceiptPaise(form.price);
    if (parsed === null) { setError("Enter a valid branch selling price with at most two decimal places"); return; }
    const sellingPricePaise = parsed;
    const mrpPaise = parseReceiptPaise(form.mrp);
    if (!selected.alreadyAdded && inventoryMode === "billing_only" && (mrpPaise === null || mrpPaise < sellingPricePaise || !form.batchNumber.trim() || !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.expiry))) { setError("Enter the actual printed batch, expiry month and MRP. Selling price cannot exceed MRP."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const product = await adoptCatalogueProduct(selected.id, { locationId, expectedRevision: selected.revision, ...(!selected.alreadyAdded ? { sellingPricePaise, category: form.category,
        unitDefinition: { baseUnit: form.baseUnit, packUnit: form.packUnit, unitsPerPack: Number(form.unitsPerPack) },
        ...(inventoryMode === "billing_only" ? { billingSupply: { batchNumber: form.batchNumber.trim(), expiry: { precision: "month" as const, value: form.expiry }, mrpPaise: mrpPaise! } } : {}),
        ...(!selected.genericName && !selected.composition ? { genericName: form.genericName } : {}) } : {}), confirmedIdentity: true });
      if (alive.current && scope === authScopeKey(useAuthStore.getState().user)) onAdded(product);
    } catch (failure) { if (alive.current && scope === authScopeKey(useAuthStore.getState().user)) setError(message(failure)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const options = (values: string[]) => [{ value: "", label: "Select actual value" }, ...values.map(value => ({ value, label: value }))];
  const showCdciCredit = selected?.provider === "cdci" || (!selected && page?.items.some(item => item.provider === "cdci"));
  return <Modal open onClose={onClose} busy={busy} title="Find in product catalogue" size="lg" bodyClassName={styles.dialog}>
    <p className="text-sm">Choose the exact brand, composition, strength, manufacturer and pack. Adding creates an empty branch product; prices, stock, batches and sale approvals are separate.</p>
    {error && <Alert variant="error" title="Catalogue needs attention">{error}<Button size="sm" variant="outline" disabled={busy} onClick={() => { setSelected(null); setConfirmed(false); setLoading(true); setAttempt(value => value + 1); }}>Retry search</Button></Alert>}
    {!selected ? <div className="space-y-3">
      <Input label="Search brand, generic, salt, manufacturer or barcode" value={search} maxLength={100} onChange={event => { beginRead(); setLoading(true); setPage(null); setCursor(undefined); setSearch(event.target.value); }} />
      {loading ? <p role="status">Searching catalogue…</p> : page?.items.length ? <ul className="space-y-2">{page.items.map(item => <li key={item.id} className={styles.card}>
        <div className={styles.identity}><strong>{item.name}</strong><small>{[item.genericName || item.composition, item.strength, item.dosageForm, item.manufacturer, item.packSize].filter(Boolean).join(" · ")}</small>{item.supplierName && <small>Source supplier: {item.supplierName}</small>}<small>{item.provider} · {item.sourceId} · {item.release}</small></div>
        <Button size="sm" variant="outline" onClick={() => { setSelected(item); setConfirmed(false); setError(""); }}>{item.alreadyAdded ? "Use branch product" : "Review & add"}</Button>
      </li>)}</ul> : <p>No matching shared products. Try another name or use a local medicine. External sources appear only after their data and usage rights have been reviewed.</p>}
      <div className={styles.actions}>{cursor && <Button variant="outline" size="sm" onClick={() => { setLoading(true); setCursor(undefined); }}>First page</Button>}{page?.nextCursor && <Button variant="outline" size="sm" disabled={loading} onClick={() => { setLoading(true); setCursor(page.nextCursor!); }}>More products</Button>}
        {onCreateLocal && <Button variant="outline" onClick={onCreateLocal}>Create local medicine instead</Button>}</div>
      <p className="text-xs text-text-secondary">{page?.sourceNotice || "Sources require verified commercial-use permission before products can be loaded."}</p>
    </div> : <form onSubmit={add} className="space-y-3"><fieldset disabled={busy} className="space-y-3">
      <strong>{selected.name}</strong><p>{[selected.genericName || selected.composition, selected.strength, selected.manufacturer, selected.dosageForm, selected.packSize].filter(Boolean).join(" · ")}</p>
      {selected.supplierName && <p className="text-sm">Source supplier: {selected.supplierName}. Confirm the actual manufacturer from the pack or purchase record.</p>}
      {selected.provider === "cdci" && <p className="text-sm">CDCI is a medicine reference. Confirm the physical pack and units below; this source supplies no verified pack conversion, barcode, price or stock.</p>}
      <p className="text-sm">Source: {selected.provider} · {selected.sourceId} · {selected.release}</p>
      {selected.alreadyAdded ? <p>This reference is already linked. Continuing uses the existing branch product and retains its prices and units.</p> : <>
        {!selected.genericName && !selected.composition && <Input label="Actual generic / formulation" required maxLength={500} value={form.genericName} onChange={event => change("genericName", event.target.value)} />}
        <div className={styles.fieldGrid}><Select label="Medicine form" required value={form.category} options={options(["tablet", "capsule", "syrup", "injection", "ointment", "drops", "inhaler", "other"])} onChange={event => change("category", event.target.value)} />
          <Select label="Base unit" required value={form.baseUnit} options={options(["tablet", "capsule", "ml", "g", "piece", "dose"])} onChange={event => change("baseUnit", event.target.value)} />
          <Select label="Pack unit" required value={form.packUnit} options={options(["strip", "box", "bottle", "vial", "tube", "ampoule", "sachet", "pack", "piece"])} onChange={event => change("packUnit", event.target.value)} />
          <Input label="Base units per pack" required type="number" min={1} max={1000000} step={1} value={form.unitsPerPack} onChange={event => change("unitsPerPack", event.target.value)} />
          <Input label="Branch selling price per base unit (INR)" required inputMode="decimal" value={form.price} onChange={event => change("price", event.target.value)} /></div>
        {inventoryMode === "billing_only" && <div className={styles.fieldGrid}>
          <p className="text-sm">Stock is not tracked here. Copy these supply details from the actual pack for billing; no stock will be created.</p>
          <Input label="Printed batch number" required maxLength={100} value={form.batchNumber} onChange={event => change("batchNumber", event.target.value)} />
          <DatePicker label="Printed expiry month" required mode="month" value={form.expiry} onChange={value => change("expiry", value)} />
          <Input label="Printed MRP per base unit (INR)" required inputMode="decimal" value={form.mrp} onChange={event => change("mrp", event.target.value)} />
        </div>}
      </>}
      <Checkbox label="I confirmed the exact medicine identity and actual pack conversion" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
      <div className={styles.actions}><Button variant="outline" onClick={() => { setSelected(null); setConfirmed(false); }}>Back to results</Button><Button type="submit" loading={busy} disabled={!confirmed}>{selected.alreadyAdded ? "Use existing branch product" : "Add empty product"}</Button></div>
    </fieldset></form>}
    {showCdciCredit && <p className="text-xs text-text-secondary">Reference data: <a className="underline" href="https://www.nrces.in/services/national-releases" target="_blank" rel="noopener noreferrer">Common Drug Codes for India, NRCeS / C-DAC Pune</a>. Adapted for catalogue search under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>; SNOMED CT content remains subject to its affiliate terms. Source accuracy and completeness are not guaranteed.</p>}
  </Modal>;
}
