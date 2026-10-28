# Pharmacy dispensing and counter workflow

Current implementation contracts, consolidated 24 October 2026. Examples are illustrative. Local implementation and dated checks do not establish live professional, provider or deployment approval. Use [release evidence and operating gates](pharmacy-release-evidence.md) for those prerequisites. New installations need current schema setup, not hypothetical historical migrations.

- [Prescription and charge authority](#prescription-and-charge-authority)
- [Explicit quantities and partial fills](#explicit-quantities-and-partial-fills)
- [Restricted supply and register evidence](#restricted-supply-and-register-evidence)
- [Dispense submission and recovery](#dispense-submission-and-recovery)
- [Keyboard counter and held carts](#keyboard-counter-and-held-carts)
- [Committed document printing](#committed-document-printing)

## Prescription and charge authority

Connected dispensing is patient and visit based. Rows without explicit sealed quantity retain one-supply semantics; explicit quantity supports the partial-fill contract below. Standalone retail sales use the patient-optional invoice contract. [T06 now issues separate pharmacy documents](pharmacy-finance.md#issuer-and-issued-tax-documents) and requires reviewed tax configuration for new supply. This is a local implementation, not a production release.

`POST /api/pharmacy/dispense` retains the T04 idempotency and recovery contract. New commands require a nonempty, duplicate-free `prescriptionIds` selection. Every selected row must be active, sealed with a valid hash/signature, not superseded/deleted, and associated with the same organization, branch, patient, prescriber and completed encounter. A supplied doctor, encounter or appointment must match the source; omitted visit references are derived from that source.

Authority comes from the current signed/amended clinical note and its selected prescription IDs; ambiguous multiple latest notes require review. A prescription-only amendment absent from the current note requires explicit clinical reconciliation; dispensing does not rewrite the signed note or guess its membership. The existing focused completion path deliberately has no SOAP note: it requires the completed linked appointment and the matching `CONSULTATION_COMPLETED_WITHOUT_CLINICAL_NOTE` audit. A draft or stale note cannot fall back to focused authority. Ordinary visit completion now seals its finalized prescription rows as well. Pending queues, public tracker and prescription printing select finalized current rows.

The workspace sends explicit mappings before stock aggregation:

```json
{
  "prescriptionIds": ["<rx A>", "<rx B>"],
  "items": [{ "medicineId": "<stock medicine>", "quantity": 7 }],
  "prescriptionAllocations": [
    { "prescriptionId": "<rx A>", "medicineId": "<stock medicine>", "quantity": 3 },
    { "prescriptionId": "<rx B>", "medicineId": "<stock medicine>", "quantity": 4 }
  ]
}
```

Every selected prescription appears once, every stock line is covered exactly, and mapped positive whole quantities reconcile with the aggregated stock quantity. Selecting a different catalogue item remains an explicit operator choice for general medicines; T07 requires restricted supply to match the prescribed catalogue item and current reviewed registration in its sealed source. No medicine name, dosage or duration is used to guess a match or quantity. Older callers can omit mappings only for an unambiguous one-to-one catalogue association or a single prescription/single stock selection. Ambiguous selections return `409` before stock changes. A request without prescription authority also returns `409`; it cannot act as an undocumented retail-sale endpoint.

The receipt transaction locks the encounter, linked appointment and current note. It writes stock movements, an append-only `PharmacyDispense`, invoice lines carrying `pharmacyDispenseId` and `pharmacyDispenseLineId`, conditional fulfillment revisions, audit and encrypted replay result together. The source stores the selected prescription-to-stock quantities, actual FEFO batches and actual sale amounts. Unique source-prescription and invoice-source-line indexes reinforce the conditional write boundary. A deliberately different key cannot supply an already completed row again. Unselected rows remain pending. A replay of an older T04 receipt still returns its original encrypted snapshot before current prescription checks.

Both encounter billing and appointment checkout use those committed sources. Unissued historical T05 bills retain their exact source quantities and prices when recompiled. New T06 pharmacy documents are issued separately; clinical compilation lists their linked bills and excludes their source lines from another invoice. Missing, cancelled, refunded, deleted or altered source invoices require review; the compiler never recreates their medicine charges. Unfilled finalized prescriptions appear separately as **awaiting pharmacy supply (unbilled)** and contribute no amount. The old quantity-one catalogue estimate and appointment free-text price fallback are removed.

New server-generated consultation and consolidated bills carry `clinicalChargeVersion: 1`, identifying the compiler that no longer estimates pharmacy charges. The marker is not accepted from manual invoice input. An unversioned historical or unclassified manual visit bill requires provenance review before dispensing or checkout recompilation. There is no automatic text matching, historical reclassification or migration. Ordinary invoice history and existing settlement routes remain available. Operational review tooling remains later work.

T06 supersedes new unpaid-clinical-draft append behavior: each new pharmacy supply issues a separate document and links to the existing visit bill where present. Draft, paid, partially paid and issued clinical bills stay unchanged. Issued pharmacy amounts and issuer snapshots cannot be rewritten; payment collection remains available. Historical rows are not retrospectively classified or re-taxed. Standalone issuance/calculation, controlled-register evidence and source-bound returns/refunds are implemented in the corresponding chapters of these guides.

Release preparation must include the new source and partial unique invoice-line indexes through the existing database-index maintenance workflow. No index application or production data changes run as part of local verification. Existing T04 uncertain-response and reload behavior remains in force; a missing lookup result never authorizes a replacement reference.

T07 now adds reviewed H/H1 professional/classification evidence, actual recipient/prescriber details and captured append-only register rows to this transaction. Restricted supply requires the matching signed clinical note; focused completion alone does not establish that evidence. X/narcotic supply remains blocked. See [the restricted dispensing contract](pharmacy-dispensing.md#restricted-supply-and-register-evidence); professional/production approval remains pending.

T27 supersedes the selected-row completion rule for explicitly quantified prescriptions: exact remaining allowance/revision, repeated partial supplies and per-revision fulfillment claims now apply. Unquantified sources retain a single supply. See [the quantity contract](pharmacy-dispensing.md#explicit-quantities-and-partial-fills); the source, billing, sealed-instruction and replay controls above remain in force.

## Explicit quantities and partial fills

Implemented locally; no production activation or professional approval is asserted. This extends the existing clinical prescription/dispense/invoice flow. It does not introduce another stock, billing or medical-record engine.

The clinician can enter `authorizedQuantity` (1–1,000,000 whole base units) and `authorizedBaseUnit` together when creating a draft prescription. The SOAP editor retains these fields, disables them on a signed note and prints the authorized quantity. Focused consultation completion accepts the same explicit pair. Both fields and the prescribed medicine identity are included in the seal; query changes to a sealed quantity are rejected and out-of-band changes fail integrity verification.

No quantity is inferred from dosage, frequency or duration. Without the explicit pair, a prescription retains a single supply and cannot be repeated with another operation key. External prescriptions/repeats remain unsupported pending their separate reviewed evidence and policy. Existing clinical source, branch, patient, prescriber, finalized-note, product and restricted-drug checks remain required.

The pending queue exposes `fulfillment`: mode, authorized/supplied/remaining quantities, base unit, revision and bound medicine identity. For quantity mode, every selected prescription allocation must send `expectedFulfillmentRevision` and `expectedRemainingQuantity`. Positive whole supply cannot exceed the allowance or change its stock identity/base unit. Quantities are compared as integers in their stated base unit. Source access remains bound to its clinical branch; another dispenser at that authorized branch can use the refreshed allowance. A different branch has no implicit source permission.

The existing recorded transaction pins the finalized encounter/note, allocates actual FEFO stock, creates an append-only supply and its separate issued invoice, advances the source revision and adds the supplied quantity. An unfinished row stays active; completion changes it to dispensed. Each supply stores reconciled before/after quantity snapshots. A unique per-prescription/revision fulfillment claim complements the source conditional write; current source indexes must be prepared explicitly before new quantity supplies. Stale development constraints return readiness failure rather than being silently replaced. Setup never drops an index from an application request.

For 30 authorized tablets, supplies of 10 and 20 produce remaining allowances of 20 and 0. Concurrent 25-unit requests against the same 30-unit revision cannot both succeed. Retry/recovery returns the original encrypted receipt snapshot, even after later fills. H/H1 evidence is checked for every fill and captured against its actual supply/lot; replay creates no additional register entry.

Every fill invoices only its actual units at actual allocation prices. Prior clinical drafts, issued/paid invoices and payments remain unchanged. Charge recompilation reports the linked pharmacy invoices and outstanding prescription allowance; it does not copy their charges into another bill. The tracker reports partial status and supplied/remaining quantities without staff evidence or prescription hashes. Clinical print retains the original instructions and authorized total rather than presenting remaining stock as a new prescription.

Returns and commercial credits do not replenish prescription allowance. An amendment is a separate prescriber action, serialized with fulfillment; after any supply it requires an explicit new quantity. It records a new sealed prescription and preserves earlier supply facts. A new prescription still needs the current finalized clinical-note authority before dispensing; supersession alone does not authorize further supply.

## Restricted supply and register evidence

Technical implementation: 20 October 2026. Local only; no real qualifications, classifications, approvals, indexes or production records were populated. This extends the connected patient/prescription dispense route; it does not add an external-prescription or standalone sale endpoint.

### Supply boundary

`POST /api/pharmacy/dispense` retains the existing prescription authority, branch permissions and stable idempotency key. Its server-created dispense/invoice IDs, actor, issue time and prescription allocations now reach the allocator. Display names or registration strings from a request cannot supply missing evidence.

New Schedule H/H1 supply requires a matching reviewed medicine classification; current branch-specific professional reviews for the operator and prescriber; active staff membership and users; an active doctor profile with matching registration; actual recipient name/address; and sealed prescriptions in the latest signed clinical note. The note signer, prescribed catalogue item and sealed registration must match. A focused completion without that signed record cannot authorize restricted supply. Explicit catalogue substitution remains available for general medicines under T05; restricted substitutions require a separately validated prescription workflow.

The pharmacist needs an explicit all-branch or selected-branch staff grant. Professional reviews include registration, council, professional address, evidence reference, review deadline, status, reviewer, time and revision. This is a reviewed operator assertion, not an automated government registration lookup. A future review deadline is not a claim about a licence's statutory expiry.

Schedule X and narcotic supply always return `409`, including for reviewed staff. Missing/unknown stored classification also requires review; schema defaults do not establish a missing legacy classification. Existing explicitly stored general medicines retain their connected workflow without an H1 register entry. The code does not infer legal schedules from drug names or certify that a legacy general classification is correct; catalogue and physical supervision review remain necessary before activation.

The allocator checks restricted evidence before stock deltas. It writes one captured row for each prescription/lot allocation, with actual quantity, batch identity/expiry, patient/prescriber/pharmacist particulars, review references/revisions and note/encounter/dispense/invoice links. Multiple prescriptions sharing one medicine and split FEFO lots reconcile without duplicating quantities. Aggregate stock needs its actual batch label and known eligible expiry. No zero-ID recipient, fabricated address/name/registration or untracked-batch placeholder is created. Genuine short names and batch identifiers are accepted.

Stock, movements, register entries, source fulfillment, invoice, required audit and encrypted replay result share the existing replica-set transaction. Failure rolls back the whole command. Staff/profile/qualification write locks serialize changes with issue. A retry or recovery reads the original committed result before new-issue qualification checks; revoked staff/branch authority still denies route access. No repeat authorization or quantity allowance is inferred from dosage text. Unknown quantities retain one-supply semantics; explicit sealed quantities use the partial-fill contract above.

### Reviewed configuration API

These endpoints require pharmacy staff, the pharmacy module, `MANAGE_ORGANIZATION` and branch authority. Ordinary medicine-management permission cannot approve professional evidence or change sale restrictions.

`GET /api/pharmacy/locations/:locationId/professionals/:userId/:profession` returns the existing review or null, with `Cache-Control: no-store`. `profession` is `pharmacist` or `prescriber`.

`PUT` to that same URL accepts:

```json
{
  "expectedRevision": 0,
  "registrationNumber": "<actual registration>",
  "council": "<actual registration council>",
  "address": "<actual professional address>",
  "reviewReference": "<completed professional evidence review reference>",
  "validUntil": "<review deadline as ISO timestamp>",
  "active": true
}
```

The subject must be an active staff member of the organization. Prescriber registration must match the active doctor profile. Use the current revision when replacing or revoking a review. Reviewer/time/organization come from the server; stale revisions conflict and audit failure aborts the change. A revoked review blocks new restricted supply while preserving captured history.

`PUT /api/pharmacy/medicines/:id/dispensing-classification` accepts:

```json
{
  "expectedRevision": 0,
  "scheduleType": "schedule_h1",
  "reviewReference": "<actual current sale restriction review reference>"
}
```

Allowed declarations are `general`, `schedule_h`, `schedule_h1`, `schedule_x` and `narcotic`; the last two remain blocked for supply. This API records the review and increments `dispensingRevision`; it returns classification fields without acquisition costs. An ordinary medicine PUT may retain the current schedule but cannot change it. A missing stored schedule blocks unrelated metadata edits too, preventing a hydrated schema default from silently becoming the sale classification. Approved reclassification is explicit and audited. Configuration UI is subsequent work; there is no new evidence-file upload or acceptance of public attachment URLs. Internal signed prescription IDs provide the supported source evidence.

### Historical entries and exports

Register entries are append-only through document/query/delete/bulk model operations. New writes require versioned captured evidence. Old incomplete entries remain unchanged and readable with `requiresReview` and `missingEvidence`; absent fields are never invented or backfilled.

Existing list/export URLs retain branch and organization authorization and now use `no-store`. Their default schedule is H1. Explicit `scheduleType=schedule_h` selects the prescription register view; explicit X/narcotic filters retrieve historical records only. Unknown schedule filters are rejected. Each row identifies its `registerKind`; an H1 export excludes H entries. Existing IDs and stored values remain intact.

The professional-review unique index and partial register source/lot/prescription unique index need the existing index preparation/release workflow. No index maintenance was applied to live data during implementation. There is no deletion/TTL policy on the register.

### Regulatory and operational release evidence

The [CDSCO Drugs Rules compilation dated 9 September 2024](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/drug_rules/Drugs%20Rules%201945_2024%2009.09.2024.pdf) records the Rule 65 H1 particulars and three-year retention requirement, prescription controls and pharmacist supervision requirements. H1 evidence includes the prescriber's name/address, patient name, medicine and quantity. The implementation captures additional operational facts and separates H1 exports. This is a technical mapping, not a certification of current drug classifications or acceptance of an electronic register/signature process.

Before activation, the pharmacist/licensing reviewer must verify current central/state requirements and amendments, the real drug schedules and registrations, seller/prescription endorsement and signature practice, retention/inspection/export procedures, supported quantities and physical supervision. `signatureMode: reviewed_electronic_record` identifies the captured authenticated operator action and source record; it does not assert a legally certified digital signature. External prescriptions, repeats, Schedule X/narcotic permissions and additional signature/document workflows remain unavailable until separately implemented and validated. No local test supplies professional or real-device approval.

## Dispense submission and recovery

T04 adds recorded commands to the existing clinic dispensing endpoint. It preserves its patient-required workflow, FEFO allocator, invoice creation/unpaid-visit append, audit and prescription status update. [T05's prescription authority contract](pharmacy-dispensing.md#prescription-and-charge-authority) now strengthens new commands with finalized prescription selection, explicit allocations and committed supply provenance; existing T04 receipts remain replayable. Complete controlled-register evidence is T07. This increment is not a standalone pharmacy release.

### Submit once and retry the same operation

`POST /api/pharmacy/dispense` now requires `Idempotency-Key`, containing 8–100 letters, digits, underscores or hyphens. A UUID is suitable. Missing/invalid mutation-key syntax returns `428`; keys outside the recorded-command format return `400`. The server never generates a replacement key. The existing body is unchanged; item arrays are capped at 100 and selected prescription IDs at 200.

```http
POST /api/pharmacy/dispense
Idempotency-Key: <stable UUID for this deliberate dispense>
Content-Type: application/json
```

```json
{
  "patientId": "<patient ObjectId>",
  "doctorId": "<doctor user ObjectId>",
  "locationId": "<location ObjectId>",
  "encounterId": "<encounter ObjectId>",
  "prescriptionIds": ["<selected prescription ObjectId>"],
  "items": [{ "medicineId": "<medicine ObjectId>", "quantity": 2 }]
}
```

The trusted organization, branch and operation kind scope the receipt. The authenticated operator is bound into its payload hash and encrypted response. IDs are normalized and item/prescription order canonicalized. Same key and details replay the original result; changed details or another actor reusing that key return `409`. A key is a command identity, not a permission grant.

The existing `data` invoice shape remains, with an added `dispenseOperation`:

T06 now issues a separate pharmacy document for each new supply, so new commands return `appendedToExisting: false`. Earlier receipts may retain `true` and still replay exactly. See [the current tax-document contract](pharmacy-finance.md#issuer-and-issued-tax-documents) for reviewed configuration and issue gates; this document's sample below also describes historical append receipts.

```json
{
  "version": 1,
  "key": "<original key>",
  "invoiceId": "<actual created or appended invoice>",
  "invoiceNumber": "<invoice number>",
  "locationId": "<location ObjectId>",
  "addedAmount": 24,
  "appendedToExisting": true,
  "allocations": [{
    "medicineId": "<medicine ObjectId>",
    "quantity": 2,
    "lineAmount": 24,
    "batches": [{ "batchId": "<batch ObjectId>", "batchNumber": "B-1", "quantity": 2 }]
  }]
}
```

First commit returns `201`; replay returns `200`. `Idempotency-Replayed` identifies the latter. The response snapshot includes the invoice at posting, the actual added amount and allocations. It stays identical after payment, later invoice edits, stock depletion, medicine soft deletion or prescription fulfillment. Use normal billing reads for current invoice state; the recovery result reports the committed operation.

The existing command helper owns the transaction. It claims the receipt, reloads mutable business state, allocates stock, records movements, writes/extends the invoice, updates prescriptions, appends the required audit, saves the encrypted versioned response and result link, and commits with majority write concern. New receipt durability options are optional; existing helper callers retain their defaults. Required-write failures roll back all effects. Non-finite response amounts also reject the transaction. Existing FEFO and register services participate in the same session. WebSocket updates are best effort after commit, and replay does not emit another notification.

### Recover a committed result

`GET /api/pharmacy/dispense-operations/:key?locationId=<location ObjectId>`

Both submission and lookup require current authenticated pharmacy staff, the pharmacy module, `PHARMACY_DISPENSE_RESTRICTED` (or legacy `MANAGE_MEDICINES`) and branch authority. T08's [location capability](pharmacy-capabilities.md) blocks new supply when disabled while allowing authorized lookup/replay of committed results. Lookup returns the initiating operator's recorded response. Another actor cannot retrieve it merely by knowing the key. Branch/role revocation is checked before replay or lookup. All lookup responses, including `404`, use `Cache-Control: no-store`.

A `404` means **no committed result is currently visible**. It does not certify rollback or authorize a new key. A timeout, unavailable transaction, corrupt snapshot, network failure or failed lookup keeps the original reference for retry/review. Repeating the original POST with the original body/key is safe; the receipt is checked before mutable stock/prescription validation. Standalone MongoDB fails closed.

### Frontend lifecycle

The workspace reserves an opaque key before dispatch and pins the payload in memory. Axios requires that explicit key and preserves it across token refresh. A transport failure triggers a lookup; the operator can check again or retry the same in-memory payload/key. Queue refresh, depleted stock or changed selections do not turn that retry into another command.

Only the key is saved in local browser storage, under the effective actor/organization/impersonation/branch namespace. No patient, prescription, selection, invoice or financial body is persisted. Storage failure prevents dispatch. Where available, Web Locks serialize reference reservation across tabs; storage events update the other open workspace. A receipt can acknowledge only its own reference, so an older tab cannot clear a newer pending operation.

Reload restores the reference and performs an authorized lookup. It does not automatically resubmit or reconstruct an unavailable request body. If a committed result is found, the workspace displays the actual invoice number, added amount and total at posting. The operator acknowledges it with **Done** before another dispense. If lookup remains unresolved and the in-memory payload is gone, keep the reference for operator review; exception-resolution tooling belongs to T18. No new bill is offered while that reference remains unresolved.

Identity or branch changes discard private drafts and ignore late responses in that workspace. Returning to the original scope can recover its saved reference. No financial body is carried into the new scope. T05's prescription-source validation now prevents duplicate source fulfillment under deliberately different keys; operation idempotency alone does not establish clinical authority.

### Compatibility and release scope

The repository's frontend and affected backend callers now submit stable keys. Other deployed integrations must adopt the header before enforcing this backend version. No migration, production deployment, price/tax change, payment-provider action or browser financial-body persistence is part of T04. T07 now supplies trusted controlled-route context and validates restricted evidence inside the transaction; the recovery regression uses the production HTTP route under concurrent retries. See [the restricted dispensing contract](pharmacy-dispensing.md#restricted-supply-and-register-evidence). Professional and production validation remain release gates.

## Keyboard counter and held carts

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

## Committed document printing

T18 adds bill and collection-receipt previews to the existing pharmacy workspace. Saved sales, recovered sales and confirmed clinical dispensing can open the same issued pharmacy document component. Printing never calls issue, dispense, collection or numbering routes.

The preview uses the captured issuer/recipient, number, date, prices, units, batches, printed expiry/MRP, tax, discounts and round-off. Missing or inconsistent issued evidence disables print instead of reconstructing it from current masters. A collection receipt is a separate document: its original group ID, invoice, actual actor/date, method components, received amount, remaining balance, tender and change come from the append-only receipt. Later collections do not rewrite an earlier partial receipt. Invoice/branch/number and original receipt totals must reconcile before print.

A4 retains the tabular bill. The 80 mm and 58 mm previews use labelled stacked line facts, repeated table headings on A4 and printable width accounting for roll margins. `printElement` and existing print controls isolate the saved document from dashboard navigation and report preparation errors. Cancel, unavailable browser printing or printer failure leaves the saved result visible for retry/reprint. No successful physical print, drawer event or print count is inferred from opening a device dialog.

Sales history includes original-reference recovery using the existing actor/branch-authorized endpoint. This remains reachable when new sales are disabled. Only opaque account/organization/impersonation/branch-scoped identity is stored; no customer/cart/financial body is cached. An unresolved result is retained. Recovery never starts a new command, and acknowledging one recovered reference cannot clear a different pending sale. Branch/account changes clear private preview/recovery state. Existing T04 clinical dispense recovery remains available with its existing authority; its committed result can be printed when complete issued evidence exists.

Synthetic DOM tests cover supported paper selections, captured bill/partial-receipt fields, malformed and foreign receipt rejection, failure/reprint with no mutations, readonly sales history, opaque recovery, unresolved references and late/changed-branch results. These checks do not certify physical 58/80 mm/A4 printers, scanners, browser print engines or legal/professional approvals. Real-device and release evidence remain T26.
