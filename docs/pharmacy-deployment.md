# Pharmacy deployment handoff

Updated 22 October 2026. All feature tasks and local engineering gates are
complete: frontend 1,128 tests, backend 1,941 tests and all eight release-auditor
gates passed; both dependency audits report zero vulnerabilities. Builds, types,
lint, backend startup and synthetic Chrome checks passed. Use the
[release evidence](pharmacy-release-evidence.md) for the scope of those results.
This page does not authorize a live pharmacy launch. No deployment was performed;
the local Docker daemon is unavailable, so container and host checks remain part
of the steps below.

The subsequent shared form-control correction passed its scoped tests, types,
lint and local browser checks; see the latest follow-up in the release evidence.
The full-suite/build counts above describe the preceding baseline. Include the
correction in exact-revision CI and rebuild the actual deployment images.

## Deploy a staging installation

The existing target is **https://dev.ekavyu.com**, with native Next.js, the Node
API and four workers. Follow the executable steps in
[the staging runbook](../../backend/deploy/STAGING.md). The Cloudflare/vinext
experiment has its own validation and is not a prerequisite for this route.

1. Review and commit the frontend/backend revision pair, including the new
   pharmacy files and `frontend/packages/fast-glob`. Obtain passing CI for those
   exact revisions. Keep the previous images and configuration for rollback.
2. Prepare the private staging environment, dedicated replica-set database,
   Redis password, persistent encryption/signing keys and JWT pair, test email
   and test payment credentials. Set the real build-time origins; local builds
   using `example.invalid` must not be deployed as release images.
3. On a Docker host, validate the merged Compose and Caddy configuration, then
   build the two images with unique revision tags. The frontend dependency stage
   copies the checked local glob package before `npm ci`; do not omit it from a
   source archive or Docker context.
4. For an empty staging database, use the existing root provisioning and MFA
   procedure. Prepare current indexes with writes stopped, then run the
   [read-only readiness check](pharmacy-setup.md). No migration/backfill is
   required for hypothetical historical customers.
5. Start the API, all four workers, frontend, Redis and edge proxy. Check API
   liveness/readiness, worker health, HTTPS, host-only secure cookies and staging
   `noindex`. Follow the runbook's startup and rollback commands.
6. Configure a reviewed `location_products` catalogue through the root-only plan
   API. Set its actual INR product pricing, tax, resource limits and trial days;
   explicitly opt it into `selfServicePharmacy` only when it should appear in
   signup. See [commercial configuration](pharmacy-commercial-quotes.md) and
   [independent signup](pharmacy-independent-signup.md). An empty published
   catalogue intentionally leaves new signup unavailable.
7. With synthetic staging details, visit `/pharmacy-start`, verify delivery of
   the business OTP, finish setup, enroll an authenticator and select the staff
   workspace. Review the branch issuer/licence and pharmacy capability. Receive
   known ordinary stock, open a drawer, then issue and collect a first sale.
8. Reconcile stock, invoice, receipt and drawer. Exercise return/refund, closing,
   reports, permissions and recovery of an uncertain command. Check the existing
   clinic booking/clinical/payment journey as well. Keep real patient records
   and live provider credentials out of public demo testing.

## Before a live store uses it

Record named approval for the offer, operating licences/scope, tax documents,
privacy/retention, actual browsers/scanners/printers, configured provider/email
flows, isolated backup/key recovery, capacity and store reconciliation. The
required evidence and recovery procedure are in the release record. These need
the actual business and infrastructure; automated fixtures cannot approve them.

Record the deployed revisions and image tags, environment, date, engineering
artifact links, readiness result, opening baseline and incident owner. Keep
unsupported medicine categories and cross-issuer/interstate transfers blocked.
The separate apex cutover remains in the staging runbook; do not repoint the
existing marketing domain while preparing a staging installation.
