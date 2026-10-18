# Service catalog refinement

Updated 2026-10-18. Scope: `/dashboard/billing/services`. Implementation and focused verification complete; no release or live infrastructure claim.

Follow-up: the page-specific CSS module was removed in favor of shared Card, standard utilities and `formatCurrency`. See `shared-controls-standardization.md` for the subsequent dashboard-wide form-control migration and verification.

## Result

- Replaced the large banner, repeated category statistics and wide eight-field mobile cards with a compact header, All/Active/Inactive tabs, desktop rate table and concise mobile cards.
- Retained category filtering and sorting behind Filters. Search covers name, code, department, description and SAC/HSN. Filtering and tab changes reuse the loaded catalog; counts stay stable.
- Read every API page before exposing complete results/counts. The old page silently stopped at the API's default first page. A failed later page cannot become a successful partial catalog or an empty-state provisioning prompt.
- Add/edit uses the existing fixed-size QueueDialog with Service and Pricing & tax tabs, a scrolling body and pinned Save/Cancel actions. Validation selects the relevant tab. Drafts survive failures; active status and existing nonstandard GST rates survive edits.
- Added zero-price/decimal/finite-value validation, duplicate-submit guards, clear duplicate-code feedback, deactivation/reactivation confirmation and confirmed starter-service provisioning. No tax applicability rules or backend billing calculations changed.
- VIEW_BILLING remains read-only. MANAGE_BILLING controls writes. Organization/authority changes discard drafts and ignore late read/write follow-ups. Server authorization remains authoritative.
- Refresh failures preserve loaded data and offer a persistent retry; writes wait for a successful fresh read.

## Verification

Highest change risk: Level 4 (billing catalog writes). Backend implementation and payloads inspected; no backend files or contracts changed.

- `catalogContinuity.test.tsx`: 4 passing cases.
- `servicesWorkspace.test.tsx`: 13 passing cases covering pagination, filters/counts, recovery, validation, zero pricing, duplicate code/submission, inactive edits/reactivation, confirmation, authorization and late responses.
- Adjacent `billingWorkspace.test.tsx`: 17 passing cases.
- `npx tsc --noEmit --incremental false`: passed.
- Changed-file ESLint: zero errors; one effect/state warning on the initial catalog fetch pattern.
- Diff whitespace check: passed.
- Hidden local Chrome with intercepted synthetic API data: populated catalog, long labels, filters, add/edit/pricing and deactivation dialogs at 320, 440 and 1440 pixels. No viewport overflow observed. Switching editor tabs retained the same dialog position, height and footer geometry at each size. Mobile read-only and empty states also inspected.

No live pricing changes, starter seeding or billing writes were performed. Full production build, database persistence and cross-browser checks were outside this scoped frontend verification. Existing deployment/release gates still apply.

Next action: user review of the service catalog layout with their normal organization data.
