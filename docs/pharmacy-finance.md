# Pharmacy supplier returns, settlements and dues

T20 adds source-bound supplier returns, actual supplier credit/payment/refund records, customer refund payouts and reviewed opening dues to the existing pharmacy workspace. All commands use current staff/organization/branch authority, strict numeric paise, required audit, replica-set transactions, stable keys and original-result recovery. No provider or banking call is made by these manual workflows.

## Source-receipt supplier returns

Purchase return review reads only posted purchases and their actual received lots. Source receipt quantities, on-hand stock, captured units/expiry and prior returns cap each selection. A committed return deducts the actual owned lot and physical aggregate, appends a `supplier_return` movement and an immutable `PharmacyPurchaseReturn`, and increments the purchase settlement revision. It preserves the original posted payable. Expected credit uses captured payable allocations, including free-unit cost allocation and final paise/rounding; it is an expectation until actual supplier note evidence arrives.

| Route | Contract |
| --- | --- |
| `GET /api/pharmacy/purchases/:id/return-source?locationId=…` | Current purchasing/history grant; bounded received lots, on-hand/returned/remaining quantities and source revisions. |
| `POST /api/pharmacy/purchases/:id/returns/quote` | Purchasing plus return grant; read-only actual source/reason/reference review. |
| `POST /api/pharmacy/purchases/:id/returns` | Same grants, confirmed source/stock/settlement revisions and expected credit; one stock effect. |
| `GET /api/pharmacy/purchase-return-operations/:key?locationId=…` | Current purchasing history and original actor; original committed result. |

## Actual credit and money events

`PharmacyCashEvent` is append-only and carries actual actor, recording time, reference, method, currency, kind, direction and source allocations. Actual supplier credits have direction `none`; supplier payments/customer refunds have direction `out`; supplier refunds received have direction `in`. A supplier credit is documentary evidence rather than a cash receipt. All commands require explicit actual confirmation and a review reference. They do not infer success from a payment attempt, QR display or provider status.

`POST /api/pharmacy/settlements/:kind` supports `supplier-credit`, `supplier-payment`, `supplier-refund` and `customer-refund`. Financial approval is required; supplier commands additionally require purchasing-source authority. Actual normalized document/payment references are unique per organization, kind, party and financial year. One actual supplier payment or note can allocate to multiple supported sources in the same branch, up to 100 distinct allocations, whose sum must exactly equal the actual amount.

Supplier credits allocate actual dated note amounts against remaining expected purchase-return credit, or a reviewed supplier opening obligation. A partial note leaves the rest pending. Payments cannot exceed each source's current due; refunds received cannot exceed its actual credit/overpayment receivable. Source revisions serialize concurrent different-key attempts. Supplier balances reconcile as opening + posted bills − confirmed credits − payments + refunds received. Outstanding liabilities and supplier refund receivables remain separate per source; pending expected credit does not reduce a payable.

Customer credits first reduce the original invoice due. Excess against actual receipts becomes a refund payable. Confirmed payouts are capped against that source, increment its payment revision and `refundedPaise`, and create one outgoing event. Original issued amounts, tax facts and incoming `Invoice.payments` remain unchanged. Later returns account for refunds already paid. No fake appointment, patient, doctor, incoming receipt or automatic payment reversal is created.

`GET /api/pharmacy/cash-operations/:key?locationId=…` reauthorizes current source-history authority and the original actor before returning the original result. `GET /api/pharmacy/invoices/:id/refund-source`, `/suppliers/:id/statement` and `/customers/:id/statement` expose exact source balances. Party and refund-bill lookups are branch-scoped and limited to 25 rows per page; full statement review is capped at 1,000 obligations and 10,000 events. The UI renders statement/lot/allocation pages in groups of 25.

## Reviewed opening dues

Organization management can explicitly record an actual dated positive customer/supplier debt using `POST /api/pharmacy/opening-balances`. It requires an active matching party at the expected revision, actual source/reference, review and confirmation. The source is immutable and recoverable through `/opening-balance-operations/:key`; `/opening-balances/:id` reauthorizes its history. No historical migration/backfill or live import runs automatically.

Supplier opening obligations remain separate from purchases, with their own source identity and settlement revision. Actual payments, notes and refunds allocate to that source without fabricating a supplier invoice or stock receipt.

Customer opening dues use an explicit **opening balance statement**, `documentVersion: 3`, in the shared Invoice payment aggregate. It has a separate `O…` sequence, captured party/issuer/source, no items, no tax document/calculation and no stock/clinical source. It records no current supply or turnover. This lets actual incoming collections stay in `Invoice.payments`, including partial receipts, without a duplicate cash-event ledger. Opening statements preview/print with their own title and source facts. Their payment receipts are separate documents. Retail tax/sales/return readers use their actual supply contract; clinical readers continue excluding pharmacy records. Future pharmacy turnover reports must distinguish version-2 supplies from version-3 opening statements.

## Workspace and recovery

**Finance & dues** offers supplier statements/returns/settlements, customer dues/refunds and owner-reviewed opening records. It honors each independent source, collection and approval grant. Authorized history, source corrections and settlement payouts remain available after pharmacy capability disable; new opening debts require enabled capability. Commercial expiry continuity is finalized by T23.

One uncertain finance command is retained per operator/organization/impersonation/branch using only opaque kind/source/key metadata in session storage. The submitted body stays in memory and retries identically. Storage failure blocks dispatch; an unresolved result cannot be silently replaced. Reload permits current-authority recovery or re-entry under the original key. Permission changes clear private forms while retaining the opaque identity; accounts, organizations, impersonation and branches remain separate. The same identity-only reference policy now covers counter sales, collections and sales returns. Confirmed results require matching branch/source/key and exact event allocations before the UI acknowledges them.

T30's existing daily collection report remains a **gross incoming-receipt** report: credits are not money received, and payouts never rewrite receipts. T21 uses the new event directions/methods to compute drawer cash and closing. Financial/tax source evidence and commercial credit notes do not assert professional tax-filing approval or bank/provider verification. Real operational, device, professional and release evidence remains T26.
