# Healthcare local release checkpoint - 2026-10-04

This continues ledger NEXT #3 after the refund reconciliation and workload measurement loops. It records local evidence, not deployment approval. Existing local changes in both repositories were preserved. No configured database, live payment provider, patient notification recipient, seed, migration or backup restore was used.

Environment: Windows, Node 24.7.0, installed Next 16.3.8, Vitest 5.0.3 and TypeScript 5.9.3. Workload fixtures used MongoDB 8.2.6 with one disposable replica-set node. Gates used the existing installed dependencies; a clean hosted-CI install remains a release-environment check.

## Required local gates

| Repository / gate | Result | Evidence / scope |
| --- | --- | --- |
| Frontend `npm test -- --reporter=dot` | PASS | 63 files, 398 tests; 293.10 seconds. File isolation is enabled. |
| Frontend `npm run lint` | PASS with warnings | Zero errors, 288 existing warnings. Changed release-fixture/config files also lint cleanly. |
| Frontend TypeScript | PASS | `node node_modules/typescript/bin/tsc --noEmit --incremental false`; test files are excluded by the app tsconfig, so this is not test-file type coverage. |
| Frontend `npm run build` | PASS | Next production compilation, route output and build-time type checks. API/rewrite URLs pointed to an unused local port to avoid configured services. |
| Frontend `npm run check:payments` | PASS | Existing checkout boundary check retained. |
| Frontend `npm audit --audit-level=high --json` | BLOCKED | One unpatched high-severity `braces` advisory is reported through five affected development-tool packages; see below. |
| Frontend `npm audit --omit=dev --audit-level=high --json` | PASS, supplemental | Zero runtime dependency vulnerabilities reported. This does not replace the full audit gate. |
| Backend `npm audit --audit-level=high --json` | PASS | Zero vulnerabilities reported. |
| Backend `npm run check:build-install` | PASS | Existing install behavior check. |
| Backend `npm run build` | PASS | API plus notification, disruption timeout, outbound message, domain event and no-show workers bundle successfully. |
| Backend `npm run check:startup` | PASS | Five probes against the built API and a disposable MongoDB replica set: config rejection before DB connection, Redis placeholder rejection, readiness/liveness 200, duplicate process exits before bootstrap, SIGTERM releases the port. |
| Backend `npm run audit:release` | PASS | Final complete run: 8/8 checks, 143 test files and 806/806 tests, zero TypeScript errors. Manifest timestamp identifies the run start: `2026-10-04T11:57:22.495Z`. |

The backend manifest's approval covers its eight local checks. Deployment remains blocked by the frontend dependency audit and the external requirements below.

The first complete frontend run exposed cross-file mock leakage and outdated fixtures from the earlier permission, QueryClient and shared-button changes. `vitest.config.mts` now enables file isolation; fixtures supply effective grants, appointment links, QueryClient context and the auth-store snapshot contract. Theme tests collect all root token blocks. The printing regression verifies retained original content and one loading indicator. Permission denial, contrast thresholds, foreign-currency checkout restrictions and repeated-click assertions remain in place. No cases were skipped or removed to obtain the passing result. Existing React `act` warnings remain visible.

The initial backend run exposed fixtures expecting unlinked doctor access, an override assignment without its required organization, arbitrary ROOT subscription fallback and anonymous recovery of a private tracker link. The corrected fixtures preserve tenant authorization and duplicate-walk-in privacy, seed a real eligible clinic before testing patient IDOR, and verify no extra appointment was created. The checkout security test now checks the hosted gateway and signed server-verification boundary instead of requiring a `PCI-DSS` comment. All six affected files pass (31 cases); no production permission rule was changed to accommodate them. Existing deprecation and test teardown notification warnings remain visible.

The second backend run crossed the clinic's afternoon cutoff: same-day online fixtures in `clinicEssentialsCycle3` and `queueOperationsAndDelay` began returning the correct capacity rejection. These two files now pin only Date to a clinic morning, leave Mongo/network timers real and restore the clock afterwards. Their ten cases pass, including payment IDOR and disruption fee reconciliation. Production opening hours, queue capacity and safety buffers were not changed.

The next run reproduced the same clock assumption in `disruptionService`, now also pinned to a clinic morning, and a real concurrent pacing race. `triggerTurnApproachingPacing` now uses the configured clinic day and atomically claims a waiting visit before persisting notification intents in the existing clinical transaction. The turn notification helper awaits the existing communication outbox, uses a stable domain-event ID and propagates enqueue errors for rollback. No provider call occurs in that transaction.

The new replica-set rollback case exposed an existing shared outbox defect: explicitly setting `session: undefined` opted out of Mongoose's inherited transaction context. `DomainEventOutboxService` now omits that option when no explicit session is supplied, including duplicate lookup. Queue concurrency/replay, two-intent rollback/retry and clinic-midnight tests pass (3). Existing refund integrity (35) and domain-event outbox tests (6) pass with the fix; an added refund case confirms financial/audit rollback on outbox failure and successful later reconciliation (1). Adjacent billing/replay checks pass 17 cases. API and five workers were rebuilt successfully after the correction; TypeScript passes.

The complete run after that correction reported one failing case in `postConsultationFeeWorkflow`: its walk-in setup was past the clinic's 17:00 close, so it correctly returned capacity conflict before reaching the cash-settlement assertions. A focused reproduction records that response in the assertion. The fixture now pins only Date to a clinic morning and restores it afterwards; all five cases pass. The final complete backend gate passes all 806 tests, including the 36-case refund/disruption integrity suite and the three new queue-pacing integrity cases. No cases were skipped or removed to obtain this result.

## Security gate that remains blocked

The installed development dependency chain is `eslint-config-next` -> `@next/eslint-plugin-next` -> `fast-glob` -> `micromatch` -> `braces@3.0.3`. The [reviewed upstream advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects versions through 3.0.3 and lists no patched version at this checkpoint. The vulnerability is stack-exhaustion denial of service from deeply nested patterns.

The five high-severity package entries are propagation of this one advisory, not five independent flaws. The runtime-only audit passes, but the required full audit remains failed. npm's suggested major downgrade to `eslint-config-next@14.2.35` is not an appropriate automatic fix for the installed Next 16 toolchain. No downgrade, advisory suppression, audit threshold change or dependency override was applied. Recheck the upstream fix before a release; any accepted exception belongs to the release owner's documented decision.

## External release checks still required

| Check | Current limit / required evidence |
| --- | --- |
| Authenticated browser journeys | No installed tracked browser E2E runner or callable browser tool. Exercise login/MFA, booking, reception arrival, consultation, invoicing/payment, refund review and organization switching in a designated test environment. Vitest consumer tests are not browser certification. |
| Razorpay test mode | Local provider evidence is mocked, including pending, processed, failed, mismatched and ambiguous outcomes. Verify signed callbacks, captures, processed/pending refunds and a lost-response recovery with explicit test credentials and synthetic records. |
| MongoDB deployment | Local integrity tests use real disposable replica-set transactions. Confirm the actual deployment supports transactions and required indexes; no production migration was run. |
| Worker/deployment health | All five workers build and their affected local tests run. Confirm deployed worker claims, outbox delivery, retry/dead-letter behavior and restart recovery with test recipients. API startup probes do not certify deployed worker operation. |
| Backup/restore and key rotation | No restore/rotation procedure was run against configured infrastructure. Use an authorized disposable restore target, verify recoverability and document operational ownership. |
| Hosted CI and deployment | Checks ran locally on the existing dependency tree. No hosted CI run, merge, staging deployment or production deployment was performed. |

The user selected agent judgment for environment choice. That permits isolated local fixtures; it does not identify a staging URL, test-mode provider account or disposable backup target. Preserve the evidence above and complete external checks when the release environment is designated.

Related records: [product ledger](healthcare-product-ledger.md), [workload measurements](healthcare-scale-measurements.md), and `backend/docs/refund-reconciliation.md`.

## Post-checkpoint subscription lookup correction

The user subsequently reported recurring Razorpay order 404 logs. The subscription job now excludes explicit local simulation references and defers 404 lookup failures for one day without changing financial status. Successful explicit/provider reconciliation clears the scheduling issue. Focused job, subscription billing and HTTP regressions pass 27 cases; backend TypeScript and API/five-worker build pass. `backend/docs/billing-reconciliation.md` records the cause and operational limits. The 806-case full-suite snapshot above predates this correction; the full gate was not repeated for this scoped bug fix. Release blockers remain as recorded above.
