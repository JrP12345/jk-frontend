# Pharmacy release evidence (T26)

Local checkpoint: 22 October 2026. **Local engineering gates passed; live pharmacy activation is not approved.** T01–T25 and T27–T31 have technical implementations. The final backend auditor generated an approved engineering manifest; that result does not supply host, business or professional approval. This record distinguishes automated evidence from work requiring the actual business, operating environment and professional reviewers. No live deployment, account/price publication, remote index creation, provider charge or database restoration was performed.

## Engineering gates

Run the existing repository CI/release commands once after shared changes settle. A failed gate stays failed until its cause is resolved and the affected checks pass. Do not substitute scoped tests for full CI or remove failing security checks.

| Gate | Current evidence |
| --- | --- |
| Backend package TypeScript | Passed in the final full release auditor, including test-file types |
| Frontend package TypeScript | Passed with `--incremental false`; excludes test-file type coverage by project design |
| Focused signup/first-sale and adjacent flows | Passed; see [signup contract](pharmacy-independent-signup.md) and final verification record below |
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

## Security findings

The initial registry audit reported 13 findings: nine high and four moderate, across `braces`, `vite`, `fflate` and their tooling consumers. The [Vite editor advisory](https://github.com/advisories/GHSA-698v-4r3x-3vcv) and [fflate advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98) identify patched releases. The targeted fix raises the Vite floor to `^8.3.3` (locked/installed `8.3.5`) and overrides only `satori`'s exact `fflate` dependency to the same-branch patch `0.7.5`. Install scripts were disabled; three packages changed. The post-patch audit contains no Vite/fflate finding and no moderate finding.

The nine remaining high findings were the [braces chain](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through `micromatch`/`fast-glob`. The checked private adapter in `packages/fast-glob` now uses pinned `tinyglobby` for the actual Next lint and Vite dynamic-import callers. It preserves their sync/async and directory/absolute-path behavior and rejects unsupported API extensions. Consumer checks caught and corrected directory trailing-slash differences, and exercise both actual Vite builds and installed Next root discovery. A clean `npm ci --ignore-scripts --no-audit --no-fund` passed; the lockfile contains no `braces` or `micromatch`, and a fresh registry audit reports **zero vulnerabilities**. CI retains the security gate and now runs `check:glob-tooling`; Docker copies the local package before dependency installation. No Next downgrade, audit suppression or vulnerability waiver was used.

## Evidence owners must supply

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

## Pilot reconciliation and recovery procedure

1. Select the intended organization/branch explicitly. Verify transaction-capable database, current schema/index readiness, encrypted backups, configured origins/email, active grants and issuer/professional reviews before enabling new activity. Prepare setup through [T25](pharmacy-setup.md); never run a reset or seed against the pilot as a check.
2. Capture actual opening saleable/quarantined lots and costs, customer/supplier dues, invoice series and drawer float. Use reviewed imports or individual receipts with source references. Reconcile base quantities and paise totals before first sale.
3. Exercise anonymous/identified ordinary sale, supported restricted supply, stock receipt/purchase/return, split/partial collection, sales return/refund, drawer closing, reports and audited export. Verify every document against the ledger and original source. Connected clinic dispensing remains a separate preserved regression.
4. If a write response is lost, freeze that command's original key/body. Recover its recorded outcome in the existing operation UI before issuing another sale, receipt, return, transfer or collection. QR display, a browser toast or a printer event is not confirmation of money movement.
5. If a device/printer is unavailable, retain the committed invoice and use authenticated reprint/recovery. Do not issue another invoice to repair a print failure. If the database/provider is unavailable, preserve pending references and reconcile provider events through the existing verified flow.
6. Before rollback, stop new activity for the affected branch, capture in-flight references and reconcile their authoritative outcomes. Continuity reads/corrections retain their own authorization; expiry/disablement does not permit fresh sales. Resolve dispatched transfer custody rather than cancelling dispatched stock.
7. Prefer a reviewed forward fix and explicit compensating business events. Never delete stock movements, money records, operation receipts or register entries, renumber invoices, or restore a stale backup over later business. An actual restore requires the incident owner, an isolated rehearsal and a plan for post-backup transactions.
8. Activate only after engineering gates and all applicable evidence rows have named, dated approvals. Record deployed revisions/configuration, opening baseline, health/readiness checks, rollback decision owner and support contact. No deployment is performed by this document.

## Final verification record

The fresh frontend release command passed all 159 files and 1,128 cases in 981.69 seconds. Earlier runs exposed a supplier-evidence test submitting before the separately fetched drawer was ready, an ambiguous navigation selector and a patient-entry timing failure. The prerequisite wait/selector corrections preserve the actual assertions; the fresh full command now exits green. No production assertion or drawer requirement was disabled.

The final native Next production build passed with the corrected signup fieldset. The Chrome pass used an isolated headless profile and intercepted synthetic catalogue responses; it performed only GET/OPTIONS requests. The original page-width-only measurement missed fieldset clipping because global overflow hides it. Screenshot inspection exposed it, the stronger control-bounds assertion failed against the prior build, and all nine checks passed after the local `min-w-0` fix. Screenshots and `report.json` are generated under `.next/pharmacy-release-render`; they are local evidence, not a committed CI or real-store device artifact.

The final fresh backend release auditor exited successfully: **eight of eight gates, 221 files and all 1,941 tests passed, with zero TypeScript errors**. It generated `backend/release_manifest.json` with `release_gate: approved` and appended the successful run to `release_history.json`. These are generated local engineering artifacts, not manually edited approvals or evidence of a deployed revision. Earlier failures were resolved before this full run; staff/branch authority, clinic state transitions, CDS block/override and access-period assertions remain intact. CI must still produce artifacts for the exact reviewed and committed release revisions.

Release verification exposed a financial transaction-retry failure, reproduced by a deterministic transient-error test: saving an invoice loaded outside a retried ALS transaction could clear its dirty paths on an aborted attempt, leaving the invoice paid while the appointment became refunded. Refund finalization now reloads both records inside each transaction attempt, rechecks the original payment source, preserves the populated response and commits the invoice, appointment, audit and communication together. The provider refund remains outside the retry callback. A forced abort now produces two database attempts and exactly one provider call; changed payment evidence remains pending review without overwriting the newer amounts. The WhatsApp fixture now waits for and asserts the actual unique ledger index before eight concurrent dispatches, and verifies one ledger row, provider call and credit charge. All 97 related cases passed; the final populated-response case also passed. Backend types, five bundles and native/built startup probes passed for the correction, followed by the green full auditor above.

The shared test fixture now waits for all registered model indexes before running commands/transactions on its temporary database, resolving setup-request deduplication races and stock-test contention with unfinished index builds. Opening a Mongoose connection alone does not await those builds. The stock test's independent competing write has a five-second database bound; the deletion and quantity assertions remain intact. All 93 cases across six files passed, including setup-request/WhatsApp concurrency, stock validation/movements, refund retry and explicit index setup, followed by the green full auditor above. These fixture changes affect disposable test databases, not application startup or remote indexes.

All 12 current signup integration cases passed after the credential-retention correction, including the first sale and existing account/MFA flows. Backend types and all five bundles passed again for that source change; test-file types also passed after the fixture corrections. The full source lint gate and final changed-test lint have no errors. Existing lint/advisory warnings are recorded above.

**Local engineering verification is complete. Remaining launch gates:** commit the reviewed frontend/backend revision pair and obtain exact-revision CI artifacts; verify the real host/container configuration and health; record the actual business/professional/browser/device/provider/restore/capacity evidence listed above. Docker is installed locally but its daemon is unavailable, so no container-image or deployed-host check is claimed. Real deployment and offer publication remain unperformed. Follow [the deployment handoff](pharmacy-deployment.md) for the staging setup and first-sale checks.
