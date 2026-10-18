# Dashboard shared-control standardization

Updated 2026-10-18. Current module: dashboard forms and shared control composition.

## Implemented

- Replaced 26 native date/date-time/time fields in 16 dashboard pages and workflow components with the existing DatePicker. Covered audit filters, appointments, walk-ins, patient registration/profile/portal, pharmacy, staff leave, CRM, clinical documents, ABHA registration and disruption rescheduling.
- Added time-only mode to DatePicker using existing Select and Button components. All 60 minute values are available. Opening or dismissing an unconfirmed time edit does not change the saved value. Local `YYYY-MM-DD`, `HH:mm` and `YYYY-MM-DDTHH:mm` contracts remain unchanged.
- Retained required/min/max form validation through the shared control's non-visible backing field, with errors and focus routed to the visible trigger. Date constraints no longer mutate incoming Date objects. Nested selects retain the owning picker and parent modal.
- Replaced the queue reconciliation radio groups with shared Select controls, the schedule editor's plain checkbox with Checkbox, and the desktop table filter's plain input with Input.
- Removed the service catalog's CSS module. It now uses Card, existing controls, standard Tailwind utilities, `page-title` and `formatCurrency`.
- Removed conflicting availability-footer wrappers; QueueDialog owns the Cancel/Save layout. The restore action sits with the active override, and saving blocks dismissal.
- Documented the shared-control and utility convention in `design-system.md`. No new CSS or dependencies added.

## Verification evidence

Highest risk: Level 4 because booking, clinical and billing consumers retain their existing form/API contracts.

- 182 distinct focused cases passed across 20 test files in scoped runs: shared controls/date forms, schedule cloning, service catalog, audit continuity, appointments, walk-ins, queues, patients, pharmacy, staff leave, CRM and clinical documents. Date-picker and table consumer checks were repeated only after connected fixes.
- Package TypeScript check passed. Changed-file ESLint reported no errors; existing hook/unused-value warnings remain in several large consumers. DatePicker and its new form tests have no lint warnings.
- Local hidden Chrome, with all APIs intercepted using synthetic data: service layout, pharmacy expiry calendar and queue time selection at 320 and 1440 pixels. No viewport overflow observed; the queue retained the selected exact `09:17` value. No live writes were made.
- A malformed intermediate Tailwind selector was removed; the local development server was restarted and the affected routes compiled and rendered successfully.

Residual limits: full release/build gates, live persistence and cross-browser behavior were not claimed. Existing page CSS modules outside this scoped conversion remain; shared controls and new service-page styling use the component/utility system.

Next action: user review of the standardized controls in normal dashboard use.
