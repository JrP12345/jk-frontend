# Staging deployment readiness

2026-10-08. **Prepared for operator setup; deployment remains pending infrastructure and explicit approval.**

The agreed staging origin is **https://dev.ekavyu.com**; the final application will use **https://ekavyu.com** after testing and a separately approved apex cutover. Existing marketing hosting/DNS stays unchanged during staging. The full configuration, exact commands, private-key setup, initial account/MFA procedure, rollback and apex transition are in [the staging runbook](../../backend/deploy/STAGING.md).

## Prepared configuration

- [Staging Compose overlay](../../backend/deploy/docker-compose.staging.yml) reuses the production stack, gives staging its own project/network/persistent volumes and unique application-image tags, and rotates container logs. API, Redis and all four workers remain private.
- [Staging Caddy](../../backend/deploy/Caddyfile.staging) preserves direct /api/WebSocket routing, HTTPS and filtered edge logs, with deferred noindex headers for all staging responses.
- [Staging environment template](../../backend/deploy/.env.staging.example) supplies dev-origin values and leaves credentials blank so unconfigured startup fails closed. [Bootstrap template](../../backend/deploy/.env.bootstrap.example) is for one-time operator work only.
- [Frontend Dockerfile](../Dockerfile) and [production Compose](../../backend/deploy/docker-compose.production.yml) now give compiled rewrites and runtime SSR the same direct http://backend:5000 target. APP_URL remains matched at build/runtime; browser requests use https://dev.ekavyu.com/api.
- Compose now forwards the existing cookie settings: staging uses Secure, host-only, SameSite=Lax cookies. Defaults remain compatible for deployments not supplying overrides.
- Nested environment/private-key exclusions were added to both Docker contexts. The backend's tracked .gitIgnore was renamed to Linux-compatible .gitignore, and secret staging/bootstrap files are ignored while examples remain available.
- [Manual staging account tool](../../backend/deploy/provision-staging-root.mjs) supplies the otherwise missing fresh remote-database bootstrap. It never runs on startup or in the application runner. Preview does not connect; apply requires exact staging origin/database confirmation, production mode, replica-set connectivity and an empty DB. It creates one hashed root account; existing MFA enrollment remains a deliberate separate operator step. The existing local-only seeder was not weakened.
- [Frontend CI](../.github/workflows/ci.yml) now supplies explicit metadata/rewrite verification inputs. CI still uses placeholder public origins, retains existing gates/artifact names and does not deploy. Real staging images must be built for dev.ekavyu.com.

## Architecture

One dedicated Ubuntu/Debian VM hosts the existing Compose services; a separate Atlas/replica-set ekavyu_dev database supplies transactional persistence. A 2-vCPU/4-GB VM is a starting point when building on-host; actual load/resource use must be measured. Atlas Free can support small synthetic fixtures if its documented limits fit, including its lack of managed backups. Choose production database capacity/backups separately. [Atlas limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

No Kubernetes, separate public API domain, container registry, new runtime dependency or paid application service was introduced. No marketing file was changed.

## Verification

| Gate | Result |
| --- | --- |
| Merged Compose and isolated storage/project/network | PASS using synthetic values |
| Build/runtime origins, direct API routes and worker image/key consistency | PASS |
| API/all four worker startup configuration validation | PASS without connections |
| Secure host-only Lax cookie settings and secret/template Git exclusions | PASS |
| First-account provisioning | PASS: 11 focused tests, including temporary replica-set creation and refusal to alter existing records |
| Backend TypeScript, JS syntax, CI YAML, rewrite evaluation and diff checks | PASS |
| Existing index-preparation preview | PASS: schema preview only, no DB connection or writes |
| Docker image startup/Caddy parser on host | PENDING: local Docker daemon unavailable |
| Actual Atlas connectivity, TLS/DNS, health and deployed phone/cookie/payment/MFA flows | PENDING: no server/database yet |

No full suite or large build was repeated. The previous [104-test verification](discovery-release-verification.md) is separate evidence and does not certify deployed infrastructure. New local evidence is in %TEMP%\ekavyu-staging-preparation-20261008.

## Remaining operator actions

1. Approve/provision the VM and staging Atlas/replica set; restrict network/database access. Set dev DNS without changing the apex.
2. Configure persistent private secrets, a staging bucket and test-only payment/email credentials when those journeys are exercised. Obtain passing normal CI for the committed backend/frontend revisions.
3. Build the correctly configured application/operator images; validate Caddy. Explicitly authorize fresh DB index/account writes and encrypted MFA enrollment before public startup.
4. Start the staging stack, verify all container readiness, then finish real-phone authentication/booking/payment/resource/privacy checks. Retain previous images/config and private DB/secret backups for manual rollback.
5. After staging acceptance, approve the ekavyu.com release: choose the production data/backup plan, rebuild the frontend for the apex, update cookies/WebAuthn/webhook configuration, switch marketing DNS/hosting deliberately and use production Caddy without staging noindex. Passkeys tied to dev require re-enrollment on the apex.

**No cloud/DNS/deployment action, production-data mutation or credential change was executed.** Only local source/configuration and ephemeral test data changed. Git's case-only ignore-file rename is staged by git mv; no commit or push was made.
