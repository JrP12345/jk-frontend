# Restricted dispensing and register evidence (T07)

Technical implementation: 20 October 2026. Local only; no real qualifications, classifications, approvals, indexes or production records were populated. This extends the connected patient/prescription dispense route; it does not add an external-prescription or standalone sale endpoint.

## Supply boundary

`POST /api/pharmacy/dispense` retains the existing prescription authority, branch permissions and stable idempotency key. Its server-created dispense/invoice IDs, actor, issue time and prescription allocations now reach the allocator. Display names or registration strings from a request cannot supply missing evidence.

New Schedule H/H1 supply requires a matching reviewed medicine classification; current branch-specific professional reviews for the operator and prescriber; active staff membership and users; an active doctor profile with matching registration; actual recipient name/address; and sealed prescriptions in the latest signed clinical note. The note signer, prescribed catalogue item and sealed registration must match. A focused completion without that signed record cannot authorize restricted supply. Explicit catalogue substitution remains available for general medicines under T05; restricted substitutions require a separately validated prescription workflow.

The pharmacist needs an explicit all-branch or selected-branch staff grant. Professional reviews include registration, council, professional address, evidence reference, review deadline, status, reviewer, time and revision. This is a reviewed operator assertion, not an automated government registration lookup. A future review deadline is not a claim about a licence's statutory expiry.

Schedule X and narcotic supply always return `409`, including for reviewed staff. Missing/unknown stored classification also requires review; schema defaults do not establish a missing legacy classification. Existing explicitly stored general medicines retain their connected workflow without an H1 register entry. The code does not infer legal schedules from drug names or certify that a legacy general classification is correct; catalogue and physical supervision review remain necessary before activation.

The allocator checks restricted evidence before stock deltas. It writes one captured row for each prescription/lot allocation, with actual quantity, batch identity/expiry, patient/prescriber/pharmacist particulars, review references/revisions and note/encounter/dispense/invoice links. Multiple prescriptions sharing one medicine and split FEFO lots reconcile without duplicating quantities. Aggregate stock needs its actual batch label and known eligible expiry. No zero-ID recipient, fabricated address/name/registration or untracked-batch placeholder is created. Genuine short names and batch identifiers are accepted.

Stock, movements, register entries, source fulfillment, invoice, required audit and encrypted replay result share the existing replica-set transaction. Failure rolls back the whole command. Staff/profile/qualification write locks serialize changes with issue. A retry or recovery reads the original committed result before new-issue qualification checks; revoked staff/branch authority still denies route access. T05's single-use selected prescription boundary remains; no repeat authorization or quantity allowance is inferred from dosage text. Quantity-partial/repeat semantics remain T27.

## Reviewed configuration API

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

## Historical entries and exports

Register entries are append-only through document/query/delete/bulk model operations. New writes require versioned captured evidence. Old incomplete entries remain unchanged and readable with `requiresReview` and `missingEvidence`; absent fields are never invented or backfilled.

Existing list/export URLs retain branch and organization authorization and now use `no-store`. Their default schedule is H1. Explicit `scheduleType=schedule_h` selects the prescription register view; explicit X/narcotic filters retrieve historical records only. Unknown schedule filters are rejected. Each row identifies its `registerKind`; an H1 export excludes H entries. Existing IDs and stored values remain intact.

The professional-review unique index and partial register source/lot/prescription unique index need the existing index preparation/release workflow. No index maintenance was applied to live data during implementation. There is no deletion/TTL policy on the register.

## Regulatory and operational release evidence

The [CDSCO Drugs Rules compilation dated 9 September 2024](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/drug_rules/Drugs%20Rules%201945_2024%2009.09.2024.pdf) records the Rule 65 H1 particulars and three-year retention requirement, prescription controls and pharmacist supervision requirements. H1 evidence includes the prescriber's name/address, patient name, medicine and quantity. The implementation captures additional operational facts and separates H1 exports. This is a technical mapping, not a certification of current drug classifications or acceptance of an electronic register/signature process.

Before activation, the pharmacist/licensing reviewer must verify current central/state requirements and amendments, the real drug schedules and registrations, seller/prescription endorsement and signature practice, retention/inspection/export procedures, supported quantities and physical supervision. `signatureMode: reviewed_electronic_record` identifies the captured authenticated operator action and source record; it does not assert a legally certified digital signature. External prescriptions, repeats, Schedule X/narcotic permissions and additional signature/document workflows remain unavailable until separately implemented and validated. No local test supplies professional or real-device approval.
