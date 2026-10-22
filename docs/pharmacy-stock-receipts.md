# Explicit pharmacy lot and opening receipts

T11 is implemented locally. The existing Medicine, MedicineBatch, StockMovement and OperationReceipt models remain the stock and replay authorities. This increment adds captured lots and a receiving form; it does not post a supplier liability, record supplier payment, migrate historical quantities or approve a production cutover.

T13 now reuses the receiving adapter for [source-bound supplier deliveries](pharmacy-purchase-posting.md), with a separate posted payable and purchase progress. Use that path for supplier-bill deliveries. Legacy `/batches` requires an explicit unlinked inward reason and cannot attach a purchase ID; never enter the same physical delivery through both paths.

## Receipt API

`POST /api/pharmacy/stock-receipts` requires current staff/branch authority, the receiving grant and a stable `Idempotency-Key` containing 8–100 letters, digits, underscores or hyphens. The body is a strict allowlist; strings/null are never coerced into stock, money or unit versions. Organization consistency assertions remain available to the tenant guard.

```json
{
  "medicineId": "000000000000000000000001",
  "locationId": "000000000000000000000002",
  "receiptLineId": "count-sheet-line-001",
  "kind": "opening",
  "expectedUnitVersion": 1,
  "packs": 1,
  "looseUnits": 2,
  "batchNumber": "ACTUAL-PRINTED-BATCH",
  "expiry": { "precision": "month", "value": "2099-12" },
  "purchaseTotalPaise": 100,
  "sellingPricePaise": 1000,
  "mrpPaise": 1200,
  "openingSourceReference": "Actual reviewed physical count reference"
}
```

The example uses synthetic IDs and prices. The server loads the current explicit unit definition; `packs × unitsPerPack + looseUnits` must be a positive safe integer and loose units must be fewer than one pack. Unit versions must match. Acquisition cost is a total in integer paise for all received base units, including any free units. Selling price and optional MRP are explicitly **per base unit**, also in integer paise; selling price cannot exceed captured MRP. Amounts are bounded at 100,000,000,000 paise. This path requires an explicitly configured India/INR organization. No pack MRP or price is inferred or rounded into a per-unit price.

Opening receipts require a new empty product with no batch or stock-movement history and an actual source reference. An ordinary receipt may extend captured lots only when all prior lots have matching owned units and their quantities reconcile to the aggregate. Legacy, depleted legacy, mixed-location or unexplained aggregate balances require T25 review; none becomes an inferred opening difference. Receiving more than 5,000 existing lots for a product requires a reviewed workflow.

A lot captures its organization, receipt-line identity/kind, received time/quantity, unit version/factor, exact cost basis, selling price/MRP and printed expiry. Cost basis is `{ totalPaise, receivedBaseUnits, currency }`; the compatibility floating-point purchase cost is a projection. Exact remaining cost is represented as a fraction, with a BigInt numerator serialized as a string. This preserves fractional paise without asserting an accounting valuation policy. Captured snapshot fields are immutable; stock quantity/status continue through the existing allocation and adjustment paths.

Printed expiry is explicitly a day or month. A month lasts through its last local day; a day lasts through that local day. The stored cutoff is the exclusive next local midnight, captured with the location timezone. Invalid calendar dates/timezones and expired new stock are rejected. Existing legacy expiry values are untouched. FEFO sorts cutoff, received time and ID and validates captured units, ownership, prices and expiry before allocation. The alerts UI shows the captured printed value rather than presenting the cutoff as a fabricated printed day.

The command reservation, lot, aggregate revision, movement, required audit and encrypted received-result snapshot commit in one transaction with majority write concern. An opening creates a zero-delta prospective ledger checkpoint and one `opening_receipt` movement; only the latter adds stock. Receipt replay returns the original received result even after later sales. Reusing a source receipt line under another key or changing a committed key's payload returns conflict. No purchase payable or sales turnover is created by this command.

## Compatibility and index gate

The existing `POST /api/pharmacy/batches` remains available for legacy products, including its duplicate-label conflict. Its transaction serializes on the Medicine quantity/revision, preserving concurrent duplicate protection. Once a product has captured lots, legacy inward is rejected so it cannot mix an unverified unit basis into those lots. Legacy receiving into unreconciled history has not been globally switched to a new stock mode.

New explicit receipts require the actual unique `(organizationId, locationId, receiptLineId)` index named `pharmacy_receipt_line_v1`, partial on `lotVersion: 1`. Missing readiness returns 503 before stock writes. The schema stops declaring the old batch-label index so it will not be recreated after a separately approved cutover. **No code path drops an installed legacy index.** A retained unique batch-label index blocks repeated printed batches with an actionable 409. After reviewed reconciliation and index replacement, distinct receipt lines can share the same real printed batch while retaining separate cost/MRP lots. Never use `syncIndexes` or an automatic index drop to bypass this review. Existing index preparation remains a separate operator action.

T25 still owns historical unit/organization/lot backfill, collection-wide orphan review, stable migration markers, actual pilot evidence, backups/isolated restore and index cutover. The read-only review tool recognizes captured lots without falsely labelling legitimate repeated printed batches as legacy duplicates. No existing stock, bill or clinical identifier is rewritten by deploying these compatible readers.

## Recovery and workspace

`GET /api/pharmacy/stock-receipts/:key?locationId=...` requires current branch/history authority and the original actor. It returns the committed encrypted snapshot with `Cache-Control: no-store`. Acquisition cost and rational cost basis are redacted without the cost grant. Authorized recovery survives location disable and product soft deletion; new stock remains blocked by the existing transactional capability pin. A 404 is not proof that an in-flight command failed.

For products with explicit units, the existing Add batch action opens the receiving form. Legacy products keep their existing dialog. The new form asks for real batch/expiry, pack and loose quantities, total acquisition cost and per-base selling/MRP prices; opening counts are an explicit selection. It does not prefill an invented total cost. Only an opaque key is persisted, scoped by account, organization, impersonation and location. A failed/uncertain send keeps its reference and frozen in-memory payload for an identical retry. After reload, the operator can select the original medicine and re-enter details using that same key; the server's captured request hash and unique source line still prevent duplicate stock. A committed result must be acknowledged before starting a fresh receipt. No patient, cost or receipt body is stored in local storage.

## Verification

Level 4. **216 distinct backend cases across nine files and 53 frontend cases across three files passed**, covering receipt replay/concurrency, distinct repeated cost lots, retained/missing indexes, wrong units/ownership/currency, stock mismatches/revisions, opening history, expiry/DST/leap dates, exact rational cost, price/MRP bounds, live grants/consumer denial, capability-disable races, required-audit rollback, financial/register/clinical regressions and reload recovery. Both package TypeScript checks, backend API/four-worker build, whitespace checks and changed-file frontend lint passed (zero errors, four warnings). Tests used isolated synthetic replica sets; index creation/removal in readiness tests was confined to those disposable databases. No full suite, frontend production build, real browser/printer validation, production index operation, backfill, provider action or deployment ran.
