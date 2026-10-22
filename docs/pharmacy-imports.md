# Reviewed pharmacy CSV import (T24)

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

Verification: 126 distinct backend cases across five scoped files and 52 frontend cases across two files, package types, scoped lint, whitespace and five backend bundles passed. The 200-record synthetic review returned 109,021 bytes in 56 ms; its indexed file-source lookup examined one document. Only disposable synthetic databases changed. Full release, real browser/device, professional and production setup/import evidence remain separate T25/T26 gates.
