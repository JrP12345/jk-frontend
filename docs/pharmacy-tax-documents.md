# Pharmacy tax documents and numbering (T06)

Implemented locally; not deployed. This contract covers the existing connected, patient-required counter supply. It does not activate a store or certify a real issuer's tax registration, classifications, licences, turnover obligations, signature process or professional review.

## Numbering and historical records

New numbers allocated through `utilities/invoiceNumber.ts` use a globally reserved four-character branch series and an India financial-year counter: `I00012627/000001` is 16 characters. This implements the financial-year uniqueness and length boundary recorded in [CBIC's invoice rules](https://cbic-gst.gov.in/invoice-rules.html). The series is reserved independently of ObjectId suffixes, persists across financial years and cannot be edited through the model. Financial years change at midnight in Asia/Kolkata on 1 April. The six-digit sequence stops at 999999; exhaustion or corrupt counter state requires a reviewed numbering change. No truncation, wraparound or automatic reset occurs. The current two-digit year encoding supports financial years beginning 2000–2098; another numbering version is required beyond that range.

Number reservation, stock, source fulfillment, invoice, audit and encrypted command result participate in the existing receipt transaction. Old invoice numbers, rupee amounts, IDs and read URLs remain intact. Ordinary clinical callers retain the string-returning numbering helper and receive new short numbers; this does not classify their documents as reviewed pharmacy tax invoices.

## Explicit configuration

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

## Issue, pricing and source integrity

For a new dispense command, missing/unreviewed/unsupported settings return a review conflict before commit. Any classification or document failure after allocation rolls back the entire transaction. Replay still reads the original T04 encrypted result before current mutable tax validation.

The server captures actual lot quantities and sale prices in the committed supply. For this scope prices are inclusive, so GST is decomposed from the existing counter price, never added on top. New line facts store integer paise and the `inclusive-paise-v1` policy. The base is rounded half up from the inclusive gross using integer arithmetic; CGST and SGST split the remaining tax with an odd paise assigned to SGST. Every line and document reconcile exactly to the captured gross. The real issuer's professional review must approve that explicit rounding policy and examples before release. T16 extends the calculator to retail quotes, discounts, units and other supported cases.

Regular suppliers produce a tax invoice for taxable lines, a bill of supply for explicit zero/exempt lines, or an invoice-cum-bill of supply for a supported mixture. Composition suppliers use a bill of supply and the composition notice without collecting GST. Unregistered suppliers use an ordinary pharmacy bill and collect no GST. These document distinctions and collection limits are based on [CGST Rules 46/46A/49](https://cbic-gst.gov.in/pdf/01012020-CGST-Rules-2017-Part-A-Rules.pdf) and [CGST Act Sections 31/32](https://cbic-gst.gov.in/hindi/CGST-bill-e.html), subject to the issuer's current professional review. A recipient name is required. At values of ₹50,000 or more, an address and explicit GST state code must also be recorded; a legacy free-text state name is not guessed into a code. Counter delivery is captured at the issuer's branch address. The location remains the captured place of supply for this local counter workflow.

Each new pharmacy supply issues a separate document, even when an unpaid clinical draft exists. It carries `documentVersion: 1`, numbering metadata, `issuedAt`, an issuer/recipient/tax snapshot, original source-line IDs and a link to the existing visit bill when one exists. Payment status remains independent: an issued invoice may be unpaid. Clinical drafts and prior pharmacy documents remain unchanged. Both charge compilers exclude pharmacy lines already issued on another bill, and clinical checkout settles its clinical bill separately. Current invoice installment collection can settle the pharmacy document while preserving its captured issue fields. Counter/provider settlement projects the combined posted visit balances; paying pharmacy first does not hide an unbilled consultation. A pharmacy gateway callback cannot replace the consultation's canonical invoice/fee pointer.

Application saves, query changes, deletes and bulk-write bypasses cannot rewrite an issued document's identity, source lines, amounts or issuer snapshot. A new supply needs another linked document. Cancellation/refund/credit correction remains the reviewed returns workflow in T19; removing an invoice is not stock reversal. Out-of-band corruption causes source verification/recompilation to stop rather than recreate a charge.

## Printing and release gates

The existing unified print lifecycle renders the captured issuer, licence/GST particulars, recipient and delivery address, document kind/number/FY/issue time, HSN/quantity unit, rates, tax components and captured amounts. It does not replace these with today's clinic branding, patient name or prices. Incomplete issued snapshots cannot fall back to a generic clinical invoice. Legacy invoices keep their existing generic presentation. Clinical checkout no longer labels its unreviewed receipt a tax invoice.

This version uses `manual_on_print`: the authorized representative must sign the printed document. It does not fabricate a signature image or claim a cryptographically signed tax invoice. Real printer/browser, signature and handover practice require review and pilot evidence. Electronic reporting/QR/IRN requirements must be evaluated by the issuer's professional reviewer; declaring them required blocks this implementation's issue path.

Release also requires the existing index-maintenance workflow to prepare `InvoiceSeries`, `PharmacyTaxProfile` and invoice source-line indexes before writes are enabled. No index application, migration, live configuration, professional approval or deployment runs during local tests. Existing controlled-register completion remains T07. Full release gates remain in T26.

Official sources linked above were accessed 19 October 2026. The live invoice-rules page could not be fully fetched during this increment; indexed official provisions and the official rules PDF were used as cross-checks. Professional review of current applicability remains a release requirement, not a completed local test.
