# Pharmacy parties and purchase drafts

T12 and the T16 draft calculation integration are implemented locally. The existing pharmacy workspace has a Purchases tab for authorized staff, with supplier/customer records and editable purchase drafts. Saving these records never receives stock, creates a payable, records a payment or creates a clinical Patient/Doctor. Separate financial posting and partial receipts are now implemented in [T13](pharmacy-purchase-posting.md); shared arithmetic is documented in [the calculation contract](pharmacy-calculations.md).

## Authority and branch visibility

Every route requires authenticated pharmacy staff, the organization module, an explicit authorized `locationId`, and `PHARMACY_PURCHASE` or organization-management permission. Patient/family/guest denial remains independent of grants. Stock, cost, dispensing and EHR grants alone do not unlock purchase costs or business contacts. Purchase-only staff can enter the existing pharmacy route and search a minimal product projection without stock, acquisition-cost or clinical access.

Capability responses add `viewPurchases` and `managePurchases`. New writes require an enabled pharmacy; authorized history remains readable after pharmacy disable. The frontend treats missing new flags as unavailable for compatibility with older capability responses. Live role lookup, tenant assertions and current branch authority still apply. No role is seeded or broadened by this feature.

Business parties belong to the organization and have explicit `locationIds`. They are visible only through an authorized included branch. Sharing or editing a shared record requires authority over every affected branch; the UI preserves existing visibility rather than silently shrinking it. Drafts belong to one originating branch. A shared supplier invoice keeps one organization-level identity across branches; later split receipts must reference that same purchase.

## API and records

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

## Concurrency, history and recovery

Creation reuses the existing command receipt service. Same-key, same-input retries return the same record; a changed committed payload conflicts. Updates use expected revisions and conditional writes, so concurrent editors cannot overwrite each other. Required audit and the saved record commit in the same transaction. Transactional organization/supplier locks and identity lookups preserve uniqueness even before the new indexes are prepared, including across branches and concurrent requests with different keys. These locks do not change the business revision. Capability pinning rejects writes racing pharmacy disable. Unique GST and supplier-invoice indexes must still be prepared through the existing deployment workflow for the database constraint and efficient lookup; no live index operation or migration ran during implementation.

Supplier rename/address/archive does not rewrite an existing draft's captured supplier snapshot. Selecting a different supplier captures that party explicitly. Parties are archived rather than deleted. Forms retain entered values and their creation key after errors. Following a conflict or uncertain response, reopen/check the existing record before starting another draft. Editing a saved draft may need a current supplier selection while retaining its original invoice snapshot. Branch/account changes unmount old forms, clear displayed records and ignore late reads/writes. No business contact or draft body is persisted in browser storage.

## Verification and development scope

Level 4. **50 distinct backend cases across two files and 52 frontend cases across three files passed**, covering no stock/financial side effects, exact draft round trips, recorded/unknown licence validity, GST/history rules, invoice identity across branches, concurrency with/without prepared indexes, audit rollback, grants/revocation/consumer denial, module/capability boundaries, product projection, pagination, preserved form values and branch switching. Both package type checks, changed-file frontend lint and backend API/four-worker build passed (zero lint errors, two warnings).

Verification stayed within the new party/draft file, its capability regression and the affected forms/workspace/settings. Passing checks were retained; corrective reruns selected only changed cases/files. Inventory/payment/clinical mutation code was not changed and its unrelated full suites were not repeated. No dependencies, full suite, frontend production build, browser certification, live records or deployment were involved.
