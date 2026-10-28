# Pharmacy release and operating gates

Dated engineering evidence and current operator procedures. The October 22 baseline below is historical; [the cleanup plan](pre-production-cleanup.md) records October 24 checks. No local result approves live activation.

- [Engineering evidence and evidence owners](#engineering-evidence-and-evidence-owners)
- [Current schema and index setup](#current-schema-and-index-setup)
- [Optional read-only development diagnostics](#optional-read-only-development-diagnostics)
- [Staging handoff and first sale](#staging-handoff-and-first-sale)

## Engineering evidence and evidence owners

Local checkpoint: 22 October 2026. **Local engineering gates passed; live pharmacy activation is not approved.** T01–T25 and T27–T31 have technical implementations. The final backend auditor generated an approved engineering manifest; that result does not supply host, business or professional approval. This record distinguishes automated evidence from work requiring the actual business, operating environment and professional reviewers. No live deployment, account/price publication, remote index creation, provider charge or database restoration was performed.

### Latest frontend follow-up — 22 October 2026

The shared-control correction follows the full release baseline below. Seven native checkboxes and ten browser date/month controls now use the existing shared `Checkbox` and `DatePicker` components in pharmacy, registration and tracker rescheduling. DatePicker adds exact month selection without inventing an expiry day, retains canonical strings, required/min/max/autofill semantics and checks inherited fieldset locking before portaled calendar actions. Application-level raw inputs/selects/textareas and native date/month/time/checkbox types through `Input` are now lint errors; native elements remain inside the shared controls.

**Scoped verification passed:** 172 distinct cases across 16 files, package TypeScript, scoped ESLint with zero errors (existing warnings), six lint-policy probes, and a source audit with zero remaining application-level native form elements/pickers. Integration covers month/day expiry payloads and precision resets, collections/refunds/returns/import confirmations, exact source dates, registration OTP birth-date retention and branch-local rescheduling with the original private proof. Existing patient-entry, disruption and clinical-document regressions passed. Three isolated local Chrome checks on the development registration view passed at 320/440/1440 pixels, including popup bounds, dismissal/focus restoration and zero runtime exceptions; the 320-pixel screenshot was reviewed. Generated screenshots/report are under `.next/shared-controls-render`. API requests were intercepted as signed out; no backend/provider write occurred.

The first browser attempt clicked before hydration; the hydration-aware rerun passed. The new month-focus test was corrected to focus the trigger before opening it, matching the interaction it asserts; all 13 picker cases then passed. Passing unrelated checks were retained. No dependency/backend change, full-suite rerun or new production build was needed for this scoped correction. **The full-suite/build evidence below belongs to the preceding baseline; exact-revision CI and rebuilt deployment images must include this follow-up.**

### Engineering gates (preceding release baseline)

Run the existing repository CI/release commands once after shared changes settle. A failed gate stays failed until its cause is resolved and the affected checks pass. Do not substitute scoped tests for full CI or remove failing security checks.

| Gate | Current evidence |
| --- | --- |
| Backend package TypeScript | Passed in the final full release auditor, including test-file types |
| Frontend package TypeScript | Passed with `--incremental false`; excludes test-file type coverage by project design |
| Focused signup/first-sale and adjacent flows | Passed in the October 22 checkpoint; see [signup contract](pharmacy-capabilities.md#independent-business-signup). Exact-revision release checks remain required. |
| Frontend changed-file lint | Zero errors, six existing warnings in shared workspace files |
| Frontend payment boundary | Passed |
| Backend deployment install behavior | Passed without installing packages or downloading a test database |
| Backend five API/worker bundles | Passed |
| Backend dependency audit | Zero vulnerabilities in registry audit |
| Backend release auditor | Final fresh command passed all eight gates: zero TypeScript errors and all 1,941 cases across 221 files passed. Generated `backend/release_manifest.json` records `release_gate: approved`; `release_history.json` contains the successful run. Neither artifact was manually approved |
| Frontend full test suite | Fresh release command passed: 159 files, all 1,128 cases; 981.69 seconds. Earlier fixture timing/selector failures are resolved |
| Tenant source advisory | Completed with 139 heuristic warnings; no T31 provisioning/auth/workspace file was flagged. This advisory is not an isolation proof; focused and full integration tests remain the authority evidence |
| Frontend full lint | Passed: zero errors, 252 existing source warnings; generated `.cloudflare`, `.vinext` and `dist` artifacts are excluded alongside `.next` |
| Frontend Next production build | Passed compilation, types and route generation, including `/pharmacy-start`, using verification-only origins |
| Local Chrome signup rendering | Nine checks passed on the final standalone production build: published/empty/unavailable catalogue at 320/440/1440 pixels, with control bounds, disabled submission and zero runtime exceptions. Screenshot review caught and verified the fixed narrow-screen fieldset clipping. Synthetic catalogue interception only; no backend/provider/browser-matrix or physical-device certification |
| Local Chrome counter flow | Six viewport/state checks passed at 320/440/1440 pixels with synthetic authentication/API fixtures: empty counter and reviewed quote, leading-zero barcode via keyboard Enter, pack/loose quantity 12, return focus to scanner, held-cart resume and quote invalidation. No invoice/payment command or backend write; not scanner hardware, printer or provider E2E evidence |
| Native and built backend startup probes | Passed on sequential rerun: production config rejection, isolated replica readiness/liveness, duplicate-port rejection before bootstrap and SIGTERM/port release; the earlier concurrent run timed out |
| Frontend dependency audit | Passed after a clean locked install: zero vulnerabilities; the vulnerable glob chain was replaced, with no audit waiver |
| Glob tooling compatibility | Five native Node checks passed, covering CJS/ESM APIs, unsupported inputs, actual installed Next root discovery and Vite dynamic-import/CommonJS builds in paths with spaces |
| Cloudflare configuration types | Passed after the tooling patches; this is not hosting/deployment approval |
| Existing Cloudflare/vinext build | Passed after the glob replacement using an HTTPS verification upstream; native Docker's internal HTTP hostname is intentionally rejected by the Worker configuration. No upload/deployment or Workers Free capacity approval |

Builds use verification-only public origins. These artifacts are local evidence, not deployment images configured for the real domain. Native Next release is independent of the Cloudflare/vinext hosting experiment.

### Security findings

The initial registry audit reported 13 findings: nine high and four moderate, across `braces`, `vite`, `fflate` and their tooling consumers. The [Vite editor advisory](https://github.com/advisories/GHSA-698v-4r3x-3vcv) and [fflate advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98) identify patched releases. The targeted fix raises the Vite floor to `^8.3.3` (locked/installed `8.3.5`) and overrides only `satori`'s exact `fflate` dependency to the same-branch patch `0.7.5`. Install scripts were disabled; three packages changed. The post-patch audit contains no Vite/fflate finding and no moderate finding.

The nine remaining high findings were the [braces chain](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through `micromatch`/`fast-glob`. The checked private adapter in `packages/fast-glob` now uses pinned `tinyglobby` for the actual Next lint and Vite dynamic-import callers. It preserves their sync/async and directory/absolute-path behavior and rejects unsupported API extensions. Consumer checks caught and corrected directory trailing-slash differences, and exercise both actual Vite builds and installed Next root discovery. A clean `npm ci --ignore-scripts --no-audit --no-fund` passed; the lockfile contains no `braces` or `micromatch`, and a fresh registry audit reports **zero vulnerabilities**. CI retains the security gate and now runs `check:glob-tooling`; Docker copies the local package before dependency installation. No Next downgrade, audit suppression or vulnerability waiver was used.

### Evidence owners must supply

| Required evidence | Owner and acceptance record |
| --- | --- |
| Published offer | Business owner approves actual INR prices, tax treatment, trial/staff/location limits and subscription terms; publish the reviewed product catalogue explicitly |
| Pharmacy operating scope | Licensed pharmacist/regulatory adviser records launch state, actual licences, supervision, supported restricted categories and record/partial-fill/return requirements; unsupported flows stay blocked |
| Financial documents | CA reviews actual issuer/GSTIN/HSN/rates/discount/rounding, FY numbering, credit notes, transfer applicability and sample documents |
| Privacy and retention | Privacy/legal owner records applicable obligations, notices, retention/legal holds, account closure/export and patient/customer access policy |
| Browser and store devices | Operator records supported browser/OS, keyboard/scanner behavior, 320/440/1440 layouts, disconnect/recovery, and real 58mm/80mm/A4 print results |
| Provider and email | Actual test-mode payment success/failure/cancellation/webhook/replay evidence for used providers; business email delivery/resend and authenticator recovery verified with configured services |
| Backup/key recovery | Infrastructure owner defines RPO/RTO, restores an isolated encrypted backup with recovered keys, and reconciles stock, invoices, receipts, counters, registers and pending command results |
| Capacity and cost | Representative products/lots/history and concurrent tills; measured p95 latency, bounded query/export behavior, storage/retention, hosting/provider/support cost and agreed product limits |
| Pilot and support | One opted-in store/branch with an agreed opening baseline, staff permissions, reconciliation sign-off, incident owner and recovery procedure |

No synthetic fixture closes these rows. No historical migration/backfill or legacy entitlement exercise is required: this project has no production customers or legacy production data.

### Pilot reconciliation and recovery procedure

1. Select the intended organization/branch explicitly. Verify transaction-capable database, current schema/index readiness, encrypted backups, configured origins/email, active grants and issuer/professional reviews before enabling new activity. Prepare setup through [T25](pharmacy-release-evidence.md#current-schema-and-index-setup); never run a reset or seed against the pilot as a check.
2. Capture actual opening saleable/quarantined lots and costs, customer/supplier dues, invoice series and drawer float. Use reviewed imports or individual receipts with source references. Reconcile base quantities and paise totals before first sale.
3. Exercise anonymous/identified ordinary sale, supported restricted supply, stock receipt/purchase/return, split/partial collection, sales return/refund, drawer closing, reports and audited export. Verify every document against the ledger and original source. Connected clinic dispensing remains a separate preserved regression.
4. If a write response is lost, freeze that command's original key/body. Recover its recorded outcome in the existing operation UI before issuing another sale, receipt, return, transfer or collection. QR display, a browser toast or a printer event is not confirmation of money movement.
5. If a device/printer is unavailable, retain the committed invoice and use authenticated reprint/recovery. Do not issue another invoice to repair a print failure. If the database/provider is unavailable, preserve pending references and reconcile provider events through the existing verified flow.
6. Before rollback, stop new activity for the affected branch, capture in-flight references and reconcile their authoritative outcomes. Continuity reads/corrections retain their own authorization; expiry/disablement does not permit fresh sales. Resolve dispatched transfer custody rather than cancelling dispatched stock.
7. Prefer a reviewed forward fix and explicit compensating business events. Never delete stock movements, money records, operation receipts or register entries, renumber invoices, or restore a stale backup over later business. An actual restore requires the incident owner, an isolated rehearsal and a plan for post-backup transactions.
8. Activate only after engineering gates and all applicable evidence rows have named, dated approvals. Record deployed revisions/configuration, opening baseline, health/readiness checks, rollback decision owner and support contact. No deployment is performed by this document.

## Current schema and index setup

Implemented locally for fresh installations and current development databases. There are no production legacy customers to migrate: no stock backfill, entitlement grandfathering, historical invoice rewrite or data-deleting reset is required. This extends the existing backend index preparation command; application requests never call the setup service.

From the backend checkout:

```powershell
npm run db:indexes
npm run db:indexes -- --check
npm run db:indexes -- --apply --writes-paused
```

The first command prints a deterministic current-schema index manifest without connecting to MongoDB. Connected modes use the operator-selected `MONGODB_URI`; the existing npm script loads the backend `.env`. No URI, credentials or source-record values are printed in error messages.

`--check` disables automatic collection/index creation and reads index metadata only. It reports missing collections/indexes, incompatible options/names, undeclared unique constraints and undeclared TTL indexes. Key order, uniqueness, sparse/partial filters, collation, hidden options, expiry and text-index weights/language are checked. Existing intended notification/auth TTLs remain supported; a surprise expiry on a durable receipt is a readiness failure. Final readiness also requires a transaction-capable replica set/managed cluster.

For a fresh selected database, pause application writes and run explicit `--apply --writes-paused`. Setup creates empty collections and current declared indexes, including collections with no additional indexes. It verifies readiness afterwards. Repetition preserves existing records/indexes. Setup never seeds users, modules, licences, prices, stock or dues; their reviewed provisioning workflows remain separate.

Stale development constraints block setup before changes. For example, old printed-batch uniqueness is incompatible with several genuine receipts carrying the same printed batch. Review that named index explicitly against current source identities; the command will not drop or replace it. Duplicate facts can also prevent a missing unique index from being created. The error omits duplicate values, preserves both facts and notes that earlier missing indexes may have been created. There is no automatic cleanup.

For a disposable fixture reset, choose a newly named empty development database, prepare its current schema and run the synthetic fixture flow against it. Leave the prior database intact until its owner explicitly chooses what to retain. The test harness uses isolated memory replica-set databases; it does not reset the application's configured database. Optional T25-A read-only diagnostics remain available for development investigation and are not a production migration requirement.

Ten focused cases verified all current registered models on a fresh database, repeat setup, no record mutations or readiness writes, actual receipt/source uniqueness, clinical/retail invoice coexistence, repeated printed batches, stale unique/partial/TTL constraints, safe duplicate errors and native Node preview/check execution. Backend types and whitespace checks passed. The Node probe caught and corrected unsupported parameter-property syntax; heterogeneous Mongoose model metadata uses compatible generic types. No frontend code changed for T25, and no full suite, production index application, migration or deployment ran. Backup/restore, real operational capacity and release evidence remain T26 gates.

## Optional read-only development diagnostics

**Scope correction — 20 October 2026:** the user confirmed that the entire project is in development, with no production customers or legacy records. Historical backfill, entitlement grandfathering, production snapshot migration and legacy cutover are out of the active plan. Keep the existing read-only tool as an optional development diagnostic. Remaining T25 work is current schema/index readiness and deterministic initial setup; backup/restore release evidence remains T26. The original contract below describes what was built, not a requirement to invent historical data or run a migration.

**T25 current setup is now implemented locally.** See [the schema/index setup contract](pharmacy-release-evidence.md#current-schema-and-index-setup) for disconnected preview, read-only readiness, explicit repeat-safe setup and development fixture procedures. No live database/index action ran; release/restore evidence remains T26.

The optional read-only scoped diagnostic at `scripts/review-pharmacy-migration.ts` retains its original exception-manifest contract below. It performs no backfill and does not approve rollout. Historical production migration/cutover requirements in this older diagnostic contract are superseded by the development-only scope correction above.

Use a frozen, reviewed replica-set snapshot with a read-only database principal. Set `PHARMACY_REVIEW_MONGODB_URI` through the operator's secret environment; the tool does not fall back to the application's connection, load `.env`, or accept a connection string in arguments. It imports no application models and disables automatic collection/index creation. Connection failures redact connection details.

From the backend checkout, the command shape is:

```powershell
node --experimental-strip-types scripts/review-pharmacy-migration.ts `
  --organization <organization-id> --location <location-id> `
  --snapshot-id <reviewed-snapshot-label> --as-of 2026-10-20T00:00:00.000Z `
  --section inventory --limit 100
```

The timestamp above is an example, not an instruction to use that date for a real review. No snapshot connection or live review was run during implementation. The snapshot label is supplied by the operator; the tool cannot prove that a database is a frozen backup. Preserve that external evidence.

Run all six sections for each owned location, including inactive locations. Follow each section's `nextCursor` using `--cursor`; a completed page or section is never rollout approval. All counts are page-local. Data sections use a snapshot transaction per page and abort it even on success. Different pages require the same frozen snapshot for a consistent overall review. Transient conflicts or unsupported transactions fail the review; they never cause a partial success report. Index metadata is read separately because MongoDB does not support listing indexes inside a transaction.

| Section | Evidence and exceptions |
| --- | --- |
| `inventory` | Aggregate/batch sums, eligible/expired quantities at the explicit timestamp, mixed ownership/location, unknown units, invalid quantities/prices/expiry/status, duplicate batch labels, active barcode conflicts, deleted products retaining stock, latest ledger checkpoint. Legacy-only records are identified without inventing an opening receipt. |
| `batches` | Independently pages location batches to identify missing or foreign medicine references, including orphan batches that an inventory-led scan would miss. |
| `invoices` | Pages every branch invoice, flags legacy charge provenance, missing/conflicting organization and broken or duplicate linked pharmacy sources; issued invoice contents remain untouched. This is provenance review, not a replacement for tax validation or bank reconciliation. |
| `register` | Flags historical restricted-supply evidence gaps and missing scoped supply sources without reconstructing prescriber/patient details. |
| `access` | Organization subscription cardinality and legacy/manual/product evidence, implicit pharmacy module/capability mappings, paginated member branch-grant exceptions. No plan, paid entitlement or role is activated. |
| `indexes` | Captures existing keys, uniqueness, sparse/partial filters, collation and TTL metadata. It creates, drops or replaces no index. |

Pages contain at most 100 primary rows. Related inventory/source evidence is bounded at 500 rows; excess evidence yields an explicit exception and null totals rather than a partial sum. A heavily populated product needs separately reviewed evidence before migration. Output excludes names, addresses, clinical notes and patient identifiers. Source and manifest SHA-256 fingerprints detect changes in the projected evidence; they are neither signatures nor authorization to apply a migration. Reports can still contain internal business identifiers and quantities and should stay within the review process.

Every proposed opening quantity is null. Unknown unit bases, unexplained stock deltas and legacy receipt/entitlement assumptions require owner/pharmacist/finance review. The tool does not guess a conversion, add saleable stock, rewrite invoice/register history, infer payment proof or change a capability. These diagnostics are optional development investigation. Current setup does not require a historical backfill, migration or cutover; preserve source records and prepare current indexes separately with the guarded setup command.

T11 adds captured lot fields and a separate receipt identity index. The review recognizes their unit/cost/expiry evidence and distinguishes legitimate captured lots sharing a printed batch from legacy label conflicts. It still performs no index change or backfill. See [the compatible receipt and index contract](pharmacy-inventory.md#captured-lots-and-opening-receipts).

## Staging handoff and first sale

Updated 22 October 2026. All feature tasks and local engineering gates are
complete: frontend 1,128 tests, backend 1,941 tests and all eight release-auditor
gates passed; both dependency audits report zero vulnerabilities. Builds, types,
lint, backend startup and synthetic Chrome checks passed. Use the
[release evidence](pharmacy-release-evidence.md) for the scope of those results.
This page does not authorize a live pharmacy launch. No deployment was performed;
the local Docker daemon is unavailable, so container and host checks remain part
of the steps below.

The subsequent shared form-control correction passed its scoped tests, types,
lint and local browser checks; see the latest follow-up in the release evidence.
The full-suite/build counts above describe the preceding baseline. Include the
correction in exact-revision CI and rebuild the actual deployment images.

### Deploy a staging installation

The existing target is **https://dev.ekavyu.com**, with native Next.js, the Node
API and four workers. Follow the executable steps in
[the staging runbook](../../backend/deploy/STAGING.md). The Cloudflare/vinext
experiment has its own validation and is not a prerequisite for this route.

1. Review and commit the frontend/backend revision pair, including the new
   pharmacy files and `frontend/packages/fast-glob`. Obtain passing CI for those
   exact revisions. Keep the previous images and configuration for rollback.
2. Prepare the private staging environment, dedicated replica-set database,
   Redis password, persistent encryption/signing keys and JWT pair, test email
   and test payment credentials. Set the real build-time origins; local builds
   using `example.invalid` must not be deployed as release images.
3. On a Docker host, validate the merged Compose and Caddy configuration, then
   build the two images with unique revision tags. The frontend dependency stage
   copies the checked local glob package before `npm ci`; do not omit it from a
   source archive or Docker context.
4. For an empty staging database, use the existing root provisioning and MFA
   procedure. Prepare current indexes with writes stopped, then run the
   [read-only readiness check](pharmacy-release-evidence.md#current-schema-and-index-setup). No migration/backfill is
   required for hypothetical historical customers.
5. Start the API, all four workers, frontend, Redis and edge proxy. Check API
   liveness/readiness, worker health, HTTPS, host-only secure cookies and staging
   `noindex`. Follow the runbook's startup and rollback commands.
6. Configure a reviewed `location_products` catalogue through the root-only plan
   API. Set its actual INR product pricing, tax, resource limits and trial days;
   explicitly opt it into `selfServicePharmacy` only when it should appear in
   signup. See [commercial configuration](pharmacy-capabilities.md#product-quotes-and-verified-activation) and
   [independent signup](pharmacy-capabilities.md#independent-business-signup). An empty published
   catalogue intentionally leaves new signup unavailable.
7. With synthetic staging details, visit `/pharmacy-start`, verify delivery of
   the business OTP, finish setup, enroll an authenticator and select the staff
   workspace. Review the branch issuer/licence and pharmacy capability. Receive
   known ordinary stock, open a drawer, then issue and collect a first sale.
8. Reconcile stock, invoice, receipt and drawer. Exercise return/refund, closing,
   reports, permissions and recovery of an uncertain command. Check the existing
   clinic booking/clinical/payment journey as well. Keep real patient records
   and live provider credentials out of public demo testing.

### Before a live store uses it

Record named approval for the offer, operating licences/scope, tax documents,
privacy/retention, actual browsers/scanners/printers, configured provider/email
flows, isolated backup/key recovery, capacity and store reconciliation. The
required evidence and recovery procedure are in the release record. These need
the actual business and infrastructure; automated fixtures cannot approve them.

Record the deployed revisions and image tags, environment, date, engineering
artifact links, readiness result, opening baseline and incident owner. Keep
unsupported medicine categories and cross-issuer/interstate transfers blocked.
The separate apex cutover remains in the staging runbook; do not repoint the
existing marketing domain while preparing a staging installation.
