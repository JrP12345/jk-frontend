# Ekavyu pre-production cleanup

Current cleanup: 18 November 2026. Scope: frontend, sibling backend and static coming-soon site. Existing uncommitted feature work is preserved. No database, index application, provider send, secret rotation or deployment was performed. Earlier checkpoints below retain their original dates and verification scope.

## Repository hygiene, 18 November 2026

The whole tracked/untracked source inventory, package manifests/lockfiles,
documentation, assets, script/configuration references, file-system routes and
literal dynamic imports were inspected. Static no-import findings were reviewed
against framework entries and runtime generation before deciding on removal.
This is evidence-based cleanup, not a guarantee that every export has a caller.

### Removed and preserved files

- Backend: removed 75 obsolete generated executables in 15
  `.cache/pharmacy-*-build/` trees: billing-only, catalogue, device, external,
  followups, numbering, ownership, p0, p1-search, pricing, purchase-csv,
  reconciliation, save, snapshot and supplier-mappings. Current API and four
  workers build through the retained `scripts/build.mjs` into ignored `dist`.
- Backend: removed two completed, unreferenced one-off index-removal scripts
  (`apply-pharmacy-numbering-indexes.mjs`,
  `apply-pharmacy-reviewed-development.mjs`), obsolete
  `pharmacy-activation-paused.json` process IDs, and 11 raw runner/debug reports
  from `.cache`: p0 benchmark/final, purchase-csv access-final/final/tests,
  search benchmark/phone/tests, supplier-mapping-debug and supplier-mappings
  final/tests. Test sources and assertions remain intact.
- Preserved both reviewed index-definition records, four save/concurrency
  benchmark records and the search sample in the backend
  [development evidence archive](../../backend/docs/measurements/pharmacy-development-2026-11/README.md).
  Current setup/search commands, migration reviews, recovery, replay, backup,
  restore and MFA tools remain. No operational action was run as a test.
- Removed the three generated architecture inventory JSON snapshots (frontend,
  backend and landing site). The maintained architecture findings, inventory
  generator and its test remain; future output belongs in ignored `build`.
  Removed the byte-identical backend pre-audit advisory report; the unchanged
  post-audit result, frontend before/after results and database readiness record
  remain dated evidence.

Total: **93 files removed, 7 evidence files relocated**, approximately **70.68 MB**
of removed working-tree files (67.4 MiB). Git history is not rewritten, so this
does not shrink already-published Git history.

### Code, configuration, documentation and assets

Removed three unused chart destructuring bindings and the unreferenced
`WORKER_BACKPRESSURE_POLL_MULTIPLIER` export/imports. Worker polling/backpressure
behavior and chart output are unchanged. No API, product workflow, collection,
public prop or financial algorithm was removed.

Backend Git, Docker and TypeScript now exclude cache/build/coverage outputs;
landing-site build artifacts are ignored too. Frontend build outputs were
already ignored. Maintained dependency tables now reflect the actual lockfiles,
include the existing `fflate` dependency and no longer advertise the previously
removed direct `fastify-plugin` declaration. No dependency or lockfile was
changed during this cleanup; remaining direct packages have runtime, CLI,
type, peer or build uses.

The pharmacy guide index now links current catalogue, supplier, billing-only and
final-offline contracts. Its obsolete draft-only offline statement is replaced.
Historical index-operation links point to the preserved archive. Reproducible
audit snapshots are replaced by generation commands and compact findings.

All public assets, brand source exports, dynamic desktop/mobile screenshots,
offline public modules and legal/third-party notices are retained. Original
product PNGs are inputs/evidence for the retained capture workflow; filename-only
search does not justify deleting them. Existing dated performance and screenshot
reports remain where referenced by current guides or generators.

### Tests, commands and verification

No unit, integration, regression, tenant/security, financial, pharmacy or recovery
test source was deleted or consolidated: no obsolete duplicate suite was proven.
All package/CI/release commands remain. The raw runner outputs removed above are
generated reports, not tests.

Highest changed-code risk: Level 3 (shared chart/worker/configuration).

| Check | Result |
| --- | --- |
| Native frontend production build | `npm run build` passed, including offline asset generation, application types and route compilation; isolated `.next/hygiene-production`, non-routable API fixture. Removed only the two generated TypeScript include paths added by this verification. |
| Cloudflare/Vinext production build | Passed with explicit native exit code 0. Existing plugin/optimization warnings remain; build success does not resolve the previously documented missing-profile HTTP 404 acceptance blocker. No deployment performed. |
| Backend production build | API plus four worker executables passed. First sandbox attempt could not overwrite existing `dist` worker files; the authorized filesystem retry passed. |
| Backend types | `npm run check:fast` passed with current configured rules. A separate exploratory no-unused diagnostic emitted candidates; it is not an enabled project gate and was not reported as passing. |
| Backend regression tests | 25/25 across `domainEventOutbox`, `whatsappReliability` and `scalabilityAndCoordination`, using disposable MongoDB fixtures. |
| Frontend consumer tests | 8/8 across `analyticsReadRecovery` and `staffSecondaryPanels`. |
| Retained tooling tests | Five glob-contract cases and one architecture-inventory case passed. |
| Lint | Full repository baseline: zero errors, 230 warnings. After removing three unused chart bindings, both changed chart files lint clean. Other existing warnings remain; no rule was disabled or downgraded. |
| References and assets | 101 Markdown files checked: zero broken local file links. All 18 product PNG hashes and corresponding WebP sizes match the retained provenance. Static landing site: seven local asset references and its inline script checked; it has no package/build command. |
| History, dependencies and configuration | Seven archived records match original tracked bytes exactly. Both package manifests match root lockfile declarations and all direct packages appear in refreshed dependency tables. Cache/build/coverage ignore checks pass. No environment, deployment, legal or secret file was removed. |
| Diff hygiene | All three repositories' whitespace checks passed. Existing pharmacy, security and architecture changes remain in the working tree. |

Total focused cases: **39 passed**. The complete clinical/financial suites and
live provider/device/restore acceptance were not repeated for these nonfunctional
removals. CI/release gates remain unchanged. Full type/build checks do not provide
frontend test-file type coverage.

## Frontend follow-up, 9 November 2026

Removed 37 superseded files (5,815,541 bytes): 28 unused/obsolete images, eight earlier visual/performance reports, and the replaced Browse review harness. Removed its unused fixture filter and five unreferenced CSS classes. Consolidated the homepage, public interaction and audit-tool guides around the current implementation; updated Browse evidence links and capture provenance. The product capture tool now generates only the nine screens used by the landing page. Current handoffs and website-wide performance baselines remain useful and are retained.

Verification for this cleanup: 20 focused homepage tests, changed-script ESLint and syntax checks, diff whitespace, local Markdown links, deleted-file references, module reachability and all 18 retained PNG hashes/WebP byte counts passed. No orphan application module was found by the import scan. The remaining CSS scan candidates are external/global selectors or dynamically selected dialog sizes. This is a Level 1 removal of unused presentation rules/assets and superseded tooling; no application behavior or types changed, so the full suite and build were not repeated. Earlier cross-repository findings below retain their original scope and dates.

## Inventory and progress

The second entry/import pass covers 563 frontend JS/TS files, 75 framework/runtime entries and 362 reachable modules; backend covers 799 JS/TS files, 35 API/worker/operational entries and 563 reachable modules. Tests, configs, scripts, dynamic loading and model relations are checked separately from imports. The coming-soon page and its three brand images remain referenced.

| Batch | Evidence and changes | Status |
| --- | --- | --- |
| 0. Baseline | Dirty frontend preserved; backend/coming-soon initially clean. Full lint, types and both test suites run. | Complete; failures/reruns below. |
| 1. Stale presentation/tooling | Consolidated landing and completed UI task notes; removed obsolete captures, raw reports, the keyword CSV and old capture script. The subsequent docs pass replaces 53 task reports with 5 topic guides, reducing top-level Markdown files from 72 to 24 and text by about 48%. Current contracts, dated evidence and open release gates are retained. | Documentation consolidation complete; links, anchors and retired references checked. |
| 2. Reachability | Removed unused `WhatsAppBookingSession` model: no workflow/import/string relation; generic index setup merely registered it. Removed unreferenced `migrate-architecture-integrity.ts`; current guarded index tooling remains. Removed unreachable queue lab-modal branch and orphan component; active encounter lab orders remain. | Types/builds/affected tests pass. Export/endpoint review remains. |
| 3. Local redundancy | Removed discarded analytics, lab TAT and ABDM standee reads, unread state, unused handlers/imports, location matcher and badge prop. Broke the install-banner/UI-barrel cycle with direct imports. Fixed the booking test's date-only clock and awaited asynchronous focus restoration in the dialog test. | Completed edits verified; no clinical/booking runtime contract changed. |
| 4. Packages/config/docs | Traced direct dependencies through imports, CLIs, peers and configs: none confirmed unused. Retained active Cloudflare/Vinext, compiler/API packages and tested glob adapter. Added explicit `check:types` to package/CI; refreshed dependencies and current guides. All public assets and environment-example keys have references. README now indexes the maintained guides. | Completed manifests/config/assets and documentation batches verified. |
| 5. Second pass | Repeated reachability, local links, asset/environment references and circular-import scan. No orphan application modules reported. Type-only links and active session/socket, audit append and webhook-worker cycles retained. | Structural pass complete; remaining manual work below prevents declaring the whole objective complete. |

## Actual verification

25 October Browse refinement cleanup: a fresh entry/import scan of 536 frontend source files found no orphan runtime modules (366 reachable modules). The Browse/clinic CSS modules have no unreferenced classes; redundant breakpoint declarations and the obsolete card scroll-margin utility were removed. Review counts no longer include a stray currency symbol. Removed 62 superseded Browse screenshots and 3 unreferenced reports (11,405,581 bytes), including the retired save-feature captures. The 15 current screenshots and referenced behavior/contrast records remain. All 28 public images are referenced, including dynamically selected mobile product screenshots and both responsive hero sizes; brand source assets remain required by their generators. Card tests pass 18/18, changed-file lint has zero errors/warnings, and local documentation links remain valid. Current code, theme assets, fixtures and the reusable review harness are retained.

| Check | Result |
| --- | --- |
| Frontend full baseline | 163 files: 162 passed, 1 failed. 1,197 passed / 5 failed, all in `browseDoctorDetail` after the nominal 10:00 slot elapsed. Fixed only its clock fixture; affected booking/analytics/lab/location run passed 30 cases. |
| Backend full baseline | 221 files: 220 passed, infrastructure setup timed out; 1,948 passed / 1 skipped. Isolated infrastructure rerun passed without production changes. The full baseline took about 98 minutes. |
| Frontend focused reruns | Public-discovery 29/29; final queue/dialog/install 49/49; PWA/CRM 23/23. Earlier queue/admin/shared-clinical run had 37 passes and one focus-timing failure; isolated dialog rerun passed 3/3, then the asynchronous assertion was corrected and final batch passed. |
| Backend affected integration | Dynamic model/index setup and index safety: 10/10, disposable MongoDB only. |
| Lint/types | Broad frontend lint: 252 to 233 warnings, zero errors, before final small edits. Final changed-code lint: 26 warnings / 0 errors. Frontend `check:types` and backend `check:fast` pass. Frontend tests are excluded from package TypeScript; Vitest does not provide test-project type coverage. |
| Builds/boundaries | Next production compilation/types/routes pass in isolated `.next/cleanup-production` using a non-routable API URL. Backend API + four workers build to five bundles. Payment boundary and five glob-tooling cases pass. Initial cache/bundle attempts hit sandbox write restrictions; successful reruns used ignored writable caches or filesystem escalation. |
| Links/assets/config | Documentation consolidation scan: 31 frontend, 29 backend, 1 coming-soon Markdown files; zero broken local files or heading anchors, zero retired report references and zero duplicate page titles. Both repositories' diff whitespace checks pass. No public asset or environment-example key lacks a reference. |

No complete critical browser E2E, hardware passkey, provider settlement, real WhatsApp delivery, cloud grant or restore was exercised. Synthetic component and disposable-database tests do not certify deployment readiness. See [frontend release gates](production-readiness-tracker.md) and [backend release gates](../../backend/docs/production-readiness-tracker.md).

## Remaining maintenance

The October source pass did not establish that every export or external endpoint
was unused. The 18 November pass also found no proven orphan application module.
Keep changes scoped to actual callers and contracts.

- Retain CRM role-upgrade/review tools and their permission tests. They implement
  explicit operator governance; source cleanup does not authorize changing that
  behavior. The earlier unsubmitted patch and permission question are historical,
  not a pending step in this cleanup.
- Retain required notification helpers, external API endpoints, operational
  scripts and frozen offline calculations. No bulk export deletion is justified
  by import counts.
- Remaining lint and unused-local candidates need individual review: omitted
  callbacks, deliberate password omission, model-registration imports, writes
  whose return values are unused and shared public props are not safe automatic
  deletions. No lint/type rule was weakened to hide these candidates.
- The two sensitive backend cycles and large domain controllers remain
  architectural maintenance described in the architecture audit. Refactoring
  them is outside nonfunctional repository cleanup.

Use [the verification workflow](verification-workflow.md) for each future batch.
CI retains full suites; no test or release gate was removed.

## Retained architectural decisions

Organization is the tenant; Location is a physical place; Clinic is a facility type. `DoctorAssignment.doctorId` references User. One `/api` contract remains; public providers resolve slugs. Uploads use canonical object-key/intent ownership. HTTP and private realtime require persisted sessions. Session-close cancellation makes no refund promise; tracker capabilities use fragments. Clinical/financial records remain authoritative.

`DATA_ENCRYPTION_KEY` configures the current `enc:v1` envelope. Stable derivation constants, audit fields, provider protocol versions, scoped retries and the retired offline-cache deletion name remain purposeful boundaries. Preserve persistent secrets when configuring environments. See [domain model](domain-model-audit.md), [design system](design-system.md), [backend API](../../backend/docs/api-contract.md) and [development lifecycle](../../backend/docs/development-data.md).

Historical operations: a separately authorized October 7 reset of the shared
development `test` database removed 1,954 of 1,956 records, preserving Root, its
password, encrypted MFA and one passkey. That prior operation does not authorize
data deletion during this cleanup. Current guarded commands remain in the
development lifecycle. Earlier sign-in, inactivity-overlay and loading work is
represented by current implementation/tests and [loading guidance](interaction-patterns.md#loading-and-read-recovery);
its old task totals are not current verification evidence.
