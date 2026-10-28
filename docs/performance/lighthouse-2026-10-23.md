# Website-wide optimization: 23 October 2026

This is a local implementation checkpoint, not full-app completion or a deployment report. The [route tracker](lighthouse-progress.md) accounts for all 54 page templates across eight groups. Earlier discovery optimization remains recorded in [the original report](../lighthouse-performance.md).

## Measurement conditions

- Production `next build` / `next start`, Next 16.4.2, Node 24.7.0, Lighthouse 13.5.0, Chrome 155.0.8059.86, Windows.
- Lighthouse defaults for simulated mobile; its desktop preset for desktop. These differ from the user's live DevTools device/no-throttling screenshot.
- Local frontend at `http://127.0.0.1:8798`; isolated synthetic API on loopback port 5099 with 40 ms delay, plus matching browser interception of `https://api.example.invalid/api`. No production credentials, writes or patient data.
- Baseline production artifact `.next/focused-performance` from the previously committed source; later artifacts record each experiment. Final artifact and sample counts are recorded with the results below.
- New browser contexts isolate cache between Lighthouse navigations. Repeats within one server process measure a warm local server, not Render cold starts. SPA cache reuse is checked separately.
- Pharmacy baseline initially used an incomplete API fixture. Those initial pharmacy scores are excluded; comparisons use the corrected, validated `/pharmacy/onboarding/options` response with an explicitly published synthetic plan.
- Dashboard data contains nonzero totals and a synthetic appointment. Its WebSocket/SSE fixtures remain incomplete; those diagnostic scores cannot certify live notifications or full dashboard completion.
- Some account pages emit Lighthouse's secondary `LanternError: NO_LCP` diagnostic. Reports still contain FCP/LCP and no `runtimeError`; this is retained as a measurement limitation.
- The pricing collector records a 503 message after the audited pass on both baseline and current runs. The audited plan request is HTTP 200 and Lighthouse's console-error audit is empty. This additional collector phase remains unverified; it is not evidence of a deployed backend failure. The navigation check's console 404 comes from its deliberately missing route.
- No field Core Web Vitals or INP dataset was collected. The browser navigation timing is one local check, not a real-user percentile.

## Implemented changes

1. Centralized indexing policy: development, staging, provider previews, loopback hosts and Vercel preview environments remain noindex. Configured production public pages remain eligible. Metadata, response headers and sitemap advertising now agree. Preview sitemaps avoid unnecessary discovery API calls. Operational routes remain excluded.
2. Pricing reuses the existing five-minute public plan query used by the home page. Retry, empty configuration, currency, trial and annual billing behavior remain covered. This cache contains public plan descriptions, not payment or subscription authority.
3. Registration, password reset and email verification now expose a main landmark.
4. Pharmacy signup reserves space for asynchronously loaded trial terms; loading announcements no longer insert/remove visible rows above the new-account form. Saved-setup checks retain their visible status. Recovery, duplicate submission protection and MFA behavior remain unchanged.

### Experiments removed

Direct imports across shared UI boundaries reduced references in a manifest, but total JavaScript transfer did not improve: speculative route prefetching still loaded other chunks. The repeated pricing median fell from 98 to 94 during this experiment. Role-only platform dashboard splitting left the doctor dashboard median at 65 and saved too little transferred code to justify keeping it. Both experiments were reverted. The final measurements use `.next/wide-performance-validated` after their removal; earlier experiment results are retained only as diagnostics.

## Results

Final mobile results use three runs per route. The five repeated baselines have three runs; remaining account baselines have one run, identified below. Desktop comparisons use one run each. These are lab measurements on synthetic data, not live scores.

| Route / measured state | Mobile P before -> after | Samples before/after | Desktop P before -> after | A before -> after | Final BP | SEO |
| --- | --- | --- | --- | --- | --- | --- |
| / | 96 -> 97 | 3/3 | 100 -> 100 | 100 -> 100 | 100 | 69 locally; deliberate noindex |
| /pricing | 98 -> 94 | 3/3 | 100 -> 100 | 100 -> 100 | 100 | 69 locally; deliberate noindex |
| /login | 92 -> 92 | 3/3 | 100 -> 100 | 100 -> 100 | 100 | N/A; private noindex |
| /register | 90 -> 92 | 1/3 | 100 -> 100 | 98 -> 100 | 100 | N/A; private noindex |
| /reset-password | 94 -> 91 | 1/3 | 100 -> 100 | 98 -> 100 | 100 | N/A; private noindex |
| /accept-invite | 98 -> 97 | 1/3 | 100 -> 100 | 100 -> 100 | 100 | N/A; private noindex |
| /onboarding | 94 -> 94 | 3/3 | 100 -> 99 | 100 -> 100 | 100 | N/A; private noindex |
| /verify-email (missing token) | 94 -> 95 | 1/3 | 100 -> 100 | 98 -> 100 | 100 | N/A; private noindex |
| /pharmacy-start | 86 -> 98 | 3/3 | 97 -> 99 | 100 -> 100 | 100 | N/A; private noindex |

| Route | Mobile FCP, seconds | Mobile LCP, seconds | Mobile TBT, ms | Mobile CLS |
| --- | --- | --- | --- | --- |
| / | 1.07 -> 1.07 | 2.62 -> 2.44 | 91 -> 80 | 0.000 -> 0.000 |
| /pricing | 0.91 -> 0.92 | 2.11 -> 2.70 | 144 -> 151 | 0.000 -> 0.000 |
| /login | 0.91 -> 0.92 | 3.16 -> 3.17 | 146 -> 153 | 0.000 -> 0.000 |
| /register | 0.91 -> 0.91 | 3.07 -> 3.12 | 238 -> 142 | 0.000 -> 0.000 |
| /reset-password | 0.91 -> 0.92 | 3.00 -> 3.01 | 113 -> 208 | 0.000 -> 0.000 |
| /accept-invite | 0.92 -> 0.91 | 2.18 -> 2.18 | 82 -> 136 | 0.000 -> 0.000 |
| /onboarding | 0.91 -> 0.92 | 2.85 -> 2.84 | 131 -> 179 | 0.000 -> 0.000 |
| /verify-email | 0.91 -> 0.91 | 2.72 -> 2.70 | 166 -> 148 | 0.021 -> 0.021 |
| /pharmacy-start | 0.91 -> 0.91 | 2.71 -> 2.27 | 51 -> 91 | 0.220 -> 0.000 |

Pricing remains **partial**: the retained cache change still has a cold mobile median of 94 versus the repeated baseline of 98. Removing bundle experiments did not restore that number. Keep the verified warm-navigation improvement, but profile and resolve this discrepancy before closing pricing. Login/onboarding medians and individual run spread also show why one successful run is insufficient. No broad performance win is claimed.

Doctor dashboard diagnostic baseline: mobile median 65, LCP 5.19 s, TBT 653 ms; desktop 97. The splitting experiment also produced a mobile median of 65 and was reverted. WebSocket/SSE fixture failures make this incomplete; no final dashboard certification is claimed.

Browser checks: home pricing to comparison navigation stayed in the same document and made 1 total plan request (one before and one total after navigation), taking 133 ms in this single local check. The published pharmacy form had no horizontal overflow at 390 px, one main landmark and an enabled submit control. A doctor profile rendered; the deliberately missing route returned HTTP 404. Screenshot inspection found readable forms with accessible control sizes.

Nine entry templates received new mobile/desktop measurements, plus one diagnostic dashboard template. With three discovery templates from earlier work, 13 of 54 templates have representative measurements. Status: four locally completed templates (prior discovery plus home), nine partial and 41 pending. Only the discovery group is complete within the previously recorded local scope; seven other groups remain partial or pending.

## SEO interpretation

The live development robots.txt probe returned a valid plain-text robots file; the old invalid-file finding was not reproduced. `dev.ekavyu.com` already returned `X-Robots-Tag: noindex, nofollow`. The screenshot's SEO 58 is therefore not a target to raise by permitting development indexing.

Local public SEO scores fall from 100 to 69 when the corrected loopback noindex header is applied. The blocking audit is `is-crawlable`; robots syntax and other applicable SEO audits pass. Private account/setup scores are reported as N/A in the tracker. Production indexing, preview exclusions, canonical URLs, sitemap pagination and private-route exclusions are checked with focused tests. A real production deployment still needs a valid frontend `APP_URL` and subsequent live validation. No environment or infrastructure was changed.

## Verification and limits

Highest scoped risk: Level 4 because the shared proxy is touched. The proxy change only affects indexing headers; cookie, redirect and CSP behavior is preserved and tested. Production builds include the package TypeScript gate; tests are separately executed because `src/tests` is excluded from TypeScript checking.

Focused checks passed: 124 unique cases across 14 Vitest files. These cover public discovery/SEO, public pricing and cache recovery, authentication/RBAC recovery, CSP/logout handling, invitation acceptance, pharmacy signup/recovery/MFA, operational/family/patient dashboard routing, platform owner reads, home navigation and PWA recovery. The pharmacy file's 10 cases were rerun after preserving saved-setup status visibility. Final changed-file ESLint has zero errors and one pre-existing effect warning in email verification. Backend source did not change; backend checks were not repeated.

Commands (from the frontend repository):

```powershell
npm test -- src/tests/publicDiscovery.test.tsx src/tests/publicPlanAndDisplayRecovery.test.tsx src/tests/homepagePricing.test.tsx src/tests/authAndNavigation.test.tsx src/tests/patientLoginAndLoading.test.tsx
npm test -- src/tests/cspRegression.test.ts
npm test -- src/tests/pharmacyOnboarding.test.tsx src/tests/invitationEntry.test.tsx
npm test -- src/tests/dashboardRoleLoading.test.tsx src/tests/dashboardCanonicalPatient.test.tsx src/tests/platformOwnerDashboard.test.tsx src/tests/dashboardQuickActions.test.tsx
npm test -- src/tests/homepage.test.tsx src/tests/pwaRecovery.test.tsx
$files = @(git diff --name-only -- '*.ts' '*.tsx'); npx eslint -- $files
git diff --check
```

Build with the reserved synthetic API origin and an isolated artifact:

```powershell
$env:NEXT_PUBLIC_API_URL='https://api.example.invalid/api'
$env:NEXT_PUBLIC_BACKEND_URL='https://api.example.invalid'
$env:NEXT_PUBLIC_WS_URL='wss://api.example.invalid'
$env:APP_URL='https://api.example.invalid'
$env:BACKEND_INTERNAL_URL='http://127.0.0.1:5099'
$env:EKAVYU_NEXT_DIST_DIR='.next/wide-performance-validated'
$env:NEXT_TELEMETRY_DISABLED='1'
npm run build
```

The local audit runner starts its own loopback fixture and server, so that fixture need not run during the build. To reuse it, set `EKAVYU_AUDIT_DIST`, `EKAVYU_AUDIT_STAGE`, `EKAVYU_AUDIT_PROFILE` (`mobile`/`desktop`), `EKAVYU_AUDIT_RUNS` and comma-separated `EKAVYU_AUDIT_ROUTES`, then invoke the temporary `run-wide.mjs`. Use `run-navigation.mjs` for the SPA/read and viewport checks. The raw report includes the settings used; the compact JSON preserves individual run scores and sample counts.

Retained code changes: `src/lib/siteUrl.ts`, `src/lib/publicSeo.ts`, `src/proxy.ts`, `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/pricing/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/(auth)/reset-password/page.tsx`, `src/app/verify-email/page.tsx`, `src/components/pharmacy/PharmacyOnboarding.tsx`, and the two affected public discovery/plan test files. No dependency, CI or infrastructure configuration changed.

Raw JSON/HTML, temporary runners and screenshots are in `C:/Users/Jay/AppData/Local/Temp/ekavyu-lighthouse-audit-20261022/`. Compact measurements are retained beside this document. The runner uses temporary Lighthouse/Puppeteer installations already present there; no dependency or CI service was added.

## Continue next

1. Resolve the cold pricing median discrepancy first; compare API/React render timing and alternate baseline/current runs under the same machine conditions. Do not discard the verified warm-cache reuse or close the route using its best run.
2. Profile doctor dashboard hydration with valid local WebSocket/SSE transport, then establish root, patient and pharmacy role baselines. Avoid calling notification fixture errors an app defect or treating a redirected login as a dashboard audit.
3. Finish account variants: patient/staff login, OTP/MFA, registration OTP, reset recovery/success, invitation expiry, verification token outcomes, organization provisioning and pharmacy saved-setup/no-plan/error states.
4. Continue remaining workspace and operational routes one group at a time, using their existing test fixtures/contracts and isolated synthetic sessions. Consult the tracker for every pending template and dynamic detail variant.
5. After an authorized deployment, repeat important live public routes and investigate actual API/database/server startup timing. Hosting tiers, region changes, paid upgrades and keepalive changes remain outside this implementation.
