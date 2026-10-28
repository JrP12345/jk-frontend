# Pharmacy documents, money and reporting

Current implementation contracts, consolidated 24 October 2026. Examples are illustrative. Local implementation and dated checks do not establish live professional, provider or deployment approval. Use [release evidence and operating gates](pharmacy-release-evidence.md) for those prerequisites. New installations need current schema setup, not hypothetical historical migrations.

- [Exact calculation and rounding](#exact-calculation-and-rounding)
- [Issuer and issued tax documents](#issuer-and-issued-tax-documents)
- [Patient-optional retail invoices](#patient-optional-retail-invoices)
- [Collections and uncertain outcomes](#collections-and-uncertain-outcomes)
- [Source-bound sales returns](#source-bound-sales-returns)
- [Supplier settlements and opening dues](#supplier-settlements-and-opening-dues)
- [Physical cash drawers](#physical-cash-drawers)
- [Daily receipt reports](#daily-receipt-reports)
- [Bounded reports and exports](#bounded-reports-and-exports)

## Exact calculation and rounding

T16 is implemented locally. `B:services/InvoiceCalculationService.ts` owns the `pharmacy-paise-v2` policy. The calculator is deterministic and has no database writes, rate lookup, professional approval or payment/stock effects. Existing clinical invoice arithmetic and issued historical documents retain their existing policies. No rate or issuer configuration has been activated.

### Inputs and rounding

Every request explicitly names the policy, INR currency, inclusive/exclusive price basis and tax mode. Every stable, unique line ID carries a positive safe base-unit quantity, a rational unit price (`numeratorPaise / denominatorUnits`) and an explicit effective GST rate in integer basis points. Zero rates are retained. Rational quantities are multiplied using BigInt before a single half-up rounding to whole line paise; a purchase's captured cost total can therefore be spread over billed and free units without rounding a per-tablet price first.

Line discounts apply to that document's price basis first: inclusive amounts for inclusive sales, before-tax amounts for exclusive purchase bills. Invoice discounts then allocate proportionally over remaining line amounts. Largest remainders receive the remaining paise; stable line IDs break ties using code-unit order, independent of line order or locale. A fully discounted line has no base or tax. Inclusive base rounds half up and tax is the remainder of the exact discounted gross; exclusive tax rounds half up on the discounted base.

Tax mode explicitly selects CGST/SGST, CGST/UTGST, IGST, unsplit draft GST or no collection. An odd local tax paise goes to SGST/UTGST, preserving existing SGST behavior. Non-collecting profiles must supply an explicit effective zero rate. The calculator never decides which jurisdiction or registration applies. Issuing services must validate effective issuer/product/source evidence and capture its revision, rate, HSN and date before calling it. Historical return credit must use the original source policy and tax snapshot, rather than current rates.

Optional captured rational MRP is always tax-inclusive. Both the undiscounted exact unit price including tax and the rounded line gross must fit the captured cap; discounts cannot hide an excessive selling price. A return is calculated as a positive credit magnitude. Remaining source quantity, cumulative credit caps, credit numbering and refund authority remain T19/T20 transaction responsibilities.

Round-off is an explicit signed integer from −99 to 99 paise, added after line totals. Default is zero; no automatic rounding or balancing to a user-entered stated total occurs. Calculated totals and inputs must remain nonnegative safe integers, except signed round-off. Negative payable, unsupported policy/currency/modes, invalid quantities/rates/denominators, non-finite/fractional/overflowing money, null financial values, duplicate IDs and excessive discounts fail closed. BigInt intermediates avoid precision loss before bound checks. Output contains only serializable integer numbers.

### Existing bills and purchase drafts

The existing `inclusive-paise-v1` utility delegates its decomposition to the same primitive, retaining its four-field DTO and exact historical rounding. Connected supply aggregates actual captured lot prices before calculation, as previously, and retains its issued document version, tax snapshot, totals and rupee projections. It does not round lots independently or rewrite stored invoices. Print templates continue to consume the original committed fields.

New or explicitly edited purchase drafts save a server-owned `calculation` snapshot, including policy, basis, tax mode, line results and totals. Base and discounts come from the source supplier bill. The exact acquisition amount is distributed over billed plus free units. Draft GST remains `unallocated`: current draft capture has no reviewed place-of-supply evidence and must not fabricate a local/interstate split. Entered GST remains unreviewed source evidence, including for an unregistered party, until posting validation is implemented. No calculated amount becomes a posted liability.

The UI displays the saved calculated base/GST/total and signed difference `stated − calculated`; it labels these as saved amounts while edits are in progress. Save and reopen refreshes the snapshot. The supplier's stated total is retained even when it differs. T13 must require reviewed tax evidence and explain/reconcile any difference before posting. There is no client-side financial calculator, automatic total substitution or client-supplied calculated snapshot. Existing draft allowlists reject injection of `calculation`.

Older drafts without a snapshot remain readable, and reads/replays do not recalculate or backfill them. An explicit revision-checked save captures the new policy. No historical invoices or draft records were migrated.

### Verification and activation

Before production activation, a qualified reviewer must approve the rounding fixtures, rates/effective dates, jurisdiction selection, discount treatment and source-document/return policy. T13 purchase posting, T14/T15 retail transactions and T19 source-bound credit notes must reuse this calculator and retain their policy/tax snapshots. Transaction and authority checks belong to those implemented workflows; actual professional evidence remains a release prerequisite. No live index, migration, deployment or real printer certification is included here.

## Issuer and issued tax documents

The issuer, numbering and immutable-document rules apply to pharmacy supply.
Connected clinical dispensing and patient-optional retail transactions retain
their separate authority paths described in these guides. The application does
not certify an issuer's actual tax registration, classifications, licences,
turnover obligations, signature process or professional approval.

### Numbering and historical records

New numbers allocated through `utilities/invoiceNumber.ts` use a globally reserved four-character branch series and an India financial-year counter: `I00012627/000001` is 16 characters. This implements the financial-year uniqueness and length boundary recorded in [CBIC's invoice rules](https://cbic-gst.gov.in/invoice-rules.html). The series is reserved independently of ObjectId suffixes, persists across financial years and cannot be edited through the model. Financial years change at midnight in Asia/Kolkata on 1 April. The six-digit sequence stops at 999999; exhaustion or corrupt counter state requires a reviewed numbering change. No truncation, wraparound or automatic reset occurs. The current two-digit year encoding supports financial years beginning 2000–2098; another numbering version is required beyond that range.

Number reservation, stock, source fulfillment, invoice, audit and encrypted command result participate in the existing receipt transaction. Old invoice numbers, rupee amounts, IDs and read URLs remain intact. Ordinary clinical callers retain the string-returning numbering helper and receive new short numbers; this does not classify their documents as reviewed pharmacy tax invoices.

### Explicit configuration

Only authenticated pharmacy staff with `MANAGE_ORGANIZATION` and current branch access can configure the following endpoints. Organization, confirmer and confirmation time come from the server. Optimistic `expectedRevision` prevents stale replacement. Ordinary medicine management permission alone cannot approve these settings. Medicine-tax responses contain classification fields only, without acquisition costs.

`GET /api/pharmacy/locations/:locationId/tax-profile` returns the current profile or null. Reads use `Cache-Control: no-store`.

`PUT /api/pharmacy/locations/:locationId/tax-profile`:

```json
{
  "expectedRevision": 0,
  "registration": "regular",
  "legalName": "<actual legal issuer>",
  "address": "<actual licensed branch address>",
  "stateCode": "<two-digit GST state code>",
  "gstin": "<actual GSTIN matching issuer state>",
  "drugLicenceNumbers": ["<actual applicable licence>"],
  "authorisedSignatory": "<actual authorised signatory>",
  "reviewReference": "<reference to the completed professional review>",
  "pricesIncludeTax": true,
  "minimumHsnDigits": 6,
  "electronicReportingRequired": false
}
```

Supported registration modes are `regular`, `composition` and `unregistered`; an unregistered profile cannot carry a GSTIN. The organization must explicitly specify India and INR. GSTIN format/state consistency is checked; the application does not verify registration status against a government service. Required HSN precision is explicitly reviewed as 4, 6 or 8 digits. A valid update declaring tax-exclusive pricing or required electronic reporting is saved with `issueSupported: false` and blocks new supply; the system does not leave an older supported profile active merely because the new requirements are unsupported. Inconsistent identity/registration edits are rejected. B2B, export, interstate delivery, reverse charge and electronic reporting integrations require separately implemented workflows; the existing endpoint accepts only connected local counter supply.

`PUT /api/pharmacy/medicines/:id/tax-classification`:

```json
{
  "expectedRevision": 0,
  "hsnCode": "<reviewed HSN>",
  "unitCode": "<reviewed three-letter quantity unit code>",
  "gstRate": 5,
  "treatment": "taxable",
  "reviewReference": "<reference to classification/rate evidence>"
}
```

The number above is an example, not a recommendation for any medicine. `taxable` requires a positive reviewed rate; `exempt` and `nil_rated` require explicit zero. An HSN or unit format check does not establish legal classification. There is no quantity/pack conversion in T06; T10/T11 establish that model. The classification snapshot must still match the catalogue when supplied, and actual allocated lots must carry matching stored HSN/rate metadata. Missing stored metadata does not inherit Mongoose defaults. Differing or unknown lot classifications stop supply for reconciliation rather than guessing or rewriting old lots. New batch receipt preserves an explicit zero catalogue rate.

A confirmation records the authorized operator's assertion and review reference. It is not an automated CA/pharmacist qualification check or a substitute for actual review. No real profile or classification is populated by this implementation. Configuration UI and independent business setup remain in the subsequent workspace/onboarding tasks; these authorized APIs are available for reviewed configuration.

### Issue, pricing and source integrity

For a new dispense command, missing/unreviewed/unsupported settings return a review conflict before commit. Any classification or document failure after allocation rolls back the entire transaction. Replay still reads the original T04 encrypted result before current mutable tax validation.

The server captures actual lot quantities and sale prices in the committed supply. For this scope prices are inclusive, so GST is decomposed from the existing counter price, never added on top. New line facts store integer paise and the `inclusive-paise-v1` policy. The base is rounded half up from the inclusive gross using integer arithmetic; CGST and SGST split the remaining tax with an odd paise assigned to SGST. Every line and document reconcile exactly to the captured gross. The real issuer's professional review must approve that explicit rounding policy and examples before release. T16 extends the calculator to retail quotes, discounts, units and other supported cases.

Regular suppliers produce a tax invoice for taxable lines, a bill of supply for explicit zero/exempt lines, or an invoice-cum-bill of supply for a supported mixture. Composition suppliers use a bill of supply and the composition notice without collecting GST. Unregistered suppliers use an ordinary pharmacy bill and collect no GST. These document distinctions and collection limits are based on [CGST Rules 46/46A/49](https://cbic-gst.gov.in/pdf/01012020-CGST-Rules-2017-Part-A-Rules.pdf) and [CGST Act Sections 31/32](https://cbic-gst.gov.in/hindi/CGST-bill-e.html), subject to the issuer's current professional review. A recipient name is required. At values of ₹50,000 or more, an address and explicit GST state code must also be recorded; a legacy free-text state name is not guessed into a code. Counter delivery is captured at the issuer's branch address. The location remains the captured place of supply for this local counter workflow.

Each new pharmacy supply issues a separate document, even when an unpaid clinical draft exists. It carries `documentVersion: 1`, numbering metadata, `issuedAt`, an issuer/recipient/tax snapshot, original source-line IDs and a link to the existing visit bill when one exists. Payment status remains independent: an issued invoice may be unpaid. Clinical drafts and prior pharmacy documents remain unchanged. Both charge compilers exclude pharmacy lines already issued on another bill, and clinical checkout settles its clinical bill separately. Current invoice installment collection can settle the pharmacy document while preserving its captured issue fields. Counter/provider settlement projects the combined posted visit balances; paying pharmacy first does not hide an unbilled consultation. A pharmacy gateway callback cannot replace the consultation's canonical invoice/fee pointer.

Application saves, query changes, deletes and bulk-write bypasses cannot rewrite an issued document's identity, source lines, amounts or issuer snapshot. A new supply needs another linked document. Cancellation/refund/credit correction remains the reviewed returns workflow in T19; removing an invoice is not stock reversal. Out-of-band corruption causes source verification/recompilation to stop rather than recreate a charge.

### Printing and release gates

The existing unified print lifecycle renders the captured issuer, licence/GST particulars, recipient and delivery address, document kind/number/FY/issue time, HSN/quantity unit, rates, tax components and captured amounts. It does not replace these with today's clinic branding, patient name or prices. Incomplete issued snapshots cannot fall back to a generic clinical invoice. Legacy invoices keep their existing generic presentation. Clinical checkout no longer labels its unreviewed receipt a tax invoice.

This version uses `manual_on_print`: the authorized representative must sign the printed document. It does not fabricate a signature image or claim a cryptographically signed tax invoice. Real printer/browser, signature and handover practice require review and pilot evidence. Electronic reporting/QR/IRN requirements must be evaluated by the issuer's professional reviewer; declaring them required blocks this implementation's issue path.

Release also requires the existing index-maintenance workflow to prepare `InvoiceSeries`, `PharmacyTaxProfile` and invoice source-line indexes before writes are enabled. No index application, migration, live configuration, professional approval or deployment runs during local tests. Existing controlled-register completion remains T07. Full release gates remain in T26.

Official sources linked above were accessed 19 October 2026. The live invoice-rules page could not be fully fetched during this increment; indexed official provisions and the official rules PDF were used as cross-checks. Professional review of current applicability remains a release requirement, not a completed local test.

## Patient-optional retail invoices

T14 is implemented locally. Counter issue reuses `Invoice`, `PharmacyDispense`, FEFO, the shared calculator, numbering and command receipts. It creates no Patient, Doctor, Encounter, appointment or prescription. Positive-value issue produces an **unpaid issued invoice**, never proof of payment. T17 now supplies confirmed collections and T15 supplies the keyboard counter workspace. A fully discounted zero-total bill settles without a money receipt.

The user confirmed on 20 October 2026 that the whole project is in development with no production customers or legacy records. Use the current intended contracts directly, without historical backfill or speculative compatibility work. Preserve current clinical, financial and security flows.

### API and authority

| Route | Contract |
| --- | --- |
| `POST /api/pharmacy/sales` | Staff, pharmacy module, current branch authority, `PHARMACY_SELL` or organization-management grant, enabled branch and stable `Idempotency-Key`. |
| `GET /api/pharmacy/sale-operations/:key?locationId=…` | Current sales/history authority, selected branch and original actor; immutable committed result. |
| `GET /api/pharmacy/invoices?locationId=…&cursor=…` | Sales/history authority, explicit branch, ID cursor, 25 rows per page and no clinical invoices. |
| `GET /api/pharmacy/invoices/:id?locationId=…` | Sales/history authority and branch ownership; committed invoice with captured selling/unit/batch/printed-expiry/MRP evidence, excluding acquisition costs. |

`viewSales` is granted by `PHARMACY_SELL`, `PHARMACY_COLLECT_PAYMENT` or organization management. `sell` permits issue and requires enabled pharmacy; authorized history/recovery remains available after disable. Patient/family/guest denial applies independently of grants. Generic clinical billing and stock permissions do not authorize retail issue. Responses use `Cache-Control: no-store`.

The strict input contains location, expected issuer revision, confirmed total in paise, optional customer ID/revision, optional invoice discount/round-off and 1–100 distinct product lines. Each line supplies stable line ID, product ID, positive whole base quantity, expected unit/stock revisions and optional integer discount. No client selling price, clinical ID, paid status, arbitrary customer snapshot or allocation is accepted. Numeric strings/null are not coerced into financial values.

The confirmed total is an assertion, not client calculation authority. The server prices actual allocated lots and rolls back the whole command if the total differs. T15 provides the trusted quote/cart, current revisions and material quote hash; no frontend financial calculator is introduced.

### Issue transaction

This first path accepts reviewed **general** products only. Restriction/tax classifications must have actual captured review evidence matching current product metadata. Schedule H/H1/X, narcotics and unreviewed ordinary classifications cannot use it. Authorized clinical dispensing keeps its own supported prescription path; external restricted prescriptions need their separate evidence workflow.

The issuer requires a reviewed India/INR profile and matching expected revision. Existing local counter-pickup, inclusive-price, B2C, high-value recipient-evidence and electronic-reporting boundaries apply. No interstate/B2B/export/reverse-charge path is activated. Anonymous issue displays “Walk-in customer” without manufacturing an identity. Identified customers must be active branch-visible customer parties at the expected revision; their name/address/contact are captured. A GSTIN requires a separately supported B2B path.

Counter stock requires captured owned lots with valid unit/cost/expiry snapshots and actual MRP. Lot quantities must reconcile to the aggregate within the 5,000-lot review bound. FEFO validates captured units/prices/MRP and eligible expiry. Source HSN/GST must match reviewed product classification. Selling prices come from those lots, never catalogue/client overrides.

`pharmacy-paise-v2` calculates inclusive paise amounts, line and deterministic invoice discounts, tax and explicit round-off. The transaction creates `kind: pharmacy`, `documentVersion: 2`, actual `createdBy`, customer/tax/calculation snapshots, numbered Invoice items with dispense/source-line references, and an append-only `PharmacyDispense` with no clinical IDs. Source lines capture real units, lots, selling prices, printed expiry and MRP.

Stock deltas, movements, invoice, source, required audit, capability pin and encrypted result commit together with majority write concern. Same-key/same-input retry returns the original invoice; changed committed input conflicts. A separate sale uses a new key and current revisions. Concurrent last-unit sales cannot both commit. Later-line, total or audit failures roll back earlier stock changes. Recovery returns invoice/dispense IDs, number, paise total, unpaid status and key without reconstructing current stock or collecting money.

Prescription uniqueness now applies to `PharmacyDispense.kind: clinical`. Retail empty prescription lists do not collide with each other. Initial development indexes must match this current schema; issue returns 503 for an obsolete unscoped index instead of modifying it. Prepare current indexes through the existing development setup workflow. No live database/index action ran here.

### Shared readers and print

Clinical invoices still require Patient and Doctor. Clinical list/detail/payment routes exclude retail bills; clinical insurance and hosted payment-link lookups also reject retail IDs. Portal consumers cannot inherit counter customer access. Clinical billing exports remain clinical, avoiding fabricated patient labels. CRM appointment receipts still require actual appointment/patient evidence and are not triggered by unpaid issue.

Issued pharmacy documents freeze kind, actor, customer, source, amounts, calculation/tax and issue metadata. Model validation checks line/aggregate paise reconciliation, source IDs, positive quantities, version/currency and local tax mode. Later authorized settlement may update payment fields; correction through editing/deleting an issued bill is blocked. Source-bound returns/credits remain T19.

The existing pharmacy print component and shared print lifecycle accept committed version-2 snapshots without clinical IDs. They display captured issuer/recipient, number/date, units, real lots, printed expiry/MRP, tax, discounts already included in line totals and round-off. Missing actor/customer/calculation/lot evidence or inconsistent totals blocks print. Reprint never issues again or changes stock/money.

T20 additionally uses `documentVersion: 3` for explicit opening balance statements in the pharmacy payment aggregate. These are source-reviewed debts, with their own `O…` sequence and statement preview; they create no supply/tax/stock/clinical records. Retail supply and return readers use version 2. Customer collections against opening statements still use the same authoritative receipt ledger. See [the finance contract](pharmacy-finance.md).

T17 supplies collection, split/credit authority and confirmed receipt recovery. T15 supplies quote/cart/scanning UX; `counterSalesAvailable` follows current sales authority. T18 supplies broader print/recovery tools and real-device checks. Professional licensing/tax review and release gates remain required; legacy migration is outside current scope.

## Collections and uncertain outcomes

T17 is implemented locally. Cash, manually verified UPI/card and split collections settle existing pharmacy invoices through `Invoice.payments`. One append-only `InvoiceCollectionReceipt` groups the components, their actual operator/date and post-collection balances. It is a payment receipt, separate from the issued tax invoice. No appointment, patient or outbound clinical message is created to collect retail money.

### Authority and API

| Route | Contract |
| --- | --- |
| `POST /api/pharmacy/invoices/:id/collections` | Current staff/module/branch authority, `PHARMACY_COLLECT_PAYMENT` or organization-management grant, enabled pharmacy and a stable `Idempotency-Key`. Supports identified partials and complete settlement. |
| `POST /api/pharmacy/invoices/:id/pay` | Same validation, transaction, key protection and receipt as collections; requires the full remaining balance. |
| `GET /api/pharmacy/collection-operations/:key?locationId=…` | Current sales/history authority, branch and original operator; returns the immutable committed result. |
| `GET /api/pharmacy/invoices/:id/collections?locationId=…&cursor=…` | Scoped immutable receipt history, twenty groups per page, no automatic draining of pages. |

Responses are `no-store`. Consumer roles remain denied independently of permissions. Stock, clinical billing and selling grants alone do not collect money. `viewSales` lets authorized staff read prior receipts after pharmacy disable; `collect` blocks new commands while disabled and pins capability inside the transaction. Recovery reauthorizes current tenant/branch and the initiating actor before showing a saved result.

Strict input supplies location, expected payment revision/balance, `manualConfirmed: true`, cash tender in integer paise, and 1–10 components. Each component has a stable unique ID, positive integer paise and cash/UPI/card method. UPI/card require the actual received transfer/terminal reference. Client dates, actors, shifts, paid totals, provider status and unsupported methods are rejected. QR display, payment attempts or a transfer reference without explicit operator confirmation never mark a bill paid. This is manual staff evidence, not bank/provider verification.

### Money and integrity

`InvoicePaymentService` owns exact minor-unit balance checking and receipt mutation, reused by pharmacy collections and clinical full/partial payment. It rejects non-finite/fractional amounts, negative/corrupt balances, cancelled/refunded bills and overpayment by even one paise. Pharmacy commands additionally require the existing ledger to sum exactly to the recorded paid amount, unique operation identities and matching expected revision/balance. Histories are capped at 500 components per invoice with an explicit review response.

Components sum to the amount received. Cash tender must cover the cash allocation; the server computes change. Noncash-only collections require zero cash tender. Change is not another payment/refund event. Paid/balance/status use integer arithmetic, and each split component has a distinct ledger operation identity under its group, so the till can count methods without duplicate-receipt warnings. `Invoice.paymentMethod` is only a last-method projection; split groups use `other`, while canonical components retain their real methods.

An anonymous customer must settle the whole remaining balance in one command. An identified captured customer may make a partial payment; the rest remains an identified due. Credit itself is not a fake cash component or zero-value collection. T19/T20 now supply source credits, dues and confirmed refunds. Collection uses the exact net due after credit, while original incoming receipts remain unchanged and refunds use a separate outgoing ledger. Receipts capture credit applied at that collection. T20 customer opening dues use a clearly labelled version-3 balance statement in the same payment aggregate, without current supply/tax/stock facts; incoming collections still appear only in Invoice payments. A zero-value bill needs no money receipt.

The transaction writes invoice paid/balance/status/revision, ledger components, immutable receipt, required audit and encrypted command result with majority write concern. Stable receipt IDs and actual operator/date are captured. Collections require the current actor's active branch/currency drawer under the physical-drawer contract; invented shift IDs are rejected. A changed committed key conflicts. Same-key retry returns the original receipt, even after later collections, rather than rebuilding it from today's invoice state. Concurrent new keys cannot consume the same balance/revision. Audit failure rolls back the invoice and receipt together.

Collection has no stock effect. Neither a printer failure nor receipt re-read records more money. There is no automatic refund or supplier settlement. Provider-hosted payment workflows retain their separate verification protocol; this retail manual endpoint cannot impersonate a provider result.

### Clinical full-pay correction

The existing clinical `PUT /api/invoices/:id/pay` now requires a stable key and performs money, required audit and result capture in one transaction. It shares exact balance mutation with installments and cannot race another collection into overpayment. Its existing clinical/consumer ownership and supported-method checks remain. It also updates linked visit payment projections using the same helper as installments. The API client preserves the full-pay key across transport failure and token refresh; backend integration callers use explicit keys. Successful retry returns the captured result.

Clinical installment routes keep their current authority and response contracts while using the same exact-money primitive and retaining notes/references. Retail invoices remain excluded from those generic clinical routes. Patient checkout continues to use hosted/server-verified payment and never gets the pharmacy staff manual endpoint.

### Workspace and recovery

The existing pharmacy route adds Sales & collections for `viewSales` staff. Collection-only operators can enter without stock, EHR or purchase grants. Lists are bounded; the opened invoice shows current total/paid/balance, anonymous/identified customer status and saved receipts. Split lines require actual method evidence and an explicit confirmation checkbox.

Before sending, the UI stores only an opaque reference and invoice ID under account/organization/impersonation/branch scope in session storage. Permission changes clear private forms while retaining the opaque owner reference; every recovery reauthorizes current grants. Storage failure prevents dispatch. Submitted money stays frozen in memory for exact same-key retry. Reload offers result lookup and re-entry of original details under that same reference. Definite validation/conflict responses can permit correction under the same identity; a committed changed payload still conflicts server-side.

Confirmed results remain visible until acknowledgement clears the matching reference. Missing or malformed amounts/evidence never become a displayed receipt. Branch/account changes unmount forms, clear displayed data and ignore late results; they preserve the original scope's recovery reference. No customer/payment body is persisted in browser storage. Use committed-document reprint and uncertain-reference review without issuing another bill or recording another payment.

## Source-bound sales returns

T19 adds returns for captured version-2 counter invoices through the existing pharmacy workspace. Source quantities, units, lots, selling prices, discounts, tax components and invoice totals come from the issued Invoice/PharmacyDispense records. Return and financial approval grants are independent; committing requires both current grants, branch authority and a stable command reference. The actual approving operator and review reference are captured. Patient/family/guest access is denied independently of grants.

| Route | Behavior |
| --- | --- |
| `GET /api/pharmacy/return-invoices?locationId=…&invoiceNumber=…&cursor=…` | Exact optional number filter; 25 scoped retail invoices per page. |
| `GET /api/pharmacy/invoices/:id/return-source?locationId=…` | Original sold lots, already-returned and remaining quantities, credit/due/refund-payable projections and saved credit identities. No acquisition-cost projection. |
| `POST /api/pharmacy/invoices/:id/returns/quote` | Read-only review of requested source lots, actual condition, reason, approval reference and confirmed physical quarantine. |
| `POST /api/pharmacy/invoices/:id/returns` | Both grants; confirmed return/payment revisions and credit; atomic quarantine, source-bound return, numbered credit note, due projection, required audit and command result. |
| `GET /api/pharmacy/return-operations/:key?locationId=…` | Current history authority, original actor and branch; original committed result. |
| `GET /api/pharmacy/returns/:id?locationId=…` | Authorized immutable return and captured credit-note document for preview/reprint. |

`source-credit-paise-v1` reverses captured amounts without looking up current catalogue rates. Each issued line's captured base/CGST/SGST is allocated to its original lots by actual selling-value weight, using stable remainders. Original payable, including explicit rounding, is allocated to those captured gross values (quantity weight only for a zero-gross document with explicit positive rounding). Each lot's cumulative returned quantity releases an exact cumulative fraction of its captured components. Repeated partial returns sum to the original full credit and cannot exceed any source quantity or payable. Component allocation/rounding remains visible; professional review is required before tax adjustment.

An append-only `PharmacyReturn` links each actual source line/lot to a new quarantined MedicineBatch. The lot retains the original unit/printed-expiry/MRP and rational acquisition-cost basis, with actual returned received quantity and explicit return provenance. The physical aggregate and stock revision increase with an append-only `quarantine_return` movement. FEFO excludes quarantine; count corrections cannot release these lots. Saleable stock and physical stock are distinct. Condition (including opened, damaged, expired or unknown) is recorded without assuming resale suitability. Release/disposal requires its own reviewed disposition workflow.

An append-only `InvoiceCreditNote` uses a separate bounded branch/FY sequence and freezes issuer/customer/source issue evidence. The original bill's supply/tax/total fields remain immutable. Only operational credit/return/payment revisions and balance change. Credits first reduce outstanding; excess against actual receipts becomes a **refund payable**, never proof of a refund. T20 provides confirmed payout/settlement events. Receipt/till history still records actual money received. A zero-money invoice settled entirely by credit does not become a till receipt. Subsequent collections use the exact net due and capture credit applied at that receipt; prior receipts remain unchanged.

Return/credit/history ledgers are checked together before another return. Review is bounded to 1,000 prior returns and 1,000 source-lot rows; each command accepts at most 100 distinct source lots. Concurrent different-key attempts serialize on source/stock revisions; same-key replay returns the original result. A later audit or line failure rolls back all lots, stock, credits, numbers and projections. Authorized corrections remain available after the pharmacy capability is disabled. No application request drops or rebuilds indexes.

The UI retains uncertain commands under an opaque session reference scoped to account/organization/impersonation/branch. It requires actual quarantine/approval evidence, displays server credit before explicit post, freezes retries, recovers after reload and clears private branch state. Saved commercial credit notes preview/reprint from authorized committed DTOs without stock or money mutations. These notes explicitly require professional tax-adjustment review; they do not claim statutory filing or a confirmed payout. Clinical supplies without this retail source contract retain their existing workflow.

Synthetic tests cover concurrency, over-return, original rational costs, unequal prices/odd paise/rounding, fully credited unpaid bills, paid refund payables, collection after credit, immutable facts, current grants, disabled-capability continuity, scope, audit rollback, quarantine exclusion, reload/retry and saved credit-note printing. Actual professional review and device/release evidence remain T26.

## Supplier settlements and opening dues

T20 adds source-bound supplier returns, actual supplier credit/payment/refund records, customer refund payouts and reviewed opening dues to the existing pharmacy workspace. All commands use current staff/organization/branch authority, strict numeric paise, required audit, replica-set transactions, stable keys and original-result recovery. No provider or banking call is made by these manual workflows.

### Source-receipt supplier returns

Purchase return review reads only posted purchases and their actual received lots. Source receipt quantities, on-hand stock, captured units/expiry and prior returns cap each selection. A committed return deducts the actual owned lot and physical aggregate, appends a `supplier_return` movement and an immutable `PharmacyPurchaseReturn`, and increments the purchase settlement revision. It preserves the original posted payable. Expected credit uses captured payable allocations, including free-unit cost allocation and final paise/rounding; it is an expectation until actual supplier note evidence arrives.

| Route | Contract |
| --- | --- |
| `GET /api/pharmacy/purchases/:id/return-source?locationId=…` | Current purchasing/history grant; bounded received lots, on-hand/returned/remaining quantities and source revisions. |
| `POST /api/pharmacy/purchases/:id/returns/quote` | Purchasing plus return grant; read-only actual source/reason/reference review. |
| `POST /api/pharmacy/purchases/:id/returns` | Same grants, confirmed source/stock/settlement revisions and expected credit; one stock effect. |
| `GET /api/pharmacy/purchase-return-operations/:key?locationId=…` | Current purchasing history and original actor; original committed result. |

### Actual credit and money events

`PharmacyCashEvent` is append-only and carries actual actor, recording time, reference, method, currency, kind, direction and source allocations. Actual supplier credits have direction `none`; supplier payments/customer refunds have direction `out`; supplier refunds received have direction `in`. A supplier credit is documentary evidence rather than a cash receipt. All commands require explicit actual confirmation and a review reference. They do not infer success from a payment attempt, QR display or provider status.

`POST /api/pharmacy/settlements/:kind` supports `supplier-credit`, `supplier-payment`, `supplier-refund` and `customer-refund`. Financial approval is required; supplier commands additionally require purchasing-source authority. Actual normalized document/payment references are unique per organization, kind, party and financial year. One actual supplier payment or note can allocate to multiple supported sources in the same branch, up to 100 distinct allocations, whose sum must exactly equal the actual amount.

Supplier credits allocate actual dated note amounts against remaining expected purchase-return credit, or a reviewed supplier opening obligation. A partial note leaves the rest pending. Payments cannot exceed each source's current due; refunds received cannot exceed its actual credit/overpayment receivable. Source revisions serialize concurrent different-key attempts. Supplier balances reconcile as opening + posted bills − confirmed credits − payments + refunds received. Outstanding liabilities and supplier refund receivables remain separate per source; pending expected credit does not reduce a payable.

Customer credits first reduce the original invoice due. Excess against actual receipts becomes a refund payable. Confirmed payouts are capped against that source, increment its payment revision and `refundedPaise`, and create one outgoing event. Original issued amounts, tax facts and incoming `Invoice.payments` remain unchanged. Later returns account for refunds already paid. No fake appointment, patient, doctor, incoming receipt or automatic payment reversal is created.

`GET /api/pharmacy/cash-operations/:key?locationId=…` reauthorizes current source-history authority and the original actor before returning the original result. `GET /api/pharmacy/invoices/:id/refund-source`, `/suppliers/:id/statement` and `/customers/:id/statement` expose exact source balances. Party and refund-bill lookups are branch-scoped and limited to 25 rows per page; full statement review is capped at 1,000 obligations and 10,000 events. The UI renders statement/lot/allocation pages in groups of 25.

### Reviewed opening dues

Organization management can explicitly record an actual dated positive customer/supplier debt using `POST /api/pharmacy/opening-balances`. It requires an active matching party at the expected revision, actual source/reference, review and confirmation. The source is immutable and recoverable through `/opening-balance-operations/:key`; `/opening-balances/:id` reauthorizes its history. No historical migration/backfill or live import runs automatically.

Supplier opening obligations remain separate from purchases, with their own source identity and settlement revision. Actual payments, notes and refunds allocate to that source without fabricating a supplier invoice or stock receipt.

Customer opening dues use an explicit **opening balance statement**, `documentVersion: 3`, in the shared Invoice payment aggregate. It has a separate `O…` sequence, captured party/issuer/source, no items, no tax document/calculation and no stock/clinical source. It records no current supply or turnover. This lets actual incoming collections stay in `Invoice.payments`, including partial receipts, without a duplicate cash-event ledger. Opening statements preview/print with their own title and source facts. Their payment receipts are separate documents. Retail tax/sales/return readers use their actual supply contract; clinical readers continue excluding pharmacy records. Future pharmacy turnover reports must distinguish version-2 supplies from version-3 opening statements.

### Workspace and recovery

**Finance & dues** offers supplier statements/returns/settlements, customer dues/refunds and owner-reviewed opening records. It honors each independent source, collection and approval grant. Authorized history, source corrections and settlement payouts remain available after pharmacy capability disable; new opening debts require enabled capability. Commercial expiry continuity is finalized by T23.

One uncertain finance command is retained per operator/organization/impersonation/branch using only opaque kind/source/key metadata in session storage. The submitted body stays in memory and retries identically. Storage failure blocks dispatch; an unresolved result cannot be silently replaced. Reload permits current-authority recovery or re-entry under the original key. Permission changes clear private forms while retaining the opaque identity; accounts, organizations, impersonation and branches remain separate. The same identity-only reference policy now covers counter sales, collections and sales returns. Confirmed results require matching branch/source/key and exact event allocations before the UI acknowledges them.

T30's existing daily collection report remains a **gross incoming-receipt** report: credits are not money received, and payouts never rewrite receipts. T21 uses the new event directions/methods to compute drawer cash and closing. Financial/tax source evidence and commercial credit notes do not assert professional tax-filing approval or bank/provider verification. Real operational, device, professional and release evidence remains T26.

## Physical cash drawers

T21 is implemented locally, reviewed on 21 October 2026. No live drawer, cash count, provider settlement, index setup, printer certification or deployment was performed.

`CashierShift.kind = drawer` records an actual owned drawer session. Opening captures the organization/branch, cashier identity, physical drawer code, currency, location timezone, server start time and counted opening float. One active session is permitted per branch/drawer code and per branch/cashier. Transactions serialize opening uniqueness even before initial indexes are prepared; schema indexes enforce those identities as well. No receipt is assigned to an operator or drawer by guessing dates or names.

New pharmacy collections and actual supplier/customer money events require the actor's active drawer in the same branch and currency. `Invoice.payments` remains the incoming receipt ledger. Its components, immutable collection receipts and actual `PharmacyCashEvent` movements carry the drawer reference. Supplier credit documents, expected credits, stock returns and opening debts do not create cash. Generic clinical full-pay, installments and consolidated checkout capture the actor's active drawer when present; current clinical operations without an active drawer remain usable and their unassigned receipts stay visible in the gross branch report.

The exact physical cash equation is:

`opening float + assigned cash collections + cash inflows - cash outflows = expected cash`

UPI, card and other methods have separate incoming/outgoing totals. Cash change is already excluded from the collected amount; tender is not counted again. A cash movement that would make recorded physical cash negative fails atomically. A pending refund is a liability, and only its confirmed payout changes cash. Post-close refunds require a new active drawer and leave the original closing snapshot unchanged.

Each money command advances the same drawer revision inside its transaction. Closing uses the reviewed revision and writes that same record, so a payment or movement racing close either commits before a refreshed close or rolls back. A closed drawer cannot accept new postings or a second close. Opening facts and closed snapshots cannot be edited, replaced or deleted through model mutation APIs. The immutable close stores counted cash, variance/reason, owner and actual closer, handover notes, cutoff, method totals, source receipt/movement evidence and a checksum. Saved close reads verify the checksum; it is integrity evidence, not a professional signature or bank confirmation.

Opening, cash in/out and closing require stable idempotency keys. Reservation, result capture, drawer/financial writes and required audit share a majority-write replica-set transaction. Same-key replay/recovery returns the original actor-bound encrypted result, even after later changes. A changed command under a committed key conflicts. Required audit failure rolls back the drawer, receipt/event and reservation. The browser retains only the opaque key, operation kind and drawer ID; money details stay in memory. Unknown outcomes retain the reference and offer original-result lookup and identical retry. Authorization changes clear private UI state while preserving that opaque identity.

The pharmacy workspace includes **Cash drawer**, collection/payout readiness checks, bounded history, current source refresh, counted closing and saved-close printing. Server checks remain authoritative if another window closes a drawer after preflight. A print failure never repeats a financial command. Generic billing uses the same component through its **Physical cash drawer** tool.

Pharmacy endpoints are `GET /api/pharmacy/till`, `GET /till/history`, `GET /till/:id`, `POST /till/open`, `POST /till/:id/close`, `POST /till/:id/movements` and `GET /till-operations/:key`. The equivalent billing endpoints use `/api/billing/till/drawers` and `/api/billing/till/drawer-operations/:key`. Billing requires current `MANAGE_BILLING`; pharmacy requires its granular grants and does not grant clinical finance access. Drawer reads accept close/collection/refund/report grants; opening accepts close/collection/refund grants; closing requires `PHARMACY_CLOSE_TILL`; cash movements accept close/refund grants. `MANAGE_ORGANIZATION` and root can also perform those pharmacy actions. Only organization management/root may inspect or hand over another cashier's drawer; owner and closer remain distinct. Branch, staff and module checks apply. Existing-record corrections and drawer handover remain available after pharmacy capability disable while the branch is active.

History pages contain at most 25 sessions. An active drawer supports 1,000 posting commands, bounded to 1,000 contributing invoices, 1,000 events and 10,000 receipt components. Further money posting requests an explicit close/reopen; closing remains available at the posting limit. Reads are explicit or mount/source refreshes, without background polling. An interval can span local midnight; actual tagged receipt times determine evidence, and opening business date is retained.

The existing `/api/billing/till/summary`, `/close` and `/history` remain **daily gross receipt reports**. Their `CashierShift.kind` is `receipt_report`; physical drawers never appear as the latest daily report. Saving a report now requires a stable key and deduplicates the same report command. Separate deliberately requested as-of reports are valid. These reports do not close a drawer or include float/refunds/payouts in gross collections. Current billing labels and print previews make that scope explicit. No hypothetical legacy migration or backfill is required.

## Daily receipt reports

T17 now writes pharmacy collections into the same `Invoice.payments` authority. Split components retain distinct method/operation identities under one immutable receipt group. Till totals include the net cash allocation, UPI and card separately; tender/change does not inflate collections. Group receipt IDs and actual actors are captured. Full shift/drawer association remains T21. See [the collection contract](pharmacy-finance.md#collections-and-uncertain-outcomes).

Implemented locally on 20 October 2026; not deployed. Existing summary, close and history URLs remain. This corrects the daily collection basis; physical drawers, opening float, payouts/refunds and concurrent closing are implemented separately in the physical-drawer chapter.

### Calculation

The summary and close route share `TillCollectionService`. Committed `Invoice.payments` entries provide the collection amount, method and `paidAt`. Partially paid invoices contribute actual installments. A bill created earlier can contribute today's receipt; a later edit or current invoice payment method cannot move an earlier receipt. Neither `updatedAt` nor invoice creation time is collection evidence.

The report uses the location timezone, then organization timezone, then the existing Asia/Kolkata fallback. Local calendar-day boundaries use the existing time utility, including 23/25-hour DST days. The response records the day interval, timezone, currency and `asOf` cutoff. A receipt posted after the cutoff appears in a later calculation; it does not make an earlier snapshot erroneous or become a future-date warning merely because it arrived during the read.

Amounts are validated and summed as integer minor units, with no guessed rounding of unsupported precision. Cash, UPI/QR, card/POS and other payments are separate. Online payment is **other**, not assumed UPI. The organization supplies the report currency. Explicit unlike invoice currencies are excluded and flagged; missing currency on legacy clinical bills follows the configured organization currency and must be reviewed during historical reconciliation if that currency has changed.

`invoiceCount` now means distinct bills contributing collections, including partially paid bills. `receiptCount` counts contributing receipt entries and supported legacy payment records. `legacyReceiptCount` identifies the compatibility subset. Zero-fee/courtesy waivers contribute no money or receipt count.

### Historical payment compatibility and reconciliation

A bill without any receipt entries can contribute one labelled compatibility payment only when its status is paid, its positive recorded `amountPaid` equals its recorded total, and its actual `paymentDate` and payment method are known. No amount is inferred from the invoice total alone. No synthetic receipt is persisted. If any receipt rows exist, invoice-level fields never fill missing rows, dates, methods or residual amounts.

Incomplete legacy evidence, missing/invalid receipt dates or amounts, duplicate explicit receipt identities, unknown payment methods, future-dated evidence, mismatched paid balances and unlike currencies produce reconciliation issues. Valid posted gross receipts may still appear beside an issue; uncertain amounts are excluded. Unknown-dated evidence is not assigned to the requested day and remains a review issue. Issues are deduplicated by bill/reason and the response lists at most 20 examples; the branch candidate query stops rather than silently truncating more than 10,000 records.

Current refunded/cancelled/deleted status does not erase an actual incoming receipt or invent a refund date. Those receipts remain gross collections with a reversal/reconciliation issue. This report does not subtract a presumed refund or cash payout. T20/T21 introduce the actual outflow semantics. Till close returns `409` while reconciliation is required, preventing an apparently balanced snapshot built from uncertain evidence. There is no automatic data repair or review override in T30.

Ordinary invoice reads remain organization- and location-scoped. An existence-only, explicitly location-scoped check also detects unassigned historical payment evidence at that authorized branch. It excludes that evidence from tenant totals and reports only a generic ownership issue, without exposing the bill's ID/number or assigning ownership. Explicitly foreign-owned invoices are not included. Real identity reconciliation is T25.

### Existing endpoints and saved reports

`GET /api/billing/till/summary?locationId=<id>&date=YYYY-MM-DD` returns the existing `systemTotals` and `latestShift` plus:

- `collectionBasis: receipt_v1`, `timezone`, `currency`, `asOf`, `periodStart`, `periodEnd`;
- `systemTotals.receiptCount` and `legacyReceiptCount`;
- `reconciliation.requiresReview`, `issueCount`, bounded `issues` and `truncated`.

The date defaults to the location's current business day. Invalid dates are rejected. All till endpoints use `Cache-Control: no-store`, billing management permission and current staff/branch authority. Consumers cannot use till reports even if they have been granted a billing permission. Foreign or ungranted locations retain the shared hidden-location denial behavior.

`POST /api/billing/till/close` retains `locationId`, numeric `actualCashCounted`, optional `varianceReason` and `handoverNotes`. The server recomputes today's totals. Counted cash must be finite, nonnegative, bounded and have at most two decimal places. A nonzero difference needs the operator's actual explanation. Submitted totals or dates do not control the report.

Saved daily `CashierShift` receipt reports include the receipt basis, currency/timezone, cutoff/day interval and receipt counts alongside their existing fields. Report creation and required audit share a replica-set transaction; audit failure leaves no report. T21 adds stable-key report saving and explicitly separates `kind: receipt_report` from owned `kind: drawer` sessions. A gross daily receipt report does not close a physical drawer. See [the implemented physical drawer lifecycle](pharmacy-finance.md#physical-cash-drawers) for opening float, actual payouts/refunds, concurrent closing and saved evidence.

`GET /api/billing/till/history` retains saved values, with a validated limit of 1–100. Historical snapshots without a basis marker are presented as `legacy_invoice_totals`; no stored date, total or cashier is rewritten or recomputed. The billing screen labels old reports and prints their saved values independently of the live summary. New reports use receipt terminology, captured currency and timezone. Reconciliation warnings disable close in the screen and are independently enforced by the server.

No migration, index maintenance, live report closure, bank/provider reconciliation, real cash count, printer validation or deployment ran as local verification. Reconciliation tooling, full release checks and operational approval remain required before production activation.

## Bounded reports and exports

T22 is implemented locally, reviewed on 21 October 2026. No live data, export, schema/index setup, production deployment or professional tax/accounting approval was performed.

The pharmacy workspace has **Reports & exports**. Its server catalogue lists only currently authorized sources. Fifteen reports share bounded readers and explicit definitions:

| Report | Source and meaning |
| --- | --- |
| Stock / low saleable stock | Current product aggregate reconciled against captured, owned lots and current units. Eligible quantity excludes expired, depleted and quarantined stock. Low stock uses the product threshold, defaulting to 20 base units. Unknown units or reconciliation appear for review rather than as zero eligible stock. |
| Expiry | Positive on-hand lots whose exclusive captured cutoff is within the selected elapsed-day window, including already expired and quarantined lots. Printed day/month precision is retained. Depleted/zero-quantity lots are excluded. |
| Captured stock cost | Physical held lots, including expired/quarantined stock. Exact remaining cost numerator and denominator are retained. Each lot is floored separately to whole paise for display; unknown cost stays unknown, including its page subtotal. This does not choose an accounting valuation or write-down policy. |
| Stock without recent supply | Positive on-hand with a held receipt at least the chosen number of elapsed days old and no pharmacy dispense movement in that interval. Old never-supplied stock qualifies; new stock does not. This is an explicit inactivity rule, not an inferred sale or turnover calculation. |
| Movements | Append-only physical before/change/after quantities, disposition and source revision by recorded time. Unlike product units are never summed. |
| Posted supplier bills | Captured original obligations by posting time, separate from delivery and payment. |
| Original pharmacy supplies | Original patient-optional pharmacy bills by issue time. Opening debts are excluded. Paid, credited, due and refunded columns are lifetime-to-read balances, not period cash flows. Existing clinical finance remains separate. |
| Actual pharmacy collections | Immutable receipt components by actual collection time, checked against their owned invoice's component, amount, method, actor, drawer, reference and timestamp. Includes opening-debt collections. Cash is already net of change; incoming money is not duplicated in cash events. |
| Customer return credits | Original source-bound commercial credits and captured tax components. Physical stock remains quarantined; actual payouts and professional tax adjustment remain separate. |
| Supplier goods returns | Physical returns and expected credit by return time. Expected credit is not confirmed credit or money received. |
| Supplier dues | Current original obligation less confirmed credits/payments plus actual supplier refunds. Expected credit remains pending. Posted bills are paged first, then reviewed supplier opening dues; both phases are explicitly identified. |
| Customer dues / refund payable | Current invoice and opening-debt balances, including remaining refund liability. Actual payout totals are cross-checked against immutable refund events. |
| Captured supply tax | Captured original supply calculation; opening debt is excluded and missing evidence is not repriced. Commercial credit review is separate. This is not a GST filing or automatic tax adjustment. |
| Cash events / supplier documents | Actual pharmacy cash in/out, supplier/customer money movements and supplier credit documents. Direction `none` contributes zero cash. Separate inflow/outflow subtotals avoid summing documentary credit into cash. Source financial grants filter supplier/customer event kinds. |

`GET /api/pharmacy/reports?locationId=...` returns the allowed catalogue. `GET /api/pharmacy/reports/:kind` returns a source page, definitions, columns, rows, current read timestamp, location timezone, reviewed digest and **page-only** monetary subtotals. No page is presented as a full-store total. Different pages are independent live snapshots. Filtered empty source pages may have a continuation and do not mean the whole branch has no matches.

Period reports accept both local calendar dates, at most 93 inclusive days, defaulting to the branch's last 30 days. Future end dates are rejected. Current stock and dues reports reject historical date filters; they do not reconstruct historical balances. Expiry/inactivity use an explicit 1–365 elapsed-day window. Source page size is 1–25, without offset pagination or unbounded totals. Related lot/payment/event reads are capped at 2,000 records, output at 500 rows, and source queries at five seconds; exceeding a bound requests a narrower page/period rather than returning a partial success. Stock receipt components and supplier allocations retain their existing per-document caps.

The stock/expiry alert panel uses the same readers through `GET /api/pharmacy/stock-alerts/low_stock` and `/expiry`. These require stock access without a report or paid analytics prerequisite. Only the selected alert category loads; refresh and cursor navigation are explicit. Its source-page counts, current source lookup for restocking, unknown-eligibility warning and captured expiry precision are independent of the visible catalogue page. Changing branch or authorization clears alert state and aborts replaceable reads. The existing quick `/api/pharmacy/expiring` list remains usable for at most 100 positive on-hand active/expired lots; larger results explicitly direct the operator to pagination. Quick expiry and batch readers hide both per-unit and rational acquisition costs without cost authority. The quick reader permits 0–36,500 days within its 100-lot cap, while new alert/report windows use the narrower contract above. No historical backfill is introduced.

Report access requires `PHARMACY_VIEW_REPORTS` or organization management/root, plus the corresponding stock, cost, purchase, sales, returns or settlement authority. Valuation requires independent cost access. Report-only staff can review permitted movement data without stock, patient-directory, EHR or generic clinical billing access. Consumer roles are denied even if assigned named grants. Branch/tenant/module checks and live role lookup still apply after pharmacy capability disable. Reports do not require the paid analytics module.

Shared physical drawers can contain authorized clinical and pharmacy activity. Actual cash events capture their command's `billing` or `pharmacy` domain; pharmacy cash reports exclude billing-origin movements. Shared drawer reconciliation continues to include all physically assigned money. This preserves clinical financial boundaries without guessing old ownership or creating duplicate balances.

`GET /api/pharmacy/reports/:kind/export` requires the reviewed page digest. It repeats authorization and the bounded source read, then rejects changed projections/cursors/filters before export. The audit and export preparation use a majority-write transaction; audit failure returns no CSV. Each CSV row includes source ID, report/branch/currency/timezone, read time, dates, definition and review digest. Export covers the reviewed page, not the entire branch. The UI preserves the original reviewed rows on failure and asks for a refresh/review when the source changes. No patient contact details, source clinical records, arbitrary requested columns or hidden acquisition fields are projected.

Text cells neutralize spreadsheet formula prefixes, including leading whitespace, hidden controls and formatting characters. Quotes, commas, CR and LF are escaped. Monetary and movement numbers come from validated integer values; CSV monetary rendering and large UI paise values avoid floating-point cent loss. Browser download checks content type and the returned review digest. CORS exposes that digest to existing allowed origins and permits the existing stable idempotency request header; the origin allowlist is unchanged. Export/alert reads use `Cache-Control: no-store`.

The synthetic query review used 322 mixed-tenant products: the catalogue source query returned 26 records, examined 161 documents/keys and took 3 ms in that run. The source reader performed one bounded product query and one bounded related-lot query. Existing indexes were used; no additional report index was added. This is local fixture evidence, not an unlimited-volume or production latency claim. Full release gates, representative pilot sizing, real browser/device checks and professional accounting/tax evidence remain T26 release work.
