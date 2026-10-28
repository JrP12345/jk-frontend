# Pharmacy parties and purchasing

Current implementation contracts, consolidated 24 October 2026. Examples are illustrative. Local implementation and dated checks do not establish live professional, provider or deployment approval. Use [release evidence and operating gates](pharmacy-release-evidence.md) for those prerequisites. New installations need current schema setup, not hypothetical historical migrations.

- [Parties and purchase drafts](#parties-and-purchase-drafts)
- [Supplier invoices and deliveries](#supplier-invoices-and-deliveries)

## Parties and purchase drafts

T12 and the T16 draft calculation integration are implemented locally. The existing pharmacy workspace has a Purchases tab for authorized staff, with supplier/customer records and editable purchase drafts. Saving these records never receives stock, creates a payable, records a payment or creates a clinical Patient/Doctor. Separate financial posting and partial receipts are now implemented in [T13](pharmacy-purchasing.md#supplier-invoices-and-deliveries); shared arithmetic is documented in [the calculation contract](pharmacy-finance.md#exact-calculation-and-rounding).

### Authority and branch visibility

Every route requires authenticated pharmacy staff, the organization module, an explicit authorized `locationId`, and `PHARMACY_PURCHASE` or organization-management permission. Patient/family/guest denial remains independent of grants. Stock, cost, dispensing and EHR grants alone do not unlock purchase costs or business contacts. Purchase-only staff can enter the existing pharmacy route and search a minimal product projection without stock, acquisition-cost or clinical access.

Capability responses add `viewPurchases` and `managePurchases`. New writes require an enabled pharmacy; authorized history remains readable after pharmacy disable. The frontend treats missing new flags as unavailable for compatibility with older capability responses. Live role lookup, tenant assertions and current branch authority still apply. No role is seeded or broadened by this feature.

Business parties belong to the organization and have explicit `locationIds`. They are visible only through an authorized included branch. Sharing or editing a shared record requires authority over every affected branch; the UI preserves existing visibility rather than silently shrinking it. Drafts belong to one originating branch. A shared supplier invoice keeps one organization-level identity across branches; later split receipts must reference that same purchase.

### API and records

| Route | Contract |
| --- | --- |
| `GET /api/pharmacy/parties` | Bounded branch-visible directory; optional name search, supplier/customer kind and archived filter. |
| `GET /api/pharmacy/parties/:id` | Current scoped record, including archived records for history. |
| `POST /api/pharmacy/parties` | Create with a stable `Idempotency-Key`. |
| `PUT /api/pharmacy/parties/:id` | Complete editable representation, explicit archive/visibility state and `expectedRevision`. |
| `GET /api/pharmacy/purchases` | Bounded branch draft summaries; optional supplier-invoice search. |
| `GET /api/pharmacy/purchases/:id` | Reopen captured supplier/product/unit and source-line values. |
| `POST /api/pharmacy/purchases` | Create a draft with a stable `Idempotency-Key`. |
| `PUT /api/pharmacy/purchases/:id` | Update an existing draft with `expectedRevision`. |
| `GET /api/pharmacy/purchase-products` | Bounded name/generic/exact-barcode search of products with units; no stock or purchase-cost fields. |

Lists use ID cursors, a default of 25 and maximum of 50 rows, with `nextCursor`. Search is bounded at 100 characters and regex-escaped. The UI requests only a selected page, debounces search and separately fetches the exact saved supplier when reopening a draft. Responses use `Cache-Control: no-store`.

Parties capture a name, address, optional contact details, supplier/customer/both roles, actual GST registration and optional GSTIN, and a supplier licence number with an optional recorded valid-until date. An ordinary customer needs no supplier licence. An unrecorded expiry stays absent; it is not approval of supplier eligibility. GST and date validation is syntactic; neither is a government lookup or professional approval. Recorded expired licences may remain in the directory for history but cannot be selected for a new saved purchase. Actual licence eligibility still requires review before T13 posting. Registered GST identities are unique within the organization, including archived parties. A GST identity already linked to purchase history cannot be removed or reassigned through a master edit. Unregistered parties receive no fabricated GSTIN.

A draft captures supplier ID/revision, the original supplier snapshot, invoice number/date, server-derived April–March financial year, INR currency, the supplier's stated invoice total and up to 100 distinct source lines. Invoice identity normalizes Unicode, case and spacing and rejects hidden format/control characters. `(organizationId, supplierId, invoiceFY, normalizedInvoiceNumber)` is unique, including drafts and across branches. A new request key cannot create a second copy of the same bill.

Each line captures a stable line ID, owned product ID/descriptive snapshot, explicit unit version/factor, billed/free pack and loose quantities, base amount before discount/tax, line discount, invoice GST basis points/HSN and per-base selling/MRP prices. Amounts are integer paise bounded at 100,000,000,000; zero values are retained. Numeric strings, null amounts, unsafe conversions, excessive loose units, repeated line IDs, discount above base amount and price above MRP are rejected. Free-only lines cannot carry a billed base amount. A changed/deleted product or stale unit/supplier version requires review rather than conversion guessing.

The stated supplier total is captured rather than presented as a validated liability. New/edited drafts also store a server-owned `pharmacy-paise-v2` calculation: exclusive base less line discounts, half-up line GST, no automatic round-off, and a total. GST remains unsplit until place-of-supply evidence is reviewed. The reopened draft shows saved totals and the difference from the stated total; save/reopen refreshes these values after edits. Existing drafts without calculations remain readable and are not recalculated on read or replay. T13 must review source evidence and reconcile differences before posting. Draft fields cannot set calculated snapshots, posted/paid status, stock, payment or arbitrary ownership. Existing catalogue tax defaults do not become approved tax evidence through a draft.

### Concurrency, history and recovery

Creation reuses the existing command receipt service. Same-key, same-input retries return the same record; a changed committed payload conflicts. Updates use expected revisions and conditional writes, so concurrent editors cannot overwrite each other. Required audit and the saved record commit in the same transaction. Transactional organization/supplier locks and identity lookups preserve uniqueness even before the new indexes are prepared, including across branches and concurrent requests with different keys. These locks do not change the business revision. Capability pinning rejects writes racing pharmacy disable. Unique GST and supplier-invoice indexes must still be prepared through the existing deployment workflow for the database constraint and efficient lookup; no live index operation or migration ran during implementation.

Supplier rename/address/archive does not rewrite an existing draft's captured supplier snapshot. Selecting a different supplier captures that party explicitly. Parties are archived rather than deleted. Forms retain entered values and their creation key after errors. Following a conflict or uncertain response, reopen/check the existing record before starting another draft. Editing a saved draft may need a current supplier selection while retaining its original invoice snapshot. Branch/account changes unmount old forms, clear displayed records and ignore late reads/writes. No business contact or draft body is persisted in browser storage.

### Verification and development scope

## Supplier invoices and deliveries

T13 is implemented locally. Posting a saved supplier bill establishes one frozen payable principal on `PharmacyPurchase.posting`; it does not receive stock or create a sales invoice. Each accepted delivery is a separate atomic command that advances the purchase revision and records stock once. Supplier credits, payments and balance settlement remain T20. No real supplier evidence, tax configuration, production index or live record was changed during development.

### Authority and API

All routes require authenticated pharmacy staff, the pharmacy module, current purchasing/history authority and an authorized originating branch. Posting requires `managePurchases`; receiving additionally requires `receiveStock`. New activity requires enabled pharmacy capability, pinned inside the committing transaction. Authorized purchase history and initiating-operator recovery remain readable after disable. Stock/cost/clinical grants alone do not expose purchase financials.

| Route | Contract |
| --- | --- |
| `POST /api/pharmacy/purchases/:id/post` | Stable `Idempotency-Key`, location, expected purchase/supplier revisions, reviewed supplier state, explicit `sgst`/`utgst`/`igst` mode, cost treatment, round-off and actual review reference. |
| `POST /api/pharmacy/purchases/:id/receipts` | Separate stable key, location, expected purchase revision, actual delivery reference and 1–100 delivery lot lines. |
| `GET /api/pharmacy/purchases/:id/operations/:kind/:key` | Current branch/history authority and original actor; `kind` is `post` or `receipt`. Returns the original encrypted committed result, rather than recomputed current stock. |
| `GET /api/pharmacy/purchases/:id/receipts` | Scoped ID-cursor delivery history, ten receipts per page; each has at most 100 lot lines. |

Responses use `Cache-Control: no-store`. Input allowlists reject client amounts, posted statuses, acquisition-cost overrides and arbitrary source/ownership fields. A result not yet visible is unresolved; a 404 does not prove an in-flight transaction failed.

### Posting

Posting reloads the draft and source products, locks the live supplier and reviewed branch tax profile, and checks revisions, branch ownership, units, supplier identity/eligibility and India/INR configuration. Recorded expired supplier licensing blocks posting; an absent licence expiry remains absent. The actual review reference must cover eligibility and source tax treatment; it is operator evidence, not government verification or external professional approval.

The supplier GSTIN state must match the reviewed supplier state. Interstate states require IGST; matching states require the explicitly reviewed local SGST/UTGST split. An unregistered supplier cannot collect GST. Recipient registration does not automatically determine recoverability of supplier input tax. `costTreatment` explicitly selects `exclude_tax` or `include_tax`, under the recorded review. Production rate, jurisdiction, input-tax and rounding approval remains an external release gate.

The shared `pharmacy-paise-v2` calculator recomputes the saved exclusive base, line discounts and captured source rates. Explicit round-off is limited to −99…99 paise. Calculated payable must equal the supplier's stated total exactly; a mismatch requires correcting the draft or reviewing round-off, with no silent balancing entry. A source line's selected acquisition cost cannot exceed the supported 100,000,000,000-paise receipt bound.

The transaction freezes the original supplier/product/unit/source bill facts, posting calculation, review reference, supplier/profile revisions, actor/date, cost treatment and payable principal. Status becomes `posted`; receipt progress starts at zero. Stock, sales turnover and money collection remain unchanged. Posted financial fields cannot be edited, reopened, replaced or deleted through the model/API. Corrections require later source-bound credits rather than rewriting the bill.

Posting and delivery keys are separate. Same-key/same-payload retries return the original outcome; a changed committed payload conflicts. The existing organization-wide supplier/year/normalized-invoice identity from T12 prevents a new key from creating another bill. A new posting key cannot post an already posted purchase.

### Deliveries, cost and rollback

Each delivery has an actual source reference, normalized for case/spacing/Unicode and rejecting hidden format/control characters. Repeating the reference under another key conflicts. A database uniqueness index reinforces this identity, while conditional purchase revisions and transactional identity lookups also protect concurrent deliveries before that index is prepared. No deployment path creates or drops indexes automatically.

Each lot line supplies a stable delivery-line ID, captured purchase-line ID, received billed/free **base-unit** counts, actual printed batch and printed expiry precision/value. Multiple lots may reference one purchase line, including different actual batches or expiries. Billed and free allowances are capped separately and cumulatively. At most 100 deliveries are accepted per purchase; larger exceptional workflows require review. Posted source quantities, rates, selling prices and MRP cannot be overridden by a delivery.

Acquisition cost is the selected captured net or gross line amount, excluding document-level round-off. It is spread across the source line's total billed plus free base units. Each lot receives the difference between half-up cumulative cost at the new received quantity and cumulative cost already received. The last delivery therefore exhausts the exact captured cost without multiplying a rounded per-tablet cost. Free-only source lines remain zero-cost. Every resulting lot retains the existing exact rational cost basis and immutable unit/expiry/price snapshots.

The receiving adapter is shared with T11. It checks actual receipt-index readiness before entering the transaction and retains the installed legacy batch-label index gate. Inside the transaction it validates active owned products, the full posted unit snapshot, safe quantities, printed expiry/cutoff, lot/aggregate reconciliation, prices and remaining allowances. Lots and stock movements carry immutable purchase/line/delivery references and source HSN/GST. A different catalogue tax classification still requires review before a later sale; inward does not silently approve catalogue tax evidence.

All lot writes, aggregate revisions, movements, purchase progress/revision, append-only delivery, required audit and encrypted command result commit together with majority write concern. A failure after the first lot rolls everything back. A concurrent editor/delivery either commits at the expected revision or must reopen the purchase; it cannot consume the same remaining allowance. Deliveries create no second payable, sales invoice or payment.

### Existing inward and UI recovery

The existing legacy `POST /api/pharmacy/batches` now requires `unlinkedInwardReason` (3–200 characters), retained on its stock movement. It rejects `purchaseId`: supplier-bill deliveries use the linked purchase receipt route. Existing API integrations must adopt this field before rollout. Legacy inward retains its other stock/unit/index constraints and never posts a supplier payable. Opening counts and manual T11 stock receipts also remain separate from supplier posting; staff must not enter the same physical delivery in both workflows.

The Purchases tab shows draft/posted status. A saved draft can be reviewed for posting; only its saved values are posted. The posted view shows payable, remaining billed/free units, received lots and bounded delivery history. Posting and receiving have distinct permissions. Save draft edits before opening the posting review.

Before dispatch, the UI stores only an opaque operation kind/key under account/organization/impersonation/branch/purchase scope in session storage. Storage failure prevents dispatch. Transport failures retain a frozen in-memory payload and the same reference for retry. Reload retains the reference and provides a result lookup; original details may be re-entered under that reference when needed. A definite validation/conflict response can unlock correction under that same reference, without starting a new command identity. If the original payload committed, changed-payload protection still prevents replacement.

Confirmed results require acknowledgement before clearing the matching reference and starting another operation. Missing or malformed result amounts never become a displayed zero payable. Account/branch changes unmount the form and ignore late results. No supplier details, delivery body, financial amounts or patient data are persisted in browser storage. Physical printer, operator exception handling and broader recovery tooling remain T18.
