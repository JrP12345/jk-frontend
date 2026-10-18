# Staff workspace refinement

Current module: `/dashboard/staff`, responsive directory and existing staff workflows.
Status: implementation and scoped local verification complete, 2026-10-18.
Highest verification risk: Level 4 (staff accounts, role assignments and availability).

## Changes

- Compact directory, role filter, search, desktop rows and mobile cards; retained staff counts across tabs.
- Staff, Permissions and Insights tabs follow the existing permission helpers. Embedded organization setup retains its directory view.
- Account / Profile & practice tabs retain entered values and select the panel containing validation errors.
- Stable profile, invitation, assignment, leave and role dialogs with pinned actions and independent body scrolling.
- Assignment locations / form and leave form / scheduled lists use tabs; fees, booking modes, durations, hours and existing scoped endpoints are preserved.
- Old staff reads cannot overwrite a newly selected location. Organization or authority changes discard private forms; a late account creation cannot start an assignment in a new organization.
- Duplicate submissions are guarded. Failed assignment removal and deactivation preserve recovery actions.
- Insights now calls its invoice sum billed amount, labels the loaded-record snapshot limitation, and reports failed reads instead of displaying false zero totals.

## Evidence

- `doctorSetupFlow.test.tsx`: 14 passed (photo upload/removal, owner setup, fee models, location defaults, failed reads, scope changes, invitation recovery).
- `staffWorkspace.test.tsx`: 12 passed (directory/filtering, read races, validation, scoped assignment updates, leave, permission visibility, late creation, removal and deactivation recovery).
- `staffSecondaryPanels.test.tsx`: 4 passed (role assignment failure/pending states, custom role preset submission, insights failure/retry and retained snapshot).
- `npx tsc --noEmit --incremental false`: passed.
- Changed-file ESLint: zero errors; five existing effect/dependency warnings remain across TeamManagement, RBACPermissionMatrix and ExecutiveAnalytics.
- Scoped `git diff --check`: passed.
- Hidden Chrome rendering with intercepted synthetic API fixtures: 320px, 440px and 1440px directory, main tabs, profile panels, assignments, leave, invitations and role dialogs. No horizontal overflow detected. Profile tab changes and delayed assignment reads retained identical dialog/footer bounds.

## Limits and next work

No backend code, live staff record, infrastructure, or provider configuration changed. Browser checks used fixtures and do not demonstrate deployed persistence or delivery. Insights remains a limited list snapshot, not an aggregate financial report. Full lint/test/build release gates remain CI-owned; real authenticated persistence and invitation delivery belong to the designated test-environment rehearsal. No production-readiness decision is made by this UI task.
