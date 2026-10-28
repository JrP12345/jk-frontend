# Local production page audits

## Current homepage tools

The authoritative page/design guide is [homepage-design.md](../../docs/homepage-design.md). Current evidence is under `docs/landing-page/connected/`: real product captures/provenance, final Playwright browser screenshots/results, six conversion-route results, and `lighthouse-summary.json` with every final sample plus diagnostic failures. Superseded designs and generated HTML reports are not retained in source.

- `landing-demo.mjs`: rich fictional practice layered on the shared page-audit shell fixtures. Never use it against an application database or deployed service.
- `capture-connected-product.mjs`: Playwright captures nine actual routes, desktop/mobile, using its own loopback fixture server and frontend preview. It blocks outbound services and writes; encounter initialization is simulated in memory. Use `PRODUCT_CAPTURE_DIST` for an existing isolated production build and optional `PRODUCT_CAPTURE_SCREENS=queue,doctor` for affected views only.
- `review-connected-landing.mjs`: Playwright checks all nine screenshot alternatives, keyboard/menu behavior, WhatsApp disclosures, accessibility and responsive/fallback conditions. Set `LANDING_QA_ORIGIN`, `LANDING_QA_OUTPUT` and optional `LANDING_QA_SCENARIOS`.
- `landing-review.mjs --lighthouse`: independent Puppeteer/axe/Lighthouse measurements against a running local production frontend. It uses the same rich catalogue; retain unsuccessful observations rather than selecting the best sample.
- `landing-journeys.mjs`: read-only desktop/mobile checks following actual homepage links to discovery, plan comparison and assisted setup; no form submissions.
- `review-browse.mjs` with `browse-demo.mjs`: an isolated production-preview review of Browse at 320/375/390/768/1024/1440px and intermediate widths, plus single-result width assertions through 1920px. It covers dark themes, missing/long data, applied filters, loading/empty/error states, keyboard navigation, touch targets, Axe WCAG 2.2 checks and targeted profile preloading. Run `node scripts/performance/review-browse.mjs` against an already built artifact; `BROWSE_REVIEW_DIST` defaults to `.next/brand-production`, and `BROWSE_REVIEW_OUTPUT` defaults to `.next/brand-handoff/browse-review`. It owns loopback ports 3107/5118, blocks external browser traffic and API writes, and uses fictional data only. Build API origins must match the existing isolated-preview settings below, with `BACKEND_INTERNAL_URL=http://127.0.0.1:5118`.

Playwright Core uses an ignored local tools installation (`npm install --prefix .next/landing-tools --no-save --no-package-lock playwright-core`); `PLAYWRIGHT_TOOLS_DIR` overrides that directory. It uses installed Chrome, not a bundled browser. No browser tool is an application runtime dependency. Store new raw performance reports in an ignored output directory and commit compact measurements/current review evidence only. The broader audit prerequisites below also apply to Axe/Lighthouse tooling.

For a card-only visual iteration, `BROWSE_REVIEW_DEV=1` starts an isolated development preview in `.next/browse-review-dev`, avoiding a production rebuild. The harness permits its local HMR socket, waits for hydration, settles lazy images/fallbacks and hides only the Next development indicator for captures. This mode skips the production-only preloading latency measurement; it is visual/interaction evidence, not a performance benchmark. Default mode remains production. `BROWSE_REVIEW_PHASES` can select `views,singleviews,filters,states,keyboard`; separate phase outputs must be labelled when combined. Use `BROWSE_REVIEW_PHASES=facility,consistency` for the combined information panel, native hours/facilities disclosures, desktop/mobile ordering, gallery/copy/booking actions and directory/Back frame continuity.

Current cards load only the contained 88px identity logo, with no banner or gallery requests. The fixture supplies saved covers and deliberately unserved gallery sources; only its logo may appear on a card. Layout checks verify responsive one/two/three/four-column grids, long/missing data, square logos, bottom-aligned actions and 44px active controls. Use `BROWSE_REVIEW_PHASES=compact,filters,focus,stability` for the one-row mobile introduction/search/toolbar, pinned width/height, filter sheet/reset, hover/reduced-motion, keyboard clearance and delayed location checks. Mobile quick-specialty pills are omitted; city and specialty remain in Filters.

`BROWSE_REVIEW_COMPACT_WIDTHS` optionally narrows only the compact phase, for example `[[320,false],[390,false],[390,true]]` (width and dark-mode flag). Use it to recheck an affected phone breakpoint after a small fix; retain the full initial review and identify replacement cases when combining reports.

Run from the frontend repository with Node 24 and a locally installed Chrome. This harness never connects to a deployed API. Browser API traffic uses `api.example.invalid`, mapped to loopback in the disposable browser; server reads use loopback. All external traffic is blocked. Cookies, records and clinical details are synthetic. Unknown endpoints return 501 and invalidate the route instead of silently producing a successful empty screen.

`fixtures.mjs` enumerates every page template and additional dashboard roles. Check coverage against `node scripts/list-performance-routes.mjs` when routes change. The role permissions and response shapes represent initial views, not complete authorization or transaction tests. Keep the existing application tests for those boundaries.

## Prerequisites

Lighthouse 13.5.0, puppeteer-core 25.16.0 and ws 7.5.13 are currently resolved from the existing temporary installation at `%TEMP%/ekavyu-lighthouse-audit-20261022`. Override `LIGHTHOUSE_TOOLS_DIR` if it moves. They are not application dependencies or a CI gate. `CHROME_PATH` overrides the Windows Chrome path.

The API and notification WebSocket run over local TLS. Generate a disposable key/certificate in TEMP, using your local OpenSSL installation:

```powershell
& 'C:/Program Files/OpenSSL-Win64/bin/openssl.exe' req -x509 -newkey rsa:2048 -nodes -keyout "$env:TEMP/ekavyu-audit-key.pem" -out "$env:TEMP/ekavyu-audit-cert.pem" -days 1 -subj '/CN=api.example.invalid' -config 'C:/Program Files/Git/usr/ssl/openssl.cnf'
```

Chrome ignores certificate validation only in this disposable local browser, whose external requests are blocked. The application CSP remains enabled. Never reuse this key, certificate or browser configuration for a deployed service. The local WSS server accepts real connections and responds to heartbeats; transport failures and browser console errors remain visible in the summary.

## Build and run

The API origins must be compiled into an isolated production artifact. The fixture servers need not run during the build.

```powershell
$env:NEXT_PUBLIC_API_URL='https://api.example.invalid:5099/api'
$env:NEXT_PUBLIC_BACKEND_URL='https://api.example.invalid:5099'
$env:NEXT_PUBLIC_WS_URL='wss://api.example.invalid:5099'
$env:APP_URL='https://api.example.invalid'
$env:BACKEND_INTERNAL_URL='http://127.0.0.1:5100'
$env:EKAVYU_NEXT_DIST_DIR='.next/remaining-complete'
$env:NEXT_TELEMETRY_DISABLED='1'
npm run build

$env:AUDIT_STAGE='complete'
$env:AUDIT_MODE='lighthouse'
$env:AUDIT_PROFILE='mobile'
node scripts/performance/audit.mjs
$env:AUDIT_PROFILE='desktop'
node scripts/performance/audit.mjs
```

The runner owns loopback ports 8798 (frontend), 5099 (HTTPS/WSS API), and 5100 (server API). An occupied port causes startup to fail. No running user service is stopped. Next may add isolated build paths to `tsconfig.json`; restore only those generated additions after verification.

Options:

- `AUDIT_ROUTES`: comma-separated representative names from `fixtures.mjs`, for example `home,pricing,dashboard,dashboard-root`.
- `AUDIT_RUNS`: 1–5 fresh browser contexts per representative. Use repeated before/after samples for claims of improvement; one observation is not a median.
- `AUDIT_MODE=smoke`: validate populated views, route identity, JS errors, endpoint contracts, landmarks and overflow without Lighthouse.
- `AUDIT_MODE=interaction` with `AUDIT_ROUTES=home,dashboard`: check same-document pricing cache reuse, demand-loaded AI, notification dismissal and permitted patient navigation. Run on both profiles.
- `AUDIT_MODE=accessibility`: run the installed axe WCAG 2 A/AA and 2.1 A/AA rules on each populated view, including the visible-label rule that has no weight in the Lighthouse score. Violations fail the row; `incomplete` findings remain available for manual review. The final name corrections use artifact `.next/remaining-accessibility` and stage `complete-labels`.
  This mode reuses Chrome with a fresh isolated context per view; Lighthouse measurements still restart Chrome for every sample.
- Cold storage reset is the default. Lighthouse clears HTTP/memory cache, service workers and CacheStorage while retaining synthetic session cookies. `AUDIT_COLD=0` deliberately measures a reload with retained storage; do not compare its scores or transferred bytes with a cold run. Early retained-storage diagnostics are identified separately in the report.

The script writes incremental `summary.json` and full per-run Lighthouse JSON/HTML to `%TEMP%/ekavyu-remaining-<stage>-<profile>-<mode>/`. An unverified row includes its reason and missing contracts. Inspect all rows and console errors; the process finishing does not imply that every view passed. Commit compact measurements and route progress under `docs/performance/`, not large HTML reports or private data.

After both profiles finish, generate the compact JSON and route tracker with `node scripts/performance/report.mjs`, using the same `AUDIT_STAGE`. This command checks the actual page inventory against the fixtures and fails on missing/unverified observations. It preserves console diagnostics and labels sub-90 performance as partial. Keep additional retry/repeated-run folders when reviewing an interrupted or noisy pass; never silently replace failed observations with a favorable score.

Use a fresh stage name for a new build so previous retries and measurements cannot be mixed into that batch. The checked-in checkpoint uses `complete`, retries use `complete-retry`, the first WCAG checks use `complete-labels`, and final WCAG checks use `complete-labels-final` with artifact `.next/remaining-aria`. Three-run mobile samples use `complete-baseline-repeat` / `complete-repeat`. Its report also requires four interaction checks and all final WCAG observations before returning success.

The last public-navbar/plan-link change uses artifact `.next/remaining-public` and stage `complete-public`: five public WCAG views per profile, pricing-to-browse interaction on each profile, and three mobile / one desktop pricing Lighthouse samples. All earlier samples remain in the checkpoint JSON. The route table uses the latest pricing samples.

Localhost intentionally receives `noindex`. Private/operational SEO is not applicable. Validate production public metadata, robots, sitemap and indexing headers with `publicDiscovery.test.tsx`; never remove privacy/indexing controls to improve the local SEO score. Synthetic API latency is 40 ms per response and is not a measurement of Render, MongoDB or live network latency. Navigation times are unthrottled local observations; Lighthouse uses its recorded profile and throttling settings.
