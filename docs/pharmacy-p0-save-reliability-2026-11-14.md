# Pharmacy P0: Save performance and recovery — 14 November 2026

Implemented the first increment from [the audit](pharmacy-priority-audit-2026-11-14.md). Existing billing, inventory, payment, prescription and component architecture remains in use. P1 search/inward improvements and P2 final offline billing are separate work.

## Changes

- Pricing and dispensing now reuse the same freshly validated stock read **inside the current transaction**. The allocator still performs stock changes, movement recording, required audit hooks and restricted-supply checks. Clinical/aggregate callers retain their existing allocator path.
- Prepared stock is an opaque, single-use server object tied to medicine, branch, quantity, session and transaction identity. It is neither serialized to the client nor cached between requests. A consumed, forged, mismatched or previous-transaction object is rejected. The allocator rechecks expiry eligibility; changed allocations roll back the bill.
- Every historical lot still undergoes ownership, unit, quantity, cost, expiry and price validation, and lot totals must still reconcile. Only pure printed-expiry calendar arithmetic is memoized, with a bounded map local to the preparation request. No stock, price, tax classification or professional authority is memoized across requests.
- Save responses expose privacy-safe `Server-Timing` phases for authority, readiness, preparation, stock, documents, payment, command and finalization. Existing `counter_save` remains the overall service duration. Phase names and durations contain no identifiers or payloads. `command` includes inner phases; do not sum it with them. `finalize` includes the required receipt result write and transaction commit.
- Browser DevTools measures the latest `pharmacy.draft_write`, `pharmacy.intent_write`, `pharmacy.save_request` and `pharmacy.print_handoff`. Entries are bounded to the latest measurement per phase and are not uploaded. Printing handoff includes asset preparation **and time in the native print dialog**; it is not API Save time or proof that paper was printed. Diagnostics failures do not change the command/printing result.
- Bill status now says **Prices checked**, **Draft**, **Offline draft**, **Saving**, **Needs review** or **Check save result**, as appropriate. A quote no longer says “Synced”; an uncertain sale no longer implies automatic synchronization. Normal confirmed paid/on-account saves still prepare the next bill and retain compact access to the saved bill. Slow Save keeps the existing checkout controls/rows in place.

## Measured result

Disposable local MongoDB replica set; one active lot and **50 depleted historical lots per product**; paid cash Save with printable document; three independent commands per case. These are synthetic API-injection samples, not browser/network/production measurements. The displayed median and maximum are descriptive; three samples do not establish a dependable p95 SLA.

| Bill size | Baseline median / maximum | Final isolated median / maximum | Warm database operations, before → after | Lot reads, before → after |
| --- | --- | --- | --- | --- |
| 1 product | 163 / 279 ms | 132 / 245 ms | 54 → 50 | 3 → 1 |
| 10 products | 808 / 887 ms | 326 / 424 ms | 171 → 131 | 30 → 10 |
| 20 products | 1,332 / 1,503 ms | 610 / 682 ms | 301 → 221 | 60 → 20 |

The final 20-product median is about **54% lower** than the baseline. Intermediate runs varied with concurrent verification load; the final benchmark ran without other agent-started checks. The deterministic regression asserts one lot-read query per product and one bulk medicine read plus the existing restricted-supply medicine read per product, rather than asserting an environment-dependent latency threshold.

The first sample also includes three extra database operations associated with initial numbering/setup state. The warm operation column uses the second sample. The index-readiness check measured roughly 2 ms in the final fixture, so it was retained rather than weakening readiness or introducing another cache without evidence of benefit. No schema/index creation or selected-database modification was performed.

Run `npm test -- tests/pharmacySavePerformance.test.ts` in the backend to regenerate `.cache/pharmacy-save-benchmark/{1,10,20}.json`. It uses disposable fixture data; this is not a command to benchmark against real tenant records. Baseline values above were captured before the implementation. Generated benchmark paths are overwritten on a rerun.

## Verification and limits

- Initial direct-consumer run: 115 backend cases passed across counter, atomic checkout, inventory, prescription authority, outside prescriptions and the benchmark. After the expiry optimization, returns and checkout/prescription cases also passed. A new previous-transaction test initially failed: the driver's server transaction number advances lazily. The corrected guard compares the driver's fresh transaction object identity and fails closed if that identity is unavailable.
- Latest safety run: **62 cases passed** across counter-stock preparation, atomic checkout, outside prescriptions and captured lots. Coverage includes single-use/forged/wrong-branch/wrong-product/wrong-quantity evidence, reuse across transactions on the same session, expiry between preparation/allocation, invalid snapshots despite memoization, concurrent stock, rollback, payment grants, credit and same-key recovery. Latest isolated benchmark: **3 cases passed**.
- Frontend checkout/journal/document-recovery/status/performance run: **74 cases passed**. Subsequent targeted slow-Save/lost-response/closed-drawer checks passed; final document-recovery/performance checks passed **17 cases**, including the added unavailable-clock case. Existing print-only retries and single-command Save behavior remain covered.
- Both package TypeScript checks and changed-file frontend ESLint passed. Frontend TypeScript excludes test files, per repository policy. API and all four worker entrypoints bundled successfully with the backend build options into isolated `.cache/pharmacy-p0-build/` output; existing running services and `dist` files were untouched.
- No physical printer, real payment-provider settlement, live database profiling or full CI/release run was performed. Frontend presentation changes are status text/accessibility labels; responsive geometry was preserved and checked through the existing slow-Save DOM regression, without claiming a fresh browser screenshot review.

Save still waits for durable intent persistence and the authoritative database commit. Uncertain outcomes retain the original key; a printing retry never issues another financial command. Fresh price/stock/professional conflicts remain explicit rather than silently accepting stale cart data.
