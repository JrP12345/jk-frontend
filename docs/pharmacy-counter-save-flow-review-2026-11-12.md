# Counter Save flow review — 12 November 2026

This review replaces the earlier counter notes describing separate invoice and first-payment commands during ordinary Save. Existing collections for saved bills, installments and recovery remain available.

## Issues found and resolved

| Issue | Change |
| --- | --- |
| Save awaited a quote, an invoice command, then a separate collection command | A confirmed first payment now travels with the existing issue request. Stock, invoice, payment ledger, receipt, required audits and saved result commit together in one database transaction. |
| A new collection command repeated authorization, branch lookup, invoice reads, command reservation and commit work | Issuance calls the shared collection ledger writer using the invoice it just created and the same transaction. Existing standalone collection commands use that same writer. |
| Save repeated a quote even when the current cart already had one | An unchanged quote supplies its conditional assertions directly to issue. The issue transaction still recalculates against current issuer, customer, units, stock, lots, prices and tax. Ordinary local edits invalidate the quote. |
| The right panel became “Bill saved / Saving payment” before payment completed | Normal checkout keeps its customer/payment/totals/actions mounted. It resets only after the committed paid result and receipt are verified. |
| A collection component mounted and restored another device journal halfway through Save | Normal Save uses one frozen sale/payment command and its existing encrypted journal. No collection component mounts in the successful path. |
| The summary refreshed after issue while payment was still running | Automatic refresh follows the confirmed result. It is outside the Save dependency path. |
| The status could say Synced while a save was still pending | The bill strip says Saving. The fixed checkout footer reports validation or saving, with a short message for a slow response. Success is not announced before confirmation. |
| Saving cleared the product list | The bounded working set stays visible. Confirmed quantities reduce its local stock snapshot and invalidate query freshness. Server stock remains authoritative. |
| A completed sale required navigating out of a settlement panel | The next bill becomes ready automatically, scanner focus returns, and a compact last-bill action opens the saved document. |
| Empty next bills showed unknown change | Empty bills display zero payable and change; Save remains disabled until valid items/payment are present. |
| Save & print could depend on a separate payment stage | Printing starts only after the committed bill/payment result. Print retry remains a document-only operation. |
| Pending payments from another saved bill were discovered after creating a new invoice | Save checks the existing pending collection reference first. The earlier payment can be resolved without issuing the current cart or marking it paid. |
| A drawer could close after its advisory check | The transaction rejects the paid sale and rolls back all new sale changes. The counter rechecks the drawer and requires review before another paid attempt. |
| Save failures stacked an error and a pending-command banner | The error, original reference and recovery/review actions share one alert. A known rejected attempt does not offer a redundant identical retry. |
| Disabled controls made scrollable product/filter areas inaccessible to keyboard users | Scroll regions retain keyboard focus while edits are disabled. The bill list has its own focusable scroll region. |
| Loading/recent rows and status text could change available space | Recent bills reserve their populated height. Save progress shares the existing footer area; desktop panel geometry stays fixed. |

## Transaction and recovery contract

`POST /api/pharmacy/sales` accepts an optional normalized `payment` alongside the existing quote assertions. It requires both existing sell and collect authority when a payment is included. The payment must explicitly confirm the full new bill amount, use revision zero and the same branch, and provide sufficient actual cash or verified digital references. The server derives change and validates all current sale evidence. A closed drawer, stale quote, failed audit or failed payment rolls back the new invoice, supply, receipt and stock changes together.

The same operation key binds the bill and payment inputs. Its encrypted durable result includes the receipt. Lost responses use the existing read-only sale-operation lookup; explicit retries use the exact frozen payload/key. Recovery never invents a new payment authorization. Credit and bill-only saves omit payment. Zero-value bills do not create receipts. Existing split/partial payment behavior for already saved bills retains its own collection command and authority.

With a local display estimate, normal Save now requires one fresh quote request and one atomic write instead of three sequential requests. With an unchanged current quote, only the conditional write is needed. This removes a browser round trip, an independent payment commit and repeated database preparation; it does not assume a fixed network/database response time. The UI responds immediately to the click, while confirmed completion still comes from the committed server result.

## Verification

- Risk level 4: billing, inventory, payments and shared collection logic.
- 113 focused frontend cases passed across counter, collections, payment validation, overview, document recovery, catalogue, command journal, save status and generated offline assets. Targeted reruns covered the changed rejection/recovery and keyboard paths.
- 52 backend integration cases passed across counter, collections and atomic checkout, including cash/UPI/card, same-key concurrency, replay, changed input, grants/branch ownership, stale evidence, audit rollback and drawer closure after quote.
- Frontend source TypeScript, backend `check:fast`, changed-file ESLint, payment boundary and the backend's five executable bundles passed. Generated offline catalogue assets were refreshed and verified.
- Focused Chromium checks at 1920 × 1080, 1366 × 768 and 390 × 844 exercised an intentionally held save response. Checkout controls remained mounted, summary reads did not compete with the commit, desktop panel positions/sizes stayed identical before/during/after Save, and mobile Save stayed above navigation. Ordinary desktop cash controls fit without scrolling. Checked views had no horizontal overflow, page errors, nested forms or automated accessibility violations.
- Browser fixtures verified local quantity changes, cash/change arithmetic, one quote plus one atomic write, no separate collection write/dialog, next-bill reset and retained products. Screenshots/results are in the ignored `.next/pharmacy-atomic-review/` directory. Financial browser responses were synthetic and intercepted; actual database semantics were tested separately through the integration suite. Live payment providers and physical printers were not exercised.

Restart the running backend to load the optional-payment contract before using the updated frontend. Full release suites and the frontend production build were not part of this scoped check.
