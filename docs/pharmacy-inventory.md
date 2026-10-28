# Pharmacy catalogue and inventory

Current implementation contracts, consolidated 24 October 2026. Examples are illustrative. Local implementation and dated checks do not establish live professional, provider or deployment approval. Use [release evidence and operating gates](pharmacy-release-evidence.md) for those prerequisites. New installations need current schema setup, not hypothetical historical migrations.

- [Catalogue and units](#catalogue-and-units)
- [Captured lots and opening receipts](#captured-lots-and-opening-receipts)
- [Stock counts and movement history](#stock-counts-and-movement-history)
- [Reviewed CSV import](#reviewed-csv-import)
- [Controlled branch transfers](#controlled-branch-transfers)

## Catalogue and units

T10 is implemented locally. Existing Medicine IDs and location ownership remain authoritative. This is catalogue configuration; receiving stock and reviewing tax or restricted-drug evidence remain separate actions.

`POST /api/medicines` requires `locationId`, `name`, `genericName` and a finite non-negative retail `price`. Omitted stock starts at zero. An empty product needs no batch, expiry or acquisition cost and creates no stock movement. Catalogue permission is sufficient; supplying acquisition cost additionally requires cost permission. The legacy opening-stock body still requires receiving and cost permission, an actual batch/expiry pair and cost. Positive opening stock cannot be combined with a new unit definition: configure the empty product, then receive stock.

Create/update metadata includes manufacturer, strength, composition (`genericName`), dosage form (`category`), schedule classification, reorder level, barcode aliases and explicit units. Zero reorder, price and GST values survive round trips. Metadata writes cannot change stock, approve tax evidence or change an existing reviewed schedule classification. Existing reviewed classification endpoints retain their revision checks. Numeric strings and null stock/money values are rejected before schema coercion.

`unitDefinition` contains `baseUnit`, `packUnit`, `unitsPerPack` and a server-owned version. Conversion factors are whole numbers from 1 to 1,000,000 and multiplication must remain a safe integer. An edit supplies `expectedUnitVersion` (zero for an absent definition). Changing units requires zero stock and no batch history, including depleted batches; a concurrent first receipt prevents the edit. Legacy units remain absent rather than being guessed or silently converted. T11/T25 establish reviewed lot and opening-unit snapshots.

Up to 20 distinct barcode strings are accepted; each is at most 64 characters, using letters, digits, dot, underscore, slash or hyphen. Leading zeros and case are preserved. An active barcode is unique within a location; soft-deleted products release aliases. The new partial unique barcode index must be reviewed and prepared through the existing deployment tooling. No live index or backfill was applied during implementation.

`GET /api/medicines` supports a bounded `search` (100 characters), exact `barcode` (64 characters), `stockFilter=all|low|out|expired`, `page`, `limit` (maximum 100), and up to 100 comma-separated `medicineIds`. Search covers name, generic composition, strength, manufacturer, batch and exact aliases. Results have deterministic name/ID order and existing pagination headers. Tenant assertions and branch authority are checked; cost remains redacted without its grant.

The workspace requests one catalogue page at a time. Search and filters run on the server. Low-stock alerts page independently, and page charts describe only the visible page. Opening a prescription performs a bounded lookup of its exact stock IDs; search selections remain cached for that draft. Scanner Enter searches without submitting a dispense. The clinical editor bounds catalogue queries while preserving the original prescription text.

T11 now routes products with explicit units into [captured stock/opening receipts](pharmacy-inventory.md#captured-lots-and-opening-receipts). Legacy products retain their original batch dialog. Ambiguous development fixtures require explicit unit review; fresh installations use current schema setup.

## Captured lots and opening receipts

T11 is implemented locally. The existing Medicine, MedicineBatch, StockMovement and OperationReceipt models remain the stock and replay authorities. This increment adds captured lots and a receiving form; it does not post a supplier liability, record supplier payment, migrate historical quantities or approve a production cutover.

T13 now reuses the receiving adapter for [source-bound supplier deliveries](pharmacy-purchasing.md#supplier-invoices-and-deliveries), with a separate posted payable and purchase progress. Use that path for supplier-bill deliveries. Legacy `/batches` requires an explicit unlinked inward reason and cannot attach a purchase ID; never enter the same physical delivery through both paths.

### Receipt API

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

### Compatibility and index gate

The existing `POST /api/pharmacy/batches` remains available for legacy products, including its duplicate-label conflict. Its transaction serializes on the Medicine quantity/revision, preserving concurrent duplicate protection. Once a product has captured lots, legacy inward is rejected so it cannot mix an unverified unit basis into those lots. Legacy receiving into unreconciled history has not been globally switched to a new stock mode.

New explicit receipts require the actual unique `(organizationId, locationId, receiptLineId)` index named `pharmacy_receipt_line_v1`, partial on `lotVersion: 1`. Missing readiness returns 503 before stock writes. The schema stops declaring the old batch-label index so it will not be recreated after a separately approved cutover. **No code path drops an installed legacy index.** A retained unique batch-label index blocks repeated printed batches with an actionable 409. After reviewed reconciliation and index replacement, distinct receipt lines can share the same real printed batch while retaining separate cost/MRP lots. Never use `syncIndexes` or an automatic index drop to bypass this review. Existing index preparation remains a separate operator action.

Current schema/index setup is the T25 requirement. Optional read-only diagnostics can investigate development fixtures; historical backfill and migration cutover are not required.

### Recovery and workspace

`GET /api/pharmacy/stock-receipts/:key?locationId=...` requires current branch/history authority and the original actor. It returns the committed encrypted snapshot with `Cache-Control: no-store`. Acquisition cost and rational cost basis are redacted without the cost grant. Authorized recovery survives location disable and product soft deletion; new stock remains blocked by the existing transactional capability pin. A 404 is not proof that an in-flight command failed.

For products with explicit units, the existing Add batch action opens the receiving form. Legacy products keep their existing dialog. The new form asks for real batch/expiry, pack and loose quantities, total acquisition cost and per-base selling/MRP prices; opening counts are an explicit selection. It does not prefill an invented total cost. Only an opaque key is persisted, scoped by account, organization, impersonation and location. A failed/uncertain send keeps its reference and frozen in-memory payload for an identical retry. After reload, the operator can select the original medicine and re-enter details using that same key; the server's captured request hash and unique source line still prevent duplicate stock. A committed result must be acknowledged before starting a fresh receipt. No patient, cost or receipt body is stored in local storage.

## Stock counts and movement history

This backend contract extends the existing pharmacy routes. It requires pharmacy staff, the pharmacy module, `PHARMACY_ADJUST_STOCK` (or legacy `MANAGE_MEDICINES`), and current organization/branch access. T08's [location capability](pharmacy-capabilities.md) blocks new adjustments at disabled locations while preserving authorized replay of committed commands. No stock-count UI is introduced by T03.

### Count and submit

Read the medicine's `stockRevision` with the stock being counted. Historical records without a stored revision have revision **0**. For structured inventory, select a batch from the existing batch endpoint and pin its quantity with that revision. Preserve both values throughout the count and any retries. A conflict requires reloading and recounting; refreshing only the revision would defeat the safeguard.

`POST /api/pharmacy/adjust-stock`

```json
{
  "medicineId": "<medicine ObjectId>",
  "batchId": "<batch ObjectId>",
  "expectedQuantity": 10,
  "expectedRevision": 0,
  "newQuantity": 7,
  "reason": "physical_audit",
  "notes": "Counted seven units",
  "clientRequestId": "<stable UUID for this count>"
}
```

- Quantities and revisions are non-negative safe integers. `expectedRevision` must be below `Number.MAX_SAFE_INTEGER` so it can advance once.
- `expectedQuantity` and `newQuantity` refer to the selected batch. Omit `batchId` only for proven aggregate-only inventory; then they refer to the medicine's aggregate quantity.
- Structured counts require a batch belonging to that medicine and branch. Batch totals must reconcile with the aggregate. Mismatches require inventory review; this endpoint does not manufacture a balancing lot.
- Reasons are `physical_audit`, `damaged`, `expired`, `restock`, or `other`. `other` requires explanatory notes. Notes are optional otherwise and limited to 500 characters.
- Damage/expiry write-offs must decrease quantity; restock must increase it. Increasing expired or unknown-expiry stock is rejected. Expired stock remains unavailable to dispensing after a downward count.
- A write-off removes units from tracked stock. Its movement does not certify physical disposal, create a supplier return, or create a refund. Those workflows remain separate.
- The request identifier contains 8–100 letters, digits, underscores or hyphens. Keep it and the complete payload unchanged through transport retries. Use a new identifier for a new deliberate count.

A successful response is `200` with `data: { movement, replayed }`. The persisted movement includes `_id`, organization/location/medicine IDs, `kind`, `stockMode`, `revision`, aggregate `beforeQuantity`/`afterQuantity`/`quantityDelta`, selected-batch `allocations`, reason, disposition, actor, notes and creation time. It is the committed snapshot; replay does not substitute today's medicine balance. `replayed` is true when an existing receipt was returned.

All database effects commit together: command receipt, selected batch, aggregate projection, revision, movement and required audit. A stale quantity/revision, key reuse with changed details, unsupported aggregate edit, or reconciliation problem returns `409`. Invalid input returns `400`; inaccessible/deleted medicine or mismatched batch returns `404`; unsupported standalone MongoDB returns `503`. Failed writes leave no successful command receipt, so the same request may be retried after the failure is resolved. Current branch/role authority is checked before replay.

### Read movement history

`GET /api/pharmacy/medicines/:id/stock-movements?limit=50&beforeRevision=12`

History requires `PHARMACY_VIEW_REPORTS`, `PHARMACY_ADJUST_STOCK`, `PHARMACY_RECEIVE_STOCK` or legacy `MANAGE_MEDICINES`. `limit` defaults to 50 and is capped at 100. Omit `beforeRevision` for the latest page. The response contains `data: { movements, nextBeforeRevision }`, ordered by descending revision. Use the returned cursor for the next page. Authorized history remains readable after the medicine is soft-deleted; new adjustments and dispensing remain blocked.

The existing catalogue response exposes `stockRevision`; batch reads retain their current routes. Metadata PUT accepts an unchanged quantity field for compatibility, but any quantity change returns `409` and must use the adjustment endpoint. Old adjustment requests lacking expected quantity, revision or request identifier also return an actionable `409`. There is no frontend caller of the old adjustment endpoint in the inspected source.

### Prospective history and transaction boundary

The first receipt, dispense or adjustment after T03 creates one `opening_baseline` aggregate checkpoint at the observed revision. Its delta is zero and it does not alter stock. Subsequent movements advance the medicine revision once per operation and record aggregate arithmetic plus touched-lot quantities. Receipts and multi-batch FEFO dispensing use this same prospective ledger. Catalogue creation establishes its opening quantity; the first subsequent inventory operation checkpoints that opening balance.

The baseline records an observed aggregate, not a certification or backfill of historical inward/sale sources. Each touched batch carries its observed before/after balance. Existing aggregate/batch ambiguity remains a review case for T11/T25. Stock movements are append-only through the Mongoose model; corrections are new commands rather than edits to committed history.

Inventory mutation requires an active MongoDB transaction, including local development. Receipt, dispensing and adjustment fail closed on standalone MongoDB. No compensating aggregate overwrite is used in place of atomic ledger/projection writes. No migration or live-data backfill is part of T03.

## Reviewed CSV import

Implemented locally. No live files or production records were imported. **Import source CSV** in the pharmacy workspace uses existing catalogue validation, stock receiving, opening-dues/invoice and operation-receipt services. No parser dependency, proprietary catalogue, historical turnover reconstruction or legacy backfill is added.

CSV is strict UTF-8: at most 512,000 bytes, 200 data records, 40 columns and 2,000 characters per field. Quoted commas/quotes/newlines, BOM and leading-zero identifiers are preserved. Ambiguous columns/quotes, duplicate normalized headers, invalid Unicode and unsupported controls are rejected. Dates, units and whole/exact decimal amounts are explicit; no spreadsheet expression or dosage text is evaluated.

| Kind | Required mapped fields | Effect |
| --- | --- | --- |
| Catalogue | sourceId, name, genericName, category, scheduleType, baseUnit, packUnit, unitsPerPack, sellingPrice | Empty product; optional barcode/manufacturer/strength/reorderLevel. Separate dispensing and tax approvals remain required. |
| Opening stock | sourceId, medicineId, baseUnit, packUnit, unitsPerPack, packs, looseUnits, batchNumber, expiryPrecision, expiry, purchaseTotal, sellingPrice, mrp | Owned empty product with no prior stock history; explicit matching units and future printed expiry. Total acquisition INR and per-base-unit selling/MRP. |
| Customer/supplier dues | sourceId, partyId, sourceDate, amount | Actual owned party, ISO date and positive INR due. Existing supplier obligation/customer opening statement, without supply, tax or stock. |

The server supplies required columns for manual mapping. Names are never fuzzy product/party identities. Actual source/count and review references bind an immutable encrypted actor-bound manifest. Revised mapping/review may create another manifest; identical CSV text cannot become another physical source under a different reference. After changed preconditions, review the corrected source/mapping or a new review reference. Unmapped raw columns are not persisted.

Preview checks duplicate source IDs/barcodes, existing aliases, owned product/party IDs, units and opening history. Related history uses indexed existence lookups limited to one result per product. Several opening lots form one indivisible product unit; one invalid lot prevents that whole group from posting. Initial empty/no-history validation, all lots, movements, revisions, audit and source receipt commit atomically. New sources require active explicit India/INR configuration, rechecked and pinned during posting.

Totals explicitly cover valid preview rows. Quantities stay separated by base unit; acquisition cost and actual dues are separate exact paise totals. Explicit confirmation posts at most ten valid source units per request. Posted, invalid, failed, unprocessed, conflicting and unknown outcomes remain visible. **Check saved import** and paginated actor-bound history recover source receipts after interruption without polling.

Durable tenant/branch/kind/source keys and original fact hashes prevent repeated files/chunks or changed mappings/reviews from duplicating posted stock/liability. A mismatched committed result remains unknown for review. There is no financial receipt TTL. Posted errors use existing reviewed corrections against the affected remaining lot or financial source; import cannot overwrite sold quantities or original obligations.

**Download reconciliation CSV** is an audited feature download containing manifest/digest, source lines/IDs, states/errors and original created product/lot/statement references. Spreadsheet formulas/control prefixes are neutralized; failure preserves review state.

Every operation checks current staff, tenant, branch and source grants. Catalogue requires catalogue/stock authority; openings also require independent cost authority; dues require organization management and customer/supplier source access. Consumers are denied. Grant loss hides private review/export data. Commercial expiry preserves authorized recovery/export; new posting still requires product and operational capability access. Preview does not enable a disabled branch.

## Controlled branch transfers

Implemented locally; no production activation, legal approval or live stock changes are asserted. Each transfer selects one actual source lot and one explicitly matching destination product within the same organization. Multiple products/lots use separate reviewed transfer records. There is no new stock balance or payment engine.

The existing pharmacy workspace has a **Stock transfers** tab for staff with `PHARMACY_TRANSFER` (or organization-management authority) and independent acquisition-cost access. Product searches, source lot pages, history and custody events are bounded to 20 records. The current branch and shared location selector remain authoritative. Search and selection never infer identity from a fuzzy name: the command compares normalized name/formulation/manufacturer/strength, category/schedule, tax classification and complete unit definition before allowing a map.

Preparation requires an active India/INR organization, both live branch grants, current pharmacy products/capabilities, actual issuer/licence profiles and real review/delivery-document references. Only the same reviewed legal issuer, state, registration type and GSTIN are supported. Distinct GST registrations, interstate or electronic-reporting requirements need a separately validated document workflow and are blocked here. The application records the actual manual document reference; it does not issue a tax invoice, e-way bill or transport approval.

Stages use existing transaction/operation receipts and explicit expected transfer revisions:

- Prepare a draft without reserving or moving stock; an approver with both branch grants reviews the immutable product, lot and issuer snapshots.
- Dispatch the approved batch at the source. Lot and aggregate decrement together; that quantity is now in transit and cannot be sold at either branch.
- The destination records partial actual saleable or quarantine receipts. Each creates a distinct captured lot and `transfer_in` stock movement. Expired stock can enter quarantine, never saleable stock.
- A source receiver can record in-transit goods physically returned to source quarantine. A reviewed loss requires current authority at both branches. Dispatched goods cannot be cancelled; unshipped drafts/approvals can.

`dispatched = saleable received + quarantine received + lost + returned + in transit` at every committed stage. Conditional transfer/stock revisions and unique custody-event revisions prevent concurrent dispatch/receipt from exceeding the approved physical quantity. Current receipt/event indexes are readiness requirements and are prepared through the explicit T25 setup command; requests never drop or create indexes.

Incoming lots retain the original exact cost numerator/denominator, printed batch/expiry precision/cutoff, unit/MRP/price evidence and a transfer/event/source-lot lineage. A 1-unit receipt from a 10-unit lot costing 10,001 paise keeps `10001 / 10` paise per base unit. It is not rounded into another purchase cost. These lots work with the existing FEFO, counter quotes, returns and valuation paths. Quarantine is ineligible for sale.

H/H1 approval requires current reviewed classification and branch pharmacist evidence at both branches; dispatch and saleable receipt recheck the responsible branch's current professional evidence. Quarantine reception does not pretend to be a patient supply. X/narcotic movement remains blocked. No prescription, patient, register sale or invoice is fabricated for a transfer.

New preparation/approval/dispatch pins active commercial/capability access. Authorized completion of already dispatched goods remains a custody correction; quarantine receipt/return and loss do not require a new purchase. The actual receiving branch/product must be available. Archiving an emptied source catalogue item does not prevent physical reception at its active destination. Changed product/unit evidence or issuer requirements require review; a changed issuer can use quarantine rather than an unsupported saleable receipt.

Every stage records an append-only custody event, stock source links, required audit and encrypted immutable replay result atomically. The UI retains only an opaque stage key/action/transfer identity in session storage. Lost responses are recovered with that reference; retries keep the same frozen request/key. A recorded outcome must be acknowledged before another stage. Account, permission and branch changes clear private views. Current grants are required for all reads and recovery; consumer roles and foreign tenants cannot probe transfers. Earlier custody events remain cursor-accessible beyond the latest 20.

Level 4 checks: 21 transfer integration cases plus 78 lot/return/report/setup regressions; 59 transfer/workspace UI cases; both package types, changed-file lint and five backend bundles. Coverage includes actual partial custody, concurrent stages, audit rollback, exact fractional cost, existing counter quote validation, expired transit, restricted professional revocation, client mapping/recovery, foreign/consumer denial and paginated physical history. Real professional, transport, browser/device, restore and release evidence remains T26.
