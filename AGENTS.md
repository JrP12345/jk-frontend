<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Verification for coding agents

Classify the highest risk of the files changed before running checks. Use [the verification workflow](docs/verification-workflow.md) for the exact commands and escalation rules. Do not run every available test, lint, type check, and build simply to show that work was done.

- Level 1 (copy, styling, isolated responsive layout): inspect the diff, check the affected view when possible, and lint changed code files. Do not run the full suite or production build by default.
- Level 2 (local behavior, form, filtering, local API use): lint changed files and run the affected Vitest files or cases. Check the affected flow.
- Level 3 (shared UI, hooks, API client, global state, notifications): include direct consumers and relevant regressions; run the package TypeScript check when types or contracts could change.
- Level 4 (auth, permissions, booking, billing, payments, patient data, migrations, security): run focused unit and integration tests, edge cases, related flows, and appropriate type/build checks. Do not trade away integrity for speed.
- Level 5 (release/production): use the full CI/release gates, including full lint, types, tests, security checks, and production build.

Finish a logical edit before its scoped verification. If a check passes and code it covers has not changed, do not repeat it. After a failure, fix the cause and rerun the failed/affected check; broaden only when the blast radius warrants it. Before a command, ask what risk it verifies, whether that risk is in the change, and whether CI can perform an unrelated broad check. Frontend and backend are separate repositories; verify each only when its code or shared contract changes. Never treat frontend `tsc` as test-file type coverage: `src/tests` is excluded by `tsconfig.json`.
