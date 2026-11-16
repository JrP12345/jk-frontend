# Local production page audits

## Current homepage tools

The authoritative page/design guide is [homepage-design.md](../../docs/homepage-design.md). Current evidence is under `docs/landing-page/connected/`: product captures/provenance, `review/refinement-results.json`, `review/refinement-failure-states.json`, eight entry journeys in `journeys/journeys.json`, and `lighthouse-refinement-2026-11-09.json`. Current account/discovery evidence is in `public-journey/`. Superseded visual reports have been removed; dated website-wide performance baselines remain separate.

- `landing-demo.mjs`: rich fictional practice layered on the shared page-audit shell fixtures. Never use it against an application database or deployed service.
- `capture-connected-product.mjs`: Playwright captures the nine actual routes used by the landing page, including pharmacy, at desktop/mobile sizes using its own loopback fixture server and frontend preview. It blocks outbound services and writes; encounter initialization is simulated in memory. Use `PRODUCT_CAPTURE_DIST` for an existing isolated production build, `PRODUCT_CAPTURE_SCREENS=queue,doctor` for affected views only, and `PRODUCT_CAPTURE_OUTPUT` / `PRODUCT_CAPTURE_ASSETS` to redirect artifacts.
- `review-connected-landing.mjs`: Playwright checks all nine screenshot alternatives, keyboard/menu behavior, WhatsApp disclosures, accessibility and responsive/fallback conditions. Set `LANDING_QA_ORIGIN`, `LANDING_QA_OUTPUT` and optional `LANDING_QA_SCENARIOS`.
- `landing-review.mjs --lighthouse`: runs the current Playwright review and Puppeteer/Lighthouse measurements against a running local production frontend. Use `--lighthouse-only` when the unchanged browser review has already passed. It uses the same rich catalogue; retain unsuccessful observations rather than selecting the best sample. `LIGHTHOUSE_TOOLS_DIR` selects the isolated audit-tool installation.
- `landing-journeys.mjs`: read-only desktop/mobile checks following actual homepage links to discovery, plan comparison, assisted clinic setup and pharmacy onboarding; no form submissions.
- `review-public-journey.mjs`: connected login, registration, directory, facility and doctor review with a loopback-only SSR fixture server. Uses ports 3108/5128; default is a local dev preview. Set `PUBLIC_JOURNEY_DIST` to an isolated production artifact, `PUBLIC_JOURNEY_PHASES=views,journeys,states,loading`, and `PUBLIC_JOURNEY_OUTPUT` for artifacts. `PUBLIC_JOURNEY_VIEWPORTS` accepts width/dark pairs and `PUBLIC_JOURNEY_ROUTES` selects page labels for scoped rechecks. The browser simulates only known OTP request/rejection responses in memory, stops booking at patient details and blocks all other writes/external traffic. Phone journeys open the compact navigation menu before Sign in; login/register share a persistent account frame. Current findings: [public page review](../../docs/public-pages-review.md).
- `review-browse-directory.mjs` with `browse-demo.mjs`: current list/map, filter, selection, area search and missing/long-data cases. Uses loopback ports 3107/5118. `BROWSE_REVIEW_DEV=1` uses an isolated development preview; otherwise set `BROWSE_REVIEW_DIST` to a matching production artifact. `BROWSE_REVIEW_OUTPUT` redirects evidence, `BROWSE_DIRECTORY_WIDTHS` narrows width/theme pairs, and `BROWSE_DIRECTORY_SKIP_STATES=1` skips unchanged state cases. Live tiles are opt-in with `BROWSE_REVIEW_LIVE_TILES=1`; ordinary checks mock them.
- `review-public-care.mjs`: current facility/doctor layout, contact/gallery actions, missing data and booking-entry states. Uses loopback ports 3115/5125 and an isolated development preview. `CARE_REVIEW_OUTPUT` redirects evidence, `CARE_REVIEW_WIDTHS` narrows width/theme pairs, and `CARE_REVIEW_SKIP_STATES=1` skips unchanged state cases.

Playwright Core uses an ignored local tools installation (`npm install --prefix .next/landing-tools --no-save --no-package-lock playwright-core`); `PLAYWRIGHT_TOOLS_DIR` overrides that directory. It uses installed Chrome, not a bundled browser. No browser tool is an application runtime dependency. Store new raw performance reports in an ignored output directory and commit compact measurements/current review evidence only. The broader audit prerequisites below also apply to Axe/Lighthouse tooling.

For an isolated Lighthouse installation, use `npm install --prefix .next/landing-audit-tools --no-save --package-lock=false --ignore-scripts puppeteer-core lighthouse axe-core` and set `LIGHTHOUSE_TOOLS_DIR` to that directory's absolute path. These are audit tools only; do not add them to application dependencies. The November runs used Puppeteer Core 25.16.0, Lighthouse 13.6.0 and Axe Core 4.14.0. On the managed Windows environment, Puppeteer/Chrome may require the executor's browser/process permission; a startup timeout alone is not an application failure.

Directory layout and booking contracts are documented in [browse-pages-handoff.md](../../docs/browse-pages-handoff.md). Use the directory, care and journey tools above for the current visual acceptance checks.

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
