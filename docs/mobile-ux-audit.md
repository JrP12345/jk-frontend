# Mobile UX review and implementation

This review covers the existing frontend route inventory, role navigation, shared controls, and the components behind thin route wrappers. It preserves server permissions, module visibility, API calls, state transitions, request recovery, and clinical/financial rules. No backend or dependency changes are required.

## Findings implemented

| Evidence in the existing UI | Change |
| --- | --- |
| Header combined a logo, workspace selector, notifications, and account controls in one nonshrinking row. At 320px their combined minimum widths exceeded the viewport. Location switching was available only inside the drawer on mobile. | Workspace and location controls share a dedicated, flexible row on small screens. Desktop keeps them in the header. Account controls and the navigation drawer remain reachable. |
| Queue settings and a 200px traffic chart preceded the patient list. Four explanatory statistic cards consumed two tall rows. | Keep walk-in, call next, refresh, OPD status, and session actions visible. Put availability, announcements, QR printing, and documents in a named disclosure. Collapse traffic analytics. Present all four queue counts in a compact definition list. |
| Active and parked queue cards combined default outer padding with a second padded content block. Recorded vitals were placed in an unwrappable inline row. | Use one layer of card padding and wrap vitals without removing any values, risk flags, or escalation actions. |
| Patient lookup was preceded by a repeated EMR badge, introductory copy, and four directory statistics. Search inputs in flex rows still requested their parent's full width beside a button. Patient cards truncated names and compressed them beside identifiers. | Prioritize registration and lookup, make directory statistics expandable, and let search fields shrink beside their actions. Remove nested list padding, wrap identity/contact details, and enlarge contact targets. No search, pagination, matching, or duplicate handling changes. |
| Appointment view switching occupied its own padded card, and server pagination used a long paragraph beside two actions. | Use a compact view switch with selected-state semantics, a full-width search field, and a concise results/page summary beside paging controls. Retain the explanation of page-scoped counts and exports. |
| Billing, appointments, and pharmacy wrapped the table in an additional padded card. Some screens stacked three or four summary cards vertically. | Remove the extra padding around table content. Use two-column mobile summaries with comfortable gaps; the third card spans the row where appropriate. |
| Shared statistic labels and values were truncated. Decorative icons competed with financial amounts in narrow cards. Loading placeholders could exceed their available width. | Allow complete labels and amounts to wrap, omit decorative icons on phones, and bound loading placeholders. Values are never rounded or abbreviated. |
| Tables forced search and utility buttons into separate mobile rows and rendered an empty control strip for closed column filters. Generic mobile rows could overflow with long labels or fixed-width cell content. | Let search and utility controls share a row when space permits, omit the empty strip, constrain mobile label/value columns, and retain filtering, sorting, row selection, and secondary details. Match both paging targets at 44px on phones. |
| Consultation tab labels consumed several screen widths; the workspace added padding inside the dashboard shell. Patient identity and allergy badges could truncate or overflow. | Shorten tab names, retain order counts as badges, remove redundant mobile workspace padding, wrap patient names/identifiers/allergies, and use a touch-oriented patient-search label. Keep all clinical alerts visible. |
| Portal names and email addresses could overflow. Long tab labels pushed records and family actions farther offscreen. | Wrap identity/contact text, provide shorter recognizable tabs, and keep the existing family-role filtering and booking behavior. |
| An install prompt took over 100px of the phone viewport and overlapped useful content. | Use a compact mobile prompt with the same install and dismiss behavior. Desktop retains the explanatory text and brand icon. |
| Many dashboard pages reserved 128px at the bottom in addition to the shell's own 128px. | Let the shell reserve safe-area-aware space for the existing mobile navigation and floating assistant; reduce redundant page-level spacing. Tablet content no longer reserves space for a navigation bar that is hidden there. |
| CRM workflow links had inconsistent, short touch targets. | Give the existing workflow links a consistent 44px target without introducing a second navigation system. |

## Screen inventory and disposition

| Screens / routes | Review outcome |
| --- | --- |
| `/dashboard` | Preserve role-specific overview, quick actions, follow-up warnings, and existing access checks. Compact doctor summary layout through its existing component. |
| `/dashboard/queue` | Refine prioritization, tools, statistics, row density, and touch targets as described above. Preserve arrival confirmation, emergency escalation, clinical alerts, queue ordering, session transitions, and completion. |
| `/dashboard/appointments` | Refine search, view selection, paging summary, and table spacing. Preserve daily mobile calendar, booking, rescheduling, slots, and payment states. |
| `/dashboard/patients`, `/dashboard/patients/[id]`, `/dashboard/patients/[id]/timeline` | Refine directory lookup and shared table/identity behavior. Keep profile tabs, privacy controls, relationship authority, history access, and recorded-data presentation. |
| `/dashboard/consultations`, `/dashboard/consultations/[id]` | Compact list spacing and encounter navigation. Retain focused visit completion and full clinical documentation. |
| `/dashboard/patient-portal`, `/dashboard/bills` | Refine identity wrapping, tab recognition, and shell spacing. Preserve family access, medical records, refill requests, invoice actions, and checkout. |
| `/dashboard/billing`, `/dashboard/billing/services`, `/dashboard/settings/billing` | Compact table framing and summaries. Keep collection analytics disclosure and all financial calculations, payment recovery, subscription, and catalog behavior. |
| `/dashboard/laboratory`, `/dashboard/radiology`, `/dashboard/pharmacy`, `/dashboard/insurance`, `/dashboard/teleconsultation` | Retain task-specific cards, filters, states, and actions. Apply compact summary/spacing improvements and shared table behavior where used. |
| `/dashboard/staff`, `/dashboard/shifts`, `/dashboard/locations` | Keep team/location setup and assignments. Compact summaries and remove repeated bottom-navigation clearance. |
| `/dashboard/organizations`, `/dashboard/admin/users`, `/dashboard/admin/setup-requests` | Preserve existing organization scoping, setup actions, server-granted access, and focused forms. Shared header, statistic, and table changes apply where used. |
| `/dashboard/admin/billing`, `/dashboard/admin/monitor`, `/dashboard/audit`, `/dashboard/analytics` | Compact stacked summaries and mobile page spacing. Preserve monitoring, organization scope, audit visibility, and report controls. |
| `/dashboard/crm`, `/dashboard/crm/tasks`, `/dashboard/crm/communications`, `/dashboard/crm/overview`, `/dashboard/crm/settings` | Preserve task ownership, inquiry conversion, consent, and communication workflows. Refine touch sizing on the existing workflow navigation. |
| `/dashboard/settings`, `/dashboard/settings/modules`, `/dashboard/security`, `/dashboard/notifications`, `/dashboard/feedback` | Preserve existing task grouping, permission controls, recovery states, and forms. Shared controls/shell apply; notification page spacing is reduced. |
| `/login`, `/register`, `/reset-password`, `/accept-invite`, `/onboarding`, `/verify-email` | Keep existing auth and setup flows. Reduce login/registration brand spacing and place registration gender/date fields together on phones. Retain invitation and verification recovery. |
| `/browse`, `/browse/[slug]`, `/doctor/[slug]` | Preserve existing location/doctor discovery, meaningful fees/statuses, booking entry, and detail disclosures. Shared statistic/table/install improvements apply where used. |
| `/join/[locationSlug]`, `/track/[appointmentId]`, `/check-in` | Preserve purpose-built joining, tracking, and staff check-in flows, including identity and arrival controls. No blanket dashboard layout imposed. |
| `/`, `/pricing`, `/queue-tv` | Preserve the existing marketing, plan comparison, and waiting-room display layouts. TV information hierarchy remains suited to viewing at a distance. |

## Verification and limits

The highest affected domain is Level 4: the changed files render booking, billing, and clinical workflows, although the changes are presentation and disclosure refinements. Verification is scoped to those changes, shared controls, and direct consumers, following `docs/verification-workflow.md`.

- Changed-file ESLint: no errors; existing unrelated warnings remain.
- Package TypeScript: `npx tsc --noEmit --incremental false` passed. Disabling incremental cache avoids a sandbox write error and does not change type coverage.
- Targeted Vitest uses `--configLoader native` because the default bundled loader encountered a sandbox error writing its temporary config. Shared controls, table search, queue refresh/arrival confirmation, patient entry/recovery, clinical fields, patient portal, workspace isolation, mobile gestures, and browse/calendar cases passed (120 cases across the initial 10 files). Subsequent queue/portal and install-placement/recovery checks also passed (30 cases across 4 files, including reruns).
- CRM overview/settings/navigation checks passed (8 cases). The distinct targeted selection covered 13 test files; reruns are included in the case counts above.
- Headless Chrome checked actual rendered routes with mocked API fixtures at 320, 390, and 430px, plus 768px and 1440px queue layouts. Samples include queue, appointments, patients, billing, patient portal, consultation, login, registration, and browse. The sampled content and headers had no horizontal overflow. Both light and dark layouts were sampled.
- The 320px walk-in dialog remained inside a 450px-high viewport, with its submit action visible and no horizontal overflow. This checks constrained viewport handling; a physical phone keyboard was not exercised.
- Browser fixtures use synthetic names, locations, and visits; they do not validate live integrations or real clinical/payment writes. Existing targeted tests cover the affected business-flow boundaries. Not every route/role combination was exercised in a browser.
- No full test suite, production build, backend tests, dependency install, or database operation was run for this refinement.
