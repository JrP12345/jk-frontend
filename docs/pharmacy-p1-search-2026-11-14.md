# Pharmacy P1 search increment — 14 November 2026

Continues [the pharmacy audit](pharmacy-priority-audit-2026-11-14.md) after the [P0 Save fixes](pharmacy-p0-save-reliability-2026-11-14.md). This increment improves existing counter discovery and selection; it does not replace the billing, prescription, stock or payment services.

## Result

| Before | Now |
| --- | --- |
| Medicine lookup only matched the start of the name or generic field | Up to eight distinct literal words can match across name, generic, strength and manufacturer in any order. For example, `acme 500 para` narrows the medicine list using all three terms. Regex punctuation is escaped. |
| Cached search only matched prefixes of the complete name/generic string | The encrypted working set searches name, generic, strength and manufacturer with the same multi-term matching approach. Exact barcodes retain leading zeroes and remain distinct from text search. |
| The last fetched page could replace first-page cache metadata and appear to be the whole result | Only the first page establishes query completeness/cursor metadata. Later pages contribute cached products without hiding the original next-page boundary. |
| Frequent picks from later pages could disappear when the first result page was shown again | Frequent reads the complete cached working set, ranked by pick count. It has its own empty state and does not show an unrelated server-page button. |
| An expired cached barcode match could be added online without checking it | Online barcode auto-add requires a fresh cached query or a server result. Offline preparation continues to use cached data; financial finalization still needs the server. |
| Clicking the search icon could just reuse fresh-but-outdated stock results | An explicit search forces a server read, so an operator can refresh an out-of-stock snapshot immediately. Normal cached typing stays local where possible. |
| Same-name products were difficult to distinguish by manufacturer | Manufacturer appears in the existing stock metadata line and cart batch caption. Add, quantity, edit and remove controls include manufacturer in their accessible labels. Rows retain their existing geometry. |
| Recorded customers could only be searched by name | Search accepts names, formatted phone numbers or fragments of at least three digits. Country-code/spacing/punctuation variations are handled without dropping leading zeroes. Numeric customer names still match. Results show the phone number before explicit selection. |
| A late customer response could show matches for text the operator had already changed | Editing the search invalidates the read and clears old results/page state. Loading and errors appear beside customer lookup rather than in medicine results or as a pending financial command. |

There is no fuzzy medicine substitution, schedule inference, automatic customer selection or additional review/collection step. Medicine eligibility remains server-projected; selecting a result still sends its actual identity and quantities through the existing authoritative Save workflow.

## Query scope and performance

- Both read endpoints retain branch/organization authorization, 25-result cursor pages, restricted projections and `Cache-Control: no-store`. Archived/supplier-only/GST-recipient/foreign customer records remain excluded from this counter lookup.
- Queries have a three-second database execution bound. Read failures return lookup-specific messages; they do not instruct the operator to recover a financial reference.
- Declared `pharmacy_counter_catalogue_page` on Medicine `{ locationId, deletedAt, _id }` supports branch-scoped, cursor-ordered retrieval without introducing derived search fields/backfills. The existing database-index setup workflow owns deployment of that index. No selected application database was connected or changed.
- A disposable replica-set fixture contained **10,000 products at the selected branch plus 1,000 at another branch**. A combined manufacturer/strength request returned the intended product in **244 ms** in the recorded local sample, including API authorization overhead. The equivalent unhinted query selected the new index and examined 10,001 branch records/keys, including the fixture's original product.
- This is a branch/order index, **not** an inverted index for arbitrary substring terms. The measurement is one synthetic local sample, not a production benchmark or p95 guarantee. An indexed normalized search projection or full branch catalogue/delta synchronization remains separate P1 work for larger deployments.

## Offline and scope limits

The working-set limit remains **250 products**, with the existing session-scoped encryption, expiry and memory-only fallback. This increment does not claim a complete 10,000-product offline catalogue. Increasing the blob limit alone would make frequent catalogue persistence rewrite the entire branch and could undo the P0 latency work. Full catalogue synchronization needs a separate persistence/update path and explicit completeness/freshness state.

The standalone offline assets were regenerated from source and the service-worker cache version advanced to v16. Private API/customer data is not added to service-worker caching. Existing cart drafts and current server-authoritative stock, prices, tax, units and professional checks remain in use. Purchase CSV mapping, shortbook, rack management and final offline billing are not included in this increment.

## Verification

- **81 distinct frontend cases passed** across checkout, catalogue, offline assets/policy and service-worker privacy, combining the initial 77-case run with the final 58-case checkout run and the two new Frequent follow-up cases. Coverage includes multiple manufacturer choices with independent quantities/removal, late customer responses, phone lookup/error placement, first/later cached pages, Frequent persistence/empty state, stale barcodes, explicit refresh, existing Save/print and recovery cases. The regenerated offline assets check also passed after the final cache change.
- **24 distinct backend cases passed** across counter/search behavior, including literal multi-field terms, barcode equality, branch access, customer filtering, paging, read failure and the 10,000-product fixture. The initial benchmark assertion incorrectly assumed a numeric search term would not match a product's numeric name; the fixture was corrected to use letter-only names and that benchmark passed. The updated phone/numeric-name case also passed separately; unchanged passing cases were not repeated.
- Both package TypeScript checks passed. Backend TypeScript includes tests; frontend TypeScript does not. Changed-file frontend ESLint passed. API and all four worker entrypoints bundled with the standard backend build options into `.cache/pharmacy-p1-search-build/`.
- No full release suite, physical barcode scanner/printer, live database timing or fresh browser geometry review was performed. Existing counter DOM/layout regression tests passed; no CSS/layout component was replaced.

Generated evidence: frontend `.next/pharmacy-search-tests.json` and `.next/pharmacy-search-counter-final.json`; backend `.cache/pharmacy-search-tests.json`, `.cache/pharmacy-search-phone-tests.json`, `.cache/pharmacy-search-benchmark-tests.json` and `.cache/pharmacy-search/benchmark.json`. These files are local verification artifacts; the initial runner result retains its failed benchmark assertion and the subsequent targeted report records the correction.
