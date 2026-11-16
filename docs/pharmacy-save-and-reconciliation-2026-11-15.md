# Save latency and branch physical reconciliation — 15 November 2026

This increment implements the agreed online-checkout and physical-count work. Final offline invoice issuance and optional P2 integrations remain deferred.

## Save: finding and change

Catalogue snapshots, cart drafts and recovery intents previously shared a single in-process storage queue. Encryption or a queued cache operation could delay a financial intent before the Save request even started. Storage now serializes operations **per encrypted record**. Same-record revisions/CAS and session invalidation remain enforced; unrelated records do not wait for each other's encryption tasks. IndexedDB itself still serializes conflicting database transactions.

The Chrome probe used a real encrypted IndexedDB recovery-intent write while deliberately delaying catalogue encryption by 700 ms:

| Probe | Before | After |
| --- | ---: | ---: |
| Recovery-intent completion | 714 ms, after catalogue | 8 ms, before catalogue |

This is a controlled contention regression, not a measured 706 ms improvement for every bill. No real store was billed or paused for verification. The actual configured store's end-to-end latency remains an operating acceptance item.

The normal flow remains local cart edits → draft/recovery evidence → one atomic server invoice/payment/stock command → saved document for printing. No quote is added to ordinary priced-cart edits. Current server validations, duplicate protection, payment confirmation and majority commit remain in place. No successful bill is announced before server commit.

Browser DevTools records bounded durations with no identifiers or payloads: `pharmacy.checkout`, `pharmacy.draft_write`, `pharmacy.intent_write`, `pharmacy.save_request`, `pharmacy.print_handoff`, and allowlisted `pharmacy.server.*` phases. The API exposes `Server-Timing` through the existing allowed-origin CORS policy. Missing timing evidence does not change the financial outcome. Server phases overlap (`command` contains preparation and other work); do not add them all together.

To inspect the last phase durations after an actual Save, use DevTools Network's Save request and its `Server-Timing` header, alongside:

```js
console.table(performance.getEntriesByType('measure')
  .filter(entry => entry.name.startsWith('pharmacy.'))
  .map(entry => ({ phase: entry.name, milliseconds: entry.duration })));
```

The repeated disposable replica-set API benchmark still uses only three samples per size:

| Bill lines | First operation | Later operations | Sample median |
| --- | ---: | --- | ---: |
| 1 | 205 ms | 150 / 111 ms | 150 ms |
| 10 | 401 ms | 257 / 231 ms | 257 ms |
| 20 | 431 ms | 433 / 409 ms | 431 ms |

These include 50 historical lots per product but exclude real network latency, actual browser storage and physical printing. The first operation is not a fresh process/OS cold start. Three samples do not establish a reliable p95 or improvement over a previous run on a different machine load.

## Returning a billing-only branch to tracking

Open **Locations → branch actions → Pharmacy settings**. An authorized manager enters a review reference and chooses **Pause branch & count stock**. Pausing uses the existing settings endpoint and revision check. A paused branch's new sales/stock writes fail their existing branch pin; historical corrections remain authorized separately.

1. Load the complete owned product/batch snapshot while the branch is paused in billing-only mode.
2. Enter actual base-unit quantities for every existing batch, including zero, or download and complete the count CSV. CSV labels are readable and formula-neutralized; product/batch IDs determine ownership. Imported counts cannot invent rows, omit lots, repeat lots or contain formulas as quantities.
3. Add actual batches that are physically present but not recorded. Reuse unit conversion, printed expiry, acquisition cost, selling price and MRP receipt validation. This records physical inventory, not a supplier invoice. Expired counted lots remain expired; existing quarantine cannot be increased or released through this flow.
4. Preview the before/count totals and changed-product count. Preview writes nothing. Any edit invalidates the confirmation.
5. Explicitly confirm. One recorded transaction appends physical-audit movements, updates owned lot/product balances and revisions, preserves source history, records the required audit, and enables tracking. A failed audit or branch race rolls everything back.

No batches or quantities are inferred from old billing-only sales. Previously issued invoices and dispense sources are unchanged. A billing-only return remains a financial credit without stock addition even after the branch returns to tracking; subsequent tracked sales deduct the counted stock.

The snapshot hash covers current owned branch/product/lot evidence, including revisions, quantities and metadata. Catalogue/lot/settings changes invalidate a prepared count. The final branch CAS also prevents a concurrently resumed branch from accepting stale counts. Same-key retry is idempotent; saved-result recovery checks current branch authority and original operator. An ambiguous response keeps the frozen encrypted count and reference. Only an explicit stale-snapshot rollback offers discarding that rejected intent and recounting. Recovery remains accessible from settings after the committed branch is already tracked.

Closing a count leaves the branch paused. Before confirmation, typed counts are not an issued document or an automatically persisted count draft; save the completed count sheet if stopping. This version reviews at most 20,000 products / 50,000 lots, with 8 MB request/import bounds and 20 products per UI page. Invalid/orphan lot evidence or pre-existing aggregate/lot inconsistency fails for inventory review rather than silently rewriting provenance.

## Verification and limits

Risk level 4. Backend integration coverage includes paused-mode/permission/tenant boundaries, complete and malformed counts, no-write preview, actual new/expired lots, stale snapshots, required-audit rollback, concurrent same-key commits, actor-bound recovery, a concurrent settings write, and billing-only → counted tracking → tracked sale → original billing-only return continuity. Existing billing-only and atomic checkout cases passed. The Save fixture rechecked competing tills and conservation.

Frontend coverage includes explicit counts, preview invalidation, confirmation locks, exact retry, reload recovery, stale-count reset, CSV validation/formula protection, pausing through existing settings and recovery after tracking has resumed. Counter, draft, journal, branch catalogue, authority, offline assets and service-worker privacy regressions passed. One default one-second counter lookup timed out during concurrent build load; its unchanged full 60-case suite passed on rerun.

The isolated Next production build/TypeScript and backend TypeScript/API/four-worker compilation passed. Changed-file lint has no errors; the existing settings effect warning remains. The final small footer refinement and defensive timing-clear change use scoped tests/lint rather than another unrelated full build.

All 13 built-app Chrome scenarios passed, using intercepted synthetic APIs: the 11 existing checkout cases plus desktop physical count and mobile lost-response recovery. Both count flows submitted one commit only. The real storage/print probe passed 12 checks, including parallel record scheduling, same-record conflict, in-flight logout invalidation, encrypted reload, 10,000-product persistence, injected quota failure and A4/80/58 mm handoffs. Native print dialogs, paper printers, actual mobile storage eviction and configured-store latency are still unverified.

Evidence is ignored under `.next/pharmacy-storage-{before,after}.log`, `.next/pharmacy-browser-acceptance/`, `.next/pharmacy-checkout-acceptance/`, `.next/pharmacy-count-*`, and backend `.cache/pharmacy-count-*` / `.cache/pharmacy-save-benchmark/`. Generated preparation assets use service-worker cache v21; they still do not issue final offline invoices.
