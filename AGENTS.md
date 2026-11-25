<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Compact action labels

Review the whole action area, including bottom navigation, after changing copy. Use the requested compact Pay + amount label for POS payment navigation; avoid long phrases such as Review payment. On mobile, related primary/secondary actions should share a compact row when they fit, rather than creating a full-width button plus a separate tall text-action row. Use the existing compact control typography (typically 12–13px in dense POS controls), preserve touch targets, and avoid oversized totals or explanatory whitespace. Keep checkout totals and final actions anchored to the bottom of the mobile payment panel; do not leave unused space below them. Omit redundant payment-confirmation helper text. Check both cart and payment states; shortening only the desktop label is incomplete.

Use short, contextual button labels in dense workflows (for example, Confirm and Print beside a bill total). Keep action text on one line at mobile and narrow laptop widths, including any shortcut badge. Do not solve long labels by enlarging buttons, wrapping words, or reducing text below readable sizes. Preserve full action meaning in accessible labels/tooltips, especially when Print also saves a bill or records payment. Inspect the available column width before choosing copy.

## Project stage

This entire project is in development, with no production customers or legacy production data (user clarification, 20 October 2026). Skip migration/backfill and compatibility layers solely for hypothetical legacy deployments. Use current intended contracts while preserving and verifying current clinical, financial, security and inventory flows when shared code changes. Synthetic fixtures are development coverage, not legacy production obligations.

## Data-aware dialog and document UI

- Show human-readable bill numbers and payment references; never expose database ObjectIds, actor IDs or session IDs in ordinary UI or customer receipts. Keep internal IDs in diagnostic tooling.
- Read-only dialogs use the header close icon. Do not add redundant Done/Close footers. Reserve footers for meaningful actions such as Print or Confirm payment.
- Put document actions inline with their section heading or receipt content, not in large standalone rows. Avoid duplicate totals, status labels and zero-value details that add no useful information.
- Size dialogs to their content and available viewport. Keep document settings and primary actions outside a single document scroll area. Compact the preview before adding scrolling; allow long documents to scroll without clipping or shrinking text beyond readability.
- Check both short and long data, large amounts, mobile and laptop widths. Preserve complete financial evidence and print content when simplifying presentation.

## Verification for coding agents

Classify the highest risk of the files changed before running checks. Use [the verification workflow](docs/verification-workflow.md) for the exact commands and escalation rules. Do not run every available test, lint, type check, and build simply to show that work was done.

- Level 1 (copy, styling, isolated responsive layout): inspect the diff, check the affected view when possible, and lint changed code files. Do not run the full suite or production build by default.
- Level 2 (local behavior, form, filtering, local API use): lint changed files and run the affected Vitest files or cases. Check the affected flow.
- Level 3 (shared UI, hooks, API client, global state, notifications): include direct consumers and relevant regressions; run the package TypeScript check when types or contracts could change.
- Level 4 (auth, permissions, booking, billing, payments, patient data, migrations, security): run focused unit and integration tests, edge cases, related flows, and appropriate type/build checks. Do not trade away integrity for speed.
- Level 5 (release/production): use the full CI/release gates, including full lint, types, tests, security checks, and production build.

Finish a logical edit before its scoped verification. If a check passes and code it covers has not changed, do not repeat it. After a failure, fix the cause and rerun the failed/affected check; broaden only when the blast radius warrants it. Before a command, ask what risk it verifies, whether that risk is in the change, and whether CI can perform an unrelated broad check. Frontend and backend are separate repositories; verify each only when its code or shared contract changes. Never treat frontend `tsc` as test-file type coverage: `src/tests` is excluded by `tsconfig.json`.
