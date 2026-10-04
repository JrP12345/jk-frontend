# Everyday clinic workflow

## Focused audit before implementation

### Existing architecture

| Source of truth | Existing implementation | Relationship |
| --- | --- | --- |
| Organization configuration | `Organization`, onboarding settings controller/schema, organization workspace | Tenant settings; no parallel configuration store |
| Patient | `Patient`, patient controller, `PatientMatchingService`, `PatientService` | Name plus contact permits a canonical walk-in profile without a User, DOB or gender |
| Visit | `Appointment`, `AppointmentService`, appointments controller | Existing `walk-in`, `reception`, `online`, `qr` source values, availability, subscription, token and slot checks |
| Queue | Queue controller, appointment status, doctor/day consultation lock | Waiting/active/completed are projections of appointments |
| Consultation | `Encounter`, `ClinicalNote`, clinical-note controller, EncounterProvider, SOAPNoteEditor | Detailed SOAP, vitals, diagnosis, signature, amendments, orders remain canonical |
| Prescription | `Prescription`, CDSEngine, PrescriptionSealingService | Explicit dosing, safety review and sealing; no separate quick prescription model |
| Money | `Invoice`, invoice payment APIs, appointment payments, ChargeCaptureService | Fixed fees invoice at booking; post-consultation charges captured at completion when billing is enabled |
| Reports/history | daily dashboard controller, ConsultationProvider, patient timeline | Completed appointments without notes remain visits in history; financial summaries use invoice payments |

### Full flow to protect

Public Browse and staff booking both use AppointmentService. Arrival and consultation transitions use the appointments/queue APIs. Starting creates the linked Encounter. Full SOAP saves actual clinical content and signing completes the Encounter/Appointment, releases the consultation lock, seals Rx, triggers notifications and performs established charge capture. Full queue retains STAT, vitals, investigations, standby, triage, session controls and printing. Billing retains invoices, receipts and partial payments. Existing modules, memberships and permissions remain enforced.

### Small-clinic friction

- Booking's inline patient form needs DOB/gender; the Patient API already supports less data.
- Queue registration supplied a fabricated DOB and preselected gender.
- Several lists read only `patient.userId.name`, hiding standalone walk-in names.
- Consultation entry could fall back to a paginated list after a failed direct lookup and always start an encounter, including for a completed visit.
- The detailed completion endpoint automatically creates a signed SOAP document with placeholder clinical content. An explicit opt-in extension is needed to finish an actual visit without that document.
- The consultation list fetched appointments, patients, staff and summary as one dependency; failure of any optional read failed the entire screen.
- Repeated doctor/location selectors slow one-option clinics; arbitrary first choices are unsafe for several options.

### Existing configuration and proposed changes

Extend Organization's permission-controlled settings with `workflowPreferences.registration` (`full` / `essential`) and `workflowPreferences.consultation` (`full` / `focused`). Missing values mean `full`; no migration enables the new experience. Preferences change the entry point and usual UI depth, never the clinical, queue or financial domain. A limited authenticated staff read returns only these preferences and currency, not delivery credentials. Existing settings write permissions apply.

The focused Today view composes the existing paginated appointments API and daily summary. Essential entry shares patient search/create and canonical booking across consultations, appointments and queue. A created patient/visit stays selected during a failed later step so retry does not repeat successful writes. Phone/desk uses `reception` and does not mark arrival. Online continues its canonical path.

The focused tab belongs to the same EncounterWorkspace. Its completion calls the existing status API with explicit `documentationMode: optional`. The organization must enable focused consultations, the consultations module must be enabled, the actor needs clinical completion permission, and prescriptions require the attending doctor. Existing saved notes or Rx require full clinical signing. The full SOAP editor retains its required complaint, signatures, orders, vitals and amendments.

### Field classification

| Classification | Fields/actions |
| --- | --- |
| Required | Canonical Patient name + phone/email; appointment patient/clinic/doctor/time/source; valid lifecycle transition and tenant access |
| Conditionally required | Name, dosage, frequency and duration when focused medicine is recorded; CDS override justification when the existing safety gate blocks; SOAP chief complaint when saving a SOAP note |
| Optional | Focused visit note, complaint, diagnosis, prescription, patient DOB/gender when registering via the canonical Patient API |
| Derived | Patient MRN, token, organization scope, attending doctor from appointment, encounter completion timestamps, invoice balance |
| Configuration dependent | Default entry/view, valid assignments, booking mode, fees, modules, public booking availability |
| Legacy/questionable | Detailed status-completion SOAP placeholders, missing DOB treated as a made-up date, preset drug regimens, anonymous medicine pharmacy price fallbacks in consolidated checkout |

### Redundancy classification

| Decision | Area |
| --- | --- |
| KEEP | All existing models, detailed SOAP/editor, queue controls, public booking, billing/receipt/reporting, multi-doctor assignments |
| SIMPLIFY | Essential registration and focused daily view; only one valid option is inferred |
| SHARE | PatientEntryModal, preference read hook, patient identity helpers, clinic-day range, existing UI primitives |
| MERGE | Fast entry uses existing Patient + Appointment APIs, rather than adding a WalkInPatient or another visit pipeline |
| MOVE | Usual UI depth is configured in the existing organization Configuration section |
| REMOVE | Fabricated DOB/default gender in queue registration; consultation lookup fallback that could mask authorization failures; swallowed arrival failure |
| INVESTIGATE | Legacy detailed completion placeholders and consolidated billing's fallback medicine pricing; no historical clinical documents or financial records are automatically rewritten |

### Risks and implementation sequence

1. Preferences: defaults, tenant isolation, partial merge, secret-free staff read.
2. Completion: opt-in + clinical permission + attending prescriber, CAS transition, linked Encounter, Rx/CDS/sealing, audit, charge capture, idempotence.
3. Draft integrity: draft save and completion both write the Encounter transactionally; no new draft appended to a closed encounter. Terminal visits reuse their linked encounter.
4. Entry: canonical matching and registration, retained identifiers after successful writes, live assignments/availability, server validation; do not override capacity/slots automatically.
5. Daily UI: clinic-time day boundaries, server search/pagination, real statuses, existing invoice collection, currency-separated daily money summaries.
6. Verify full and focused paths, failures, permissions, identity, multi-doctor locks, online sources and finance in isolated tests. Never seed or mutate live clinic data for verification.

## User flow

Organization → Configuration → choose essential registration and/or focused consultations.

Reception: Today's patients → Add patient → search/select or name + phone → one valid clinic/doctor inferred → add visit → walk-in arrival or later phone/online arrival.

Doctor: Today's patients → Next patient / Start consultation → optional note, complaint, diagnosis or explicit medicine → Complete / Complete & next. Full clinical editor, diagnostic orders, timeline and NEWS2 remain available on this encounter.

Money: Today's patients → Payments → existing visit invoices → record actual received balance through the established invoice payment API. Billing retains fee changes, receipts and partial payments. No new no-invoice financial workflow is introduced because current accounting is invoice based.

End of day: completed visit count, waiting/active/booked/payment-pending/cancelled/no-show filters, actual invoice collections by payment date, and unpaid balance on invoices issued today. “Today's invoices outstanding” is not an all-time debt total. Financial values are hidden without billing visibility and grouped by invoice currency; counts respect clinic/doctor scope.

## Compatibility and limits

- Existing organizations retain full defaults until their settings change; existing data is not migrated.
- One valid assignment/location is inferred; several choices remain explicit and Next requires a chosen doctor.
- New UI uses existing responsive Modal, Card, Table, Input, Select, Button, Alert and Pagination. Mobile uses compact rows/cards and wrapping actions; desktop uses a compact table.
- The minimum Patient and appointment are two established API writes. If booking fails, the registered patient remains real and can be reused; this is not a new transactional registration domain.
- Clinical transactions require the application's existing production MongoDB transaction prerequisites. Isolated unit/integration tests must not be described as production rollback certification.
- Prescribing and collecting require existing permissions. Doctors without patient-management/billing permissions do not receive those actions by enabling an experience preference.
- Legacy detailed status completion remains for compatibility. The focused path never fabricates SOAP content, dosing or examination. Existing historical placeholders are not rewritten.
- Prescriptions stay canonical, sealed and available through the existing history/printing flow. The focused completion does not automatically send WhatsApp Rx; existing explicit dispatch/print controls remain available.

## Verification completed

Highest risk: Level 4 (booking, clinical persistence, permissions and invoice payments). Verification used isolated MongoDB fixtures and mocked browser API responses; no live clinic data was seeded or changed.

- Backend workflow integration: `npm test -- tests/clinicWorkflow.test.ts` — 10 passed. Starts with one active doctor assignment and later activates the second doctor for the multi-doctor regression. Covers minimum walk-in registration; no-note completion; returning patient and sealed prescription; authenticated prescription HTML with a standalone patient identity; full SOAP with vitals, diagnosis, medicine and signing; phone/desk arrival confirmation; public online booking; attending-doctor/reception permissions; encounter reuse; closed-draft rejection; payment synchronization; invoice reuse; and clinic-local midnight Call Next.
- Backend related regressions: `tests/clinicalNote.test.ts`, `tests/queueIntegrity.test.ts`, `tests/browseBookingSecurityPolish.test.ts`, `tests/clinicalContinuityAndTillClose.test.ts`, and `tests/prescriptionSafety.test.ts` passed. The final queue/safety/workflow invocation passed 20 tests across three files. Earlier passing clinical, booking-security and till-close files were not repeated against unchanged covered logic.
- Backend TypeScript: `npm run check:fast` passed. Standard disk-output build encountered access denial in the existing `dist/workers` directory. The API and all five workers compiled successfully in memory using the same esbuild entry points/options and nonempty-artifact checks; this does not certify disk-output permissions for deployment.
- Frontend: `npm test -- --configLoader native src/tests/clinicWorkflow.test.tsx` — 12 passed before the final clinic-scope fix; the affected `-t Today` rerun passed all four cases, including the added scope-change case (13 distinct cases verified). Includes patient/visit identifier retention after failed arrival, explicit multi-doctor choice, existing-patient phone booking, duplicate matches, optional completion, required explicit dosing, focused-to-full draft transfer, persisted SOAP hydration, prescription print availability, operational/clinical route permissions, canonical invoice payment, single server pagination and clinic day/DST boundaries. Switching clinics cancels the previous read and clears old patients/totals before new actions become available.
- Frontend related regressions passed: `src/tests/consultationEntryIdentity.test.tsx`, `src/tests/authAndNavigation.test.tsx`, `src/tests/workflowRecovery.test.tsx`, and `src/tests/organizationCreation.test.tsx`. Native Vitest config loading was needed because the normal config bundler could not write its cache directory. The first cold DOM readiness assertion exceeded its one-second default; its explicit three-second readiness wait now passes.
- Frontend TypeScript: `npx tsc --noEmit --incremental false` passed. Payment boundary: `npm run check:payments` passed. Changed-file ESLint reported zero errors (warnings remain in touched files). Diff whitespace checks passed in both repositories.
- Browser fixture review: Today's patients and focused consultation rendered at widths 390, 768 and 1280 pixels without document overflow. The 390-pixel entry dialog stayed inside the viewport with one scrolling body and visible footer. Reception had no clinical start/completion actions. The desktop action clipping and Table's second pagination were corrected. Complete & next issued the established completion request followed by canonical Call Next with arrival confirmation. Every API request was intercepted, including writes. These are fixture-backed visual/interaction checks, not live authenticated browser E2E or a production release gate.

The temporary browser profile, preview output, screenshots and verification script were removed after inspection. No custom preview server configuration was added to the application.
