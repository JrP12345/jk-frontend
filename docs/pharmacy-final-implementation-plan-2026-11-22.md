# Ekavyu pharmacy implementation and acceptance plan

Updated 24 November 2026. Ekavyu should win through simpler daily billing, reliable stock and purchases, and a clear owner view. A pharmacy assistant should be able to use the supported workflow confidently on the first day. Adding more menu items is not the success measure.

This is the controlling forward plan for the 45 buyer requirements, five store demonstrations and three product priorities. It extends the existing [production architecture and release scope](pharmacy-production-plan.md), [daily pilot checklist](pharmacy-pilot-validation.md), [POS extensions](pharmacy-pos-extensions-2026-11-22.md) and [supplier exchange and counter coordination](pharmacy-supplier-exchange-and-counter-coordination-2026-11-22.md). Existing historical implementation reports remain dated evidence.

## Current baseline and completion rules

The current software register classifies **29 requirements as implemented within their supported scope, 16 as partial or operationally unverified, and none as wholly missing**. The original buyer audit was 26 implemented, 18 partial and one missing. Explicit three-level packs, supplier-rate comparison and broader stock movement analysis now close those specific software gaps; registers and original files retain operating and scope limitations. These counts are not a percentage of engineering effort or proof of store readiness. In particular, multi-counter offline coordination remains substantial new work.

In the coverage tables, **I** means an implemented workflow exists, **P** means partial or unverified, and **M** means the specific feature is missing. An implemented item still needs its assigned store demonstration and relevant release acceptance. No acceptance task in this plan is marked complete merely because the plan exists.

A task closes only when its deliverable, adverse cases, relevant automated checks and required operating evidence pass. Record the source revision, environment, fixture, actor/role, actual versus expected result and remaining exception. Record hardware and timing methodology for performance claims. A failed acceptance stays open; do not substitute a synthetic run for store or provider acceptance.

The project has no production customers or legacy production data. Build current contracts without hypothetical backfills. Migrating a pilot pharmacy's actual existing-system export is an explicit onboarding workflow, with reconciliation and owner acceptance.

The [23 November supplier rates, registers, original files and stock analysis increment](pharmacy-rates-register-and-stock-analysis-2026-11-23.md) implements R26 and the broader R16 software workflow, adds the R32 staff screen and advances R33 for outside prescription sources. None of the five store demonstrations is closed by these automated checks.

The [pack, delivery and expiry-return increment](pharmacy-packs-deliveries-and-expiry-returns-2026-11-23.md) implements the R03 box/strip/tablet relationship, reviewed bulk batch/expiry files, supplier-specific expiry packing drafts and finalized clinic prescription file navigation. Synthetic integration checks cover the 100 → 97 balance, a 50-medicine receipt and twenty strips across three suppliers. Hardware, staff timing, real source files and D1–D5 store acceptance remain open.

## Three product priorities

The [24 November file-history, custody and staff-guide increment](pharmacy-file-history-and-staff-guide-2026-11-24.md) adds retained superseded-source access, reviewed retention, legal holds, original-request byte removal and capability-specific first-day instructions. Approved records policy, real provider/key recovery and unassisted staff acceptance remain open. The 29/16 register includes operating gates; it is not a count of remaining code changes. Shared LAN offline coordination remains unfinished engineering.

The [daily overview software increment](pharmacy-daily-overview-2026-11-22.md) now implements the simple owner view, source-report/day handoff, original credit capture and explicit offline/payment uncertainty. P3 records/attachments and the actual D5 store demonstration remain open; physical reorder counts and gross contribution retain their stated scope.

| Priority | Product outcome | Required proof |
| --- | --- | --- |
| T1 Billing takes too much effort | Fast name/barcode search, explicit loose/pack quantities, few payment steps, clear Save/recovery, dependable print and reprint. | D1 busy counter and D4 internet failure; first-day assistant acceptance. |
| T2 Stock and purchases are difficult to maintain | Reuse supplier mappings, minimize repeated entry, review batch/expiry/scheme facts, keep one base-unit balance, prepare traceable expiry returns. | D2 new distributor stock and D3 expiry returns; purchase/count/return conservation. |
| T3 Owners cannot easily see their business | One understandable daily view of sales, actual collections, credit, gross contribution, stock alerts and distributor dues, with freshness and exceptions. | D5 end of day; owner explains the figures without opening several complex reports. |

Build and validate these outcomes before increasing advanced feature breadth. Existing features stay available under their current permissions and supported scope.

## Ordered implementation phases

| Phase | Deliverables and dependencies | Lead roles | Exit gate |
| --- | --- | --- | --- |
| P0 Baseline and pilot scope | Freeze this requirement register; choose the pilot branch, supported transaction scope, reference dataset, target old PC/browser, scanners/printers and named acceptance roles. Capture existing stock/money invariants and current test evidence. Define performance measurements before changing code. | Product, engineering, pilot owner, pharmacist | Every R01–R45 and D1–D5 has an acceptance assignment; test stock and expected financial results are independently calculable. |
| P1 Counter and first-day operation | Complete T1, multi-level pack conversion where needed, payment/print recovery and first-day guidance. Keep keyboard/scanner focus, visible quantity units, understandable errors and the original uncertain-save reference. | Frontend/backend engineering, cashier, pharmacist | D1 passes; supported online sales, returns, collections and prescription boundaries remain correct. |
| P2 Purchase and expiry workflows | Complete T2: reviewed 50-product imports, batch/expiry capture, reusable supplier profiles, effective purchase-rate comparison, supplier-grouped expiry return preparation and real import reconciliation. | Engineering, purchase operator, pharmacist | D2 and D3 pass; draft/post/receive/return/credit stages remain distinct and source-bound. |
| P3 Owner view and records | Deliver the simple daily overview, H1 staff read/export, prescription attachments, accountant handoff and slow-moving analysis. Make gross contribution clear. Keep a separate explicit expense/net-profit milestone if net profit is offered. | Engineering, owner, accountant, pharmacist, privacy/operations | D5 passes, register/attachment access and retention controls pass, and accountant verifies the supported export. |
| P4 Shared LAN offline coordination | Implement the selected local coordinator with durable storage, authenticated counter/cashier pairing, per-cashier drawers, one stock/number writer, original-request recovery, cloud reconciliation and a supported install/update/backup procedure. Depends on P1 transaction and P2 stock contracts. | Backend/frontend engineering, security/operations, pilot cashier | D4 passes on two counters with WAN loss, coordinator restart and lost acknowledgements; satellite LAN loss stops final issuance safely. |
| P5 Catalogue and provider onboarding | Activate only approved licensed catalogue sources; validate distributor files/APIs, OCR, pharmacy-owned merchant payments, settlement reconciliation and configured follow-up delivery. Finish reproducible existing-system imports and transparent pharmacy pricing/terms. Local products and manual supported workflows must work without optional providers. | Engineering, operations, product/finance, source/provider owners | Real test-account/provider and actual-file acceptance, published supported formats/limits, reconciled imports and a confirmed commercial offer. |
| P6 Store pilot and recovery | Run all five demonstrations with first-day staff on the target PC, scanners, printers and network. Reconcile opening/closing balances; exercise permissions, partial deliveries, refunds, backup and restore. Establish support ownership and incident procedures. | Pilot owner, pharmacist, cashier, accountant, operations | All five demonstrations and the full pilot checklist pass; no unresolved stock, money, authorization or recovery defect. |
| P7 Release and support readiness | Run exact-revision CI/release gates, configure deployment/schema/index readiness and monitoring, retain professional/business acceptance and publish the supported scope. Practice restore and incident escalation against agreed recovery objectives. | Engineering, operations, product owner and relevant professional reviewers | Approved release record, measured operating recovery, configured provider/device evidence and an explicit launch decision. |

Phases identify responsibility and dependencies, not a promise to delay already independent work. Do not activate an external integration just because its UI exists. No calendar deadline is committed until actual files, providers, hardware and acceptance owners are known.

## Complete buyer requirement register

### Billing and POS

| ID | Buyer requirement | Now | Remaining delivery or acceptance | Phase and proof |
| --- | --- | --- | --- | --- |
| R01 | Generate a bill in seconds | P | Measure and remove bottlenecks in search, quantity entry, save, payment and print on the target old PC. Publish measured median/p95, errors and click/key counts rather than a universal speed claim. | P1/P6, D1 |
| R02 | Search by name or barcode | I | Preserve leading zeros, exact barcode behavior, name/composition lookup, ambiguous-match review and scanner Enter/focus. Accept the actual scanner. | P1/P6, D1 |
| R03 | Sell loose tablets, strips and boxes | I | Optional explicit outer/inner/base relationships now support box/strip/tablet entry, billed/free purchase CSV and revisioned source snapshots. Physical stock, returns, counts and reports use base units. Accept actual product conversions; never infer factors or change historical units. | P1/P2/P6, D1/D2/D3 |
| R04 | Automatic MRP, discount and GST | I | Retain exact money, reviewed price/tax facts, MRP caps, zero/exempt cases and original-source return calculations. Revalidate the actual issuer/product setup. | P1/P3/P6, D1/D5 |
| R05 | Print on existing thermal or A4 printer | P | Accept actual A4/58/80 mm printer/browser/driver combinations, long bills, margins, cancel/retry and reprints. Print failure cannot create another sale. | P1/P6, D1 |
| R06 | Customer returns, refunds and stock reversal | I | Verify partial/full returns, original quantities/credits, separate actual refund evidence and quarantined returned goods. No automatic release of returned medicine for resale. Provider refund automation is a separate supported integration. | P1/P5/P6, D1/D5 |
| R07 | Cash, UPI, card and split payment | I | Preserve confirmed manual and split/part payments, named-customer credit rules and atomic issue/collection. Accept real configured merchant capture/recovery separately; popup success is not payment proof. | P1/P5/P6, D1/D4/D5 |
| R08 | Offline billing and reliable synchronization | P | Preserve current designated-PC supported cash scope. Deliver P4 coordinator and preauthorized operation with original receipts, stable numbers, same-key recovery and safe expiry. Unprepared/unsupported outage activity remains draft-only. | P4/P6, D4 |
| R09 | Hold and resume a bill | I | Verify repeated interruption, quantities/customer/payment choice, restart recovery, held-cart limits and scanner focus without issuing or collecting. | P1/P6, D1 |
| R10 | Previous bills and reprints | I | Verify branch/role-scoped search, date filtering, saved historical prices/tax/issuer and reprint after restart. Never regenerate a historical invoice using current facts. | P1/P6, D1/D5 |

### Inventory and medicine management

| ID | Buyer requirement | Now | Remaining delivery or acceptance | Phase and proof |
| --- | --- | --- | --- | --- |
| R11 | Know available medicines and quantities | I | Keep physical versus saleable stock explicit, with held/expired/quarantined goods and offline freshness. Reconcile branch, lot and aggregate counts. | P2/P4/P6, D1–D5 |
| R12 | Track batches of the same medicine | I | Accept multiple received lots/batches/expiries, repeated printed batch labels, partial deliveries and their original purchase provenance. | P2/P6, D2/D3 |
| R13 | Warn before expiry | I | Verify existing in-app 30/60/90-day windows, local-day boundaries, sorting and return entry. Automatic pushed expiry messages are a separate explicit notification enhancement, not an existing claim. | P2/P6, D3/D5 |
| R14 | Identify low-stock medicines | I | Validate per-product thresholds against saleable base units; link alerts to shortbook/orders. Keep push notifications distinct from existing in-app alerts. | P2/P3/P6, D2/D5 |
| R15 | Prevent sale of expired medicines | I | Verify exact printed day/month expiry, location timezone, held/recalled lots and both connected/local checkout boundaries. | P1/P4/P6, D1/D4 |
| R16 | Identify slow-moving and dead stock | I | Existing no-dispense report plus bounded stock-velocity/age analysis now distinguish recent stock, short/incomplete history, recorded supply and slow cover. Accept the disclosed window/90-day-cover rule with the pilot; unknown history and return treatment remain explicit. | P3/P6, D5 |
| R17 | Suggest the first batch to sell | I | Verify FEFO with multiple lots, expiry ties, exclusions, sufficient stock and concurrent sales; retain source allocation trace. | P1/P2/P4/P6, D1/D2/D4 |
| R18 | Reconcile shelf counts | I | Verify authorized revision-checked counts, unexplained variance review, concurrent sales, disposal and retained movement/audit references. | P2/P6, D2/D5 |
| R19 | Locate stock by rack or shelf | I | Preserve basic rack/shelf labels. Accept display and lookup in daily workflows; add a bounded rack filter if the pilot requires one. No complex warehouse map is implied. | P1/P2/P6, D1/D3 |

### Purchases and distributors

| ID | Buyer requirement | Now | Remaining delivery or acceptance | Phase and proof |
| --- | --- | --- | --- | --- |
| R20 | Upload distributor Excel or PDF invoices | P | Supplier CSV/values-only XLSX mappings and source-bound bulk delivery batch/expiry review now exist. Accept actual distributor files and configured PDF/photo OCR; preserve uncertainty/source text and require human confirmation before posting/receiving. An Ekavyu delivery template is not an arbitrary supplier-file adapter. | P2/P5/P6, D2 |
| R21 | Enter purchases quickly | I | Remove repeated entry while retaining draft, posting and receiving separation. Measure repeat-format and first-format 50-product entry independently. | P2/P6, D2 |
| R22 | Know which supplier supplied a medicine | I | Verify source purchase/line/receipt links through lot, sale, supplier history, return and credit records. Unlinked opening stock must remain honestly unlinked. | P2/P6, D2/D3 |
| R23 | Handle 10+1 free strips and schemes | I | Verify billed/free allowances, partial delivery and exact effective acquisition cost across all received base units. Display actual supplier terms without inventing promotional eligibility. | P2/P6, D2 |
| R24 | Return near-expiry goods to distributor | I | Supplier-specific local packing drafts now retain original purchase/receipt lines and carry selected quantities into a fresh invoice return review. Verify physical handover, supplier acceptance, credit/refund and rejected/short claims in the store. Preparation moves no goods and confirms no credit. | P2/P6, D3 |
| R25 | See supplier outstanding balances | I | Reconcile opening dues, posted bills, actual payments, source credits and refunds; distinguish disputed/unaccepted claims from posted credits. | P2/P3/P6, D3/D5 |
| R26 | Compare distributor purchase rates | I | Historical comparison now normalizes each supplier's latest posted product invoice by billed/free base units and discounts, with net/gross GST rates, source date and unit-review exclusions. Accept actual supplier files and interpretation. Live quotes/availability require a separate documented integration. | P2/P5/P6, D2 |
| R27 | Order low-stock medicines | I | Verify alerts → shortbook → reviewed supplier order, exact-order response CSV/portal and invoice/receipt matching. Add actual documented distributor adapters only after partner access, with retry and rate-change review. | P2/P5/P6, D2/D5 |

### Accounting and pharmacy records

| ID | Buyer requirement | Now | Remaining delivery or acceptance | Phase and proof |
| --- | --- | --- | --- | --- |
| R28 | See daily sales and profit | P | Deliver clear gross contribution with unknown costs and return treatment visible. If offering net profit, add audited expense inputs, period policy and accountant-approved treatment of tax, returns, disposals and operating costs; otherwise label the offered figure gross contribution. | P3/P6, D5 |
| R29 | Give GST reports to accountant | I | Accept supported sales/credit tax reports, CSV and Tally handoff in a test company. Validate ledger mapping and accounting review. Unsupported filing formats, e-invoicing or government submission must remain excluded until separately delivered. | P3/P5/P6, D5 |
| R30 | Track customer credit and khata | I | Verify part payments, earlier dues, due dates, concurrent credit limits, overdue blocks, separate-person creation and audited administrator exceptions. | P1/P3/P6, D1/D5 |
| R31 | Daily cash, UPI and card reconciliation | I | Reconcile receipt methods and actual drawer cash, previous-dues collections, refunds, cash movements and gateway evidence. Keep settlement/bank-deposit differences visible. | P3/P5/P6, D5 |
| R32 | Maintain Schedule H1 records | P | Staff-facing bounded H1 and separate H read/filter/export screens now use captured append-only records, branch-local days, review flags and audited full filtered exports. Reviewed retention, professional/operating acceptance and recovery procedures remain activation gates. | P3/P6/P7, D1/D5 |
| R33 | Save original prescriptions securely | P | Outside/current finalized clinic uploads, retained superseded-source history, audited downloads, encrypted metadata, reviewed retention/legal holds and original-request byte removal are implemented. Pending provider uploads block removal until explicit completion review. Approve the actual policy, staff grants, private provider/request-review procedures and storage/key recovery. Active-key removal does not erase separately retained backups. Files cannot authorize supply. | P3/P6/P7, D1 |
| R34 | Audit who changed bills or stock | I | Verify actor/branch/source/time/command trace, immutable issued evidence and correction history. New coordinator, attachment, import and expense paths must enter the same audit discipline. | Every affected phase, D1–D5 |
| R35 | Export data to Excel | I | Verify Excel-readable CSV for supported reports, complete versus page scope, background bounds/digests and permissions. Define a broader owner data/attachment export package if included in the commercial portability promise. | P3/P5/P6, D2/D5 |

### Purchase and operating decisions

| ID | Buyer requirement | Now | Remaining delivery or acceptance | Phase and proof |
| --- | --- | --- | --- | --- |
| R36 | Clear monthly and yearly pricing | P | Publish actual configured pharmacy plan prices, taxes, branch/counter allowances, annual terms, trial, renewal and cancellation. Verify quote-to-activation without granting staff permissions through payment. | P5/P7 |
| R37 | Understand all charges | P | Publish setup/import/training/support, optional OCR/messaging/payment/distributor charges and equipment/certificate/coordinator costs where applicable. Explicitly distinguish included, optional and third-party charges. | P5/P7 |
| R38 | Transfer existing Marg data | P | Obtain an authorized real export, document supported source versions/columns, map products/units/batches/expiry/parties and opening dues, reject ambiguity and reconcile totals. Clearly define historical documents/attachments that are imported or retained separately; owner signs the resulting baseline. | P2/P5/P6, D2/D5 |
| R39 | Avoid adding every medicine manually | P | Accept local/CSV/XLSX creation and reference adoption; activate a licensed catalogue only after source approval. Keep source provenance and separate branch price/stock/tax/classification review. No complete catalogue is promised while approval is pending. | P5/P6, D1/D2 |
| R40 | Run on the pharmacy's old PC | P | Set supported OS/browser/storage and actual reference PC; test realistic catalogue, disk pressure, cold start, repeated sales, CPU load, weak network and restart. Publish measured minimum support and limitations. | P0/P1/P4/P6, D1/D2/D4/D5 |
| R41 | Train staff easily | P | Capability-specific in-app first-day guidance and a compact daily checklist cover all five scenarios, actual scanner/print checks, ordinary-versus-prescription boundaries, receiving/credit stages and original-save/outage recovery. Billing-only instructions preserve scope. Demonstrate unassisted first-day use with staff unfamiliar with Ekavyu; guidance is not training certification. | P1/P6, D1–D5 |
| R42 | Get help and recover failures | P | Establish actual support channel/hours, incident owner, escalation and response terms. Practice uncertain-save, provider outage, local storage failure, coordinator loss and restore using approved recovery objectives. | P4/P5/P6/P7, D4/D5 |
| R43 | Use two counters | P | Accept current online concurrency. Deliver authenticated shared-LAN counters with separate operator/drawer attribution, last-unit arbitration, coordinator recovery and safe counter disconnection. Never advertise independent disconnected writers as supported. | P4/P6, D1/D4/D5 |
| R44 | Check sales on a phone | I | Accept responsive owner reports/overview on an actual phone, with branch/date, source freshness, role isolation and understandable figures. A separate native app is not required for this scope. | P3/P6, D5 |
| R45 | Protect data and recover backups | P | Verify deployed tenant/role boundaries, encrypted data and key custody, scheduled monitored backups and an isolated restore drill. Cover database, private prescription/supplier files, local coordinator/browser ledger and keys; agree measurable recovery objectives and retain access/retention procedures. | P3/P4/P6/P7, D4/D5 |

## Five mandatory store demonstrations

The following targets are proposed acceptance targets to confirm in P0, not measured Ekavyu results. Measure the intended scope from start to finish on the selected store hardware. Report first-use setup separately from repeat daily work. Financial, clinical and stock correctness have no error allowance even if a timing target passes.

### D1 Busy counter

**Owner question:** A customer purchases five medicines, including three loose tablets. Can an assistant complete the bill quickly without mistakes?

Use five reviewed ordinary products, at least two eligible lots for one product, barcode and name entry, three loose tablets, a pack quantity, a reviewed discount and realistic cash tender. Hold another customer's bill, finish this bill, resume the held bill and reprint the saved document. Repeat with confirmed UPI and split payment; separately demonstrate a prescription item requiring the correct pharmacist workflow.

Pass when quantities, FEFO allocation, MRP, GST, discount, receipt/change and stock all match the expected source records; one sale has one number and one collection outcome. Scanner focus returns for the next customer. Print cancellation/failure permits reprinting the original bill. An assistant without restricted dispensing authority cannot bypass it.

Proposed timing: after orientation, complete an ordinary five-item bill within 60 seconds in at least 19 of 20 measured attempts, excluding a customer's payment-network wait and explicitly separating printer handoff from paper output. Record wrong selections, corrections, prompts and operator help. Zero duplicate bills, incorrect money or incorrect stock.

Coverage: R01–R12, R15, R17, R19, R28, R30–R34, R39–R43.

### D2 New distributor stock

**Owner question:** I receive 50 medicines with different batches, expiry dates and free quantities. How quickly can I enter the invoice?

Use a real-format authorized sample containing 50 products, varied pack factors, discounts/MRP/tax and at least ten billed/free schemes. Include multiple delivered lots for some products, an unmapped supplier item, a changed pack and an invalid/uncertain expiry. Demonstrate the first reviewed mapping and then a repeat invoice using the saved mapping. Show CSV/XLSX and, when configured, a PDF/photo whose extracted values still require review.

Pass when ambiguous rows stay unposted, the stated/calculated invoice reconciles, and posting records one payable without receiving stock. Explicit receiving then captures the actual batches/expiry and billed/free quantities once, including a partial delivery. Retry/reload cannot duplicate the purchase or goods. Compare effective purchase cost across suppliers without mixing tax policies or presenting old rates as live quotes.

Mandatory conservation fixture: receive 10 strips of 10 tablets, sell three tablets and verify 97 physical tablets across the lot, product, movement and reports. Free goods have their own additional allowance; returns/quarantine must not silently increase saleable stock.

Proposed repeat-format target: review and prepare the 50-product draft within 10 minutes when the source supplies all required facts; measure posting and physical receiving separately. Record first-format mapping time and correction counts without applying the repeat-format target to missing source data.

Coverage: R03, R04, R11, R12, R14, R17, R18, R20–R27, R34, R35, R38–R41.

### D3 Expiry return

**Owner question:** Twenty strips expire next month and came from three suppliers. Can I identify them and prepare the returns?

Use 8, 7 and 5 strips from three source suppliers, with actual pack factors and purchase-linked lots. Freeze the demonstration date and show the relevant expiry window. Include a partial earlier return and a separate unlinked opening lot so missing provenance cannot be assigned to a convenient supplier.

Pass when the operator finds the correct lots, sees physical versus eligible quantities and prepares three supplier-specific return drafts/documents. Quantities cannot exceed the remaining source allowance. Repeated submission cannot return the same goods twice. Physical dispatch/return recognition, supplier acceptance, credit and actual refund remain separate stages. Show a short/rejected claim, original cost basis and its effect on stock, dues and reporting. An unaccepted claim cannot masquerade as received cash or a posted supplier credit.

Proposed target: identify and prepare the three reviewed return drafts within five minutes after the source records are present. Supplier response time and physical goods handover are measured separately.

Coverage: R03, R11–R14, R18, R19, R22, R24, R25, R28, R31, R34, R35, R41.

### D4 Internet failure

**Owner question:** Internet disconnects during billing. Can I keep selling safely and synchronize without duplicate invoices or wrong stock?

Demonstrate the currently supported preauthorized designated-PC mode honestly first. An unprepared browser cannot acquire final-billing authority after the server becomes unreachable. An uncertain cloud save retains its original key/result lookup; it cannot be recreated as a new offline bill. Unknown UPI/card results are not cash or paid invoices.

For completed P4 acceptance, run two cashier counters through the shared local coordinator while the WAN disconnects. Keep LAN access, issue a defined batch of bills, contend for the last unit, lose an acknowledgement after durable commit, restart the coordinator and repeat the original command. Then restore the WAN, interrupt synchronization and synchronize again. Separately disconnect one counter from the LAN, exhaust/expire authority and simulate unavailable durable storage.

Pass when all accepted local sales have durable original receipts, unique reserved numbers, correct actor/drawer attribution and exact once-only stock/money effects. The last unit sells once. Every imported receipt maps to its original local evidence; totals and contiguous sequence reconcile. A counter without the coordinator, valid authority or durable storage stops final issuance and preserves drafts/recovery. Cloud stock writers remain fenced until the complete stopped ledger reconciles. Expiry, a missing heartbeat or a backup without a terminal checkpoint cannot release stock.

Measure local commit/recovery/sync time and the longest supported outage. Prove correctness at every failure point; a fast synthetic sync is not acceptance of store power, disks, certificates or backups.

Coverage: R06–R12, R15, R17, R30, R31, R34, R40–R43, R45.

### D5 End of day

**Owner question:** At 10 PM, can I see sales, cash, UPI, profit estimate, credit sales and low stock without assembling several reports?

Provide one simple owner overview for the selected branch/local business day, usable on a phone. Include card and split allocations, distributor dues, returns/refunds and reconciliation exceptions alongside the six requested figures. Every total has a source drilldown and explicit coverage/freshness, including local bills not yet synchronized.

Seed sales today, a collection of an older customer debt, new credit sales, partial payment, a return/credit on an earlier bill, an actual refund, cash in/out, low stock and a missing acquisition cost. Include a bill around local midnight and a known provider payment awaiting reconciliation.

Pass when issued sales and return credits are identifiable separately; actual collections include earlier-dues payments without becoming today's sales; new credit differs from total outstanding dues; cash expectations include opening float, movements and refunds; UPI/card evidence is not confused with bank deposit. Gross contribution shows its source/date/cost policy and unknown cost, without presenting itself as net profit or subtracting the same returned cost twice. Offline unsynchronized work prevents a false claim that cloud totals are complete.

Proposed usability target: the owner finds and correctly explains the requested figures within 30 seconds without operator help. Compare actual counted cash and source-ledger totals. Close the day with explained differences rather than editing historical documents to force agreement.

Coverage: R04, R06, R07, R10, R11, R13, R14, R16, R18, R25, R27–R32, R34–R38, R40–R45.

## Local coordinator implementation contract

The [24 November internal journal foundation](pharmacy-lan-journal-foundation-2026-11-24.md) now implements encrypted atomic local stock/number/cash commits, paired-key intent verification, distinct prepared cashier/drawer attribution, original-result recovery, a process writer lock, signed stop/revocation and read-only recovery export. Thirteen real-SQLite cases pass. This is not an activated LAN counter: cloud grants/import/release, HTTPS pairing/sessions, protected installation identity, UI and deployment/recovery tooling remain engineering work. D4 and R08/R43 stay partial.

P4 uses one local branch coordinator as the authority for its prepared operating session, both while WAN is available and while it is unavailable. Define mode acquisition/renewal, sequence limits, safe shutdown and cloud handover explicitly. Do not rely on silently promoting several cloud browser carts after a failed save.

Reuse existing stock, document calculation, collection and import rules where their contracts fit. The current grant binds one operator/browser key/drawer: it cannot become a multi-cashier grant by copying the key or using the manager's identity for everyone's sales. The new contract must include independently authenticated cashiers/counters, bounded signed permissions, per-drawer evidence, encrypted durable journal/backups, stable command identities and a single atomic stock/number/payment commit before receipt/print success.

Specify and verify trusted local HTTPS/certificate installation, pairing/revocation, platform/browser network restrictions, operator lock/expiry, versioned updates, recovery after power loss and readable recovery states. Local storage must not depend on an open browser tab. A compromised or lost coordinator needs a controlled review/recovery process; a second coordinator cannot simply start spending the same branch stock.

Cloud receipt import must verify original source/scope/sequence/digest/operator evidence, serialize stock and money effects and retain unresolved exceptions. Do not introduce a second business ledger, fabricate a payment, recycle a number or release ownership by timeout. Backup restoration must reconcile later payment-provider evidence before it permits a second collection.

## Other already implemented extensions remain tracked

The three priorities determine ordering; they do not discard previous work.

| Existing extension | Remaining acceptance or explicit boundary | Phase |
| --- | --- | --- |
| Margin, expiry exposure and write-off reports | Accountant validates cost/date/return interpretation and unknown values; no double subtraction or unsupported net-profit claim. | P3/P6 |
| Tally XML | Test-company import, ledger mapping, original document identity and duplicate-import review; limited voucher scope stays explicit. | P3/P5 |
| Pharmacy merchant checkout and settlement matching | Pharmacy-owned test account, signed webhook, captured-payment recovery, changed invoice/drawer exception and actual settlement/bank review. | P5/P6 |
| Customer refill/dues follow-ups | Explicit consent/date/address and current authority, configured worker/provider, cancellation and real delivery acceptance. No dosage-derived refills or unapproved campaigns. | P5/P6 |
| Member pricing | Verify explicit discount application, owner configuration and no unintended discount stacking. A points/redemption ledger is not included. | P1/P6 |
| Brand comparison | Exact recorded generic/strength/form/unit matches, stock freshness and pharmacist review; no automatic substitution. | P1/P6 |
| Supplier response CSV, links, files and ordering | Exact revision/units, actual communication, private file access, expired/revoked links and optional provider availability. Supplier communication does not itself receive goods. | P2/P5/P6 |
| Background report exports | Complete versus page scope, current permissions, bounded snapshots, integrity, expiry and honest failure on oversized results. | P3/P6 |
| Customer credit, outside prescriptions and pickup | Preserve existing authority, concurrent allowance/credit checks, saved-bill linkage, payment-at-handover and cancellation/return resolution. | P1/P3/P6 |
| Counts, sale holds, transfers and product archive | Preserve branch/source authority, recall/hold exclusions, count races, source custody and refusal to hide unresolved stock or deliveries. | P2/P4/P6 |

SMS/WhatsApp automation, a points ledger, native mobile apps, advanced forecasting, unrestricted Schedule X/narcotic supply, full accounting books and unsupported statutory integrations are not silently added to the basic offer. Keep them explicitly outside the supported launch scope or give each a separate approved implementation and professional/provider acceptance before advertising it.

## Verification and operating gates

Use the [risk-based verification workflow](verification-workflow.md). Finish a logical change, then run changed-file lint, affected tests and contract/type checks. Money, clinical authority, permissions, inventory, offline concurrency and private attachments are Level 4: include adverse cases and direct consumers in both repositories when the API contract changes. Run build/startup checks when their entries/runtime change. Do not repeatedly run unrelated suites after every small edit; P7 retains full exact-revision CI/release gates.

Required regression boundaries include same-key/different-payload retries, lost responses, competing last-unit/credit/return/receipt requests, unauthorized roles/branches, stale prices/units/expiry, partial deliveries/refunds, original-document reproduction, missing audit rollback, export bounds and provider uncertainty. Clinical workflows sharing the modified code must retain their existing authority and financial behavior.

Store acceptance must include actual first-day staff, an owner/accountant review, old-PC/browser performance, scanners, A4/thermal printers, real slow/interrupted connectivity, disk/storage failure, configured provider test accounts, licensed source access and isolated restore of data/files/keys/local evidence. Record support contacts, operator procedures, monitoring and approved recovery objectives. Professional review and current applicable business/tax/privacy/record requirements remain activation gates for their relevant scope.

## Final completion checklist

- [ ] All 45 requirements have a verified delivery, an accepted operating result, or an explicitly agreed excluded scope before sale; none is dropped without a recorded product decision.
- [ ] T1 billing, T2 stock/purchases and T3 owner clarity pass with first-day staff.
- [ ] D1 busy counter passes.
- [ ] D2 50-product distributor receipt passes.
- [ ] D3 20-strip return across three suppliers passes.
- [ ] D4 internet failure passes for the exact single-PC or multi-counter mode being advertised.
- [ ] D5 10 PM owner review and closing reconciliation pass.
- [ ] Existing implemented extensions and their provider/clinical/financial boundaries pass affected acceptance.
- [ ] Actual existing-system import, catalogue rights, commercial terms and support are accepted.
- [ ] Provider, hardware, deployment, backup/restore and full CI/release gates pass on the selected revision.

The launch claim must match these accepted capabilities. The immediate sales objective is a successful controlled pilot, followed by release of the scope that the actual store has demonstrated.
