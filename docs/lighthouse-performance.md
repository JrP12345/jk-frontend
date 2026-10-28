# Performance and request reliability

Dated measurements and current request-path behavior. Retain the measurement scope, fixture boundaries and unresolved deployed checks. Historical local metrics are not a current hosting or capacity approval.

- [Production-build page measurements](#production-build-page-measurements)
- [Request lifecycle and database measurements](#request-lifecycle-and-database-measurements)
- [Authentication transport and outage recovery](#authentication-transport-and-outage-recovery)
- [Public branding CSP and error recovery](#public-branding-csp-and-error-recovery)
- [Synthetic workload scale and next gate](#synthetic-workload-scale-and-next-gate)

## Production-build page measurements

Website-wide continuation: [route progress](performance/lighthouse-progress.md),
[remaining-page implementation and measurements](performance/lighthouse-remaining-2026-10-23.md)
and the [earlier checkpoint](performance/lighthouse-2026-10-23.md). These separate
initial-view audit coverage from outstanding performance targets and workflow variants.

### Directory cards and identity correction: 24 October 2026

The current compact directory (25 October) follows the user's latest reference, documented in [Browse content decisions and evidence](interaction-patterns.md#browse-research-and-content-decisions-24-october-2026). The reception hero centers its copy, followed by keyword/city search with an explicit Search action. The same search form sticks below the navbar using CSS, without scroll listeners, duplicate inputs or new requests. An IntersectionObserver narrows the pinned form without changing its height and respects reduced-motion settings. The result count and one-line location label reserve fixed space, so delayed detection or refresh announcements do not move the toolbar or cards. Result count, real specialty chips, sort and filters occupy one compact desktop row; phones use a single toolbar row with specialty choices in Filters. Cards show only a contained 88px logo beside the name, native phone action and supported specialties, with address and paired Directions / booking-profile actions below, and an opening-status chip at the top right. Saved banners and gallery images remain on detail pages. Opening badges require saved hours and respect the supplied facility timezone; ratings require a real score and positive review count. Email, doctors and detailed evaluation stay on facility pages. Missing hours are explicitly unavailable; missing or malformed phone values never create a call link. Missing logos use a neutral building fallback; no gallery fetch or generated facility imagery is introduced.

The grid uses one column below 640px, two from 640px, three from 1024px and four from 1280px in a 1600px container. A single result occupies one cell. Covers lazy-load into stable 128px desktop / 140px phone media regions; the header's decorative generated reception has 131KB and 41KB responsive WebP variants. All card links and controls retain at least 44px targets. The sole visible result preloads its route in production; others preload on pointer, keyboard-focus or touch intent. Discovery-state restoration and cold-click route progress remain. Book appointment opens the existing facility/doctor selection flow only for explicitly enabled online booking; authoritative slot checks are unchanged. Heart/save controls, browser persistence and saved filtering have been removed. No database records changed.

Directory and facility views now reuse one 1600px frame, responsive gutters, surface background and navbar identity. The clinic loading/error states follow the same header and width; skeleton column ratios now share the loaded layout's breakpoints. Guest-account and theme placeholders reserve their loaded widths, avoiding the earlier header movement during hydration. Narrow card footers use CSS container queries rather than resize listeners. Paired browser measurements verify brand, theme/authentication and content-edge continuity through facility navigation and Back restoration; this is not a claim that different page content has identical height. The clinic now combines its banner/identity and contact information inside the right panel; the left contains the doctor list. On phones the information panel comes first. Logos are 72px desktop / 64px phone. Native expandable sections preserve weekly hours and facilities/photos without tabs. Removing the unsaved-map placeholder avoids an empty panel and duplicate directions action; a configured embed still loads lazily. Search, booking, gallery and contact behavior remain in the existing domain components. See [connected-page verification](interaction-patterns.md#facility-detail-presentation-25-october-2026).

No new production latency claim is made. The historical samples below measured earlier presentations and retain their original fixture/preloading boundaries.

An isolated production preview passed eight desktop/mobile appearance checks in both themes and retained clinic/doctor HTTP 404s. One preloaded clinic navigation displayed its heading in 219 ms with a fixed 1,500 ms synthetic backend delay. This measures navigation after preloading, not a faster backend or a cold-load guarantee. Before editing, the running local development clinic endpoint took 1,916 ms and full cold/warm document reads took 3,219/2,334 ms; development compilation and API response time remain distinct from production preloading. Focused login, directory and booking-link tests passed all 70 cases; the production build passed; scoped ESLint had zero errors and three existing hook warnings.

### Public reads and navigation follow-up: 23 October 2026

Implemented the approved public-read and doctor-rendering changes in the frontend
and sibling backend. Nothing was deployed, no dependencies or hosting settings
changed, and no patient data or live availability cache was introduced.

#### Retained changes

- Backend `controllers/public.ts`: reuse the existing `publicSlugs` batch helper;
  overlap independent directory/profile enrichment reads; fetch current clinic
  queue counts and current/upcoming overrides in batches. Keep active provider,
  organization/location visibility, subscription entitlement, selected assignment,
  scheduling, cutoff and timezone checks. The scheduling service still performs
  its own fresh override read. No schema/index or public response field changed.
- Frontend `src/app/doctor/[slug]/page.tsx`: start profile and selected-clinic reads
  together, render the profile after its own read, and await booking data inside
  an async child of the existing `Suspense`. Give that one booking read the same
  bounded five-second timeout as public profiles, instead of routinely discarding
  it at three seconds and fetching again in the browser. Preserve client recovery
  on a genuine failure. Use a compact contact fallback when booking is unavailable.
- `BrowseClient.tsx` and `BrowseDetailClient.tsx`: use existing `NavigationPending`
  inside the clinic title/action and doctor-profile links. No navigation target,
  card click handler, prefetch policy or booking handler changed.

New clinic/doctor `loading.tsx` files were tested and **removed**. Production
verification showed a missing profile returning HTTP 200, and the clinic fallback
still waited for metadata. The final build retains `htmlLimitedBots: /.*/` and
correct 404/500 responses. Link-pending feedback supplements the actual data-flow
changes; it does not make the backend faster.

#### Comparable production-build measurements

These are a **separate dataset** from the 22 October results below. Chrome
155.0.8059.86, Lighthouse 13.5.0, Next 16.4.2, Node 24.7.0, Windows. Three fresh
browser contexts per route, mobile simulation (150 ms RTT, about 1.6 Mbps, CPU 4x),
per-metric medians. Both builds use identical synthetic clinics with online
booking disabled: clinic-detail responses take a fixed **3,500 ms**; other API
responses take 40 ms. This deliberately reproduces the old three-second timeout
without connecting to Render, Atlas, accounts or patient records. It does **not**
measure the backend query optimizations' network latency benefit.

| Route | Performance before → final | FCP ms | LCP ms | TBT ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/browse` | 93 → 97 | 922 → 918 | 2,328 → 2,351 | 147 → 136 | 0.0001 → 0.0001 |
| `/browse/audit-clinic` | 76 → 84 | 926 → 918 | 3,685 → 2,917 | 336 → 132 | 0 → 0 |
| `/doctor/audit-doctor?location=audit-clinic` | 68 → 93 | 912 → 912 | 4,209 → 2,904 | 454 → 208 | 0.0695 → 0.0001 |

Accessibility, best practices and SEO are 100 for all three local representatives
before/final. Synthetic-origin SEO is not the live development site's indexing
policy. Performance ranges remain wide: clinic 68–86 before / 74–89 final;
doctor 64–69 / 91–94. An intermediate candidate with the removed route boundaries
had a 14,907 ms clinic TBT outlier; it is retained in temporary evidence but is not
the final implementation. Do not interpret the clinic/Browse score differences
as proven API latency gains. Clinic trace-observed FCP is essentially unchanged
(3,908 → 3,915 ms) under the fixed backend delay.

Doctor trace-observed FCP changes from 3,326 to 217 ms. The old late contact panel
was LCP at 7,048 ms; the final profile becomes useful earlier, while contact data
still waits for its fresh request. No JavaScript size improvement is claimed:
doctor script transfer is 283,155 → 283,191 bytes; directory 251,377 → 251,387.
Clinic script transfer included an additional prefetched chunk in some runs
(before 268,787–283,155 bytes; final 283,191).

Separate unthrottled browser checks use mobile 390×844/DPR 2 and desktop
1440×1000/DPR 1; they are single observations, not Lighthouse medians:

| Transition | Mobile before → final | Desktop before → final |
| --- | ---: | ---: |
| Click → useful clinic details | 3,855 → 3,994 ms | 3,680 → 3,676 ms |
| Clinic click → useful doctor profile | 3,158 → 125 ms | 3,141 → 114 ms |
| Clinic click → doctor contact details | 6,709 → 3,571 ms | 6,680 → 3,543 ms |

Clinic link feedback appears at 164/165 ms on mobile/desktop. The doctor transition
finishes before the existing 150 ms progress threshold, so no progress bar is
necessary. The old selected-clinic SSR attempt plus browser retry becomes one
primary SSR detail read, with zero browser clinic-detail retries in the final
comparison. Other framework prefetch/RSC requests remain; these are not per-user
production request budgets. Both final views have one main landmark. Refresh and
back navigation pass; missing profiles return 404 and upstream failures 500 on
both public route families. The final smoke records zero CSP violations and no
failed responses. The directory collector recorded a 503 in both Lighthouse stages,
outside the saved network audit; its origin was not isolated and the final smoke
did not reproduce it. This is not a passing live-service check.

#### Backend read measurements and verification

The existing isolated Mongo integration fixture measures steady-state operations:

| Public read | Operations before → final | Explanation |
| --- | ---: | --- |
| Sorted directory | 20 → 13 | Eight individual slug reads become one batch read. |
| Clinic details with two doctors | 22 → 16 | Batch links, waiting counts and today's/upcoming leaves; retain schedule reads. |
| Doctor profile | 11 → 11 | Same checks/read count; independent stages now overlap. |

`tests/publicLocationCatalog.test.ts` checks repeat response equality, stable links,
bounded slug enrichment and no writes on warmed reads. A fresh-read case changes
queue statuses and leave records between requests, checks doctor/location scoping
and confirms patient identifiers and another location's override reason are absent.
Cold slug creation remains covered by existing discovery tests.

Highest risk: Level 4. Fifty backend cases passed across `publicLocationCatalog`,
`publicDiscovery`, `publicOrganizationDto`, `browseBookingSecurityPolish` and
`doctorAvailabilityAndSmartBooking`, followed by backend `check:fast`. Forty-four
distinct frontend cases passed across `publicCanonicalLinks`, `publicProfileError`,
`browseDoctorDetail`, `publicDiscovery` and `browseAndMobilePolish`; affected Browse
cases were repeated after adding pending feedback. New server-component tests
verify that the page resolves while booking data is pending, successful/failed/
wrong-location responses, and one default-practice booking read. Changed-file
ESLint passed with seven existing Browse hook warnings. The final isolated Next
production build passed compilation, application types and route generation;
application TypeScript does not cover test files. No full suite/release gate ran.

Before/final raw reports are under the OS temporary directory
`C:/Users/Jay/AppData/Local/Temp/ekavyu-lighthouse-audit-20261022/focused-{before,final}`;
browser comparisons are in `runtime-{before,final}`. Build IDs, samples, ranges and
operation counts are appended under `followUps.2026-10-23` in
`lighthouse-results.json`. Temporary scripts/tooling are not repository dependencies.
The synthetic `.next/focused-performance` build must never be deployed.

Live Render cold starts, production database execution/pool timings, deployment
regions and post-deployment improvements remain unmeasured. The prior live warm
audit is a different dataset and is not an after result. No auth, API-client,
geolocation, payment, booking-write or infrastructure change was made. Production
benefits require deploying **both repositories**, with separate deployment approval.

### Earlier measurement set: 22 October 2026

Reviewed 2026-10-22. Local production build, Next 16.4.2, React 19.3.1,
Chrome 155.0.8059.85, Lighthouse 13.5.0, Node 24.7.0 on Windows.
Measurements use synthetic clinics, a synthetic doctor/session and a loopback
backend with a fixed 40 ms delay. No Render, Atlas, production account or patient
record was used. Nothing was pushed or deployed.

### Scope and changes

| Priority | Files | Change |
| --- | --- | --- |
| Brand asset | `src/components/ui/EkavyuLogo.tsx`, `scripts/generate-brand-assets.mjs`, `public/brand/ekavyu-mark.svg` | Earlier measurements used responsive WebPs instead of a 201,737-byte UI PNG. Following the 24 October vector correction, the website uses one cached transparent SVG, approximately 63 KB uncompressed / 15 KB gzip. `npm run brand:assets` generates the public vector, favicons and install exports. Earlier Lighthouse measurements predate this vector/theme update. |
| Preserve PWA behavior | `public/sw.js`, `src/tests/serviceWorkerPrivacy.test.ts` | Allow the three public logo variants in the offline asset cache and advance its version to v11. API/private paths and arbitrary WebP images remain excluded; logout clears current and retired product caches. |
| Must fix | `src/components/ui/LoadingImage.tsx` | Loading text transparency uses a stylesheet class instead of a CSP-blocked inline style. Native dimensions, loading/error behavior and caller image/viewer styles remain. |
| Must fix | `src/components/ui/Skeleton.tsx`, `skeletonSizes.ts`, `src/app/globals.css` | Existing finite design sizes use static stylesheet selectors. Selector specificity preserves explicit dimensions over ordinary/responsive utilities. Custom dimensions and caller style overrides keep their existing API. |
| Must fix | `src/components/ui/Spinner.tsx`, `src/app/globals.css` | Dot sizes and staggered animation delays move into the existing global CSS, avoiding another blocking stylesheet. Ring, dots, bars, sizes and accessible status behavior remain. |
| Measured network improvement | `src/app/browse/BrowseClient.tsx` | Disable speculative prefetch only for secondary doctor links inside directory cards. Primary location navigation retains normal prefetch; doctor links still navigate on activation. |
| Small rendering improvement | `src/app/browse/[slug]/BrowseDetailClient.tsx` | High fetch priority for the actual cover image. Add a main landmark only in the standalone location view, preserving embedded booking landmarks. Use the doctor's visible link text as its accessible name. |
| Must fix accessibility | `src/app/(auth)/login/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/components/dashboard/MobileBottomNav.tsx` | Main landmark, heading hierarchy, and accessible names that include visible mobile/desktop labels. No permission condition, navigation destination or form handler changes. |
| Focused regressions | `src/tests/imageLoading.test.tsx`, `loadingStates.test.tsx`, `spinner.test.tsx`, `locationNavigation.test.tsx`, `responsiveControls.test.tsx` | Check CSP-safe shared markup, custom size/style compatibility, and updated accessible names. |

Direct provider imports were tried and reverted: the audit did not show a
JavaScript-transfer reduction. No lazy auth checks, blanket prefetch removal,
framework patch, sensitive-data caching or SSR change was retained.

The static skeleton size list and CSS must stay in sync when adding a new design
size. Arbitrary caller `style` props are still subject to the existing CSP; this
change fixes the shared defaults/design sizes, not every dynamic style throughout
the application. It does not add `unsafe-inline`, style hashes or a security bypass.

### Representative routes

The automatic inventory found 54 page templates. Audit five architectural
representatives rather than every URL:

- `/`: public marketing, shared root providers and branding.
- `/browse`: directory cards, filters and speculative route traffic.
- `/browse/audit-clinic`: dynamic public SSR, branding and booking entry point.
- `/login`: authentication form and loading controls.
- `/dashboard`: authenticated private shell and operational overview.

Refresh the read-only inventory with `node scripts/list-performance-routes.mjs`.
This prints templates and architectural families; it never executes route modules.

Use mobile simulation first (150 ms RTT, approximately 1.6 Mbps, 4x CPU slowdown),
three runs per route and per-metric medians. These are laboratory results, not
real-user Core Web Vitals, field INP or a Render availability measurement.
Desktop baseline comparisons were single runs and are not mixed with mobile.

Final measurements are recorded in `lighthouse-results.json` and the table below.

### Before and after

The completed CSS-consolidated build was measured three times on the three key
public/dynamic/private representatives. Directory/login were additionally checked
during development and in the final browser smoke; their intermediate scores are
not presented as final-build medians.

| Route | Performance before → after | LCP before → after | TBT before → after | Accessibility before → after |
| --- | ---: | ---: | ---: | ---: |
| `/` | 88 → 96 | 3,341 → 2,443 ms | 212 → 156 ms | 100 → 100 |
| `/browse/audit-clinic` | 83 → 90 | 4,517 → 3,463 ms | 144 → 148 ms | 98 → 100 |
| `/dashboard` | 69 → 67 | 5,295 → 5,306 ms | 454 → 532 ms | 98 → 100 |

Home LCP decreased approximately 27%; clinic LCP decreased 23%. Dashboard
performance remains unresolved: LCP is essentially unchanged and TBT is higher.
Do not claim a dashboard speedup or accept its current performance as a stable
regression budget. Its synthetic realtime failures and local CPU variability
limit attribution; further private-bundle work needs a separate profile.

Final per-metric medians (performance/accessibility/best-practices/SEO):
home 96/100/100/100, clinic 90/100/100/100, dashboard 67/100/92/66.
Final FCP is 1,079/922/1,067 ms; Speed Index 1,079/970/1,239 ms; median CLS is
zero on all three. Full precision, ranges and samples are in the JSON evidence.

At 390 CSS pixels / DPR 2 the actual login logo uses the **7,230-byte** 160px WebP,
96.4% smaller than the original PNG. The 96px and 240px copies are 4,188 and
11,926 bytes. A final single-run directory diagnostic retained **23 → 16 SSR
fixture reads**, including **14 → 7 doctor reads**, across a Lighthouse audit
that includes secondary navigation. These are diagnostic counts, not per-visitor
production API totals. Primary clinic prefetch remains enabled.

The final home audit still loads two stylesheets, as before. CSS transfer increases
only 1,037 bytes for the shared loading rules; script transfer changes from
260,013 to 260,237 bytes. No JavaScript-size improvement is claimed. Initial CSS
module placement added a third blocking stylesheet; that approach was replaced
with the existing global stylesheet before final measurement.

### Verification and limits

Highest applicable risk: Level 4, because shared controls appear in authentication
and booking screens. Focused checks cover image/loading controls, navigation,
public routing/SEO, auth recovery, dashboard roles, branding nonces and PWA
recovery. The full suite and release gate were not run.

Sixteen distinct focused Vitest files passed across scoped runs. The shared
size/spinner checks were repeated after their final CSS placement changed.
Changed-code ESLint passed with existing route warnings, and `git diff --check`
passed. Application `npm audit --audit-level=high` reported zero vulnerabilities.

The final browser smoke passed directory-to-doctor SPA navigation, a single
main landmark in the embedded booking view, login form/branding, explicit skeleton
size priority under strict CSP, same-origin API rewriting, anonymous dashboard
redirect, favicon/manifest and the service-worker no-store header. It recorded
zero CSP violations and zero browser console errors. Service-worker unit checks
also cover private/API cache exclusion and current/retired cache deletion.

Raw before HTML/JSON reports remain under the temporary local directory
`C:/Users/Jay/AppData/Local/Temp/ekavyu-lighthouse-audit-20261022/reports/`;
final three-route reports are in `reports-shipped/`. Temporary scripts and the
browser/tool cache are not Git dependencies. Reproduction requires the pinned
versions and synthetic production build; `next dev` scores are not comparable.
Server/browser/fixture processes were closed after collection.

The final isolated Next production build includes TypeScript and route generation.
All application pages retain dynamic SSR; Node/Docker standalone output remains.
The isolated artifact uses reserved example origins and a loopback backend:
**never deploy `.next/recovery-check`; release builds require real reviewed URLs.**

Backend authentication, CSRF, JWT/session checks, tenant scoping, booking writes,
fresh appointment availability, API forwarding and realtime code were untouched.
No backend test run or infrastructure change was needed. This is not deployed
login/booking/WebSocket verification. A manual browser smoke check on an approved
deployment is still required before real users.

The fixture deliberately lacks a real notification WebSocket/SSE server. Dashboard
best-practices errors and realtime reconnect work include this limitation. Synthetic
clinic photos/logos are not representative of actual clinic uploads. Geo-IP failure
is deliberate. Login/private SEO noindex behavior remains intentional.

### Lighthouse CI: blocked by current upstream dependencies

The latest official `@lhci/cli` available during this pass is 0.15.1. Installing it
with browser tooling caused **18 dependency findings, including 12 high**, and
failed the existing `npm audit --audit-level=high` gate. The chain includes
`extract-zip` 2.0.1 (currently the latest published version), temporary-file and
proxy dependencies. These findings concern the attempted audit toolchain.
The application's original package/lockfile were restored and its audit again
reported **zero vulnerabilities**. No dependency override, suppressed finding,
changed audit severity, paid service or public report upload was introduced.

Automatic Lighthouse CI is therefore **not installed or enabled**. Source drafts
and the attempted dependency installation are not Git changes. This portion of
the requested implementation remains blocked; existing CI gates are intact.

Once a reviewed toolchain passes the security gate, the small CI design is:

1. Append collection after the existing production build on relevant frontend
   PRs, reusing dependency install/build. Use synthetic reserved origins and a
   loopback fixture backend. Never give the audit production secrets.
2. Start with `/`, `/browse/audit-clinic`, `/login`, three mobile runs each.
   Include directory when its cards/filters change; include authenticated dashboard
   after completing its realtime fixture when shared/auth/private code changes.
3. Use median warning budgets: performance 75, LCP 5,000 ms, TBT 400 ms, CLS 0.1.
   Collection errors must remain visible; a failed load is not a valid baseline.
4. Calibrate a fresh Linux/Chrome baseline with the actual CI version. LHCI 0.15.1
   embeds Lighthouse 12.6.1; do not compare it with these 13.5.0 measurements.
   Compare against a reviewed main-branch baseline, never overwrite it from a PR.
   Warn on LCP increases exceeding both 15% and 200 ms, or TBT increases over 100 ms.
5. Save JSON/HTML to private GitHub workflow artifacts for three days, using
   filesystem upload. No public temporary LHCI storage or separate server.
   Cancel superseded runs and skip docs-only changes. Estimated additional CI time
   is 2–4 minutes for nine audits, subject to runner variability and free quotas.

Render cold starts, production CORS/configuration and field monitoring are separate
operational concerns. These changes neither keep Render awake nor make a Free
backend reliable for clinical use. Retain Vercel/Render; do not revive the rejected
Cloudflare Free SSR deployment as a Lighthouse optimization.

### References

- [Lighthouse](https://developer.chrome.com/docs/lighthouse/)
- [Lighthouse CI configuration](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)
- [Core Web Vitals](https://web.dev/articles/vitals)
- [Staying fast](https://web.dev/articles/how-to-stay-fast)
- Installed Next documentation: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`
  and `content-security-policy.md`.

## Request lifecycle and database measurements

Reviewed 2026-10-15 across the frontend and sibling backend checkout. Changes are limited to existing request paths and one compound index. No infrastructure, dependencies, patient-data cache, or financial write behavior was added.

### Implemented changes

| Evidence in the existing code | Change | Preserved behavior |
| --- | --- | --- |
| `TodayPatients` fetched a paginated visit list alongside daily-summary, which independently fetched and populated up to 100 appointments. Detailed consultations also discarded those summary rows. | Add optional `includeAppointments=false` to daily-summary and use it in these two consumers. Skip that find/populate operation entirely. | Existing callers receive the original response by default. Authoritative status aggregation, financial aggregation, authorization, and response fields remain intact. |
| `TodayPatients` executed two requests every 30 seconds in hidden tabs. | Skip hidden polling and refresh immediately when visible. Coalesce visibility/focus events within 250ms. | Visible polling remains 30 seconds; manual refresh and post-mutation refresh still fetch current values. No stale patient cache is introduced. |
| Queue delay status populated every day's patient and linked user, even when none qualified for an alert. It hydrated full appointment documents. | Project only scheduling/notification fields, use lean appointments, then populate contact details only for delayed pending/confirmed bookings. | Queue order, active-consultation elapsed time, checked-in patients ahead, alert threshold, notification metadata, and name/phone fallback remain unchanged. |
| Staff medical-record views requested the first organization-wide invoice page, then discarded other patients' invoices in the browser. | Pass the existing server-side `patientId` filter. Keep the defensive client filter and cancellation. | Backend tenant/location authorization and portal/family ownership checks are unchanged. The result remains paginated; this does not claim to load every historical receipt. |
| Default staff clinical history filters organization/patient, includes all note versions, and sorts by `createdAt`, `_id`. The existing organization/patient/isLatest index cannot provide that order with isLatest unbound. | Add `clinical_history_by_patient`: `{ organizationId: 1, patientId: 1, createdAt: -1, _id: -1 }`. | Existing indexes, cursor ordering, revision visibility, patient access approval, and cross-organization audit logic remain intact. This index targets organization-scoped history, not approved all-organization history. |

Implementation paths: frontend `src/components/appointments/TodayPatients.tsx`, `src/app/(dashboard)/dashboard/consultations/page.tsx`, `src/components/ehr/PatientMedicalRecords.tsx`; backend `controllers/dailyDashboard.ts`, `controllers/queue.ts`, `models/ClinicalNote.ts`.

### Bounded measurements

The backend measurement file is `tests/requestLifecyclePerformance.test.ts`. It runs against the existing isolated MongoDB memory replica-set setup, with synthetic tenants and no external services. Results below are observed operation counts, uncompressed JSON bytes, and Mongo execution statistics. They are not production latency, wire-transfer, memory, throughput, or cost measurements.

| Scenario | Before | After |
| --- | --- | --- |
| Daily summary: 100 visits, each with about 3KB of synthetic consultation context | 428,938 response bytes; 1 appointment find plus population | 355 response bytes; 0 appointment finds/population |
| Queue delay status: 100 checked-in visits, no eligible alerts | 1 patient find + 1 linked-user find for population | 0 contact-population finds |
| Scoped clinical-history page: 4,000 notes across two tenants, 2,000 matching, 21 returned | 2,000 documents and 2,000 index keys examined; blocking sort | 21 documents and 21 keys examined; no blocking sort |

The daily-summary comparison uses the default full response versus the new opt-out on the same fixture. Counts and finances must match exactly. The fixture includes a payment today against an older invoice, a partially paid invoice created today, and another tenant's invoice; expected collections are INR 350 and outstanding INR 400.

The queue baseline reproduces the previous find/populate shape on the same fixture. These are two batched reads, not an N+1 query claim. Appointment and duration reads are still required. Separate checks verify delayed contacts and patient-profile fallback.

The history baseline hints the pre-existing compound index, while the optimized comparison hints the new one. An additional unhinted explain verifies that Mongo chooses a plan examining 21 documents without a blocking sort. Both plans return the same IDs, including equal-createdAt ordering.

The frontend hidden-tab test invokes 60 timer callbacks and observes zero API calls, followed by exactly two calls when visibility and focus return together. The previous code issued two calls per callback, equivalent to 120 calls over those 60 intervals. Browser background timer throttling can change actual elapsed time and request volume.

### Other inspected paths and remaining costs

- **Live queue:** The queue screen already coalesces reads and pauses hidden polling. One visible refresh still uses queue/status, then override/triage/delay requests. Queue/status/delay repeat some scheduling reads. Consolidating these needs a shared snapshot contract and freshness/error semantics; it was not necessary for the selective-contact improvement.
- **Daily financial summary:** The existing aggregation still considers historical invoices because a payment today can belong to an older invoice. A simple createdAt restriction would undercount collections. Any further reduction needs production explain data and coverage for legacy paymentDate, embedded payment dates, partial payments, currencies, and outstanding balances. No cached balances or speculative finance indexes were introduced.
- **Visit search:** Search bounds terms and scopes candidate IDs to authorized appointments, then performs batched patient/user matching. This is not per-result N+1, but the matching stages and unanchored regex can be expensive for large scopes. Patient directory search also has relationship/user lookups before its paginated facet and a 5-second query bound. No blind text index was added: it would not automatically solve the existing substring/linked-field semantics.
- **Repeated summary refresh:** Search, status, and page changes in `TodayPatients` still refresh summary values as well as the list. The new option removes unused rows, but those aggregates remain live. Separating their lifecycles requires preserving post-mutation and scope-change behavior; no long-lived financial cache was added.
- **Dashboard pagination:** Some older dashboard lists/fallback calculations consume the default first page of generic appointment/invoice endpoints. The authoritative daily summary remains the primary source of daily totals. The dashboard still consumes recentAppointments, so its full-summary request was deliberately retained. Broader dashboard list/count semantics need a separate correctness change, rather than increasing page limits.
- **Billing:** Invoice listing already supports patient filtering, bounded pagination, lean results, and a compound organization/patient/createdAt index. The medical-record caller now uses that existing path. Payment idempotency, transaction behavior, and refund reads were not changed.
- **Connections and server resources:** `db.ts` already shares one Mongoose connection per process with bounded pools, idle/wait timeouts, command latency, and pool checkout metrics. Pool demand multiplies across processes/workers. No pool reduction or concurrency increase is justified without saturation and memory measurements. Compression already applies to larger responses; reducing source data also removes query, hydration, and serialization work before compression.
- **Cache boundaries:** Authenticated responses use no-store. The frontend query client clears on logout/context changes; location lookup already deduplicates concurrent reads. No global patient cache or tenant-agnostic request memoization was introduced.
- **Next rendering/bundles:** Patient medical records are already dynamically imported by their route consumers; public pricing is deferred, and package import optimization is configured. Authenticated operational data still comes from client API requests. No bundle profile demonstrated another priority, so no rendering rewrite, additional lazy boundary, image change, or production build was added for this request.
- **Background work:** Existing workers are present. These bottlenecks are redundant reads and sorting, so adding a worker or queue would not address them.

## Authentication transport and outage recovery

### Behavior changed

| Files | Before | After |
| --- | --- | --- |
| `src/lib/api.ts`, `src/lib/apiError.ts` | Any refresh failure announced session expiry. | Only a refresh 401 announces expiry. Other failures suspend private access for verified recovery. Concurrent requests still share one refresh. Transport failures do not automatically replay mutations. HTTP errors and cancellation have separate presentation categories; technical responses are sanitized. |
| `src/store/authStore.ts` | Failed session checks cleared the session indicator and appeared signed out. | Uncertain authority clears private user/scope state and exposes `authError`, retaining the indicator for recovery. The indicator grants no authority. Successful `/auth/me` verification clears recovery state. Confirmed rejection, explicit logout, guest denial and workspace isolation retain their security behavior. |
| `src/app/(dashboard)/layout.tsx` | An unavailable session check redirected to login. | Shows a recovery screen without mounting protected children. Try again verifies the server session before restoring the workspace. |
| `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx` | HTTP 200 with nested OTP delivery failure showed success. Timeout could be labeled invalid OTP or credentials. | Explicit outer/nested failure prevents the delivery-success state. Outages have availability feedback and entered details remain available. No automatic OTP submission retry. |
| Backend `index.ts`, `utilities/startupTraffic.ts` | Startup refusal ran before CORS, hiding its 503 from browsers. | The same guard runs at `preValidation`, after CORS. Strict Origin configuration and exact health-probe exceptions remain. HTTP handlers and WebSocket upgrades stay blocked before readiness. |

SSR, proxy/CSP, cookies, CSRF validation, tenant permissions, booking/payment
business logic, native WebSockets, PWA behavior and Node/Docker configuration were
not redesigned. No dependencies or cache policies changed.

### Remaining limits and manual release steps

This batch handles failures; it does not eliminate Render cold starts, guarantee
free-tier uptime, fix blocked SMTP transport, add booking idempotency or establish
readiness for real patient use. No successful live OTP delivery is claimed.
Backend-origin CORS configuration, browser cookie acceptance and live clinical
flows still need deployment smoke verification. Browser E2E was not run.

1. Review only this batch's frontend/backend files, preserving existing unrelated
   Cloudflare report/experiment and Render keepalive working changes.
2. Run the existing CI/release gates before a release; scoped development checks
   do not replace them. No new environment variables are required by this batch.
3. After separate deployment approval, publish the reviewed backend/frontend
   revisions. Verify allowed-Origin 503 behavior, login/OTP, browser cookies,
   session recovery, workspace permissions, appointments and WebSocket reconnects
   using synthetic accounts first.
4. Roll back by redeploying the previous known-good revision of each affected
   service. No schema migration or data rollback is required. Do not discard
   unrelated local working changes to undo this batch.

## Public branding CSP and error recovery

### Confirmed findings

- The console's blocked stylesheet hash
  `sha256-iAHnirJytjhpfrfxvHPg131dUCnxtIKYsQNI5beD7vo=` exactly matches
  `.public-brand-border{border-top:4px solid #0F6F66}.public-brand-action{background-color:#0F6F66}`.
  A client navigation can receive a new request nonce while the active document
  still enforces its original CSP. The server-only branding style used the new
  request nonce and was therefore rejected after navigation.
- [React error 441](https://react.dev/errors/441) identifies a server-component
  rendering failure, with details omitted from the production browser message.
  It does not establish the underlying exception. The profile loader deliberately
  throws on timeouts/upstream failures, preserving a server error instead of
  incorrectly declaring a public profile missing. The historical failure still
  needs its Vercel runtime error/digest for exact attribution.
- Read-only live checks during this investigation: backend health GET 200;
  locations OPTIONS 204; the exact reported locations GET 200 with
  `Access-Control-Allow-Origin: https://dev.ekavyu.com` and credentials enabled;
  the reported clinic page GET 200. The locations GET took about 3.9 seconds.
  This establishes current behavior, not the cause of an earlier intermittent
  CORS failure. No allowlist change is justified by these checks. Startup errors
  from the older backend or a Render-generated failure remain possible causes;
  distinguish them using the failing HTTP status, headers and service logs.
- The PWA hook intentionally defers the install prompt and calls `prompt()` from
  the Install button. The PWA notice and unused image-preload warning do not
  explain a failed API request or server render. They were not suppressed.

### Deployment and remaining diagnosis

These fixes are local. After review and separate deployment approval, rebuild the
frontend through its normal Vercel `npm run build` using the intended environment;
do not reuse the synthetic validation output. No new environment variables are
required. Deploy the previous backend reliability batch separately if approved.

Verify browser navigation between directory, clinic and doctor pages, custom
branding, OTP/login, cookies and backend-unavailable recovery using synthetic
accounts first. If CORS recurs, capture the failed request's HTTP status/response
headers and matching Render logs; for error 441 capture the Vercel runtime error
and digest. Do not share authorization headers, cookies or patient information.
The recovery screen handles failure; it does not guarantee always-on free hosting
or repair an underlying backend exception.

Rollback: redeploy the previous known-good frontend revision. No data/schema
rollback is needed. Preserve unrelated local working changes.

References: [Next CSP/nonces](https://nextjs.org/docs/app/guides/content-security-policy),
[Next error boundaries](https://nextjs.org/docs/app/api-reference/file-conventions/error),
[Render free-service startup behavior](https://render.com/docs/free#spinning-down-on-idle).

## Synthetic workload scale and next gate

Reproducible harness: `backend/scripts/measure-healthcare-scale.ts`. Run from the backend with `node --experimental-strip-types scripts/measure-healthcare-scale.ts`. It creates and removes its own MongoDB replica set, never loads `.env`, and does not use configured databases, Redis, payment providers or real patients. Raw results: `backend/docs/measurements/healthcare-scale-baseline.json`.

### Local baseline

One warm-up followed by seven sequential timed samples, on the machine recorded in the JSON artifact. These are local warm measurements, not network/browser timings, concurrent-load results, tail-latency estimates or production SLA evidence.

| Workload | Fixture size | Median / max | JSON payload |
| --- | --- | --- | --- |
| Replacement-provider API, 10 providers | 1,000 appointments; 100/provider on the location day | 16.66 / 35.86 ms | 2,304 bytes |
| Replacement-provider API, 100 providers | 10,000 appointments; 100/provider on the location day | 38.33 / 80.29 ms | 24,984 bytes |
| ROOT dashboard service, 50 organizations | 500 providers, 15,000 appointments, 50 subscriptions, 33 captures | 75.15 / 91.70 ms | 8,549 bytes |
| ROOT dashboard service, 500 organizations | 5,000 providers, 150,000 appointments, 500 subscriptions, 333 captures | 570.75 / 663.23 ms | 8,597 bytes |

Replacement measurements run through authenticated Fastify injection. ROOT measurements call the existing dashboard service with a fixed date and include its database/aggregation work; they do not include route/auth or HTTP overhead. Each ROOT organization has one location, ten active Doctor/User identity pairs, 100 visits across forty recent days and 200 older visits from 190-389 days ago. The harness asserts the joined provider total and monthly booking count. Rich clinical documents, diagnostics, multi-location operations, audit history and competing users are not represented. The final measurement ran after the full test process ended to avoid that process distorting timings; it replaces the initial recent-only fixture.

### Execution plans and decisions

- Replacement location/day load uses existing `locationId_1_status_1_appointmentTime_-1`, examining 1,000/10,000 matching documents. The query count remains constant as provider count grows; returned choices grow from 9 to 99. Keep the existing batched reads. A 25 KB selector response does not by itself justify a pagination rewrite.
- ROOT's organization inventory performs an expected global COLLSCAN of 50/500 organizations. The representative booking match uses `organizationId_1`, examining 15,000/150,000 records to return 5,000/50,000 recent records. The JSON response stays near 8.6 KB because activity and organization snippets are bounded.
- The ROOT median grows about 7.6 times for tenfold fixture volume. Retained history triples documents examined compared with recent matches, making a tenant/date index a concrete candidate for a measured follow-up. Compare the full aggregation plan and end-to-end latency with candidate indexes on disposable fixtures, then validate concurrent staging load before any migration. This baseline does not prove an index benefit or justify a materialized-summary service.
- No production index, pagination, infrastructure or customer-size-specific architecture change follows from this baseline. Current data supports a specific future investigation of ROOT aggregation cost, not a claim that all workloads are fast at 500 organizations.

### Next measurement gate

On staging with synthetic tenants, repeat representative response sizes and execution plans with retained history and controlled concurrency. Record p50/p95/p99 with enough samples, database CPU/working-set size, error rate and pool saturation. Include daily queue, invoice/patient lists, team selectors and multi-location permissions. Agree response/latency budgets from actual use before optimizing those paths.
