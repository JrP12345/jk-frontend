# Production readiness implementation worklog

Execution order: security closeout → inventory → workflow corrections → maintainability/performance → release verification. Prior security/performance/mobile fixes are the baseline. No deployed infrastructure or tenant records have been changed.

| Area | Confirmed issue | Implementation / verification | State |
| --- | --- | --- | --- |
| Previous seven fixes | Patient/workspace boundaries must remain intact | Inspected handlers; 13 clinical authorization regressions passed | Verified locally |
| Legacy grants | High: missing grants implied every branch | Derive owned active doctor/reception assignments, deny other missing grants; mismatched role/foreign references tested | Fixed; reviewed rollout grants required |
| Permission presets | High: consumer/platform roles could become staff grants | Assignment service + role controller reject root/consumer targets; consumer preset changes require root | Fixed; role and revocation regressions passed |
| Exception logging | High: raw errors can include PHI/secrets | Metadata-only backend logs/Pino; Sentry/pager minimization; production handled 5xx minimization; 43 browser exception values removed | Fixed in reviewed sinks; historical/external logs require review |
| Staff MFA | High assurance gap: no staff enrollment policy | Existing TOTP, optional dated grace, recent primary login, encrypted session-bound setup, atomic verification, fresh session, HTTP/socket gate, independent operator recovery | Verified locally; device/operator rehearsal required |
| Transport/config | Medium–high: broad default proxy trust | Production trust off by default; precise HTTPS/CORS/cookie/hop/CIDR validation; one-hop private Compose setup | Source/bundle startup probes passed; real edge unverified |
| Storage/recovery | Key strength, decompression bounds, stale remote listing | Dedicated strong new archive key; authenticated bounded codec; private files; paginated remote selection; isolated drill close/receipt | Codec tests passed; actual snapshot/application restore unverified |
| Inventory | Need all real entry points and role map | 53 pages, 462 literal HTTP routes, 93 models, 20 modules, eight job/worker entry files; role/action/state matrix | Source map complete; runtime scope explicitly marked |
| Assignment directory | Medium: restricted staff could read sibling branch assignments/contact details | Apply active tenant/location grant and validate explicit filters | Failing regression reproduced; corrected check passed |
| Reporting access | Medium: direct KPI/summary/export APIs only authenticated | Require VIEW_ANALYTICS at every reporting entry; apply granted locations and explicit tenant filters | Failing regression reproduced; corrected checks passed |
| Clinical search | High: patient-scoped observation query lacked staff tenant/branch scope | Explicit staff scope on all three record types; retain ownership-checked consumer longitudinal access; scope quality metrics | Cross-tenant/sibling branch fixture passed |
| Financial reports | Medium: partial receipts/balances missing | Include partial paid amount + remaining balance; exclude cancelled/refunded/deleted invoices; preserve ISO endpoint time | Expected 1125 receipts / 775 outstanding passed |
| Consultation list | High workflow impact: doctor list depended on forbidden VIEW_STAFF; family used staff loaders; first-page-only filters | Role-aware two-request staff load / one-request portal load; server search/filter/page; cancellation guards; reuse retry-safe PatientEntryModal | Role/arrival/identity/workflow checks passed |
| Dashboard | Incorrect page-limited trends, blank family state, partial debts treated as settled | Scoped aggregate trends; canonical family loads; header counts, partial invoice counts; permission-aware requests/actions; visible retry errors; scope-keyed state | Role/stat/action regressions passed |
| Mobile usability | Large counters and install overlay displaced/obscured clinical work | Compact consultation counts; preserve full shared entry form; suppress install prompt during critical work/MFA | Ten synthetic production-browser checks passed |
| Maintainability | Duplicate walk-in submission and repeated action markup | Reuse existing patient entry, permission/module guards, currency formatter; remove duplicate package script key | Frontend build and changed-file lint passed (warnings retained) |
| Deployment | Need executable verification and honest release scope | Both builds, source/bundle API startup, production dependency audits, focused cross-module/security checks | Local gates passed; external acceptance gates open |

## Recorded verification

Highest risk: Level 4. Full suites and release auditor were not run.

- Previous-fix verification: `tests/clinicalAuthorizationBoundaries.test.ts` — 13 passed; role and production-config regressions also passed.
- `phaseOneCloseout` — 14 passed, including grants, role separation, exception minimization, transport, staged MFA, encrypted/session-bound enrollment, revocation, independent recovery, authenticated archive codec, portal denial, refresh/login recency, legacy hydration and workspace-switch proof. Final phaseOneCloseout/workspaceAuthority selection: two files / 25 passed. Auth regression file: nine passed in the preceding selection.
- `phase1SecurityContracts` — 12 passed after making its positive search fixture explicitly authorized; includes uploads, patient binding, private downloads, WebSocket revocation, telemetry/CSV and query sanitation.
- `readinessWorkflowBoundaries`, `analyticsAndReporting`, `search`, `telemetry` — four files / 15 passed. Three new authorization assertions failed before their fixes.
- Core downstream selection — 15 files / 92 passed: locationWorkflow, queueIntegrity, postConsultationFeeWorkflow, clinicalContinuityAndTillClose, doctorAvailabilityAndSmartBooking, patientPortal, workspaceAuthority, crmExistingBookingFlows, pharmacyFulfillmentLoop, labHandshakeAndUpiLoop, imaging, teleconsultation, tenantRouteMatrix, domainEventOutbox, shifts.
- Later changed-boundary selection — phaseOneCloseout, workspaceAuthority, requestLifecyclePerformance: three files / 26 passed before adding two further enrollment edge cases. Performance file: five passed, including all 230 trend visits beyond list limits.
- Final financial/RBAC/root-MFA/encryption/CRM/preauth/feedback/notification/provisioning selection: ten files / 56 cases passed across the original selection and affected reruns. The original CRM assertion expected the removed legacy all-branch behavior and was updated to require denial. The root MFA check exposed lost safe recovery guidance; an exact source-controlled message allowlist fixes that without allowing raw exceptions. Final `crmAuthority rootMfa phaseOneCloseout` rerun: three files / 26 passed.
- Frontend targeted batches: security/auth/navigation 15 passed; consultation/identity/workflow 25 passed; dashboard/action/location/platform direct consumers 18 passed plus corrected role-loading tests; later six-file role/error/enrollment/teleconsultation/entry/workflow batch 27 passed; consultation/install/PWA batch 28 passed. Batches overlap and must not be added into a unique total.
- Frontend production build includes TypeScript and passed using synthetic HTTPS API origins. Backend TypeScript includes tests/scripts and passed. API plus four worker bundles built successfully. Both native source and built API startup probes passed against isolated synthetic MongoDB replica sets.
- Changed frontend code lint: zero errors, 76 warnings, mainly existing hook/effect/purity/unused declarations in files touched for exception logging. Full lint remains CI-owned.
- Both `npm audit --omit=dev --json` checks returned zero known production dependency advisories. Registry checks required network-enabled execution after sandbox endpoint failures; no packages changed.
- `git diff --check` passed in both repositories. Ten Chrome CDP rendering checks used the production frontend with synthetic API fixtures (320/390/430px, 1440px consultation desktop, 320px patient-entry dialog and narrow dashboard). [Viewport metrics](readiness-viewports.json) distinguish this from backend/provider E2E verification.

## Bounded measurements

Same 100 synthetic visits: populated daily summary response 428,938 → 69,938 bytes
after projection; summary-only response remains 355 bytes and avoids the populated
appointment query. Consultation initial staff requests 4 → 2 by source and role-loading
tests, with patient/doctor selectors loaded only in the shared entry form. Charts now
use aggregate totals rather than the first appointment page; 230 scoped visits counted.
These are payload/query-count/correctness measurements, not production latency or load
benchmarks. Existing clinical-history index and queue-delay measurements remain valid.

## External gates

No deployment, live migration, account reset, backup/export, restore or provider charge
was performed. Required: review legacy staff grants; communicate MFA deadline; real
authenticator/recovery and browser journey rehearsal; TLS/cookie/CORS/proxy checks;
private DB/bucket ACLs and persistent key escrow; workers/alerts/provider sandbox
acceptance; actual snapshot plus application restore; hosted CI/release gates and
capacity/rollback evidence. See the final production-readiness report for the decision.
