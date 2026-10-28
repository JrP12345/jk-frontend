# Application security review — 2026-10-15

## Implementation closeout

The seven original fixes were inspected and their 13 focused authorization regressions
passed again. Additional confirmed gaps were implemented without deployed-data changes:

| Prior outstanding area | Actual source resolution | Remaining deployment obligation |
| --- | --- | --- |
| Legacy grants (high) | Removed implicit all-branch fallback; validate tenant ownership, active branches and matching membership roles | Review missing legacy grants before rollout |
| Permission presets/assignment (high) | Organization staff assignment cannot select root or consumer identities; organization admins cannot edit consumer presets | Review historical custom presets/assignments through authorized administration |
| Exception data exposure (high) | Metadata-only catch logging, Pino serializers, telemetry minimization and production 5xx envelopes | Review historical retention/access and new log call sites |
| Staff MFA (high assurance gap) | Existing TOTP enforced for production staff; recent-login/session-bound encrypted enrollment, UI gate and operator recovery; WebSockets covered | Communicate rollout deadline, perform real-device enrollment/recovery rehearsal |
| Transport/proxy (medium–high, topology dependent) | HTTPS origin/cookie/proxy validation; production proxy trust defaults off; private Compose topology explicitly one hop | Verify TLS, firewall, cookies, CSRF/CORS and actual forwarding chain |
| Secrets/storage | Existing persistent encryption/signing/private-download controls retained; configuration validates without echoing values | Provision/escrow keys, private bucket/DB ACLs, repository-history secret scan |
| Recovery | Dedicated strong new-archive key, bounded authenticated decrypt/decompression, private archive creation, paginated latest selection and isolated restore cleanup | Authorized real snapshot restore plus application/key/index verification; RPO/RTO approval |

Focused evidence is maintained in `production-readiness-tracker.md#security-recovery-and-configured-provider-acceptance`. Operational settings
and recovery procedures are documented in the backend security guide. Infrastructure
items remain externally unverified and are not marked resolved by repository changes.

Further cross-module tracing confirmed and fixed these boundaries:

| Additional finding | Severity / prerequisite | Fix and evidence |
| --- | --- | --- |
| Clinical search exposed observations from other tenants/branches for an authorized patient | High; staff with VIEW_EHR and a shared longitudinal patient | Explicit tenant and granted-location filters on observations, notes and labs; ownership-checked consumers retain their own longitudinal view. A three-scope fixture returns only the granted observation. |
| Executive/KPI/summary/export ignored branch grants; three reporting entry points required authentication alone | Medium; restricted authenticated staff | Uniform reporting permission, granted active locations, explicit tenant filters and scoped quality metrics. New regressions reproduced sibling branch results and unauthorized KPI access before correction. |
| Assignment list exposed sibling branch assignments/staff contact information | Medium; staff with VIEW_LOCATIONS | Restrict list to allowed branches; reject explicit ungranted locations and malformed IDs. Positive/negative regression passed. |

Recovery always forces enrollment again, including during a general rollout grace
period. Refresh-token rotation and workspace switching preserve primary-authentication
time. Legacy records have no schema default that manufactures proof and require a fresh
sign-in before enrollment. Browser exception logs now retain fixed labels
instead of Axios/WebSocket objects or raw errors. The source/bundle startup checks and
production dependency audits passed; these do not verify deployment or provider security.

This review traced selected real Next.js → Fastify → Mongoose flows and implemented narrow authorization fixes. It is not an ASVS certification, an exhaustive endpoint penetration test, or an assessment of deployed infrastructure. Existing mobile/performance changes in these checkouts were preserved. No production records, secrets, keys, or infrastructure were changed.

## Standards and scope

The review used the published ASVS **5.0.0** requirements for authentication, sessions, authorization, and data protection. Server enforcement, object ownership, field publication, and tenant boundaries map to V8.2.1–8.2.3, V8.3.1, and V8.4.1. Session lifecycle and sensitive-data handling were reviewed against V7 and V14. This applies relevant controls proportionately; it does not claim every ASVS requirement is satisfied. Sources: [ASVS authorization](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md), [authentication](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md), [sessions](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md), [data protection](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x23-V14-Data-Protection.md).

API risks were classified using OWASP API Security Top 10 2023, particularly [API1 object authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/), [API3 property authorization](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/), and [API5 function authorization](https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/). API4 resource limits were also reviewed. Framework guidance included [Fastify validation/serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) and [Next.js data security](https://nextjs.org/docs/app/guides/data-security), together with the installed Next.js guide at `node_modules/next/dist/docs/01-app/02-guides/data-security.md`.

The main traced paths were session issuance/resolution, RBAC, organization/location helpers, appointment/encounter references, score and prescription reads, vital trends, clinical templates, invoice/payment authorization, uploads/downloads, patient records, frontend storage/cache/printing, CSP, production configuration, and encrypted backup code. Broadly shared helpers were inspected; they were not rewritten. Runtime verification concentrates on the modified clinical boundaries and their direct consumers.

## Confirmed findings and fixes

Severity reflects impact and practical prerequisites, not a calculated CVSS score. All listed attacks require authentication; object attacks additionally require a valid target ID. IDs are not treated as authorization secrets.

| Finding | Severity / exploitability | Evidence before the fix | Implemented boundary |
| --- | --- | --- | --- |
| Encounter-score BOLA | High; any portal patient/family account with an encounter ID | `GET /api/encounters/:id/scores` accepted a location check that deliberately permits consumers. The response exposed another patient's risk score and vital parameter breakdown. Family revocation did not affect this path. | Check current patient ownership or active family relationship before returning scores. Keep staff organization/location checks. Bind returned score rows to the encounter's organization and patient. |
| Clinical score writes through a read gate | High; portal accounts and staff with only VIEW_EHR | `POST /api/encounters/:id/evaluate-score` used the same gate as clinical reads and persisted clinical snapshots/alerts. | Require EVALUATE_NEWS2, MANAGE_EHR, or MANAGE_CLINICAL_NOTES. Preserve nurse/custom scoring roles. Bind observation inputs to the authorized encounter's organization, location, and patient. |
| Staff vital trends crossed tenant and branch boundaries | High; staff authorized for a shared patient | `ObservationAnalyticsService` filtered only patient ID/date. Observation has no tenant plugin. A restricted staff fixture received values from another organization and an ungranted sibling branch. | Pass explicit staff organization and granted location IDs into the database query. Ownership-checked portal users retain their own longitudinal records; root retains existing privileged behavior. The scope argument is explicit, without a default unscoped staff read. |
| SOAP template content shared globally by default | High when clinical free text contains patient information; ordinary clinical writer | Creation defaulted isPublic to true, accepted client publication, and reads included every public template regardless of tenant. | Default API/model publication to false; reserve explicit publication for platform root. Share only public catalog rows without an organization. Tenant rows remain in their own workspace even with legacy public flags. |
| OPD template workspace scope bypass | Medium; a doctor with memberships in multiple organizations | Read authorization included doctorId across all organizations. Delete checked author ID without active organization. | Scope organization templates to the active organization; restrict shared catalog rows to organization-free public entries. Delete atomically by ID + author + organization. |
| OPD template write/reference authorization | Medium; a non-clinical staff session or clinical writer supplying a foreign branch | Routes required authentication alone. Creation accepted locationId without ownership validation. | Add clinical read/write permission and module gates; validate location access and organization consistency before insert. Organization context is required for custom writes. |
| Prescription integrity metadata BOLA | Medium; portal account with another patient's prescription ID | Integrity verification relied on the consumer-permissive location check, exposing existence, seal status, and potentially hashes/sealing metadata. | Require patient ownership or active family authority before verification; retain staff tenant/location controls. |

Backend files changed for this review: `routes/clinical.ts`, `controllers/observationAnalytics.ts`, `services/ObservationAnalyticsService.ts`, `controllers/prescriptionSafety.ts`, `controllers/opdTemplate.ts`, `controllers/soapTemplate.ts`, and `models/SoapTemplate.ts`. Security regressions are in `tests/clinicalAuthorizationBoundaries.test.ts`.

The fixes preserve patient self-access, active family authority, nurse scoring, authorized custom-role scoring, organization preset access, prescription safety, and standard templates. Default catalog setup now counts global public templates, so private templates in another tenant cannot prevent catalog initialization. No patient-data cache, authentication replacement, dependency, or additional service was introduced.

## Verification evidence

Highest change risk: Level 4 (patient data, authorization, clinical persistence).

- Before implementation, eight assertions failed in the new boundary file, demonstrating unauthorized reads/writes and private-template exposure. A later dedicated vital-trend reproduction returned `[80, 190, 175]` to a staff member whose only authorized branch contained `80`.
- After fixes, the boundary file covers same-tenant and cross-tenant portal denials, own/family access, immediate family revocation, denied writes without persistence, nurse/custom-role scoring, permission removal, foreign staff encounters, malformed IDs, prescription metadata, workspace reads/deletes, foreign location references, private/public template policy, default catalog setup, and staff versus portal trend scope.
- Existing `opdTemplatesAndFollowUpRecall.test.ts` and `prescriptionSafety.test.ts` passed, covering preset lifecycle and prescription safety workflows. Existing `securityHardening.test.ts` passed its six encryption/CSRF/refresh-rotation cases.
- Total focused coverage: **29 unique passing backend cases** across four files: 13 new boundary cases, 10 OPD/prescription regression cases, and six existing security-hardening cases. The new boundary file was rerun as findings were added; repeated runs are not counted as additional cases.
- Backend TypeScript and the API/four-worker bundle check passed. No full suite, production replay, operational seed, migration, or live database probe was run. Fixture writes used the existing isolated MongoDB memory replica set.
- `npm audit --omit=dev --json` queried npm's public advisory service for both repositories and reported **zero known production dependency vulnerabilities** on the review date. This excludes development dependencies and is not a guarantee of vulnerability absence. No dependency update was necessary.
- Frontend source changes were unnecessary for these server-side fixes. Installed Next.js security documentation and relevant frontend consumers were inspected; frontend browser E2E and production configuration were not exercised.

## Existing controls retained

- Authentication uses RS256 verification restricted to that algorithm, persisted revocable session authority, user/account status and authVersion checks, identity/organization consistency, and workspace membership revision checks where issued. Production root sessions require MFA enrollment. HTTP-only access/refresh cookies are secure in production, and authentication responses set no-store.
- Cookie-authenticated mutations have Origin/Referer validation; production trust does not derive from a client-supplied forwarded host. CORS uses configured origins with credentials. Webhook exemptions require their endpoint-specific signature handling; they are not ordinary staff authentication paths.
- Staff tenant selection derives from the authenticated session. Client organization/location preferences do not grant backend authority. Selected location grants and operational-record checks remain in force. Query middleware is defense in depth: several clinical models do not have it, which is why this change uses explicit query constraints.
- Booking/clinical code checks linked appointment, doctor, patient, and location consistency in the inspected paths. Payment authorization, ownership checks, idempotency and transaction boundaries were retained. No financial mutation was changed.
- Uploads use authorization, tenant/patient-bound intents, size/type checks, byte signatures, active-content checks, sealed server-only storage keys, and short-lived attachment downloads. SVG/HTML are not accepted as clinical uploads. No direct public clinical bucket access was added.
- The frontend treats proxy cookie presence as navigation assistance, while APIs independently authorize. Auth state is in memory; operational clinical drafts are not persisted to localStorage in the inspected editor. Logout clears patient-related session/cache state, and the service worker only permits explicit public resources. CSP uses request nonces; structured data and print titles are escaped in inspected consumers.
- Request logging removes query strings and masks object IDs; audit details and telemetry have data minimization. The reviewed backup script encrypts archives with AES-256-GCM and requires a dedicated backup key. These controls do not prove all logs or storage systems are PHI-free.

## Residual risks and production configuration

1. **Deploy the fixes and review possible prior exposure.** New authorization does not recall previously downloaded content. Assess access logs/audits for the affected endpoints under the organization's incident process. This review did not inspect live data or determine whether exploitation occurred.
2. **Review legacy template ownership.** Organization-bound legacy public flags no longer expose content to other tenants. Private OPD presets without organizationId are no longer included through author-only matching. If such records exist, assign them to a verified organization through a reviewed migration; do not guess from a multi-workspace doctor's identity. No migration was run.
3. **Review legacy location grants before rollout.** The security closeout removes the organization-wide fallback. Existing doctor/receptionist assignments derive only active, tenant-owned branches; other missing staff grants deny branch access. Reviewed administrator memberships retain organization scope. Administrators must assign grants for legacy nursing/custom staff before rollout; no production migration has been run.
4. **Keep production boundaries explicit.** Use NODE_ENV=production, HTTPS, precise CORS_ALLOWED_ORIGINS, the intended cookie domain/SameSite policy, accurate trusted-proxy hops/CIDRs, and origin protection/firewall settings where applicable. A broad trusted network must not make forged forwarding headers authoritative. Validate these settings at the actual edge; local tests do not verify it.
5. **Protect durable keys and backups.** Provision persistent JWT keys, DATA_ENCRYPTION_KEY, PRESCRIPTION_SIGNING_KEY, webhook secrets, and a separate BACKUP_ENCRYPTION_KEY through the deployment's secret facility. Keep clinical object storage/private backup buckets restricted, retain keys for recoverability, define retention and access reviews, and perform the existing restore drill in an authorized environment. Tracked example files and filename-only scans do not replace a repository-history secret audit.
6. **Staff MFA rollout now requires operational preparation.** Production staff must enroll the existing TOTP mechanism before operational HTTP/WebSocket access. An explicit dated grace period supports existing clinics. Enrollment requires a recent primary login, encrypted session-bound pending setup, code verification and session revocation. Operator-only identity-reviewed recovery clears the old factor, revokes sessions and requires enrollment again. Root remains stricter. See the backend `docs/security/staff-mfa-and-recovery.md`; no complete ASVS Level 2 authentication claim is made.
7. **Exception sinks were hardened; operational data review remains necessary.** Controller/service/worker catch logs now emit allowlisted error metadata. Pino error serializers and Sentry/pager minimization exclude raw exception text/stacks/locals. Production handled 5xx error envelopes suppress raw details. Existing support scripts that intentionally display enrollment QR artifacts require private execution. This does not certify arbitrary future log call sites or historical log retention/access.
8. **File checking is not comprehensive malware detection.** Signature and active-content scanning, attachment disposition, and private downloads reduce exposure but do not establish that arbitrary PDFs/DICOM files are malware-free. The implementation honestly retains malwareClean=false where a comprehensive scanner has not run. Assess additional scanning based on accepted file workload rather than adding infrastructure by default.
9. **Deployment and external integrations remain unverified.** Database TLS/ACLs, restore success, storage policies, provider dashboards, production origin/cookie behavior, all integration/webhook branches, and the complete route/role matrix require deployment-specific checks. Single-node in-memory rate limiting is appropriate only for the explicitly configured single-instance topology; multi-replica coordination must use the existing supported configuration. This source review is not a substitute for those checks.
