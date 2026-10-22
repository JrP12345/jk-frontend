# Public-route console errors: diagnosis and local fixes

Reviewed 2026-10-22. Previous reliability changes and unrelated working files were
preserved. No push, deployment, DNS, Render settings, Atlas or credential changes.

## Confirmed findings

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

## Files changed in this follow-up

| File | Purpose |
| --- | --- |
| `src/app/layout.tsx` | Gives the existing nonce-bearing bootstrap script a stable ID. |
| `src/components/PublicBrandStyles.tsx` | Retains strict color validation and the SSR nonce; delegates the stylesheet to a small client component. |
| `src/components/PublicBrandStyleSheet.tsx` | Uses the bootstrap script's `.nonce` property for the active browser document, retaining the request nonce for SSR. No meta exposure, static nonce, CSP hash exception or unsafe-inline allowance. |
| `src/components/PublicProfileError.tsx` | Public profile recovery UI using the installed Next 16.4 `retry()` API. Shows only a validated error reference, never raw server messages. |
| `src/app/browse/[slug]/error.tsx`, `src/app/doctor/[slug]/error.tsx` | Keep profile rendering errors within their route segments and offer retry/browse actions. |
| `next.config.ts` | Redirects `/favicon.ico` to the existing PNG icon; existing output, headers, rewrites and runtime settings remain. |
| `src/tests/publicBrandStyles.test.tsx` | Verifies the active document nonce survives different navigation request nonces and branding updates; existing CSS-input tests remain. |
| `src/tests/publicProfileError.test.tsx` | Verifies both route recovery exports, retry invocation and protection against leaking server error text. |

## Verification

- 25 distinct focused tests passed across `publicBrandStyles`,
  `publicProfileError`, `cspRegression`, `publicDiscovery` and `pwaRecovery`.
  An incorrect Button import was caught by the first test/build pass and fixed;
  the affected tests and production build were rerun successfully.
- Changed-file ESLint and `git diff --check` passed.
- Native Next production build, including its package TypeScript check, passed.
  SSR routes remain dynamic. The test artifact is isolated at
  `.next/recovery-check` with synthetic URLs and a loopback upstream.
  Next's temporary additions to `tsconfig.json` were removed after validation.
  **Do not deploy this synthetic artifact.**
- Actual headless Chrome against that production build, using local synthetic
  fixtures and intercepted/blocked external browser requests, passed:
  fresh SSR branding/bootstrap nonce equality; real client navigation retaining
  the active document nonce; custom border color applied; zero stylesheet CSP
  violations; synthetic upstream 503 showing the route error UI; retry fetching
  again and recovering after the fixture became healthy; failed direct SSR
  retaining HTTP 500; missing profile retaining 404; favicon redirect 307.
  The sandboxed browser renderer initially timed out; the isolated authorized
  browser retry outside that sandbox passed. Browser, Next server and fixture
  processes were stopped afterward. The one-off browser fixture is ignored at
  `.cloudflare/recovery-browser-check.mjs`; it is not a permanent CI/E2E runner.

No backend source changed in this follow-up. The previous batch's backend startup
CORS fix remains uncommitted and must be included when reviewing that batch.
No full suite was run, and complete CI/release gates remain required before release.

## Deployment and remaining diagnosis

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
