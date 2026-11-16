# Pharmacy owner invoice numbering

Owners can configure the branch numbering used by existing online pharmacy billing. The subsequent [designated-PC enrollment increment](pharmacy-designated-pc-2026-11-15.md) now reserves exclusive numbers for one browser profile per branch and blocks numbering edits until its allocations are reconciled. **Final offline checkout remains disabled.** Exclusive stock/drawer authority, offline operator authorization, authenticated import/synchronization and protected backup/restore remain in the [offline plan](pharmacy-offline-final-billing-2026-11-15.md).

## Owner workflow

Open **Locations → branch actions → Pharmacy settings → Configure invoice numbering**. Organization management permission, branch access and an active India/INR branch are required.

| Setting | Example |
| --- | --- |
| Prefix | `PJP/{FY}/` |
| Digits | `6` |
| Next number | `137` |
| Reset | Every financial year |
| Result in 2026–27 | `PJP/26-27/000137` |

Prefixes contain uppercase letters, digits, `/` and `-`, and end with `/` or `-` so the numeric suffix is unambiguous. The whole number fits within 16 characters. A yearly prefix contains exactly one `{FY}` token. April starts the next Indian financial year and its sequence starts at 1; the owner's next-number choice applies to the current year. Continuous sequences use a literal prefix without `{FY}` and continue across years.

An actual review reference and confirmation are required. Editing clears confirmation. Used or reserved numbers cannot be reused, even after changing the active prefix or padding. A stale revision, an already consumed next number, or a changed financial year requires reload. Previews can change while another cashier bills.

This follows the prefix/next-number preference pattern documented by [Zoho Invoice](https://www.zoho.com/in/invoice/kb/invoices/auto-generation.html). Character, length and financial-year bounds are grounded in [CGST Rule 46(b)](https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001). This change does not certify the store's complete statutory compliance.

## Integrity and existing flows

- Branches keep system numbering until the owner configures a series. No real branch was configured as a test.
- Custom numbering applies to retail counter invoices and clinical pharmacy supply invoices. General clinical billing keeps its existing allocator. Credit notes and opening balances retain their separate internal branch series.
- New custom-numbered invoices capture `numberingVersion: 3` and an immutable snapshot of template, rendered prefix, digits, sequence, reset policy and settings revision. Document versions and clinical/payment semantics are unchanged. Validation and printing use captured evidence; issued invoices are never renumbered.
- The existing invoice/payment/stock transaction also advances the counter. Failed payment, stock, audit or document operations roll back numbering. Stable-key recovery returns the original invoice number and print evidence.
- Configurations are revisioned. Allocation writes a configuration fence inside the sale transaction to serialize concurrent settings edits. Each rendered prefix has a monotonic counter. Prefix reservations are immutable, even after changing formats.
- Series are unique **within an organization**. Independent owners can both use `PJP/26-27/000137`; branches under one owner need distinct series. Annual templates reserve their supported fiscal expansions (2000–2098), preventing another branch from claiming a future expansion as a literal prefix.
- Invoice uniqueness is enforced by `(organizationId, invoiceNumber)`. The affected invoice-number lookups, pickup matching, financial reads, collections and returns retain organization/branch or invoice-ID scope. Default numbers remain globally distinct through the existing branch allocation.
- Configuration fails closed if required unique indexes are absent or the obsolete global invoice constraint remains. Settings, counters, reservations and required audit commit together with majority write concern.

The internal offline ledger accepts a matching captured custom format in a number allocation and records its atomic sequence on the saved local invoice. This is a storage contract, not server enrollment or an offline range reservation. Returned receipts are normalized to exactly the JSON encrypted on disk, without references through which callers could mutate the store's identity.

## Selected development database

Read-only inspection found both organization-scoped replacement indexes already present, alongside obsolete global constraints. The identified local API/watch processes were paused; no local background worker was found. Exact definitions and retained replacements were checked and recorded in the ignored backend `.cache/pharmacy-numbering-index-review.json` before removing only:

| Removed index | Retained unique replacement |
| --- | --- |
| `invoices.invoiceNumber_1` | `invoice_organization_number_v1`: organization and invoice number |
| `pharmacyinvoiceprefixes.prefix_1` | `pharmacy_organization_prefix_v1`: organization and prefix |

No invoice, payment, stock, customer or branch setting records were rewritten. No automatic `syncIndexes` removal was used. The hidden development API watcher was restarted and reports liveness `ok` and readiness `ready`. The final schema check reports **117 models, 552 expected indexes, no issues, transaction capable and ready**. Connection details are omitted.

## Verification

Risk level 4:

- **43 focused backend cases passed** across numbering/constraint guard, paid checkout, the added clinical pharmacy case, returns and consolidated billing. Coverage includes permissions/scope, same-owner collisions, independent-owner reuse, database uniqueness, concurrent billing/settings, fiscal rollover, rollback, paid recovery/reprint, returns and immutable snapshots. Earlier unchanged tax-document cases also passed in the initial regression run.
- **56 frontend cases passed** across numbering settings, its parent dialog, invoice documents and offline helpers. Existing Input, Select, Checkbox, Button and Alert components are reused; forms are not nested and configuring a number does not change pharmacy access.
- **15 real Chrome ledger checks passed**, including custom numbering, exact restart recovery, competing windows, quota failure, corrupted ciphertext and returned-reference isolation. Fixtures are synthetic and make no business API calls.
- The actual settings component passed synthetic Chrome Save checks at **900 px and 390 px**, using compiled app styles: one intended settings request, correct preview, no horizontal overflow or page exceptions. Screenshots/results are in `.next/pharmacy-numbering-ui-acceptance/`.
- Both package type checks, API/four-worker bundles, isolated Next production build, payment-boundary check and diff whitespace checks passed. Changed-file ESLint has no errors; one existing parent settings effect warning remains. Next's temporary generated build-directory additions were removed from `tsconfig.json` afterward.

Reproduce the UI check after an isolated build with `node scripts/performance/check-pharmacy-numbering.mjs`; override `PHARMACY_NUMBERING_DIST` for another build directory. Existing optional Playwright/Chrome and backend esbuild tooling are reused. No dependencies were added.

Actual store latency, physical printing, finalized offline billing and device-loss backup recovery remain open. This increment does not claim an end-to-end Save speedup.
