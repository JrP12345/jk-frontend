# Ekavyu Cloudflare migration validation

Original review: 2026-10-18. As of 2026-10-22, the migration changes are on
`main`; the temporary migration branch has been deleted.

Platform follow-up, 2026-10-22: the approved isolated Free experiment is complete.
**Free CPU suitability: FAIL.** Representative SSR medians were 23–50 ms versus
the documented 10 ms allowance. Both temporary Workers were deleted; the existing
application and domain were untouched. See [actual measurements, sampling limits
and remaining integration checks](cloudflare-vinext-blockers.md#platform-measurement-record--22-october-2026).

Release follow-up, 21 October 2026: the pharmacy release pass verified both the
native Next production build and the existing vinext build after the dependency
security corrections. The frontend registry audit now reports zero
vulnerabilities; actual Next/Vite glob consumers have dedicated CI checks.
See [the release evidence](pharmacy-release-evidence.md). Builds use verification
origins. Docker's daemon is unavailable locally, so container-image and deployed
health checks still belong on the chosen host. This follow-up does not establish
Workers Free capacity or authorize a Cloudflare deployment.

The two original blockers are resolved locally: the Cloudflare production build
passes and native authenticated WebSocket forwarding works through the built
Worker. Workers Free suitability was unresolved in the original local pass; the
subsequent platform experiment above failed the CPU suitability check. The focused CPU pass found
that the earlier duration-summing method can count network waiting as CPU; it is
not evidence of exceeding Free's CPU limit. See [the corrected CPU assessment](cloudflare-vinext-blockers.md#local-profiler-methodology-and-withdrawn-comparison).
This is a reviewable migration draft, not approval to deploy on Free.
During the original local pass, no push, deployment, auto-deployment connection,
DNS change, Render change, MongoDB access or production credential change occurred.
The separately approved temporary staging deployment is documented above.

## Files and rationale

| File | Reason |
| --- | --- |
| `vite.config.ts` | Imports existing Next config, overrides only output for vinext. Cloudflare writes `.cloudflare/output`, while standalone emission expects `dist`. Removes the generated alias to nonexistent `empty-stub.js`; no runtime sharp imports exist. |
| `next.config.ts` | Uses `satisfies NextConfig` to retain concrete types compatible with vinext. All runtime settings, including standalone, remain identical. |
| `cloudflare.config.ts` | Worker name ekavyu-dev, custom entrypoint, fixed upstream binding, ASSETS and initializer routing/node compatibility. Rejects upstream credentials, query, fragment, path and non-HTTPS non-loopback URLs. No domain/DNS route declared. |
| `cloudflare/worker.ts` | Native upgrades before vinext; ordinary HTTP delegates unchanged. Preserves generated named exports and other handlers. |
| `cloudflare/websocket.ts` | Exactly four socket paths, fixed configured upstream, native fetch response passthrough. No new auth authority, token parsing, token URLs or JS frame relay. |
| `public/_headers` | Preserves existing `/sw.js` no-cache/no-store policy when Workers Static Assets would otherwise override the Next header. |
| `tsconfig.json`, `tsconfig.cloudflare.json` | Isolate Worker globals from browser/Next globals; combining them caused Response.json and DOM Document type conflicts. Both checks now pass. |
| `package.json`, `package-lock.json` | Official initializer dependencies, additive vinext scripts, focused local/type commands; existing Next dev/build/start scripts intact. |
| `.env.example`, `.gitignore` | Cloudflare environment examples; ignore generated output and verification logs. |
| `scripts/check-cloudflare-local.mjs` | Synthetic local HTTP/WebSocket verification, using installed tooling with no new test dependency. |
| `docs/cloudflare-vinext-blockers.md` | This report replaces the initial blocker findings. |

proxy.ts, application routes, API client, authentication code, CSP, Dockerfile and
Vercel configuration were not changed. Direct native Next config import confirms
standalone, rewrites and headers. A Node/Docker production build was not run.

## Backend security trace

`backend/routes/notifications.ts` registers /api/ws and /api/notifications/ws;
`backend/routes/appointments.ts` registers /api/clinical/ws and /api/queue/ws.
`backend/notifications/websocket.ts::resolveWebSocketAuth` validates supplied
Origin, verifies the token, resolves the session, rejects guests/MFA-incomplete/
revoked/mismatched identities, and checks identity scope. Clinical sockets also
check staff role, active location, organization ownership and VIEW_EHR permission.
Private delivery revalidates authority and closes revoked/expired sessions.
Queue sockets remain public, sanitized and rate-limited by Fastify.

`backend/utilities/types.ts` issues production Secure access/refresh cookies with
HttpOnly, Path=/ and optional COOKIE_DOMAIN. With COOKIE_DOMAIN unset, Set-Cookie
forwarded through the frontend yields host-only frontend cookies. No cookie scope
is rewritten or broadened. `backend/middleware/csrf.ts` validates production
mutation Origin/Referer against CORS_ALLOWED_ORIGINS; forwarded Host is not a
production bypass.

The Worker preserves Cookie, Authorization, Origin and Sec-WebSocket-* and returns
the native upgrade response directly. Fastify remains the JWT/session/database/
tenant/permission authority. Native frames, subprotocols and close codes pass
through workerd without a JS relay. Redirects are not followed. Unknown upgrade
paths return 404; forwarding requires GET. User input cannot select another host.

## Focused verification

Risk: Level 4 authentication transport. No full test suite or release gate run.

- Official vinext check from the preceding pass: 98%, zero issues. Installed
  vinext 1.2.1 / @vinext/cloudflare 1.1.1. Disabled React Compiler is the partial.
- Final `npm run build:vinext`: PASS, all five RSC/client/SSR stages. The generated
  bundle includes the custom fetch branch before the vinext handler.
- `npm run deploy:vinext -- --dry-run`: PASS; no upload/build/deploy performed.
- `npx tsc --noEmit --incremental false`: PASS.
- `npx tsc -p tsconfig.cloudflare.json`: PASS.
- Changed-code ESLint and `git diff --check`: PASS.
- `npm test -- src/tests/pwaRecovery.test.tsx src/tests/architectureRealtime.test.ts`:
  two files, six tests PASS.
- 23 distinct harness checks passed across scoped runs: HTTP Cookie/Origin/auth
  forwarding, three Set-Cookie values, redirects, CSRF Origin propagation,
  request-unique CSP nonce on every script, proxy auth redirects/cookie deletion,
  dynamic doctor SSR/404, PWA headers/hashed assets, all four native socket routes,
  text/binary frames, subprotocols, bearer headers, public queue access,
  missing/invalid/expired credentials, hostile Origin, tenant denial, backend
  revocation/client-close propagation, rejection identity, closed path allowlist,
  upgrade metadata and artifact/config sizing.
- A no-server probe of the ACTUAL backend CSRF/cookie helpers passed valid/hostile/
  missing Origin and Referer, production forwarded-host rejection, and host-only
  Secure/HttpOnly cookie options. No backend server or database started.

The local fixture signs synthetic credentials with a temporary HMAC key and models
the backend's post-upgrade denials. It does not prove live JWT keys, session/RBAC
records or deployed CORS settings. Backend security was traced in source; no live
Render/Atlas checks were made.

### Local tooling limitation

The installed Vite plugin's handleWebSocket destroys sockets when a Worker returns
no response.webSocket. Thus raw preview clients cannot receive non-101 HTTP
handshake rejection responses. The plugin source confirms this. Native 101 and
post-upgrade auth denials DID pass end to end. HTTP rejection response identity/
Set-Cookie and unknown-path rejection were checked at the forwarding function
boundary with mocked fetch. Independent Miniflare attempts failed locally and
are NOT counted as passing. Production non-101 handshake responses remain unverified.

### Reproduction

Set process-local PowerShell variables, without changing production env files:

```powershell
$env:NEXT_PUBLIC_API_URL='https://dev.ekavyu.com/api'
$env:APP_URL='https://dev.ekavyu.com'
$env:BACKEND_INTERNAL_URL='http://127.0.0.1:5099'
npm run build:vinext
npm run start:vinext -- --host 127.0.0.1 --port 8787
```

In another terminal: `npm run check:cloudflare:local`. It starts/closes its own
loopback backend. Optional regex: `npm run check:cloudflare:local -- 'handshake|open proxy|artifact'`.
Build-generated types are needed for `npm run check:cloudflare:types`.
The validation preview has been stopped. NEVER deploy the current generated
artifact: its upstream is loopback. Rebuild with the confirmed Render origin.

## Free resource assessment: stop before deployment

Current official limits: 64 MiB UNCOMPRESSED Worker bundle, no compressed-size limit,
20,000 static files and 25 MiB per asset. The older 3 MiB gzip rule is not the
current documented limit. The artifact has 5,193,549 bytes across 461 non-sourcemap
bundle files, 299 assets and maximum asset size 895,394 bytes. It fits those limits.
This estimate excludes maps/manifest metadata; no actual uploader has been run.

Local Runtime.getHeapUsage: JS used heap 21,823,664 bytes before and 23,593,200 after
sampling; allocated heap afterward 27,111,424 bytes. That measured JS heap fits
128 MB, but does not establish peak native/isolate memory, concurrency or startup
under the documented one-second limit.

The earlier five GET /login figures (16.822–19.806 ms) summed profiler timeDeltas
after excluding idle/program samples. A subsequent controlled 150 ms backend delay
demonstrated that this method includes off-CPU waiting inside apparent active
intervals. Withdraw the comparison of those numbers with Free's 10 ms CPU limit.
They establish neither compliance nor incompatibility. The corrected eight-route,
two-capture analysis and isolated staging measurement plan are in
[cloudflare-vinext-blockers.md#local-profiler-methodology-and-withdrawn-comparison](cloudflare-vinext-blockers.md#local-profiler-methodology-and-withdrawn-comparison).

Stop before deployment rather than weaken SSR, per-request CSP, auth or tenant
checks. Simplest alternative: retain the existing Next.js Node/Docker path.
A Workers plan with an SSR-appropriate CPU budget is an option only after explicit
approval for paid hosting; none was enabled. Other Free bounds: 100,000 Worker
requests/day, 50 subrequests/invocation and six simultaneous outgoing connections.
Render cold starts/reconnects remain availability constraints. No keepalive added.

## Conditional dashboard handoff — not deployment approval

Only use after resolving CPU suitability and receiving explicit deployment approval.
Do not connect automatic Git deployment now.

| Setting | Value |
| --- | --- |
| Product / name | Workers / ekavyu-dev |
| Plan | Free not recommended: actual SSR CPU exceeded its allowance; see platform results |
| Repo root / review branch | `/` / `main` (frontend is its own repository) |
| Build | `npm run build:vinext` |
| Deploy | `npm run deploy:vinext -- --skip-build` |
| Node | NODE_VERSION=24 |
| Dependencies | npm lockfile install including dev dependencies |
| Pages output directory | None; Worker tooling emits .cloudflare/output/v0 |
| Entry / date / flags | cloudflare/worker.ts / 2026-10-18 / nodejs_compat |
| Intended custom domain | dev.ekavyu.com; configure manually only after separate approval |
| Preview / auto-deployment | Keep disabled |

| Build variable | Value / handling |
| --- | --- |
| NEXT_PUBLIC_API_URL | https://dev.ekavyu.com/api |
| NEXT_PUBLIC_WS_URL | wss://dev.ekavyu.com |
| APP_URL | https://dev.ekavyu.com; also supply at runtime for canonical/robots metadata |
| BACKEND_INTERNAL_URL | Confirmed existing Render HTTPS ORIGIN, without /api or credentials |
| NODE_VERSION | 24, build only |
| CLOUDFLARE_ACCOUNT_ID | Actual account ID for deployment CLI |
| CLOUDFLARE_API_TOKEN | Authorized deployment secret; never NEXT_PUBLIC or committed |

BACKEND_INTERNAL_URL is emitted as a text Worker binding by source config.
APP_URL must also be supplied as a runtime variable before real smoke tests; runtime
canonical metadata was not validated here. Public values compile into browser code.
Do not set direct Render NEXT_PUBLIC_BACKEND_URL or Render NEXT_PUBLIC_WS_URL for
this target: browser sockets must use the frontend origin for host-only cookies.
Never add MongoDB URLs, backend JWT/session keys or payment secrets to the Worker.

Before approved deployment, verify read-only that the existing backend accepts
https://dev.ekavyu.com in CORS_ALLOWED_ORIGINS and its cookie Domain does not exclude
the frontend. If not, report that prerequisite rather than changing the live
backend or broadening cookie scope. The frontend cannot override a deliberate
backend Origin rejection.

Remaining manual checks after separate approval: deployed CPU/startup/peak-memory
metrics; runtime APP_URL/canonical metadata; native non-101 handshake responses;
browser cookie acceptance/login/logout/refresh; actual tenant/revocation behavior;
long-lived reconnects; mobile PWA install/update/offline recovery; synthetic
clinical workflows. Only then consider domain routing or automatic deployments.

## Official references

- [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [vinext Workers setup](https://vinext.dev/docs/deploying/cloudflare)
- [Documented custom vinext handler](https://vinext.dev/docs/guides/tracing)
- [Workers native WebSocket proxy response](https://developers.cloudflare.com/workers/runtime-apis/response/)
- [Current Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Build-image Node settings](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)

## Platform measurement record — 22 October 2026

**Verdict: FAIL for Free CPU suitability. Retain the existing Node hosting.**
Actual platform CPU for representative SSR routes exceeded the documented Free
10 ms per-request allowance. No framework optimization or application security
change was made. Workers Paid is a possible follow-up only with separate approval.

### Actual platform measurements

These are Cloudflare GraphQL `workersInvocationsAdaptive` CPU quantiles, converted
from microseconds to milliseconds. They are not local profiler sample counts or
client latency. Each primary route cohort contained six controlled requests,
separated from other routes by approximately a minute.

| Route / case | HTTP | CPU p50 ms | CPU p95 ms | Platform wall p50 ms |
| --- | ---: | ---: | ---: | ---: |
| `/login` | 200 | 24.173 | 91.950 | 25.171 |
| `/` | 200 | 25.125 | 99.211 | 29.767 |
| `/dashboard`, synthetic cookies, SSR shell | 200 | 50.175 | 214.102 | 52.133 |
| `/dashboard/appointments`, synthetic cookies, SSR shell | 200 | 22.985 | 105.718 | 23.787 |
| `/dashboard`, no cookies | 307 | 2.951 | 9.365 | 3.541 |

No resource-exceeded error or CPU-limit rejection was observed. All returned
platform invocation statuses were `success`; HTTP 404 diagnostics are separate
from runtime errors. Absence of rejection does not establish Free suitability:
Cloudflare documents CPU rollover tolerance, while all four SSR medians above
exceed 10 ms. This is an engineering suitability failure, not a claim that every
over-budget request was terminated. No paid subscription was present before or
after deployment. [Limits](https://developers.cloudflare.com/workers/platform/limits/),
[CPU, memory, sampling and rollover](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/).

- Cloudflare-reported frontend startup: **20 ms**; fixture: 2 ms. The documented
  startup limit is one second. These upload-time startup measurements are distinct
  from first-response latency or per-request CPU.
- Sampled aggregate V8 isolate memory p99: **41,474,640 bytes**, below the documented
  128 MB limit. This does not establish peak native memory or concurrent capacity.
- Aggregate CPU p50/p95/p99: 29.653 / 99.211 / 338.395 ms. This mixes route cohorts
  and first-use behavior; use the isolated route table for comparisons.
- The first observed client response took about 2.19 seconds including network
  latency. No guaranteed cold-isolate test was performed.
- **60 direct controlled requests:** 59 to the frontend and one to the fixture.
  The frontend additionally reported four outbound subrequests. Even counting
  those separately, traffic remained well below the approved 500-request ceiling.
  No browser hydration, recurring traffic or load generator was left running.

### Attribution and statistical limits

Live GraphQL schema introspection confirmed CPU/wall units as microseconds and
memory units as bytes. Cloudflare's HTTP Date was approximately 122–125 seconds
ahead of this machine's clock. The retained report records calibration bounds
and converts local request windows to platform time. Short initial windows can
overlap after clock uncertainty; they are not the primary per-route evidence.

GraphQL uses adaptive/reservoir sampling. The exact local ledger records six
requests per primary cohort. Platform analytics estimated 14 requests for the
appointments cohort (`avg.sampleInterval=2.8`), and 66 frontend requests overall
(`avg.sampleInterval=1.2`), versus 59 directly issued. Those estimates must not
be described as additional controlled traffic. Login, home and dashboard cohorts
each reported six requests with sample interval one. High quantiles from these
small cohorts do not establish population p95 or future worst-case behavior.
[GraphQL methodology](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/).

The measured build includes a staging-only URL/redirect/egress guard. Its CPU
overhead was not separately measured. The four primary SSR cohorts reported zero
subrequests, so their CPU values do not represent waiting for a backend. No
Cloudflare production profiler was used to assign exact framework/application CPU
percentages. Prior local profiles identified framework rendering/encoding work;
they remain a different type of evidence.

### Scope and remaining behavior checks

The fixture returned its synthetic doctor profile directly, but Worker-to-Worker
fetches returned Cloudflare's generic 404 before reaching the fixture. The first
route batch stopped at this unexpected response. This is consistent with the
documented same-zone Worker fetch restriction without a service binding or the
`global_fetch_strictly_public` flag. Neither workaround was introduced into the
application. Later measurement covered independent SSR shells and redirects only.
[Worker routing restriction](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[public fetch compatibility flag](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public).

Consequently, this experiment does **not** establish deployed doctor-profile SSR,
API cookie/CSRF forwarding, native WebSockets, backend session/tenant permissions,
browser login, PWA lifecycle or real Render integration. Dashboard cookies admitted
the existing SSR shell through `proxy.ts`; they did not create a real backend
session. Render, MongoDB and live credentials were never used. All 49 successful
HTML responses passed nonce uniqueness and script nonce assertions. Local staging
boundary checks passed denied-egress, redirect, native upgrade response identity,
HTTP/Set-Cookie response identity and synthetic fixture cookie/Origin cases.

### Build, files and isolation

Source: frontend `main`, commit `4c46e8013da6e629fb942a48e446024fd2cae84f`.
The isolated snapshot copied 413 tracked source/config/assets files, excluded
environment files and test fixtures, and reused installed dependencies. No new
dependency was installed. Its build environment explicitly supplied temporary
frontend/API/WebSocket/APP_URL and fixture upstream values; shell backend/public
variables and production secrets were not inherited.

- Production Cloudflare/Vite build: PASS. The inspected non-map bundle was
  5,716,321 bytes, within the current documented 64 MiB uncompressed limit.
  Asset count and maximum asset size checks passed. The actual uploader reported
  4,828.98 KiB / 1,070.75 KiB gzip and 298 newly uploaded assets.
- Artifact/config validation: PASS. Unique names, workers.dev only, preview URLs
  disabled, no domains/routes/cron/tail consumers, no cache, no remote data
  bindings, only ASSETS and expected text variables. Deployed settings matched.
- Built code/browser asset scan found no Render, Vercel or `ekavyu.com` URLs or
  MongoDB URLs. The staging fetch guard only allowed the fixed synthetic upstream;
  staging entry rejected a different frontend origin or external redirect.
- JavaScript syntax, changed-script ESLint, local isolation checks and
  `git diff --check`: PASS. No full suite, native Next build or application-wide
  type check was run: application runtime/config/dependencies were unchanged.
- `scripts/cloudflare-free-experiment.mjs`: operator-only preflight, clean snapshot,
  build/artifact review, bounded traffic ledger, metrics calibration and cleanup.
- `scripts/cloudflare-cpu-fixture.mjs`: synthetic read-only backend data, exact
  synthetic credential checks and Origin denials, no database or outbound fetch.
- This report and the two earlier Cloudflare reports record the resulting decision.

Frozen artifact/config/assets digest before deployment:

```text
frontend ee6a1f198d735a1200ffc95da4cb52347b48a4b19999fe2d2a8502bdb4f9de8d
fixture  77e4f7f40f85dcdaa1ba16d4a78228ec159db07216f6d39d9d3b6927add1f36d
```

Raw logs, request ledger, schema/unit proof, clock calibration, deployed settings,
frozen builds and successive platform reports remain locally under the ignored
`.cloudflare/free-experiment/` directory. Do not push these generated artifacts or
use their synthetic configuration to deploy `ekavyu-dev`.

### Cleanup and next action

The temporary frontend `ekavyu-cpu-20261022-6518bc` and companion
`ekavyu-cpu-20261022-6518bc-fixture` were both deleted successfully (HTTP 200).
At local UTC 2026-10-22 15:18:32, account inventory confirmed **zero Workers remain**.
The account's pre-existing workers.dev subdomain was preserved. No DNS/custom
domain, Git integration, paid service, Render, MongoDB or existing application
was changed. Nothing was committed or pushed.

Keep the existing Node hosting for now. Do not deploy `ekavyu-dev` or attach
`dev.ekavyu.com` on Free from the dashboard. If Cloudflare hosting is still desired,
approve a separate Workers Paid staging/integration check with a suitable CPU
budget; no paid service has been enabled by this experiment.

## Local profiler methodology and withdrawn comparison

Followed Cloudflare's DevTools Profiler workflow against the actual production-built
Worker in local workerd, using the equivalent Chrome DevTools Protocol Profiler
start/stop APIs. Vite preview supplies the workerd inspector; this is not next dev
or a Node approximation of the Worker. Raw .cpuprofile files can be opened in
DevTools. The installed build's source maps map sampled frames back to source.

The earlier report summed timeDeltas for samples other than idle/program and
called the result active-JS milliseconds. That is not a valid CPU measurement:
timeDeltas contain gaps when the isolate is not executing. A paired control with
the same authenticated-API fixture and an added 150 ms upstream delay increased
the median apparent duration from 5.436 to 163.892 ms. Median client wall time went
from 7.585 to 173.106 ms. The application did not acquire 150 ms of CPU work.
Some delayed profiles assigned that gap to a native fetch frame; others assigned
it to idle. Excluding only idle/program does not fix the problem.

**Withdraw the previous 17–20 ms versus 10 ms CPU comparison.** The new report uses
equal-weight non-idle/non-program sample counts to locate hotspots, not duration
sums as CPU. Configuring a 100 microsecond interval does not make ticks reliable
100 microsecond units: local scheduling and Windows timer granularity vary.
Neither sample counts nor client wall time can be compared to a billed CPU limit.

Two captures: three unmeasured warmup rounds, then ten requests per route per
capture, interleaved in the same route order. Both used the same production entry
SHA-256: b8692bb9ed02912bc206df1ae6b7327f2651f9fb1dd97c37dc62222f253f4e0d.
Node v24.7.0, workerd 1.20261012.1; one loopback synthetic upstream. No remote
bindings, live Render, MongoDB, production credentials or browser hydration.
