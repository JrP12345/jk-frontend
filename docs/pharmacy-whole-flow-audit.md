# Whole pharmacy audit and clinic/hospital safeguards

**Reviewed:** 11 November 2026. **Scope:** current frontend and sibling backend source, existing contracts and test files. This is an audit and proposed work list, not an implementation or production approval. No application code, account, database, stock, invoice or payment was changed in this audit. No live database/provider/hardware checks or new test runs were performed.

This covers the pharmacy journeys visible in the repository. It cannot establish that every possible runtime defect has been found. Previously fixed counter-access and UI issues are identified separately so they are not presented as new defects.

## Main finding

There is a substantial working pharmacy backend. The biggest remaining problems are the connection between its workflows and the UI: physical versus saleable stock, losing counter state when changing tools, missing batch/count tools, incomplete sell-readiness guidance, and permissions that combine reading with operational powers.

Use the same pharmacy inventory and financial services for standalone pharmacies and pharmacy departments inside clinics/hospitals. A standalone pharmacy needs its own presentation and onboarding, not a second stock or invoice implementation.

## Priority and evidence

- **P1:** address before depending on the affected workflow for routine store operations.
- **P2:** workflow, usability, accessibility or maintainability improvement.
- **Defect:** source shows conflicting behavior or misleading presentation.
- **Gap:** a useful screen or capability is not built; this does not mean the existing guard is faulty.
- **Limit:** intentionally unsupported scope; keep it blocked until its own workflow exists.

The findings below are source findings. Proposed fixes and acceptance checks have not been implemented by this audit.

## 1. Stock, branch and sales correctness

| ID | Priority/type | Current issue and evidence | Proposed fix without changing clinical contracts |
| --- | --- | --- | --- |
| A01 | P1 / workflow gap | **Counter carts do not survive switching tools.** Active lines and up to three held carts are component state. The UI explicitly says held carts clear when leaving the tab. Shared Tabs renders only the active content, so opening Cash drawer can discard the cart. The pending command reference survives separately; it is not a saved cart. [Counter][counter], [Tabs][tabs] | Keep the counter draft in pharmacy-local state scoped to account, organization and branch. Preserve it across pharmacy tool switches; clear it on logout, scope/permission changes or explicit discard. Requote before issue. Do not globally change Tabs or silently store customer/cart data in persistent browser storage. |
| A02 | P1 / defect | **Two branch selectors can disagree.** The pharmacy selector updates local `choice`, while the dashboard selector reads the location store. Changing the page selector does not update that store. The API still uses the explicit page branch; this finding is a confusing context mismatch, not proof of a cross-branch write. [Workspace][workspace], [location store][locations], [dashboard layout][layout] | Establish one branch-selection contract, or clearly label a local override. Guard an unsaved draft before changing branch. Keep server branch checks; an All locations selection must never authorize a stock or financial write. |
| A03 | P1 / defect | **Counter search calls physical stock “available.”** Search returns `Medicine.stockQuantity`; the UI prints that number as available. The quote service excludes expired, quarantined and empty lots. A product can therefore appear available and fail the quote. [Counter][counter], [sales lookup][sales], [quote service][quote] | Show separate physical and eligible quantities, or label the existing number Physical stock and show availability as checked at quote. Add a bounded eligible-stock projection if an accurate saleable figure is required. Do not weaken FEFO or quote validation. |
| A04 | P1 / defect | **Inventory filters and Alerts use different stock meanings.** Inventory Low/Out filters use aggregate stock; Expired uses catalogue `expiryDate`. Alerts uses eligible quantities and captured lot cutoffs. A new product can have expired lots without a catalogue expiry, or physical stock with no saleable stock. [Workspace][workspace], [medicine controller][medicine], [Alerts][alerts] | Define clearly named Physical stock and Saleable stock views. Make expiry filters lot-aware or route users to the existing lot-based Alerts. Keep quantity/expiry checks in both clinical dispensing and retail issue. |
| A05 | P1 / UI gap | **A proper product batch-detail screen is not built.** The main table shows catalogue batch/expiry, often blank for products received through captured lots. Product actions expose Add batch, Review product, Edit and Delete; no batch-detail view is wired there. A batch-read API already exists. [Workspace][workspace], [pharmacy routes][routes] | Add View batches showing printed batch, lot identity, expiry, status, quantity, selling price and authorized cost. Do not replace genuine repeated receipts sharing one printed batch with one merged batch record. |
| A06 | P1 / UI gap | **Physical count adjustment and product movement-history tools are not wired into the workspace.** The backend has adjustment and movement-history endpoints, but the product menu has no corresponding actions. Stock quantity is correctly read-only in Edit medicine. A dedicated quarantine/disposal management UI is also not built in this workspace. [Workspace][workspace], [pharmacy routes][routes] | Add permission-gated Count stock and Movement history tools using existing expected quantity/revision commands. Keep reason, audit, operation key and recovery. Design any disposition/release tool separately; never turn quantity editing into a shortcut that makes quarantined goods saleable. |
| A07 | P1 / workflow gap | **Receiving stock does not establish that it can be sold.** Receipt MRP is optional in the form, while ordinary counter issue requires MRP on selected lots. Units, sale review, tax review, issuer compatibility and captured lot evidence also have separate checks. [Receipt form][receipts], [product review][review], [quote service][quote] | Show a per-product Ready for counter sale checklist and the exact missing requirement. Require or flag MRP for stock intended for ordinary counter sales while preserving other supported receipt uses. Do not invent tax, licence or classification evidence. |
| A08 | P2 / defect in presentation | **“Retail” is the catalogue price, not necessarily the issued price.** Captured receipts store their own selling prices and do not update `Medicine.price`; quotes use actual FEFO lot prices. One product may legitimately have several current prices. [Workspace][workspace], [receipt service][receipt-service], [quote service][quote] | Rename this Default catalogue price or show a clearly sourced lot-price range. Keep the reviewed quote as the issued price authority; do not rewrite old lots or bills after a catalogue edit. |

## 2. Setup and access

| ID | Priority/type | Current issue and evidence | Proposed fix without changing clinical contracts |
| --- | --- | --- | --- |
| A09 | P1 / permission gap | **A financial read-only role is not fully separable from operational powers.** `viewSales` comes from Sell/Collect; `viewPurchases` comes from Purchase; financial reports additionally require those source grants. A report reader can need a permission that also authorizes business operations. [Permission map][grants], [report authority][report-service] | Add explicit read permissions for the relevant sales/purchase/finance sources. Keep write grants independent and branch-scoped. Test clinic pharmacy roles as well as standalone roles; do not remove built-in clinical permissions merely to simplify retail screens. |
| A10 | P1 / optional privacy gap | **Cashier-private invoice history is not built.** Sales & collections reads shared invoices for the authorized branch. The new counter-only role hides management tools but does not restrict history to invoices issued by that operator. [Sales controller][sales], [counter access review][access-review] | If the owner needs this policy, add an explicit own-sales/all-sales contract for list, detail, recovery, receipts and prints. Preserve supervisor reconciliation and legitimate collection by another authorized cashier. Never add a blanket owner filter to generic clinical invoices. |
| A11 | P1 / product gap | **Standalone external-prescription dispensing is not built.** Standalone pharmacy capabilities disable the connected clinical queue/dispense actions. Ordinary counter issue accepts only reviewed general products. Existing quantity/partial-fill contracts do not support external prescriptions/repeats. [Capabilities][capability-service], [quote service][quote], [dispensing contract][dispensing-doc] | Make this scope visible before onboarding a store that needs prescription sales. Build a separate reviewed external-prescription journey if required. Preserve the existing clinic/hospital encounter, signed-note, prescription quantity, register and restricted-supply checks. Never classify a restricted medicine as general to get it through checkout. |
| A12 | P2 / workflow gap | **The setup checklist stops before operational readiness.** It checks branch/contact, module, issuer, enabled/commercial access and administrator security. It explicitly does not verify staff permissions, product readiness, opening lots or drawer preparation. [Setup checklist][setup] | Add a separate operational section with evidence-backed states and direct actions. Name the current stage Branch setup rather than implying the whole pharmacy is ready. A missing operational check should not be represented as Complete. |
| A13 | P2 / workflow gap | **Product configuration is split across several screens.** Edit medicine handles units/codes, Review product has separate sale/tax saves, and receiving captures lot evidence. A successful review does not repair existing lot snapshots or create stock. [Workspace][workspace], [product review][review], [receipt service][receipt-service] | Present a guided sequence with saved status for each step and a safe preview of the next action. Retain separate reviewed writes and revisions. Do not replace them with one unreviewed “Approve everything” action. |
| A14 | P2 / workflow gap | **Creating a recorded customer is buried under Purchases.** Counter search can select an existing customer or use Walk-in, but Add supplier / customer is in the purchase/party workflow. Sales-only staff cannot create a new recorded customer there. [Counter][counter], [Purchases][purchases] | Add a clear owner customer-management entry. If cashiers should create customers, add a narrow pharmacy-customer permission and minimal form. Keep these records separate from clinical Patient records; do not grant generic patient-management access to solve a retail task. |

## 3. Daily operation and recovery

| ID | Priority/type | Current issue and evidence | Proposed fix without changing clinical contracts |
| --- | --- | --- | --- |
| A15 | P2 / workflow gap | **Invoice lookup is too limited for daily till use.** Sales & collections has First/Next paging but no invoice/customer/date/payment-status search. The API orders by ascending ID, so the first page is not a latest-sales view. [Collections][collections], [sales controller][sales] | Add bounded server filters and a clear latest/oldest order. Preserve cursor consistency and branch authority. Do not fetch the whole ledger and filter it in the browser. |
| A16 | P2 / workflow risk | **Starting another sale is offered before payment is settled.** After invoice issue, Start a separate sale is immediately available. The bill correctly remains unpaid, but a rushed operator can leave collection unfinished. [Counter][counter] | Show the authoritative outstanding amount and make the transition explicit, especially for walk-in bills. Offer Collect payment and Return to saved bill. Do not silently mark a sale paid or forbid legitimate recovery/manager workflows. |
| A17 | P2 / workflow gap | **A pending reference is not a recoverable draft.** Sale keys are in session storage while the frozen issue body is only in memory. After reload the UI requires original details to be re-entered if no result can be recovered. Other operation tools have their own separate reference UI. [Counter][counter], [sale recovery][recovery], [purchase operations][purchase-operations] | Add a pharmacy-local pending-operation list with operation type, branch, reference and allowed recovery action. Keep original idempotency keys and fail closed on uncertain outcomes. Any saved draft body needs an explicit storage/privacy design; it must not be treated as an already committed sale. |
| A18 | P2 / lookup gap | **Purchase-form supplier/product lookups discard pagination.** The main purchase list is paginated, but draft supplier/product effects use only `page.items`, ignoring `nextCursor`. Search narrows results but there is no next-results control inside these selectors. [Purchase draft form][purchases] | Add bounded paging or a reusable searchable selector to those two lookups. Preserve the selected saved supplier/product when loading another page. Do not change the shared Select contract without checking its consumers. |
| A19 | P2 / usability gap | **Purchase entry is a long technical form and its visible calculation is the saved calculation.** Quantity, free-unit, discount, HSN, GST and pricing inputs repeat per line. The form tells users to save/reopen for refreshed saved amounts. [Purchase draft form][purchases] | Group invoice header, products and totals into clearer stages. Add an authoritative preview before posting and a compact wide-screen line view with mobile cards. Retain exact paise, actual supplier totals and mismatch checks; never auto-balance to an entered total. |
| A20 | P2 / workflow risk | **The same physical delivery has several entry paths.** Add batch/manual receipts, opening counts and purchase-linked deliveries serve different purposes. The source documentation explicitly warns against entering one delivery through two paths. Different operation keys cannot establish that two separately described physical events were actually the same delivery. [Receipt form][receipts], [purchase operations][purchase-operations], [purchasing contract][purchasing-doc] | Ask Opening count, Supplier delivery or Other inward first, then route to the correct existing command. Make supplier-invoice linkage visible. Keep command replay protection; do not claim it deduplicates arbitrary real-world deliveries. |
| A21 | P2 / approval gap | **Independent return approval handoff is not built.** Posting requires both return and approval authority on the same request. A return-only operator can preview but cannot save a durable approval request for another person. [Returns][returns], [pharmacy routes][routes] | Either label the current flow as an authorized operator performing both duties, or build a persisted reviewed approval handoff. Do not represent two permission checks as two-person approval. Keep original lot/credit allocation and quarantine rules. |
| A22 | P2 / workflow gap | **Return credit and refund payout require a manual navigation handoff.** Returns shows the refund payable and explains that payout is separate, but does not directly open the permitted customer refund workflow with that saved source. [Returns][returns], [Finance][finance] | Add a permission-gated Continue to refund action referencing the saved source. Re-read payable/revision in the refund workflow. Never combine return acceptance with an assumed cash payout. |
| A23 | P2 / feedback gap | **Some lists have weaker loading/empty feedback than Counter.** Returns has no explicit list-loading/empty state; Transfers shows loading and an empty list but no clear No transfers explanation. [Returns][returns], [Transfers][transfers] | Add consistent loading, empty, failed and stale-result states using the existing UI components. Keep read failures distinct from zero records. |
| A24 | P2 / navigation and maintenance | **Owners still have a broad, flat tool strip, with tab eligibility duplicated in long conditional expressions.** Roughly ten retail tools can appear alongside connected dispensing when permitted. [Workspace][workspace] | Group related work or provide task shortcuts using the same capabilities. Define each tab's eligibility once locally. Do not change role grants or remove the clinic dispensing tab to obtain a simpler standalone layout. |
| A25 | P2 / performance | **Authorized inventory and clinical queues load eagerly regardless of the selected tool.** Workspace `fetchData` starts stock and prescription reads when those capabilities are true; selecting Counter does not make those reads demand-driven. Standalone profiles already suppress the clinical queue, which must remain true. [Workspace][workspace], [capabilities][capability-service] | Lazy-load tool-specific data, with explicit freshness/invalidation after mutations. Keep the clinical live queue and prescription validation intact. Avoid mounting every tool in the background as a shortcut for A01. |

## 4. Reporting, imports and support

| ID | Priority/type | Current issue and evidence | Proposed fix without changing clinical contracts |
| --- | --- | --- | --- |
| A26 | P2 / reporting gap | **Whole-branch management totals/export are not built into this report page.** The current report is intentionally bounded, totals only the reviewed page, and pages are separate live snapshots. Export is a reviewed page CSV, not a complete branch extract. [Reports][reports] | Keep these truthful labels. If owners need a daily/whole-branch summary or complete export, implement a separate authorized aggregate/snapshot job with audit and clear scope. Do not rename page subtotals to Total sales. |
| A27 | P2 / accessibility follow-up | **Populated report/import tables need a focused keyboard audit.** Unlike the improved drawer table, their scrolling wrappers lack an explicit labelled focusable region; the import reconciliation table also lacks explicit header scopes. This is a source finding, not a claim that every browser currently fails an automated check. [Reports][reports], [Imports][imports], [Till][till] | Check populated wide tables at 320px and keyboard-only navigation. Apply the existing labelled scrolling-region pattern where needed and explicit header associations. Leave shared Table/Modal behavior unchanged unless a direct regression is demonstrated. |
| A28 | P2 / import usability gap | **Import needs internal IDs but has no downloadable source template/ID helper in the import screen.** Opening stock requires product IDs and dues require party IDs. The current UI offers inspect, map, preview and reconciliation download, but not a pre-import template. Imports are bounded to 200 rows and posting to ten source units per action. [Imports][imports] | Add per-kind sample/template downloads and authorized ID lookup/export. Show progress for larger batches within the existing limits. Keep strict identity mapping and reviewed source groups; no fuzzy name matching or invented historical stock. |
| A29 | P2 / support and documentation | **Technical readiness errors and stale documentation make troubleshooting harder.** Source-index failure is returned as a technical message to the counter. The capability document still says four templates and describes Close till as granting cash movements, while current code has five templates and a separate cash-movement grant. [Index gate][indexes], [Counter][counter], [capability documentation][capability-doc], [permission map][grants] | Distinguish operator actions from administrator/system-readiness actions, preserving the operation reference and original error evidence. Update the canonical permission/setup docs after the final contract is agreed. Never create/drop indexes from a sale request or hide the readiness error by retrying with a new sale key. |

## 5. Existing limits that should not be disguised as bugs

| Area | Actual current boundary | Safe direction |
| --- | --- | --- |
| Payment verification | Retail collection is staff-confirmed cash/UPI/card/split evidence. Automatic bank/provider verification for this manual counter flow is **not built**. Invoice issue and money collection are distinct. [Collection contract][finance-doc] | Keep confirmation explicit. Add a separate verified provider protocol only if required; do not mark a bill paid from a QR display, reference text or printer event. |
| Offline finalization | Offline authoritative sales/stock/payment synchronization is **not built**. Online revision/transaction checks are required. [Production scope][production-doc] | Communicate the online requirement and pending recovery. Do not add browser-queued financial writes or change clinical offline tooling as part of a pharmacy layout fix. |
| Restricted products | Ordinary counter rejects non-general classifications. Connected restricted supply has additional evidence requirements; X/narcotic supply remains blocked. External prescription/repeat support is the separate A11 gap. [Restricted supply][restricted], [dispensing contract][dispensing-doc] | Keep each restriction until a reviewed supported workflow exists. A professional's role title alone must not bypass it. |
| Financial document scope | Current supported issuance is India/INR with reviewed issuer and supported document settings. B2B, interstate/export and required electronic-reporting paths are not generally supported here. [Quote service][quote], [financial contract][finance-doc] | Retain explicit blocks and display scope before setup. This audit does not determine legal/tax applicability or validate real licences. |
| Transfers | Controlled transfers support reviewed same-issuer/state/GST-registration branches and matching product/unit evidence. General interstate or different-registration transfers are **not built**. [Transfer service][transfer-service] | Explain the eligible destinations and missing preconditions; never broaden issuer matching to make a dropdown easier. |
| Physical devices and operations | Synthetic UI checks from earlier work are not scanner/printer certification. Current live provider delivery, real 58/80mm prints, backup restore and representative store load were **not verified in this audit**. [Release evidence][release-doc] | Validate the actual supported devices and deployment separately. Do not describe old local test counts as current full-release approval. |

## 6. What is already fixed or deliberately protected

Do not reopen these as if they were unimplemented:

- Counter sales only template, narrow server grants, separate cash-movement permission, focused desktop/mobile navigation and accessible permission controls: [counter access review][access-review]. Existing members still need explicit role assignment.
- Clear payment totals, persistent Record payment action, compact drawer status, cash/split explanations, search no-match feedback and responsive spacing: [UI review](pharmacy-ui-review.md).
- Current server authority, branch checks, cost redaction, exact paise, quantity/revision checks, transactional stock/source/financial writes, audited results and stable-key recovery already exist. Improve their UI rather than replacing these mechanisms.
- Returned goods are quarantined; a credit is not automatically a refund. A draft purchase is not a stock receipt. A quote does not reserve stock. These are integrity rules, not unnecessary extra screens.

## 7. How to improve pharmacy without breaking clinics/hospitals

| Shared area | Preserve | Checks required when that area changes |
| --- | --- | --- |
| Organization and location model | A clinic/hospital location can enable pharmacy on its existing ID. `facilityType` is not an authorization switch. Only explicit standalone `workspaceProfile: pharmacy` should select the standalone shell. | Standalone setup plus clinic/hospital setup, module-off behavior, active/inactive branches, location revocation and tenant isolation. |
| UI components | Reuse existing Button, Input, Select, Checkbox, Card, Table, Modal, Tabs and utilities. Solve cart persistence in the pharmacy workspace, not with a global Tabs lifecycle change. | Pharmacy view plus direct consumers of any shared primitive changed; keyboard, focus, dialog footer, mobile and dark mode. |
| Permissions | Preserve connected clinical rights and current explicit role definitions. Add independent read/write/own/all contracts where required. UI hiding is not server authorization. | Root, owner, pharmacist, narrow cashier, stock manager, report reader, patient/family/guest denial, impersonation and immediate grant revocation. |
| Clinical dispensing | Keep encounter/signed-note authority, prescription-to-medicine identity, explicit partial allowance, FEFO, register evidence and duplicate-charge protection. | `pharmacyPrescriptionAuthority`, `pharmacyFulfillmentLoop`, `pharmacyDispenseRecovery`, inventory and authorization backend tests. No automatic Patient/Encounter creation from a retail sale. |
| Invoices and payments | Preserve generic clinical readers' exclusion of retail `kind: pharmacy`, distinct operation scopes and immutable issued snapshots. Keep manual retail collection separate from patient hosted checkout. | Clinical invoice/payment tests, pharmacy retail/collection/return tests, patient checkout frontend tests and current payment-boundary checks if checkout code changes. |
| Physical drawer service | Preserve pharmacy versus billing channels, operator ownership, revision checks and immutable closing evidence. Shared implementation does not imply shared access. | `cashierDrawers` plus frontend pharmacy Till and clinical billing consumers; cannot collect to another operator's drawer or move funds with only close permission. |
| Inventory and money sources | Preserve base units, captured lot identities, source references, fiscal numbering, stock/financial revisions and transaction rollback. | Catalogue/lots/stock movements, purchases/posting, transfers, returns, collections and settlements as affected. Same-key replay, changed-body rejection and competing commands. |
| Expiry/disablement | Keep current distinctions between commercial expiry, pharmacy capability disable, organization module disable and authorized historical recovery/correction. | `pharmacyCommercial`, `pharmacyCapabilities`, product activation and in-flight recovery for affected actions. Do not assume all three switches have identical behavior. |
| Reporting/export | Keep independent cost/source grants, branch scope, reviewed digests and page/snapshot labels. | Populated report/export tests, denied source grants, archived records, changing data between preview/export and foreign-branch requests. |
| Database preparation | Application requests check readiness; operational setup prepares schema/indexes separately. No automatic reset, historical rewrite or guessed backfill is needed for this development project. | Isolated fixture databases and relevant readiness tests. A live database/index change requires its own concrete authorized operation, not an audit side effect. |

The named test files exist under `src/tests` and `../backend/tests` with `.test.tsx`/`.test.ts` suffixes. Run only the affected/direct-consumer checks for a logical change, following [verification workflow](verification-workflow.md); use full CI/release gates for an actual release. A passing scoped test does not establish the entire application has no regressions.

## 8. Recommended implementation order

1. **Protect the active sale:** A01–A04, then the optional history policy A10 if the owner requires it. Add regressions for cart → drawer → cart and branch changes before rewriting layout.
2. **Make stock operable:** A05–A08, with the existing adjustment/receipt/lot services and no direct quantity overwrite.
3. **Clarify scope and readiness:** decide A11 before promising a complete prescription-selling pharmacy; address A12–A14 and independent report-reader access A09.
4. **Shorten daily tasks:** invoice lookup, collection handoff, purchase lookup/entry, returns/refunds and pending-operation recovery A15–A25.
5. **Finish reporting and support:** A26–A29, populated-table accessibility, real-device checks and current canonical docs.

Each batch should be separately reviewable. Start with pharmacy-local UI/state; change shared financial or clinical services only for a demonstrated missing contract and its paired regressions. No implementation work is included in this audit.

## Source references

[workspace]: ../src/app/(dashboard)/dashboard/pharmacy/page.tsx
[counter]: ../src/components/pharmacy/PharmacyCounter.tsx
[tabs]: ../src/components/ui/Tabs.tsx
[layout]: ../src/app/(dashboard)/layout.tsx
[locations]: ../src/store/locationStore.ts
[sales]: ../../backend/controllers/pharmacySales.ts
[quote]: ../../backend/services/PharmacySaleQuoteService.ts
[medicine]: ../../backend/controllers/medicine.ts
[alerts]: ../src/components/pharmacy/PharmacyAlertsCenter.tsx
[routes]: ../../backend/routes/pharmacy.ts
[receipts]: ../src/components/pharmacy/PharmacyStockReceipts.tsx
[receipt-service]: ../../backend/services/PharmacyStockReceiptService.ts
[review]: ../src/components/pharmacy/PharmacyProductReview.tsx
[grants]: ../../backend/utilities/pharmacyPermissions.ts
[report-service]: ../../backend/services/PharmacyReportService.ts
[access-review]: pharmacy-counter-access.md
[capability-service]: ../../backend/services/PharmacyCapabilityService.ts
[dispensing-doc]: pharmacy-dispensing.md
[setup]: ../src/components/organization/OrganizationPharmacySetup.tsx
[purchases]: ../src/components/pharmacy/PharmacyPurchases.tsx
[collections]: ../src/components/pharmacy/PharmacyCollections.tsx
[recovery]: ../src/components/pharmacy/PharmacySaleRecovery.tsx
[purchase-operations]: ../src/components/pharmacy/PharmacyPurchaseOperations.tsx
[purchasing-doc]: pharmacy-purchasing.md
[returns]: ../src/components/pharmacy/PharmacyReturns.tsx
[finance]: ../src/components/pharmacy/PharmacyFinance.tsx
[transfers]: ../src/components/pharmacy/PharmacyTransfers.tsx
[reports]: ../src/components/pharmacy/PharmacyReports.tsx
[imports]: ../src/components/pharmacy/PharmacyImports.tsx
[till]: ../src/components/pharmacy/PharmacyTill.tsx
[indexes]: ../../backend/services/PharmacyDispenseIndexes.ts
[capability-doc]: pharmacy-capabilities.md
[finance-doc]: pharmacy-finance.md
[production-doc]: pharmacy-production-plan.md
[restricted]: ../../backend/services/PharmacyRestrictedSupply.ts
[transfer-service]: ../../backend/services/PharmacyTransferService.ts
[release-doc]: pharmacy-release-evidence.md
