"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input, Select } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { inspectPurchaseCsv, previewPurchaseCsv, rememberPurchaseCsvMapping, purchaseCsvLabels, type PurchaseCsvField, type PurchaseCsvInspection, type PurchaseCsvPreview, type PurchaseCsvRow } from "@/lib/pharmacyPurchaseCsv";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { purchasePage, type PurchaseProduct } from "@/services/pharmacyPurchase.service";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";

interface Props { locationId: string; supplierId: string; remaining: number; onApply: (rows: PurchaseCsvRow[]) => void; onCancel: () => void }
const message = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error instanceof Error ? error.message : "CSV could not be checked. Retry the preview.");
const label = (product: PurchaseProduct) => [product.name, product.strength, product.manufacturer].filter(Boolean).join(" · ");

export function PharmacyPurchaseCsv({ locationId, supplierId, remaining, onApply, onCancel }: Props) {
  const [csv, setCsv] = useState(""), [fileName, setFileName] = useState(""), [inspection, setInspection] = useState<PurchaseCsvInspection | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<PurchaseCsvField, string>>>({}), [matches, setMatches] = useState<Map<string, PurchaseProduct>>(new Map());
  const [priceBasis, setPriceBasis] = useState<"base_unit" | "pack">("base_unit");
  const [active, setActive] = useState(""), [search, setSearch] = useState(""), [products, setProducts] = useState<PurchaseProduct[]>([]), [productId, setProductId] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(), [next, setNext] = useState<string | null>(null), [loadedSearch, setLoadedSearch] = useState(""), [searchError, setSearchError] = useState("");
  const [preview, setPreview] = useState<PurchaseCsvPreview | null>(null), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [profileRevision, setProfileRevision] = useState(0), [restored, setRestored] = useState(false), [savedIssues, setSavedIssues] = useState<Map<string, string>>(new Map());
  const [remembered, setRemembered] = useState(false), [remembering, setRemembering] = useState(false), [rememberError, setRememberError] = useState("");
  const alive = useRef(true), rememberLock = useRef(false), scope = authScopeKey(useAuthStore(state => state.user));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const beginRead = useLatestRead(), beginSearch = useLatestRead();
  const searchKey = JSON.stringify([active, search, cursor, searchAttempt]);
  const searchBusy = Boolean(active && loadedSearch !== searchKey), visibleProducts = loadedSearch === searchKey ? products : [];
  const sources = inspection && mapping.source ? [...new Set(inspection.records.map(row => row.cells[mapping.source!].trim()))] : [];
  function invalidate() { beginRead(); setPreview(null); setConfirmed(false); setError(""); setRemembered(false); setRememberError(""); }
  useEffect(() => {
    const request = beginSearch();
    if (!active) return;
    const timer = setTimeout(() => { void purchasePage<PurchaseProduct>("purchase-products", locationId, { search, cursor }, request.signal).then(page => {
      if (request.isCurrent()) { setProducts(page.items); setNext(page.nextCursor); setSearchError(""); setLoadedSearch(searchKey); }
    }).catch(failure => { if (request.isCurrent()) { setProducts([]); setNext(null); setSearchError(message(failure)); setLoadedSearch(searchKey); } }); }, 250);
    return () => clearTimeout(timer);
  }, [active, beginSearch, locationId, search, cursor, searchKey]);

  async function choose(file?: File) {
    if (!file || busy) return;
    const request = beginRead(); setBusy(true); setError(""); setPreview(null); setConfirmed(false); setInspection(null); setCsv(""); setFileName(""); setMapping({}); setMatches(new Map()); setActive("");
    setPriceBasis("base_unit"); setProfileRevision(0); setRestored(false); setSavedIssues(new Map()); setRemembered(false); setRememberError("");
    try {
      if (file.size > 512000 || !/\.csv$/i.test(file.name)) throw new Error("Choose a UTF-8 .csv file, at most 512,000 bytes, from one supplier invoice.");
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); } catch { throw new Error("Save the file as UTF-8 CSV before importing."); }
      if (!request.isCurrent()) return;
      const result = await inspectPurchaseCsv(locationId, supplierId, text, request.signal);
      if (request.isCurrent()) {
        setCsv(text); setFileName(file.name); setInspection(result);
        setMapping(result.profile?.mapping || Object.fromEntries(result.fields.filter(field => result.headers.includes(field)).map(field => [field, field])));
        setProfileRevision(result.profile?.revision || 0); setRestored(Boolean(result.profile)); setPriceBasis(result.profile?.priceBasis || "base_unit");
        setMatches(new Map(result.profile?.matches.filter(match => match.product).map(match => [match.sourceValue, match.product!]) || []));
        setSavedIssues(new Map(result.profile?.matches.filter(match => match.error).map(match => [match.sourceValue, match.error!]) || []));
      }
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  async function check() {
    if (busy) return;
    const request = beginRead(); setBusy(true); setPreview(null); setConfirmed(false); setError("");
    try {
      const result = await previewPurchaseCsv({ locationId, supplierId, csv, mapping, priceBasis, matches: sources.filter(value => matches.has(value)).map(value => ({ sourceValue: value, medicineId: matches.get(value)!.id, expectedUnitVersion: matches.get(value)!.unitDefinition.version,
        ...(matches.get(value)!.identityHash ? { expectedIdentityHash: matches.get(value)!.identityHash } : {}) })) }, request.signal);
      if (request.isCurrent()) {
        if (result.rows.length !== inspection?.records.length || result.rows.some((row, index) => row.sourceLine !== inspection.records[index].sourceLine || row.sourceValue !== inspection.records[index].cells[mapping.source!].trim())) throw new Error("CSV source rows changed. Check the preview again.");
        setPreview(result);
      }
    } catch (failure) { if (request.isCurrent()) setError(message(failure)); }
    finally { if (request.isCurrent()) setBusy(false); }
  }
  async function remember() {
    if (busy || rememberLock.current || !preview || !inspection || !confirmed || preview.rows.some(row => row.error || !row.product?.identityHash)) return;
    rememberLock.current = true; setBusy(true); setRemembering(true); setRememberError("");
    const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
    try {
      const reviewed = [...new Map(preview.rows.map(row => [row.sourceValue, { sourceValue: row.sourceValue, medicineId: row.product!.id,
        expectedUnitVersion: row.product!.unitDefinition.version, expectedIdentityHash: row.product!.identityHash! }])).values()];
      const result = await rememberPurchaseCsvMapping({ locationId, supplierId, csv, mapping, priceBasis, matches: reviewed, expectedRevision: profileRevision, confirmedMappings: true }, inspection.formatKey);
      if (current()) { setProfileRevision(result.revision); setRemembered(true); }
    } catch (failure) { if (current()) setRememberError(message(failure)); }
    finally { rememberLock.current = false; if (current()) { setBusy(false); setRemembering(false); } }
  }
  const invalidRows = preview?.rows.filter(row => row.error !== null).length || 0;
  return <section className={styles.rx} aria-label="Import supplier invoice CSV">
    <div className={styles.rowHeading}><h3>Import purchase lines</h3><Button size="sm" variant="ghost" onClick={onCancel}>Close CSV import</Button></div>
    <p className={styles.summary}>One supplier invoice, up to {remaining} additional lines. Amounts are INR; quantities are the selected medicine’s packs or loose base units. Stock is received later with printed batch and expiry.</p>
    <Input label="Supplier invoice CSV" type="file" accept=".csv,text/csv" disabled={busy} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
    {error && <Alert variant="error" title="CSV needs attention">{error}</Alert>}
    {busy && <p role="status">{remembering ? "Saving supplier mappings…" : "Checking purchase CSV…"}</p>}
    {inspection && <>
      <p>{fileName} · {inspection.records.length} lines</p>
      {restored && <p role="status">Saved supplier format loaded. Review reused medicine matches; changed items need matching again.</p>}
      {inspection.records.length > remaining && <Alert variant="warning" title="Too many purchase lines">This file exceeds the {remaining} remaining lines. Split the source invoice lines before importing.</Alert>}
      <div className={styles.fieldGrid}>{inspection.fields.map(field => <Select key={field} label={purchaseCsvLabels[field]} disabled={busy} value={mapping[field] || ""} onChange={event => {
        invalidate(); const column = event.target.value;
        setMapping(previous => { const updated = { ...previous }; if (column) updated[field] = column; else delete updated[field]; return updated; });
        if (field === "source") { setMatches(new Map()); setSavedIssues(new Map()); setActive(""); }
      }} options={[{ value: "", label: "Not mapped" }, ...inspection.headers.map(header => ({ value: header, label: header }))]} />)}</div>
      <Select label="CSV selling price / MRP basis" disabled={busy} value={priceBasis} onChange={event => { invalidate(); setPriceBasis(event.target.value as "base_unit" | "pack"); }} options={[{ value: "base_unit", label: "Per base unit (tablet, piece, etc.)" }, { value: "pack", label: "Per selected full pack (strip, box, etc.)" }]} />
      <p className={styles.summary}>Map line amounts, not unit purchase rates. Pack selling prices/MRP convert using the matched medicine’s pack size; fractional paise need review. Unmapped quantity/discount columns mean zero; mapped blank numbers need correction. GST and HSN are explicit source values.</p>
      {sources.length > 0 && <section aria-label="Match CSV medicines" className={styles.form}><h3>Match source items</h3>
        <p className={styles.summary}>Use an item code or description that uniquely identifies the medicine, strength, manufacturer and pack. Repeated source items share your selection.</p>
        {sources.map((value, index) => <div key={value} className={styles.card}><div className={styles.identity}><strong>{value || "Blank source item"}</strong><small>{matches.has(value) ? `${label(matches.get(value)!)} · 1 ${matches.get(value)!.unitDefinition.packUnit} = ${matches.get(value)!.unitDefinition.unitsPerPack} ${matches.get(value)!.unitDefinition.baseUnit}` : savedIssues.get(value) || "Not matched"}</small></div>
          <Button size="sm" variant="outline" disabled={busy || !value} aria-label={`Match source item ${index + 1}: ${value}`} onClick={() => { setProductId(""); setActive(value); setSearch(""); setCursor(undefined); }}>Match</Button></div>)}
        {active && <div className={styles.form}><strong>Match: {active}</strong><Input label="Search medicines for CSV match" value={search} maxLength={100} disabled={busy} onChange={event => { beginSearch(); setProducts([]); setProductId(""); setSearch(event.target.value); setCursor(undefined); }} />
          {searchBusy && <p role="status">Finding purchase medicines…</p>}{!searchBusy && searchError && <Alert variant="error" title="Medicine search unavailable" action={<Button size="sm" variant="outline" onClick={() => setSearchAttempt(value => value + 1)}>Retry medicine match search</Button>}>{searchError}</Alert>}
          <Select label="Existing medicine for source item" disabled={busy || searchBusy} value={productId} onChange={event => setProductId(event.target.value)} options={[{ value: "", label: "Choose medicine and check pack size" }, ...visibleProducts.map(product => ({ value: product.id, label: `${label(product)} · ${product.unitDefinition.unitsPerPack} ${product.unitDefinition.baseUnit}/${product.unitDefinition.packUnit}` }))]} />
          <div className={styles.actions}><Button size="sm" disabled={busy || searchBusy || !productId} onClick={() => { const product = visibleProducts.find(row => row.id === productId); if (!product) return; invalidate(); setMatches(previous => new Map(previous).set(active, product)); setSavedIssues(previous => { const updated = new Map(previous); updated.delete(active); return updated; }); setActive(""); }}>Use selected medicine</Button>
            {cursor && <Button size="sm" variant="outline" disabled={busy || searchBusy} onClick={() => { setProductId(""); setCursor(undefined); }}>First medicine page</Button>}{!searchBusy && next && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setProductId(""); setCursor(next); }}>More medicines</Button>}</div>
        </div>}
      </section>}
      <Button size="sm" variant="outline" disabled={busy || !sources.length || inspection.records.length > remaining} onClick={() => { void check(); }}>Preview purchase lines</Button>
    </>}
    {preview && <section className={styles.form} aria-label="Purchase CSV preview">
      <p>{preview.rows.length} source lines · {invalidRows} need correction</p>
      <div className={styles.reportTable}><table><caption>Review quantities and source amounts before adding to the draft</caption><thead><tr><th>CSV line / item</th><th>Medicine / pack</th><th>Billed / free</th><th>Amounts / tax</th></tr></thead><tbody>
        {preview.rows.map(row => <tr key={row.sourceLine}><td>{row.sourceLine} · {row.sourceValue}</td>{row.error ? <td colSpan={3}>{row.error}</td> : <><td>{label(row.product!)}<br />1 {row.product!.unitDefinition.packUnit} = {row.product!.unitDefinition.unitsPerPack} {row.product!.unitDefinition.baseUnit}</td>
          <td>{row.line!.packs} packs + {row.line!.looseUnits} loose<br />Free: {row.line!.freePacks} packs + {row.line!.freeLooseUnits} loose</td><td>Base {money(row.line!.baseAmountPaise / 100)} · Discount {money(row.line!.discountPaise / 100)}<br />GST {row.line!.gstRateBps / 100}% · HSN {row.line!.hsnCode}<br />Sell {money(row.line!.sellingPricePaise / 100)} / {row.product!.unitDefinition.baseUnit} · MRP {row.line!.mrpPaise === undefined ? "Not recorded" : money(row.line!.mrpPaise / 100)}</td></>}</tr>)}
      </tbody></table></div>
      {preview.ignoredColumns.length > 0 && <p className={styles.summary}>Unused columns: {preview.ignoredColumns.join(", ")}. Header details, printed batches and expiry must be recorded in their respective draft/receipt steps.</p>}
      <Checkbox label="I checked medicine identity, pack sizes, quantities and per-unit prices against the supplier invoice" checked={confirmed} disabled={busy || invalidRows > 0} onChange={event => setConfirmed(event.target.checked)} />
      {rememberError && <Alert variant="warning" title="Supplier mappings were not confirmed">{rememberError}</Alert>}
      {remembered ? <p role="status">Mappings saved for this supplier and branch. The purchase draft still needs Save.</p> : <Button size="sm" variant="outline" disabled={busy || !confirmed || invalidRows > 0 || preview.rows.some(row => !row.product?.identityHash)} onClick={() => { void remember(); }}>Remember mappings for this supplier</Button>}
      <Button size="sm" disabled={busy || !confirmed || invalidRows > 0 || preview.rows.length > remaining} onClick={() => onApply(preview.rows)}>Add {preview.rows.length} CSV lines to draft</Button>
    </section>}
  </section>;
}
