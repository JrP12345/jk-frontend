# Frontend component reuse audit

Reviewed 2026-10-13 before refactoring. Scope: every source page, component,
workflow, hook and utility under `src`; tests were inspected for affected flows.
The inventory covered 292 TypeScript/TSX/CSS files, including 214 TSX files.
Existing unrelated working-tree changes are retained.

## Existing architecture

Use `src/components/ui` and its barrel exports. The shared dialog is `Modal`
(not a component named Dialog); confirmations use `ConfirmDialog`. Controls are
`Input`, `Textarea`, `Select`, `DatePicker`, `Checkbox`, `Toggle` and `Button`.
Tables, pagination, alerts, loading/empty states, charts and toasts already exist.
`controlStyles.ts` and semantic tokens in `globals.css` own control appearance.
Layout conventions are documented in `design-system.md` and
`interaction-patterns.md`; Next's installed client-component guide was read.

Reuse `cn`, `formatCurrency`, `localDateKey`, branch-aware `locationTime`,
`userFacingError`, patient presentation helpers, `useLatestRead`, `useToast`,
overlay focus/scroll helpers and shared printing utilities. Calendar dates,
browser-local time, branch-local time and UTC are distinct contracts: do not
replace one with another solely to shorten code.

## Findings and implementation decisions

Before refactoring, non-library JSX contained 55 native inputs, 12 textareas,
seven selectors, 202 buttons, 12 tables and 31 inline styles. These are inventory
counts, not a claim that every occurrence is defective. No third-party UI widget
library is installed; Lucide icons, WebAuthn and QR generation are functional
dependencies, not substitute UI systems.

- Replace ordinary text/number fields and textareas with existing controls,
  preserving handlers, constraints, refs, autofocus, disabled state and layout.
  Associate existing field labels through the shared control instead of retaining
  separate unassociated labels. Search fields use Input's icon prop.
- Replace ordinary native checkboxes with `Checkbox`; preserve exact verification
  wording, fieldset disabling, identity/consent decisions and permission checks.
- Replace ordinary native selectors with `Select`; preserve option labels/values,
  empty choices and disabled options. Shared selector event semantics are compatible.
- Reuse `Table` for simple operational data and shared variants for ordinary
  actions. Preserve dense/specialized clinical tables, print document tables and
  public server-rendered comparison tables when replacement adds client interaction
  or loses document semantics.
- Prefer `DatePicker` where its current contract matches. Required date/time
  fields with native validity/min/max/step, specialized scheduling controls and
  browser time inputs may retain `Input` or native controls: DatePicker currently
  has a different change contract and lacks native required/step validation.
- Remove static control styling duplication; retain necessary responsive layout
  classes. Preserve dynamic positions, gesture transforms, tenant branding,
  chart measurements and DICOM transformations. Fixed print palettes are intentional.
- Reuse currency/error utilities where their contracts match. Retain exact
  financial serialization, calendar grouping and provider amounts; presentation
  refactoring must not change business calculations or timezone interpretation.

## Verification

Permission/clinical/booking consumers are Level 4; ordinary presentation is
Level 2, and shared component contracts would be Level 3. Run changed-file lint,
affected consumer tests and package TypeScript as appropriate. No new dependencies,
redesign, backend change, full test suite or release build is part of this audit.
Execution results and retained exceptions are recorded below after verification.

## Completed refactoring

- Replaced 60 ordinary native fields: 29 text/number/phone inputs, 19 checkboxes
  and 12 textareas. This covers CRM and privacy/family forms, public registration,
  clinical SOAP/documents, billing/administration, notifications, shifts,
  teleconsultation, patient history, organization details and booking-link tools.
  Shared IDs/labels and Input icon slots replace detached labels and positioning.
- Replaced all seven ordinary native selectors, including disruption recovery,
  blood sugar measurement, image instance and booking accent selection. Retained
  empty and disabled choices, displayed doctor details and numeric index conversion.
- Reused DatePicker for optional CRM report dates, Table for inquiry-source and
  WhatsApp template/delivery tables, and ProgressBar for referral/credit usage.
  Table gained an optional accessible caption and `fitContent` sizing for small
  reports, preserving their natural height/mobile width. Defaults for existing
  operational consumers are unchanged.
  Search filters and 24 ordinary actions across 14 files use Button variants,
  retaining handlers, explicit button types and disabled states. Visit invoices and daily totals use
  the existing currency formatter with decimal behavior preserved, including JPY.
- Replaced two page-level browser confirmations with ConfirmDialog. Cancelling
  leaves the visit untouched; confirming retains ordered arrival/start writes or
  the server's explicit booked-patient call identifier. Queue confirmation retains
  and checks its organization/branch/doctor context before proceeding.
- Removed 239 redundant Button styling overrides across 50 files where they
  duplicated existing variants/control radius. Layout classes and intentional
  differences remain. No CSS, UI dependency or backend change was introduced.

After review, non-library native fields are limited to seven intentional cases:
four clinical radio options (no shared Radio component exists), two rich notification
channel cards whose whole-label interaction must be retained, and the tracker
reschedule date with native min/validity behavior. Native textarea/select counts
are zero. Nine remaining native tables are specialized clinical/schedule, document
or public comparison tables. Native button widgets retain card/list/menu/calendar
and navigation semantics where Button would alter their layout or interaction.

The 29 retained inline styles belong to print documents, dynamic tenant branding,
gesture/overlay positioning, chart geometry, responsive navigation columns and
DICOM transforms. Fixed paper/QR palettes and external booking snippets remain
intentional. Branch/calendar/UTC calculations and financial serialization were
not replaced with differently scoped helpers. Synchronous unsaved-clinical-draft
guards remain in the existing shared hook.

## Executed verification

The initial scoped checkpoints covered 169 distinct cases in 29 affected frontend
test files. After the final ordinary-action replacements, five direct consumer
files passed 63 cases, including the newly affected login file and relevant
clinical/queue/location/organization regressions.
The final Table sizing/caption checkpoint passed two files/29 cases; its lint had
zero errors/three warnings, and application TypeScript passed again after that
shared contract extension.
Coverage includes shared controls and responsive overlays, table accessibility,
signed/draft clinical fields, clinical documents, explicit arrival confirmation,
queue/recovery, CRM retry/consent/authority, family/branch grants, public booking,
organization management, invoices, timeline, notifications and teleconsultation.
Failed new fixtures were corrected (missing provider, incomplete summary DTO and
outdated Checkbox mock). The unchanged nested-focus case passed its focused rerun.
Passed checks were retained rather than repeating the full suite.

Application TypeScript passed; it does not type-check `src/tests`. Lint over the
79-file verification inventory had zero errors and 195 warnings; the final edited
files and 14 action-consumer files were checked separately (zero errors, 10 and
52 warnings respectively). No lint rules were disabled. Both diff inspection
and `git diff --check` passed. No full test suite, production build, dependency
installation, live dispatch or database change was run. A live browser/device
visual review was not performed in this pass; responsive behavior has scoped
component-test coverage, not new cross-browser acceptance.
