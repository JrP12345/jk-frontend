// @vitest-environment node
import crypto from "node:crypto";
import { beforeAll, expect, it } from "vitest";
import { offlineTrustedSigningKey, verifyOfflinePreparation, type OfflinePreparationScope } from "@/lib/pharmacyOfflinePreparation";
import { PHARMACY_CALCULATION_ENGINE_SHA256 } from "@/lib/generated/pharmacyCalculation";
import { PHARMACY_OFFLINE_DOCUMENT_SHA256 } from "@/lib/generated/pharmacyOfflineDocument";
import { verifyOfflineCheckoutGrant } from "@/lib/pharmacyOfflineGrant";

const now = Date.parse("2026-11-15T06:00:00.000Z");
const scope: OfflinePreparationScope = { organizationId: "a".repeat(24), locationId: "b".repeat(24), actorId: "c".repeat(24), authorityId: crypto.randomUUID(), deviceId: crypto.randomUUID(), enrollmentId: crypto.randomUUID() };
const keys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const signingKey = { id: crypto.createHash("sha256").update(keys.publicKey.export({ type: "spki", format: "der" })).digest("hex"), jwk: keys.publicKey.export({ format: "jwk" }) };
let signer: Awaited<ReturnType<typeof offlineTrustedSigningKey>>;
beforeAll(async () => { signer = await offlineTrustedSigningKey(signingKey); });
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
function fixture() {
  const product = { kind: "product", id: "d".repeat(24), name: "Synthetic cotton", genericName: "Cotton", barcodes: ["89012345"], stockQuantity: 10, availableQuantity: 10,
    unitDefinition: { version: 1, baseUnit: "piece", packUnit: "box", unitsPerPack: 10 }, stockRevision: 1, taxRevision: 1, dispensingRevision: 1,
    hsnSacCode: "300490", unitCode: "NOS", gstRateBps: 0, classificationGstRateBps: 0, taxTreatment: "nil_rated", taxReviewReference: "Synthetic review" };
  const lot = { kind: "lot", id: "e".repeat(24), medicineId: product.id, quantity: 10, revision: 0, batchNumber: "ORIGINAL", expiryValue: "2027-12", expiryPrecision: "month",
    expiryCutoff: "2027-12-31T18:30:00.000Z", sellingPricePaise: 1500, mrpPaise: 2000, hsnCode: "300490", gstRateBps: 0 };
  const raw = { version: 1, purpose: "ekavyu.pharmacy.prepared-stock.v1", checkoutEnabled: false, ...scope, inventoryMode: "tracked",
    calculation: { policy: "pharmacy-paise-v2", sha256: PHARMACY_CALCULATION_ENGINE_SHA256, documentSha256: PHARMACY_OFFLINE_DOCUMENT_SHA256 },
    preparedAt: "2026-11-15T05:59:00.000Z", validUntil: "2026-11-15T12:00:00.000Z", products: 1, lots: 1,
    lease: { id: scope.enrollmentId, prefix: "I00012627/", financialYear: "2026-27", next: 1, last: 100, validFrom: "2026-11-15T05:58:00.000Z", validUntil: "2026-11-15T12:00:00.000Z" },
    drawer: { id: "f".repeat(24), code: "COUNTER-01", openingFloatPaise: 10000 }, issuerRevision: 1, issuerReviewReference: "Synthetic issuer review",
    issuer: { registration: "unregistered", legalName: "Synthetic pharmacy", address: "Synthetic address", stateCode: "24", drugLicenceNumbers: ["SYNTHETIC"], authorisedSignatory: "Synthetic pharmacist" },
    pages: [] as Array<{ page: number; sha256: string }> };
  const sign = () => {
    const payload = JSON.stringify(raw);
    return { page: -1, payload, sha256: hash(payload), signingKey, signature: crypto.sign("RSA-SHA256", Buffer.from(`ekavyu.pharmacy.prepared-stock.v1\n${payload}`), keys.privateKey).toString("base64url") };
  };
  const page = (records: unknown[] = [product, lot]) => {
    const payload = JSON.stringify({ version: 1, authorityId: scope.authorityId, page: 0, records });
    const result = { page: 0, payload, sha256: hash(payload) }; raw.pages = [{ page: 0, sha256: result.sha256 }]; return result;
  };
  return { raw, product, lot, page, sign };
}
it("verifies the server's paged wire contract and returns preparation with no checkout authority", async () => {
  const f = fixture(), page = f.page(), result = await verifyOfflinePreparation(f.sign(), scope, signer, async () => page, { now });
  expect(result).toMatchObject({ ...scope, checkoutEnabled: false, calculationEngineSha256: PHARMACY_CALCULATION_ENGINE_SHA256 });
  expect(result.products).toHaveLength(1); expect(result.lots).toHaveLength(1); expect(result.products[0].availableQuantity).toBe(10);
});
it("rejects a changed payload/page and a self-signed key substituted for the trusted enrollment", async () => {
  const f = fixture(), page = f.page(), manifest = f.sign();
  await expect(verifyOfflinePreparation({ ...manifest, payload: manifest.payload.replace("pharmacy", "changed") }, scope, signer, async () => page, { now })).rejects.toThrow();
  await expect(verifyOfflinePreparation(manifest, scope, signer, async () => ({ ...page, payload: page.payload.replace("1500", "1") }), { now })).rejects.toThrow();
  const foreign = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`ekavyu.pharmacy.prepared-stock.v1\n${manifest.payload}`), foreign.privateKey).toString("base64url");
  await expect(verifyOfflinePreparation({ ...manifest, signature }, scope, signer, async () => page, { now })).rejects.toThrow();
});
it("rejects foreign scope, expired preparation and an unrecognized calculator before requesting pages", async () => {
  const f = fixture(), page = f.page(); let reads = 0; const read = async () => { reads++; return page; };
  await expect(verifyOfflinePreparation(f.sign(), { ...scope, locationId: "1".repeat(24) }, signer, read, { now })).rejects.toThrow();
  await expect(verifyOfflinePreparation(f.sign(), scope, signer, read, { now: now + 86400000 })).rejects.toThrow();
  f.raw.calculation.sha256 = "0".repeat(64) as typeof PHARMACY_CALCULATION_ENGINE_SHA256;
  await expect(verifyOfflinePreparation(f.sign(), scope, signer, read, { now })).rejects.toThrow(); expect(reads).toBe(0);
});
it.each(["missing-lot", "duplicate-product", "foreign-lot", "wrong-stock", "bad-mrp", "bad-expiry"])("rejects cryptographically valid but inconsistent preparation: %s", async variant => {
  const f = fixture();
  if (variant === "foreign-lot") f.lot.medicineId = "1".repeat(24);
  if (variant === "wrong-stock") f.product.availableQuantity = 9;
  if (variant === "bad-mrp") f.lot.mrpPaise = 1000;
  if (variant === "bad-expiry") f.lot.expiryCutoff = "2027-12-31T23:59:59.999Z";
  const records = variant === "missing-lot" ? [f.product] : variant === "duplicate-product" ? [f.product, f.product, f.lot] : [f.product, f.lot];
  const page = f.page(records);
  await expect(verifyOfflinePreparation(f.sign(), scope, signer, async () => page, { now })).rejects.toThrow();
});
it("cancels incomplete downloads without returning a partial provisionable snapshot", async () => {
  const f = fixture(), page = f.page(), controller = new AbortController();
  await expect(verifyOfflinePreparation(f.sign(), scope, signer, async () => { controller.abort(); return page; }, { now, signal: controller.signal })).rejects.toThrow(/cancelled/);
});

it.each(["valid", "foreign-device", "other-stock", "other-drawer", "wrong-policy", "extended-window", "self-signed"])("checks the independent checkout activation against durable preparation: %s", async variant => {
  const f = fixture(), page = f.page(), prepared = await verifyOfflinePreparation(f.sign(), scope, signer, async () => page, { now });
  const raw = { version: 1, purpose: "ekavyu.pharmacy.checkout-grant.v1", checkoutEnabled: true, ...scope, actorAuthVersion: 0, inventoryMode: "tracked",
    manifestDigest: prepared.manifestDigest, lease: prepared.lease, drawer: prepared.drawer, calculation: f.raw.calculation, validFrom: "2026-11-15T06:00:00.000Z", validUntil: prepared.validUntil };
  if (variant === "foreign-device") raw.deviceId = crypto.randomUUID();
  if (variant === "other-stock") raw.manifestDigest = "0".repeat(64);
  if (variant === "other-drawer") raw.drawer = { ...raw.drawer, id: "1".repeat(24) };
  if (variant === "wrong-policy") raw.calculation = { ...raw.calculation, policy: "different" };
  if (variant === "extended-window") raw.validUntil = "2026-11-16T12:00:00.000Z";
  const payload = JSON.stringify(raw), foreign = variant === "self-signed" ? crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }) : keys;
  const grant = { authorityId: scope.authorityId, payload, sha256: hash(payload), signingKey, signature: crypto.sign("RSA-SHA256", Buffer.from(`ekavyu.pharmacy.checkout-grant.v1\n${payload}`), foreign.privateKey).toString("base64url") };
  if (variant === "valid") expect(await verifyOfflineCheckoutGrant(grant, prepared, signer)).toMatchObject({ authorityId: scope.authorityId, actorId: scope.actorId, manifestDigest: prepared.manifestDigest });
  else await expect(verifyOfflineCheckoutGrant(grant, prepared, signer)).rejects.toThrow(/checkout grant/);
});
