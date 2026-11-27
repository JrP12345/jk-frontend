"use client";

import { useState, type ReactNode } from "react";
import { Barcode, Camera, Plus, Printer, Search, Upload, MoreHorizontal } from "lucide-react";
import { Badge, Button, Card, Dropdown, Input, Modal, Table, Tabs } from "@/components/ui";
import type { DropdownItem } from "@/components/ui/Dropdown";
import { PharmacyBarcodeScanDialog } from "./PharmacyBarcodeScanDialog";
import { BarcodePreviewSvg, type BatchStickerSeed } from "./PharmacyBarcodeStickersModal";
import { dateLabel, expired, lowStock, money, type Medicine } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";

type Props = {
  medicines: Medicine[];
  billingOnly: boolean;
  search: string;
  filter: string;
  barcodeFilter?: "all" | "assigned" | "missing";
  reading: boolean;
  loaded: boolean;
  error: string | null;
  total: number | null;
  page: number;
  pages: number;
  busy: boolean;
  actionable: boolean;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onBarcodeFilter?: (value: "all" | "assigned" | "missing") => void;
  onPage: (value: number) => void;
  onRetry: () => void;
  actionsFor: (medicine: Medicine) => DropdownItem[];
  onCreate?: () => void;
  onImport?: () => void;
  importDisabled: boolean;
  onFind?: () => void;
  onOpenStickers?: (seeds?: BatchStickerSeed[]) => void;
  children?: ReactNode;
};

const pack = (medicine: Medicine) => medicine.unitDefinition
  ? `1 ${medicine.unitDefinition.packUnit} = ${medicine.unitDefinition.unitsPerPack} ${medicine.unitDefinition.baseUnit}` : "Pack not recorded";
function StockBadge({ medicine }: { medicine: Medicine }) {
  return <Badge variant={medicine.stockQuantity === 0 ? "danger" : lowStock(medicine) ? "warning" : "success"}>{medicine.stockQuantity === 0 ? "Out of stock" : lowStock(medicine) ? "Low stock" : "In stock"}</Badge>;
}

/** Presentation only: the workspace retains server reads, permissions and stock commands. */
export function PharmacyInventory(props: Props) {
  const { medicines, billingOnly, search, filter, barcodeFilter = "all", reading, loaded, error, total, page, pages, busy, actionable, onSearch, onFilter, onBarcodeFilter, onPage, onRetry, actionsFor, onCreate, onImport, onFind, onOpenStickers, importDisabled, children } = props;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const paginationScope = JSON.stringify([search.trim(), filter, barcodeFilter]);
  const [tablePosition, setTablePosition] = useState({ scope: paginationScope, page: 1 });
  const tablePage = tablePosition.scope === paginationScope ? tablePosition.page : (page - 1) * 10 + 1;
  function changeTablePage(value: number) {
    setTablePosition({ scope: paginationScope, page: value });
    const batchPage = Math.floor((value - 1) / 10) + 1;
    if (batchPage !== page) onPage(batchPage);
  }
  const medicine = medicines.find(item => item.id === detailId);
  const actions = (item: Medicine) => <Dropdown align="right" trigger={<Button size="xs" variant="ghost" aria-label={`Actions for ${item.name}`} disabled={!actionable}><MoreHorizontal size={16} aria-hidden="true" /></Button>} items={actionsFor(item)} />;
  const identity = (item: Medicine) => <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><button type="button" className="text-left text-xs font-semibold text-text hover:text-accent focus-visible:outline-none focus-visible:underline" onClick={() => setDetailId(item.id)}>{item.name}</button>{item.saleControl?.blocked && <Badge variant="warning">Sale hold</Badge>}{item.barcodes?.length ? <Badge variant="neutral" className="font-mono text-[10px]"><Barcode size={11} className="mr-1 inline" aria-hidden="true" />{item.barcodes[0]}{item.barcodes.length > 1 ? ` +${item.barcodes.length - 1}` : ""}</Badge> : null}</div><p className="mt-0.5 text-[11px] text-text-secondary">{[item.genericName, item.strength, item.manufacturer].filter(Boolean).join(" · ")}</p></div>;
  const run = (action: DropdownItem) => { setDetailId(null); action.onClick?.(); };

  return <section className={styles.inventoryView} aria-label="Medicine inventory" aria-busy={reading} data-inventory-list>
    <Card padding="none" className="rounded-xl shadow-none" contentClassName="min-h-0 gap-0">
      <header className="shrink-0 border-b border-border/70 px-3 py-3 md:px-4 xl:pr-[520px]">
        <h2 className="text-sm font-semibold text-text md:text-base">{billingOnly ? "Catalogue" : "Inventory"}</h2>
        <p className="text-[11px] text-text-secondary">{billingOnly ? "Stock not tracked" : "Physical stock in base units"}</p>
      </header>
      {loaded && !error && <div className="hidden shrink-0 grid-cols-4 divide-x divide-border border-b border-border/70 md:grid" aria-label="Inventory overview">
        {[{ label: search || filter !== "all" || barcodeFilter !== "all" ? "Matching medicines" : "Medicines", value: total ?? medicines.length }, ...(!billingOnly ? [
          { label: "In stock · loaded", value: medicines.filter(item => !lowStock(item)).length },
          { label: "Low stock · loaded", value: medicines.filter(item => lowStock(item) && item.stockQuantity > 0).length },
          { label: "Out of stock · loaded", value: medicines.filter(item => item.stockQuantity === 0).length },
        ] : [])].map(stat => <div key={stat.label} className="px-4 py-3"><p className="text-[11px] text-text-secondary">{stat.label}</p><p className="text-base font-semibold tabular-nums text-text">{stat.value}</p></div>)}
      </div>}
      {!billingOnly && <div className="shrink-0"><Tabs fullWidth variant="underline" scrollActiveIntoView={false} activeTab={filter} onChange={onFilter} tabs={[{ id: "all", label: "All" }, { id: "low", label: "Low stock" }, { id: "out", label: "Out" }, { id: "expired", label: "Expired" }]} /></div>}
      <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-border/60 p-3 md:px-4">
        <Input containerClassName="min-w-0 flex-1" size="sm" type="search" maxLength={100} icon={<Search size={15} aria-hidden="true" />} aria-label="Search medicines" placeholder="Name, composition, manufacturer or barcode" value={search} onChange={event => onSearch(event.target.value)} />
        <Button type="button" size="sm" variant="outline" aria-label="Scan barcode with camera" title="Scan barcode with camera" onClick={() => setScanOpen(true)}><Camera size={15} aria-hidden="true" /></Button>
        {onBarcodeFilter && (
          <Button type="button" size="sm" variant={barcodeFilter === "missing" ? "primary" : "outline"} onClick={() => onBarcodeFilter(barcodeFilter === "missing" ? "all" : "missing")}>
            Missing barcode
          </Button>
        )}
      </div>
      {children && <div className="shrink-0 border-b border-border/60 px-3 md:px-4">{children}</div>}
      <Table<Medicine> caption="Medicine inventory" variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} mobileLayout="list" loading={reading || busy} error={error} onRetry={onRetry} data={reading ? [] : medicines} pagination defaultRowsPerPage={10} rowsPerPageOptions={[10]}
        key={`${paginationScope}:${total === null ? page : ""}`}
        remotePagination={total !== null ? { page: tablePage, rowCount: total, rowOffset: (page - 1) * 100, onPageChange: changeTablePage } : undefined}
        columns={[
          { key: "name", header: "Medicine", render: identity },
          { key: "rackLocation", header: "Rack", render: item => <span className="text-xs text-text-secondary">{item.rackLocation || "—"}</span> },
          { key: "pack", header: "Pack", render: item => <span className="text-xs text-text-secondary">{pack(item)}</span> },
          { key: "price", header: "Default price", align: "right", render: item => <span className="text-xs tabular-nums">{money(item.price)}</span> },
          { key: "stockQuantity", header: "Stock", align: "right", render: item => <span className="text-xs font-semibold tabular-nums">{billingOnly ? "Not tracked" : item.stockQuantity}</span> },
          ...(!billingOnly ? [{ key: "status", header: "Status", render: (item: Medicine) => <StockBadge medicine={item} /> }] : []),
          { key: "actions", header: "", align: "right", render: actions },
        ]}
        renderMobileCard={item => <article className="flex min-h-16 items-center gap-2 px-3 py-2"><button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring" aria-label={`View medicine ${item.name}`} onClick={() => setDetailId(item.id)}><span className="flex flex-wrap items-center gap-1"><strong className="text-xs font-semibold text-text">{item.name}</strong>{item.saleControl?.blocked && <Badge variant="warning">Sale hold</Badge>}{item.barcodes?.[0] && <Badge variant="neutral" className="font-mono text-[10px]">{item.barcodes[0]}</Badge>}</span><span className="mt-0.5 block text-[11px] text-text-secondary">{pack(item)} · {money(item.price)}</span></button><div className="shrink-0 text-right"><p className="text-xs font-semibold tabular-nums">{billingOnly ? "Not tracked" : item.stockQuantity}</p>{!billingOnly && <StockBadge medicine={item} />}</div>{actions(item)}</article>}
        emptyMessage={search || filter !== "all" ? "No medicines match these filters." : "No medicines yet. Add medicine to start your inventory."} />
      {loaded && total === null && pages > 1 && <div className="shrink-0 flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-text-secondary"><Button size="xs" variant="outline" aria-label="Previous medicine page" disabled={page <= 1 || reading || busy} onClick={() => onPage(page - 1)}>Previous batch</Button><span>Batch {page} of {pages}</span><Button size="xs" variant="outline" aria-label="Next medicine page" disabled={page >= pages || reading || busy} onClick={() => onPage(page + 1)}>Next batch</Button></div>}
      {(onCreate || onImport || onFind || onOpenStickers) && <div className="order-last flex flex-wrap shrink-0 items-center gap-2 border-t border-border/70 bg-surface p-3 xl:absolute xl:right-4 xl:top-2 xl:order-none xl:border-0 xl:p-0">
        {onOpenStickers && <Button size="xs" variant="outline" aria-label="Barcodes & stickers" title="Barcodes & stickers" disabled={!actionable} onClick={() => onOpenStickers()} icon={<Barcode size={15} aria-hidden="true" />}><span className="hidden md:inline">Barcodes & stickers</span></Button>}
        {onImport && <Button size="xs" variant="outline" aria-label="Import source CSV" title="Import source CSV" disabled={importDisabled} onClick={onImport} icon={<Upload size={15} aria-hidden="true" />}><span className="hidden md:inline">Import source CSV</span></Button>}
        {onFind && <Button size="xs" variant="outline" aria-label="Find in catalogue" title="Find in catalogue" disabled={!actionable} onClick={onFind} icon={<Search size={15} aria-hidden="true" />}><span className="hidden md:inline">Find in catalogue</span></Button>}
        {onCreate && <Button size="sm" className="flex-1 md:flex-none" disabled={!actionable} onClick={onCreate} icon={<Plus size={15} aria-hidden="true" />}>Add medicine</Button>}
      </div>}
    </Card>
    {medicine && <Modal open title={medicine.name} description={[medicine.genericName, medicine.strength].filter(Boolean).join(" · ")} size="md" presentation="sheet" onClose={() => setDetailId(null)}>
      <div className="space-y-4">
        {!billingOnly && <StockBadge medicine={medicine} />}
        <section aria-label="Medicine details"><h3 className="mb-2 text-xs font-semibold text-text-secondary">Stock & pricing</h3><dl className="grid grid-cols-[minmax(100px,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2 text-xs">
          <dt className="text-text-secondary">On hand</dt><dd>{billingOnly ? "Not tracked" : `${medicine.stockQuantity} ${medicine.unitDefinition?.baseUnit || "base units"}`}</dd>
          <dt className="text-text-secondary">Pack</dt><dd>{pack(medicine)}</dd>
          <dt className="text-text-secondary">Default price</dt><dd>{money(medicine.price)}</dd>
          <dt className="text-text-secondary">Manufacturer</dt><dd>{medicine.manufacturer || "Not recorded"}</dd>
          <dt className="text-text-secondary">Rack</dt><dd>{medicine.rackLocation || "Not recorded"}</dd>
          <dt className="text-text-secondary">Catalogue batch</dt><dd>{medicine.batchNumber || "Not recorded"}</dd>
          <dt className="text-text-secondary">Catalogue expiry</dt><dd className={expired(medicine.expiryDate) ? "text-error-text" : ""}>{dateLabel(medicine.expiryDate)}</dd>
          <dt className="text-text-secondary">Barcodes</dt><dd>{medicine.barcodes?.length ? medicine.barcodes.join(", ") : "None assigned"}</dd>
        </dl>
        {medicine.barcodes?.[0] && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-white px-3 py-2 text-black">
            <BarcodePreviewSvg code={medicine.barcodes[0]} />
            {onOpenStickers && (
              <Button size="xs" variant="outline" icon={<Printer size={14} aria-hidden="true" />} onClick={() => { const id = medicine.id; setDetailId(null); onOpenStickers([{ medicineId: id }]); }}>
                Print stickers
              </Button>
            )}
          </div>
        )}
        </section>
        {medicine.saleControl?.blocked && <p className="rounded-lg border border-border bg-surface-alt p-3 text-xs">Sale hold: {medicine.saleControl.reason}</p>}
        <section aria-label="Medicine actions" className="border-t border-border/70 pt-3"><h3 className="mb-2 text-xs font-semibold text-text-secondary">Actions</h3><div className="divide-y divide-border/60">{actionsFor(medicine).map(action => <Button key={action.label} size="sm" variant="ghost" fullWidth disabled={!actionable || action.disabled} className={action.variant === "danger" ? "text-error-text" : ""} onClick={() => run(action)}>{action.label}</Button>)}</div></section>
      </div>
    </Modal>}
    <PharmacyBarcodeScanDialog
      open={scanOpen}
      title="Scan medicine barcode in Inventory"
      onClose={() => setScanOpen(false)}
      onDetected={code => onSearch(code)}
    />
  </section>;
}
