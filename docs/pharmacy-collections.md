# Pharmacy collections and recovery

T17 is implemented locally. Cash, manually verified UPI/card and split collections settle existing pharmacy invoices through `Invoice.payments`. One append-only `InvoiceCollectionReceipt` groups the components, their actual operator/date and post-collection balances. It is a payment receipt, separate from the issued tax invoice. No appointment, patient or outbound clinical message is created to collect retail money.

## Authority and API

| Route | Contract |
| --- | --- |
| `POST /api/pharmacy/invoices/:id/collections` | Current staff/module/branch authority, `PHARMACY_COLLECT_PAYMENT` or organization-management grant, enabled pharmacy and a stable `Idempotency-Key`. Supports identified partials and complete settlement. |
| `POST /api/pharmacy/invoices/:id/pay` | Same validation, transaction, key protection and receipt as collections; requires the full remaining balance. |
| `GET /api/pharmacy/collection-operations/:key?locationId=…` | Current sales/history authority, branch and original operator; returns the immutable committed result. |
| `GET /api/pharmacy/invoices/:id/collections?locationId=…&cursor=…` | Scoped immutable receipt history, twenty groups per page, no automatic draining of pages. |

Responses are `no-store`. Consumer roles remain denied independently of permissions. Stock, clinical billing and selling grants alone do not collect money. `viewSales` lets authorized staff read prior receipts after pharmacy disable; `collect` blocks new commands while disabled and pins capability inside the transaction. Recovery reauthorizes current tenant/branch and the initiating actor before showing a saved result.

Strict input supplies location, expected payment revision/balance, `manualConfirmed: true`, cash tender in integer paise, and 1–10 components. Each component has a stable unique ID, positive integer paise and cash/UPI/card method. UPI/card require the actual received transfer/terminal reference. Client dates, actors, shifts, paid totals, provider status and unsupported methods are rejected. QR display, payment attempts or a transfer reference without explicit operator confirmation never mark a bill paid. This is manual staff evidence, not bank/provider verification.

## Money and integrity

`InvoicePaymentService` owns exact minor-unit balance checking and receipt mutation, reused by pharmacy collections and clinical full/partial payment. It rejects non-finite/fractional amounts, negative/corrupt balances, cancelled/refunded bills and overpayment by even one paise. Pharmacy commands additionally require the existing ledger to sum exactly to the recorded paid amount, unique operation identities and matching expected revision/balance. Histories are capped at 500 components per invoice with an explicit review response.

Components sum to the amount received. Cash tender must cover the cash allocation; the server computes change. Noncash-only collections require zero cash tender. Change is not another payment/refund event. Paid/balance/status use integer arithmetic, and each split component has a distinct ledger operation identity under its group, so the till can count methods without duplicate-receipt warnings. `Invoice.paymentMethod` is only a last-method projection; split groups use `other`, while canonical components retain their real methods.

An anonymous customer must settle the whole remaining balance in one command. An identified captured customer may make a partial payment; the rest remains an identified due. Credit itself is not a fake cash component or zero-value collection. T19/T20 now supply source credits, dues and confirmed refunds. Collection uses the exact net due after credit, while original incoming receipts remain unchanged and refunds use a separate outgoing ledger. Receipts capture credit applied at that collection. T20 customer opening dues use a clearly labelled version-3 balance statement in the same payment aggregate, without current supply/tax/stock facts; incoming collections still appear only in Invoice payments. A zero-value bill needs no money receipt.

The transaction writes invoice paid/balance/status/revision, ledger components, immutable receipt, required audit and encrypted command result with majority write concern. Stable receipt IDs and actual operator/date are captured. T21 will attach a real active drawer/shift under its own authority; this increment rejects invented shift IDs. A changed committed key conflicts. Same-key retry returns the original receipt, even after later collections, rather than rebuilding it from today's invoice state. Concurrent new keys cannot consume the same balance/revision. Audit failure rolls back the invoice and receipt together.

Collection has no stock effect. Neither a printer failure nor receipt re-read records more money. There is no automatic refund or supplier settlement. Provider-hosted payment workflows retain their separate verification protocol; this retail manual endpoint cannot impersonate a provider result.

## Clinical full-pay correction

The existing clinical `PUT /api/invoices/:id/pay` now requires a stable key and performs money, required audit and result capture in one transaction. It shares exact balance mutation with installments and cannot race another collection into overpayment. Its existing clinical/consumer ownership and supported-method checks remain. It also updates linked visit payment projections using the same helper as installments. The API client preserves the full-pay key across transport failure and token refresh; backend integration callers use explicit keys. Successful retry returns the captured result.

Clinical installment routes keep their current authority and response contracts while using the same exact-money primitive and retaining notes/references. Retail invoices remain excluded from those generic clinical routes. Patient checkout continues to use hosted/server-verified payment and never gets the pharmacy staff manual endpoint.

## Workspace and recovery

The existing pharmacy route adds Sales & collections for `viewSales` staff. Collection-only operators can enter without stock, EHR or purchase grants. Lists are bounded; the opened invoice shows current total/paid/balance, anonymous/identified customer status and saved receipts. Split lines require actual method evidence and an explicit confirmation checkbox.

Before sending, the UI stores only an opaque reference and invoice ID under account/organization/impersonation/branch scope in session storage. Permission changes clear private forms while retaining the opaque owner reference; every recovery reauthorizes current grants. Storage failure prevents dispatch. Submitted money stays frozen in memory for exact same-key retry. Reload offers result lookup and re-entry of original details under that same reference. Definite validation/conflict responses can permit correction under the same identity; a committed changed payload still conflicts server-side.

Confirmed results remain visible until acknowledgement clears the matching reference. Missing or malformed amounts/evidence never become a displayed receipt. Branch/account changes unmount forms, clear displayed data and ignore late results; they preserve the original scope's recovery reference. No customer/payment body is persisted in browser storage. Broader exception tools and printed receipt layouts remain T18.

## Verification boundary

Level 4 scoped checks cover exact split/till totals, tender/change, identified partial/full settlement, anonymous constraints, same/different-key concurrency, stale/corrupt balances, audit rollback, immutable history, evidence validation, actor/tenant/grant/consumer/disable boundaries, clinical full-pay/installment/visit consumers and UI storage/reload/frozen retry. The plan records final counts. No full suite, live receipt, provider action, database migration or deployment is part of this development increment.
