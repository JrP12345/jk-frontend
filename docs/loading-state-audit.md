# Loading-state audit

Reviewed all 48 page entry points, their route loading files and their shared UI
consumers on 2026-10-07. This is a source audit with focused local browser and
regression checks; it does not claim a live authenticated visit to every route.

## Changes

- `LoadingState` occupies its content region, centers an unknown-layout loader,
  and accepts decorative skeletons for a known layout. Each region exposes one
  named progress status. Button and inline feedback retain their compact sizing.
- `Skeleton` respects utility dimensions and responsive sizes instead of applying
  overriding inline defaults. Shapes fit their parent, and mobile groups wrap.
- Tables distinguish initial reads from updates, retain loaded rows during
  updates and announce progress. Cards and dialogs avoid duplicate progress
  announcements while retaining their existing busy and focus behavior.
- Organizations use directory/form skeletons on first read. Successful empty
  results, initial failures and pending/failed refreshes have separate states.
  Account changes hide the previous directory and reject superseded responses.
- Notification, AI and WhatsApp settings request organization selection when
  Root has no organization selected. This is a user choice, not a pending read.
- Clinical, operational and finance summary cards use their loading state before
  a read completes, rather than presenting initialized zeroes as known results.
- Medical records wait for both reads and expose retry on failure rather than
  converting failures into empty clinical notes or invoices. Retry preserves the
  approved patient scope, successful sections remain available when another read
  fails, and cancelled patient reads cannot commit late data.
- Directory setup requests, organization subsections, timelines, invoice panels,
  booking entry and appointment dialogs use suitably sized loading regions.

## Page inventory

The table records the loading surfaces inspected. Pages that already use
centered or contextual feedback keep that approach and receive shared sizing
and accessibility changes through their consumers.

| Route | Loading surface reviewed |
| --- | --- |
| `/` | Public content, current-plan region and authenticated redirect |
| `/pricing` | Tier cards and request-setup plan selection |
| `/browse` | Directory skeletons, retained results, filtering and booking |
| `/browse/[slug]` | Detail fallback and embedded booking form skeleton |
| `/doctor/[slug]` | Detail fallback and booking form skeleton |
| `/join/[locationSlug]` | Location read, invalid invitation and submission |
| `/check-in` | Token/phone form submission and result handoff |
| `/queue-tv` | Display setup, board connection and live queue updates |
| `/track/[appointmentId]` | Tracker skeleton, refresh, QR and check-in actions |
| `/verify-email` | Verification fallback, processing and recovery |
| `/accept-invite` | Invitation fallback, validation and acceptance |
| `/login` | Sign-in card fallback, OTP/password/passkey/MFA and dashboard handoff |
| `/register` | Patient registration, OTP request and verification |
| `/reset-password` | Route fallback and reset submission |
| `/onboarding` | Session check, setup skeleton, QR and verification |
| `/dashboard` | Session/role shell, dashboard cards and refresh |
| `/dashboard/admin/billing` | Platform billing skeleton and save/refresh actions |
| `/dashboard/admin/monitor` | Session/traffic tables and revoke actions |
| `/dashboard/admin/setup-requests` | Inbox skeleton, filters and updates |
| `/dashboard/admin/users` | Route/table skeleton, organization context and mutations |
| `/dashboard/analytics` | Report/chart skeleton and retry |
| `/dashboard/appointments` | Calendar fallback, tables, availability and booking actions |
| `/dashboard/audit` | Audit table initial read and refresh |
| `/dashboard/billing` | Summary cards, invoice table and checkout actions |
| `/dashboard/billing/services` | Summary cards, catalog table and editor submission |
| `/dashboard/bills` | Invoice table and payment submission |
| `/dashboard/consultations` | Workflow settings skeleton, summaries and encounter launch |
| `/dashboard/consultations/[id]` | Encounter skeleton and clinical editor actions |
| `/dashboard/feedback` | Summary cards, feedback table and survey submission |
| `/dashboard/insurance` | Summaries, authorization/claim card skeletons and mutations |
| `/dashboard/laboratory` | Summary/table reads, result entry and upload |
| `/dashboard/locations` | Active/archived location skeletons and refresh |
| `/dashboard/notifications` | Inbox/table reads, notification test and send actions |
| `/dashboard/organizations` | Initial directory/form skeleton, retained refresh and retry |
| `/dashboard/patient-portal` | Profile skeleton, clinical timeline and patient actions |
| `/dashboard/patients` | Summary/table reads, refresh and registration |
| `/dashboard/patients/[id]` | Profile skeleton, records/timeline and edit actions |
| `/dashboard/patients/[id]/timeline` | Timeline skeleton, filters and scoped retry |
| `/dashboard/pharmacy` | Summary/catalog reads, refresh and stock mutations |
| `/dashboard/queue` | Desk skeleton, live updates and individual queue actions |
| `/dashboard/radiology` | Summary/table reads, image preview and report actions |
| `/dashboard/security` | Passkey/session-limit skeletons and individual actions |
| `/dashboard/settings` | Route/form skeleton and context-specific settings |
| `/dashboard/settings/billing` | Subscription skeleton and billing/location actions |
| `/dashboard/settings/modules` | Module configuration skeleton and save |
| `/dashboard/shifts` | Schedule/table reads and editor actions |
| `/dashboard/staff` | Organization member skeleton and mutations |
| `/dashboard/teleconsultation` | Summary/session skeletons and consultation workspace |

## Verification

Highest risk: Level 4, because directory account scoping and clinical record
recovery are covered. Focused regression coverage passed 224 distinct cases in
28 files, including 22 new cases for shared loading behavior, organization read
sequencing/context selection and medical record recovery. Package TypeScript,
changed-file ESLint and diff checks passed; ESLint reports existing warnings.

An isolated Chrome profile reviewed the actual organizations route using local
API fixtures at 320, 375, 430, 768, 1024, 1440 and 1920px in light/dark modes.
There was no horizontal overflow, and exactly one named organization-loading
status. Successful empty results resolved, and directory content remained
visible during a pending refresh and after a failed refresh. Mobile and desktop
screenshots were inspected. All API responses were intercepted locally; no
database records or external integration state were changed.

Existing authentication, workspace isolation, queue continuity, booking,
invoicing, setup, messaging, mobile controls and patient-history regressions
were included. No backend change, production deployment, hardware passkey or
provider payment journey was performed for this work.
