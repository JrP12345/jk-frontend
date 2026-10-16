# Ekavyu production readiness — 2026-10-16

**Decision: NO-GO for an immediate live release.** Repository hardening and the verified
P1 workflows pass the local checks below. Live security, recovery, provider and operator
acceptance evidence is still missing. This decision does not assert an unresolved high
severity defect in the tested paths, or certify the untested route/role combinations.

## Security closeout

The previous seven clinical authorization fixes were inspected and their 13 regressions
passed. Missing legacy grants now derive only owned active doctor/reception branches;
other unreviewed staff grants deny access. Staff assignments cannot adopt root/consumer
roles, and tenant administrators cannot change consumer permission presets.

Production staff use the existing TOTP mechanism with an explicit dated rollout option.
Enrollment requires recent primary authentication, encrypted session-bound pending setup
and a valid code; verification revokes prior sessions. HTTP and private sockets enforce
enrollment. Independent operator recovery revokes access and forces re-enrollment even
during the general grace period. Refresh rotation cannot manufacture recent-login proof.

Backend exception sinks, Pino serializers, telemetry and browser console logs were
minimized. Production 5xx envelopes suppress arbitrary exception details while retaining
an exact allowlist of safe recovery/idempotent-retry instructions. HTTPS origin, cookie
and proxy settings validate at startup. Production trusts no proxy unless configured;
Compose explicitly declares its one private Caddy hop.

Supplemental backup tooling validates a dedicated strong encryption key before export,
bounds authenticated decryption/decompression, creates private archives and finds the
latest remote archive across listing pages. Restore uses a random isolated database
and closes its connection. No backup or restore was run against an external database.

Additional confirmed findings were fixed: staff clinical search crossed tenant/branch
observation boundaries; reporting ignored branch grants and some reporting APIs lacked
a reporting permission; assignment lists exposed sibling branch staff details. Severity,
prerequisites and regressions are in [the security report](application-security-audit.md).

## Functional, engineering and mobile changes

- Fixed doctor consultation loading that depended on a forbidden staff-directory API,
  and family loaders that entered staff-only flows. Server search/filter/pagination now
  covers every consultation page; stale reads are cancelled and state resets on scope
  changes. Portal users get a real records destination without attempting encounter writes.
- Replaced the duplicate walk-in form/submission chain with the existing retry-safe
  patient-entry component. Kept booking/payment uncertainty visible and preserved visit
  identifiers rather than silently creating a replacement visit.
- Fixed partial payment receipts/outstanding balances in executive reports, excluded
  cancelled/refunded/deleted invoices, and preserved explicit ISO date endpoints.
- Dashboard charts use bounded 7/30-day scoped aggregates instead of the first list page.
  Family visits and partial debts load correctly; requests and contextual destinations
  follow effective permissions/modules. Failed reads offer retry instead of claiming all
  invoices are settled. Counts are not displayed as currency; currency groups remain
  separate in daily operational cards.
- Minimized the daily roster's projection and reused existing components, tokens, API
  client, guards and currency formatting. No dependency, service or infrastructure added.
- Compacted consultation counters and suppressed floating installation prompts during
  clinical work/MFA. Narrow patient-entry, consultation, dashboard and enrollment views
  were rendered from the production frontend using synthetic API fixtures.

## Coverage and evidence

[The coverage matrix](workflow-coverage.md) and [source inventory](feature-inventory.json)
record 53 pages, 462 literal HTTP routes, 93 models, twenty modules, eight worker/job entry
files and implemented roles. Enumeration is not proof of every feature's runtime behavior.
[The worklog](production-readiness-worklog.md) contains commands, findings and outcomes.

| Verification | Result |
| --- | --- |
| Core registration → booking/queue → consultation → diagnostics/pharmacy → billing/report/till journeys, scheduling, family/portal, workspace and tenant boundaries | 15 selected backend files / 92 passed |
| Reporting, clinical search, assignment and telemetry regressions | Four files / 15 passed; three assertions reproduced vulnerabilities before correction |
| Original clinical boundaries | 13 passed; existing role/configuration checks also passed |
| Staff MFA/grants/logging/archive/recent-login regression file | 14 passed; includes legacy hydration, refresh rotation and workspace-switch recency. Final security/workspace rerun: two files / 25 passed; auth regression file also passed |
| Further financial/RBAC/root-MFA/encryption/CRM/preauth/feedback/notification/provisioning selection | 56 cases across ten files passed across the initial selection and affected reruns; final CRM/root-MFA/security rerun: three files / 26 passed |
| Frontend changed workflows and direct consumers | All selected batches passed; overlapping batches are listed separately in worklog |
| Frontend production build / TypeScript | Passed with synthetic HTTPS API origins; no deployed backend contacted |
| Backend TypeScript / API + four worker bundles | Passed; final bundle/startup refresh recorded in worklog |
| Native-source and built API startup probes | Production config rejection, invalid Redis rejection, isolated replica-set readiness, duplicate port and SIGTERM passed |
| Production dependency audits | Both npm audits returned zero known advisories; no packages changed |
| Changed frontend lint / diff checks | Zero lint errors, 76 warnings; both diffs passed whitespace checks |
| Browser rendering | Ten production-frontend/synthetic-API checks; no horizontal overflow at tested widths. This is not provider/backend browser E2E |

Bounded fixture measurement: the same 100-visit populated daily response fell from
428,938 to 69,938 bytes; summary-only is 355 bytes and avoids the populated list query.
The new trend regression counts all 230 visits beyond list limits. Initial consultation
staff requests fell from four to two. These are code/fixture measurements, not production
latency, throughput or cloud-cost benchmarks. Full suites/release auditor were not run.

## Gates before changing the decision

1. Review actual legacy staff grants, including nurses/custom roles; assign deliberately
   reviewed branches before rollout. Communicate an MFA deadline and rehearse primary
   sign-in, enrollment, loss/recovery and membership changes with real authenticators.
2. Verify deployed HTTPS/certificates, firewall/origin protection, exact proxy topology,
   cookie domain/SameSite/Secure/HttpOnly, CORS/CSRF, WebSocket origins and cache headers.
3. Confirm Mongo TLS/ACLs/replica set and indexes, private R2/backup policies, upload
   quarantine/accepted-file risk, persistent encryption/signing/JWT keys and independent
   escrow. Review repository history and historical/external logs for secret/PHI exposure.
4. Perform an authorized real snapshot/PITR restore with keys, indexes, patient reads,
   audit integrity, booking/clinical/billing/file workflows and workers. Record RPO/RTO,
   recovery ownership and rollback evidence. Archive codec tests are not recovery proof.
5. Validate each deployed worker and alerts, and real provider sandbox callbacks,
   financial reconciliation/refunds, SMTP and WhatsApp consent/delivery. Do not enable
   unaccepted AI, ABDM, PACS, video or SSO integrations based on source inspection alone.
6. Complete hosted CI/release gates, representative capacity measurements and designated
   authenticated browser/device acceptance across the enabled role/module matrix.

P1 acceptance should use a reviewed clinic configuration and currency. Mixed-currency
historical/global executive reporting and long-record search capacity need explicit
deployment acceptance; daily cards separate currencies, but this task does not certify
every legacy/global reporting assumption. Existing lint debt remains. Optional integrations
and route/state combinations outside the focused checks are unverified, not assumed safe
or functional. No production data, credentials, infrastructure or deployment was changed.
