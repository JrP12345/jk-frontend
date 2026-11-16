# Pharmacy counter reference refinement — 12 November 2026

The existing `/dashboard/pharmacy` counter now follows the latest supplied reference while retaining the application sidebar, header, shared light/dark theme, components and billing utilities.

| Reference area | Implemented behavior |
| --- | --- |
| Compact overview | Five stable tiles for today's branch sales, bills today, the operator's drawer cash, active/held device drafts and stock alerts. Loading uses matching geometry. A failed refresh retains the last snapshot with a retry state. |
| Three-column workspace | Bounded product and checkout columns leave the remaining width to the bill. Product filters stay on one horizontally scrolling line. |
| Aligned bill | Wide views show row number, product, quantity, rate, GST, amount and actions. Narrow bills use compact rows. The shared quantity control and existing item editor remain available. |
| Bill footer | Product count, unit count, GST, discount and payable are grouped in a summary strip. The three newest bills issued today appear below it and open the existing saved-bill viewer. |
| Cash collection | Received and Change are adjacent, with shortcuts calculated from the current payable amount. Insufficient cash shows Still to receive. Entered cash survives a changed-price review. |
| Primary actions | Save and Save & print remain together. Hold moves to the bill strip and Refresh prices to the bill header. Ordinary checkout does not open another collection dialog. |
| Mobile payment | Compact tax totals leave cash amounts visible. Save remains above both existing mobile navigation bars. Larger customer searches, drawer setup and recovery messages can scroll within the payment area. |

## Summary data contract

`GET /api/pharmacy/sales/overview` is a read-only, uncached branch endpoint protected by the existing `viewSales` permission. It aggregates all original pharmacy invoices issued within the branch's current local day, excluding cancelled bills and opening balances. Today's sales are captured bill values, not collections or net sales after returns. Recent bills are only the latest three; they are not used to calculate daily totals. No customer details or acquisition costs are returned.

Drawer cash uses the existing operator drawer ledger, including its opening float and recorded movements. Drawer and stock values require their existing permissions; unavailable access is not displayed as zero. Stock alerts count products at or below their physical reorder level and positive on-hand lots expiring within 90 days or already expired. Physical stock counts do not promise saleable stock. The active/held tile reports the actual one active draft and held drafts on this device.

The overview is advisory and does not block checkout. Financial summaries are not persisted in IndexedDB. Existing encrypted draft/catalogue storage, local quantity arithmetic and command recovery remain in use. Save still obtains fresh server evidence and uses the existing authoritative inventory, invoice and payment commands. Reading a summary cannot reserve stock, issue a bill or collect money.

## Verification

- Level 4: the new financial read contract was checked alongside existing counter and payment flows.
- Frontend: 85 focused cases across counter, overview, collections and payment validation passed, including reruns of the affected assertions. Source TypeScript, changed-file ESLint and the payment-boundary check passed.
- Backend: 22 focused overview/counter integration cases and `check:fast` passed. Coverage includes tenant/branch boundaries, permission restrictions, timezone day boundaries, aggregation beyond the recent subset, opening-balance exclusion, drawer evidence and disjoint expiry counts.
- Focused browser checks used 1920 × 1080 and 1366 × 768 desktop views and a 390 × 844 mobile view in light/dark themes. Desktop panels fit without outer counter scrolling; ordinary cash controls remain visible. Mobile Save stays above both navigation bars. Checked views reported no horizontal overflow, nested forms, page errors or automated accessibility violations.
- Browser checkout verified local quantity changes without quote calls, correct cash/change, one fresh quote followed by one issue and collection, and no second checkout dialog. All financial browser responses were intercepted synthetic fixtures; no live payments or physical printers were exercised.

Ignored browser artifacts: `.next/pharmacy-summary-review/` contains the desktop screenshots and checks. Its initial mobile overlap was corrected and verified separately in `.next/pharmacy-summary-mobile-review/`, which contains the final mobile screenshots and passing results. Full release suites and production builds were not run for this scoped refinement.
