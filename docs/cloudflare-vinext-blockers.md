# Ekavyu Cloudflare migration validation

Original review: 2026-10-18. As of 2026-10-22, the migration changes are on
`main`; the temporary migration branch has been deleted.

Platform follow-up, 2026-10-22: the approved isolated Free experiment is complete.
**Free CPU suitability: FAIL.** Representative SSR medians were 23–50 ms versus
the documented 10 ms allowance. Both temporary Workers were deleted; the existing
application and domain were untouched. See [actual measurements, sampling limits
and remaining integration checks](cloudflare-free-staging-results.md).

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
not evidence of exceeding Free's CPU limit. See [the corrected CPU assessment](cloudflare-cpu-feasibility.md).
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
[cloudflare-cpu-feasibility.md](cloudflare-cpu-feasibility.md).

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
