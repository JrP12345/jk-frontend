# One focused Workers CPU feasibility pass

2026-10-18; branch `cloudflare/ekavyu-dev-vinext`. Recommendation: retain existing
Node hosting until isolated Cloudflare staging measurements establish Free CPU
headroom. Neither unavoidable framework CPU above 10 ms nor Free suitability has
been demonstrated. No runtime optimization was justified by the samples, so no
application, Worker, security or build configuration was changed in this pass.

## Method and a correction to the previous conclusion

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

## Before / confirmation capture

No runtime code changed between captures. Differences are sampling/JIT/GC noise,
not an optimization gain. The table reports medians over ten requests per route.

| Route | Before active ticks | Repeat active ticks | Before client wall ms | Repeat client wall ms |
| --- | ---: | ---: | ---: | ---: |
| /login | 16 | 13 | 21.99 | 20.04 |
| / (public home) | 22 | 17 | 22.56 | 20.75 |
| /doctor/synthetic-doctor | 13 | 11 | 25.22 | 24.83 |
| /dashboard, synthetic cookies | 18 | 15 | 21.12 | 19.99 |
| /dashboard/appointments, synthetic cookies | 16 | 17 | 21.80 | 20.92 |
| /dashboard, no cookies: 307 | 1 | 1 | 6.25 | 5.96 |
| /api/auth/me, synthetic fixture identity: 200 | 2 | 2 | 6.97 | 6.10 |
| /api/auth/me, no identity: 401 | 2 | 3 | 6.11 | 6.76 |

The protected pages are actual application SSR shells admitted by proxy.ts with
synthetic cookies. This does not impersonate a verified backend session or exercise
the hydrated dashboard. Their auth/data APIs execute in the backend, outside the
frontend Worker's CPU budget. The API fixture checks exact synthetic cookies;
it is a transport/profile fixture, not a replacement for Fastify authorization.
The doctor fixture is deliberately small and has no practice locations; larger
public profiles and hydrated authenticated response payloads remain staging cases.

## Where execution samples land

Across the five SSR routes in the repeat capture, 816 non-idle/non-program samples:

| Self-frame attribution | Samples | Share of samples |
| --- | ---: | ---: |
| Mapped vinext request/routing/rendering support | 164 | 20.1% |
| Dependency-only framework bundle, frame unmapped | 233 | 28.6% |
| Mapped React RSC client parsing | 55 | 6.7% |
| Native runtime / unmapped | 235 | 28.8% |
| Other dependencies, including UI support | 38 | 4.7% |
| Garbage collection | 71 | 8.7% |
| Mapped application components | 20 | 2.5% |

These are self-frame sample shares, not exact CPU percentages or exclusive
framework/application ownership of native work. Some generated frames lack source
mappings. A frame is marked dependency-only framework only when its source-map
manifest contains exclusively node_modules sources; otherwise it remains unknown.

Repeated hotspots: React SSR text encoding (the unmapped SSR function `z` calls
TextEncoder.encode), stream enqueue/encoding, React RSC parseModel/readChunk,
vinext cloneRequestWithHeaders and request contexts, configuration headers, and
native tracing/context/Request/Headers calls. The SSR bundle source manifest
contains only React/vinext/Vite RSC dependencies. Application samples are scattered
across UI primitives, providers, home sections, skeletons and page components.
No application function was a repeated dominant hotspot. One doctor capture had
a GC burst; it is retained rather than discarded as an outlier.

No supported, narrowly scoped optimization emerges from this evidence. Altering
framework internals, bypassing the request pipeline, disabling SSR or CSP nonces,
caching personalized HTML, or skipping authorization would violate the task.
Moving a few CSP string constants or changing class helpers would not address the
observed work and would be an unsubstantiated performance claim. Stop after this
one pass rather than make speculative edits.

## Files and checks for this pass

- Added `scripts/profile-cloudflare-cpu.mjs`: local-only fixture, inspector capture,
  source attribution, latency control, artifact hash and repeatable reports.
- Added this report and corrected the previous report's CPU claim.
- Raw evidence: `.cloudflare/cpu/before` and `.cloudflare/cpu/repeat`, gitignored.
  Each capture contains 80 representative request profiles; repeat also contains
  ten latency-control profiles. JSON reports include per-request results.
- Script syntax and changed-file lint checked. Both captures asserted status codes,
  dynamic profile content and login CSP presence.
- No new production build, package type check, full suite or security regression
  run was necessary: production code/config and the measured artifact did not
  change. The preceding scoped build/types/security evidence still applies.
- The local preview was stopped after measurement. All prior working changes
  remain on the same branch; nothing was pushed or deployed.

Reproduce using the existing report's loopback build/preview setup, then:

```powershell
node scripts/profile-cloudflare-cpu.mjs before
node scripts/profile-cloudflare-cpu.mjs repeat
# Re-map already captured profiles without sending Worker requests:
node scripts/profile-cloudflare-cpu.mjs before --analyze
```

The script refuses to profile an artifact whose configured upstream is not the
specified loopback fixture. Use a new label to preserve existing captures.

## Controlled Free staging measurement plan — requires approval

1. Approve a temporary, isolated `ekavyu-cpu-probe` Worker on a confirmed Free
   account, using workers.dev only. No route/domain/DNS, no production service
   binding, no Git integration, no auto-deployment, no scheduled/keepalive traffic.
   Preserve ekavyu-dev; use a separate reviewed source configuration so a name
   override cannot accidentally deploy the existing named Worker.
2. Use a temporary synthetic upstream fixture (an isolated companion Free Worker)
   with fixed read-only responses and controlled 0/150 ms delay, no access to
   Render/Atlas or real credentials. This is a measurement fixture, not a new
   application service. Keep JWT/session acceptance synthetic and explicitly
   labelled. Build public API/socket/APP_URL values for the probe origin and bind
   the fixture HTTPS origin. Supply APP_URL at runtime too. Retain SSR, CSP,
   middleware, static policies and native socket code unchanged.
3. Save artifact/config hashes, installed versions and exact fixture response
   sizes. Leave response caching disabled. Record first requests separately from
   warm ones. Test all eight cases above, then larger plausible public profiles
   and authenticated API payloads. A synthetic dashboard cookie tests its SSR
   shell only; it is not evidence of real session/tenant correctness.
4. Manually send bounded batches, e.g. 30 requests per case plus a small bounded
   concurrency-3 batch, with a hard ceiling of 500 frontend invocations and a
   30-minute session. Account for fixture subrequests/invocations too and check
   remaining daily Free quota before starting. No production load or recurring
   health traffic. Stop on resource-limit errors.
5. Read platform **CPU Time per execution**, wall time, memory and invocation
   outcomes in the probe Worker's Metrics. Use isolated time windows per route
   because Worker metrics aggregate routes; wait for metrics ingestion. Capture
   available quantiles/sample counts and mark missing data as inconclusive. CPU
   excludes upstream waiting; do not compare client/Profiler elapsed time to the
   10 ms Free allowance. Never log cookies, auth headers, tokens or patient data.
6. Acceptance target (engineering margin, not a Cloudflare guarantee): sustained
   p95 CPU at or below 7 ms where that quantile is available, no limit errors,
   startup and memory headroom, and identical security/SSR/PWA/socket outcomes.
   Small samples cannot establish future worst-case behavior. Do not rely on
   rollover tolerance to make a consistently over-budget application pass.
   If SSR CPU persistently exceeds 10 ms, stop optimizing and choose existing
   Node hosting; Workers Paid would require separate paid-service approval.
7. Real Render/browser/tenant validation remains a later, separately approved
   step using existing synthetic accounts and an already allowed origin. Do not
   change backend CORS, cookie scope, credentials or database records to make a
   staging hostname work. A fixture-only success does not clear live integration.
8. After recording results, remove only the approved temporary probe/fixture
   resources. Never modify ekavyu-dev or dev.ekavyu.com during this experiment.

No staging configuration/resource has been created or deployed in this pass.
Free is a candidate for this controlled measurement, not yet a deployment
recommendation. Keep the existing Node hosting path for the demo until measured.

## Official guidance used

- [Local CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/)
- [CPU versus wall time and platform metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)
- [Free CPU and other resource limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Production profiling](https://developers.cloudflare.com/workers/observability/profiling-in-production/)
