# Branch catalogue preparation — 15 November 2026

This increment implements the full-branch offline preparation part of P1.1 in the [priority audit](pharmacy-priority-audit-2026-11-14.md). Billing-only mode remains deferred. Indexed normalized server search remains a separate increment.

## What changed

- Added authenticated `GET /api/pharmacy/sales/catalogue` under the existing pharmacy staff, module, sell-permission and branch-access checks. Pages contain at most 200 products and use the same anonymous product projection as ordinary counter search. Costs, supplier/customer details and professional review evidence are excluded; responses are `no-store`.
- A traversal has an upper product-ID boundary so ongoing additions cannot extend it indefinitely. Page fingerprints include the branch, page boundary, public product fields and continuation. An unchanged page returns its metadata with `items: null`.
- The client stages small encrypted, content-addressed pages and publishes a manifest only after a successful full traversal. Changed/missing products are reconciled on completion. Interrupted, invalid, cancelled or over-bound traversals retain the preceding complete view.
- The separate catalogue supports up to **20,000 active branch products**. A larger branch gets an explicit incomplete-refresh outcome and keeps online lookup/recent products available. It never silently marks a truncated catalogue complete.
- The existing **250-product recent/frequent/price cache remains small**. Cart picks, quantity edits and price snapshots do not serialize the full catalogue. Unchanged product pages are reused; older pages renew near expiry. Offline preparation and the online counter share the larger local discovery source.
- A delayed background refresh starts after the counter has an online connection, when preparation is absent or older than five minutes. Reconnecting also checks that age. Manual prepare/update remains available. There is no continuous change-stream subscription or automatic financial replay.
- The product panel shows preparation progress, product count, last refresh time and memory-only degradation. Full timestamps are available in its description. Failed refreshes retain the prior complete view and do not replace checkout with an error screen or loading skeleton.
- Old query/barcode/negative cache results cannot override a later complete refresh. Current local picks/confirmed-sale quantity adjustments remain in the small working set. Eligibility, unit-version and price evidence still come from the existing server Save/quote paths.
- The static offline preparation modules were regenerated and the public service-worker cache advanced to v17. Private catalogue APIs/data are not added to service-worker caching.

## Design limits

This is **page-level incremental transfer and persistence**, rather than an ordered database change feed. Refresh revalidates the branch pages on the server; unchanged page bodies are not downloaded or rewritten. It uses the existing branch/active-ID index and does not require broad write hooks, a new collection, migrations or a deployment-time backfill.

Traversal completion is not a transactionally frozen stock snapshot. Products can change while pages are read; later additions/changes are picked up by another refresh, and every Save still checks current stock, price, tax and authority. No stock is reserved by downloading the catalogue.

Existing session-scoped AES-GCM encryption and twelve-hour preparation lifetime remain in force. An unavailable/quota-failed IndexedDB path reports memory-only preparation. Logout/authority changes invalidate the shared session storage and queued writes. Obsolete/staged encrypted pages expire through the existing local storage cleanup; this does not introduce a durable shared-device key or final offline billing.

## Verification

Risk level 4: private local persistence, tenant-authorized catalogue API and shared counter discovery. No financial write contract or inventory mutation was changed.

The scoped results cover 10,000-product server/client traversal; unchanged-page reuse without full product rewrites during picks; changed/deleted identity, eligibility and price; original barcode/leading-zero behavior; interrupted refresh/reload; cancellation; malformed pages/cursors; a 20,001-product bound; empty branches; session/branch isolation; stale negative queries; expiry renewal; and concurrent cart editing during preparation.

- **114 distinct frontend cases passed** across branch preparation, recent catalogue, counter, drafts, sync lifecycle, generated offline assets, offline policy and service-worker privacy. Final targeted runs included 59 counter cases, 32 catalogue/sync/assets cases, the final three hook cases and the final 19 branch/assets cases; overlapping reruns are counted once.
- **50 distinct backend cases passed**: five new synchronization cases in `tests/pharmacyBranchCatalogueSync.test.ts`, 24 search/counter cases, and the preserved 21-case medicine catalogue suite. They use disposable MongoDB fixtures and include a full 10,000-product branch traversal.
- Both package TypeScript checks passed. Changed-file frontend ESLint, payment-boundary checks, generated offline modules and scoped tracked diff checks passed. The API and all four worker bundles built into isolated `.cache/pharmacy-catalogue-build/`; running services and `dist` were not replaced.
- The initial frontend run found a generated offline asset that needed regeneration and an eviction assertion that incorrectly rejected other products sharing the queried generic term. Both were corrected and their affected cases rerun. A test-file naming collision was corrected by retaining the existing medicine catalogue suite and placing the new tests in a separate file.
- No selected application database setup, physical scanner/printer, fresh browser geometry review or full release gate was performed. Client persistence-path tests use the existing memory fallback, not a claim that physical-device IndexedDB quota and durability were exercised. Existing encryption code was reused unchanged.

## Still open

Indexed normalized server search and query-plan validation at larger scale; operational stock shortcuts; prescription handoff acceptance; selected-environment/index readiness, competing tills and physical print checks. This catalogue remains preparation for online-authoritative billing.
