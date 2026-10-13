# Approved healthcare CRM implementation

Scope: approved Phase 1 P0 plan. P1/P2 remain deferred. Production migrations,
provider configuration, live infrastructure, and deployment require separate authorization.
Existing unrelated working-tree edits must be preserved.

Completion requires every P0 workflow and its acceptance checks; a scaffold or
passing compilation alone does not complete a feature. Status is evidence-based.

| Item | Status | Required evidence |
| --- | --- | --- |
| P0.1 Workspace, branch authority, permission catalog and revocation | Local implementation verified; final browser/migration checks pending | Login/MFA/passkey/workspace/refresh/impersonation; tenant and branch denial; client isolation |
| P0.2 Canonical identity, registration and contact correction | Local workflow verified; final browser/migration checks pending | Minimal registration, shared phone, family, cross-org association, concurrent/retried commands |
| P0.3 Privacy and administrative DTOs | Local workflow verified; communication/browser/migration integration pending | Pure consent reads, evidence policy, scoped exports, reviewed erasure, no clinical over-disclosure |
| P0.4 Inquiry capture and ownership | Local workflow verified; task/automation/browser/migration integration pending | Capture/list/detail, next action, close/reopen, unknown sources, recovery and concurrency |
| P0.5 Inquiry-to-booking conversion | Local workflow and focused browser recovery verified; provider/pilot/release checks pending | Canonical booking, pending payments, receipts, atomic rollback and timeout restoration |
| P0.6 Organization patient relationship | Local implementation and family browser workflows verified; pilot pending | Independently reviewed organization grants, explicit recipient, separate consent, owner/branch transfer and safe paginated timeline |
| P0.7 Daily tasks and assignment | Local workflow verified; worker/browser/pilot checks pending | Own/team/unassigned queues, snooze/outcomes, reassignment, revisions and deduplication |
| P0.8 Care follow-up and appointment recovery | Local workflow verified; legacy backfill/worker/browser checks pending | Structured recommendations, no automatic confirmed booking, cancellation/reschedule/disruption and legacy review |
| P0.9 Safe communication and call history | Local workflow verified; durable/browser/migration integration pending | Evidence-aware consent, subject association, truthful delivery, suppression and failed-send recovery |
| P0.10 Durable CRM automation | Local workflow verified; browser/migration/release integration pending | Transactional events, standalone/inline registration, scheduler leases, replay/outage/timezone/expiry |
| P0.11 Operational analytics and settings | Local workflow verified; browser/migration integration pending | Scoped definitions, reconciled cohorts, timezone boundaries, simple defaults and campaigns off |
| P0.12 Feedback and existing-flow integration | Local integration verified; broader browser/pilot/release acceptance pending | Scoped feedback, canonical links, existing desk/booking/order flows remain usable |
| Migration/pilot package | Local package verified; operational execution pending | Additive compatibility, dry runs, controlled indexes/backfill, reconciliation and rollback |
| Browser and accessibility acceptance | Focused Chrome checks passed; broader acceptance pending | Critical journeys, keyboard/focus, mobile/reflow, errors and recovery |
| Release validation | Final backend release gate passed; frontend checkpoints passed; hosted CI/pilot pending | Backend 186 files/1,131 cases and 8/8 gates, native/bundled startup, types/builds and prior unchanged dependency audits; hosted CI and operational acceptance remain separate |

## Workflow coverage

See [the W01–W34 reconciliation matrix](crm-acceptance-matrix.md) for implementation
and verification sources, plus remaining browser, family and pilot acceptance.

W01 capture; W02 conversion; W03 returning caller; W04 minimal walk-in;
W05 anonymous inquiry; W06 family; W07 shared phone; W08 repeated inquiries;
W09 organizations; W10 purpose-specific withdrawal; W11 doctor disruption;
W12 reschedule; W13 cancellation/no-show; W14 incomplete visit;
W15 clinical follow-up; W16 concurrency/idempotency; W17 delivery failure;
W18 invalid/unreachable contact; W19 branch transfer; W20 suspension/expiry;
W21 staff revocation; W22 identity conflicts; W23 rights requests;
W24 worker outage; W25 timezones; W26 webhook ordering/deduplication;
W27 shared-sender routing; W28 diagnostic handoff; W29 human escalation;
W30 feedback recovery; W31 legacy/import uncertainty; W32 contact correction;
W33 payment pending; W34 partial-write/read recovery.

## Verification log

Implementation changes use the highest applicable risk level in
`docs/verification-workflow.md`. No checks or outcomes are recorded as passed
without execution. Frontend TypeScript excludes test files; backend transaction
tests require a replica set. Live provider/deployment actions are not local checks.

### P0.1 local evidence, 2026-10-09

- Password/MFA/passkey share explicit staff workspace selection; opaque selection
  challenges are single-use, expire, and bind account/MFA state. Membership roles
  and reviewed branch revisions control persisted access and refresh authority.
- Branch grants use revision checks, atomic audit and scoped session revocation.
  Existing explicit role denials remain authoritative. New CRM codes do not give
  default export or duplicate-resolution authority.
- Backend: authentication baseline 26 cases passed; branch/organization/auth
  checkpoint 43 cases passed on a replica set; MFA/passkey/workspace edge checkpoint
  19 cases passed. Role, tenant-route and permission-cache regressions also passed.
- Frontend: workspace selection/isolation/navigation 29 cases passed; branch UI
  checkpoint 21 cases passed; workspace/API boundary checkpoint 31 cases passed.
- Both package TypeScript checks passed; API and worker bundles built. Scoped
  frontend lint has zero errors. Browser acceptance and controlled migration are
  separate pending gates.

### P0.2 local evidence, 2026-10-09

- Canonical walk-in registration writes patient, organization relationship,
  activity, audit and receipt atomically. Current clients retain request identifiers
  through retries. Legacy clients without a key remain accepted; repeated legacy
  submissions require matching review instead of silent duplication.
- Shared contacts are unverified matching hints. OTP cannot attach an unlinked
  medical record by email/phone. Claims remain pending until independent identity
  review; existing-account conflicts stay quarantined without overwriting identities.
- Verified cross-organization association preserves canonical ownership and enables
  existing booking. Organization contact corrections use revisions and leave global
  login contacts untouched. Explicit branch grants scope directory reads and changes.
- Core checkpoint: 36 backend and 17 frontend cases passed. Related appointment,
  tenant, cross-organization, profile and portal checks: 33 backend and 23 frontend
  cases passed. Both TypeScript checks passed. Final UI lint/build evidence follows.
- Transaction matching uses separate bounded queries because MongoDB forbids
  `$unionWith` inside transactions: [official restriction](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unionwith/#restrictions).
- Matching/directory DTOs omit clinical fields. Broader clinical authorization,
  consent, scoped export and reviewed rights requests remain pending in P0.3.
- Final P0.2 bundle build and both diff checks passed. Scoped frontend lint passed
  with zero errors and 16 warnings, including existing page warnings and the new
  identity panel's data-loading effect warning. No browser execution is claimed.

### P0.3 implementation constraints

- Consent and rights actions require their own authority; an active booking family
  relationship alone does not grant either. Unknown or legacy unevidenced grants
  must remain unknown to communication policy.
- No request handler may immediately scrub global Patient/User identities or
  calculate a blanket retention period from a future appointment.
- The [MeitY commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
  phases the Act's provisions; the product must not label every DPDP obligation
  already operative or claim compliance certification. Clinical retention needs
  record-specific review; the [NMC provision](https://www.nmc.org.in/rules-regulations/code-of-medical-ethics-regulations-2002/1000/)
  refers to indoor patient records rather than every appointment or CRM contact.

### P0.3 local evidence, 2026-10-09

- Consent reads do not write. Legacy grants without attributable evidence remain
  unknown. Commands bind notice, actor, purpose and recipient, use revisions and
  receipts, and retain restricted evidence without changing global opt-out flags.
- Own-patient organization selection is validated before running scoped queries;
  a booking family relationship does not automatically grant privacy authority.
- Exports require explicit staff grants, scope every child resource, omit clinical
  resources without clinical permission, and return bounded pages and continuation
  cursors. Desk profile reads and demographic update responses omit clinical fields.
- Erasure intake creates a restricted activity and reuses Task for review. An
  authorized organization-wide review can erase eligible CRM contact/preferences
  and administrative notes. Shared identity, login accounts, clinical/billing
  records and restricted evidence remain subject to separate retention review.
- Final focused checkpoint: 20 backend and 11 frontend cases passed. Related
  identity/tenant/security checkpoints passed earlier. Both TypeScript checks and
  diff checks passed; scoped frontend lint has zero errors and effect/legacy warnings.
- All five API/worker bundles compiled and were verified in a fresh temporary
  directory using the standard build options. The normal dist build encountered
  denied writes to existing worker artifacts; it is not recorded as passed.
- Frontend checks used `--configLoader runner` and `--incremental false` to avoid
  denied writes to existing Vite/TypeScript cache paths. Browser acceptance,
  family delegation management (P0.6), communication enforcement (P0.9), controlled
  indexes/migration and release gates remain pending. The full plan is not complete.

### P0.4 local evidence, 2026-10-09

- Inquiry is the third and final new CRM business collection. Capture accepts an
  anonymous caller and never creates or links a login identity from contact hints.
  Repeated caller inquiries remain distinct. Sources are unknown or staff-reported;
  they are not represented as verified marketing attribution.
- Staff and branch authority scope list/detail/capture/updates. Assignees require
  live membership, account and branch eligibility. Lists, activities and eligible
  assignee choices are bounded with continuation cursors.
- Owner, branch, next action and close/reopen changes use revision checks, receipt,
  activity and audit transactions. Reopening requires a fresh next action. The UI
  shows branch timezone due times and preserves exact submitted details on retries.
- Six backend cases and 20 frontend inquiry/workspace cases passed. Both package
  TypeScript checks, scoped frontend lint (zero errors) and diff checks passed.
  New entrypoint bundling will be checked with the conversion service checkpoint.
- Task synchronization (P0.7), durable automation (P0.10), pilot controls and browser
  checks remain pending. No full-plan completion is claimed.

### P0.5 local evidence, 2026-10-09

- Conversion uses the canonical appointment service inside one receipt transaction:
  minimum patient registration, booking, invoice, inquiry linkage, activity and
  conversion event roll back together. Identity review is explicit.
- Same-command retries restore one booking; different commands serialize against
  the inquiry revision. Slot locks, availability, subscription and payment rules
  remain canonical. Payment pending is preserved in API, UI and notification copy.
- Side effects run after the outer commit. Durable recovery of the notification
  gap remains assigned to P0.10. The UI retries exact submitted details and lock.
- Canonical booking links now load a scoped administrative appointment summary.
- Fourteen backend booking/conversion cases, eight frontend inquiry/conversion
  cases and five booking-link/recovery cases passed. Both TypeScript checkpoints,
  scoped frontend lint (zero errors) and five temporary API/worker bundles passed.
  No browser execution or live provider delivery is claimed.

### P0.6 authorization review

Automatic approval review rejected changing family privacy authority to separately
reviewed organization-specific grants, stating that the exact authorization change
was beyond general P0.6 approval. Explicit approval was requested. Family grant
commands remain pending; unaffected preferences, ownership and timeline work continues.

P0.6 preferences/owner/timeline checkpoint: four backend relationship cases and
eleven frontend relationship/profile/inquiry cases passed, as did both TypeScript
checks and scoped lint. Restricted evidence and other-branch relationship details
are excluded. A fixture omitted required appointmentType and was corrected before
the affected backend file passed. Family grant consumers were restored to the
P0.3 behavior while approval is pending; no rejected authorization is enabled.

### P0.7 local evidence, 2026-10-09

- The existing Task model now supports administrative CRM kinds, canonical links,
  revisions, stable deduplication, outcomes, snooze and an unassigned queue. The
  generic Task status endpoint cannot bypass these scoped workflows.
- Each inquiry owns one current next-action Task. Capture, next action, assignment,
  close, reopen and conversion update it inside the same transaction. Recording a
  contact outcome schedules a fresh action or explicitly closes the inquiry.
- Staff claims and manager reassignment use live membership, branch and permission
  checks. Membership removal or loss of branch access hands unfinished work to the
  scoped unassigned queue atomically. Other-organization sessions remain valid.
- Twenty task/inquiry/conversion backend cases passed at the first checkpoint.
  The final revocation/organization/inquiry selection has 27 passing cases after
  correcting one fixture's HTTP method and rerunning that affected case. Thirteen
  frontend task/inquiry/relationship cases passed. Both TypeScript checks, scoped
  lint and all five temporary entrypoint bundles passed.
- Role/account change sweeps and durable scheduler recovery remain assigned to
  P0.10. Family authorization approval, browser and pilot gates remain pending.

### P0.8 local evidence, 2026-10-09

- Completing a consultation records a structured recommendation and existing Task;
  it creates no appointment or invoice. Ambiguous legacy timing and nonexistent
  daylight-saving times require review. Calendar months clamp to their last day.
- Staff explicitly arrange a booking through the canonical appointment service.
  Task, parent/child links, invoice, audit and receipt commit together. The source
  visit must already be completed and within the actor's branch authority.
- Cancellation/no-show/disruption create recovery work atomically. Reschedule or
  transfer resolves it with the real booking reference. Unpaid recovery retains
  payment pending and transfers its existing invoice without fabricating payment.
- Legacy review records actual patient authority and preserves booking/payment
  state. Unwanted active bookings require explicit canonical cancellation. The
  tracker distinguishes a recommendation, an evidenced booking and payment pending.
- The primary backend checkpoint passed 49 cases. The adjacent care/disruption/
  booking selection has 26 passing cases after correcting a legacy expectation
  that an unpaid replacement was confirmed, then rerunning the affected scenario
  with its setup scenario. The isolated scenario initially lacked that fixture.
  Thirteen frontend CRM/recovery cases and five tracker cases passed. An earlier
  tracker loading timeout passed on focused retry; no code workaround was added.
- Both TypeScript checks, scoped lint (zero errors), diff checks and all five
  temporary executable bundles passed. Legacy backfill, durable recovery of
  post-commit effects, doctor-removal sweeps and browser/pilot checks remain pending.

### P0.9 local evidence, 2026-10-09

- The explicitly approved dispatcher binds canonical patient, organization, branch,
  recipient and purpose evidence at enqueue and rechecks them before dispatch.
  Withdrawal, changed contacts, revoked staff authority and unavailable sources
  suppress old work; a later grant cannot revive an earlier withdrawn message.
- Provider acceptance, sent, delivered, read, suppressed and failed are distinct.
  An ambiguous patient email is retained for review rather than automatically sent
  again. Delivery callbacks are monotonic and independently replayable.
- Calls remain attributable staff reports. Shared-sender replies require explicit
  verified inquiry routing and never identify a patient from a phone number. STOP
  and START affect channel suppression without fabricating purpose consent.
- Prescription queue commands commit receipt, protected document capability and
  audit together. A provider receipt, rather than queue acceptance, sets dispatch.
- Core policy/dispatch: 26 passing cases. Call history: five backend and three
  frontend cases. Inbound routing/history: five backend and two frontend cases;
  related inquiry/reply consumers passed seven frontend cases. Prescription
  transaction/retry coverage passed four cases plus the actual-receipt case.
  WhatsApp regressions passed 11 integration and 14 reliability cases; queue
  consumers passed 14 frontend cases. Both TypeScript checks, scoped frontend lint
  (zero errors) and five temporary API/worker bundles passed at this checkpoint.
- Browser checks, live provider delivery and the separate family recipient
  authorization remain unverified. Durable business-event integration follows in
  P0.10. This checkpoint does not complete the full plan.

### P0.10 local evidence, 2026-10-09

- Booking, cancellation, reschedule, disruption and prescription completion commit
  encrypted communication intents inside their business transactions. API and
  standalone workers register the same awaited handlers. Replay rechecks source
  state, time, clinician, contact, consent, actor and persisted subscription expiry.
- Staff reminders are organization scoped, explicitly off by default and in-app
  only. Lease writes fence each event transaction; current task revision, owner,
  snooze, branch, membership, permission, local day and entitlement are rechecked
  before inbox delivery. Workers never provision a missing subscription.
- Scoped membership/branch/role/account commands hand unfinished CRM work to the
  unassigned queue. Changes retain other-workspace sessions. Concurrent last-admin
  removals serialize; permission checks at dispatch read current role configuration.
- Doctor removal records bounded durable review pages without changing appointments,
  payments or active consultations. Membership removal and deactivation use this
  same path. Reassignment invalidates obsolete removal events.
- Unanswered disruption creates staff review, without automatic cancellation or
  refund. Explicit cancellation commits audit and unpaid invoice changes before a
  provider call. Unknown/pending refunds remain pending and are never blindly retried.
- The seven-file checkpoint ran 90 cases: 88 passed, with two old audit assertions
  corrected for the new transaction boundary. The affected four-case refund/rollback
  retry passed. Doctor recovery passed five cases, including pagination/replay;
  revocation passed four. Role/cache regressions passed nine earlier in this checkpoint.
  Backend TypeScript, both diff checks and all five temporary entrypoint bundles
  passed. Frontend review-time copy/types and focused tracker checks passed earlier.
- No production migration, live provider send, browser acceptance or release gate
  is recorded as complete. Family authorization remains separately pending.

### P0.11 local evidence, 2026-10-09

- The operational overview uses branch-local calendar windows (up to 31 days)
  and snapshot reads. Inquiry conversion requires a canonical booking matching
  organization, patient and branch. Unreconciled conversions remain visible as
  review counts. Unknown/staff-reported sources are not verified attribution.
- Current unfinished workload is separate from capture cohorts. Snoozed work is
  excluded from due counts. Attendance denominators include completed and recorded
  no-show visits; returning history stays within authorized branches. Response time
  uses attributable staff-reported calls only. Provider costs remain unavailable
  without billing evidence, and message acceptance is not described as delivery.
- Settings use revision checks, a stable command receipt and transactional audit.
  Only reviewed organization-wide authority can change them. Campaign enablement
  is rejected. New inquiry/callback forms consume due-time defaults without
  overwriting staff edits; branch changes preserve the chosen instant.
- Staff reminders remain explicitly off by default. Enabled reminders use branch
  local hour windows and settings revisions, so delayed work cannot revive an old
  configuration. Expired/missing entitlements cannot enable automation.
- Eight analytics/settings backend cases passed, plus 12 reminder regressions.
  Six new frontend cases and nine inquiry/task consumers passed; one initial text
  assertion was corrected and passed on focused retry. Both TypeScript checks,
  scoped lint (zero errors, ten effect warnings) and five temporary API/worker
  bundles passed. Feedback recovery consumes its threshold in the next phase.
- Aggregations follow the [official MongoDB lookup contract](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/).
  Controlled index/query-plan verification, browser checks and release gates remain
  pending. No full-plan completion is claimed.

### P0.12 integration checkpoint, 2026-10-10

- Feedback uses completed canonical visits, actual patient ownership or explicit
  staff authority, strict branches and a transactional command receipt. Private
  comments are encrypted and excluded from lists, activities and recovery tasks.
  Staff reports and patient submissions remain distinct; legacy attribution is
  unknown. Low ratings consume the configured recovery threshold and task deadline.
- Patient inbox events recheck current canonical ownership, organization, branch
  and source state. Generic notification email cannot bypass the reviewed purpose
  dispatcher. Historical unpinned payment fan-out work is suppressed for review.
- Counter/verified UPI settlement records payment, ledger, audit and durable receipt
  intents together. Child messages carry the actual amount, currency and ledger
  reference, independently recheck evidence, and report actual delivery state.
  Equal partial payments have independent transaction references.
- Portal and QR booking use the canonical booking service and atomic receipts.
  QR self-declaration creates minimum details and identity review, without fake
  User/DOB/gender or matching another patient from a reused phone. Exact retries
  restore the original response. Delegated family booking retains existing booking
  authority and withholds the patient's public clinical tracker credential.
- Clients retain uncertain requests, freeze their submitted details and allow
  exact retry. Portal family selection reaches the server, scheduled booking uses
  current offered slots and canonical locks, and pending payment stays pending.
- Diagnostic handoff reuses Task and canonical LabOrder references. Clinical
  values/test names/notes/escalation stay in laboratory/clinical flows. Order and
  result writes include handoff intents in the same transaction. The diagnostic
  link remains subject to clinical permissions and the current branch filter.
  Test names no longer use the public queue broadcast.
- Note signing commits prescription intent with finalization. Authorized tracker
  reissue reuses the encrypted original token without extending expiry; explicit
  rotation still revokes it. Public prescription printing requires a completed visit.
- Evidence: feedback nine backend cases; inbox/notification/event checkpoint 33;
  receipts five plus the signed settlement scenario; canonical existing-booking
  seven cases (five initially passed, two corrected assertions passed on retry),
  plus 12 related booking/portal cases. Diagnostic integration and cabin/lab loop
  passed 12 cases; related laboratory/orders/note-signing passed 15. Tracker and
  prescription queue passed eight, with the existing public-tracker file's seven
  cases passing at its checkpoint. Read-only migration review passed two.
- Frontend evidence: feedback six cases plus its workspace consumer; booking and
  portal recovery 11; task workspace five; diagnostic source link one. Package
  types and scoped lint passed at earlier logical checkpoints; the final checks
  are running after the latest edits. Full suites, browser acceptance, controlled
  backfill/pilot and release validation remain pending. Family authorization still
  requires the separately requested approval. This does not complete the full plan.

### Final integration verification in progress, 2026-10-10

- Full frontend run: 98 files and 562 cases passed, with five files failing.
  Ambiguous custom-select queries, a missing query provider, and obsolete loading
  imports were corrected. The affected five files subsequently passed 44 cases.
  Inquiry/QR recovery passed ten cases after the browser-discovered focus fix.
- Isolated Next production build passed, including its TypeScript and route gates.
  It used a deliberately invalid public API hostname for compilation only; that
  output is not a deployment artifact. Scoped lint passed with zero errors.
- [Focused Chrome browser checks](crm-browser-acceptance.md) verified actual
  staff/patient/anonymous rendering, mobile bounds, inquiry focus and a committed
  inquiry with a dropped response followed by exact retry. Broader acceptance is
  still pending; this is not complete E2E coverage.
- Diagnostic/laboratory/orders/review-backfill checkpoint passed 20 cases. Two
  additional route tests verified audit-failure rollback of order/result, visit
  projection and handoff. The read-only index preview passed without a connection
  or index write. Guarded review backfill initially passed four transaction cases;
  reviewed relationship initialization is undergoing its additional checks.
- Full backend run: 165 files and 1,057 cases passed; 27 cases failed across 18
  files, plus three suite setup failures within that total. Repairs and focused
  reruns are in progress. The entire backend gate is not recorded as passed.
  Old automatic WhatsApp STATUS/DELAY/RX expectations were corrected and all three
  affected cases passed. The payment receipt assertion passed on focused retry.
- P0.6 family authority approval remains pending. Migration execution, production
  indexes/query plans, live pilot/providers and release authorization remain separate
  pending gates. No full-plan completion is claimed.

### Integration repairs and final local evidence, 2026-10-10

- Queue pacing and delay alerts now commit durable communication intents with
  their source markers. Unknown external consent does not roll back a patient's
  own inbox update. Each channel rechecks current evidence, recipient, actor,
  branch, visit state and branch-local visit day. Delay templates use the recorded
  delay, with no invented estimate. The queue/event checkpoint passed 21 cases.
- Manual tracker resend requires queue and patient-communication authority, a
  canonical current recipient and evidenced channel choice. It records one
  encrypted message, minimal audit and command receipt in the same transaction.
  Exact retries restore the actual message state. SMS and unreviewed alternate
  recipients are rejected. Manual resend does not enable automatic turn alerts.
  Clients freeze uncertain submissions through close/reopen, focus retry errors
  and clear pending UI on workspace/authority changes.
- Public clinical summaries and prescription printing require completed canonical
  encounters and finalized notes with matching organization, branch and patient.
  Foreign prescription references are excluded. Legacy medication arrays cannot
  supply invented frequency or directions; missing advice/signature evidence stays
  unavailable. Portal history exposes bounded booking metadata under current own
  or active family booking authority, without retaining revoked booked-by access.
- Platform role changes on existing staff identities require an explicit workspace.
  Booking/role checkpoint: four files and 33 cases passed. Latest policy, dispatch,
  tracker and public-prescription checkpoint: six files and 56 cases passed.
- Lab status transitions retain their original expected state across transaction
  retries and return the committed document. A deliberately injected transient
  error reproduced the original failure, then passed after the fix. Related order,
  laboratory, handoff and OPD checks passed four files and 23 cases, including
  audit-failure rollback and exact handoff counts.
- Reviewed backfill now supports missing same-organization relationship
  initialization with unknown contact/consent and unassigned ownership. Existing
  relationships and foreign-owned identities are never inferred or overwritten.
  All six backfill and two read-only review cases passed. The three legacy branch
  fixture files passed after restoring explicit grants and valid registration
  inputs. The broader 14-file repair checkpoint had passed 82 cases before those
  final fixture repairs; its remaining failures were subsequently resolved.
- Final full frontend run: 102 files/603 cases passed; one nested-dialog focus
  case failed. Delayed initial focus could overwrite an already-focused child
  trigger. The corrected hook and affected queue/inquiry/feedback/control consumers
  subsequently passed five files and 63 cases. Latest scoped lint: zero errors,
  ten existing warnings. Application TypeScript passed with incremental cache
  writes disabled after the ordinary cache write was denied by filesystem access.
- Final serial backend run: 182 files/1,104 cases passed; three cases failed in
  tracker resend and laboratory status. The tracker fixes passed the 56-case
  checkpoint above; the lab conflict was reproduced and fixed in the 23-case
  checkpoint. The complete full run itself is not labeled green. Earlier full-run
  failures across 18 files were repaired and verified in affected reruns.
- Both repositories' final type checks passed. The isolated Next production build
  passed before the final local focus/permission edits; the later frontend type,
  lint and affected tests passed. Final API and four worker bundles passed after
  backend edits. No production output, migration, index, provider or deployment
  was applied. Temporary browser/API/Next harnesses were stopped and generated
  isolated Next type references were restored.
- [Actual Chrome acceptance](crm-browser-acceptance.md) includes mobile queue
  bounds, dialog/error focus and a committed tracker message with a dropped
  response, frozen recipient and exact close/reopen retry. No provider was sent a
  real patient message. [W01–W34 reconciliation](crm-acceptance-matrix.md) identifies
  every remaining acceptance gate.
- P0.6 organization family authorization still awaits the separately requested
  approval; its new consumers remain disabled. Complete browser journeys, approved
  snapshot/manifest, live index/query-plan checks, provider/pilot, rollback drill
  and clean CI/release gates remain open. The whole plan is **not complete**.

### Role, workspace and browser acceptance continuation, 2026-10-10

- P0.1 role lifecycle: assigned custom roles cannot be deleted until their staff
  are reassigned; unused-role deletion and its audit share a transaction. Platform
  permission edits for a role used by organization staff require a selected
  organization, preserving the existing scoped CRM handoff. Assignment pins the
  configured role inside its transaction, including custom staff creation and
  invitation acceptance. Actual competing assignment/deletion cannot leave a
  dangling role; a deleted invitation role cannot create an account or membership.
- CRM workspaces, reports, settings, calls, messages and replies now reset private
  reads/forms on effective identity, role, permission or impersonation changes,
  including changes within the same organization. Backend revocation and direct
  frontend regression checks remain independent of this UI reset.
- Actual multi-session browser work exposed an additional branch-selector gate:
  CRM-only staff were calling the facility administration API. `/api/crm/locations`
  now returns only authorized active branch IDs, labels and effective timezones
  under `VIEW_CRM`, with bounded validated pagination. CRM selectors read every
  page up to 1,000 branches and report a narrower-workspace review if that bound
  is exceeded; they do not silently omit branches or acquire facility grants.
- P0.5 conversion now retains its immutable submitted source, patient, time and
  request in the current workspace after closing the dialog. A resume action
  restores the same command, including task bookings. Authority changes discard
  it, and stale responses cannot update a replacement workspace. Explicit
  validation rejections allow correction; uncertain commands stay frozen.
- Actual 390-pixel browser checks found internal conversion-field overflow and
  missing conversion/feedback error focus. Fieldset width and error focus repairs
  passed the complete browser response-loss and close/resume checks. Conversion
  restored the original patient/appointment with the configured payment still
  pending; returning-caller search still required independent identity review.
- P0.12 feedback: an actual patient submitted a low-score survey, lost its
  committed response, and restored exactly one survey. Staff opened that original
  survey, accepted its recovery assignment and recorded one service outcome.
  The existing optional feedback module was explicitly enabled in the synthetic
  fixture for the complete staff route. Earlier disabled-module/shared-tab
  attempts are excluded from successful acceptance.
- Two administrator browser contexts submitted stale settings together: one
  committed and one received the revision conflict, with automation remaining
  disabled. One staff identity in two employer contexts then lost one membership:
  that session returned 401, its private work cleared and became unassigned; the
  other session returned 200 and retained its employer's work.
- Final P0.12 edges: portal-history pagination rejects malformed/out-of-range
  queries with 400. Competing laboratory status changes produce one committed
  audited transition and one 409 review conflict; the earlier driver-retry fix
  remains covered. Scoped backend edge checks passed four files/27 cases; branch
  and revocation checks passed two files/18 cases, with role/organization consumers
  also passing. Latest backend TypeScript and five isolated executable bundles
  passed. Frontend branch/workspace checks passed seven files/36 cases; the final
  branch-limit change passed its five files/20 cases. Conversion, feedback and
  follow-up consumers passed affected checks, including the corrected focus
  timing assertion. Latest frontend TypeScript passed; scoped lint had zero
  errors and existing effect warnings. No full CI/release green result is claimed.
- [Browser observations](crm-browser-acceptance.md) and the
  [W01–W34 matrix](crm-acceptance-matrix.md) now close the locally observed inquiry
  conversion, returning-caller, feedback and multi-session revocation journeys.
  P0.6 family organization authority still awaits its separate approval. Remaining
  clinical/booking/branch-switch browser acceptance, approved snapshot/manifest,
  live query plans/indexes, provider/pilot, rollback drill and clean release gates
  remain open. The entire plan is **not complete**.
- Isolated browser/API/Next processes were stopped after verification; only the
  generated acceptance type-reference entries were restored. Unrelated working
  tree changes remain preserved, and both final diff checks passed.

### P0.6 approved family implementation and final local checkpoint

Observed checks below ran on 2026-10-10; reconciliation continued on 2026-10-12.
The user specifically approved organization family-authority implementation for
local code/synthetic tests and the frontend npm metadata audit. P0.9 dispatch
approval from the earlier turn remains in force. Neither approval authorizes a
production migration, provider configuration, deployment or live patient dispatch.

- P0.6 now records independently reviewed communication, consent and data-rights
  grants per organization. Governance plus identity-review permission, current
  canonical patient/branch scope, a separate reviewer, revision checks and atomic
  receipt/audit/activity protect each review. Current authority is pinned in
  delegated writes; live role changes are serialized with review. Legacy global
  family flags and booking rights do not grant the new organization purposes.
- The operator explicitly selects a reviewed family recipient. Recipient and
  per-organization grant revision bind channel/purpose evidence; revoked, changed
  or unavailable recipients are suppressed. Family service communication cannot
  carry clinical documents, private tracker credentials, invoice capabilities or
  prescription messages. Revoking and regranting consent authority does not
  resurrect consent recorded under an older grant revision.
- Family portal choices follow the exact consent/data-rights grant. A consent-only
  delegation works without requesting export/history authority. Family_member
  accounts load their family list directly rather than being blocked by the
  patient-only personal clinical-profile endpoint. Booking-only family cards and
  updates no longer expose or change existing clinical facts. Privacy/identity/
  relationship state resets on the complete authentication scope.
- Administrative patient association and relationship editors use bounded,
  minimal authorized branch pages rather than facility-administration records.
  The dashboard header now gates its facility request/selector by VIEW_LOCATIONS;
  actual CRM-only clinical/diagnostic handoffs then render without permission
  error notifications. Existing reviewer branches and booking rights stay scoped.
- Actual Chrome checks passed independent family review with committed response
  loss/close/resume/exact retry; explicit recipient and fresh consent; family
  consent with ungranted export denied; canonical relationship/owner transfer;
  two-employer workspace switching; minimal registration without invented DOB;
  clinician recommendation reaching CRM-only desk; required-fee reschedule and
  cancellation; laboratory sample/result handoff without private result values;
  and two desk operators competing for one inquiry conversion with one winner.
  Family views reflow at 390 pixels. Detailed limits are recorded in the browser
  acceptance document and W01–W34 matrix, rather than treating partial handoffs as
  complete patient-to-clinician-to-desk journeys.
- Backend focused checkpoints passed: seven files/51 cases; communication/family
  four files/42 cases; family/consumer four files/29 cases; final family/revocation/
  reset three files/25 cases. The reset fixture now waits for model initialization
  before its deliberate collection drops; production reset code is unchanged.
  Backend TypeScript and isolated API plus four worker bundles passed. Backend
  npm audit found zero vulnerabilities.
- Frontend full checkpoint passed 106 files/627 cases. Later portal changes passed
  the affected seven cases; the final header/workspace checkpoint passed four
  files/25 cases. Full lint had zero errors/282 existing warnings; final changed
  header files had zero errors/two warnings. Final application TypeScript passed
  using an isolated incremental cache after the ordinary cache write was denied.
  The explicitly approved frontend npm audit found zero vulnerabilities. The
  isolated Next production build and the 2026-10-12 completion build both passed;
  the latter includes the final header change. These compile checks use synthetic
  API URLs and do not establish deployment/provider readiness.
- The completed backend release auditor passed 185 files/1,124 cases and all eight
  gates. That full checkpoint precedes the final disruption, booking-receipt and
  courtesy fixes below. Their focused consumers, types and bundles passed;
  hosted CI must validate the final tree before release. Interrupted or rejected
  earlier manifests do not establish approval.
- Remaining acceptance includes the unobserved browser edges listed in the matrix,
  independently reviewed delegation evidence in the pilot, approved snapshot and
  backfill manifest/write window, index/query-plan reconciliation, worker restart,
  provider callbacks/payment delivery, deployed pilot and restore/rollback drill.
  P1/P2 remain deferred. The entire plan is **not complete** until these gates pass.

### Attendance and clinical continuation, 2026-10-12

- Closed a remaining P0.8 UI gap: authorized staff can explicitly record a no-show
  for a past pending/confirmed visit. Payment-pending, arrived, standby, ongoing,
  completed and future visits do not offer that action. Confirmation distinguishes
  nonattendance and leaves invoices/payment review separate; the existing scoped
  status endpoint creates the recovery task.
- Closed a P0.12 display gap: the operational dashboard's mobile and table rosters
  now use the canonical recorded patient name for people registered without a
  login account, instead of labeling them Patient Profile or Self.
- Scoped attendance/booking checks passed four files/32 cases. The subsequent
  roster/attendance checkpoint passed its new roster cases and related boundaries;
  one existing entry initialization assertion exceeded its one-second wait under
  load. Matching the related test's three-second initialization window retained
  the exact retry assertions; the affected entry file then passed all 14 cases.
  Changed-file lint had zero errors (eight existing appointment warnings and one
  roster warning). Application TypeScript passed with a separate cache. The final
  production compile includes both the no-show action and canonical roster change.
- Actual Chrome evidence now includes linked clinician investigation, laboratory
  result, same-visit resumption and OPD closure preserving incomplete clinical work.
  The actual desk received-cash/no-show sequence was reconciled against the API:
  canonical status no-show, existing invoice paid, balance zero and recovery task
  present. This is a synthetic cash ledger check, not payment-provider acceptance.

### Final local closure, 2026-10-12

- Disruption triage records structured original attendance status. Legacy records
  remain uncertain for review; notes cannot establish attendance. Cancellation
  copy reports the committed state and leaves refunds and delivery to reconciliation.
  Clinical queues and completion dialogs also use the canonical patient's name.
- Minimum-entry staff booking now supports an optional recorded command receipt.
  Registration/booking keys and submitted time remain immutable across uncertain
  responses and close/resume. Encrypted responses, current branch/doctor authority,
  transaction rollback, deferred effects and workspace changes are checked. Actual
  dropped-response browser recovery created one patient and one pending visit.
- Existing seven-day courtesy follow-up now sets the visit amount to zero and
  leaves payment-pending state coherently with its zero paid invoice. Required-fee
  behavior remains covered. Actual clinician-to-desk explicit courtesy booking
  passed after correcting the inconsistent state observed in the first attempt.
- After the full checkpoints above, backend presence checks passed four files/61
  cases; booking consumers passed three files/25 cases; final courtesy, receipt,
  conversion and booking checks passed four files/32 cases. Final backend types
  and the API plus four worker bundles passed. Frontend queue/presence checks passed
  three files/12 cases and entry consumers three files/24 cases. Changed-file lint
  had zero errors; application types and the latest Next production build passed.
  Both package security audits reported zero vulnerabilities.
- Actual password/TOTP/workspace and virtual-passkey/TOTP/other-workspace checks
  passed, as did repaired disruption triage/cancellation and booking recovery.
  Detailed observed limits are retained in the browser document and W01-W34 matrix.
- Local implementation is closed for this session. Final-tree hosted CI, remaining
  browser edges, approved migration/index/query-plan reconciliation, worker restart,
  provider callbacks, deployed pilot and restore/rollback acceptance remain open.
  P1/P2 remain deferred; the entire plan is **not complete** until those gates pass.
- Temporary local Next, synthetic API/replica-set and isolated Chrome services were
  stopped. Generated acceptance/build type references were restored; unrelated
  working-tree changes remain preserved. No deployment or live dispatch occurred.

### Node 24 startup correction and release validation, 2026-10-12

- Fixed native strip-only startup in `PatientCommunicationPolicy`,
  `CommandReceiptService` and `WorkspaceService`: explicit fields and constructor
  assignments preserve error reason/status/details without TypeScript parameter
  properties. A native-parser scan passed all 636 TypeScript source/test files.
- Enabled `erasableSyntaxOnly` in backend TypeScript so unsupported runtime syntax
  fails the existing type/release gate. Added `check:startup:source` alongside the
  bundled startup probe, and both probes to backend CI and release workflows.
- API plus four worker bundles built successfully. Both native source and built
  API passed production-configuration validation, invalid Redis rejection,
  isolated replica-set bootstrap/readiness/liveness, duplicate-port rejection and
  graceful shutdown/port release. Installation behavior also passed. No real
  database, Redis, provider or patient communication was used by these probes.
- Final-tree backend release auditor passed all eight gates: 186 test files/1,131
  cases and zero TypeScript errors. The local `release_manifest.json` records
  `release_gate: approved`. This is an engineering checkpoint, not approval of a
  deployed production environment. Frontend source/dependencies did not change in
  this correction, so its previously passing checks are retained rather than repeated.
- After the user clarified the environment is development, read-only checks of
  the existing local API returned HTTP 200 for liveness and readiness, with database,
  bootstrap and configuration ready. This confirms the corrected source is working
  in the user's running development app, separately from the synthetic probes.
- Source and bundled startup probes cleaned up their temporary API/database
  processes, and the full auditor exited successfully. Final diff checks passed
  in both repositories. No production database change, deployment or live dispatch
  was performed. Remaining browser/device, hosted CI and operational acceptance
  stays explicitly open in the matrix; P1/P2 remain deferred.

### Development CRM access repair, 2026-10-12

- The user's development database retained pre-CRM global built-in roles. They
  lacked `VIEW_CRM`; Login as correctly used those stored permissions. Default
  seeding intentionally preserves existing roles, so a restart did not add grants.
- Added an explicit development-only default-role upgrade. Only exact unchanged
  version-one global system defaults qualify; empty/customized roles and tenant
  overrides remain authoritative. Applying requires active root, an exact database
  confirmation and a transaction-capable database; version checks, audit and cache
  invalidation accompany each change. It never runs during startup or auth reads.
- Previewed and applied to the user's confirmed development database `test`:
  admin, doctor, receptionist, nurse and location_manager defaults updated once.
  The existing organization doctor override was preserved. A subsequent preview
  found no eligible updates. No patient records or branch grants were changed.
- Root navigation now includes Patient relationships. `/dashboard/crm` offers
  explicit organization selection for root without a selected organization, using
  the existing server-verified workspace switch. Login as remains limited to the
  impersonated member's effective authority. The role-list endpoint now seeds
  missing roles from the same canonical defaults as onboarding.
- Backend authority/impersonation/upgrade checks passed three files/21 cases;
  final upgrade/role-governance checks passed two files/12 cases, including audit
  rollback, explicit denials and idempotency. Backend types and all five bundles
  passed. Frontend CRM/workspace checks passed two files/22 cases and navigation
  seven cases. Changed-file lint had zero errors/seven warnings. The first new
  test needed a router mock; a worker-start timeout was rerun with one worker.
  Frontend application TypeScript and both final diff checks also passed.
  No complete release suite was repeated for this scoped access repair.
