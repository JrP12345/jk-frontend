# Supplier invoice posting and deliveries

T13 is implemented locally. Posting a saved supplier bill establishes one frozen payable principal on `PharmacyPurchase.posting`; it does not receive stock or create a sales invoice. Each accepted delivery is a separate atomic command that advances the purchase revision and records stock once. Supplier credits, payments and balance settlement remain T20. No real supplier evidence, tax configuration, production index or live record was changed during development.

## Authority and API

All routes require authenticated pharmacy staff, the pharmacy module, current purchasing/history authority and an authorized originating branch. Posting requires `managePurchases`; receiving additionally requires `receiveStock`. New activity requires enabled pharmacy capability, pinned inside the committing transaction. Authorized purchase history and initiating-operator recovery remain readable after disable. Stock/cost/clinical grants alone do not expose purchase financials.

| Route | Contract |
| --- | --- |
| `POST /api/pharmacy/purchases/:id/post` | Stable `Idempotency-Key`, location, expected purchase/supplier revisions, reviewed supplier state, explicit `sgst`/`utgst`/`igst` mode, cost treatment, round-off and actual review reference. |
| `POST /api/pharmacy/purchases/:id/receipts` | Separate stable key, location, expected purchase revision, actual delivery reference and 1–100 delivery lot lines. |
| `GET /api/pharmacy/purchases/:id/operations/:kind/:key` | Current branch/history authority and original actor; `kind` is `post` or `receipt`. Returns the original encrypted committed result, rather than recomputed current stock. |
| `GET /api/pharmacy/purchases/:id/receipts` | Scoped ID-cursor delivery history, ten receipts per page; each has at most 100 lot lines. |

Responses use `Cache-Control: no-store`. Input allowlists reject client amounts, posted statuses, acquisition-cost overrides and arbitrary source/ownership fields. A result not yet visible is unresolved; a 404 does not prove an in-flight transaction failed.

## Posting

Posting reloads the draft and source products, locks the live supplier and reviewed branch tax profile, and checks revisions, branch ownership, units, supplier identity/eligibility and India/INR configuration. Recorded expired supplier licensing blocks posting; an absent licence expiry remains absent. The actual review reference must cover eligibility and source tax treatment; it is operator evidence, not government verification or external professional approval.

The supplier GSTIN state must match the reviewed supplier state. Interstate states require IGST; matching states require the explicitly reviewed local SGST/UTGST split. An unregistered supplier cannot collect GST. Recipient registration does not automatically determine recoverability of supplier input tax. `costTreatment` explicitly selects `exclude_tax` or `include_tax`, under the recorded review. Production rate, jurisdiction, input-tax and rounding approval remains an external release gate.

The shared `pharmacy-paise-v2` calculator recomputes the saved exclusive base, line discounts and captured source rates. Explicit round-off is limited to −99…99 paise. Calculated payable must equal the supplier's stated total exactly; a mismatch requires correcting the draft or reviewing round-off, with no silent balancing entry. A source line's selected acquisition cost cannot exceed the supported 100,000,000,000-paise receipt bound.

The transaction freezes the original supplier/product/unit/source bill facts, posting calculation, review reference, supplier/profile revisions, actor/date, cost treatment and payable principal. Status becomes `posted`; receipt progress starts at zero. Stock, sales turnover and money collection remain unchanged. Posted financial fields cannot be edited, reopened, replaced or deleted through the model/API. Corrections require later source-bound credits rather than rewriting the bill.

Posting and delivery keys are separate. Same-key/same-payload retries return the original outcome; a changed committed payload conflicts. The existing organization-wide supplier/year/normalized-invoice identity from T12 prevents a new key from creating another bill. A new posting key cannot post an already posted purchase.

## Deliveries, cost and rollback

Each delivery has an actual source reference, normalized for case/spacing/Unicode and rejecting hidden format/control characters. Repeating the reference under another key conflicts. A database uniqueness index reinforces this identity, while conditional purchase revisions and transactional identity lookups also protect concurrent deliveries before that index is prepared. No deployment path creates or drops indexes automatically.

Each lot line supplies a stable delivery-line ID, captured purchase-line ID, received billed/free **base-unit** counts, actual printed batch and printed expiry precision/value. Multiple lots may reference one purchase line, including different actual batches or expiries. Billed and free allowances are capped separately and cumulatively. At most 100 deliveries are accepted per purchase; larger exceptional workflows require review. Posted source quantities, rates, selling prices and MRP cannot be overridden by a delivery.

Acquisition cost is the selected captured net or gross line amount, excluding document-level round-off. It is spread across the source line's total billed plus free base units. Each lot receives the difference between half-up cumulative cost at the new received quantity and cumulative cost already received. The last delivery therefore exhausts the exact captured cost without multiplying a rounded per-tablet cost. Free-only source lines remain zero-cost. Every resulting lot retains the existing exact rational cost basis and immutable unit/expiry/price snapshots.

The receiving adapter is shared with T11. It checks actual receipt-index readiness before entering the transaction and retains the installed legacy batch-label index gate. Inside the transaction it validates active owned products, the full posted unit snapshot, safe quantities, printed expiry/cutoff, lot/aggregate reconciliation, prices and remaining allowances. Lots and stock movements carry immutable purchase/line/delivery references and source HSN/GST. A different catalogue tax classification still requires review before a later sale; inward does not silently approve catalogue tax evidence.

All lot writes, aggregate revisions, movements, purchase progress/revision, append-only delivery, required audit and encrypted command result commit together with majority write concern. A failure after the first lot rolls everything back. A concurrent editor/delivery either commits at the expected revision or must reopen the purchase; it cannot consume the same remaining allowance. Deliveries create no second payable, sales invoice or payment.

## Existing inward and UI recovery

The existing legacy `POST /api/pharmacy/batches` now requires `unlinkedInwardReason` (3–200 characters), retained on its stock movement. It rejects `purchaseId`: supplier-bill deliveries use the linked purchase receipt route. Existing API integrations must adopt this field before rollout. Legacy inward retains its other stock/unit/index constraints and never posts a supplier payable. Opening counts and manual T11 stock receipts also remain separate from supplier posting; staff must not enter the same physical delivery in both workflows.

The Purchases tab shows draft/posted status. A saved draft can be reviewed for posting; only its saved values are posted. The posted view shows payable, remaining billed/free units, received lots and bounded delivery history. Posting and receiving have distinct permissions. Save draft edits before opening the posting review.

Before dispatch, the UI stores only an opaque operation kind/key under account/organization/impersonation/branch/purchase scope in session storage. Storage failure prevents dispatch. Transport failures retain a frozen in-memory payload and the same reference for retry. Reload retains the reference and provides a result lookup; original details may be re-entered under that reference when needed. A definite validation/conflict response can unlock correction under that same reference, without starting a new command identity. If the original payload committed, changed-payload protection still prevents replacement.

Confirmed results require acknowledgement before clearing the matching reference and starting another operation. Missing or malformed result amounts never become a displayed zero payable. Account/branch changes unmount the form and ignore late results. No supplier details, delivery body, financial amounts or patient data are persisted in browser storage. Physical printer, operator exception handling and broader recovery tooling remain T18.

## Verification

Level 4. Focused tests exercise posting once, exact net/gross/free cost allocation, full/partial/multi-lot delivery, duplicate and concurrent requests, source limits, immutable history, absent indexes, invalid/expired later lines, audit rollback, reviewed state/tax/total checks, unit drift, grants/revocation/tenant/consumer boundaries, disable/recovery, legacy inward, and UI frozen retry/reload/storage/result validation. Tests and index operations use disposable synthetic replica sets only. No full suite, live migration/index cutover, provider operation or deployment is part of this increment.
