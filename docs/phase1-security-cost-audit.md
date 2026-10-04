# Phase 1 security, requests and hosting cost audit

2026-10-04. Completed one incremental source/configuration pass of the existing frontend and backend. Findings: [task ledger](phase1-security-cost-ledger.md). **Stop here; Phase 1 Production Deployment is a separate milestone.**

## Scope and evidence

Reused [healthcare ledger](healthcare-product-ledger.md), [product audit](healthcare-product-audit.md), [scale baseline](healthcare-scale-measurements.md), [release verification](healthcare-release-verification.md), backend [historical security audit](../../backend/docs/production-security-scalability-audit-2026-09-27.md) and [readiness tracker](../../backend/docs/production-readiness-tracker.md). Prior architecture/payment/disruption/timezone/workspace/shared UI fixes were retained; existing local changes preserved.

Reviewed middleware/token issuers, record guards, controller/service queries, serialization, realtime delivery, uploads/consumers, all 47 page entry points, dependency/configuration evidence and worker boundaries. Source tracing does not prove complete tenant isolation, browser behavior or production latency. Five models use the tenant plugin; other models and aggregation require explicit authority. Backend guards remain authoritative; frontend grants are UX.

Installed Next data-security/TanStack Query guides were read before frontend edits. Decisions were compared with [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [WebSocket](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html), [Google identity verification](https://developers.google.com/identity/sign-in/web/backend-auth), [Fastify hooks](https://fastify.dev/docs/latest/Reference/Hooks/), [AWS SDK presigning](https://github.com/aws/aws-sdk-js-v3/blob/main/packages/s3-request-presigner/README.md) and [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Security fixes and compatibility

### Identity and sessions

- `backend/utilities/helpers.ts`, `controllers/auth.ts`, `controllers/onboarding.ts`: existing access-token issuers bind to refresh sessions. OTP/Google/SSO reuse verified-login MFA policy. OTP chooses identity only through the verified channel; consumer phone OTP rejects staff. Auth DTOs use effective tenant grants.
- `middleware/auth.ts`, `sessionResolver.ts`: deployed access tokens require persisted session authority; bare JWT fixtures remain test-only. One indexed session aggregation joins narrow User fields and checks revocation, expiry, active identity, authorization version, role and organization. Positive Redis/local snapshots cannot override revocation. This adds a DB roundtrip on previously cached requests; security is the reason, not a claimed latency gain.
- Guest sessions require explicit route opt-in: booking, existing capability-guarded appointment payment and `/auth/me`'s explicit guest rejection. Account/MFA/passkey/session routes deny them. MFA enrollment requires an unexpired server setup secret, consumes it once and replaces prior sessions. Already enabled MFA requires recovery to replace.
- `GoogleAuthService.ts`: fixed HTTPS JWKS, coalesced bounded cache, timeout/no redirects, RS256 signature, configured audience/issuer/expiry/verified-email and stable subject binding. No token-info call per login. Legacy third-party-email Google accounts without a subject require linking/recovery.
- SSO remains the existing trusted HMAC bridge, not a new OIDC/SAML implementation. Provisioned identity/membership, signed audience, second-based timestamps with validity at most 300 seconds and one-use nonce are required before local MFA/cookie issuance. Configured production redirect requires HTTPS. Raw auth tokens are not returned.
- `User.ts` JSON omits password/MFA/reset/verification secrets and Google subject. Lean reads still require explicit projections; JSON transforms do not protect them.

### Clinical access, input and private delivery

- `controllers/search.ts`: patient ownership and encounter clinic/organization checks precede service reads; query/date/category/cursor/limit bounded; generic failure messages.
- `notifications/websocket.ts`: private socket/SSE delivery checks persisted session/JWT expiry/current clinical grant; revocation closes notification, clinical and SSE transports. Browser Origin validated; malformed cookie decoding fails closed; protocol JWT extraction fixed. Public queue payloads remain minimal. Heartbeat/event authorization adds DB work for current authority.
- Exports require the report's clinical/billing/pharmacy grant; CSV formula prefixes neutralized. Existing row/date caps retained.
- Sanitizer strips Mongo operator/dotted/prototype keys, uses null-prototype objects and rejects nesting beyond 32. Raw webhook signing buffers retained. Affected patient/preauthorization/template/H1/ROOT searches use bounded literal regex.

### File authority and printing

- `uploadPolicy.ts`, `r2.ts`, `routes/upload.ts`: current patient/tenant/grants, MIME/class/filename/declared size checked. Storage verification limits metadata and streamed bytes with 30-second abort. Presigned PUT signs exact length/normalized type for 120 seconds.
- Writable objects use `upload-staging/<org>/...`; checked bytes get a fresh server-only `tenants/<org>/verified/...` key. The old PUT cannot overwrite accepted bytes. One pending intent claims verification; completed intents no longer expire. Invalid content rejected, transient failures remain retryable.
- Canonical endpoints: `/api/uploads/intent`, `/api/uploads/verify`, `/api/uploads/download/:intentId`; accidental double `/api` removed. Presigned callers must declare size, upload, verify and register by intent. Compatibility `/api/get-upload-url` uses this contract.
- Base64 route validates bytes and returns a completed intent/private key. `url`/`publicUrl` are compatibility key fields, not public clinical URLs. Frontend sends one encoded field instead of two and lab supplies patient/class. The 10 MB JSON transport cap still limits decoded content; larger clinical files use presigned upload.
- `controllers/documentUpload.ts`: registration requires patient/organization/uploader-bound completed intent; canonical metadata comes from it. One-use claim, document and durable event share the existing explicit transaction. Download rechecks patient/grant and storage prefix. Legacy external URLs are not fetched automatically.
- New manually recorded lab attachments must match a verified patient/organization upload. Frontend no longer converts a failed upload into a data URL/success. Historical clinical attachments were not rewritten.
- `printBrand.ts` and document modal sandbox print frames, remove active nested content/handlers/executable URLs and escape title metadata. Asset readiness, paper palette and preprinted layout retained.

Signature/pattern scanning is **not antivirus/CDR** and does not establish every PDF/image is harmless. Production inspection/rendering policy remains required. No scanner infrastructure was introduced speculatively.

### Limits, logging and configuration

- Tenant limiter moved after identity exists. Existing 2,000/min tenant and 500/min IP budgets retained; security/public mutation routes retain their endpoint-specific limits. Measure hospital NAT traffic before tightening global budgets.
- Production cookie CSRF accepts configured origins; forwarded Host no longer establishes authority. Development host/LAN allowances retained. Fastify IP replaces manual `x-forwarded-for` parsing in affected identity/analytics paths.
- Request logs omit query/headers/body and label IDs; error alerts use registered route labels. ROOT auth protects profiling; unknown metrics use one label.
- Traffic stores route shapes/referrer origins, not patient IDs/query-bearing referrers. Client org/clinic fields are analytics attribution, never permission authority. Existing analytics were not cleaned; IP/visitor retention/consent needs operational ownership.
- Both Sentry error and transaction hooks drop request/user/context/breadcrumb/extra/log-entry values and span data/query descriptions. Error text uses pattern redaction, which cannot recognize all PHI. Existing local error logs still require operational PHI discipline. Alert dedupe expires entries and caps at 1,000.
- Existing Next nonce CSP/no production `unsafe-eval`, no-store tracker/auth responses, HTTPS cookie policy, signed webhook validation and transactional payment/refund authority retained. No new user-controlled backend fetch. JWKS/provider endpoints are fixed/operator configured; SSO redirect is operator configured.

## Request/query and cost effects

| Change | Material source effect | Limit |
| --- | --- | --- |
| Lab bootstrap | Removed unused clinic/global staff reads; reuse workspace and scoped worklist | Up to two fewer metadata requests, no browser capture |
| Lab patient lookup | 300 ms debounce and replaced-read cancellation | Saves keystroke queries; mutations not cancelled |
| Base64 upload | Removes identical second encoded payload | Approximately halves duplicated encoded content; envelope remains |
| Queue TV | Announcement ref avoids token-driven reconnect; coalesces reads; approximately 30-second connected HTTP fallback; hidden polling skipped | Disconnected 3.5-second recovery and immediate event refresh retained |
| TV lifecycle | Wait for URL initialization; abort scope cleanup/ignore aborted reads | Avoids irrelevant initial internal queue fetch/stale replacement |
| Patient directory | Tenant filter before narrow user join and count/items facet | Removes global matching-ID array; search/sort still depend on tenant size |
| Quality metrics | Two scoped counter aggregations | Bounded API memory/response; DB still processes matching history |
| Clinical search | Narrow projections, skip irrelevant categories | Matching history ranking still materializes records; P2 |
| Google | Coalesced signing-key cache/local JWT validation | Key rotation refresh bounded; patient authority is not cached |
| Monitoring | Bounded route labels and dedupe | Removes uncontrolled label/key growth |

No dollar/p95 claim without measurement. Persisted session checks and verified file copy intentionally add work for authority/integrity. Existing modular transaction/outbox/store boundaries retained. No blanket caching, giant widget API, new service/queue/database or infrastructure.

## Every-page review

Inventory: 47 page entry points. Includes delegated components/services/stores. These are source dispositions, not measured requests/navigation; conditional actions, events and development Strict Mode affect actual counts. Previous auth/clinic/module/notification scope/coalescing fixes are reused.

| Route | Requests / DB disposition |
| --- | --- |
| `/` | Entry/redirect/presentation; no new aggregate or polling |
| `/verify-email` | Explicit token verification; private query excluded from analytics/logs |
| `/pricing` | Small public plan presentation/catalog boundary retained |
| `/browse` | Delegated bounded clinic catalog, filter debounce/cancellation; prior loading fixes retained |
| `/browse/[id]` | Clinic/providers plus availability previews; preview fanout is measured P2 |
| `/doctor/[id]` | Public profile/booking; prior loading boundary/minimal DTO retained |
| `/track/[appointmentId]` | Private proof, fresh state and authorized actions; earlier fences retained |
| `/join/[clinicId]` | Walk-in identity/capacity and duplicate recovery privacy retained |
| `/check-in` | Explicit visit selection/arrival; server authority retained |
| `/queue-tv` | Poll/socket/lifecycle waste fixed; fast fallback/minimal payload retained |
| `/login` | Explicit login/OTP/Google/MFA; countdown local; shared MFA fixed |
| `/register` | Registration/optional clinic context; session-bound issuance |
| `/onboarding` | Focused organization/module setup; literal search/server MFA proof fixed |
| `/accept-invite` | Expiring invitation/explicit accept; grants/session retained |
| `/reset-password` | Explicit challenge/reset; hashing/expiry/revocation retained |
| `/dashboard` | ROOT aggregate already measured; role-specific bounded lists/counts retained |
| `/dashboard/appointments` | Bounded/debounced lists and visible refresh; submit availability validation necessary |
| `/dashboard/queue` | Visible refresh/events; preserve operational claims/freshness; burst overlap P2 |
| `/dashboard/consultations` | Queue/patient/staff/summary serve distinct controls; selector growth P2 |
| `/dashboard/consultations/[id]` | Encounter workspace/modular children; patient/clinic guards; no clinical write cache |
| `/dashboard/patients` | Debounced/paginated directory; tenant-first identity search fixed |
| `/dashboard/patients/[id]` | Delegated clinical workspace; search/report/download authority fixed |
| `/dashboard/patients/[id]/timeline` | Existing history/provider cursor; retained-history ranking P2 |
| `/dashboard/patient-portal` | Owner/family appointments/invoices; earlier checkout/workspace integrity retained |
| `/dashboard/billing` | Invoice/appointment/till controls; deferred lookup; explicit refund evidence reconciliation |
| `/dashboard/bills` | Bounded legacy invoices; no duplicate payment model |
| `/dashboard/billing/services` | Service catalog/explicit writes; existing grants/limits |
| `/dashboard/insurance` | Workflow/bounded selectors; larger metadata payloads P2 |
| `/dashboard/laboratory` | Unused reads removed; scoped/latest reads, debounced lookup, verified attachments |
| `/dashboard/pharmacy` | Workflow/modal catalog; bounded reads/report grants |
| `/dashboard/radiology` | Diagnostic lists/modal metadata; tenant/clinic guards retained |
| `/dashboard/teleconsultation` | Scoped appointment/session lists; explicit actions |
| `/dashboard/shifts` | Clinic/staff context plus active roster window; no added polling |
| `/dashboard/feedback` | Summary/list distinct; parallelization P2 pending latency evidence |
| `/dashboard/analytics` | Date/clinic-scoped aggregates; quality counters replace history materialization |
| `/dashboard/audit` | Paginated latest reads/scope cancellation; immutable backend authority |
| `/dashboard/notifications` | Scoped query/provider/socket; earlier frontend fences plus backend session gate |
| `/dashboard/clinics` | Shared location/workspace data; no second clinic store |
| `/dashboard/staff` | Shared team/scoped directory and explicit grant-guarded writes |
| `/dashboard/organizations` | ROOT selected organization/aggregate boundary; earlier measurements reused |
| `/dashboard/security` | Explicit MFA/passkey/session actions; guest/setup boundary fixed |
| `/dashboard/settings` | Shared workspace policy reads/explicit writes; scope boundary retained |
| `/dashboard/settings/modules` | Existing coalesced module store; no widget-level duplicate |
| `/dashboard/settings/billing` | Bounded checkout verification retries; simulation exclusion/404 deferral retained |
| `/dashboard/admin/users` | ROOT bounded directory/latest reads; no full identity fetch |
| `/dashboard/admin/billing` | ROOT plan/subscription finite list/action boundary |
| `/dashboard/admin/monitor` | ROOT summaries/profiling; bounded labels; visitor distinct-array memory P2 |

## Database/scale disposition

Existing 10/100-provider and 50/500-organization measurements were not rerun. ROOT retained-history/concurrency and proposed extra history index remain P2. New index rationale is identity integrity: unique sparse `User.googleSubject` for subject lookup; unique SSO nonce `_id` plus expiry TTL. No production index build or migration.

Mongo min pool defaults to 10 per production process; API plus five workers multiply the budget. Size total pools against the selected Mongo tier. Current `Number(env) || default` means `MONGODB_MIN_POOL_SIZE=0` falls back; do not assume zero is supported. No arbitrary pool reduction or capacity upgrade without deployment measurements.

## Verification

Risk Level 4. User explicitly restricted this pass: no full suites, browser E2E, long integration suite, build, load test, live provider/data action, seed or migration.

- Seven `phase1AuthBoundaries` cases passed: Google MFA/claims/key reuse; persisted revocation/sessionless denial; SSO replay/MFA; verified OTP channel/staff; guest/expired/client-selected MFA setup.
- Nine `phase1SecurityContracts` cases passed across selected batches: upload route/server copy; scoped linked/unlinked patient search/profiling denial; storage bounds/MIME/signed length; canonical one-use document metadata/foreign denial; revoked socket/origin; production CSRF/CSV; analytics/transaction/depth minimization; tenant quality counters/empty state; lab attachment patient binding. Pattern-excluded cases were not deleted or claimed rerun.
- Four selected print regressions passed: nested active content, one print, assets and preprinted layout. jsdom is not native browser printing proof.
- Backend/frontend TypeScript passed; frontend uses `--incremental false` and excludes test files. Changed frontend lint: zero errors, existing warnings retained. Both repository whitespace checks pass.

Earlier 398 frontend/806 backend release tests, builds/startup and replica-set commit/rollback evidence **predate this pass**. New document cases check authority/metadata/claim in isolated fixtures, not new deployed transaction rollback certification. Release gates must cover these edits in the separate milestone.

## Remaining deployment requirements

1. Deploy all replicas with persisted session policy; refresh/relogin legacy sessionless JWTs; retire old positive-cache consumers. Retire the historical signing credential noted in the security tracker and verify current secret rotation/revocation. No secrets printed.
2. Google audience/JWKS egress and legacy identity/index preflight. SSO bridge must sign audience, second-based `iat`/`exp`, provider/identity and fresh 16–128-character nonce with a strong secret; configure `SSO_CALLBACK_AUDIENCE`. Verify bridge/cookie/MFA compatibility.
3. Transaction-capable Mongo and required indexes. Conditionally unset TTL `expiresAt` on legacy **completed** UploadIntents before cleanup can delete clinical authority. Pending/verifying intents still expire; crashed verification needs a new intent. No maintenance performed.
4. Private R2, [CORS](https://developers.cloudflare.com/r2/buckets/cors/), exact signed length/type and synthetic upload/download tests. Lifecycle purge only orphan `upload-staging/`, never verified clinical keys. Decide file inspection/rendering policy; migrate clients to verification/intent registration.
5. Explicit HTTPS CORS/CSRF origins, secure cookie/domain/SameSite, trusted proxy hops/CIDRs and origin firewall. Default private/loopback trust alone is not deployment proof. Verify real browser CSP/provider/payment hosts.
6. Earlier dependency gate reports unpatched high-severity development `braces` GHSA-vfj7-8cjw-p6xm through five package entries. Runtime-only clean results are supplemental. Recheck upstream fix; no dependency change or audit suppression here.
7. Clean hosted CI/build/release gates, authenticated identity/upload/booking/arrival/consultation/payment/refund journeys, Razorpay test mode, deployed worker/restart/outbox behavior and authorized backup/restore/rotation. No staging/provider account inferred from production credentials; no deployment.

## P2 deferred

Retained-history/concurrent/network measurements before ROOT indexes, selector pagination or broader dashboard aggregation; clinical search/timeline DB ranking/provider cursors (response pagination does not bound intermediate history); measured availability batching without removing final validation; traffic distinct-count memory and retention/consent; Mongo pool/worker concurrency at 10x/100x. No silent clinical truncation or new infrastructure.

This closes the recorded source findings locally. Deployment requirements remain explicit; focused checks are not whole-application production certification. Stop at this milestone.
