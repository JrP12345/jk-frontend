# Receipt-based till collections (T30)

T17 now writes pharmacy collections into the same `Invoice.payments` authority. Split components retain distinct method/operation identities under one immutable receipt group. Till totals include the net cash allocation, UPI and card separately; tender/change does not inflate collections. Group receipt IDs and actual actors are captured. Full shift/drawer association remains T21. See [the collection contract](pharmacy-collections.md).

Implemented locally on 20 October 2026; not deployed. Existing summary, close and history URLs remain. This corrects the daily collection basis; full drawers, opening float, payouts/refunds, unique shift close and payment/close coordination remain T21 and its money-event dependencies.

## Calculation

The summary and close route share `TillCollectionService`. Committed `Invoice.payments` entries provide the collection amount, method and `paidAt`. Partially paid invoices contribute actual installments. A bill created earlier can contribute today's receipt; a later edit or current invoice payment method cannot move an earlier receipt. Neither `updatedAt` nor invoice creation time is collection evidence.

The report uses the location timezone, then organization timezone, then the existing Asia/Kolkata fallback. Local calendar-day boundaries use the existing time utility, including 23/25-hour DST days. The response records the day interval, timezone, currency and `asOf` cutoff. A receipt posted after the cutoff appears in a later calculation; it does not make an earlier snapshot erroneous or become a future-date warning merely because it arrived during the read.

Amounts are validated and summed as integer minor units, with no guessed rounding of unsupported precision. Cash, UPI/QR, card/POS and other payments are separate. Online payment is **other**, not assumed UPI. The organization supplies the report currency. Explicit unlike invoice currencies are excluded and flagged; missing currency on legacy clinical bills follows the configured organization currency and must be reviewed during historical reconciliation if that currency has changed.

`invoiceCount` now means distinct bills contributing collections, including partially paid bills. `receiptCount` counts contributing receipt entries and supported legacy payment records. `legacyReceiptCount` identifies the compatibility subset. Zero-fee/courtesy waivers contribute no money or receipt count.

## Historical payment compatibility and reconciliation

A bill without any receipt entries can contribute one labelled compatibility payment only when its status is paid, its positive recorded `amountPaid` equals its recorded total, and its actual `paymentDate` and payment method are known. No amount is inferred from the invoice total alone. No synthetic receipt is persisted. If any receipt rows exist, invoice-level fields never fill missing rows, dates, methods or residual amounts.

Incomplete legacy evidence, missing/invalid receipt dates or amounts, duplicate explicit receipt identities, unknown payment methods, future-dated evidence, mismatched paid balances and unlike currencies produce reconciliation issues. Valid posted gross receipts may still appear beside an issue; uncertain amounts are excluded. Unknown-dated evidence is not assigned to the requested day and remains a review issue. Issues are deduplicated by bill/reason and the response lists at most 20 examples; the branch candidate query stops rather than silently truncating more than 10,000 records.

Current refunded/cancelled/deleted status does not erase an actual incoming receipt or invent a refund date. Those receipts remain gross collections with a reversal/reconciliation issue. This report does not subtract a presumed refund or cash payout. T20/T21 introduce the actual outflow semantics. Till close returns `409` while reconciliation is required, preventing an apparently balanced snapshot built from uncertain evidence. There is no automatic data repair or review override in T30.

Ordinary invoice reads remain organization- and location-scoped. An existence-only, explicitly location-scoped check also detects unassigned historical payment evidence at that authorized branch. It excludes that evidence from tenant totals and reports only a generic ownership issue, without exposing the bill's ID/number or assigning ownership. Explicitly foreign-owned invoices are not included. Real identity reconciliation is T25.

## Existing endpoints and saved reports

`GET /api/billing/till/summary?locationId=<id>&date=YYYY-MM-DD` returns the existing `systemTotals` and `latestShift` plus:

- `collectionBasis: receipt_v1`, `timezone`, `currency`, `asOf`, `periodStart`, `periodEnd`;
- `systemTotals.receiptCount` and `legacyReceiptCount`;
- `reconciliation.requiresReview`, `issueCount`, bounded `issues` and `truncated`.

The date defaults to the location's current business day. Invalid dates are rejected. All till endpoints use `Cache-Control: no-store`, billing management permission and current staff/branch authority. Consumers cannot use till reports even if they have been granted a billing permission. Foreign or ungranted locations retain the shared hidden-location denial behavior.

`POST /api/billing/till/close` retains `locationId`, numeric `actualCashCounted`, optional `varianceReason` and `handoverNotes`. The server recomputes today's totals. Counted cash must be finite, nonnegative, bounded and have at most two decimal places. A nonzero difference needs the operator's actual explanation. Submitted totals or dates do not control the report.

Saved daily `CashierShift` receipt reports include the receipt basis, currency/timezone, cutoff/day interval and receipt counts alongside their existing fields. Report creation and required audit share a replica-set transaction; audit failure leaves no report. T21 adds stable-key report saving and explicitly separates `kind: receipt_report` from owned `kind: drawer` sessions. A gross daily receipt report does not close a physical drawer. See [the implemented physical drawer lifecycle](pharmacy-cash-drawers.md) for opening float, actual payouts/refunds, concurrent closing and saved evidence.

`GET /api/billing/till/history` retains saved values, with a validated limit of 1–100. Historical snapshots without a basis marker are presented as `legacy_invoice_totals`; no stored date, total or cashier is rewritten or recomputed. The billing screen labels old reports and prints their saved values independently of the live summary. New reports use receipt terminology, captured currency and timezone. Reconciliation warnings disable close in the screen and are independently enforced by the server.

No migration, index maintenance, live report closure, bank/provider reconciliation, real cash count, printer validation or deployment ran as local verification. Reconciliation tooling, full release checks and operational approval remain required before production activation.
