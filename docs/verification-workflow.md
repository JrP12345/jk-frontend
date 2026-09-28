# Risk-based verification workflow

This audit covers the standalone frontend and sibling backend checkouts as inspected on 2026-09-28. It changes **when** checks run during AI development, not what CI/release must pass. Production application behavior, tests, and CI gates are unchanged.

## A. Current bottlenecks

| Command or process | Current use | Cost and cause | Every edit? |
| --- | --- | --- | --- |
| Frontend changed-file `npx eslint src/path/file.tsx` | Available, but broad `npm run lint` is often used instead | Usually seconds; parses only requested files | Yes for changed code when lint can catch an error |
| Frontend `npm run lint` | CI and frequently local | Whole repository, including unrelated pages; historical warnings add output | No; CI/release |
| Frontend `npx tsc --noEmit` | CI and often local | Whole app type graph; `src/tests` is excluded by `tsconfig.json` | No for styling; yes for changed types/shared contracts |
| Frontend `npm test` | CI and often local | All 25 files/189 tests took about 22 seconds in a warm local run; test transforms/jsdom recur | No; target affected files locally |
| Frontend `npm run build` | CI and often local | Next production compile, TypeScript, page-data collection and 41 route outputs; a recent local run took roughly a minute | No; config, routing, environment, dependency or release changes warrant it |
| Backend `npm test` | Called by release auditor in CI; sometimes local | 127 test files (over 600 tests in recent recorded runs), serial by `vitest.config.ts`; `tests/setup.ts` starts/stops a MongoDB memory server per file; first run may fetch its test binary | No; select affected integration files |
| Backend `npm run check:fast` | Available locally; release auditor separately invokes TypeScript | Full backend TypeScript graph, including tests and scripts; cost depends on incremental cache | No for docs; yes for changed contracts or backend logic where compiler errors matter |
| Backend `npm run build` | CI/release, sometimes local | esbuild API plus five workers; recorded isolated build 0.57 seconds (not install/startup time) | Useful for entry/bundling changes; no need after each test-only edit |
| Backend `npm run audit:release` | CI/release | Runs full TypeScript and serial full Vitest again, scans fitness rules, writes manifest/history | Never routine local development |
| `npm ci`, `npm audit --audit-level=high` | CI; install/audit sometimes local | Install and network-bound vulnerability lookup; Mongo postinstall download is disabled, runtime test download remains possible | On dependency/security changes or CI/release |
| `check:payments`, `check:build-install`, `check:startup`, `check:tenants` | Specific boundary, install, built-server, tenant probes | Narrow checks, but startup/tenant checks have prerequisites; CI runs first two | Run locally when their boundary changes; retain CI gates |

The frontend CI runs payment boundary, dependency audit, full TypeScript, full lint, full Vitest, and Next build on PRs and pushes to `main`/`develop`. Backend CI runs install behavior, dependency audit, bundle build and `repo_auditor.js` (full TypeScript, serial Vitest and fitness checks); tag release repeats the backend release gate. Those are already the broad safety net. The frontend CI passes Vitest worker/parallel flags that the `test` script already contains; the duplication is harmless and provides no extra confidence. Frontend CI's standalone TypeScript check and Next build overlap in type work but catch failures at different stages, so they remain in CI.

There is no tracked Playwright/Cypress E2E command, no formatting or pre-commit hook script, and no backend ESLint script. Do not claim automated E2E, formatting, or backend lint coverage. Browser verification is a focused manual/available-tool check today. Database migrations, seeding, backup/restore, MFA provisioning and replay scripts are operational actions, never routine validation.

## B. Fast development workflow

1. Inspect the changed files and their direct imports, callers, route and API contract. Assign the **highest** risk level involved. For a mixed change, follow the higher level.
2. Finish the logical edit. During editing, use code inspection and the dev server/affected view; avoid restarting broad checks after each line change.
3. Run `git diff --check`, changed-file frontend ESLint when code changed, and the smallest relevant test files/cases. Include a direct parent or consumer when the changed module is shared. For visual work, inspect the affected viewport if browser access exists.
4. Run package TypeScript only when types/contracts could break. TypeScript here is package-wide; it is **not** a reliable single-file check. The frontend project excludes tests from `tsc`; Vitest runs them but does not type-check them as a project.
5. If a check fails, correct it and rerun that check plus anything genuinely affected. Do not repeat a successful build or suite against unchanged inputs. Expand scope when an unexpected failure suggests a wider dependency.
6. Stop when the risk-sized evidence is complete. Report what passed and what was not exercised. CI/release runs the full gates.

Vitest supports file filters and `-t` test-name filters in both repositories. The installed CLI also offers `related` and `--changed`, but their import graph can miss route registrations, dependency injection, runtime-loaded templates, API contracts, and cross-repository effects. Confirm the selected tests before relying on those modes, especially for Level 3/4. Watch mode can shorten an extended editing session. No custom affected-project engine or cache layer is needed now.

## C. Risk matrix

| Change type | Level | Immediate required checks | Skip locally by default |
| --- | --- | --- | --- |
| Copy, icon, color, spacing, isolated responsive CSS | 1 | Diff check, changed-file lint for code, affected view/viewport | Full tests, full type check, production build |
| One page/component behavior, local form, filter/sort, local API call | 2 | Changed-file lint, affected Vitest file/case, affected flow | Unrelated suites and build |
| Shared component/hook/store/API client/notification or worker utility | 3 | Direct tests and consumers, relevant regressions, TypeScript if contracts changed | Unrelated modules; build unless bundling/config involved |
| Auth, tenant isolation, booking transitions, billing/payment, inventory, patient data, DB writes, migrations, concurrency, security | 4 | Relevant unit/integration tests, edge cases and adjacent flows; TypeScript; build/fitness/startup checks if touched | Unrelated UI tests, but never skip integrity tests in the affected domain |
| Merge/release/deployment checkpoint | 5 | Complete required CI/release gate and critical journey/manual smoke checks; deployment health and rollback readiness | Nothing required by the gate |

Do not classify a shared primitive as Level 1 merely because its visual diff is small. A dependency/config/routing change may justify a production build even when few lines changed.

## D. Exact script strategy

Run commands from the named repository root. Replace example paths with actual affected files. In PowerShell, quote paths with parentheses.

| Situation | Commands and scope |
| --- | --- |
| Tiny frontend UI change | `git diff --check`; `npx eslint src/app/browse/BrowseClient.tsx`; inspect `/browse` at the affected width if available. No build by default. |
| Normal frontend behavior | `npx eslint <changed files>`; `npm test -- src/tests/browseAndMobilePolish.test.tsx` (or actual affected tests); inspect the flow. Add `npx tsc --noEmit` for altered types/contracts. |
| Shared frontend component | Changed-file ESLint; direct and consumer test files, e.g. `npm test -- src/tests/components.test.tsx src/tests/responsiveControls.test.tsx`; `npx tsc --noEmit` if the shared interface changed. |
| Normal backend behavior | `npm test -- tests/appointment.test.ts` (replace with the affected file); `npm run check:fast` for changed TypeScript contracts. A MongoDB test run may need its cached test binary. |
| Shared backend/API business logic | Targeted direct + dependent `tests/*.test.ts`; `npm run check:fast`; `npm run build` for API/worker entry or bundle behavior. Add security/tenant/transaction tests for their respective boundaries. |
| Security-sensitive or migration work | Related auth/RBAC/tenant/persistence integration files plus adverse/edge cases, `npm run check:fast`, `npm run build`; use `npm run check:tenants` only when tenant-scoping source changes and inspect its behavior first. Do not run migrations against data as a test. |
| Pre-commit | Diff review and `git diff --check`, changed-file lint/targeted tests by risk. There is no installed pre-commit gate to invoke. |
| Pull request | Both repositories' existing CI gates for repositories that changed; locally run scoped checks and rely on CI for full gates. If a backend/frontend contract changed, validate both affected sides. |
| Production release | Existing CI/release workflows, dependency/config checks, full test/type/lint/build gates, critical booking/auth/billing/clinical journey checks and deployment smoke/health probes. Backend `npm run audit:release` writes release artifacts. |

Frontend `npm test -- src/tests/name.test.tsx -t "case name"` and backend `npm test -- tests/name.test.ts -t "case name"` can narrow within a file. To explore import-based selection, use `npx vitest related src/path/file.ts --run` and inspect the selected files; manual direct-dependency selection remains the safe default. Do not add `--passWithNoTests` to required checks: an empty selection should be visible.

## E. Checks owned by CI/release

Keep full frontend/backend suites, full lint, package-wide TypeScript, production Next build, dependency audit and backend architecture auditor in CI. Keep tag-release manifest generation, production config checks, critical journey checks and deployment health probes at release/deployment. PR CI currently runs comprehensive gates too; retain this until a measured and proven affected-check pipeline can protect cross-file and cross-repository contracts. Avoid reproducing all of it locally after every small edit.

There is currently no tracked automated browser E2E runner. A future dedicated CI project should cover login, booking, the patient-to-reception-to-doctor handoff, and billing/payment with stable test data. Until then, use focused manual release smoke checks and do not report browser E2E as passed.

## F. Checks that remain immediate

Inspect the diff, run changed-file ESLint for frontend code, affected tests for behavior, and TypeScript where a contract or high-risk backend change merits it. Run the payment boundary check immediately when checkout code changes. Run tenant/auth/permission, booking, billing, inventory and clinical persistence integration tests immediately for changes in those domains. Verify a UI view/viewport or important flow when the relevant browser is available. A fast check is useful only when it can detect a realistic failure from the change.

## G. Duplicate or low-yield repetition

- Repeating a successful full build after a tiny final CSS/text edit gives little added confidence; use changed-file lint and visual inspection. Rebuild only when the later edit affects compile/build behavior.
- Frontend CI supplies Vitest limits already baked into `npm test`; remove the duplicate arguments at a future CI cleanup if desired, with no expected speed gain. No reason to run both forms locally.
- Running backend `npm test` and then `npm run audit:release` locally repeats the complete serial Mongo suite; select tests during development and let the single release auditor own the full suite at its checkpoint.
- Running `npx tsc --noEmit` immediately before a Next build duplicates some type work; during local development choose the gate that addresses the risk. CI keeps both for now.
- Re-running unrelated frontend and backend suites because both repositories are open adds wait without coverage of the changed module. A changed API contract is the exception.

Nothing here removes tests, changes lint rules, changes CI coverage, or treats a passed scoped check as a substitute for the release gate.
