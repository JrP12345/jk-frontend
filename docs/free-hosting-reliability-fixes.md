# Free hosting reliability fixes

Implemented 2026-10-22 after approval of audit Batch 1. Risk level 4: session
authority and authentication transport. Changes remain uncommitted for review.
No deployment, push, DNS, Render settings, database or credential changes.

## Behavior changed

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

## Verification and execution time

- Nine focused frontend files: **109 tests passed**, Vitest duration **84.41 s**.
  This included authentication/RBAC, workspace isolation, public entry, dashboard
  recovery, OTP forms, API concurrency and payment replay/key preservation.
- Two additional auth boundary tests: **2 passed**, **2.77 s**. They verify the
  actual Axios refresh-outage-to-store path and invalidation of an in-flight auth
  read. Total: **111 distinct frontend tests passed**; no full suite run.
- Frontend `npx --no-install tsc --noEmit --incremental false`: passed.
- Changed frontend ESLint: no errors; three existing warnings in login/dashboard
  effects. `git diff --check` passed in both repositories.
- Backend `npm run check:fast` and `npm run build`: passed. Build verifies the API
  and four worker bundles. The first sandbox build could not overwrite existing
  generated files; the authorized local retry succeeded.
- Backend `npm run check:startup:source` and `npm run check:startup`: passed using
  isolated synthetic production configuration and a local disposable Mongo replica.
  They check configuration rejection, readiness, duplicate-port protection and
  graceful shutdown. No Atlas connection or live backend access.
- `node scripts/check-startup-traffic.mjs`: passed. Actual guard plus Fastify CORS
  and WebSocket plugins verify allowed/hostile Origin behavior, preflight, 503,
  Retry-After, probe allowlist, ready traffic and blocked-before-ready upgrades.
  This lightweight regression is also called by both existing startup check modes.

New/extended frontend regressions are in `src/tests/apiRecovery.test.ts`,
`authAndNavigation.test.tsx`, `locationNavigation.test.tsx`,
`patientLoginAndLoading.test.tsx` and `patientRegistrationControls.test.tsx`.

The shorter feedback loop comes from selecting affected tests and using synthetic
adapters/injection rather than real cold-start delays or Mongo-backed suites for
transport-only behavior. Test isolation, assertions, timeouts and complete CI
gates were not reduced. These durations cover different selections and are not a
before/after benchmark of the full suite.

To reproduce the relevant frontend selection:

```powershell
npm test -- src/tests/apiRecovery.test.ts src/tests/authAndNavigation.test.tsx src/tests/patientLoginAndLoading.test.tsx src/tests/patientRegistrationControls.test.tsx src/tests/locationNavigation.test.tsx src/tests/publicEntry.test.ts src/tests/workspaceVerification.test.tsx src/tests/workspaceIsolation.test.tsx src/tests/architecturePaymentRetry.test.ts
```

The two added auth cases are included in that command on the final tree. For a
subsequent isolated transport edit, start with its direct file/test-name filter;
expand to consumers whenever the actual changed behavior warrants it.

## Remaining limits and manual release steps

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
