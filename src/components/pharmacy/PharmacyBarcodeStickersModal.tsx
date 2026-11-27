"use client";

import { useMemo, useState } from "react";
import { Barcode, Camera, Printer, Sparkles, X } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Input, Modal, Select, useToast } from "@/components/ui";
import api from "@/lib/api";
import { getPrintErrorMessage } from "@/lib/printBrand";
import { encodeCode128B, isValidBarcodeAlias, normalizeBarcodeInput, printBarcodeStickers, STICKER_PRESETS, type StickerPresetId, type StickerPrintItem } from "@/lib/pharmacyBarcode";
import { PharmacyBarcodeScanDialog } from "./PharmacyBarcodeScanDialog";
import { money, type Medicine } from "./pharmacyWorkspace";

export interface BatchStickerSeed {
  medicineId: string;
  batchNumber?: string;
  expiry?: string;
  sellingPricePaise?: number;
  mrpPaise?: number;
  copies?: number;
}

interface QueueRow {
  medicine: Medicine;
  code: string;
  batchNumber: string;
  expiry: string;
  pricePaise: number;
  mrpPaise?: number;
  copies: number;
}

interface Props {
  open: boolean;
  locationId: string;
  storeName?: string;
  medicines: Medicine[];
  initialSeeds?: BatchStickerSeed[];
  canManageCatalog: boolean;
  onAssigned: () => void;
  onClose: () => void;
}

function defaultRowFor(medicine: Medicine, seed?: BatchStickerSeed): QueueRow {
  return {
    medicine,
    code: medicine.barcodes?.[0] || "",
    batchNumber: seed?.batchNumber || medicine.batchNumber || medicine.billingSupply?.batchNumber || "",
    expiry: seed?.expiry || medicine.expiryDate?.slice(0, 7) || medicine.billingSupply?.expiry.value || "",
    pricePaise: seed?.sellingPricePaise ?? Math.round((medicine.price || 0) * 100),
    mrpPaise: seed?.mrpPaise ?? medicine.billingSupply?.mrpPaise,
    copies: seed?.copies ?? 1,
  };
}

export function PharmacyBarcodeStickersModal({
  open,
  locationId,
  storeName,
  medicines,
  initialSeeds,
  canManageCatalog,
  onAssigned,
  onClose,
}: Props) {
  const initialMap = useMemo(() => new Map((initialSeeds || []).map(seed => [seed.medicineId, seed])), [initialSeeds]);
  const [rows, setRows] = useState<QueueRow[]>(() => {
    if (initialSeeds?.length) {
      return initialSeeds
        .map(seed => {
          const medicine = medicines.find(item => item.id === seed.medicineId);
          return medicine ? defaultRowFor(medicine, seed) : null;
        })
        .filter((row): row is QueueRow => Boolean(row));
    }
    return medicines.slice(0, 15).map(medicine => defaultRowFor(medicine));
  });
  const [preset, setPreset] = useState<StickerPresetId>("a4-40");
  const [showStoreName, setShowStoreName] = useState(Boolean(storeName?.trim()));
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [showBatch, setShowBatch] = useState(true);
  const [showRack, setShowRack] = useState(false);
  const [addMedicineId, setAddMedicineId] = useState("");
  const [scanRowId, setScanRowId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Keep synced rows updated with freshly saved barcodes after assignment.
  const syncedRows = rows.map(row => {
    const latest = medicines.find(item => item.id === row.medicine.id);
    if (!latest) return row;
    return row.code ? { ...row, medicine: latest } : { ...row, medicine: latest, code: latest.barcodes?.[0] || "" };
  });

  const missingBarcodeIds = syncedRows.filter(row => !row.code.trim()).map(row => row.medicine.id);
  const printableItems: StickerPrintItem[] = syncedRows
    .filter(row => encodeCode128B(row.code) && row.copies > 0)
    .map(row => ({
      code: normalizeBarcodeInput(row.code),
      name: row.medicine.name,
      strength: row.medicine.strength,
      pricePaise: row.pricePaise,
      mrpPaise: row.mrpPaise,
      batchNumber: row.batchNumber.trim() || undefined,
      expiry: row.expiry.trim() || undefined,
      rackLocation: row.medicine.rackLocation,
      copies: row.copies,
    }));
  const totalStickers = printableItems.reduce((sum, item) => sum + item.copies, 0);
  const previewItem = printableItems[0] || null;

  const unqueuedOptions = medicines
    .filter(item => !syncedRows.some(row => row.medicine.id === item.id))
    .map(item => ({
      value: item.id,
      label: `${item.name}${item.strength ? ` ${item.strength}` : ""}${item.barcodes?.length ? ` (${item.barcodes[0]})` : " (No barcode)"}`,
    }));

  function updateRow(medicineId: string, patch: Partial<QueueRow>) {
    setRows(previous => previous.map(row => (row.medicine.id === medicineId ? { ...row, ...patch } : row)));
  }

  async function assignSingleBarcode(medicineId: string, code: string) {
    const clean = normalizeBarcodeInput(code);
    if (!isValidBarcodeAlias(clean)) {
      setError("Enter a valid barcode (1 to 64 letters, digits, ., _, /, or -).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/pharmacy/barcodes/assign", {
        locationId,
        medicineId,
        barcode: clean,
        mode: "primary",
      });
      const updatedBarcodes = response.data?.data?.barcodes as string[] | undefined;
      updateRow(medicineId, { code: updatedBarcodes?.[0] || clean });
      toast({ title: "Barcode saved", variant: "success" });
      onAssigned();
    } catch (failure) {
      setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not save barcode.");
    } finally {
      setBusy(false);
    }
  }

  async function generateMissingBarcodes() {
    if (!missingBarcodeIds.length || !canManageCatalog) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/pharmacy/barcodes/assign", {
        locationId,
        medicineIds: missingBarcodeIds.slice(0, 100),
      });
      const assigned = (response.data?.data?.assigned || []) as Array<{ id: string; barcodes: string[] }>;
      const byId = new Map(assigned.map(item => [item.id, item.barcodes[0] || ""]));
      setRows(previous => previous.map(row => (byId.has(row.medicine.id) ? { ...row, code: byId.get(row.medicine.id)! } : row)));
      toast({ title: `Generated ${assigned.length} store barcodes`, variant: "success" });
      onAssigned();
    } catch (failure) {
      setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not generate barcodes.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePrint() {
    if (!printableItems.length) {
      setError("Assign a valid barcode and at least 1 sticker copy before printing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await printBarcodeStickers(printableItems, {
        preset,
        storeName,
        showStoreName,
        showPrice,
        showMrp,
        showBatch,
        showRack,
      });
    } catch (failure) {
      setError(getPrintErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        busy={busy}
        title="Barcodes & sticker printing"
        description={storeName || "Generate store barcodes and print shelf or strip labels"}
        size="xl"
        footer={(
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <span className="text-xs text-text-secondary tabular-nums">
              {printableItems.length} products · {totalStickers} stickers queued
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {missingBarcodeIds.length > 0 && canManageCatalog && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  loading={busy}
                  icon={<Sparkles className="w-4 h-4" aria-hidden="true" />}
                  onClick={() => { void generateMissingBarcodes(); }}
                >
                  Generate {missingBarcodeIds.length} missing
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={busy || totalStickers === 0}
                loading={busy}
                icon={<Printer className="w-4 h-4" aria-hidden="true" />}
                onClick={() => { void handlePrint(); }}
              >
                Print stickers ({totalStickers})
              </Button>
            </div>
          </div>
        )}
      >
        <div className="space-y-4">
          {error && <Alert variant="error" title="Sticker queue needs attention">{error}</Alert>}

          <div className="grid gap-3 rounded-xl border border-border/70 bg-surface-alt/40 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2.5">
              <Select
                label="Label paper / printer format"
                size="sm"
                value={preset}
                onChange={event => setPreset(event.target.value as StickerPresetId)}
                options={STICKER_PRESETS.map(item => ({ value: item.id, label: `${item.label} — ${item.description}` }))}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {storeName && <Checkbox label="Store name" checked={showStoreName} onChange={e => setShowStoreName(e.target.checked)} />}
                <Checkbox label="Sale price" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} />
                <Checkbox label="MRP" checked={showMrp} onChange={e => setShowMrp(e.target.checked)} />
                <Checkbox label="Batch & expiry" checked={showBatch} onChange={e => setShowBatch(e.target.checked)} />
                <Checkbox label="Rack" checked={showRack} onChange={e => setShowRack(e.target.checked)} />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-white px-3 py-2 text-black min-w-[200px] max-w-[260px]">
              <span className="text-[10px] font-medium text-neutral-500 mb-1">Sticker preview</span>
              {previewItem ? (
                <div className="w-full space-y-0.5 text-left">
                  {showStoreName && storeName && <p className="truncate text-[9px] font-bold uppercase text-neutral-700">{storeName}</p>}
                  <p className="truncate text-[11px] font-bold text-black">{[previewItem.name, previewItem.strength].filter(Boolean).join(" ")}</p>
                  <p className="truncate text-[9px] font-semibold text-neutral-700">
                    {[
                      showPrice && previewItem.pricePaise !== undefined ? `Sale ${money(previewItem.pricePaise / 100)}` : "",
                      showMrp && previewItem.mrpPaise !== undefined ? `MRP ${money(previewItem.mrpPaise / 100)}` : "",
                      showBatch && previewItem.batchNumber ? `B:${previewItem.batchNumber}` : "",
                      showBatch && previewItem.expiry ? `E:${previewItem.expiry}` : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                  <div className="pt-0.5 flex justify-center">
                    <BarcodePreviewSvg code={previewItem.code} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-500 py-3 text-center">Assign a barcode below to preview</p>
              )}
            </div>
          </div>

          {unqueuedOptions.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Add medicine from current view"
                size="sm"
                containerClassName="min-w-0 flex-1"
                placeholder="Choose product to queue"
                value={addMedicineId}
                searchable
                onChange={event => {
                  const chosen = medicines.find(item => item.id === event.target.value);
                  if (chosen) {
                    setRows(previous => [...previous, defaultRowFor(chosen, initialMap.get(chosen.id))]);
                    setAddMedicineId("");
                  }
                }}
                options={unqueuedOptions}
              />
            </div>
          )}

          <div className="max-h-[42dvh] overflow-y-auto divide-y divide-border/70 rounded-xl border border-border/70">
            {!syncedRows.length && (
              <div className="p-6 text-center text-xs text-text-secondary">
                No products queued. Choose products from Inventory or the selector above.
              </div>
            )}
            {syncedRows.map(row => (
              <div key={row.medicine.id} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(180px,1.2fr)_minmax(110px,0.8fr)_90px_auto] sm:items-end">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-xs font-semibold text-text truncate">{row.medicine.name}</strong>
                    {!row.code.trim() && <Badge variant="warning">No barcode</Badge>}
                  </div>
                  <p className="text-[11px] text-text-secondary truncate">
                    {[row.medicine.strength, money(row.pricePaise / 100), row.medicine.rackLocation ? `Rack ${row.medicine.rackLocation}` : ""].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <div className="flex items-end gap-1">
                  <Input
                    size="sm"
                    label="Barcode"
                    containerClassName="min-w-0 flex-1"
                    value={row.code}
                    placeholder="Scan or generate"
                    maxLength={64}
                    onChange={event => updateRow(row.medicine.id, { code: event.target.value })}
                  />
                  {canManageCatalog && (
                    <>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        aria-label={`Scan barcode for ${row.medicine.name}`}
                        title="Scan with camera"
                        disabled={busy}
                        onClick={() => setScanRowId(row.medicine.id)}
                      >
                        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        aria-label={`Save barcode for ${row.medicine.name}`}
                        title="Save barcode to product"
                        disabled={busy || !row.code.trim() || row.code.trim() === row.medicine.barcodes?.[0]}
                        onClick={() => { void assignSingleBarcode(row.medicine.id, row.code); }}
                      >
                        <Barcode className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>

                <Input
                  size="sm"
                  label="Batch"
                  value={row.batchNumber}
                  placeholder="Optional"
                  maxLength={60}
                  onChange={event => updateRow(row.medicine.id, { batchNumber: event.target.value })}
                />

                <Input
                  size="sm"
                  label="Copies"
                  type="number"
                  min={0}
                  max={500}
                  step={1}
                  value={String(row.copies)}
                  onChange={event => updateRow(row.medicine.id, { copies: Math.max(0, Math.min(500, Math.floor(Number(event.target.value) || 0))) })}
                />

                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-label={`Remove ${row.medicine.name}`}
                  onClick={() => setRows(previous => previous.filter(item => item.medicine.id !== row.medicine.id))}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <PharmacyBarcodeScanDialog
        open={Boolean(scanRowId)}
        title="Scan product barcode"
        description="Scan the manufacturer barcode to link it to this product and print stickers."
        onClose={() => setScanRowId(null)}
        onDetected={code => {
          if (scanRowId) void assignSingleBarcode(scanRowId, code);
        }}
      />
    </>
  );
}

/** Pure SVG Code 128 preview without dangerous HTML injection (renders encoded rects directly). */
export function BarcodePreviewSvg({ code }: { code: string }) {
  const encoded = encodeCode128B(code);
  if (!encoded) return null;
  const quiet = 8;
  const barHeight = 26;
  const totalWidth = encoded.totalModules + quiet * 2;
  const rects: Array<{ x: number; w: number }> = [];
  let cursorX = quiet;
  for (let i = 0; i < encoded.widths.length; i++) {
    const w = encoded.widths[i];
    if (i % 2 === 0) rects.push({ x: cursorX, w });
    cursorX += w;
  }
  return (
    <svg viewBox={`0 0 ${totalWidth} ${barHeight + 12}`} className="w-full max-w-[200px] h-11" role="img" aria-label={`Barcode ${code}`}>
      <rect width={totalWidth} height={barHeight + 12} fill="#ffffff" />
      {rects.map((bar, index) => (
        <rect key={index} x={bar.x} y={1} width={bar.w} height={barHeight} fill="#000000" shapeRendering="crispEdges" />
      ))}
      <text x={totalWidth / 2} y={barHeight + 10} textAnchor="middle" fill="#000000" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="7.5" fontWeight="600">
        {normalizeBarcodeInput(code)}
      </text>
    </svg>
  );
}
