# Pharmacy ownership guards and catalogue performance

> Historical increment report. The later [connected final-offline implementation](pharmacy-offline-final-billing-2026-11-15.md) supersedes the disabled-checkout and remaining-work status below. Enrollment/preparation alone still grants no billing authority; verified activation is separate.

Follow-up: the [preparation/calculation increment](pharmacy-offline-preparation-and-calculation-2026-11-15.md) adds shared calculation, ledger price recomputation, classification fences and immutable signed server preparation. Verification counts below describe this earlier ownership increment.

Continued the [offline implementation plan](pharmacy-offline-final-billing-2026-11-15.md). Implemented the internal stock/drawer ownership foundation and improved current catalogue preparation/search. **The complete remaining offline flow is not finished. Final counter Save still requires internet.**

## Ownership foundation

- A transaction can claim one enrolled PC/operator, branch and existing INR drawer. Unique indexes enforce one held authority per branch and drawer. The original device must prove possession of its enrolled P-256 key; the reviewed request binds branch, operator, device revision, drawer/revision, current time and a stable authority ID.
- Acquisition pins the device against concurrent revocation and uses the existing branch and drawer transaction fences. Required audit, ownership pointers, drawer revision and immutable signed evidence commit together with majority write concern. A failure rolls back everything. Exact retries recover the original evidence.
- Shared pharmacy transaction pins reject competing online stock/money mutations while ownership is held. The covered paths include counter/clinical dispensing, stock receipts and adjustments, transfers, returns, purchases and their shared consumers. Direct physical reconciliation, branch inventory-mode changes, drawer posting/lifecycle and branch deactivation also obey the fence. Normal unowned branches use their existing transaction path; the owner predicate adds no database round trip to a successful normal pin or drawer claim.
- The first implementation conservatively blocks shared preparatory writes that use the same pharmacy pin while the branch is held. Authorized reads/history remain available. Other branches remain independent. Internal import code may cross the fence only through an explicitly verified server context; request headers/body fields never create that context.
- Expiry or device revocation never clears stock/drawer ownership or recycles reserved numbers. Revocation can stop future preparation while the original held state remains available for reconciliation. Ownership evidence cannot be normally overwritten/deleted; only lifecycle and import-progress fields can change.
- The signed ownership envelope is explicitly `checkoutEnabled: false`. It is not an offline billing grant. Its lease starts no earlier than acquisition. Snapshot preparation, offline operator authorization and import must still be completed before activation.
- An internal cancellation can release preparation that **never activated checkout or imported any bills**. It requires the original operator/device proof, expected revision and required audit; it preserves authority history and number reservations. It rejects activated sessions. Issuing devices still need a stopped-ledger checkpoint, complete import and audited reconciliation before release/replacement.
- The API exposes only an authenticated, branch-scoped read at `GET /api/pharmacy/locations/:locationId/offline-authority`. Only the original operator receives the signed envelope; other authorized branch readers receive ownership availability. Acquisition and release HTTP routes/UI remain unavailable, preventing a user from freezing a real branch before the remaining lifecycle is usable.

No real branch or drawer was claimed for verification. Existing online POS remains the product flow.

## Current older-PC improvements

The working catalogue previously requested all matching branch products before keeping 25 results. It now requests at most 275 branch candidates: 250 allow for newer working-set changes that invalidate old branch hits, leaving 25 valid results. Branch search stops as soon as its explicit result bound is reached and avoids building an intermediate array of every match. Exact barcode lookup retains duplicate detection and literal matching, including barcodes with spaces. Rare searches can still scan the bounded catalogue; this is not a new full substring index.

Catalogue index construction yields to browser interaction after each 200 products using MessageChannel, stages complete maps, checks cancellation, then publishes a complete view. Existing encrypted 200-product pages, hash-based unchanged-page reuse, preparation expiry and prior-complete-view behavior remain. These cached products are still preparation, not dispensing or stock authority.

The public offline preparation assets include the new pure helper, with explicit `.js` import rewriting and service-worker cache version 22. No invoice, payment, patient or authority data was added to the public cache. No dependencies were added.

## Verification

Risk level 4 for ownership/shared financial guards; scoped frontend/catalogue and public-cache regressions also run:

- All **13 new ownership cases passed** across focused runs: atomic claim, exact replay, held-write rejection with valid counter/stock inputs, verified-context scope, audit rollback, stale/foreign/expired proof, concurrent claims, expiry without reclamation, unused release/replay/audit rollback, activated-session release rejection, immutable evidence, read-route scope/no mutation route, device revocation and branch deactivation/release continuity. The foreign-branch assertion was corrected to the existing tenant contract's 404 response; no authorization behavior was relaxed.
- Related suites passed for paid checkout, cashier drawers, stock movement, physical reconciliation, transfers, returns, pickups, billing-only, outside prescriptions and the existing clinical location workflow. Recorded runs include 91 cases in the stock/drawer group, 56 in the adjacent pharmacy group, 29 in the updated ownership/drawer group, and 12 clinical-location workflow cases; these groups overlap and must not be summed as distinct coverage.
- **47 distinct frontend cases passed** across branch catalogue, working catalogue, catalogue sync, generated offline assets, service-worker privacy and offline policy. Final affected branch/assets rerun passed all 21 cases. Direct consumers, barcode semantics, negative-cache invalidation, abort/failure, unchanged-page reuse and the 10,000-product fixture remain covered.
- **13 real Chrome checks passed**, including IndexedDB restart, independent draft/Save queues, complete 10,000-product preparation, injected quota failure/logout races and synthetic A4/80mm/58mm print/PDF checks. The added synthetic 4× CPU probe observed 49 indexing yields, a 25-result broad-search p50 about 0.2 ms/p95 about 0.7 ms over 30 samples, one sparse-search sample about 35.7 ms, and exact barcode lookup. These are controlled local measurements, not an actual older-PC baseline, statistically reliable tail latency or a Save SLA. Results: `.next/pharmacy-browser-acceptance/`, including `synthetic-catalogue-performance.json`.
- Both package TypeScript checks, changed frontend ESLint, isolated API/four-worker bundles and diff checks passed. No unrelated full-suite/release claim is made.
- Read-only selected-development-database inspection reports **120 models, 559 expected indexes, transaction capable, ready, no issues**. New indexes were already present through the development server; no setup command or business-record migration was used as a test.

## Still required

1. Complete signed product/issuer/lot preparation, common calculation/validation and bounded offline operator unlock across restart. The local ledger's initial anonymous tracked-cash scope must be respected until additional cases are implemented and verified.
2. Authenticated, ordered server import of immutable invoice/payment/stock evidence, duplicate/response-loss recovery and conflict review. Preserve the issued number/prices; never accept a client acknowledgement as proof of server commit.
3. Counter/offline-shell Save and Print wiring, verified local provisioning, compact pending-sync status and network-independent checkout with bounded background retries. Activation must remain gated until these dependencies work together.
4. Stop/drain/reconcile release for issuing devices, protected export/restore and original-device recovery/replacement. Unused-preparation cancellation does not satisfy these requirements.
5. Actual weak-network and older-PC acceptance, storage-loss/full-disk exercises, physical printers and intended-environment/release gates. CPU throttling and PDFs do not replace these checks.
