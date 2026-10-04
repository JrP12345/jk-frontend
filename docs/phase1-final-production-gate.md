# Phase 1 final production code gate — 2026-10-04

## Code readiness

**Ready to enter Phase 1 deployment.** DEP-01 is closed: the vulnerable frontend
development dependency chain has been removed and both repositories' full
dependency audits pass with zero reported vulnerabilities. No known repository-side
P0/P1 remains based on the completed audits, existing test evidence and this
source/configuration review. This is not deployed certification.

Read first: [security/cost ledger](phase1-security-cost-ledger.md),
[healthcare ledger](healthcare-product-ledger.md),
[release evidence](healthcare-release-verification.md), and backend
[readiness](../../backend/docs/production-readiness-tracker.md),
[deployment](../../backend/DEPLOYMENT.md),
[recovery](../../backend/DISASTER_RECOVERY.md).

No tests, browser checks, builds, lint/type checks, load tests, migrations,
provider transactions, messages or infrastructure changes were performed in this
final review or its dependency closure. The initial review used source/dependency/
caller tracing and whitespace inspection. The closure additionally installed the
targeted dependency replacement with lifecycle scripts disabled, ran full npm
dependency audits, inspected the installed tree and validated lockfile acceptance
with an npm ci dry run. This is a Level 5 checkpoint; the user's explicit no-test
restriction applies to local verification. Earlier 398 frontend/806 backend
full-suite evidence predates the security/cost pass and these final fixes; the
ledgers retain subsequent focused evidence. Do not relabel it as a current full run.

## P0 blockers

**None known remaining in repository source.** Historical signing-key retirement
and production credentials/network rules remain deployment obligations.

## P1 blockers

**None known remaining in repository source.**

### DEP-01 closure — 2026-10-04

The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) still has
no patched release. The remediation removes the affected chain rather than
accepting an exception: a version-scoped npm override replaces only
`@next/eslint-plugin-next@16.3.8`'s `fast-glob` dependency with the published
`tinyglobby@0.2.17` package. The lockfile no longer contains `braces` or
`micromatch`. Existing application dependencies, Next/React versions, lint rules
and the full high/critical audit gate are retained.

Compatibility was traced in the installed plugin: its sole `fast-glob` import is
`dist/utils/get-root-dirs.js`, using CommonJS `globSync(pattern,
{ onlyDirectories: true })` only when `settings.next.rootDir` is configured.
This standalone repository does not configure that setting, so it continues to
use `context.cwd`. The replacement exports CommonJS `globSync` and supports
`onlyDirectories`. [npm documents dependency replacement through overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides);
[tinyglobby documents its glob API and migration options](https://superchupu.dev/tinyglobby/documentation).

This is a repository-owned dependency substitution, not an upstream Next fix or
a general fast-glob replacement. Revisit it if introducing `settings.next.rootDir`:
tinyglobby defaults to `expandDirectories: true`, whereas fast-glob does not expand
literal directories recursively. Review any such configuration change before use.
The exact plugin-version scope avoids silently applying the substitution to future
plugin releases. Remove it once an audited upstream toolchain no longer needs the
affected chain; keep the normal CI gates for upgrades.

Closure evidence (Windows, Node 24.7.0, npm 11.1.0):

| Check | Result |
| --- | --- |
| `npm install --ignore-scripts --no-audit --no-fund` (frontend) | PASS; 3 replacement packages added, 16 obsolete packages removed |
| `npm ls @next/eslint-plugin-next fast-glob tinyglobby` | PASS; plugin resolves `fast-glob@npm:tinyglobby@0.2.17` |
| Frontend `npm audit --audit-level=high --json` | PASS; zero vulnerabilities, including development dependencies |
| Backend `npm audit --audit-level=high --json` | PASS; zero vulnerabilities, including development dependencies |
| Frontend `npm ci --dry-run --ignore-scripts --no-audit --no-fund` | PASS; lockfile accepted, no clean install or lifecycle scripts executed |

Existing test evidence was reused; these results do not claim a fresh lint,
test, build or hosted-CI run. Deployment must still use the normal hosted release
gates and production environment values below.

Small confirmed P1 fixes completed in this review:

| Finding | Small fix and inspected boundary |
| --- | --- |
| Native Next builds could accept missing/local/insecure browser API URLs despite Docker's guard | Reuse the existing URL guard in `next.config.ts`; require HTTPS, reject credentials/query/fragment and loopback. Optional public backend URL follows it. CI uses a non-routable HTTPS fixture; it is not a launch artifact. Installed Next environment/rewrite guides were read. |
| Production Compose reused a development hostname and shell-style Caddy environment syntax | Caddy uses its documented environment syntax and requires `CADDY_SITE_ADDRESS`/`ACME_EMAIL` from production Compose. Development defaults stay confined to development Compose. |
| Edge logs retained tracker/identity query proofs and headers | Caddy filter omits request URI, request headers and response headers; JSON status/duration logging remains. Config traced against [Caddy environment](https://caddyserver.com/docs/caddyfile/concepts#environment-variables) and [logging](https://caddyserver.com/docs/caddyfile/directives/log#filter) documentation. |
| Billing reconciliation and branding cleanup had no standalone process owner | Existing outbound worker starts/stops both existing lease-protected jobs after DB connection. Five-/ten-minute schedules, bounded reconciliation selection, provider 404 deferral and financial authority remain unchanged. |
| SMTP accepted invalid certificates, allowed plaintext fallback and logged recipient addresses | Both platform/tenant transports verify certificates and require STARTTLS when not using direct TLS in production; connection/greeting/socket waits are bounded. Delivery logs retain a bounded error code without recipient/raw provider errors. Existing boolean failure propagation/outbox retries remain. See [Nodemailer SMTP](https://nodemailer.com/smtp). |
| Payment-link provider call had no deadline and exposed raw provider response errors | One 10-second request, redirects rejected, generic production error and categorical log. No automatic retry of link creation was added. Payment/refund settlement logic unchanged. |
| Prescription integrity could use a public constant in production | Startup and signing reject missing/short/known fallback keys in production. Explicit `PRESCRIPTION_SIGNING_KEY` or strong legacy `JWT_SECRET` preserves the configured historical signing contract. Compose carries the key; existing startup/config fixtures were aligned without running them. |

## Deployment actions

Actual hosting/DNS/Atlas/provider settings were not accessible. Do not mistake a
repository configuration for an applied production setting.

1. **Domains and build:** documentation names `ekavyu.com` as future production;
   the actual frontend/API hosts still need an operator decision. Define `F` as
   the HTTPS frontend origin and `A` as the reachable HTTPS API origin. Set
   `APP_URL=F`, `FRONTEND_URL=F`, `PUBLIC_API_BASE_URL=A`,
   `CORS_ALLOWED_ORIGINS=F` (only explicit authorized HTTPS origins), and build
   frontend with `NEXT_PUBLIC_API_URL=A/api`. A Caddy deployment may use the same
   origin for both: `/api/*` and native WebSocket endpoints reach backend directly.
   A split deployment uses an API subdomain with direct WSS connectivity. Configure
   DNS A/AAAA/CNAME to the selected hosts, TLS renewal, HTTP redirects and frontend
   HSTS at the edge. Production Compose needs the frontend hostname in
   `CADDY_SITE_ADDRESS` and `ACME_EMAIL`. Development env examples are not production
   values. Optional `NEXT_PUBLIC_WS_URL` must be `wss://` to the backend; leave it
   unset to derive from the API. A server-only `BACKEND_INTERNAL_URL` may use the
   private backend address; never point a Next rewrite back at itself.
2. **Processes/order:** use Node 24; backend install/build is
   `npm ci --include=dev` then `npm run build`, API start `npm start`. Frontend
   install/build is `npm ci` then `npm run build`; use `npm start` for a native
   Next deployment or `node server.js` in the existing standalone image. Browser
   URLs and rewrites are build-time settings. Retain existing hosted CI gates;
   CI fixture builds must not be promoted as production-configured bundles.
   Provision network/DB/secrets first, take a recoverable backup and apply only
   reviewed necessary index/data maintenance, then deploy API, all five workers,
   frontend and traffic. Use `RUN_INLINE_JOBS=false` with standalone workers.
   Render Blueprint defines only the API; worker services require separate setup.
3. **Secrets/auth/network:** provide persistent RS256 keys and data-encryption
   key to every API/worker. Supply a random persistent prescription signing key
   (at least 32 characters); preserve an actual strong legacy key if sealed
   records exist. Records sealed with the former public default require an
   explicit historical-integrity decision; do not silently re-sign them. Retire
   historically exposed signing/provider credentials and purge relevant old
   caches using existing runbooks. For same-origin deployment leave
   `COOKIE_DOMAIN` unset and set `COOKIE_SAME_SITE=lax`; for frontend/API
   subdomains explicitly choose cookie scope and SameSite. Tokens remain Secure/
   HttpOnly; the readable session indicator is UX only. Set exact trusted proxy
   hops/CIDRs for the actual ingress and firewall direct origin access. If an
   origin verification token is enabled, configure ingress and private health
   probes consistently. Required Redis must be authenticated/private; the explicit
   single-node override is for one API instance only.
4. **MongoDB/storage:** separate production DB/credentials from development;
   require TLS, restricted network access and a least-privileged application DB
   user, with separate maintenance credentials. Use a transaction-capable replica
   set/Atlas topology; do not use the standalone production override. Confirm
   actual booking/active-consultation/outbox/delivery/lease/identity indexes and
   SSO nonce TTL; proposed performance indexes are not mandatory migrations.
   Preserve completed legacy UploadIntents by removing their obsolete TTL field
   through reviewed maintenance before expiry; unfinished intents still expire.
   No DB mutation was performed. API plus five workers each default to pool
   min 10/max 50: budget 60 minimum/300 maximum pooled connections plus driver
   monitoring overhead. `MIN_POOL_SIZE=0` currently falls back. Size against the
   chosen tier. R2 must be private, least-privileged and CORS-limited to `F`; verify
   signed size/type, canonical verification/registration and staging-only cleanup.
   Keep verified clinical keys outside orphan cleanup; agree file inspection policy.
5. **Providers:** Razorpay production account/live credentials and raw-body
   webhook secrets; register `A/api/billing/webhook`, `A/api/webhooks/upi` only for
   the actual supported sender, and Meta `A/api/webhooks/whatsapp` with app secret,
   verify token, subscriptions and approved templates. Dynamic platform/tenant
   provider settings can override env; check their mode/account too. Configure
   platform or tenant SMTP with a valid certificate, 465 direct TLS or 587
   STARTTLS, verified sender and SPF/DKIM/DMARC. SMS has no live provider adapter;
   use configured WhatsApp/email channels rather than promising SMS delivery.
   Google needs backend client ID/secret and the actual redirect URI sent by the
   current login flow authorized at Google. Passkeys need `WEBAUTHN_ORIGIN=F`
   and `WEBAUTHN_RP_ID` equal to its hostname. Optional SSO needs an HTTPS bridge,
   callback `A/api/auth/sso/callback`, strong callback secret, explicit audience,
   short signed assertions and one-use nonce. Optional AI keys/models, private
   Orthanc/Jitsi endpoints are per enabled module; ABDM enrollment remains blocked
   in production. Keep test/live credentials, DBs and recipients separate.
6. **Monitoring/recovery:** alert on `/api/health/readiness`, liveness, each
   worker `/ready` (5001–5005 on private networking), process exits, queue age,
   retries/dead letters, webhook failures and outstanding payment/refund reviews.
   Configure existing `SENTRY_DSN`/`OPS_ALERT_WEBHOOK_URL` or equivalent external
   log alerts; readiness does not prove job progress. Exclude tracker/clinical
   values from hosting/CDN logs and analytics too; no caching private APIs,
   trackers or authenticated clinical pages. Set DB backup/PITR schedule,
   retention, off-site/immutable storage, `BACKUP_ENCRYPTION_KEY`, heartbeat alert
   and separately escrow current/historical encryption/signing keys. Assign
   recovery owner and RPO/RTO and retain an isolated restore report using the
   existing runbook. Keep immutable previous API/frontend/worker images and
   configs for coordinated rollback; do not reverse data/index changes blindly.
   On worker recovery allow durable claims to expire, inspect uncertain provider
   outcomes and reconcile evidence before replaying; never blindly repeat refunds.

## P2 after launch

Use retained-history/concurrent deployment measurements to decide ROOT/history
indexes, selector pagination and clinical ranking work already deferred in the
ledgers. Measure idle worker polling and total connection/provider concurrency
before tuning cost. Add tracked browser journeys when the release environment is
available; existing mocked/consumer evidence is not live browser certification.

## Final decision

**PHASE 1 PRODUCTION CODE GATE: PASS**

DEP-01 is closed and no known repository-side P0/P1 remains within this review's
scope. Continue with Phase 1 deployment and controlled launch using the actions
above. Hosting/DNS, runtime secrets, production MongoDB/storage, provider setup,
deployed workers, monitoring and backup/rollback evidence remain external launch
requirements. This pass does not certify that those settings have been applied
and does not authorize a new broad audit cycle.
