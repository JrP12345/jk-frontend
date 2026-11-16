# P1 purchase CSV draft preparation — 14 November 2026

Continues the [priority audit](pharmacy-priority-audit-2026-11-14.md) after the Save and search increments. This is the first inward-entry increment, not completion of all P1.2 work.

Follow-up: [Saved supplier column/item mappings](pharmacy-p1-supplier-mappings-2026-11-14.md) are now implemented. The scope and verification below describe this earlier CSV-only increment.

## What changed

The purchase draft editor now offers **Import purchase CSV** after selecting a supplier. It accepts a UTF-8 CSV from one supplier invoice, maps distributor column names, explicitly matches source items to existing branch medicines, and previews exact quantities and amounts. Applying a valid, confirmed preview appends lines to the existing draft. It preserves the supplier, invoice header and manual lines. Save continues through the original purchase draft command.

1. Open Purchases & parties → New purchase draft (or an existing draft).
2. Select the supplier and enter the original invoice number/date/stated total.
3. Choose Import purchase CSV and upload the distributor CSV.
4. Map the source item, billed quantity, line base amount, GST, HSN and selling price columns. Free quantities, loose quantities, discount amount and MRP are supported.
5. Select whether CSV selling prices and MRP are per base unit or per full pack. Match each distinct source code/description to an existing medicine and check its manufacturer/strength/pack size. Repeated source items share that explicit selection; rows remain separate purchase lines.
6. Preview, correct any reported source-row errors, then confirm the medicine/quantity/price review and add the lines to the draft.
7. Review/save the draft; use the existing posting and receiving workflow to capture tax evidence, printed batches and expiry.

Column mappings are prefilled only for exact canonical header names. Other distributor names require mapping. No medicine is guessed from similar names, and the raw CSV is not evaluated as a spreadsheet. Source codes retain leading zeroes. CSV text/temporary matches stay in component memory; this increment does not add localStorage, IndexedDB or service-worker caching for purchase files.

## Integrity and limits

- Existing bounded CSV parser: 512,000 bytes, at most 40 columns, 2,000 characters per cell; purchase input further limits the file/draft to 100 lines. Invalid UTF-8, malformed quotes, inconsistent columns and duplicate headers fail inspection.
- The two new authenticated, no-store POST endpoints (`/pharmacy/purchase-csv/inspect` and `/preview`) are read-only and require purchase-management authority and branch/module access. Medicine queries are branch-scoped and omit costs. Wrong-branch, deleted, missing and changed-unit products yield row errors.
- Draft and CSV preview share the purchase-line schema validator. INR values use the existing exact paise parser; quantities use safe integers and explicit current pack versions. GST/HSN are captured source values, not inferred from medicine names or current catalogue defaults. Percent discounts/unit purchase rates cannot be mapped as line discount/base amounts.
- Pack selling prices/MRP convert only when the result is whole paise per base unit. The preview flags fractional-paise cases rather than silently rounding. Line base/discount amounts remain line amounts.
- Unmapped quantity/discount fields explicitly mean zero. Mapped blank numeric cells need correction; optional blank MRP remains unrecorded. The preview displays ignored columns, pack conversion, billed/free quantities, base/discount, GST/HSN, selling price and MRP.
- One erroneous row prevents applying the entire preview. Mapping, medicine or price-basis changes invalidate both preview and confirmation. Late file/medicine responses are discarded; explicit search retry and medicine pagination are available.
- The draft cannot be saved while its CSV editor is open. Applying closes the importer; closing it without applying leaves current draft lines intact. Supplier changes remount the CSV editor; branch/auth changes remount the purchase session.
- Preview/application creates no stock, supplier payable, payment or invoice. Existing Save validates current supplier/product/unit revisions and supplier invoice deduplication again. Existing reviewed posting, partial receipts, stock movements and stable command keys remain authoritative.

## Remaining inward-entry work

Saved supplier-specific column/item mappings across files are not yet implemented. This version requires explicit matching for each new import, and does not retain an original-file archive. XLS/XLSX, OCR, multi-invoice splitting, percentage-discount/rate transformations, mixed price bases in one file, direct batch/expiry receipt import and a combined complete-delivery post/receive UI remain separate work. The source must contain one invoice's line records; header fields and batch/expiry columns are not automatically imported.

## Verification

Risk level 4: purchase-line validation is shared with the financial draft path.

- 34 distinct frontend cases passed: 24 final CSV/editor cases plus 10 unchanged purchase-operations cases from the initial run. The initial run's only failed assertion matched the same pack text in both the selection summary and preview; it was scoped to the preview and rerun successfully.
- 97 distinct backend cases passed: the existing 88 draft/posting/receipt/CSV cases and 9 final purchase-CSV cases. The initial access test expected 403 for a foreign organization's branch; the intended concealment response is 404. The corrected test also verifies unauthenticated access, disabled module and revoked purchase permission.
- Both package TypeScript checks, changed-file frontend ESLint and scoped diff checks passed. The existing purchase parent retains its pre-existing effect lint warning; the new CSV component has no lint warnings.
- API and all four worker bundles built with the standard options into isolated `.cache/pharmacy-purchase-csv-build/`, without replacing `dist` or connecting to the selected application database.
- No live supplier file, browser geometry review, physical printer, production database or full release suite was exercised. Tests use synthetic APIs and disposable database fixtures.

Evidence: frontend `.next/pharmacy-purchase-csv-tests.json` and `.next/pharmacy-purchase-csv-final.json`; backend `.cache/pharmacy-purchase-csv-tests.json`, `.cache/pharmacy-purchase-csv-access-final.json` and `.cache/pharmacy-purchase-csv-final.json`. Initial reports retain the corrected assertion failures; final reports record the passing focused reruns.
