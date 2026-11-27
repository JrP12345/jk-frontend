"use client";

import { useState } from "react";
import { Camera, Sparkles } from "lucide-react";
import { Alert, Button, Checkbox, DatePicker, Input, Modal, Select } from "@/components/ui";
import api from "@/lib/api";
import { isValidBarcodeAlias, normalizeBarcodeInput } from "@/lib/pharmacyBarcode";
import type { CounterProduct } from "@/lib/pharmacyCounter";
import { parseReceiptPaise } from "@/lib/pharmacyStockReceipts";
import { PharmacyBarcodeScanDialog } from "./PharmacyBarcodeScanDialog";
import type { Medicine } from "./pharmacyWorkspace";

interface Props {
  open: boolean;
  locationId: string;
  inventoryMode: "tracked" | "billing_only";
  initialBarcode?: string;
  initialName?: string;
  canReceiveStock: boolean;
  canViewCost: boolean;
  canReviewProducts: boolean;
  onClose: () => void;
  onCreated: (result: { medicine: Medicine; counterProduct: CounterProduct; addToCart: boolean }) => void;
}

const FORMS = ["tablet", "capsule", "syrup", "injection", "ointment", "drops", "inhaler", "other"];
const BASE_UNITS = ["piece", "tablet", "capsule", "ml", "g", "dose"];
const PACK_UNITS = ["pack", "strip", "box", "bottle", "vial", "tube", "ampoule", "sachet", "piece"];
const GST_OPTIONS = [
  { value: "0", label: "0% (Exempt / Nil rated)" },
  { value: "5", label: "5% GST" },
  { value: "12", label: "12% GST" },
  { value: "18", label: "18% GST" },
  { value: "28", label: "28% GST" },
];

export function PharmacyQuickProductModal({
  open,
  locationId,
  inventoryMode,
  initialBarcode = "",
  initialName = "",
  canReceiveStock,
  canViewCost,
  canReviewProducts,
  onClose,
  onCreated,
}: Props) {
  const canAddBatch = inventoryMode === "tracked" && canReceiveStock && canViewCost;
  const [name, setName] = useState(initialName);
  const [genericName, setGenericName] = useState("");
  const [strength, setStrength] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode);
  const [category, setCategory] = useState("tablet");
  const [baseUnit, setBaseUnit] = useState("tablet");
  const [packUnit, setPackUnit] = useState("strip");
  const [unitsPerPack, setUnitsPerPack] = useState("10");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [hsnCode, setHsnCode] = useState("3004");
  const [gstRate, setGstRate] = useState("5");

  const [includeBatch, setIncludeBatch] = useState(canAddBatch);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryPrecision, setExpiryPrecision] = useState<"month" | "day">("month");
  const [expiryDate, setExpiryDate] = useState("");
  const [packs, setPacks] = useState("1");
  const [looseUnits, setLooseUnits] = useState("0");
  const [purchaseTotal, setPurchaseTotal] = useState("");

  const [approveForSale, setApproveForSale] = useState(canReviewProducts);
  const [reviewReference, setReviewReference] = useState("");

  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function generateCode() {
    const digits = String(Math.floor(10_000_000 + Math.random() * 89_999_999));
    setBarcode(`EKV${digits}`);
    setError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");

    const cleanName = name.trim();
    const cleanGeneric = (genericName.trim() || cleanName).trim();
    const cleanBarcode = normalizeBarcodeInput(barcode);
    if (!cleanName || !cleanGeneric) {
      setError("Enter the product name and generic or composition.");
      return;
    }
    if (cleanBarcode && !isValidBarcodeAlias(cleanBarcode)) {
      setError("Barcode may use letters, digits, ., _, /, or - (up to 64 characters).");
      return;
    }
    const retailNum = Number(price);
    const retailPaise = parseReceiptPaise(price);
    const mrpPaise = parseReceiptPaise(mrp.trim() ? mrp : price);
    if (!price.trim() || !Number.isFinite(retailNum) || retailNum < 0 || retailPaise === null || mrpPaise === null || retailPaise > mrpPaise) {
      setError("Enter valid non-negative selling price and MRP (selling price cannot exceed MRP).");
      return;
    }
    const perPackNum = Number(unitsPerPack);
    if (!Number.isSafeInteger(perPackNum) || perPackNum < 1 || perPackNum > 1_000_000) {
      setError("Units per pack must be a whole number of 1 or more.");
      return;
    }
    if (!/^\d{4}(\d{2})?(\d{2})?$/.test(hsnCode.trim())) {
      setError("HSN code must be 4, 6, or 8 digits.");
      return;
    }
    const gstNum = Number(gstRate);
    if (approveForSale && canReviewProducts && reviewReference.trim().length < 3) {
      setError("Enter a classification review reference (3+ characters) to sell immediately at the counter.");
      return;
    }

    let initialBatchPayload: Record<string, unknown> | undefined;
    if (canAddBatch && includeBatch) {
      const packsNum = Number(packs || 0);
      const looseNum = Number(looseUnits || 0);
      const costPaise = parseReceiptPaise(purchaseTotal);
      if (
        !batchNumber.trim()
        || !expiryDate
        || !Number.isSafeInteger(packsNum)
        || packsNum < 0
        || !Number.isSafeInteger(looseNum)
        || looseNum < 0
        || looseNum >= perPackNum
        || packsNum * perPackNum + looseNum <= 0
        || costPaise === null
      ) {
        setError("Enter batch number, printed expiry, positive stock quantity, and purchase cost.");
        return;
      }
      initialBatchPayload = {
        batchNumber: batchNumber.trim(),
        expiry: { precision: expiryPrecision, value: expiryDate },
        packs: packsNum,
        looseUnits: looseNum,
        purchaseTotalPaise: costPaise,
        mrpPaise,
        kind: "receipt",
      };
    }

    let billingSupplyPayload: Record<string, unknown> | undefined;
    if (inventoryMode === "billing_only" && (approveForSale || batchNumber.trim() || expiryDate)) {
      if (!batchNumber.trim() || !expiryDate) {
        setError("Record printed batch number and expiry for billing-only counter supply.");
        return;
      }
      billingSupplyPayload = {
        batchNumber: batchNumber.trim(),
        expiry: { precision: expiryPrecision, value: expiryDate },
        mrpPaise,
      };
    }

    setBusy(true);
    try {
      const response = await api.post(
        "/pharmacy/sales/quick-product",
        {
          locationId,
          name: cleanName,
          genericName: cleanGeneric,
          ...(strength.trim() ? { strength: strength.trim() } : {}),
          ...(cleanBarcode ? { barcode: cleanBarcode } : {}),
          category,
          price: retailNum,
          hsnCode: hsnCode.trim(),
          gstRate: gstNum,
          taxTreatment: gstNum === 0 ? "nil_rated" : "taxable",
          unitDefinition: { baseUnit, packUnit, unitsPerPack: perPackNum },
          ...(initialBatchPayload ? { initialBatch: initialBatchPayload } : {}),
          ...(billingSupplyPayload ? { billingSupply: billingSupplyPayload } : {}),
          ...(canReviewProducts && approveForSale ? { approveForSale: true, reviewReference: reviewReference.trim() } : {}),
        },
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );

      const data = response.data?.data as { medicine: Medicine; counterProduct: CounterProduct };
      onCreated({
        medicine: data.medicine,
        counterProduct: data.counterProduct,
        addToCart: Boolean(data.counterProduct.eligible && (inventoryMode === "billing_only" || data.counterProduct.stockQuantity > 0)),
      });
      onClose();
    } catch (failure) {
      setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not create product. Check the fields and try again.");
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
        title="Quick / manual product"
        description="Add a catalog item directly from Counter sale"
        size="lg"
        footer={(
          <>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" form="quick-counter-product-form" size="sm" loading={busy} disabled={busy}>
              {canReviewProducts && approveForSale && (inventoryMode === "billing_only" || (canAddBatch && includeBatch))
                ? "Save & add to cart"
                : "Save product"}
            </Button>
          </>
        )}
      >
        <form id="quick-counter-product-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <Alert variant="error" title="Check product details">{error}</Alert>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Product name *"
              placeholder="e.g. Cotton bandage roll"
              value={name}
              maxLength={200}
              onChange={event => setName(event.target.value)}
              required
            />
            <Input
              label="Generic / formulation *"
              placeholder="Defaults to product name if left equal"
              value={genericName}
              maxLength={500}
              onChange={event => setGenericName(event.target.value)}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
            <Input
              label="Barcode / SKU"
              placeholder="Scan manufacturer code or generate a store barcode"
              value={barcode}
              maxLength={64}
              onChange={event => setBarcode(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Scan barcode with camera"
              disabled={busy}
              onClick={() => setScanOpen(true)}
              icon={<Camera className="w-4 h-4" aria-hidden="true" />}
            >
              Scan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={generateCode}
              icon={<Sparkles className="w-4 h-4" aria-hidden="true" />}
            >
              Generate
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              label="Strength"
              placeholder="e.g. 500mg / 10cm"
              value={strength}
              maxLength={80}
              onChange={event => setStrength(event.target.value)}
            />
            <Select
              label="Form"
              value={category}
              onChange={event => setCategory(event.target.value)}
              options={FORMS.map(item => ({ value: item, label: item }))}
            />
            <Select
              label="Base unit"
              value={baseUnit}
              onChange={event => setBaseUnit(event.target.value)}
              options={BASE_UNITS.map(item => ({ value: item, label: item }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Pack"
                value={packUnit}
                onChange={event => setPackUnit(event.target.value)}
                options={PACK_UNITS.map(item => ({ value: item, label: item }))}
              />
              <Input
                label="Units/pack"
                type="number"
                min={1}
                max={1_000_000}
                value={unitsPerPack}
                onChange={event => setUnitsPerPack(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              label="Sale price / unit *"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={event => setPrice(event.target.value)}
              required
            />
            <Input
              label="MRP / unit"
              placeholder="Same as sale if empty"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={mrp}
              onChange={event => setMrp(event.target.value)}
            />
            <Input
              label="HSN code *"
              value={hsnCode}
              maxLength={8}
              onChange={event => setHsnCode(event.target.value)}
            />
            <Select
              label="GST rate"
              value={gstRate}
              onChange={event => setGstRate(event.target.value)}
              options={GST_OPTIONS}
            />
          </div>

          {canAddBatch && (
            <div className="rounded-xl border border-border/70 p-3 space-y-3">
              <Checkbox
                label="Add opening stock batch now (required to bill right away)"
                checked={includeBatch}
                onChange={event => setIncludeBatch(event.target.checked)}
              />
              {includeBatch && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    label="Batch number *"
                    value={batchNumber}
                    maxLength={100}
                    onChange={event => setBatchNumber(event.target.value)}
                  />
                  <Select
                    label="Expiry format"
                    value={expiryPrecision}
                    onChange={event => { setExpiryPrecision(event.target.value as "month" | "day"); setExpiryDate(""); }}
                    options={[{ value: "month", label: "Month / Year" }, { value: "day", label: "Exact date" }]}
                  />
                  <DatePicker
                    label="Expiry date *"
                    mode={expiryPrecision === "month" ? "month" : "date"}
                    value={expiryDate}
                    onChange={setExpiryDate}
                  />
                  <Input
                    label={`Full ${packUnit}s`}
                    type="number"
                    min="0"
                    step="1"
                    value={packs}
                    onChange={event => setPacks(event.target.value)}
                  />
                  <Input
                    label={`Loose ${baseUnit}s`}
                    type="number"
                    min="0"
                    step="1"
                    value={looseUnits}
                    onChange={event => setLooseUnits(event.target.value)}
                  />
                  <Input
                    label="Total cost (INR) *"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={purchaseTotal}
                    onChange={event => setPurchaseTotal(event.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {inventoryMode === "billing_only" && (
            <div className="rounded-xl border border-border/70 p-3 grid gap-3 sm:grid-cols-3">
              <Input
                label="Supply batch number *"
                value={batchNumber}
                maxLength={100}
                onChange={event => setBatchNumber(event.target.value)}
              />
              <Select
                label="Expiry format"
                value={expiryPrecision}
                onChange={event => { setExpiryPrecision(event.target.value as "month" | "day"); setExpiryDate(""); }}
                options={[{ value: "month", label: "Month / Year" }, { value: "day", label: "Exact date" }]}
              />
              <DatePicker
                label="Printed expiry *"
                mode={expiryPrecision === "month" ? "month" : "date"}
                value={expiryDate}
                onChange={setExpiryDate}
              />
            </div>
          )}

          {canReviewProducts ? (
            <div className="rounded-xl border border-border/70 p-3 space-y-2.5">
              <Checkbox
                label="Approve for immediate General counter sale & confirm HSN/GST classification"
                checked={approveForSale}
                onChange={event => setApproveForSale(event.target.checked)}
              />
              {approveForSale && (
                <Input
                  label="Classification review reference *"
                  placeholder="e.g. Pack label & invoice verification"
                  value={reviewReference}
                  maxLength={500}
                  onChange={event => setReviewReference(event.target.value)}
                />
              )}
            </div>
          ) : (
            <p className="text-xs text-text-secondary">
              Saved products require an organization administrator review in Inventory before ordinary counter billing.
            </p>
          )}
        </form>
      </Modal>

      <PharmacyBarcodeScanDialog
        open={scanOpen}
        title="Scan barcode for new product"
        onClose={() => setScanOpen(false)}
        onDetected={code => setBarcode(code)}
      />
    </>
  );
}
