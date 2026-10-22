# Cloudflare Free staging experiment — 22 October 2026

**Verdict: FAIL for Free CPU suitability. Retain the existing Node hosting.**
Actual platform CPU for representative SSR routes exceeded the documented Free
10 ms per-request allowance. No framework optimization or application security
change was made. Workers Paid is a possible follow-up only with separate approval.

## Actual platform measurements

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

## Attribution and statistical limits

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

## Scope and remaining behavior checks

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

## Build, files and isolation

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

## Cleanup and next action

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
