# Pharmacy supplier rates, registers, original files and stock analysis

Implemented 23 November 2026 against R16, R26, R32 and R33 in the [45-requirement implementation plan](pharmacy-final-implementation-plan-2026-11-22.md). These software increments do not establish actual pharmacy, provider, retention-policy or release acceptance.

## Staff workflows

| Workflow | Where to use it | Delivered behavior |
| --- | --- | --- |
| Supplier rates | Purchases → Compare supplier rates | Search for a medicine, select it, then load the comparison. Shows each supplier's latest posted invoice in the date range, net and GST-inclusive cost per base unit, billed/free quantities and actual received quantities. Open the original invoice for review. Requires purchase and acquisition-cost access. |
| Prescription registers | Pharmacy → Prescription registers | Explicitly load Schedule H1 or the separate Schedule H register. Filter by branch-local dates, medicine, recipient, prescriber or batch; inspect captured professional/source evidence and missing facts. Export all matching records after confirming the scope. Read and export permissions remain separate. |
| Original outside prescriptions | Outside prescriptions → selected reviewed source → Original prescription files | Explicitly load private file metadata, confirm the correct recipient/source and upload an original PDF or image. Download retained files through an audited short-lived link. A file never changes the reviewed allowance or authorizes supply. |
| Stock movement analysis | Reports → Stock movement and slow-moving analysis | Select a 30/60/90/180/365-day observation window. Review gross supplied units, estimated saleable-stock cover, tracking duration and receipt age. Distinguishes recent stock, shorter tracking, absent/incomplete history, no recorded supply and slow stock. Uses existing page/complete/background report and reviewed-export contracts. |

None of these screens loads sensitive records merely because it is imported. Branch, prescription and effective identity changes clear the relevant component; stale asynchronous results cannot populate a different scope. No new roles, permission grants, product prices or provider credentials are seeded.

## Supplier comparison basis

`GET /api/pharmacy/supplier-rates` requires `locationId` and `medicineId`; optional `startDate` and `endDate` select at most 366 calendar days. Defaults cover the last year by branch-local date. Requires both purchase and cost access and an India/INR organization. Unknown fields, invalid dates, future periods and foreign products/branches are rejected. Responses are `no-store`.

One database snapshot reads posted invoices and current units. Drafts are excluded. Latest means supplier invoice date, then posting time and document identity. All matching product lines on that invoice are combined. The net numerator comes from the immutable posted calculation after recorded discounts, excluding GST; the gross numerator includes its GST. Both divide by billed plus free base units. The original inventory tax-cost policy is also displayed. Invoice round-off is excluded. Receipt progress remains separate: an invoice's free goods need not have arrived yet. Returns do not rewrite original purchase rates.

Exact rational comparisons use integer arithmetic; only displayed rupees are rounded to four decimals. Captured unit version/base/pack/factor differences exclude the row from ranking. No factor is guessed. Historical rates do not assert a current quote, supplier eligibility or stock availability. There is no quote adapter or automatic order selection in this increment.

The complete comparison is bounded to 500 matching posted purchases and 10,000 captured lines, with a bounded database query. Exceeding the bound fails the comparison and requests a shorter period; it does not rank a first page as the complete result. Responses omit supplier contact, licence, tax-identity and operator details.

## Register access and exports

The existing register APIs now share branch-local calendar-day and search filters. Both dates must be valid and ordered, or both omitted. Page/limit inputs are strict. Pages use stable time/document ordering and one snapshot for count and rows, with at most 100 rows per page and a bounded pagination depth. The staff screen uses 25 rows and does not automatically read patient records.

Exports load at most 10,001 rows and reject more than 10,000. They do not silently truncate. Audit failure prevents export. The audit records scope/count rather than patient names or search terms. Export responses bind the branch, register and selected filters; the client validates these before preparing Excel-readable CSV. CSV retains captured source/professional fields and review markers and neutralizes spreadsheet formula cells. The full filtered export is a fresh snapshot and can differ from an earlier page after legitimate new dispensing.

The screen labels missing evidence without filling it from current patient or professional records. Existing H/H1 append-only supply and restricted-dispensing boundaries remain unchanged. Register timestamps are explicitly displayed in the device timezone; date filtering uses the branch timezone. Retention, professional review and operating recovery remain activation gates.

## Original file durability and privacy

Outside prescription file APIs live under `/api/pharmacy/external-prescriptions/:id/files` and `:id/file-download`. Existing outside-prescription read/write guards and branch/source authorization apply. Ordinary sales/cost/report access does not grant prescription-file access.

Supported originals are flattened PDF, PNG, JPEG and WebP, up to 4 MB per file and 10 files per reviewed source, including pending files. Metadata, canonical base64, actual signatures and active-content checks run before storage. Uploads are rate limited. Clinical files are not OCR instructions and cannot approve a medicine or supply quantity.

The new `PharmacyPrescriptionAttachment` collection durably reserves one actor/source/request identity and final private object key before the storage call. Filename and object key are envelope encrypted in the database. A pending reservation survives an unknown provider acknowledgement. Retrying the same original filename, MIME and bytes reuses its request and object identity; changing the payload under that key is rejected. Concurrent retries produce one retained attachment and completion audit. The browser derives the opaque request reference from the original file and does not persist patient data or file bytes in local/session storage.

Only a completed, audited attachment is downloadable. Links expire after 60 seconds and download authorization is checked before signing; a failed access audit prevents returning the link. Lists omit object keys, request hashes and operator identities. Retained records reject document, query, replacement, deletion and bulk rewriting. The source prescription's quantity allowance and revision, bills, stock and collections are unchanged by file operations.

Original clinical files and pending storage outcomes have no TTL or automatic deletion. Pending objects remain traceable to a durable reservation; the code does not delete a possibly committed upload. A reviewed retention/legal-hold/purge process, storage/key backup and isolated restore still need operating acceptance. This increment covers outside prescription sources; pharmacy-specific attachment navigation for clinic prescriptions is not added. Real private R2 configuration and provider acceptance are still required. It does not claim antivirus certification or legal compliance from a signature check.

## Stock analysis basis

The new `stock_velocity` report reuses current product/lot reconciliation, sale holds, expired/quarantined exclusions, source permissions, snapshots, report digests and bounded exports. It requires report, stock and movement access and is unavailable in billing-only mode.

A bounded complete movement chain must begin with a captured opening baseline, preserve contiguous revisions and before/after balances, and end at the current product revision/balance. Missing/broken history is unknown. A tracking interval shorter than the selected window shows only recorded supplied units and no full-window cover estimate. A page requiring more than 2,000 related movements fails with a request for a smaller page; it does not use a truncated chain.

Gross supply counts only negative dispense movements during the window. Returns, counts, receipts, write-offs and transfers do not become demand; a return does not erase earlier supply. Estimated cover is current saleable base units multiplied by the observation days, divided by recorded supplied units, floored to days. Zero supply has no finite cover estimate. Stock held for less than the selected window is labelled recent. Only sufficiently old stock with at least 90 estimated days of cover is labelled slow. These are disclosed observations, not forecasts, cross-product unit totals or net profit.

## Verification and remaining acceptance

Risk level 4 covers cost permissions, tenant isolation, clinical files/registers and shared report sources. Focused integration and UI runs cover supplier normalization, repeated product lines, changed units, drafts/tenant exclusion, invalid/bounded inputs, register-local midnight/search/export agreement, missing evidence, audit failure, stock movement chains, supply/return distinctions and existing purchase, prescription and export flows.

Upload cases cover invalid/active/oversized files, missing storage configuration, unresolved outcomes, original-key conflicts, concurrent retries, private scope, audit rollback, rate limiting and immutable retained evidence. The initial upload test batch consumed the real per-address limit; distinct synthetic client addresses exercise independent requests, while a separate case verifies the actual five-per-minute limit. Production limits were retained. A rate-display TypeScript target issue and a test-spy type signature were corrected.

Backend evidence comprises 130 distinct passing cases across the focused runs and affected reruns, including all nine final attachment cases. Frontend evidence comprises 138 distinct passing cases. Chrome acceptance covers 28 combinations of seven states at 360/390/768/1440 pixels, including source-invoice handoff, register review/export, read-only access, changed units, pending files and unavailable storage. No document overflow, page errors, external provider calls or business database writes occurred. Mobile supplier, register and file views were inspected. Browser probe: `node scripts/performance/check-pharmacy-records.mjs`.

Both package type checks, changed-file lint, backend API/four-worker build and diff checks passed. Existing workspace/purchase effect warnings remain; new code has no lint errors. The standard build needed its previously approved access to overwrite existing worker output files; the final API and four worker bundles built successfully. No deployment or full release gate was run. Ignored evidence lives under frontend `.next/pharmacy-{rates-register,records,register}-*` and backend `build/pharmacy-{rates-register,records,attachments}-*`. Rerun counts are not added to distinct-case totals.

All five actual store demonstrations remain open. Multi-level packs, the shared LAN offline coordinator, purchase/expiry workflow simplification, actual Marg-file reconciliation, approved catalogue/provider onboarding, agreed commercial/support terms, target hardware and monitored backup/restore/release acceptance remain in the controlling plan. This document does not mark the entire pharmacy programme complete.
