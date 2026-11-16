# Pharmacy counter refinement — 11 November 2026

The counter now follows the supplied reference within the existing pharmacy workspace. It uses the shared Card, Button, Input, Tabs, Select, Badge, Alert and ConfirmDialog components, existing currency/paise utilities, catalogue cache, encrypted drafts and collection form.

The [12 November screenshot comparison](pharmacy-counter-reference-review-2026-11-12.md) records the subsequent density, list pricing, bill tabs, modal details, mobile navigation and recorded-customer Credit corrections, including all differences retained for existing workflow contracts.

## Layout and interaction

- Desktop: product finder, compact cart and customer/payment summary in three columns. Quantity buttons, pack increments, unit rates, batch evidence and line amounts sit together.
- Mobile: Products / Cart / Pay controls select one panel without unmounting drafts or checkout state. The selected branch and workspace menu remain accessible.
- The standard dashboard sidebar and header are retained, including the usual mobile navigation. There is no additional desktop hamburger or separate full-screen shell. Standalone counters use smaller page gutters. Clinical accounts retain their existing pharmacy/dispensing navigation.
- At the standalone counter, branch selection, sales navigation, cash drawer and refresh share one compact toolbar. Inventory and other permitted tools remain in More. Sync status shares the bill row; repeated page headings and the permanent explanatory status row have been removed. Offline warnings still appear when needed.
- Drawer navigation has one desktop entry. A counter-only operator no longer gets a More menu containing only that same drawer; mobile retains its drawer entry in More.
- Product rows use a full-width name/strength, rate, stock snapshot and batch/expiry metadata. Cart rows separate rate and amount; narrow cart panels switch to a readable item layout instead of squeezing every column. Lookup mode gets enough space to show its full selected label.
- Refresh uses the same three-panel loading layout during session, location, capability and device checks. The counter waits for the draft, catalogue and sale journal together before showing its contents, preventing an empty-cart flash. Authentication and capability checks still gate all private data.
- Search feedback, cart batch metadata and checkout batch details have reserved space. Price checks update the existing slots instead of inserting sections that move item rows or totals. Long medicine names and strengths wrap; batch metadata stays compact, with full cart batch evidence available in details.
- Active and held device drafts retain the medicine strength as display metadata. Prices, receipts, payment inputs and customer details remain excluded from draft storage.
- Shared `QuantityInput` uses the existing Button and Input components in a joined pill with an editable circular value. It supports whole-unit buttons, arrow keys, direct typing, disabled states and safe integer bounds. Temporary blank/invalid input stays available for correction and cannot bypass the existing quote validation.
- On desktop at least 1360 × 650, the active standalone counter fills the actual dashboard content height, including its page-transition wrapper. Lists and customer details scroll only when needed; totals and the billing action stay fixed within their panel. Smaller screens retain natural scrolling and mobile panel navigation.
- Product results remain available after adding an item. Filters describe actual base units in the current results; they do not imply that the whole inventory has been downloaded. Rates and batches appear only when observed in a quote; cached prices are marked estimates.
- New bill holds the current draft. Selecting a held bill swaps drafts if the current bill has items, preserving both. The existing limit of three held drafts remains. These are draft labels, not official invoice numbers.
- F1 focuses search; arrows pick a result; Enter adds it. F2 holds and opens a new draft, F3 opens customer entry, F4 holds, F6 focuses discount, F10 issues through the existing validation, and Ctrl+Delete requests clear-cart confirmation. Shortcuts pause while a dialog/menu is open.

## Billing and payment boundaries

Cash/UPI/Card selection in the sidebar is a preference. The cash tender and change displayed there are previews. The preference seeds the existing collection form after the invoice is saved; its amount comes from the saved invoice. Drawer readiness, actual receipt confirmation, verified non-cash references, split/part settlement validation, frozen recovery requests and idempotency remain in that form and its existing services.

The preference is not stored as a receipt, is not sent as part of the invoice mutation and resets when a draft is held/switched or completed. After reload, collection defaults to the saved invoice's amount due. Split and part payments remain available in confirmation. Selecting Recorded requires a real customer selection before issuing. Unsupported doctor attribution, unrestricted prescription sales and a new credit policy were not introduced as cosmetic form fields.

Offline work remains draft preparation and cached estimates only. Final numbering, stock deduction, tax validation and money records require the server. Paid/part-paid completion, last receipt access, zero-value invoices and explicit same-request recovery keep the existing behavior.

## Verification

- Initial billing refinement: 166 focused tests across seven files, including draft swaps, filtering, keyboard selection, preference transfer, missing customer selection and shortcut isolation. The subsequent compact-header correction passed 103 focused counter, pharmacy-workspace and dashboard-navigation cases across three files, plus source TypeScript and changed-file lint (existing effect warnings remain).
- Quantity/row/scroll refinement: 96 focused cases across QuantityInput, pharmacy navigation, counter and workspace files, plus source TypeScript. Browser checks verify untruncated lookup labels, no redundant desktop drawer entry, viewport fit and the saved-invoice/confirmed-payment flow. This uses synthetic data, not a live account.
- Refresh refinement: 130 focused cases across eight files cover counter behavior, workspace/capability gates, dashboard access, quantity/navigation controls, draft restoration, authority isolation and strength persistence. Source TypeScript and the payment-boundary check pass; changed-file lint has no errors (the two existing dashboard effect warnings remain).
- Delayed-refresh browser checks cover 1440/1366 desktop and 390/320 mobile widths, cold and saved-cart refreshes, quantity edits, invoice issue, actual-receipt confirmation and the next cart. There are no overlapping pharmacy loading announcements or empty-cart flashes. A further 1440/390 check verifies long names and strength after encrypted IndexedDB restoration. Financial responses use synthetic fixtures; no real stock or money writes occur.
- Source TypeScript, changed-file ESLint and the payment-boundary check were run. Existing layout/collection effect warnings remain; no new lint errors were introduced.
- An isolated local browser harness uses synthetic accounts, inventory, invoices and mocked financial responses. Desktop light/dark and 390/320 px mobile checks cover search, adding, quantity edits, checkout, confirmed collection and the next empty cart; checks include overflow, nested forms and automated accessibility scans. No real account, stock or payment was changed.
- The complete release suite, physical scanners, printers and live payment-provider flows were not exercised by this UI refinement.

Local browser evidence: `.next/pharmacy-counter-redesign-review/`, `.next/pharmacy-counter-spacing-review/`, `.next/pharmacy-counter-controls-review/` and `.next/pharmacy-counter-small-review/` (ignored development artifacts). The controls review covers 1920/1440 desktop and 390/320 mobile widths. The small review covers 1366 × 768 with a longer synthetic product name. Checks include the visible desktop sidebar, hidden desktop hamburger, untruncated lookup labels, no outer desktop scroll, reachable inventory with draft restoration, and visible total/change/issue action.

Refresh evidence: `.next/pharmacy-counter-refresh-review/` and `.next/pharmacy-counter-strength-review/` (ignored development artifacts), including panel geometry samples, layout-shift observations, accessibility scans and screenshots.
