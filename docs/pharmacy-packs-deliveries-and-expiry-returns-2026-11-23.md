# Pack conversion, delivery review and expiry return preparation

Implemented 23 November 2026 in the development frontend/backend. This extends the [controlling pharmacy plan](pharmacy-final-implementation-plan-2026-11-22.md); it does not close the five real-store acceptance demonstrations.

## Recorded box, strip and tablet relationships

An optional outer pack adds an explicit third level to the existing base/pack definition. For example, one box contains ten strips and one strip contains ten tablets. Both outer fields must be supplied together, the names must differ, and the total factor is bounded to one million base units. No factor is inferred from a product name or reference catalogue pack label.

Catalogue editing, reference adoption and catalogue/opening imports accept the relationship. Counter, purchase, order and stock-receipt controls show separate outer/inner pack quantities. Purchase CSV mapping accepts billed/free outer packs and an explicit outer-pack price basis; prices must convert to whole paise exactly. Stock, source allowances, reports and financial commands continue to use explicit base units. Scanning an ordinary product barcode does not silently change its pack level.

The full versioned relationship is captured in purchase, order, lot, dispense, transfer and offline document snapshots, retained through original return source links, and preserved in bounded catalogue/cart caches. Source comparisons include both outer fields. A unit change is blocked after stock history or a posted purchase, including a posted purchase awaiting receipt. Configure and review units before posting or receiving stock.

The integration case receives 100 tablets, sells three loose tablets, replays the same sale reference and checks the remaining 97 tablets. Returning one tablet adds a quarantined lot and physical stock becomes 98; the original saleable lot remains 97.

## Bulk delivery batch and expiry entry

The saved posted invoice can produce a delivery CSV template. Its invoice, revision, branch, supplier, line, product and complete unit identities must match when imported. Staff fill the actual batch, printed expiry precision/date and independently billed/free base quantities. They may split batches or remove rows for a partial delivery. The UI accepts CSV or values-only XLSX through the existing bounded file reader; the resulting manifest is limited to 100 lots and 256 KB of CSV text.

Parsing rejects malformed quoting, duplicate/missing headers, altered source facts, invalid dates and quantities beyond the original remaining allowances. It does not guess batches or expiry. Staff inspect the preview and explicitly confirm the physical delivery before applying it to the receiving form. Larger deliveries use compact expandable lot summaries. The actual delivery reference and the existing stock command are still required; file review alone does not receive goods or change a payable. Existing original-key recovery remains authoritative after an uncertain receipt.

The API integration case prepares 50 different medicines with billed/free quantities and different printed batches/months. An over-received final lot rejects the delivery without receiving any stock. The valid receipt creates 50 lots; repeating the original reference returns the original receipt without receiving stock twice.

This is a reviewed Ekavyu delivery template, not a claim that every distributor's arbitrary spreadsheet contains correctly mapped batches and expiry. Real supplier files and configured OCR still require acceptance.

## Supplier-specific expiry return drafts

Supplier finance provides an explicit near-expiry source search and local draft preparation. The server reads one branch snapshot, checks original purchase/receipt allowances, includes expired stock, and separates unlinked opening stock or unsuitable dispositions for review. The search is bounded to 200 positive lots, 25 purchases, 2,000 source records/lines and an elapsed read budget, with individual database query timeouts. Exceeding a bound fails explicitly instead of returning a truncated complete-looking result.

Staff select actual whole base quantities, then prepare one packing-list CSV per supplier. Different original invoices remain individually identified inside a supplier group. CSV cells are formula-safe. The packing list explicitly records that preparation has not moved goods or posted credit; drafts are local and are not reservations or supplier acceptance.

Opening an invoice return reloads the original source and carries the selected receipt quantities into the existing return editor. Missing or reduced source allowances require correction. A reason, actual review/reference, fresh expected-credit quote and explicit goods-return confirmation remain necessary. Existing revision checks, idempotency, stock movements and audit records control final posting. Supplier credit notes and actual refunds remain separate evidence.

The integration scenario covers 80, 70 and 50 tablets: twenty strips across three suppliers. Additional cases cover unlinked opening stock, quarantined source stock, changed allowances, current permissions, foreign branches and an over-bound search. No supplier claim is presumed accepted.

## Clinic prescription originals

The original-file component is also available for each signed clinic prescription row in the dispensing dialog. Clinic list/download requires clinic queue access; upload additionally requires restricted-dispensing authority. The source must be owned by the branch and be part of its currently finalized, sealed clinical selection. Outside-prescription grants alone do not grant clinic access. Outside and clinic sources have separate immutable source kinds, object namespaces, filters and unique request identities, including when their IDs coincide.

The shared private-storage workflow retains the original retry identity before uploading, encrypts filename/object-key metadata, audits attachment and download, and bounds files by size/count/type. Attaching files does not change signed clinical content, fulfillment revisions, quantities, stock or money. Staff load metadata explicitly; bytes and filenames are not placed in local billing caches. Clinical file controls disappear when the source/auth scope changes.

There is no automatic deletion. Finalized-current prescription navigation does not replace broader clinical history access for superseded/deleted sources. Reviewed retention, legal holds/purge procedures, configured object storage and a real database/object/key restore drill remain operating gates.

## Verification and remaining scope

Risk level: 4, because shared unit facts reach billing, inventory, offline documents and clinical files. The scoped checks cover direct consumers and related catalogue, purchase, posting, receipt, supplier/customer return, stock, transfer, import, checkout, offline ownership/import and clinical dispense recovery paths. Frontend and backend type checks, changed-file lint, the payment boundary check, advisory tenant scan, offline asset generation and backend API/worker build are recorded with the implementation checkpoint. Full CI and release acceptance remain separate.

Recorded result: 314 distinct backend cases and 372 distinct frontend cases passed across the scoped runs and corrected follow-ups. Both package type checks passed, frontend lint reported no errors (five existing effect warnings in the wider changed-file selection), payment boundary and offline asset generation passed, and the API plus four worker bundles built successfully. The advisory tenant scan completed with 142 repository warnings; this is not a clean isolation audit. New endpoint role/source/branch isolation is exercised in integration cases. Diff whitespace checks passed in both repositories. These checks describe this uncommitted development worktree, not an exact-revision CI or release acceptance result.

The local Chrome probe is `scripts/performance/check-pharmacy-packs-and-deliveries.mjs`. It checks real components with synthetic read responses at 360, 390, 768 and 1440 pixels: pack quantities, a 50-line CSV review, three supplier drafts and read-only clinic files. Its 16 combinations passed without document overflow, page errors, external requests or business writes. Ignored results/screenshots are under `.next/pharmacy-packs-acceptance/`; Vitest/type/build logs use `.next/pharmacy-pack-*` and `backend/build/pharmacy-pack-*`.

Public offline assets are regenerated for cache v26 with the unit helper and current document digest. Existing prepared authority must be stopped and reconciled with its original ledger/checkpoint before changing its pinned engine. Never erase its journal, reuse reserved numbers or release the branch fence to make an update succeed.

Shared multi-counter LAN offline coordination remains unfinished engineering. The existing designated-PC cash-only boundary is unchanged. Real printer/scanner and old-PC acceptance, store speed, supplier/Marg exports, catalogue rights, private-storage restore, live providers and commercial/support arrangements also remain open. This increment does not establish complete pharmacy or release readiness.
