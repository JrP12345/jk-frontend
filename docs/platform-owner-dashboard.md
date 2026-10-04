# Platform owner dashboard audit

Scope: ROOT view of `/dashboard`. Clinic, doctor, receptionist, and patient views retain their operational behavior.

## Before

The page fetched `/admin/hierarchy`, displayed organization/location/member totals and an audit shortcut, followed by a full organization table with immediate impersonation buttons. Details opened the list without selecting an organization. No raw redirect URL column existed in the inspected version, but entering workspaces was emphasized over understanding the platform business.

## Signals and definitions

| Question | Existing source | Definition |
| --- | --- | --- |
| Are subscriptions bringing in money? | SubscriptionPayment | Captured collections in major currency units, tax included, grouped by currency and paidAt. Refunded/review payments excluded; undated captures disclosed. |
| Are collections growing? | Same | Month to date versus the same elapsed portion of the previous month, capped at that month's end. |
| Are organizations healthy? | Organization, latest Subscription, SaaSPlan, captured payment proof | Reuse summarizeSubscription for expiry, disabled access, trial/free/manual/paid access. Paid counts require captured evidence and current access. Expiring soon is a subset. |
| Is the product used? | Appointment.createdAt | Bookings created this month and during the selected range. Later cancellations remain included; pending_payment placeholders excluded. Organization usage means at least one created booking. |
| Are visits happening? | Appointment.status and appointmentTime | Completed visits scheduled this month. Consistent completion timestamps are not available. |
| Who uses it? | Booking aggregation; Doctor and User | Distinct patients in this month's bookings; enabled doctor profiles with enabled identities. Not login-based active users. |
| What needs attention? | Subscription summaries, payment reviews, onboarding, doctors, bookings | Upcoming trial/plan ends, expiry/payment issues, missing subscriptions/doctors, incomplete setup, and no bookings for 30 days among organizations at least 30 days old. |
| Which organizations need follow-up? | Booking aggregation | Top/fewest month-to-date bookings, six rows each; organization links use organizationWorkspaceUrl. No dashboard impersonation mutation. |
| What changed? | Organization creation, captured subscription payments, ADMIN/BILLING audit records | Factual events; no clinical events, actor identities, audit details, credentials, patient records or provider payment identifiers in the DTO. |

Reporting boundaries and chart buckets use UTC, disclosed on the page. 7D/30D show daily totals; 90D uses weekly totals in the existing BarChart. Headline KPIs remain month to date when chart range changes.

## Omitted metrics

MRR/ARR, historical recurring price commitments, churn, conversion cohorts and login-based active users are not inferred from current plan prices or broad user counts. Collections are cash receipts, not recognized revenue. Clinic/patient invoice revenue is excluded from SaaS collections.

## API and performance

One read-only `/api/admin/dashboard?range=7D|30D|90D` endpoint uses existing platform root authorization and additionally rejects impersonated workspaces. The query range is validated. Mongo grouping and narrow projections avoid sending clinical records or a full member hierarchy. Queries run in parallel without per-organization database calls. Organization rows and recent activity are bounded; charts contain at most 90 daily aggregate points.

React Query caches one response per root identity/range for 60 seconds. Metric/currency changes use the same response. Refresh and range transitions retain the prior snapshot and label updates/failures. Errors are not rendered as zero totals. Initial load uses one structural skeleton.

Existing Card/StatCard, Badge, Button, Select, responsive Table, BarChart, Skeleton, EmptyState, Alert, currency formatting, API client and routing helpers are reused. BarChart has an opt-in responsive mode that preserves its requested height and adjusts label density to container width; existing consumers retain their sizing. Table omits empty toolbars when controls are disabled. No new chart dependency, audit architecture or billing mutation is introduced. Existing management pages retain their access/impersonation workflows.

Mobile prioritizes collections, organization health/follow-ups, supporting usage, trend, organization activity and recent events. Tablet uses two KPI columns; wide desktop uses four and a two-to-one chart/health composition. Zero collections use a compact state with a booking-trend action.

## Verification scope

Level 4: platform authorization and subscription/payment data. Focused checks cover Mongo aggregates, root/non-root/impersonated access, reporting boundaries, currencies/payment states, empty periods, safe DTOs, existing billing authorization, frontend loading/error/retry/caching/navigation, and desktop/tablet/mobile component previews. No payment, migration, real impersonation or production data mutation is used as a test.

Focused backend aggregates/authorization tests, frontend dashboard/chart/table regressions, both package TypeScript checks, changed-file ESLint and diff checks passed. Browser previews used synthetic data and the real dashboard components at 1440, 820, 390 and 320 pixels, including the empty-platform state. This is component visual verification, not an authenticated browser end-to-end test.

The standard backend build encountered access-denied errors writing existing dist worker files in the sandbox. In-memory esbuild bundling of the API and all five worker entry points passed instead. No full release gate or deployment was performed.
