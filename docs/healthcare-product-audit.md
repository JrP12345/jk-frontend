# Healthcare product audit — 2026-10-04

Scope: existing Ekavyu frontend and backend. This is a source and workflow audit, not a production certification or a claim that every screen has been visually exercised. Continue from [the task ledger](healthcare-product-ledger.md).

## Product and architecture

Patients find care, book, track arrival and recover records/payments. Reception identifies patients, books and manages arrival/queue. Providers consult and document; billing staff collect and reconcile. Organization admins configure locations, providers, staff and policies. ROOT manages the SaaS business.

The existing modular Fastify/Mongoose application and Next client already support Organization → Clinic/location → DoctorAssignment, many OrgMembers, optional Department, Patient → Appointment → Encounter/ClinicalNote/Prescription, Invoice/AppointmentPayment, and separate SaaS Subscription/SubscriptionPayment. Provider assignments own schedules, duration, booking mode, capacity, fee policy and cabin. Organization owns workflow depth, timezone, currency, branding and communication policy. Permissions and modules are capabilities; customer size is not an authorization rule.

There is no single-doctor field on Organization. Keep these relationships and the current application architecture. Do not introduce another hospital booking model or new infrastructure. Essential registration/focused consultations are existing opt-in preferences with full defaults; retain full clinical signing, prescription safety, financial and multi-provider workflows.

## Route inventory and purpose

Frequency is expected workflow frequency, not measured telemetry. Shared route families are grouped below; every current page route is covered. KEEP means a distinct outcome exists; it does not certify every implementation branch.

| Routes | Users / frequency | Primary outcome / decision |
| --- | --- | --- |
| `/`, `/pricing` | Prospective customers / occasional | Discover platform and plans; KEEP public product information |
| `/browse`, `/browse/[id]`, `/doctor/[id]` | Patients / booking | Find organization/provider and book; KEEP discovery levels, share booking rules |
| `/join/[clinicId]`, `/check-in`, `/track/[appointmentId]`, `/queue-tv` | Patients/reception / each visit | Register, prove arrival, privately track visit, view public queue display; KEEP distinct access boundaries |
| `/login`, `/register`, `/verify-email`, `/reset-password`, `/accept-invite`, `/onboarding` | All / account setup | Establish identity and workspace; KEEP recovery and staff invitation boundaries |
| `/dashboard` | ROOT and operational roles / daily | Business overview or role-specific daily work; KEEP separate compositions, ROOT improvement already implemented |
| `/dashboard/consultations`, `/dashboard/consultations/[id]` | Reception/providers / daily | Today's work and canonical encounter; KEEP shared daily list plus clinical workspace, permission-gated actions |
| `/dashboard/appointments`, `/dashboard/queue` | Patients/staff, then operational staff / daily | Booking history/planning versus arrival/live queue; KEEP, share patient entry and visit transitions |
| `/dashboard/patients`, `/dashboard/patients/[id]`, `/dashboard/patients/[id]/timeline` | Authorized staff / daily | Identify patient, view chart and chronology; KEEP, no duplicate patient model |
| `/dashboard/patient-portal`, `/dashboard/bills` | Patients/family / per visit | Recover own records and settle bills; KEEP consumer ownership separate from staff visibility |
| `/dashboard/billing`, `/dashboard/billing/services` | Billing staff/admin / daily or setup | Invoice/payment ledger and configurable service pricing; KEEP, no second quick-payment ledger |
| `/dashboard/staff`, `/dashboard/clinics`, `/dashboard/organizations` | Admin/ROOT / setup | Team, locations and organization workspace; KEEP semantic selected-organization navigation; settings overlaps need consumer inspection before removing pages |
| `/dashboard/settings`, `/dashboard/settings/billing`, `/dashboard/settings/modules` | Organization admin or ROOT / occasional | Organization policy, SaaS purchase, platform module governance; KEEP different authorities |
| `/dashboard/admin/billing`, `/dashboard/admin/users`, `/dashboard/admin/monitor`, `/dashboard/audit` | ROOT / oversight | SaaS plans/subscriptions, global accounts, operations and audit; KEEP separate from clinical finance |
| `/dashboard/notifications`, `/dashboard/security` | Authenticated users / occasional | Updates and account protection; KEEP shared notification/overlay infrastructure |
| `/dashboard/analytics`, `/dashboard/feedback` | Permitted staff / periodic | Operational reporting and quality feedback; KEEP summaries; analytics are not SaaS cash receipts |
| `/dashboard/laboratory`, `/dashboard/radiology`, `/dashboard/pharmacy` | Relevant staff/patients / capability-dependent | Diagnostic orders/results and medicines; KEEP module gating, avoid exposing complexity to organizations that do not use it |
| `/dashboard/teleconsultation`, `/dashboard/insurance`, `/dashboard/shifts` | Relevant staff/patients / capability-dependent | Remote visits, coverage workflows and roster; KEEP existing capabilities, no new ERP layer |

## Workflow ownership

| Goal → workflow | Existing ownership | Audit conclusion |
| --- | --- | --- |
| Organization → setup → team → availability | Organization, Clinic, OrgMember, DoctorAssignment, onboarding controllers | Many providers/locations already supported; infer only a single valid choice. Retain server subscription limits and assignment validation |
| Walk-in → arrival → consultation → payment | PatientEntryModal/PatientMatchingService, AppointmentService, queue, Encounter, charge capture, invoices | Previous recovery work already retains identifiers after partial failure. Do not recreate this workflow or fabricate demographic/clinical values |
| Online discovery → booking → tracker → arrival | Public controller, canonical appointments, tracker capabilities and check-in capabilities | Tracker reads/check-in have capability gates; disruption self-service omitted that gate and must be corrected |
| Doctor unavailable → triage → transfer/cancel/reschedule | DoctorDayOverride and disruptionService | Confirmed unscoped list, first-record-only batch authorization and anonymous mutation are P0; restrict operations before side effects |
| Trial → use → expiry → purchase/renew | SubscriptionAccess/SubscriptionService, guards, payment provider, billing reconciliation | Preserve existing ownership, review previous security findings against current source; do not treat old audit entries as newly reproduced defects |
| Workspace change → reload scoped data | Auth store, clinic/module stores, QueryClient provider | Original cache clearing covered logout only; Loop B adds identity/grant boundaries and clinic/module race protection |

## Confirmed priorities: problem → impact → smallest solution

| ID | Priority | Problem / impact | Smallest correct solution |
| --- | --- | --- | --- |
| A1 | P0 | Disruption patient action accepts anonymous IDs; another visit can be changed or refunded | Require existing private tracker capability or authenticated owner/family authorization; preserve existing canonical mutation service |
| A2 | P0 | Batch triage authorizes only first record; later foreign records reach mutation service | Validate every unique bounded ID and every record/clinic/organization before any write; retain partial results only for authorized business failures |
| A3 | P0 | Override listing has no tenant filter without clinic; role allowlists bypass effective permissions on mutation routes | Scope staff lists by authorized organization/clinics, constrain consumer reads to explicit public clinic/provider data, use authoritative permission gates |
| B1 | P0 | Frontend treats organization admin as unrestricted, while backend only ROOT bypasses permissions | Align frontend helper and route access with authoritative effective grants, preserving consumer and ROOT exceptions |
| B2 | P0 | Clinic/module cached reads can survive workspace changes; concurrent clinic callers receive an unfinished list | Reset/invalidate on identity/workspace changes; discard old responses, await one shared request and allow retry |
| C1 | P1 | Triage date boundaries use server timezone rather than configured clinic timezone | Reuse existing clinic day/time helpers, cover midnight and DST without changing scheduling model |
| C2 | P1 | Several scoped reads and navigation policies need consistent recovery after module/identity changes | Verify direct consumers and failure recovery; centralize only rules whose behavior is already shared |
| D4 | P0/P1 | Disruption writes lacked atomic visit/assignment guards; payment replay could restore refunded state and partial checkout charged the invoice gross | Reuse canonical booking availability, counters and transactions; claim cancellation before side effects; share settlement and validate outstanding amount/currency/ownership |
| E1 | P2 | Replacement-provider selection made two additional database queries per provider | Batch overrides and aggregate clinic-day load; preserve response and availability behavior |
| D1 | P2 | Huge organization/team/queue screens, some full-list selectors and client aggregates | Measure actual request/payload/query patterns; add compatible pagination/projections where needed, not blanket endpoint rewrites |
| D2 | P2 | Global ROOT aggregate queries and daily workload need workload-specific indexes at growth | Review existing indexes and execution plans; no automatic production index migration |
| D3 | P2 | Department exists but assignment/workflow integration is limited | Keep optional model; add department workflow only for a real operational requirement |

## Scale and maintainability

- 1 provider: existing essential/focused options and single valid assignment keep the UI simple. 10–100 providers: retain explicit provider selection and tenant/provider/clinic references; do not silently choose a first provider for clinical actions.
- 5–50 organizations: current modular backend and bounded dashboard response are suitable foundations. 500–5,000: paginated management lists, tenant/date compound indexes, narrow projections, cancellation and controlled polling matter more than new services.
- Existing workers/outboxes handle reminders, expiry, delivery and reconciliation. Keep retries/idempotency and human review; do not add another notification pipeline.
- Existing component audit covers Button, native validation, top-center toast, overlay scroll/layers and table refinements. Treat those as completed local batches with recorded limits, not as a reason to rewrite all primitives.
- Roles are server-defined, tenant-overridden permission sets. Role labels may choose default navigation ordering; they must not replace authorization. User.role is a string in the backend; frontend role typing needs review before promising arbitrary custom role UI.
- Historical signed clinical records, invoices, existing API shapes and public capability links are compatibility boundaries. No live migration, provider payment, notification dispatch, key rotation or deployment is implied by this audit.

## Evidence and limits

Inspected route inventory, shared permission/module/auth/cache code, organization/member/provider/department models, canonical workflow documents, existing security/production trackers and disruption handlers/services. Previous dashboards/UI changes remain intact. The ledger records new implementation and targeted validation; older audit findings are references until their current behavior is checked. Full release certification still requires deployment configuration, real service health, restore/rotation procedures and authenticated journey smoke checks.

## Implemented outcome

A1/A2/A3, B1/B2, C1/C2 and the subsequently reproduced D4 payment/visit defects are addressed in the local implementation. The ledger contains the affected regression files and package checks. E1's concrete N+1 query pattern was also removed; broader scale work remains measurement driven.

| Shared rule | Owner after these changes | Compatibility / outcome |
| --- | --- | --- |
| Patient disruption authority | Existing private tracker proof and patient/family access helpers | Valid links and owners remain usable; anonymous, expired, foreign and revoked access is denied before effects |
| Staff operations | Effective server permission sets and operational record tenant checks | ROOT bypass preserved; organization admin labels do not bypass revoked grants |
| Private client data lifetime | Auth scope, Zustand stores and existing QueryClient | Identity, organization, role, grants and impersonation changes clear private cache; stale requests/socket events cannot restore it |
| Organization workflow depth | Existing workflow preferences queried by authority and organization | Full defaults remain; essential/focused modes remain opt-in and share requests |
| Scheduling/calendar rules | Existing AppointmentService availability and clinic-time helpers | Many providers and clinic-specific policies remain supported; no second booking engine |
| Visit/invoice changes | Existing clinical transaction helper, canonical Counter and current models | Concurrent reschedule/counter writes, rollback and slot collisions covered on a replica set; production requires transaction-capable MongoDB |
| Appointment payment settlement | One internal transaction function used by verify/reconcile | Captured replays preserve terminal refunds; prior invoice receipts remain; cancelled visits cannot be paid through the affected endpoints |
| Refund confirmation | Verified capture/compatible receipt plus actual provider result | Unconfirmed, mixed, cash or unsupported cases remain visible for billing review; no fabricated transaction/refund ID or completion claim |

The refund adapter follows the provider's [documented refund statuses and retry semantics](https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md). Pending provider refunds and ambiguous network outcomes still require operational reconciliation. Cancellation is persisted before the refund request, so a repeated patient cancellation cannot issue another refund. This does not promise automatic recovery from every external-service interruption.

No schema migration, clinical-history rewrite, new role engine, duplicate patient/visit model, department UI or infrastructure service was introduced. Invoice `cancelled` is now explicitly valid because the existing cancellation workflow already writes it. No live provider, production database or notification recipient was used during verification.

Remaining release work is concrete: full CI gates, authenticated browser journeys, real provider test-mode checks, worker/deployment health, backups/restore and representative workload measurements. The tenant advisory scan's 151 warnings are heuristic candidates, not 151 proven vulnerabilities or a passed isolation certification. The changed tenant paths have focused authorization and integration coverage; unrelated findings require source review before implementation.

## Continuation checkpoint - 2026-10-04

Ledger loops F-H continue the existing NEXT items. Authorized billing users now reconcile pending refunds by reading provider evidence; one matching processed full refund commits invoice/visit state, immutable audit and notification outbox together. No automatic refund retry was added. The operational contract and manual review cases are documented in `backend/docs/refund-reconciliation.md`.

Representative local provider/organization fixtures, measured response sizes and execution plans are recorded in [healthcare-scale-measurements.md](healthcare-scale-measurements.md). These replace the earlier absence of a local baseline, while concurrent load and deployed performance remain unverified. Local CI-equivalent results, the development dependency security blocker and external release requirements are maintained in [healthcare-release-verification.md](healthcare-release-verification.md). The original architecture conclusions remain intact; this continuation is not production certification.
