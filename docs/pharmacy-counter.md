# Keyboard pharmacy counter

T15 adds ordinary counter checkout to the existing pharmacy workspace. It uses the existing issued-invoice and collection contracts. It creates no clinical identities and introduces no browser financial calculator.

Sales-only staff can open **Counter sale** without stock, prescription, purchasing or clinical billing grants. Current organization, branch, pharmacy module and `PHARMACY_SELL` authority govern lookup, quote and issue. Collection still requires its separate grant. `counterSalesAvailable` follows the current `sell` action; this flag is technical availability, not professional/release approval.

| Route | Behavior |
| --- | --- |
| `GET /api/pharmacy/sales/products?locationId=…&search=…&cursor=…` | Name/generic prefix, 25 projected products per page, no acquisition fields. |
| Same route with `barcode=…` | Exact catalogue barcode equality; leading zeroes retained. Never interprets a product name as a barcode or a barcode as lot identity. |
| `GET /api/pharmacy/sales/customers?locationId=…&search=…&cursor=…` | Active branch-visible customer parties, 25 per page, minimal name/address/contact/revision projection. Supplier-only, archived and business GST identities are excluded. |
| `POST /api/pharmacy/sales/quote` | Read-only snapshot of current eligible FEFO lots, units, reviewed issuer/tax, exact calculation and issue assertions. No stock reservation, invoice/number, command receipt, profile mutation or collection. |
| `POST /api/pharmacy/sales` | Existing atomic issue with frozen quote assertions, stable key and a hash of material quote evidence. |

Quote accepts location, optional recorded customer ID, whole base quantities with the displayed unit version, stable distinct line/product IDs and integer line/invoice discounts. The server obtains customer/profile/stock revisions and actual prices, tax, MRP and allocation facts. Old displayed units reject quantity conversion. An edited cart invalidates its quote; resume requires a new quote. Issue prepares the same financial facts again inside its stock transaction, checks the quote fingerprint and verifies actual FEFO allocations match. A changed quote, stock, customer or issuer conflicts and commits no sale. Quotes reserve nothing and may become stale immediately.

Scanner Enter adds one base unit through exact barcode lookup; focus moves to loose quantity, whose Enter returns to the scanner. Packs and loose units use the explicit displayed conversion with safe integer checks. Operators review actual lot quantities, printed expiry, unit prices/MRP, taxes and total before explicit issue. Up to three carts can be held in memory in the current tab; holds create no stock or invoice effect. Leaving the tab, changing account/branch or reloading clears cart/customer contents. No cart or customer details are written to browser storage.

Before issue, the UI saves only an opaque key scoped to account/organization/impersonation/branch in session storage. Storage failure blocks dispatch. An uncertain response freezes the submitted payload and retries the same key; reload offers original-result recovery. If no committed result is visible, re-enter original intent under the retained key and check again. A changed committed command conflicts rather than creating a second bill. Only acknowledgment of a committed outcome clears that sale reference; a separate purchase receives a fresh identity. Late reads/mutations from a prior cart or branch cannot replace the current result.

After issue, the saved invoice opens the existing T17 collection form. Issue and collection have separate identities, so collection failure never reissues stock. Identified customers may leave an explicit balance; anonymous customers must settle the full remaining balance. A fully discounted zero-total bill is settled without inventing a zero-value money receipt. Printing/recovery tools are T18. Restricted or unreviewed products remain in their authorized prescription/inventory workflow; the counter does not manufacture approval evidence.

Verification covers synthetic API and DOM keyboard workflows, scope, bounded lookup, exact barcodes, snapshot/issue parity, stale evidence, distinct purchases, unknown response/reload, storage failure and payment failure. Physical scanners, actual printer layouts and representative-store load remain device/release checks.
