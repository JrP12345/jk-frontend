import { validatePharmacyUnits, type PharmacyUnitDefinition } from "./pharmacyUnits";
import { PHARMACY_CALCULATION_ENGINE_SHA256 } from "./generated/pharmacyCalculation";
import { PHARMACY_OFFLINE_DOCUMENT_SHA256 } from "./generated/pharmacyOfflineDocument";
import { validateOfflineNumberLease, type OfflineNumberLease, type OfflineLedgerLot } from "./pharmacyOfflineLedger";
import { yieldPharmacyBackgroundWork } from "./pharmacyBackgroundWork";
import type { PharmacyTaxDocument } from "./pharmacyInvoice";

export interface OfflinePreparationScope { organizationId: string; locationId: string; actorId: string; authorityId: string; deviceId: string; enrollmentId: string }
export interface PreparedOfflineProduct {
  id: string; name: string; genericName: string; barcodes: string[];
  unitDefinition: { version: number; baseUnit: string; packUnit: string; unitsPerPack: number; outerPackUnit?: string; packsPerOuter?: number };
  stockQuantity: number; availableQuantity: number; stockRevision: number; dispensingRevision: number; taxRevision: number;
  hsnSacCode: string; unitCode: string; gstRateBps: number; classificationGstRateBps: number; taxTreatment: string; taxReviewReference: string;
}
export interface OfflinePreparedData extends OfflinePreparationScope {
  checkoutEnabled: false; manifestDigest: string; preparedAt: string; validUntil: string; lease: OfflineNumberLease;
  drawer: { id: string; code: string; openingFloatPaise: number }; issuer: PharmacyTaxDocument["issuer"]; issuerRevision: number; issuerReviewReference: string;
  products: PreparedOfflineProduct[]; lots: Array<OfflineLedgerLot & { expiryCutoff: string; hsnCode: string; gstRateBps: number }>;
  calculationEngineSha256: string;
}
type Envelope = { page: number; payload: string; sha256: string; signature?: string; signingKey?: { id: string } };
const objectId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
const whole = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown, max = 500): value is string => typeof value === "string" && Boolean(value.trim()) && value.length <= max && !/[\p{Cc}\p{Cf}]/u.test(value);
const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const bytes = (value: string) => new TextEncoder().encode(value);
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value)).map(byte => byte.toString(16).padStart(2, "0")).join("");
const digest = async (value: string) => hex(await crypto.subtle.digest("SHA-256", bytes(value)));
const fail = (): never => { throw new Error("Signed offline preparation is incomplete, changed or belongs to another operator/device. Reconnect before billing."); };
function envelope(value: unknown, page: number): Envelope {
  const row = value as Envelope;
  if (!row || row.page !== page || typeof row.payload !== "string" || bytes(row.payload).byteLength > 1024 * 1024 || !/^[a-f0-9]{64}$/.test(row.sha256)) return fail();
  return row;
}
/** Trust is supplied independently from the authenticated enrollment, never from
 * the manifest's own JWK. Self-signed replacement manifests cannot promote trust.
 */
export async function offlineTrustedSigningKey(value: { id: string; jwk: JsonWebKey }) {
  if (!value || !/^[a-f0-9]{64}$/.test(value.id) || value.jwk?.kty !== "RSA" || "d" in value.jwk) return fail();
  const key = await crypto.subtle.importKey("jwk", value.jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["verify"]);
  if (await digestBytes(await crypto.subtle.exportKey("spki", key)) !== value.id) return fail();
  return { id: value.id, key };
}
async function digestBytes(value: ArrayBuffer) { return hex(await crypto.subtle.digest("SHA-256", value)); }
export async function verifyOfflinePreparation(value: unknown, scope: OfflinePreparationScope, signer: { id: string; key: CryptoKey },
  readPage: (page: number) => Promise<unknown>, options: { signal?: AbortSignal; now?: number } = {}): Promise<OfflinePreparedData> {
  if (!scope || ![scope.organizationId, scope.locationId, scope.actorId].every(objectId) || [scope.authorityId, scope.deviceId, scope.enrollmentId].some(value => typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value))) return fail();
  const original = envelope(value, -1), cancelled = () => { if (options.signal?.aborted) throw new Error("Offline preparation was cancelled. Nothing was provisioned."); };
  cancelled();
  if (original.signingKey?.id !== signer.id || typeof original.signature !== "string" || !/^[\w-]{256,1024}$/.test(original.signature) ||
      signer.key.type !== "public" || signer.key.algorithm.name !== "RSASSA-PKCS1-v1_5" || await digest(original.payload) !== original.sha256) return fail();
  const signature = Uint8Array.from(atob(original.signature.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", signer.key, signature, bytes(`ekavyu.pharmacy.prepared-stock.v1\n${original.payload}`))) return fail();
  let raw: unknown;
  try { raw = JSON.parse(original.payload); } catch { return fail(); }
  if (!record(raw) || raw.version !== 1 || raw.purpose !== "ekavyu.pharmacy.prepared-stock.v1" || raw.checkoutEnabled !== false || raw.inventoryMode !== "tracked" ||
      Object.entries(scope).some(([field, value]) => !text(value, 100) || raw[field] !== value) ||
      !record(raw.calculation) || raw.calculation.policy !== "pharmacy-paise-v2" || raw.calculation.sha256 !== PHARMACY_CALCULATION_ENGINE_SHA256 || raw.calculation.documentSha256 !== PHARMACY_OFFLINE_DOCUMENT_SHA256 ||
      !instant(raw.preparedAt) || !instant(raw.validUntil) || !whole(raw.products, 0, 10000) || !whole(raw.lots, 0, 50000) ||
      !Array.isArray(raw.pages) || raw.pages.length > 300 || !record(raw.lease) || !record(raw.drawer) || !record(raw.issuer) ||
      !whole(raw.issuerRevision, 1) || !text(raw.issuerReviewReference)) return fail();
  const now = options.now ?? Date.now(), lease = raw.lease as unknown as OfflineNumberLease;
  validateOfflineNumberLease(lease);
  if (!Number.isFinite(now) || now < Date.parse(raw.preparedAt) - 60_000 || now > Date.parse(raw.validUntil) || raw.preparedAt < lease.validFrom || raw.preparedAt >= lease.validUntil || raw.validUntil !== lease.validUntil || lease.id !== scope.enrollmentId ||
      !objectId(raw.drawer.id) || !text(raw.drawer.code, 40) || !whole(raw.drawer.openingFloatPaise) ||
      !text(raw.issuer.legalName) || !text(raw.issuer.address) || !text(raw.issuer.authorisedSignatory) || !/^(0[1-9]|[12][0-9]|3[0-8])$/.test(String(raw.issuer.stateCode)) ||
      !["regular", "composition", "unregistered"].includes(String(raw.issuer.registration)) || !Array.isArray(raw.issuer.drugLicenceNumbers) || !raw.issuer.drugLicenceNumbers.length || raw.issuer.drugLicenceNumbers.length > 10 ||
      raw.issuer.drugLicenceNumbers.some(value => !text(value)) || (raw.issuer.registration === "unregistered" ? Boolean(raw.issuer.gstin) : !/^[0-9A-Z]{15}$/.test(String(raw.issuer.gstin)))) return fail();
  const products: PreparedOfflineProduct[] = [], lots: OfflinePreparedData["lots"] = [], productIds = new Set<string>(), lotIds = new Set<string>();
  for (let index = 0; index < raw.pages.length; index++) {
    cancelled(); const reference = raw.pages[index];
    if (!record(reference) || reference.page !== index || !/^[a-f0-9]{64}$/.test(String(reference.sha256))) return fail();
    const page = envelope(await readPage(index), index); cancelled();
    if (page.sha256 !== reference.sha256 || await digest(page.payload) !== reference.sha256) return fail();
    let decoded: unknown; try { decoded = JSON.parse(page.payload); } catch { return fail(); }
    if (!record(decoded) || decoded.version !== 1 || decoded.authorityId !== scope.authorityId || decoded.page !== index || !Array.isArray(decoded.records) || !decoded.records.length || decoded.records.length > 200) return fail();
    for (const value of decoded.records) {
      if (!record(value) || !objectId(value.id)) return fail();
      if (value.kind === "product") {
        const unit = value.unitDefinition;
        if (productIds.has(value.id) || !text(value.name, 200) || !text(value.genericName) || !record(unit) || !whole(unit.version, 1) || !text(unit.baseUnit, 40) || !text(unit.packUnit, 40) || !whole(unit.unitsPerPack, 1, 1000000) ||
            !whole(value.stockQuantity) || !whole(value.availableQuantity, 1) || value.availableQuantity > value.stockQuantity || !whole(value.stockRevision) || !whole(value.dispensingRevision, 1) || !whole(value.taxRevision, 1) ||
            !/^\d{4}(\d{2})?(\d{2})?$/.test(String(value.hsnSacCode)) || !/^[A-Z]{3}$/.test(String(value.unitCode)) || !whole(value.gstRateBps, 0, 10000) || !whole(value.classificationGstRateBps, 0, 10000) || (raw.issuer.registration === "regular" ? value.gstRateBps !== value.classificationGstRateBps : value.gstRateBps !== 0) ||
            !["taxable", "exempt", "nil_rated"].includes(String(value.taxTreatment)) || !text(value.taxReviewReference) || !Array.isArray(value.barcodes) || value.barcodes.length > 100 || value.barcodes.some(code => !text(code, 100))) return fail();
        validatePharmacyUnits(unit as unknown as PharmacyUnitDefinition);
        productIds.add(value.id); const product = { ...value }; delete product.kind; products.push(product as unknown as PreparedOfflineProduct);
      } else if (value.kind === "lot") {
        if (lotIds.has(value.id) || !objectId(value.medicineId) || !whole(value.quantity, 1) || value.revision !== 0 || !text(value.batchNumber, 100) ||
            !whole(value.sellingPricePaise) || !whole(value.mrpPaise) || value.sellingPricePaise > value.mrpPaise || !instant(value.expiryCutoff) || !text(value.expiryValue, 10) ||
            !["month", "date"].includes(String(value.expiryPrecision)) || !whole(value.gstRateBps, 0, 10000) || !/^\d{4}(\d{2})?(\d{2})?$/.test(String(value.hsnCode))) return fail();
        const date = value.expiryPrecision === "month" ? `${value.expiryValue}-01` : value.expiryValue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) return fail();
        const cutoff = new Date(`${date}T00:00:00.000Z`);
        if (value.expiryPrecision === "month") cutoff.setUTCMonth(cutoff.getUTCMonth() + 1); else cutoff.setUTCDate(cutoff.getUTCDate() + 1);
        if (new Date(cutoff.getTime() - 330 * 60_000).toISOString() !== value.expiryCutoff || Date.parse(value.expiryCutoff) <= Date.parse(raw.preparedAt)) return fail();
        lotIds.add(value.id); const lot = { ...value }; delete lot.kind; lots.push(lot as unknown as OfflinePreparedData["lots"][number]);
      } else return fail();
    }
    if (products.length > raw.products || lots.length > raw.lots) return fail();
    await yieldPharmacyBackgroundWork();
  }
  if (products.length !== raw.products || lots.length !== raw.lots) return fail();
  const quantities = new Map<string, bigint>();
  const byProduct = new Map(products.map(product => [product.id, product]));
  for (const lot of lots) {
    const product = byProduct.get(lot.medicineId);
    if (!product || lot.hsnCode !== product.hsnSacCode || lot.gstRateBps !== product.classificationGstRateBps) return fail();
    quantities.set(lot.medicineId, (quantities.get(lot.medicineId) ?? BigInt(0)) + BigInt(lot.quantity));
  }
  if (products.some(product => quantities.get(product.id) !== BigInt(product.availableQuantity))) return fail();
  cancelled();
  return { ...scope, checkoutEnabled: false, manifestDigest: original.sha256, preparedAt: raw.preparedAt, validUntil: raw.validUntil, lease,
    drawer: raw.drawer as unknown as OfflinePreparedData["drawer"], issuer: raw.issuer as unknown as PharmacyTaxDocument["issuer"], issuerRevision: raw.issuerRevision,
    issuerReviewReference: raw.issuerReviewReference, products, lots, calculationEngineSha256: PHARMACY_CALCULATION_ENGINE_SHA256 };
}
