"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, CardDescription, CardTitle, Checkbox, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { apiErrorMessage } from "@/lib/apiError";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { readProductReview, saleClassifications, saveSaleReview, saveTaxReview, type ProductReview, type SaleClassification, type SaleReviewInput, type TaxReviewInput, type TaxTreatment } from "@/lib/pharmacyProductReview";
import { useAuthStore } from "@/store/authStore";

interface Props { medicineId: string; locationId: string; onClose: () => void; onReviewed: () => void }
export function PharmacyProductReview(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  const [reload, setReload] = useState(0);
  return <ReviewSession key={`${scope}:${props.locationId}:${props.medicineId}:${reload}`} {...props} onReload={() => setReload(value => value + 1)} />;
}

function ReviewSession({ medicineId, locationId, onClose, onReviewed, onReload }: Props & { onReload: () => void }) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user);
  const canReview = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const [product, setProduct] = useState<ProductReview | null>(null), [loading, setLoading] = useState(canReview);
  const [saving, setSaving] = useState<"sale" | "tax" | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const alive = useRef(true), lock = useRef(false), followupRead = useRef<AbortController | null>(null);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope && hasAnyPermission(useAuthStore.getState().user, "MANAGE_ORGANIZATION");
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    if (canReview) readProductReview(medicineId, locationId, controller.signal).then(result => {
      if (alive.current && !controller.signal.aborted && authScopeKey(useAuthStore.getState().user) === scope) setProduct(result);
    }).catch(failure => {
      if (alive.current && !controller.signal.aborted && authScopeKey(useAuthStore.getState().user) === scope) setError(apiErrorMessage(failure, "Product details could not be loaded. Reload before reviewing."));
    }).finally(() => { if (alive.current && !controller.signal.aborted && authScopeKey(useAuthStore.getState().user) === scope) setLoading(false); });
    return () => { alive.current = false; controller.abort(); followupRead.current?.abort(); };
  }, [medicineId, locationId, canReview, scope]);

  async function save(kind: "sale" | "tax", input: SaleReviewInput | TaxReviewInput) {
    if (lock.current || !product || !current()) return;
    lock.current = true; setSaving(kind); setError(""); setNotice("");
    try {
      if (kind === "sale") await saveSaleReview(product, input as SaleReviewInput);
      else await saveTaxReview(product, input as TaxReviewInput);
      if (!current()) return;
      const controller = new AbortController(); followupRead.current = controller;
      const updated = await readProductReview(medicineId, locationId, controller.signal);
      if (current()) { setProduct(updated); setNotice(`${kind === "sale" ? "Sale classification" : "Tax classification"} review saved.`); onReviewed(); }
    } catch (failure) {
      if (current()) {
        setProduct(null);
        setError(`${apiErrorMessage(failure, "The review save could not be confirmed.")} Reload product details to check the saved result before submitting another review.`);
      }
    } finally { lock.current = false; if (current()) setSaving(null); }
  }
  const saleReviewed = Boolean(product && product.dispensingRevision > 0 && product.saleReview?.scheduleType === product.scheduleType);
  const taxReviewed = Boolean(product && product.taxRevision > 0 && product.taxReview?.hsnCode === product.hsnCode && product.taxReview?.gstRate === product.gstRate);
  return <Modal open title="Review product" description={product?.name || "Sale and tax classification"} onClose={onClose} busy={Boolean(saving)} size="lg" footer={<Button variant="outline" disabled={Boolean(saving)} onClick={onClose}>Close product review</Button>}>
    <div className="space-y-4">
      {!canReview && <Alert variant="warning" title="Administrator review required">An organization administrator must review this product. No changes have been made.</Alert>}
      {loading && <p role="status" className="text-sm text-text-secondary">Loading product review details...</p>}
      {error && <Alert variant="error" title="Product review needs attention">{error}</Alert>}
      {notice && <Alert variant="success" title="Review saved">{notice}</Alert>}
      {canReview && <Button size="sm" variant="outline" disabled={loading || Boolean(saving)} onClick={onReload}>Reload product details</Button>}
      {product && <>
        {!product.hasUnits && <Alert variant="warning" title="Product units are missing">In Inventory, use Edit medicine → Units & codes to configure units. Classification review does not configure product units.</Alert>}
        <p className="text-sm leading-relaxed text-text-secondary">Review each classification against your source information. Saving one review does not complete the other or change stock quantities.</p>
        <Card contentClassName="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Sale classification</CardTitle><Badge variant={saleReviewed ? "success" : "warning"}>{saleReviewed ? "Reviewed" : "Review required"}</Badge></div>
          <CardDescription>Only reviewed General products can use ordinary counter checkout. Restricted classifications require their authorized supply workflow.</CardDescription>
          <SaleForm key={product.dispensingRevision} product={product} disabled={Boolean(saving)} saving={saving === "sale"} onSave={input => save("sale", input)} />
        </Card>
        <Card contentClassName="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Tax classification</CardTitle><Badge variant={taxReviewed ? "success" : "warning"}>{taxReviewed ? "Reviewed" : "Review required"}</Badge></div>
          <CardDescription>Confirm the HSN, document unit code and tax treatment. Existing batches retain their saved tax details; this review does not rewrite them.</CardDescription>
          <TaxForm key={product.taxRevision} product={product} disabled={Boolean(saving)} saving={saving === "tax"} onSave={input => save("tax", input)} />
        </Card>
        {saleReviewed && product.scheduleType !== "general" && <Alert variant="info" title="Restricted product">The sale review is recorded. This classification remains unavailable in ordinary Counter sale.</Alert>}
        {saleReviewed && taxReviewed && product.scheduleType === "general" && product.hasUnits && <p role="status" className="text-sm text-text-secondary">Both product reviews are recorded. Counter checkout will recheck branch access, issuer settings, batch classification and available stock.</p>}
      </>}
    </div>
  </Modal>;
}

function SaleForm({ product, disabled, saving, onSave }: { product: ProductReview; disabled: boolean; saving: boolean; onSave: (input: SaleReviewInput) => Promise<void> }) {
  const [classification, setClassification] = useState(product.scheduleType), [reference, setReference] = useState(""), [confirmed, setConfirmed] = useState(false);
  return <form aria-label="Sale classification review" onSubmit={event => { event.preventDefault(); if (!disabled && confirmed && classification && reference.trim().length >= 3) void onSave({ scheduleType: classification, reviewReference: reference }); }}>
    <fieldset disabled={disabled} className="space-y-4">
      <Select label="Sale classification *" required value={classification} onChange={event => { setClassification(event.target.value as SaleClassification); setConfirmed(false); }} options={[{ value: "", label: "Choose classification" }, ...saleClassifications.map(value => ({ value, label: value === "general" ? "General — ordinary counter sale" : value.replaceAll("_", " ").replace(/^./, char => char.toUpperCase()) }))]} />
      <Input label="Sale review reference *" required minLength={3} maxLength={500} value={reference} onChange={event => { setReference(event.target.value); setConfirmed(false); }} />
      {product.saleReview && <p className="break-words text-xs text-text-secondary">Previous reference: {product.saleReview.reviewReference}</p>}
      <Checkbox label="I confirm the sale classification and review reference" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
      <Button type="submit" loading={saving} disabled={!confirmed || !classification || reference.trim().length < 3}>Save sale review</Button>
    </fieldset>
  </form>;
}

function TaxForm({ product, disabled, saving, onSave }: { product: ProductReview; disabled: boolean; saving: boolean; onSave: (input: TaxReviewInput) => Promise<void> }) {
  const [hsn, setHsn] = useState(product.taxReview?.hsnCode || product.hsnCode), [unit, setUnit] = useState(product.taxReview?.unitCode || "");
  const [rate, setRate] = useState(String(product.taxReview?.gstRate ?? product.gstRate ?? "")), [treatment, setTreatment] = useState<TaxTreatment | "">(product.taxReview?.treatment || "");
  const [reference, setReference] = useState(""), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  const edit = (update: () => void) => { update(); setConfirmed(false); setError(""); };
  return <form aria-label="Tax classification review" onSubmit={event => {
    event.preventDefault();
    if (disabled || !confirmed || !treatment || !rate.trim() || reference.trim().length < 3) return;
    const gstRate = Number(rate);
    if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100 || (treatment === "taxable" ? gstRate <= 0 : gstRate !== 0)) { setError("Use a positive rate for taxable products, or zero for exempt and nil-rated products."); return; }
    void onSave({ hsnCode: hsn, unitCode: unit, gstRate, treatment, reviewReference: reference });
  }}>
    <fieldset disabled={disabled} className="space-y-4">
      {error && <Alert variant="error" title="Check tax rate">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Reviewed HSN code *" required pattern="[0-9]{4}([0-9]{2})?([0-9]{2})?" minLength={4} maxLength={8} inputMode="numeric" value={hsn} onChange={event => edit(() => setHsn(event.target.value))} hint="Use 4, 6 or 8 digits and meet your issuer's minimum." />
        <Input label="Document unit code *" required pattern="[A-Z]{3}" minLength={3} maxLength={3} value={unit} onChange={event => edit(() => setUnit(event.target.value.toUpperCase()))} hint="Three-letter document unit code from your source." />
        <Select label="Tax treatment *" required value={treatment} onChange={event => edit(() => setTreatment(event.target.value as TaxTreatment))} options={[{ value: "", label: "Choose tax treatment" }, { value: "taxable", label: "Taxable" }, { value: "exempt", label: "Exempt" }, { value: "nil_rated", label: "Nil rated" }]} />
        <Input label="Reviewed GST rate (%) *" type="number" required min={0} max={100} step="0.01" value={rate} onChange={event => edit(() => setRate(event.target.value))} hint="Positive for taxable; zero for exempt or nil rated." />
      </div>
      <Input label="Tax review reference *" required minLength={3} maxLength={500} value={reference} onChange={event => edit(() => setReference(event.target.value))} />
      {product.taxReview && <p className="break-words text-xs text-text-secondary">Previous reference: {product.taxReview.reviewReference}</p>}
      <Checkbox label="I confirm the tax classification and review reference" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
      <Button type="submit" loading={saving} disabled={!confirmed || !treatment || !rate.trim() || reference.trim().length < 3}>Save tax review</Button>
    </fieldset>
  </form>;
}
