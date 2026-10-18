# Dashboard page spacing

Current task: consistent desktop page gutters across `/dashboard` routes.
Status: implemented and scoped layout verification complete, 2026-10-18.
Verification risk: Level 3 shared shell presentation; no authorization, data or navigation contracts changed.

## Root cause and change

The shell capped content at 80/90rem and centered it; individual workspaces applied additional, inconsistent caps of 72, 80, 86 or 90rem. Their margins accumulated, particularly on wide screens.

The shell now owns the page frame. Desktop side gutters are 24px and match the toolbar inset. Phone/tablet side gutters retain 12px / 20px / 24px breakpoints. Large-screen vertical padding, safe areas, scrollbar gutter, mobile navigation clearance and scrolling behavior are preserved.

Removed outer width caps from 19 workspace stylesheets covering overview, organizations, CRM, admin users/monitor/billing, audit, settings, notifications, queue, appointments, patients/profile, consultations/encounter, billing, locations, staff and pharmacy. Setup requests and account security now use the same full-width frame; patient timeline and dashboard loading no longer add desktop inset padding. Other routes already use fluid workspaces and inherit the shell fix. Inner text, form, dialog and intentional empty-state widths were retained.

The shared rule is recorded in `docs/design-system.md` to avoid reintroducing page-level caps.

## Verification

- Inspected all 38 dashboard page entry points and their referenced containers. No numeric page-level cap remains on the workspace/directory/chooser selectors.
- Existing `locationNavigation.test.tsx`: seven shared-shell regressions passed.
- Changed TSX lint: zero errors; five existing hook/effect warnings remain in the shell, account security and setup-request inbox.
- Scoped diff whitespace checks passed. No package-wide type check or production build was needed for class/CSS-only changes.
- Hidden Chrome with intercepted synthetic data measured content and page frames at 1920px across clinical, management and platform routes, with representative 1280px and 2560px cases. Measured desktop gutters were 24px; page frames matched the shared frame without horizontal page overflow.
- Queue, appointments and patients were also measured at 320px and 440px; gutters remained 12px. Collapsed-sidebar checks for Queue and Patients retained 24px gutters relative to the expanded content area.
- Some first-pass fixtures showed error/loading states or module redirects; corrected fixture follow-ups checked service catalog, shifts, CRM inquiries/tasks/overview, platform overview and platform settings. Loaded encounter and analytics report states were not verified by these fixtures. These are rendering/frame checks, not functional end-to-end certification.

Next release work remains the existing CI gates and real authenticated browser rehearsal. No backend, live records, infrastructure or deployment changed.
