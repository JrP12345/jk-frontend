# Lighthouse performance changes

## Public reads and navigation follow-up: 23 October 2026

Implemented the approved public-read and doctor-rendering changes in the frontend
and sibling backend. Nothing was deployed, no dependencies or hosting settings
changed, and no patient data or live availability cache was introduced.

### Retained changes

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

### Comparable production-build measurements

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

### Backend read measurements and verification

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

## Earlier measurement set: 22 October 2026

Reviewed 2026-10-22. Local production build, Next 16.4.2, React 19.3.1,
Chrome 155.0.8059.85, Lighthouse 13.5.0, Node 24.7.0 on Windows.
Measurements use synthetic clinics, a synthetic doctor/session and a loopback
backend with a fixed 40 ms delay. No Render, Atlas, production account or patient
record was used. Nothing was pushed or deployed.

## Scope and changes

| Priority | Files | Change |
| --- | --- | --- |
| High impact | `src/components/ui/EkavyuLogo.tsx`, `scripts/generate-brand-assets.mjs`, `public/ekavyu-leaf-{96,160,240}.webp` | Responsive transparent copies of the existing artwork replace the 201,737-byte PNG in small UI logos. Original PNG, favicon and installed PWA icons remain. `node scripts/generate-brand-assets.mjs --website-only` regenerates only these three copies. |
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

## Representative routes

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

## Before and after

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

## Verification and limits

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

## Lighthouse CI: blocked by current upstream dependencies

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

## References

- [Lighthouse](https://developer.chrome.com/docs/lighthouse/)
- [Lighthouse CI configuration](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)
- [Core Web Vitals](https://web.dev/articles/vitals)
- [Staying fast](https://web.dev/articles/how-to-stay-fast)
- Installed Next documentation: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`
  and `content-security-policy.md`.
