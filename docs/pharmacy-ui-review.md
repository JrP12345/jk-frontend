# Pharmacy workspace UI review

The later [local-first POS implementation review](pharmacy-local-first-pos-review.md) supersedes the counter persistence, recovery and completion behavior described in earlier entries below.

Counter billing follow-up, 11 November 2026: name search now offers matches while typing; the primary quantity editor supports direct entry, minus/plus and pack increments. Current line prices are refreshed by the server. Current and held carts use encrypted, scoped IndexedDB drafts, with fresh pricing after restore and a visible memory fallback. Full cash collection uses one cash-received input; UPI/card require verified references, split payments offer remaining-allocation shortcuts, and recorded customers can explicitly select partial payment. Receipt confirmation resets after edits. Committed receipts show received, remaining and change separately. Sale and collection recovery references remain independent; no payment or stock mutation is replayed from browser storage. See [the current draft contract](pharmacy-dispensing.md#keyboard-counter-and-held-carts).

Reviewed `/dashboard/pharmacy` on 11 November 2026. Scope: presentation and local search feedback. Existing tabs, transaction handlers, permission checks, request payloads, saved-operation references and backend services are retained. No database or client-record changes were made for this UI review.

## Issues found and refinements

| Issue | Refinement |
| --- | --- |
| Payment total, amount paid and balance were joined in one sentence. | Separate Total, Paid and Remaining values in a compact summary. |
| The payment submit button was below the dialog's scrolling content. | Keep Record payment in the dialog footer, connected to the existing form. Drawer readiness, busy state and submit validation still apply. |
| “Counter invoice collections” and “payment component” were difficult to understand. | Use Collect payment, Payment details, Payment 1 and Remove. Opening balances retain a distinct Collect opening balance title. |
| A large informational drawer alert looked like an action required to finish the sale. | Use a compact neutral status card naming the drawer and cashier. Keep warnings for a missing drawer and errors for failed checks. |
| Drawer readiness briefly appeared missing before the first read completed. | Show Checking payment drawer until the actual read finishes. |
| Cash tendered and split payment had little explanation. | Explain cash handed over before change, zero cash for non-cash payments and when to add another payment method. |
| An empty saved-receipts heading added noise to unpaid invoices. | Show the receipts section when saved receipts or a history error exist. |
| Sales records repeated the invoice number in oversized full-width actions. | Use compact Open sale actions, readable amount emphasis and separate payment-status badges. Keep the invoice number in the accessible action name. |
| No product/customer matches produced little visible feedback. | Show explicit empty-search messages after completed lookups; no initial “no matches” claim. |
| Strength appeared twice when already included in a product name. | Append strength only when it is not already present in the name. |
| Tab content headings and list spacing differed across tools. | Apply consistent heading weight, description width and spacing through the existing pharmacy stylesheet. |
| Purchase toolbar actions were constrained to a narrow fixed width. | Let action groups wrap and use available width. |
| Search forms and record actions became cramped on narrow phones. | Align search buttons with fields; stack narrow search/filter layouts and record actions. |
| Pending-sale controls ran together and references were difficult to scan. | Separate recovery actions and wrap the reference beneath a clearer explanation. Preserve the original reference and explicit recovery/retry actions. |
| Cash-drawer opening inputs spanned the entire desktop workspace. | Use the shared Card and a bounded two-column form with field hints. |
| Drawer balances and technical metadata competed for attention. | Emphasize opening and expected cash, add an Open/Closed badge and move revision/evidence into expandable record details. |
| The drawer reconciliation table could overflow a phone and lacked keyboard access to its scrolling area. | Contain horizontal scrolling in a labelled, focusable region and add table header scopes. |
| Report tables lacked clear surface and header treatment. | Reuse the existing report-table styles for borders, captions and header backgrounds. Report limits, page-only totals and export semantics remain visible. |

## Verification scope

Results: 173 focused test cases passed across 13 files (including affected reruns), the package TypeScript check passed, and all 38 synthetic browser cases passed. Changed-file lint reported no errors and four existing effect/set-state warnings. No production build or live payment was performed.

Focused frontend coverage includes counter, collection, drawer, inventory, purchasing, finance, document recovery, stock receipts, imports, alerts, reports, returns and transfers. It covers clinical billing's shared drawer currency behavior as well as pharmacy flows. Changed payment action names are reflected in existing behavior tests. A local search regression verifies empty results do not trigger writes.

Browser review uses synthetic fixtures with all API traffic intercepted. It covers every available pharmacy tab at desktop and mobile widths, and the payment dialog at 1440px, 390px, 320px and dark 390px. It checks single/split payment presentation, horizontal overflow, nested forms, browser errors and accessibility. This is UI verification, not a live payment or deployment check.

## Source map

- `src/components/pharmacy/PharmacyCollections.tsx`: sale list and payment dialog.
- `src/components/pharmacy/PharmacyDrawerGate.tsx`: drawer status and readiness presentation.
- `src/components/pharmacy/PharmacyTill.tsx`: opening form and reconciliation summary.
- `src/components/pharmacy/PharmacyCounter.tsx`: search feedback and pending-sale presentation.
- `src/components/pharmacy/PharmacyWorkspace.module.css`: existing workspace, list, search and table layouts.
