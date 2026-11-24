# Pharmacy POS extensions — 22 November 2026

This extends the existing counter, invoice, lot, collection, purchase and reporting services. It does not replace them. Source changes include the existing local daily-workflow changes; no working-tree reset, data seed, live provider request, catalogue publication or deployment was performed.

## Implemented

| Feature | Entry point and supported behavior |
| --- | --- |
| Sales contribution | Reports → Sales margin after return credits. Original captured revenue excluding GST, source-linked return credits, acquisition cost and contribution per invoice. Cost fractions are combined before rounding once per invoice. Missing costs stay unknown and make corresponding totals unknown. Independent cost, sales and return permissions are required. |
| Expiry exposure and write-offs | Reports → Acquisition cost at risk of expiry / Damaged and expired stock write-offs. Expiring on-hand stock is separated from actual recorded disposals. Count corrections and supplier returns are not disposal losses. |
| Accountant handoff | Load a complete tax or customer return-credit report, then Tally accounting export. Map existing ledger names. Balanced accounting-view Sales/Credit Note XML includes deterministic source identities, escaped fields, branch-local dates and audited report/mapping/document digests. Zero-value sources have no accounting movement. |
| Pharmacy online payments | Owner issuer settings → Pharmacy merchant payment gateway. Saved unpaid bill → online payment section in collections. Uses this pharmacy's encrypted Razorpay credentials, never platform subscription credentials. Reopens the original provider order, verifies captured payment from the server, and posts a uniquely linked provider-verified collection through the existing drawer/receipt transaction. |
| Payment recovery | Signed merchant webhooks preserve captured-payment evidence. Popup callbacks are not proof of payment. Uncertain order creation does not repeat the provider POST. An already captured payment against a changed invoice/drawer is held for reconciliation instead of collecting/posting twice. Staff verify and allocate the original payment using the saved bill. |
| Settlement matching | Reports → Reconcile pharmacy merchant settlements. Fetch a provider settlement date and page. Only payments linked to the current branch's intents are exposed; provider fees/tax and ledger match state are displayed. Other merchant transactions are filtered out. |
| Customer follow-ups | Counter → recorded customer → Customer reminders. Explicit refill date or outstanding-invoice follow-up, customer email consent/reference, cancellation, delivery status and original-request recovery. Email addresses are pinned at consent capture and rechecked before queueing and sending. Dates do not come from dosage inference. |
| Member pricing | Owner edits a customer in Purchases & parties and sets an optional percentage. A priced counter bill offers Apply member discount. The reviewed amount becomes the existing invoice discount and is revalidated by the existing sale path. This does not create a points ledger. |
| Brand comparison | Inventory product actions → Compare medicine brands. Bounded exact recorded generic-name, strength, dosage-form and base-unit matches, with stock, display price, manufacturer and rack. No automatic prescription replacement or supply permission is granted. |
| Invoice OCR | Purchase draft → CSV import → Extract a supplier invoice PDF or photo. Configured Azure prebuilt-invoice extraction, explicit processing authorization, verified file signatures, bounded PDF/JPEG/PNG and durable original-reference recovery. Extracted quantities/units/prices remain raw text and enter the existing reviewed CSV-mapping workflow only after confirmation. No stock, purchase posting or tax approval occurs during extraction. |
| Larger exports | Reports → Prepare a larger report in the background. One database snapshot, up to 25,000 source records, 50,000 result rows, 40 seconds of read work and 16 MB CSV. Encrypted bounded chunks, original-request recovery, current source authorization, integrity-checked/audited download and seven-day derived-copy expiry. Oversized/incomplete exports fail instead of returning partial results as complete. |

## Financial interpretation

The contribution report retains original acquisition cost while customer returns remain quarantined. It shows all source-invoice credits through the read time for invoices issued in the chosen period. It is not a period accounting P&L: costs can include tax according to original receiving policy, operating expenses are excluded, and disposal reports must not be mechanically subtracted again for returned items whose original costs were retained. Billing-only sales have no invented inventory costs. Unknown financial cells are not zero.

Tally export currently covers original sales tax amounts and source-bound customer credit notes. Receipts, purchases, full accounting books, statutory GST returns, e-invoicing and actual Tally import acceptance are separate. Review mapped ledgers and imported voucher results in a test company before operational use; deterministic identities do not replace checking the import result or authorize blind re-import.

Provider settlement data is not proof of a bank-statement deposit. Provider refunds remain a separate reviewed operation. This implementation never fabricates a refund, clears a captured reconciliation exception, or changes stock to repair a payment discrepancy.

## Configuration and operating prerequisites

- Configure the actual pharmacy's Razorpay test account through owner settings. Each configuration save requires the actual key secret and webhook secret; secrets are never read back. No default account is activated. Set the merchant's `payment.captured` webhook to the public API origin plus the exact organization-scoped path displayed in settings. Configure allowed checkout origins and verify the merchant's actual payment methods before live use. Existing in-flight orders retain encrypted original gateway evidence across credential changes.
- Invoice OCR is disabled by default. Backend `.env.example` documents `PHARMACY_INVOICE_OCR_ENABLED`, `PHARMACY_INVOICE_OCR_ENDPOINT` and `PHARMACY_INVOICE_OCR_KEY`. The approved endpoint must be the HTTPS root of an Azure `*.cognitiveservices.azure.com` resource. Redirects/arbitrary upload destinations are rejected. Approve provider processing/retention/costs before setting the flag. No original invoice bytes are retained in the extraction model.
- Follow-up delivery uses the existing configured platform SMTP service and outbound message worker. Missing configuration leaves scheduled work visible. SMTP/provider delivery acceptance remains distinct from customer receipt; an already transmitted message cannot be recalled. Consent cancellation and current customer, invoice, branch, organization and scheduling-staff authority are checked before dispatch.
- The outbound worker also runs the report-export loop. Jobs and encrypted result chunks use their own bounded derived-artifact models. Use the existing current-schema/index manifest/check/apply workflow for the selected environment before activation. No database/index preparation was run against a configured environment here.
- Keep actual issuer/pharmacist evidence, supported browser/device acceptance, encrypted backup/restore and opening-stock reconciliation in the existing pilot/release checklist. Automated fixtures do not supply those records.

## Remaining scope

Follow-up work is recorded in [supplier response files and counter coordination](pharmacy-supplier-exchange-and-counter-coordination-2026-11-22.md). Exact-order response templates/review and ordinary-counter visibility of offline holds are now implemented. Shared LAN coordination is the selected next architecture; the local multi-counter service remains future work.

- Live distributor-specific catalogue/pricing/order APIs still need the actual distributor's supported API, credentials and agreement. The existing purchase-order/supplier portal remains available. No invented distributor endpoint or stock feed was added.
- CDCI publication remains dependent on the pending affiliate approval and reviewed source activation.
- Simultaneous final billing from multiple disconnected PCs is not implemented. The existing designated-PC authority is retained. This needs a separately validated stock/number partition or a local coordination service, with concurrent recovery tests and an agreed installation model; simply removing the branch ownership checks would permit overselling.
- Refill/dues follow-ups currently use email. No autonomous pharmacy SMS/WhatsApp campaign or points/redemption system was introduced.
- Actual provider acceptance, Tally import, physical scanner/printer output, store performance, external backup/restore and a real pharmacy pilot remain unperformed.

## Verification

Risk level 4: shared money/receipt, customer, inventory-report and outbound-worker boundaries. Verification was batched after implementation and repeated only for affected failures or subsequent changes.

Recorded verification:

- 209 distinct backend cases across 13 affected source files passed across the focused runs and affected reruns. This includes reporting, returns, collections, checkout, offline imports, drawer/till reconciliation, supplier collaboration, customer follow-ups, OCR/provider isolation, asynchronous exports and existing communication dispatch. Counts are deduplicated across runs, not summed.
- The initially selected eight frontend files exercised 202 cases. Five failed expectations were corrected: the added read-only comparison action, lazy OCR consent controls, and an ambiguous status selector. Affected files passed on rerun. Additional server-verified online-checkout and background-export cases passed; the final four-file affected run passed 38 cases. No test or assertion protecting writes/permissions was disabled.
- Both package TypeScript checks passed. Frontend changed-file lint had zero errors and 12 warnings, primarily the repository's effect/dependency diagnostics; the browser probe lint had zero errors and one unused-fixture warning. No lint rule was suppressed. The patient payment-boundary check and both diff checks passed.
- The normal backend API/four-worker build passed using approved access to generated worker outputs. Initial sandbox writes were denied; no process was stopped or output tree deleted to bypass that boundary. A subsequent duplicate progress-export registration was corrected before the successful final build.
- Native-source and built-API startup/configuration/readiness/shutdown checks passed. The first built run exceeded its existing process-exit deadline during concurrent checks; the isolated rerun passed without loosening the deadline.
- The browser probe passed 16 component/viewport scenarios with no document overflow, uncaught browser errors or external requests. Mobile report and OCR screenshots were inspected. Its first attempt targeted the visually hidden native checkbox; the corrected probe clicks the visible label, matching the actual shared-control interaction.

These are scoped development checks, not full CI/release certification. No new Next production build or actual provider/printer/store trial was run. Local artifacts are ignored under frontend `.next/pharmacy-pos-*`, sibling backend `build/pharmacy-pos-*` and `build/pharmacy-export-*`.

The tracked browser probe `scripts/performance/check-pharmacy-pos-extensions.mjs` renders actual components against synthetic local contracts at 360/390/768/1440 pixels. It checks reports/background-export summaries, medicine comparison, consent reminders and reviewed OCR without calling external providers or writing a business database. It uses existing shared built CSS; it is not a newly deployed Next application. Existing Vitest tests separately exercise the actual backend in isolated MongoDB replica sets.

## Provider references

Implementation references consulted: [Tally accounting XML](https://help.tallysolutions.com/sample-xml/), [Razorpay payment status guidance](https://github.com/razorpay/markdown-docs/blob/master/payments/third-party-validation/best-practices.md), [Razorpay settlement reconciliation](https://github.com/razorpay/markdown-docs/blob/master/api/settlements/fetch-recon.md), and [Azure invoice extraction](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/invoice?view=doc-intel-4.0.0). These document API contracts, not approval of this pharmacy's account or operating configuration.
