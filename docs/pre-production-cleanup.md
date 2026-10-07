# Ekavyu pre-production cleanup

2026-10-07. Scope: frontend and sibling backend. Existing workspace changes were preserved. No deployment, live database reset, provider transaction, seed or secret rotation was performed.

## Verified findings and decisions

| Found | Action |
| --- | --- |
| Physical locations named Clinic throughout models, stores, permissions and APIs | Migrate consumers to Location, locationId, maxLocations and amenities; keep clinic as a facility type |
| Multiple API versions, CSV versions and duplicate public fields | One /api contract, one CSV layout, canonical public DTOs and directory pagination |
| Public database-ID provider URLs | Resolve published slugs only; queue join and QR posters use the location slug |
| Internal encryption facade, previous ciphertext reader and key aliases | Use cryptoEnvelope and DATA_ENCRYPTION_KEY with the current enc:v1 envelope |
| Sessionless test authentication and anonymous organization provisioning | Persist sessions in fixtures; require authenticated Root provisioning and private realtime authority |
| Upload aliases and an untracked branding-key proxy | Canonical objectKey/intentId contract and ownership-registry branding references |
| Duplicate theme variables, unused card/chart branches and obsolete assets | Canonical semantic consumers, one responsive chart, current Ekavyu assets and appearance preference |
| No-op automatic no-show worker and unavailable API | Remove the job, executable, command, setting and route; retain manual outcomes and derived review states |
| Startup quota backfill and dangerous maintenance/seed scripts | Provision quotas explicitly; guarded empty-development seeds/reset and one index preparation command |
| Dated reports contradicting current contracts | Consolidate current documentation and migrate all references; Git retains previous reports |
| Duplicate lab result fields and timestamps | One structured result and resultedAt across writers, history, reporting, seeds and the laboratory UI; remove unused future verification field |
| Unused homepage, appearance, loading and modal wrappers | Remove unreachable modules, five wrappers, unused exports/variants, stale cases and their obsolete styles |
| Slug values named as IDs in public page parameters and booking fallbacks | Rename browse/doctor route folders and client props to slug; require the resolved location for availability and booking |
| Eight unused animation rules and stale domain guidance | Remove animations with no callers; update management, AI, messaging, printing and deployment documentation to current names and worker counts |
| Deployment examples still declaring the previous encryption variable | Use DATA_ENCRYPTION_KEY in both deployment examples; document preserving the existing secret when configuring Render and sharing it across API/workers |

The canonical commercial plan key is professional. Session-close cancellation uses cancel and does not imply a refund. Tracker links use fragment capabilities and the page consumes the same format. UPI actions require configured merchant details. Navigation keeps the original full-width geometry and separate dashboard toolbar.

## Retained boundaries

Current protocol versions, provider endpoints, framework entry points and upstream lockfile metadata are required. Stable encryption derivation constants and immutable audit transition fields protect authenticated records. The retired offline database name is retained only to erase cached patient data. Native form behavior, storage-restricted recovery, nonproduction fixtures and failure/retry safeguards serve current features.

See [domain-model-audit.md](domain-model-audit.md), [design-system.md](design-system.md), [ekavyu-visual-identity.md](ekavyu-visual-identity.md), the backend [development lifecycle](../../backend/docs/development-data.md) and [API contract](../../backend/docs/api-contract.md). The final keyword inventory records a reason for retained matches.

## Verification

Highest risk is Level 4: domain contracts, sessions, tenant permissions, booking, clinical files, billing and database tooling. Checks use disposable MongoDB and mocked providers. Frontend package TypeScript excludes test files; Vitest provides their runtime coverage.

| Check | Final evidence |
| --- | --- |
| Frontend tests | 81 files / 477 current cases verified: 472 passed in the broad run; the corrected spinner file passed its five remaining cases. Final shared-control consumers also passed 60 cases. Final route cleanup passed 89 cases across 11 affected files; the two updated booking/mobile consumers then passed their 22-case rerun. |
| Backend tests | 154 files / 872 current cases verified across the broad run and affected reruns. Three stale fixture failures were corrected. Final lab/history regressions passed 87 cases; the added canonical-payload case passed in the seven-case laboratory rerun. Encryption/configuration regressions passed 12 cases, including the added requirement for the canonical environment variable. |
| Types and bundles | Backend package TypeScript passes. Next production compilation/types pass. Backend API and four workers build to five verified executable bundles. |
| Lint and boundaries | 217 changed frontend code files pass ESLint with existing warnings; final affected files pass with warnings. Route and consumer lint passes without errors. Patient payment boundary and both repositories' diff checks pass. |
| Repository audit | No broken local Markdown links, unused public assets or unused environment-example settings found. Framework entries/configs, current generators and verification scripts are retained with identified callers. |

Frontend builds used a non-routable HTTPS fixture API origin; their artifacts are verification artifacts. No deployed browser journey or provider operation was performed. Backend disk bundle creation required filesystem escalation for the existing dist directory.

See [retained occurrence inventory](cleanup-retained-occurrences.csv). It records repository, file, line, matched terms and a reason for every requested keyword match in source/configuration/documentation/lockfiles. Generated/vendor outputs, actual environment secrets and the inventory itself are excluded. Ordinary terms such as bold, placeholder and threshold are recorded too. Stable derivation salts, published signing-key denylist entries, historical browser-cache deletion and existing external deployment resource identifiers are documented exceptions.

Local checks do not exercise hardware passkeys, authenticated deployed browser journeys, provider settlements, cloud grants or a real restore. Outstanding release evidence is listed in [production-readiness-tracker.md](production-readiness-tracker.md) and the backend [release gates](../../backend/docs/production-readiness-tracker.md).
