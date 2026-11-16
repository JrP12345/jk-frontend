# P1 saved supplier CSV mappings — 14 November 2026

Continues the [purchase CSV draft increment](pharmacy-p1-purchase-csv-2026-11-14.md) and [priority audit](pharmacy-priority-audit-2026-11-14.md). Saved distributor column and item mappings are implemented. A shorter complete-delivery posting/receiving flow remains separate work.

## Repeat-import flow

1. Select the supplier in the existing purchase draft, then choose Import purchase CSV.
2. On the first file, map columns, select the price basis, explicitly match medicines and check the preview as before.
3. After confirming that preview, optionally choose **Remember mappings for this supplier**. This saves preferences only; it does not save the purchase or receive stock. Applying the preview does not implicitly save these preferences.
4. Next time, a file with the same header names for this supplier and branch prefills the saved columns, price basis and still-valid medicine matches. Column order may change because mapping uses header names.
5. New source codes remain unmatched. Changed/deleted medicines or changed pack units show a rematching message. Preview still checks the current file's quantities/amounts and requires confirmation before applying lines.

The source field must identify the medicine, strength, manufacturer and pack unambiguously. A supplier can reuse a code or change the meaning of a column without changing its heading; the operator must review the current source invoice and reused matches. This feature does not infer medicine substitution or legal supply authority.

## Storage and integrity

- Formats belong to an organization, branch, supplier and exact set of normalized CSV header names. No cross-supplier, cross-branch or cross-organization reuse. A different header set starts without saved preferences.
- Source-item mappings are separate small records. Lookup fetches at most the current file's 100 source items by primary key, then validates those medicines. Saving a new file retains earlier item codes rather than replacing a growing catalogue blob. The source column is part of item identity, so changing that column does not silently reuse another column's matches.
- Stored medicine evidence is an identity hash over name/generic/strength/manufacturer and versioned pack units. Price, stock, tax rate, purchase amounts, raw CSV and invoice/payment details are not cached in these preferences. Current source amounts are parsed anew for each preview.
- Inspect and preview now explicitly require `supplierId`, in addition to branch and CSV. Returned scope/format identities and saved suggestions are validated by the frontend. No service-worker/IndexedDB/localStorage caching was added for this data.
- `PUT /api/pharmacy/purchase-csv/profile` requires existing purchase-management authority, an active visible supplier, a confirmed valid preview and reviewed identity hashes. It revalidates inside the transaction, saves metadata/items/audit together and pins the active pharmacy location.
- Optimistic revision checks prevent staff from overwriting competing edits. An identical retry from the same actor and expected revision returns the already-saved revision without a second metadata update or audit. A different stale edit requires reloading the file. A mapping failure does not discard or financially commit the purchase draft.
- Browser cancellation does not cancel or automatically replay a preference mutation. A late response after leaving the editor/auth scope is ignored; reopening the file checks persisted preferences. Applying a valid preview remains available if optional preference saving fails.
- Existing purchase draft, posting, payment, receipt and stock services retain financial authority. Supplier business revisions are not incremented by preference saves; the internal supplier claim only serializes the preference transaction against concurrent supplier edits.

## Database readiness

Two current-schema collections are declared: `PharmacyPurchaseCsvFormat` and `PharmacySupplierItemMapping`. Their scope-derived SHA-256 primary keys avoid a separate compound unique-index dependency. The existing explicit database setup workflow discovers both models. Its **disconnected schema preview** was checked; no selected application database was connected or changed. Operators should include these collections in normal current-schema setup before enabling the feature in their selected environment.

No migration, backfill or hypothetical legacy compatibility layer was added.

## Verification

Risk level 4: authenticated persisted supplier preferences and shared purchase-preview contracts.

- **31 frontend cases passed**: 17 CSV/mapping cases and 14 existing purchase-editor cases. Coverage includes restored formats, stale suggestions, optional remembering, unchanged-parameter retries, wrong save revisions, scope validation, late mutation responses and the original CSV-to-draft command path.
- **49 distinct backend cases passed**: the unchanged passing 30 purchase-draft and 9 CSV preparation cases, plus the final 10 mapping persistence cases. Mapping coverage includes supplier/branch/organization/header isolation, reordered columns, retained codes, changed/deleted identity/unit evidence, concurrent saves, same-request recovery, permissions, disabled module, archived supplier and audit-failure rollback. No financial/stock records are created by remembering preferences.
- The initial mapping run exposed Mongoose Map casting of Fastify's null-prototype JSON object. The validated map is now converted to a plain object at the persistence boundary; the secure parser remains intact. Initial backend TypeScript findings concerned optional nullable medicine fields and loss of an index signature during object spreading; both were corrected. Temporary debugging instrumentation was removed.
- Both package TypeScript checks passed. Changed-file frontend ESLint passed with the purchase parent's existing effect warning and no warnings in the new mapping code. Scoped tracked diff checks passed.
- API and all four worker bundles passed the standard build options into `.cache/pharmacy-supplier-mappings-build/`. Existing `dist`/running services were not replaced. Disconnected index preview discovered both models.
- No selected-database setup, live supplier invoice, browser geometry review, physical scanner/printer or full CI/release gate was exercised. Database integration cases use disposable replica-set fixtures.

Evidence: frontend `.next/pharmacy-supplier-mappings-tests.json`; backend `.cache/pharmacy-supplier-mappings-tests.json` (initial failures retained), `.cache/pharmacy-supplier-mappings-final.json` and `.cache/pharmacy-supplier-mapping-index-preview.log`.

## Still open from the audit

Simplify normal complete-delivery draft/post/receive navigation while preserving partial receipts and financial boundaries. XLS/XLSX/OCR, original-file archives, percentage-discount/unit-cost transformations, mixed price bases and direct batch/expiry receipt import remain outside this increment. Full branch offline catalogue synchronization, scalable indexed search, shortbook/rack/expiry shortcuts and real-store readiness checks also remain open.
