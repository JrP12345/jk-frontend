# Frontend refinement ledger

Started 2026-10-03. Checkboxes mean a page has been inspected, a decision recorded and its affected verification completed. A checked page may be intentionally kept. No inferred routes are listed as existing pages.

## Architecture inspected before page edits

- Next App Router, route groups `(auth)` and `(dashboard)`, server entry pages with client screens. Dynamic route parameters use promises in this installed version.
- Root providers own TanStack Query, theme, auth initialization, route progress, notifications and install prompts. Dashboard layout owns authentication, route/module access, clinic selection, impersonation return controls and role-based navigation.
- `authStore` is the signed identity context; `clinicStore` is the clinical selection; `moduleStore` controls module visibility. Organization management uses local explicit selection without changing authentication. `trackerStore` handles resumable public tracking.
- Axios uses credentials, same-origin rewrites where configured, one token-refresh promise and existing permission notifications. Backend authorization remains authoritative.
- Existing design system: semantic Tailwind v4 tokens, light/dark themes, Button/Input/Select/Table, Alert/EmptyState, skeletons, Modal/ConfirmDialog, toast and overlay focus/viewport hooks. No UI library or storage replacement is planned.
- Existing workflow helpers include latest-read cancellation, user-facing error presentation, clinic-local dates, booking status and navigation ordering. These are retained and reused where appropriate.

## Processing order and complete existing route inventory

### 1. Discovery, appointment entry and public follow-up

- [x] `/` — existing redirect entry
- [x] `/browse`
- [x] `/browse/[id]`
- [x] `/doctor/[id]` — clinic selection is a query parameter
- [x] `/join/[clinicId]`
- [x] `/track/[appointmentId]`
- [x] `/check-in`
- [x] `/queue-tv`
- [x] `/pricing`

### 2. Identity and account setup

- [x] `/login`
- [x] `/register`
- [x] `/verify-email`
- [x] `/reset-password`
- [x] `/onboarding`
- [x] `/accept-invite` — added: existing backend emails target this path

### 3. Daily care and patient journeys

- [x] `/dashboard` — Root, staff, doctor and patient variants inspected
- [x] `/dashboard/appointments`
- [x] `/dashboard/queue`
- [x] `/dashboard/patients`
- [x] `/dashboard/patients/[id]`
- [x] `/dashboard/patients/[id]/timeline`
- [x] `/dashboard/consultations`
- [x] `/dashboard/consultations/[id]`
- [x] `/dashboard/teleconsultation`
- [x] `/dashboard/patient-portal`
- [x] `/dashboard/bills` — checkout decision pending; list refinement verified

### 4. Diagnostics, medication and patient invoicing

- [x] `/dashboard/laboratory`
- [x] `/dashboard/radiology`
- [x] `/dashboard/pharmacy`
- [x] `/dashboard/billing`
- [x] `/dashboard/billing/services`
- [x] `/dashboard/insurance`

### 5. Organization, team and operations

- [x] `/dashboard/organizations` — detail/section selection uses query parameters
- [x] `/dashboard/clinics`
- [x] `/dashboard/staff`
- [x] `/dashboard/shifts`
- [x] `/dashboard/feedback`
- [x] `/dashboard/analytics`

### 6. Platform, communications and settings

- [x] `/dashboard/admin/users`
- [x] `/dashboard/admin/billing`
- [x] `/dashboard/admin/monitor`
- [x] `/dashboard/audit`
- [x] `/dashboard/notifications`
- [x] `/dashboard/settings`
- [x] `/dashboard/settings/billing`
- [x] `/dashboard/settings/modules`
- [x] `/dashboard/security`

Shared loading, dashboard error and app not-found boundaries are part of the final consistency pass. API endpoints, metadata/robots and route-group folders are not additional user pages.

## Page audits and verification

Updated in the implementation order. Functional contracts and business policies are preserved unless a traced, unambiguous defect is fixed.

### Discovery, entry and public follow-up

| Page | Decision / traced responsibility | Refinement and verification |
| --- | --- | --- |
| `/` | KEEP: cookie redirect; destination guards still apply | Source inspection; no extra landing step |
| `/browse` | SIMPLIFY: clinic comparison, filters, cursor navigation | Compact header/search/cards; semantic card headings. 13 browse/mobile tests passed. Browser 390/768/1440: no horizontal overflow. Server directory data was real read-only data, so fixture-name readiness check was false. |
| `/browse/[id]` | SIMPLIFY / SHARE: clinic information and booking | Reduced cover; native disclosures for description/facilities. 9 detail/booking tests passed; three fixture viewport checks. |
| `/doctor/[id]` | SIMPLIFY / SHARE: doctor and assignment-specific booking | Responsive portrait/card; same assignment context. 2 server profile tests passed. Server fixture profile was not browser-tested. |
| `/join/[clinicId]` | SIMPLIFY: public walk-in entry | Compact introduction, associated labels/autocomplete, gender state, accurate count label. Source/lint and three fixture viewport checks; no live walk-in. Kiosk tests are not join coverage. |
| `/track/[appointmentId]` | KEEP: private capability-based tracking | Larger sound/refresh targets, sound selection semantics. Source/lint and unavailable-link fixture at three widths; live payment/return actions not executed. |
| `/check-in` | SIMPLIFY: staff reception check-in | Task heading, tighter form, associated labels, visit separators. 2 staff selection/denial tests passed; denied page at three widths. |
| `/queue-tv` | KEEP: distance-readable calls | Read failure warning and reconnecting state, retained last data, no false empty/ready claims; voice targets/state. Recovery test passed; offline fixture at three widths. Audio hardware not tested. |
| `/pricing` | SIMPLIFY: configured plans | Actual trial/currency/limits/features, disclosure comparison, retry. Removed unsupported fixed trial/savings/compliance claims. User-approved sales email `ekavyuofficial@gmail.com` (no email sent). 2 focused tests passed; three viewport fixture checks. |

Public changed-file lint passed without errors; existing hook/image warnings remain. No backend contract or booking/payment rule changed. Browser review identified the shared PWA banner covering the pricing heading; review consumers before the final shared fix. Browser screenshots produced 21 public views with no horizontal overflow and no runtime exceptions; successful tracker transactions and the server doctor fixture were not browser-tested.

### Identity pages

| Page | Decision / trace | Refinement and verification |
| --- | --- | --- |
| `/login` | SIMPLIFY: patient OTP, staff password, passkey, MFA, recovery | Header space, quieter card, touch-sized tabs; 13 patient/staff/MFA tests passed; lint no errors. |
| `/register` | SIMPLIFY: patient-only OTP, demographic fields, cooldown, portal redirect | Header space, quieter card, Select label association. Source/lint; no live registration. |
| `/verify-email` | SIMPLIFY: token POST, missing/expired/success states | Primary heading, quiet card, accurate verification copy. Source/lint; no live verification token used. |
| `/reset-password` | SIMPLIFY: recovery token, password fields, success/sign-in | Quiet card and header space; source/lint. Server rejects weak passwords; older client omits its special-character check. |
| `/onboarding` | SIMPLIFY / INVESTIGATE: Root provisioning and MFA wizard linked from pricing | Natural page scrolling, no timed claims or raw plan IDs, numeric MFA label. Source/lint. Public handoff awaiting decision. Legacy draft/MFA behavior preserved. |
| `/accept-invite` (new) | Missing active flow: backend sends this route; patient registration differs | Existing `/auth/accept-invitation`; no client role/organization choice. Four tests passed: missing token, password policy, duplicate submission/server identity, expiry. Type check and production route build passed. Backend endpoint and existing server tests traced; no backend change. |

### Daily care pages

| Page | Decision | Trace / changes / checks |
| --- | --- | --- |
| `/dashboard` | SIMPLIFY | Inspected role-specific hierarchy/appointments/invoice reads, permission/module gating and dashboard children. Compact Root header, 44px actions, users management secondary. Styling only; source/diff and lint no errors. Trend dates currently use UTC string keys, a separate reporting concern left unchanged. |
| `/dashboard/appointments` | KEEP | Inspected server list/search/status/doctor/date/pagination, cancellable reads, list/calendar/mobile cards, permission gates and booking/detail/reschedule/print dialogs. Existing retries and local refresh preserve context. Slot locks, booking payloads and clinical record consumers retained. No code change; source verification. |
| `/dashboard/queue` | KEEP | Traced cancellable queue/status/override/triage/delay reads, selected clinic/doctor/date, websocket/polling, responsive patient cards, recovery, clinical draft protection and contextual dialogs. Session/park/return/ordering/STAT/consultation/medication/payment actions remain unchanged. Source verification; complex ~4,500-line clinical component is a maintenance concern, not confirmed dead code. |
| `/dashboard/patients` | SIMPLIFY | Server search/filter/page and duplicate registration traced. Clarified demographic counts as current-page counts; search/filter names and larger named action targets. Source/lint, no calculation or registration change. |
| `/dashboard/patients/[id]` | SIMPLIFY | Scoped profile/labs/invoices, record-access token expiry/redaction and edit rights traced. Read failure no longer means missing record; retry, primary heading/back target; no invented MRN. 2 tests passed including same scoped retry and late response after unmount; lint, package types passed with incremental disabled. |
| `/dashboard/patients/[id]/timeline` | SHARE | Direct page plus profile, queue and encounter consumers inspected. Return link; shared retry, category state/touch/search semantics; failed AI request now says explanation unavailable instead of claiming grounded results. 3 scope/recovery/explanation tests passed; lint and package types passed. Existing scope/cursor/record APIs retained. |
| `/dashboard/consultations` | SIMPLIFY | Clinic/date worklist, summary counts, checked-in filters, walk-in creation and encounter links traced. Accessible selected filters and labelled mobile search. Source/lint; no clinical creation change. |
| `/dashboard/consultations/[id]` | KEEP / accurate display | Appointment resolution, encounter POST, provider/order event refresh, draft protection, SOAP/orders/billing consumers inspected. Primary heading; only recorded MRN displayed. 2 tests passed with appointment-derived context and recorded/unknown MRNs; lint. |
| `/dashboard/teleconsultation` | SIMPLIFY / INVESTIGATE | Session/notes/prescription/media handling traced. List read retry, filter selection, removed unsupported encrypted peer-stream claim and unused `remoteVideoRef`. Recovery test passed; lint. No `RTCPeerConnection`/remote media/signaling implementation exists; actual video transport remains P1, not solved by visual changes. |
| `/dashboard/patient-portal` | SIMPLIFY | Own-profile/family/claims/records/refills/timeline/self-booking traced. No O+ default for unknown blood group; hidden family blood-group default removed; accessible section state. 3 tests passed for recorded/unknown profile data and family payload; lint. Valid recorded values/ownership preserved. |
| `/dashboard/bills` | SIMPLIFY / INVESTIGATE | Invoice reads, balances/currency, receipts and payment actions traced. Read error/retry added; focused test and lint passed. Existing checkout QR/SDK are placeholders and PUT `/invoices/:id/pay` requires staff `MANAGE_BILLING`; asked for verified appointment-checkout vs reception decision. No live payment attempted. |

## Cross-page findings

| Finding | Classification | Resolution |
| --- | --- | --- |
| Staff/locations/details/settings already delegate to organization components | SHARED, active | Inspect both route and hub consumers; retain reuse |
| Patient bills and practice billing serve different actors and permissions | KEEP separate | Review each flow individually |
| Clinic detail and doctor-specific booking share a booking client | SHARE, active | Retain assignment/clinic context and backend booking rules |
| Direct invitation links were sent to a missing route | ACTIVE flow repaired | Added `/accept-invite` using the existing endpoint and server-returned identity |
| MRNs and unknown blood groups were invented in account/clinical screens | Confirmed incorrect defaults | Display recorded MRNs only; omit unknown blood group instead of writing O+ |
| Patient invoice checkout uses a staff-only API and placeholder SDK/QR | INVESTIGATE | Product decision pending; existing verified appointment payments are separate from general invoice collection |
| Teleconsultation local media preview claims a native peer connection | Incomplete active feature | Removed unsupported claim and unused remote ref; external/native video transport still requires product/implementation work |

### Diagnostics, medication and invoicing

| Page | Decision | Trace / changes / verification |
| --- | --- | --- |
| `/dashboard/laboratory` | SIMPLIFY | Tests/orders/samples/results/catalog/attachments traced. Accurate uploaded-result description; 44px selected worklist/catalog tabs. No laboratory workflow changes; lint no errors. |
| `/dashboard/radiology` | SIMPLIFY | Scoped studies/patient reads, ordering/reporting and DICOM dialog traced. Named search, selected modality/status targets. Lint no errors; no imaging mutation change. |
| `/dashboard/pharmacy` | SIMPLIFY | Inventory/batches/prescriptions, alerts and dispensing/invoicing traced. Selected 44px tabs and labelled prescription search. Lint no errors; quantities and stock rules preserved. |
| `/dashboard/billing` | SIMPLIFY | Invoice builder, manual collection, partial payments, till closure and OPD checkout traced. Collection charts disclosed; plain chart/checkout copy. Lint no errors; financial calculations and writes unchanged. |
| `/dashboard/billing/services` | SIMPLIFY | Backend catalogue writes require MANAGE_BILLING. Add/defaults/desktop/mobile edit actions now match that permission. Four continuity/permission/retry tests passed; lint and package TypeScript passed. Rates/tax/CRUD contracts preserved. |
| `/dashboard/insurance` | SIMPLIFY | Pre-auth/claims reads, limits, status writes and adjudication forms traced. Accessible selected tabs/filters and named search. Failed claim/invoice reads now show a retry state; obsolete clinic reads are discarded. Three focused recovery tests passed. INR aggregation remains a separate concern. |

### Organization and operations

| Page | Decision | Trace / verification |
| --- | --- | --- |
| `/dashboard/organizations` | KEEP / SHARE | Suspense query-context wrapper and hub inspected, including scoped sections, existing creation trial/branding, details, members, locations, billing/configuration, impersonation and destructive confirmation. Existing compact responsive hub and lg creation dialog retained. No code change. |
| `/dashboard/clinics` | KEEP / SHARE | LocationManagement and organization-scoped hook inspected: active/archive recovery, public-detail reads, branding, hours, management permissions, QR/poster and website links. Existing responsive table/cards and xl edit form retained. |
| `/dashboard/staff` | KEEP / SHARE | TeamManagement scoped staff/roles, doctor assignments, absence overrides, permissions, partial assignment recovery and contextual xl/2xl forms inspected. Clinical selector remains distinct from management scope. No code change. |
| `/dashboard/shifts` | SIMPLIFY | Roster/filter/status/handover reads and writes inspected. Named filters and no invented initial staffing ratio. Lint no errors; schedule/attendance payloads unchanged. |
| `/dashboard/feedback` | SIMPLIFY | Stats/list/completed-visit selection and survey submission traced. Removed unsupported trust/compliance/target claims; named controls and lg grouped survey form. Lint no errors; score calculations and payloads unchanged. |
| `/dashboard/analytics` | SIMPLIFY | Executive, quality and NABH service reads, permission gate, clinic comparison and nullable indicators traced. Explicit failure/retry, denied state, factual reported-indicators badge. Two recovery/denial tests passed; lint no errors. Currency aggregation policy preserved and recorded as a concern. |

### Platform and settings

| Page | Decision | Trace / verification |
| --- | --- | --- |
| `/dashboard/admin/users` | KEEP | Root-only global identities, debounce/role/page reads, status write, membership links and login-as organization confirmation inspected. Compact existing list/permissions preserved; source inspection. |
| `/dashboard/admin/billing` | SIMPLIFY | Plans/subscriptions/payment reviews, trial extensions/manual grants, gateway configuration and xl plan form inspected. Named subscription search and selected 44px tabs. Lint no errors; commercial and gateway writes unchanged. |
| `/dashboard/admin/monitor` | SIMPLIFY | Root session/traffic reads, filters, termination and bulk confirmations inspected. Header wraps at narrow widths; selected tabs/date targets and named session search. Lint no errors; security actions unchanged. |
| `/dashboard/audit` | SIMPLIFY | Scoped event queries, category/date filters, permission checks and detail redaction inspected. Date label association and disclosure state. Grouped staff response now uses recorded doctor user identities, obsolete scope responses are discarded, and failed audit reads offer retry. Three continuity/permission tests passed. |
| `/dashboard/notifications` | SIMPLIFY | Query/service/hook, unread/pin/delete/bulk, details, paginated mobile cards, scoped send form and recipient channels inspected. Named search; lint no errors. No messages sent. |
| `/dashboard/settings` | SIMPLIFY / SHARE | Shared organization, notification/SMTP/WhatsApp, Root AI/modules and subscription panels inspected. Short tab labels and selected 44px targets. Lint no errors; selected management context preserved. Correction on follow-up inspection: initial `?tab=billing` and `?organizationId=` are already consumed by the existing page. No routing rewrite needed. |
| `/dashboard/settings/billing` | KEEP / SHARE | Direct/embedded consumers, selected org, pending checkout, order idempotency, server verification, abandon/resume, invoices and downgrade resolution inspected. Contextual lg dialogs and verified SaaS checkout retained. No code change. |
| `/dashboard/settings/modules` | KEEP / SHARE | Wrapper and OrganizationModules scoped read/retry, Root-only writes, always-on policy and signed-org cache consumers inspected. No code change. |
| `/dashboard/security` | SIMPLIFY | Passkeys/WebAuthn, impersonation restriction, owner session policies and limits inspected. Persistent read recovery prevents false empty passkeys. Two retry/impersonation tests and lint passed; writes unchanged. |

## Final cross-application pass

- All 47 actual user routes processed (46 existing plus the repaired invitation route). KEEP decisions reflect inspected active implementations, not assumed redundancy.
- Reviewed shared tokens, headers, responsive tables/cards, Input/Select labels, LoadingState and route skeletons, global/dashboard error boundaries, app not-found, navigation and notification placement.
- Existing Modal sizes remain contextual: short confirmation sm/md, creation lg, grouped clinical/location forms xl, assignment workspaces 2xl. Existing viewport sizing, one scrolling body, pinned footer, focus trapping and busy dismissal guards retained. Feedback grouped survey uses lg with pinned actions; completed-visit/rating submission test passed. No blanket resize.
- Browser-confirmed PWA overlap repaired: installation offer is now in normal flow after page content, retaining install/dismiss behavior, management suppression and priority for notifications. Toast positioning remains unchanged.
- Dashboard error boundary now uses the existing userFacingError helper and a primary heading. Technical exception recovery test passed.
- Confirmed dead remote video ref removed; unsupported fixed pricing, compliance, accreditation, peer connection, survey trust and invented clinical-identity claims removed. No route or package deleted without proof; existing shared organization and booking consumers retained.
- Shared checks: floating installation/toast tests and component tests passed; mobile controls passed after correcting an existing stale Tenants assertion to the already-implemented Organizations label. Package TypeScript and production Next build passed, including `/accept-invite`. Initial Card id typing issue was fixed without changing the Card contract.
- User decisions resolved in the continuation: public plans lead to a setup request and Root provisions the organization; patient checkout uses the existing hosted appointment payment flow where supported, with reception handling other invoices; providers chosen as self-hosted Jitsi and Orthanc. Sales destination is `ekavyuofficial@gmail.com`. No live email, clinical, payment or account mutation performed.
- Follow-up implementation and remaining deployment/architecture concerns are recorded below. Earlier placeholders in public setup, patient payments, meeting links and image transport have been replaced; provider hosting/acquisition and cross-currency reporting still require work before production activation.

## Verification record

Focused checks are recorded by domain. Browser fixtures, source inspection, automated tests and live data checks are reported separately. Reviewing a page is not a claim that every production mutation was exercised.

Final browser run: 36 fixture views across 390px and 1440px, all ready with no horizontal overflow or runtime exceptions. Six expanded organization/survey dialog views at 390×450, 768×1024 and 1440×1000 fit the viewport; all action footers visible, with exactly one scrolling body when content overflowed. The first short-survey check exposed scrolling actions; the pinned-footer correction was verified in the final run. Earlier public run covered 21 views across 390/768/1440, with server-readiness and doctor/tracker limitations documented above. Screenshots/logs are local ignored artifacts under `node_modules/.cache/refinement-*`.

Changed-file lint passed with existing warnings, focused tests passed after recorded fixes, `git diff --check` passed, `npx tsc --noEmit --incremental false` passed and `npm run build` passed. No full-suite, live payment, live email, real OTP, hardware passkey/audio, or complete remote-video verification is claimed. No backend code changed in this pass.

## Continuation: approved setup, payment and provider decisions

### Pages processed

The complete 47-route checklist above remains the inventory. The continuation revisited `/pricing`, `/onboarding`, `/dashboard/bills`, `/dashboard/audit`, `/dashboard/insurance`, `/dashboard/teleconsultation` and `/dashboard/radiology`, plus their shared proxy/table/viewer consumers.

### Major UX improvements

- Public plan buttons use the configured plan slug and say **Request setup**. Anonymous/non-Root visitors get a concise request form that prepares a draft to the approved sales address, explicitly stating that nothing has been sent. Root provisioning and legacy authenticated activation remain separate. Browser inspection caught and repaired the old proxy redirect that prevented reaching this public request.
- Patient invoices use real hosted Razorpay order creation and server verification. No raw card details, fake QR or staff-only manual collection API remain. Online payment is offered only for wholly unpaid INR appointment invoices; partial payments, other currencies and unlinked invoices go to reception. Server amounts are checked, duplicate callbacks/orders are guarded, unverified outcomes retain a confirmation retry, and delayed checkout cannot open after leaving the page.
- Audit doctor filters use the backend's grouped staff response and doctor **user** identities. Audit and insurance failures have retry states and obsolete reads cannot overwrite the selected scope.
- Video uses the configured provider's actual room URL in a separate tab, alongside the clinical workspace. Copy feedback waits for the clipboard result. Local preview-only mic/camera/screen-share controls and the unconsumed relative patient link were removed. Session notes, vitals, prescription notes and completion remain intact; failed session reads only provision on an actual 404.
- Imaging now retrieves an authorized study manifest and real rendered PNG frames through the backend. The responsive viewer supports instances/frames, retry, display zoom/rotation/inversion, report viewing and an optional validated external PACS link. Fake window presets were removed; the interface distinguishes a rendered preview from diagnostic interpretation.

### Shared patterns established

Reuse existing latest-read cancellation, contextual Modal sizes, Alert recovery, hosted checkout and server authorization. Shared table search now reads React element children and handles circular data without walking React owner/fiber graphs. A populated radiology browser check exposed that defect; the repair preserves nested record search.

### Redundancy removed

Removed duplicate placeholder payment choices and local-only video controls once the real provider owns those controls. Removed cosmetic imaging presets that did not change an image.

### Dead/stale code removed

Removed the unused local video stream/ref/timer/control code after replacing its panel, and removed payment-token/QR placeholder paths. No routes, dependencies or independent clinical workflows were deleted.

### Things intentionally kept separate

Root organization provisioning vs public requests; appointment payments vs manual/reception collection; Jitsi media controls vs clinical documentation; image previews vs the diagnostic PACS workstation. Existing business calculations and permission policies remain authoritative.

### Architecture concerns discovered

- Existing clinical financial aggregations sometimes combine amounts without exposing currency. Label changes cannot correct those totals; an API contract that groups by currency is needed before non-INR/multi-currency reporting is reliable.
- The current imaging order generates its own StudyInstanceUID and does not ingest scanner files or send a modality worklist. Acquisition must preserve/match that UID for the preview adapter to find the real study.
- Stored legacy relative meeting links are not migrated automatically. New sessions use UUID room names and the configured host. External meeting closure/attendance is not inferred from workspace completion.

### Product decisions still needed

Provider choice and public/payment destinations are resolved. Operational activation requires private Jitsi/Orthanc hosts and credentials, the clinic guest-admission policy, and an acquisition bridge. The implementation/setup instructions are in [clinical-provider-setup.md](../../backend/docs/clinical-provider-setup.md). No default public provider receives clinical data.

### Performance/accessibility improvements

Named instance/frame controls, factual loading/failure states, stale read rejection and object URL cleanup. PACS reads have server-side timeout/size/instance limits and private no-store responses. Shared table search no longer recurses into React internals. No new SDK/dependency or browser PACS credential is introduced.

### Verification

- Focused frontend tests cover request preparation/auth routing, payment proof/duplicates/retry/unsupported invoices/SDK failures/unmount, audit and insurance continuity, meeting URLs/clipboard/denied reads, image rendering/retry/stale responses/cleanup, table rendered-cell search and CSP regressions. Relevant component/read consumers also passed. Changed-file lint reports warnings but no errors.
- Frontend package TypeScript and production builds passed after the routing repair; the final build includes the shared table and checkout lifecycle changes. Payment boundary checks passed. Test sources are exercised by Vitest and are excluded from the app TypeScript configuration.
- Backend focused tests exercise real disposable-Mongo imaging authorization and session persistence, plus mocked QIDO/WADO transport, malformed metadata/image responses, identifier/frame membership, response limits and cross-organization denial. Payment contract cases also confirm cross-tenant order denial and non-INR checkout rejection (two selected cases passed, eight unrelated cases skipped). Backend TypeScript passed. The standard bundle build could not overwrite existing `dist/workers` files due to Windows access denial; the same six API/worker entries compiled and were checked as nonempty in memory, without rewriting those files.
- Six browser fixture views at 390px and 1440px passed with no horizontal overflow or runtime exceptions. Patient payment and imaging dialogs fit the viewport; the imaging preview uses an authenticated PNG fixture. A separate 390x450 imaging check confirms one scrolling body and viewport containment. Fixtures blocked non-GET writes. Screenshots/logs are local ignored artifacts under `node_modules/.cache/remaining-*`.
- No live charge, email, organization creation, patient study upload, remote two-person call or provider deployment was performed. Live service availability and acquisition are not claimed by mocked transport tests.

### Remaining P0/P1 issues

P1: configure and validate the private video/PACS services and study acquisition bridge; repair currency-aware clinical aggregation before offering multi-currency reporting. Some untouched legacy read catches still warrant targeted recovery work. No production release gate or full-suite result is implied by this scoped continuation.

## Targeted refinement: organizations, global users and settings ownership

### Pages and visual changes

- `/dashboard/organizations`: themed directory cards with logo/initials, administrator, subscription and active/suspended state; search/status filters; existing Root creation with trial and branding. Selected workspaces have a branded header, shared accessible Tabs, factual overview cards, and Card surfaces around branding and membership forms.
- `/dashboard/admin/users`: shared Table, Avatar, Badge, filters, server pagination and summary cards. Counts distinguish matching identities from active/inactive identities on the current page. The organization selector reads and updates `?organizationId=`, sends that ID to the existing global-user API and links back to the selected organization's Members section.
- `/dashboard/settings`: Root's platform controls and personal notification preferences. Organization administration links to the organization workspace; duplicate branding, membership, delivery, module and AI editors were removed from Settings. Organization subscription access remains available to permitted staff through the existing billing component.

### Control ownership

| Control | Owner and location |
| --- | --- |
| Shared platform WhatsApp credentials and gateway enablement | Root, `/dashboard/settings?tab=messaging`; explicit platform scope |
| Organization WhatsApp mode, dedicated sender, credits and delivery preferences | Selected organization, its Configuration section; existing server permissions apply |
| Organization SMTP, optional modules and AI configuration | Root, within the explicitly selected organization workspace |
| Branding, members, access and locations | Organization workspace; existing role/permission checks apply |
| Global account status and support login sessions | Root, global Users; status changes are explicitly identified as affecting every organization |
| Personal alert preferences | Signed-in user, Settings; query cache uses the user identity |

The selected organization remains explicit in URL navigation and API requests. An unavailable organization does not silently select the first organization or broaden a filtered identity read. Ordinary administrators use their signed-in organization and cannot override it through the URL. Root can open the organization's filtered identities directly from the workspace and return to membership management.

Organization workspace changes remount drafts and embedded controls. Root confirmations capture their target organization when opened, so later navigation cannot retarget a suspension or deletion. Permanent deletion still requires its exact name. Obsolete identity reads are cancelled/ignored. Failed preference, WhatsApp configuration or connection reads expose recovery and prevent defaults from being submitted; no fallback 500-credit balance is fabricated.

### Reuse and verification

Reused the repository's Card, StatCard, Avatar, Badge, Button, Input, Select, Tabs, Table, Pagination, Modal, Alert, toast, permission helpers, latest-read utility and organization service. No dependency or second UI system was added. Backend contracts and existing Root/organization authorization were inspected; this targeted pass changes frontend code only.

- **Level 4:** organization scope, platform credentials and identity status. The focused creation/branding, organization scope, messaging ownership and adjacent SaaS checkout files passed: **31 distinct tests**. Tests include unavailable/forged organization IDs, stale reads, selected impersonation context, global status confirmation, draft reset, captured action targets, exact-name deletion, legacy settings redirects and settings-read failures. Tests do not use real accounts or messaging credentials.
- Changed-file ESLint finished with **zero errors** and React hook warnings; `git diff --check` passed. Production build, including its package TypeScript check, passed after correcting a duplicate helper export. The only subsequent app edit adds existing Card wrappers to Details and Members; its affected tests, lint and browser views passed. Test files are excluded from app TypeScript coverage.
- **30 valid browser fixture views**: Root directory, overview, Configuration, scoped Users and platform messaging at 390/1440 pixels in light/dark mode; directory and Users at 768 pixels; creation dialogs at 390/1440; organization-admin workspace/Settings with a forged URL organization ID; Details/Members at 390/1440. All had no document horizontal overflow or runtime exceptions. Creation dialogs stayed inside the viewport with visible action footers. The first two admin fixture views were invalid because the fixture omitted enabled tenant modules; the fixture was corrected and those views were rechecked successfully.
- Browser fixtures blocked all non-GET writes. No live account suspension/deletion, invitation, organization creation, charge, email, WhatsApp test or template synchronization was performed. Local screenshots and logs are ignored artifacts under `node_modules/.cache/organization-polish-*`. Full release/CI gates were not run for this scoped change.
