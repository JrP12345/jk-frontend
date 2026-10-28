# Ekavyu pre-production cleanup

Working plan: 24 October 2026. Scope: frontend, sibling backend and static coming-soon site. Preserve pre-existing frontend work. No database, index application, provider send, secret rotation or deployment is authorized by this source cleanup. Baseline logs and analysis are ignored under `.next/cleanup-baseline`.

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

## Outstanding work and exact continuation

24 October follow-up: the refreshed import/entry scan covered 567 frontend and
800 backend JS/TS files and found no orphan application modules (363 and 564
reachable modules respectively). This is module-level evidence, not proof that
every export or endpoint is used. The performance checkpoint reports remain
referenced by their active generator. Automatic approval review rejected a
broad generator rewrite as exceeding demonstrable stale-file cleanup; no part
of that rewrite or report deletion was applied. The independent branding-upload
false-positive fix is recorded in [organization management](organization-management.md#branding-persistence),
with scoped integration tests, types and build evidence. No new Markdown report
was added, and no production data or clinical/financial authority was changed.

1. **Explicit approval pending:** automatic review rejected removing the completed CRM role-upgrade service, CLI and upgrade-only tests because it changes permission governance. All proposed permission edits were restored. Exact patch: `.next/cleanup-baseline/role-upgrade-removal.patch`; the async approval request is pending. If approved, apply it, retain current role-seeding and explicit-denial tests, update `crm-migration-pilot.md`, and run focused role/permission/cache tests plus backend types. Otherwise retain the tooling with its reason.
2. **Exports/services:** automatic review rejected heuristic bulk export removal and deletion of old notification helpers before application. No bulk edits were applied; the one-off bulk helper and its dry-run artifacts were removed. Continue with manual caller/registration/contract evidence and narrowly reviewable batches. Module reachability does not establish that every exported function or endpoint has callers.
3. **Remaining source pass:** unused-local findings, duplicate implementations, individual exports/endpoints and active runtime cycles need further review. Documentation consolidation is complete for this batch: current guides retain professional/provider/device/release prerequisites and optional diagnostic contracts; superseded implementation prompts, task timelines and hypothetical historical migration requirements were removed. Preserve current pharmacy aggregate/batch workflows, commercial entitlement mappings, CRM follow-up review actions and external APIs unless intended contracts are changed with all consumers. Finish critical clinical/financial/auth/browser checks for any later changes before claiming full completion.
4. Repeat affected reference/orphan checks per batch using [verification-workflow.md](verification-workflow.md). Do not repeat the 98-minute backend suite for unrelated docs or local UI edits.

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
