# Phase 1 security and cost pass — 2026-10-04

Completed local source/configuration pass. Evidence, page coverage and deployment contracts: [phase1-security-cost-audit.md](phase1-security-cost-audit.md).

Final source/configuration gate: [phase1-final-production-gate.md](phase1-final-production-gate.md).
Small deployment/SMTP/job/signing/provider timeout fixes are recorded there.
The subsequent authorized local [VAPT report](../../backend/docs/vapt-2026-10-04.md)
closed one manual-notification HTML/open-navigation P1 and found no unresolved
repository-side P0/P1.
No tests/builds/lint/type checks were run in that final pass or its dependency
closure. DEP-01 is now closed through a version-scoped replacement of the Next
ESLint plugin's glob dependency; full frontend/backend npm audits report zero
vulnerabilities. The source/configuration code gate is PASS; external deployment
requirements remain in the final report.

Read the healthcare ledger first; preserved existing local changes. Highest implementation risk: Level 4. The user's explicit restriction limited verification to static checks and small focused cases. No deployment, live provider/data action, seed, migration, full suite, browser E2E, build or load test. **Stop here; Phase 1 Production Deployment is a separate milestone.**

## Confirmed work

| ID / priority | Problem → impact → smallest correct fix | Status |
| --- | --- | --- |
| AUTH1 / P0 | Sessionless issuers and Google/SSO bypass shared MFA → revocation/MFA gaps → bind existing issuers and reuse verified-login policy | Fixed locally |
| AUTH2 / P0 | Positive session caches outlive revocation → stale authority → indexed persisted session/user authority, retained revocation broadcasts | Fixed locally; one DB read per authenticated request |
| AUTH3 / P0 | Identity binding/reusable SSO assertions → identity/replay risk → Google JWKS/claims/stable subject; signed SSO audience, short validity and one-use nonce | Fixed locally; integration contracts changed |
| AUTH4 / P0 | Guest account access, secondary OTP identity, client-selected/expired MFA secret → account authority gaps → guest opt-in, verified-channel identity, one-use server setup proof | Fixed locally |
| AUTH5 / P1 | Global auth grants and secret-bearing serialization → inconsistent UX authority/secret exposure → effective tenant grants and omitted secret fields | Fixed locally |
| WS1 / P0 | Private connections survive revocation → clinical events after authority changes → session/origin/expiry/grant checks and private transport closers | Fixed locally |
| DATA1 / P0 | Clinical search/report lack ownership guards → IDOR → patient and operational authority before service execution | Fixed locally |
| DATA2 / P1 | Generic export grant and CSV formulas → inappropriate export/spreadsheet injection → report-specific grants and neutralized cells | Fixed locally |
| FILE1 / P1 | Unbounded storage buffering → memory exhaustion → metadata/stream byte and time bounds, declared-size/MIME/class checks | Fixed locally; real R2 enforcement unverified |
| FILE2 / P0 | Unbound registration/download and writable verified key → foreign/unverified files → patient/tenant/uploader intent, server-only copy, canonical metadata, one-use transactional registration | Fixed locally; legacy intent maintenance required |
| FILE3 / P1 | Failed lab upload becomes data URL and success → verification bypass/large DB values → visible failure; new attachment must match verified patient/tenant upload | Fixed locally; historical attachments retained |
| RATE1 / P1 | Tenant limiter runs before authentication → inactive budget → invoke after authentication without tightening hospital budgets | Fixed locally |
| CFG1 / P1 | Production CSRF trusts forwarded host → attacker-controlled authority → explicit configured production origins | Fixed locally |
| LOG1 / P1 | Query logs/referrers and APM spans retain private values; dedupe grows forever → exposure/memory growth → route shapes, origins, minimized error/transaction events and bounded dedupe | Fixed locally; redaction is not PHI certification |
| UI1 / P1 | Active print HTML/raw title metadata → script/markup injection → sandbox, active-content removal and escaped metadata | Fixed locally; native browser print unverified |
| PERF1 / P1 | Unused lab clinic/staff reads and keystroke searches → redundant requests → remove unused reads, reuse workspace state, debounce/cancel | Fixed locally |
| PERF2 / P1 | TV polls with live socket/reconnects per token → repeated snapshots/connections → announcement ref, coalescing, visible socket-aware polling and scope abort | Fixed locally; freshness retained |
| QUERY1 / P1 | Quality metrics materialize all historical documents → memory/network growth → two scoped counter aggregations | Fixed locally; counters/empty state checked |
| QUERY2 / P1 | Patient search scans global users/materializes IDs → cross-tenant work/large arrays → tenant patients before narrow user join and count/items facet | Fixed locally; latency not measured |
| INPUT1 / P1 | Raw regex/prototype/deep keys → query abuse → bounded literal regex and null-prototype/depth sanitization | Fixed locally |

## Deployment requirements

- Retire historical signing credential; verify runtime secrets, explicit HTTPS origins/proxy trust and origin firewalling.
- Coordinate session, Google/SSO and upload contracts; verify identity/nonce indexes, transaction-capable MongoDB and completed-intent TTL maintenance.
- Verify private R2, CORS, signed length/type, staging cleanup and clinical file inspection policy. Signature/pattern scanning is not antivirus/CDR.
- DEP-01 closed: `braces`/`micromatch` removed from the frontend lockfile; full dependency audits pass. Preserve the scoped replacement and its rootDir/upgrade limits documented in the final gate report.
- Next separate milestone: clean CI/build/release gates, authenticated browser journeys, provider test mode, deployed workers/restart behavior and backup/rotation evidence. Earlier release snapshots predate these edits.

## P2 intentionally deferred

Retained-history/concurrent workloads; ROOT history index candidate; clinical history ranking/selectors at measured payloads; traffic unique-count memory; connection-pool sizing across API/workers. No blanket caching, new infrastructure, speculative indexes or silent result truncation.

## Reused evidence

[Healthcare loops A–H](healthcare-product-ledger.md), [scale baseline](healthcare-scale-measurements.md), [release/dependency snapshot](healthcare-release-verification.md). Post-H billing order retry correction retained. This pass is not whole-application production certification.
