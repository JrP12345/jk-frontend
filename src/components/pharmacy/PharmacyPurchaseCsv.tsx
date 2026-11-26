"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Checkbox, Input, Select, Spinner, cn } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import {
  inspectPurchaseCsv,
  previewPurchaseCsv,
  rememberPurchaseCsvMapping,
  purchaseCsvLabels,
  type PurchaseCsvField,
  type PurchaseCsvInspection,
  type PurchaseCsvPreview,
  type PurchaseCsvRow,
} from "@/lib/pharmacyPurchaseCsv";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { purchasePage, type PurchaseProduct } from "@/services/pharmacyPurchase.service";
import { hasAnyPermission } from "@/lib/permissions";
import { readPharmacyImportFile } from "@/lib/pharmacyImportFile";
import { money } from "./pharmacyWorkspace";
import { PharmacyCatalogueDiscovery } from "./PharmacyCatalogueDiscovery";
import { PharmacyInvoiceExtraction } from "./PharmacyInvoiceExtraction";

interface Props {
  locationId: string;
  supplierId: string;
  remaining: number;
  onApply: (rows: PurchaseCsvRow[]) => void;
  onCancel: () => void;
}

const message = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (error instanceof Error ? error.message : "CSV could not be checked. Retry the preview.");

const label = (product: PurchaseProduct) => [product.name, product.strength, product.manufacturer].filter(Boolean).join(" · ");

export function PharmacyPurchaseCsv({ locationId, supplierId, remaining, onApply, onCancel }: Props) {
  const mobile = useMobileViewport();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [inspection, setInspection] = useState<PurchaseCsvInspection | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<PurchaseCsvField, string>>>({});
  const [matches, setMatches] = useState<Map<string, PurchaseProduct>>(new Map());
  const [priceBasis, setPriceBasis] = useState<"base_unit" | "pack" | "outer_pack">("base_unit");
  const [active, setActive] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [next, setNext] = useState<string | null>(null);
  const [loadedSearch, setLoadedSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [preview, setPreview] = useState<PurchaseCsvPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [discover, setDiscover] = useState(false);
  const catalogueUser = useAuthStore(state => state.user);
  const canAddCatalogue = hasAnyPermission(catalogueUser, "PHARMACY_MANAGE_CATALOG", "MANAGE_ORGANIZATION");
  const [profileRevision, setProfileRevision] = useState(0);
  const [restored, setRestored] = useState(false);
  const [savedIssues, setSavedIssues] = useState<Map<string, string>>(new Map());
  const [remembered, setRemembered] = useState(false);
  const [remembering, setRemembering] = useState(false);
  const [rememberError, setRememberError] = useState("");
  const alive = useRef(true);
  const rememberLock = useRef(false);
  const scope = authScopeKey(useAuthStore(state => state.user));
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const beginRead = useLatestRead();
  const beginSearch = useLatestRead();
  const searchKey = JSON.stringify([active, search, cursor, searchAttempt]);
  const searchBusy = Boolean(active && loadedSearch !== searchKey);
  const visibleProducts = loadedSearch === searchKey ? products : [];
  const sources = inspection && mapping.source ? [...new Set(inspection.records.map(row => row.cells[mapping.source!].trim()))] : [];

  function invalidate() {
    beginRead();
    setPreview(null);
    setConfirmed(false);
    setError("");
    setRemembered(false);
    setRememberError("");
  }

  useEffect(() => {
    const request = beginSearch();
    if (!active) return;
    const timer = setTimeout(() => {
      void purchasePage<PurchaseProduct>("purchase-products", locationId, { search, cursor }, request.signal)
        .then(page => {
          if (request.isCurrent()) {
            setProducts(page.items);
            setNext(page.nextCursor);
            setSearchError("");
            setLoadedSearch(searchKey);
          }
        })
        .catch(failure => {
          if (request.isCurrent()) {
            setProducts([]);
            setNext(null);
            setSearchError(message(failure));
            setLoadedSearch(searchKey);
          }
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [active, beginSearch, locationId, search, cursor, searchKey]);

  async function choose(file?: File) {
    if (!file || busy) return;
    const request = beginRead();
    setBusy(true);
    setError("");
    setPreview(null);
    setConfirmed(false);
    setInspection(null);
    setCsv("");
    setFileName("");
    setMapping({});
    setMatches(new Map());
    setActive("");
    setPriceBasis("base_unit");
    setProfileRevision(0);
    setRestored(false);
    setSavedIssues(new Map());
    setRemembered(false);
    setRememberError("");
    try {
      const text = await readPharmacyImportFile(file);
      if (!request.isCurrent()) return;
      const result = await inspectPurchaseCsv(locationId, supplierId, text, request.signal);
      if (request.isCurrent()) {
        setCsv(text);
        setFileName(file.name);
        setInspection(result);
        setMapping(result.profile?.mapping || Object.fromEntries(result.fields.filter(field => result.headers.includes(field)).map(field => [field, field])));
        setProfileRevision(result.profile?.revision || 0);
        setRestored(Boolean(result.profile));
        setPriceBasis(result.profile?.priceBasis || "base_unit");
        setMatches(new Map(result.profile?.matches.filter(match => match.product).map(match => [match.sourceValue, match.product!]) || []));
        setSavedIssues(new Map(result.profile?.matches.filter(match => match.error).map(match => [match.sourceValue, match.error!]) || []));
      }
    } catch (failure) {
      if (request.isCurrent()) setError(message(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function check() {
    if (busy) return;
    const request = beginRead();
    setBusy(true);
    setPreview(null);
    setConfirmed(false);
    setError("");
    try {
      const result = await previewPurchaseCsv(
        {
          locationId,
          supplierId,
          csv,
          mapping,
          priceBasis,
          matches: sources
            .filter(value => matches.has(value))
            .map(value => ({
              sourceValue: value,
              medicineId: matches.get(value)!.id,
              expectedUnitVersion: matches.get(value)!.unitDefinition.version,
              ...(matches.get(value)!.identityHash ? { expectedIdentityHash: matches.get(value)!.identityHash } : {}),
            })),
        },
        request.signal
      );
      if (request.isCurrent()) {
        if (
          result.rows.length !== inspection?.records.length ||
          result.rows.some((row, index) => row.sourceLine !== inspection.records[index].sourceLine || row.sourceValue !== inspection.records[index].cells[mapping.source!].trim())
        ) {
          throw new Error("CSV source rows changed. Check the preview again.");
        }
        setPreview(result);
      }
    } catch (failure) {
      if (request.isCurrent()) setError(message(failure));
    } finally {
      if (request.isCurrent()) setBusy(false);
    }
  }

  async function remember() {
    if (busy || rememberLock.current || !preview || !inspection || !confirmed || preview.rows.some(row => row.error || !row.product?.identityHash)) {
      return;
    }
    rememberLock.current = true;
    setBusy(true);
    setRemembering(true);
    setRememberError("");
    const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
    try {
      const reviewed = [
        ...new Map(
          preview.rows.map(row => [
            row.sourceValue,
            {
              sourceValue: row.sourceValue,
              medicineId: row.product!.id,
              expectedUnitVersion: row.product!.unitDefinition.version,
              expectedIdentityHash: row.product!.identityHash!,
            },
          ])
        ).values(),
      ];
      const result = await rememberPurchaseCsvMapping(
        {
          locationId,
          supplierId,
          csv,
          mapping,
          priceBasis,
          matches: reviewed,
          expectedRevision: profileRevision,
          confirmedMappings: true,
        },
        inspection.formatKey
      );
      if (current()) {
        setProfileRevision(result.revision);
        setRemembered(true);
      }
    } catch (failure) {
      if (current()) setRememberError(message(failure));
    } finally {
      rememberLock.current = false;
      if (current()) {
        setBusy(false);
        setRemembering(false);
      }
    }
  }

  const invalidRows = preview?.rows.filter(row => row.error !== null).length || 0;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface-alt/30 p-3 text-xs" aria-label="Import supplier invoice CSV">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <h3 className="text-xs font-semibold text-text">Import purchase lines</h3>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Close CSV import
        </Button>
      </div>

      <p className="rounded-lg border border-border/60 bg-surface p-2.5 leading-relaxed text-text-secondary">
        One supplier invoice, up to {remaining} additional lines. Amounts are INR; quantities are the selected medicine’s packs or loose
        base units. Stock is received later with printed batch and expiry.
      </p>

      <Input
        size="sm"
        label="Supplier invoice CSV or values-only Excel"
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={busy}
        onChange={event => {
          void choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <PharmacyInvoiceExtraction
        locationId={locationId}
        supplierId={supplierId}
        onCsv={text => {
          if (!busy) void choose(new File([text], "reviewed-invoice-ocr.csv", { type: "text/csv" }));
        }}
      />

      {error && (
        <Alert variant="error" title="CSV needs attention">
          {error}
        </Alert>
      )}
      {busy && (
        <div role="status" className="flex items-center gap-2 text-text-secondary">
          <Spinner size="sm" />
          {remembering ? "Saving supplier mappings…" : "Checking purchase CSV…"}
        </div>
      )}

      {inspection && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" size="sm">
              {fileName} · {inspection.records.length} lines
            </Badge>
            {restored && (
              <p role="status" className="text-[11px] font-medium text-accent">
                Saved supplier format loaded. Review reused medicine matches; changed items need matching again.
              </p>
            )}
          </div>

          {inspection.records.length > remaining && (
            <Alert variant="warning" title="Too many purchase lines">
              This file exceeds the {remaining} remaining lines. Split the source invoice lines before importing.
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {inspection.fields.map(field => (
              <Select
                key={field}
                size="sm"
                label={purchaseCsvLabels[field]}
                disabled={busy}
                value={mapping[field] || ""}
                onChange={event => {
                  invalidate();
                  const column = event.target.value;
                  setMapping(previous => {
                    const updated = { ...previous };
                    if (column) updated[field] = column;
                    else delete updated[field];
                    return updated;
                  });
                  if (field === "source") {
                    setMatches(new Map());
                    setSavedIssues(new Map());
                    setActive("");
                  }
                }}
                options={[
                  { value: "", label: "Not mapped" },
                  ...inspection.headers.map(header => ({ value: header, label: header })),
                ]}
              />
            ))}
          </div>

          <Select
            size="sm"
            label="CSV selling price / MRP basis"
            disabled={busy}
            value={priceBasis}
            onChange={event => {
              invalidate();
              setPriceBasis(event.target.value as "base_unit" | "pack" | "outer_pack");
            }}
            options={[
              { value: "base_unit", label: "Per base unit (tablet, piece, etc.)" },
              { value: "pack", label: "Per selected full pack (strip, box, etc.)" },
              { value: "outer_pack", label: "Per recorded outer pack (box of strips, etc.)" },
            ]}
          />

          <p className="rounded-lg border border-border/60 bg-surface p-2.5 leading-relaxed text-text-secondary">
            Map line amounts, not unit purchase rates. Pack selling prices/MRP convert using the matched medicine’s pack size; fractional
            paise need review. Unmapped quantity/discount columns mean zero; mapped blank numbers need correction. GST and HSN are explicit
            source values.
          </p>

          {sources.length > 0 && (
            <section aria-label="Match CSV medicines" className="space-y-2.5 rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-semibold text-text">Match source items</h3>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Use an item code or description that uniquely identifies the medicine, strength, manufacturer and pack. Repeated source items
                share your selection.
              </p>

              <div className="divide-y divide-border/60 rounded-xl border border-border/70">
                {sources.map((value, index) => (
                  <div key={value} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <strong className="block text-xs font-semibold text-text">{value || "Blank source item"}</strong>
                      <small className={cn("block text-[11px]", matches.has(value) ? "text-text-secondary" : "text-warning-text")}>
                        {matches.has(value)
                          ? `${label(matches.get(value)!)} · 1 ${matches.get(value)!.unitDefinition.packUnit} = ${matches.get(value)!.unitDefinition.unitsPerPack} ${matches.get(value)!.unitDefinition.baseUnit}`
                          : savedIssues.get(value) || "Not matched"}
                      </small>
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={busy || !value}
                      aria-label={`Match source item ${index + 1}: ${value}`}
                      onClick={() => {
                        setProductId("");
                        setActive(value);
                        setSearch("");
                        setCursor(undefined);
                      }}
                    >
                      Match
                    </Button>
                  </div>
                ))}
              </div>

              {active && (
                <div className="space-y-3 rounded-xl border border-border/70 bg-surface-alt/40 p-3">
                  <strong className="block text-xs font-semibold text-text">Match: {active}</strong>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Input
                      size="sm"
                      label="Search medicines for CSV match"
                      value={search}
                      maxLength={100}
                      disabled={busy}
                      onChange={event => {
                        beginSearch();
                        setProducts([]);
                        setProductId("");
                        setSearch(event.target.value);
                        setCursor(undefined);
                      }}
                    />
                    <Select
                      size="sm"
                      label="Existing medicine for source item"
                      disabled={busy || searchBusy}
                      value={productId}
                      onChange={event => setProductId(event.target.value)}
                      options={[
                        { value: "", label: "Choose medicine and check pack size" },
                        ...visibleProducts.map(product => ({
                          value: product.id,
                          label: `${label(product)} · ${product.unitDefinition.unitsPerPack} ${product.unitDefinition.baseUnit}/${product.unitDefinition.packUnit}`,
                        })),
                      ]}
                    />
                  </div>
                  {searchBusy && (
                    <div role="status" className="flex items-center gap-2 text-text-secondary">
                      <Spinner size="sm" />
                      Finding purchase medicines…
                    </div>
                  )}
                  {!searchBusy && searchError && (
                    <Alert
                      variant="error"
                      title="Medicine search unavailable"
                      action={
                        <Button size="xs" variant="outline" onClick={() => setSearchAttempt(value => value + 1)}>
                          Retry medicine match search
                        </Button>
                      }
                    >
                      {searchError}
                    </Alert>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="xs"
                      disabled={busy || searchBusy || !productId}
                      onClick={() => {
                        const product = visibleProducts.find(row => row.id === productId);
                        if (!product) return;
                        invalidate();
                        setMatches(previous => new Map(previous).set(active, product));
                        setSavedIssues(previous => {
                          const updated = new Map(previous);
                          updated.delete(active);
                          return updated;
                        });
                        setActive("");
                      }}
                    >
                      Use selected medicine
                    </Button>
                    {canAddCatalogue && (
                      <Button size="xs" variant="outline" disabled={busy} onClick={() => setDiscover(true)}>
                        Missing product? Find in catalogue
                      </Button>
                    )}
                    {cursor && (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy || searchBusy}
                        onClick={() => {
                          setProductId("");
                          setCursor(undefined);
                        }}
                      >
                        First medicine page
                      </Button>
                    )}
                    {!searchBusy && next && (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setProductId("");
                          setCursor(next);
                        }}
                      >
                        More medicines
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          <div>
            <Button
              size="xs"
              variant="outline"
              disabled={busy || !sources.length || inspection.records.length > remaining}
              onClick={() => {
                void check();
              }}
            >
              Preview purchase lines
            </Button>
          </div>
        </div>
      )}

      {preview && (
        <section className="space-y-3 rounded-xl border border-border bg-surface p-3" aria-label="Purchase CSV preview">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-text">
              {preview.rows.length} source lines · {invalidRows} need correction
            </p>
            <Badge variant={invalidRows > 0 ? "warning" : "success"} size="sm">
              {invalidRows > 0 ? `${invalidRows} issues` : "Ready to review"}
            </Badge>
          </div>

          {mobile ? (
            <div className="divide-y divide-border/60 rounded-xl border border-border/70">
              {preview.rows.map(row => (
                <article key={row.sourceLine} className="space-y-1.5 p-3">
                  <strong className="block text-xs font-semibold text-text">
                    {row.sourceLine} · {row.sourceValue}
                  </strong>
                  {row.error ? (
                    <p className="text-danger-text">{row.error}</p>
                  ) : (
                    <div className="space-y-1 text-[11px] text-text-secondary">
                      <p className="font-medium text-text">{label(row.product!)}</p>
                      <p>
                        1 {row.product!.unitDefinition.packUnit} = {row.product!.unitDefinition.unitsPerPack}{" "}
                        {row.product!.unitDefinition.baseUnit}
                      </p>
                      <p>
                        {row.line!.packs} packs + {row.line!.looseUnits} loose · Free: {row.line!.freePacks} packs +{" "}
                        {row.line!.freeLooseUnits} loose
                      </p>
                      <p>
                        Base {money(row.line!.baseAmountPaise / 100)} · Discount {money(row.line!.discountPaise / 100)} · GST{" "}
                        {row.line!.gstRateBps / 100}% · HSN {row.line!.hsnCode}
                      </p>
                      <p>
                        Sell {money(row.line!.sellingPricePaise / 100)} / {row.product!.unitDefinition.baseUnit} · MRP{" "}
                        {row.line!.mrpPaise === undefined ? "Not recorded" : money(row.line!.mrpPaise / 100)}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full border-collapse text-left text-xs">
                <caption className="px-3 py-2 text-left text-[11px] text-text-secondary">
                  Review quantities and source amounts before adding to the draft
                </caption>
                <thead className="border-y border-border/80 bg-surface-alt/70 font-semibold text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">CSV line / item</th>
                    <th className="px-3 py-2">Medicine / pack</th>
                    <th className="px-3 py-2">Billed / free</th>
                    <th className="px-3 py-2">Amounts / tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {preview.rows.map(row => (
                    <tr key={row.sourceLine}>
                      <td className="px-3 py-2 align-top">
                        {row.sourceLine} · {row.sourceValue}
                      </td>
                      {row.error ? (
                        <td colSpan={3} className="px-3 py-2 align-top text-danger-text">
                          {row.error}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 align-top">
                            {label(row.product!)}
                            <br />1 {row.product!.unitDefinition.packUnit} = {row.product!.unitDefinition.unitsPerPack}{" "}
                            {row.product!.unitDefinition.baseUnit}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.line!.packs} packs + {row.line!.looseUnits} loose
                            <br />
                            Free: {row.line!.freePacks} packs + {row.line!.freeLooseUnits} loose
                          </td>
                          <td className="px-3 py-2 align-top tabular-nums">
                            Base {money(row.line!.baseAmountPaise / 100)} · Discount {money(row.line!.discountPaise / 100)}
                            <br />
                            GST {row.line!.gstRateBps / 100}% · HSN {row.line!.hsnCode}
                            <br />
                            Sell {money(row.line!.sellingPricePaise / 100)} / {row.product!.unitDefinition.baseUnit} · MRP{" "}
                            {row.line!.mrpPaise === undefined ? "Not recorded" : money(row.line!.mrpPaise / 100)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.ignoredColumns.length > 0 && (
            <p className="rounded-lg bg-surface-alt/50 p-2.5 text-[11px] text-text-secondary">
              Unused columns: {preview.ignoredColumns.join(", ")}. Header details, printed batches and expiry must be recorded in their
              respective draft/receipt steps.
            </p>
          )}

          <Checkbox
            label="I checked medicine identity, pack sizes, quantities and per-unit prices against the supplier invoice"
            checked={confirmed}
            disabled={busy || invalidRows > 0}
            onChange={event => setConfirmed(event.target.checked)}
          />

          {rememberError && (
            <Alert variant="warning" title="Supplier mappings were not confirmed">
              {rememberError}
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {remembered ? (
              <p role="status" className="text-[11px] font-medium text-accent">
                Mappings saved for this supplier and branch. The purchase draft still needs Save.
              </p>
            ) : (
              <Button
                size="xs"
                variant="outline"
                disabled={busy || !confirmed || invalidRows > 0 || preview.rows.some(row => !row.product?.identityHash)}
                onClick={() => {
                  void remember();
                }}
              >
                Remember mappings for this supplier
              </Button>
            )}
            <Button
              size="xs"
              disabled={busy || !confirmed || invalidRows > 0 || preview.rows.length > remaining}
              onClick={() => onApply(preview.rows)}
            >
              Add {preview.rows.length} CSV lines to draft
            </Button>
          </div>
        </section>
      )}

      {discover && active && canAddCatalogue && (
        <PharmacyCatalogueDiscovery
          locationId={locationId}
          initialSearch={search || active}
          onClose={() => setDiscover(false)}
          onAdded={product => {
            invalidate();
            setMatches(previous => new Map(previous).set(active, product));
            setDiscover(false);
            setActive("");
            setSearchAttempt(value => value + 1);
          }}
        />
      )}
    </section>
  );
}
