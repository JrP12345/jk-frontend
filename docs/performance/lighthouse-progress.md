# Website-wide Lighthouse progress

Updated 2026-10-23T16:45:02.163Z.

All 54 page templates are represented by 57 initial views, including four dashboard roles. 114/114 collected observations validated; 0 remain unverified and 0 profile observations are pending. These are local production-artifact audits with synthetic records, not deployed or real-user measurements. An audited initial view does not mean all workflow variants or performance targets are complete.

Repeated patient-dashboard CLS median: 0.1366 to 0.0772 across three cold samples each. Performance targets remain partial; individual pilot results below are historical diagnostics.

[Implementation, verification and limitations](lighthouse-remaining-2026-10-23.md).
Scores are mobile / desktop, one cold observation each unless the JSON contains repeated runs.
Pricing uses the latest public-prefetch follow-up (three mobile samples and one desktop sample).
`Audited` describes coverage; performance below 90 remains partial.
The automated WCAG column covers the final build and retains manual-review findings in the report.
No deploy or paid infrastructure change was made.

| Page / representative | Coverage | Performance M / D | Accessibility M / D | Best Practices M / D | Automated WCAG M / D | SEO | Remaining work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Audited | 86 / 99 | 100 / 100 | 100 / 100 | Pass / Pass | Production indexing policy tested; local noindex | Performance remains partial |
| `/accept-invite` | Audited | 83 / 100 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/browse` | Audited | 85 / 100 | 100 / 100 | 100 / 100 | Pass / Pass | Production indexing policy tested; local noindex | Performance remains partial |
| `/browse/[slug]` | Audited | 75 / 100 | 100 / 100 | 100 / 100 | Pass / Pass | Production indexing policy tested; local noindex | Performance remains partial |
| `/check-in` (admin) | Audited | 81 / 100 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard` (doctor) | Audited | 52 / 95 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| Additional role: `/dashboard` (root) | Audited | 48 / 96 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| Additional role: `/dashboard` (patient) | Audited | 54 / 72 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| Additional role: `/dashboard` (pharmacist) | Audited | 62 / 97 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/admin/billing` (root) | Audited | 68 / 93 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/admin/monitor` (root) | Audited | 68 / 97 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/admin/setup-requests` (root) | Audited | 70 / 96 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/admin/users` (root) | Audited | 70 / 94 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/analytics` (admin) | Audited | 76 / 90 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/appointments` (admin) | Audited | 51 / 94 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/audit` (root) | Audited | 51 / 96 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/billing` (admin) | Audited | 70 / 99 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/billing/services` (admin) | Audited | 47 / 68 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/bills` (patient) | Audited | 52 / 85 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/consultations` (doctor) | Audited | 54 / 92 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/consultations/[id]` (doctor) | Audited | 57 / 78 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/crm` (admin) | Audited | 52 / 97 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/crm/communications` (admin) | Audited | 62 / 96 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/crm/overview` (admin) | Audited | 56 / 93 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/crm/settings` (admin) | Audited | 54 / 97 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/crm/tasks` (admin) | Audited | 56 / 97 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/feedback` (admin) | Audited | 60 / 94 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/insurance` (admin) | Audited | 55 / 67 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/laboratory` (admin) | Audited | 49 / 64 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/locations` (admin) | Audited | 46 / 65 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/notifications` (admin) | Audited | 60 / 86 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/organizations` (root) | Audited | 50 / 93 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/patient-portal` (patient) | Audited | 56 / 80 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/patients` (admin) | Audited | 48 / 88 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/patients/[id]` (doctor) | Audited | 62 / 85 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/patients/[id]/timeline` (doctor) | Audited | 62 / 95 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/pharmacy` (pharmacist) | Audited | 56 / 95 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/queue` (doctor) | Audited | 66 / 88 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/radiology` (admin) | Audited | 49 / 95 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/security` (admin) | Audited | 48 / 95 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/settings` (admin) | Audited | 52 / 67 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/settings/billing` (admin) | Audited | 46 / 83 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/settings/modules` (root) | Audited | 56 / 97 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/shifts` (admin) | Audited | 64 / 93 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/staff` (admin) | Audited | 47 / 90 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/dashboard/teleconsultation` (doctor) | Audited | 54 / 97 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/doctor/[slug]` | Audited | 80 / 100 | 100 / 100 | 100 / 100 | Pass / Pass | Production indexing policy tested; local noindex | Performance remains partial |
| `/join/[locationSlug]` | Audited | 81 / 99 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/login` | Audited | 91 / 100 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Monitor; one sample/profile |
| `/onboarding` | Audited | 51 / 96 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/pharmacy-start` | Audited | 84 / 98 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/pricing` | Audited | 85 / 100 | 100 / 100 | 100 / 100 | Pass / Pass | Production indexing policy tested; local noindex | Performance remains partial |
| `/queue-tv` | Audited | 48 / 98 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/register` | Audited | 61 / 100 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/reset-password` | Audited | 87 / 99 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/track/[appointmentId]` | Audited | 73 / 99 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |
| `/verify-email` | Audited | 73 / 99 | 100 / 100 | 100 / 100 | Pass / Pass | N/A; intentional noindex | Performance remains partial |

## Remaining variants

Account OTP/MFA, expired invitation/reset/verification links, saved pharmacy signup and recovery,
empty/error/permission-denied states, organization-admin/nurse/front-desk/family dashboard variants, large datasets
and clinical/financial transaction journeys are not exhaustive Lighthouse coverage.
Existing focused tests cover affected behavior; synthetic initial views do not prove deployed API
authorization or persistence.

Continue from the lowest mobile performance rows using a trace and repeated cold measurements on
an otherwise idle machine. Keep private/preview noindex, CSP, tenant checks and transaction boundaries
intact. Do not compare earlier retained-storage private diagnostics with these cold measurements.
