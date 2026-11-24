# Pharmacy daily overview

Implemented 22 November 2026 as a software increment toward P3 and the D5 end-of-day demonstration in the [implementation and acceptance plan](pharmacy-final-implementation-plan-2026-11-22.md). Actual owner usability, store hardware and closing acceptance remain open.

## Owner workflow

Open the pharmacy workspace and choose **Daily overview**. The view requires report permission; each underlying source still requires its own grant. The counter does not load this overview in the background.

Six primary cards show issued sales, cash collected, UPI collected, customer credit created at issue, gross contribution and low physical stock. **Dues, card payments, returns and expiry** expands the remaining figures and a bounded low-stock shortlist. A phone uses two columns for the primary figures. Drawer and stock actions use their existing workflows.

Choose a business day and explicitly load it, or use Today/Refresh. Editing the date does not issue a request. **Details and source** explains the figure and opens the permitted report with the relevant day preselected. Source reports still require explicit loading and retain their own permissions/export review.

## Meaning of the figures

| Figure | Source and boundary |
| --- | --- |
| Sales issued | Original pharmacy supply documents issued on the selected branch-local day, including GST. Opening debt is excluded. Return credits and collections are separate. |
| Cash, UPI and card collected | Confirmed receipt components by collection time, including payments of earlier debt. Cash excludes change. Manual digital confirmation and verified provider capture retain their existing distinctions; neither asserts a bank deposit. |
| Customer credit created | Original uncollected amount captured on named-customer bills when issued, after any payment in the same issue transaction. Later payments or returns do not rewrite it. This differs from current outstanding dues. |
| Gross contribution | Original acquisition cost and base revenue of invoices issued that day, with their linked credits through the snapshot. Returned quarantine retains its original cost. Missing costs stay unknown. Excludes operating expenses; this is not net profit or a period accounting P&L. |
| Return credits issued | Commercial credits issued on the selected day, including returns of earlier bills. Credits are not cash refunds. |
| Other cash in/out and refunds | Existing pharmacy cash-event evidence, separate from incoming customer receipts. Cash out includes cash refunds, supplier payments and other cash out. Refund totals across methods are separately labelled. Opening float and actual drawer counts remain in the drawer workflow. |
| Customer and supplier dues now | Current balances across all source dates, including opening balances. Expected supplier-return claims remain pending until credit is confirmed. These do not reconstruct historical closing balances. |
| Low physical stock | Current products whose physical stock is at/below their reorder threshold. This does not count all products with low saleable availability: expiry, holds and quarantine can reduce availability further. The Stock & expiry workflow remains the saleable-stock review. |
| Expiry | Positive on-hand lots expiring within 60 elapsed days and already-expired lots shown separately. These are lot counts, not a sum of unlike product units. |

## API and consistency

`GET /api/pharmacy/daily-overview?locationId=<branch>&date=YYYY-MM-DD` is read-only and `no-store`. The optional date defaults to the current branch-local day. Invalid/future dates and unsupported query fields are rejected. The endpoint requires the configured India/INR source currency.

The composition reuses existing complete financial reports inside one inherited MongoDB snapshot and pins one report clock. Existing report source grants remain independent: report permission alone does not expose cost, sales, return, purchase or settlement values. Source-bound financial calculations and ledgers are unchanged; no overview ledger or outbox is created.

Each section is ready, restricted, unavailable or not tracked. Denied and unavailable values are null, not zero. A complete-source report exceeding its existing 2,000-source/result-row foreground bound becomes unavailable; no first page is presented as a total. Composite financial report work also has an 8,000-source and 15-second check budget. Stock and exception metadata use separately bounded queries; this is not a strict 15-second response guarantee. Larger source reviews use existing Reports & exports rather than silently relaxing the interactive limit.

The response includes only summary amounts/counts, explanatory scope and up to five product labels/quantities. It excludes customer names, contact details, payment references, operator/device/authority IDs and merchant credentials. Inconsistent monetary sums, wrong branch/day/currency/timezone, missing sections and malformed ready values are rejected by the client.

An open activated local session displays that cloud figures may omit unsynchronized bills. Expired local authority remains a reconciliation warning and never releases ownership. Unposted captured/unknown/review payment intents are counted as exceptions, not added to confirmed collections. An unavailable refresh can retain a visibly stale snapshot; authentication/permission/branch rejection clears it. Branch/identity changes discard late reads and clear prior scope.

## Original credit capture

New retail/outside-prescription invoices capture `Invoice.creditAtIssuePaise` from the calculated payable minus payment explicitly recorded in the issue transaction. The value is protected with other immutable issued fields, validated as bounded nonnegative integer paise, and cannot change during later collection or return. Cash-only offline import captures zero. Records without the original capture stay unknown; no historical amount is inferred or backfilled.

This additional source fact does not change stock, invoice totals, payment allocation, customer credit policy, receipt identity or the original retry contract.

## Verification

Risk level 4: shared invoice evidence, sale/import consumers, financial projections and report-source authorization.

- 117 distinct backend cases passed across the focused run and affected reruns: overview, original invoices, checkout, collections, offline import, reports/profitability and external prescriptions. New cases include earlier-debt collection, part payment, later settlement, immutable original credit, unknown source facts, local midnight, current versus historical scope, returns, source-budget failure, tenant/permission denial and billing-only mode. Invalid fixture component IDs and inconsistent synthetic issue/document dates were corrected; production validation was retained.
- A real concurrent sale commits outside the overview transaction during assembly; the stock and sales projections retain the same original snapshot. The overview read does not create invoices, payments or audit mutations.
- 99 distinct frontend cases passed across the focused run and affected reruns. They cover financial distinctions, explicit date application, source-report/day selection, malformed totals and day/window assertions, unknown/denied sections, stale/forbidden refresh and late branch/identity reads. Workspace coverage verifies the permission-gated entry and source handoff without financial writes. Rerun counts are not added again.
- Both package type checks, API/four-worker bundles, payment boundary and diff checks pass. Changed-file frontend lint has no errors; one existing workspace effect warning remains.
- 16 Chrome checks passed for ready, offline-warning, unknown and restricted states at 360/390/768/1440 pixels, with no horizontal overflow, browser exceptions, external provider calls or business database writes. Mobile layout was inspected and simplified to show the six primary figures first.

Probe: `node scripts/performance/check-pharmacy-daily-overview.mjs`. Ignored evidence is under frontend `.next/pharmacy-daily-overview-*` and backend `build/pharmacy-daily-overview-*`. Synthetic browser responses and isolated MongoDB integration tests are separate evidence. Full exact-revision CI, configured providers, actual phone/old-PC timing and the real pharmacy D5 closing demonstration remain release/pilot work.

## Work still open

The broader P3 register/attachment/slow-moving work, actual net-profit expense accounting if offered, multi-counter LAN coordination, supplier-rate comparison and the other implementation-plan gates remain open. This overview does not turn physical reorder counts into a full saleable-stock summary or claim that a local ledger has synchronized when the server cannot know that.
