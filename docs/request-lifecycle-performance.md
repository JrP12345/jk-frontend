# Request lifecycle performance review

Reviewed 2026-10-15 across the frontend and sibling backend checkout. Changes are limited to existing request paths and one compound index. No infrastructure, dependencies, patient-data cache, or financial write behavior was added.

## Implemented changes

| Evidence in the existing code | Change | Preserved behavior |
| --- | --- | --- |
| `TodayPatients` fetched a paginated visit list alongside daily-summary, which independently fetched and populated up to 100 appointments. Detailed consultations also discarded those summary rows. | Add optional `includeAppointments=false` to daily-summary and use it in these two consumers. Skip that find/populate operation entirely. | Existing callers receive the original response by default. Authoritative status aggregation, financial aggregation, authorization, and response fields remain intact. |
| `TodayPatients` executed two requests every 30 seconds in hidden tabs. | Skip hidden polling and refresh immediately when visible. Coalesce visibility/focus events within 250ms. | Visible polling remains 30 seconds; manual refresh and post-mutation refresh still fetch current values. No stale patient cache is introduced. |
| Queue delay status populated every day's patient and linked user, even when none qualified for an alert. It hydrated full appointment documents. | Project only scheduling/notification fields, use lean appointments, then populate contact details only for delayed pending/confirmed bookings. | Queue order, active-consultation elapsed time, checked-in patients ahead, alert threshold, notification metadata, and name/phone fallback remain unchanged. |
| Staff medical-record views requested the first organization-wide invoice page, then discarded other patients' invoices in the browser. | Pass the existing server-side `patientId` filter. Keep the defensive client filter and cancellation. | Backend tenant/location authorization and portal/family ownership checks are unchanged. The result remains paginated; this does not claim to load every historical receipt. |
| Default staff clinical history filters organization/patient, includes all note versions, and sorts by `createdAt`, `_id`. The existing organization/patient/isLatest index cannot provide that order with isLatest unbound. | Add `clinical_history_by_patient`: `{ organizationId: 1, patientId: 1, createdAt: -1, _id: -1 }`. | Existing indexes, cursor ordering, revision visibility, patient access approval, and cross-organization audit logic remain intact. This index targets organization-scoped history, not approved all-organization history. |

Implementation paths: frontend `src/components/appointments/TodayPatients.tsx`, `src/app/(dashboard)/dashboard/consultations/page.tsx`, `src/components/ehr/PatientMedicalRecords.tsx`; backend `controllers/dailyDashboard.ts`, `controllers/queue.ts`, `models/ClinicalNote.ts`.

## Bounded measurements

The backend measurement file is `tests/requestLifecyclePerformance.test.ts`. It runs against the existing isolated MongoDB memory replica-set setup, with synthetic tenants and no external services. Results below are observed operation counts, uncompressed JSON bytes, and Mongo execution statistics. They are not production latency, wire-transfer, memory, throughput, or cost measurements.

| Scenario | Before | After |
| --- | --- | --- |
| Daily summary: 100 visits, each with about 3KB of synthetic consultation context | 428,938 response bytes; 1 appointment find plus population | 355 response bytes; 0 appointment finds/population |
| Queue delay status: 100 checked-in visits, no eligible alerts | 1 patient find + 1 linked-user find for population | 0 contact-population finds |
| Scoped clinical-history page: 4,000 notes across two tenants, 2,000 matching, 21 returned | 2,000 documents and 2,000 index keys examined; blocking sort | 21 documents and 21 keys examined; no blocking sort |

The daily-summary comparison uses the default full response versus the new opt-out on the same fixture. Counts and finances must match exactly. The fixture includes a payment today against an older invoice, a partially paid invoice created today, and another tenant's invoice; expected collections are INR 350 and outstanding INR 400.

The queue baseline reproduces the previous find/populate shape on the same fixture. These are two batched reads, not an N+1 query claim. Appointment and duration reads are still required. Separate checks verify delayed contacts and patient-profile fallback.

The history baseline hints the pre-existing compound index, while the optimized comparison hints the new one. An additional unhinted explain verifies that Mongo chooses a plan examining 21 documents without a blocking sort. Both plans return the same IDs, including equal-createdAt ordering.

The frontend hidden-tab test invokes 60 timer callbacks and observes zero API calls, followed by exactly two calls when visibility and focus return together. The previous code issued two calls per callback, equivalent to 120 calls over those 60 intervals. Browser background timer throttling can change actual elapsed time and request volume.

## Other inspected paths and remaining costs

- **Live queue:** The queue screen already coalesces reads and pauses hidden polling. One visible refresh still uses queue/status, then override/triage/delay requests. Queue/status/delay repeat some scheduling reads. Consolidating these needs a shared snapshot contract and freshness/error semantics; it was not necessary for the selective-contact improvement.
- **Daily financial summary:** The existing aggregation still considers historical invoices because a payment today can belong to an older invoice. A simple createdAt restriction would undercount collections. Any further reduction needs production explain data and coverage for legacy paymentDate, embedded payment dates, partial payments, currencies, and outstanding balances. No cached balances or speculative finance indexes were introduced.
- **Visit search:** Search bounds terms and scopes candidate IDs to authorized appointments, then performs batched patient/user matching. This is not per-result N+1, but the matching stages and unanchored regex can be expensive for large scopes. Patient directory search also has relationship/user lookups before its paginated facet and a 5-second query bound. No blind text index was added: it would not automatically solve the existing substring/linked-field semantics.
- **Repeated summary refresh:** Search, status, and page changes in `TodayPatients` still refresh summary values as well as the list. The new option removes unused rows, but those aggregates remain live. Separating their lifecycles requires preserving post-mutation and scope-change behavior; no long-lived financial cache was added.
- **Dashboard pagination:** Some older dashboard lists/fallback calculations consume the default first page of generic appointment/invoice endpoints. The authoritative daily summary remains the primary source of daily totals. The dashboard still consumes recentAppointments, so its full-summary request was deliberately retained. Broader dashboard list/count semantics need a separate correctness change, rather than increasing page limits.
- **Billing:** Invoice listing already supports patient filtering, bounded pagination, lean results, and a compound organization/patient/createdAt index. The medical-record caller now uses that existing path. Payment idempotency, transaction behavior, and refund reads were not changed.
- **Connections and server resources:** `db.ts` already shares one Mongoose connection per process with bounded pools, idle/wait timeouts, command latency, and pool checkout metrics. Pool demand multiplies across processes/workers. No pool reduction or concurrency increase is justified without saturation and memory measurements. Compression already applies to larger responses; reducing source data also removes query, hydration, and serialization work before compression.
- **Cache boundaries:** Authenticated responses use no-store. The frontend query client clears on logout/context changes; location lookup already deduplicates concurrent reads. No global patient cache or tenant-agnostic request memoization was introduced.
- **Next rendering/bundles:** Patient medical records are already dynamically imported by their route consumers; public pricing is deferred, and package import optimization is configured. Authenticated operational data still comes from client API requests. No bundle profile demonstrated another priority, so no rendering rewrite, additional lazy boundary, image change, or production build was added for this request.
- **Background work:** Existing workers are present. These bottlenecks are redundant reads and sorting, so adding a worker or queue would not address them.

## Verification and deployment scope

Highest risk: Level 4, because the reads include patient data, queue state, and financial totals. Focused checks passed:

- Backend: `npm test -- --configLoader native tests/requestLifecyclePerformance.test.ts tests/queueOperationsAndDelay.test.ts tests/locationWorkflow.test.ts` (19 cases across the selected files; the new measurement file was rerun after test-fixture corrections).
- Frontend: `npm test -- --configLoader native src/tests/locationWorkflow.test.tsx src/tests/patientMedicalRecordsLoading.test.tsx src/tests/consultationArrivalConfirmation.test.tsx` (22 cases); the hidden-polling case was rerun after event coalescing.
- Frontend ESLint on changed source/test files, frontend TypeScript, backend `npm run check:fast`, and diff checks passed. No full suite, production build, browser E2E, load test, or live database operation was run.

The compound index is declared in the model and created in the isolated measurement database. Production gains from that index begin only after it exists in the deployed database. Follow the existing index deployment policy; `scripts/prepare-database-indexes.ts` supports preview and guarded maintenance application. It was not run against a live database. The index adds one compound entry per clinical note, a deliberate write/storage tradeoff supported by the measured read plan.
