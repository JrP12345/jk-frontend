# CRM workflows, communication and acceptance

Current P0 workflow boundaries and dated local acceptance evidence. P1/P2 and unobserved browser/provider/operational journeys remain deferred or open. [Operational review tools and pilot procedures](crm-migration-pilot.md) are separate from ordinary fresh installation setup. Current role-tool removal remains pending explicit approval in the [cleanup plan](pre-production-cleanup.md).

- [Workflow and remaining-acceptance matrix](#workflow-and-remaining-acceptance-matrix)
- [Observed synthetic browser journeys](#observed-synthetic-browser-journeys)
- [Shared communication boundary](#shared-communication-boundary)

## Workflow and remaining-acceptance matrix

This records the implemented workflow boundaries and their verification sources.
The dated browser observations below record executed journeys; a test filename is not by itself
proof of a completed live or browser journey. Full local runs completed; their
failures were corrected and the affected checks passed, as recorded in the previous local checkpoints.
All rows remain subject to the controlled pilot and release gates. P1/P2 are deferred.

| Workflow | Local implementation and verification sources | Remaining acceptance |
| --- | --- | --- |
| W01 Capture inquiry | `crmInquiry`, `crmInquiryWorkspace`; atomic receipt, branch and owner checks; actual mobile browser capture/retry | Pilot |
| W02 Convert inquiry | `crmConversion`, `crmInquiryConversion`, `crmInquiryWorkspace`; canonical booking, invoice and atomic linkage; actual browser commit/response loss/close/resume with the same identity and booking | Pilot |
| W03 Returning caller | `crmPatientIdentity`, `crmInquiry`, `crmConversion`; actual browser matching hints, independent identity review and reuse of the canonical patient | Pilot |
| W04 Minimum walk-in | `crmPatientIdentity`, `crmExistingBookingFlows`; no fake login, DOB or demographic facts; actual minimal desk registration creates one canonical patient and required-fee visit remains payment pending | Same new patient's clinical handoff; pilot |
| W05 Anonymous inquiry | `crmInquiry`, `crmCallHistory`; inquiry without creating a patient | Pilot |
| W06 Family | `crmFamilyAuthority`, `crmExistingBookingFlows`, `crmPrivacyAuthority`, `crmCommunicationPolicy`, `familyAuthority`, `patientPrivacyControls`; separate organization purposes, revision-bound consent, revocation and clinical capability denial; actual reviewed recipient and delegated-consent browser checks | Pilot, including independently reviewed delegation evidence |
| W07 Shared phone | `crmPatientIdentity`, `crmExistingBookingFlows`; independent identity review, no phone-based clinical association | Pilot |
| W08 Repeated inquiries | `crmInquiry`; shared caller contact does not merge inquiries or patients | Pilot |
| W09 Organizations | `workspaceAuthority`, `crmAuthority`, `crmPatientIdentity`, `crmCommunicationAuthority`; membership roles, explicit branch grants, minimal CRM branch choices and reviewed cross-organization association; actual workspace switch, password/TOTP and virtual-passkey/TOTP sign-in preserve each employer's authority | Impersonation, broader device coverage and pilot |
| W10 Purpose withdrawal | `crmCommunicationPolicy`, `crmCommunicationDispatch`, `dpdpCompliance`; evidenced independent purpose checks before queueing and dispatch | Authorized provider/pilot checks |
| W11 Doctor disruption | `crmCareFollowUp`, `crmDoctorRecovery`, `disruptionIntegrity`; structured original attendance status, legacy uncertainty, durable continuations and actual refund state; actual absence cockpit and cancellation avoid inferred attendance or refund/delivery claims | Pilot |
| W12 Reschedule | `crmCareFollowUp`; preserves canonical invoice and pending payment; deduplicates recovery; actual desk browser reschedules required-fee visit to the next branch-local day with payment pending | Pilot |
| W13 Cancellation/no-show | `crmCareFollowUp`, `appointmentNoShow`, appointment/queue regressions; actual cancellation confirmation and paid canonical visit explicitly marked no-show, recovery created, paid invoice/balance preserved | Pilot |
| W14 Incomplete visit | `crmCareFollowUp`, `crmTrackerReissue`; cannot complete a visit by booking follow-up or disclose unsigned notes; actual linked investigation resumes the same visit and closing OPD preserves its incomplete consultation for clinician review | Pilot |
| W15 Clinical follow-up | `crmCareFollowUp`, `crmCareFollowUpReview`; structured, reviewed calendar recommendation; actual clinician-to-desk explicit courtesy booking has a confirmed visit, no required payment and coherent zero paid invoice; required-fee cases verified separately | Pilot |
| W16 Concurrency/retry | `crmConversion`, `crmTasks`, `crmInquiry`, `crmExistingBookingFlows`; simultaneous commands and immutable retries; actual inquiry/tracker/conversion/feedback response loss, concurrent settings and two actual desk operators competing to convert one inquiry produce one booking and an explicit conflict | Pilot |
| W17 Delivery failure | `crmCommunicationDispatch`; permanent failure recovery, acceptance versus delivery, ambiguous attempts withheld | Authorized provider checks |
| W18 Contact unavailable | `crmCommunicationPolicy`, `crmRelationship`; invalid/unreachable contact and do-not-contact suppression | Pilot |
| W19 Branch transfer | `crmCommunicationPolicy`, `crmTasks`, `crmAuthority`; current branch rechecks and handoff of removed-branch assignments; actual operator transfers canonical organization relationship and owner with an activity | Branch-grant removal browser handoff; pilot |
| W20 Suspension/expiry | `crmAutomation`, `crmAppointmentEvents`, `crmAnalyticsSettings`; no automation on inactive entitlement, revoked configuration or workspace | Pilot |
| W21 Staff revocation | `crmRevocation`, `crmTasks`, `workspaceAuthority`; assigned-role deletion/global permission edit guards and serialized assignment; actual two-employer browser revocation, private-state clearing and unassigned work | Pilot |
| W22 Identity conflicts | `crmPatientIdentity`, `crmConversion`, `crmExistingBookingFlows`; explicit conflict review and no contact-based identity takeover | Pilot |
| W23 Rights requests | `crmFamilyAuthority`, `crmPrivacyAuthority`, `dpdpCompliance`, `patientPrivacyControls`; exact organization consent/data-rights grants, transactional authority pin, scoped export and reviewed retention decision; consent-only family export denied in actual browser session | Operational retention review and pilot |
| W24 Worker outage | `crmAppointmentEvents`, `crmDoctorRecovery`, `crmAutomation`, `crmPaymentReceipts`; transactional intent, bounded continuation and replay | Separate worker-process restart in pilot |
| W25 Timezones | `crmAnalyticsSettings`, `crmCareFollowUp`, `crmAutomation`, `queuePacingIntegrity`; branch dates, DST/calendar boundaries and stale queue suppression | Deployed multi-timezone pilot |
| W26 Webhook ordering | `crmCommunicationDispatch`, `crmInbound`, signed payment/WhatsApp regressions; receipt ordering, duplicate and stale STOP/START handling | Authorized provider callbacks |
| W27 Shared sender | `crmInbound`, `crmCommunicationDispatch`; quarantine and explicit platform routing without creating accounts or consent | Authorized shared-sender pilot |
| W28 Diagnostic handoff | `crmDiagnosticHandoff`, orders/laboratory regressions, `crmDiagnosticLink`; existing Task and clinical references, no desk copy of results, transactional audit rollback; actual laboratory order/sample/result and CRM-only completed handoff, plus clinician-linked investigation/result/resumption on the existing visit | Pilot |
| W29 Human escalation | `crmCommunicationDispatch`, `crmDoctorRecovery`, `crmCareFollowUp`; existing review tasks for unavailable communication, unresolved visits and ambiguous recommendations | Pilot reconciliation |
| W30 Feedback recovery | `crmFeedback`, `feedbackSurveySubmission`; canonical completed visit, distinct attribution, encrypted comments and configured recovery task; actual browser submission/replay, canonical staff review, assignment and recorded service outcome | Pilot; existing optional feedback module required for staff review route |
| W31 Existing-record uncertainty | `crmMigrationReview`, `crmReviewedBackfill`; optional bounded diagnostics and reviewed, version-pinned development correction with no inferred identity/consent/payment | Only when explicitly used: reviewed snapshot/manifest, write window and reconciliation. No historical backfill is required for fresh setup. |
| W32 Contact correction | `crmPatientIdentity`, `crmCommunicationPolicy`; organization contact revisions, no login mutation, queued-recipient suppression | Pilot |
| W33 Payment pending | `crmConversion`, `crmCareFollowUp`, `crmExistingBookingFlows`, `crmPaymentReceipts`; actual ledger, required fee, immutable transaction references and pending-state copy | Authorized payment/provider browser journey; pilot |
| W34 Partial-write/read recovery | Transaction/audit failure cases across inquiry, conversion, booking, task, feedback, diagnostic, receipt and backfill files, including `crmStaffBookingReceipt`; actual minimum-entry committed response loss/close/resume produces one patient and visit; frozen retries and current-workspace read guards | Pilot reconciliation and production rollback |

Backend names above refer to `backend/tests/<name>.test.ts`; frontend component
names refer to `frontend/src/tests/<name>.test.tsx`. Source links and observations
for the actual browser checks are in [crm-workflows.md#observed-synthetic-browser-journeys](crm-workflows.md#observed-synthetic-browser-journeys).
Operational prerequisites and commands are in [crm-migration-pilot.md](crm-migration-pilot.md).
Unobserved journeys are intentionally left open; this matrix does not complete P0.

## Observed synthetic browser journeys

Chrome DevTools Protocol smoke checks used a fresh headless profile, an isolated
Next output directory, and the actual API against a synthetic MongoDB replica set.
The existing development server/database and live providers were not used. This
is focused browser evidence, not a complete automated E2E or live pilot gate.

| Observed journey | Result |
| --- | --- |
| Actual administrator session opens CRM and its authorized branch | Passed; no uncaught runtime exception |
| Desktop inquiry workspace at 1280 pixels | Rendered; cramped workflow links found and spaced |
| Inquiry dialog at 390 pixels | Document width 390; dialog width 358; no horizontal document overflow |
| Repeated Tab in the inquiry dialog, Escape and focus restoration | Passed; focus stays in dialog and returns to Capture inquiry |
| Actual committed inquiry with its response dropped at the browser | Passed; uncertain request freezes submitted details |
| Retry the same inquiry after the dropped response | Passed; canonical count remains one before and after retry |
| Retry error visibility and keyboard focus | Initial check found lost focus; correction verified with focus inside the dialog |
| Staff tasks, overview, settings and feedback at 390 pixels | Rendered within viewport; no uncaught runtime exception |
| Actual patient portal and patient feedback at 390 pixels | Rendered within viewport; patient feedback offers own completed-visit feedback |
| Anonymous public QR page at 390 pixels | Rendered within viewport; copy corrected to explain reception review and keeping the original tracker |
| Actual queue tracker dialog and queue at 390 pixels | Document width 390; dialog width 358; no horizontal document overflow or uncaught runtime exception |
| Committed tracker message with response dropped, then close/reopen and exact retry | Passed; recipient stays frozen and retry reports the recorded pending state |
| Tracker dialog and uncertain-request error focus | Passed; focus remains inside the dialog, including the retry error |
| New-person inquiry conversion, dropped committed response, close/resume and immutable retry | Passed; same canonical patient and appointment, with the configured payment requirement still pending |
| Returning caller selected from contact/name hints | Passed; independent identity review remains required and booking uses the existing canonical patient |
| Conversion and feedback dialogs after response loss at 390 pixels | Document width 390; dialog width 358; submitted values stay frozen and the error receives keyboard focus |
| Patient low-score feedback, dropped response, close/resume and exact retry | Passed; one patient-submitted survey and an unassigned recovery task |
| Staff opens that survey, assigns its review and records a service outcome | Passed with the existing optional feedback module enabled in the synthetic fixture; canonical attribution preserved and one completion recorded |
| Two actual administrators save stale workflow settings simultaneously | Passed in separate browser contexts; one commit, one explicit conflict, canonical revision increments once and automation stays disabled |
| One staff identity in two organization browser sessions, with one membership removed | Passed; removed session returns 401 and private work clears/unassigns; other employer session returns 200 and its work remains visible |

The queue check used an actual staff session, canonical checked-in visit and
explicit synthetic consent. Automatic turn alerts remained disabled; manual
resend required communication permission and current recipient/purpose evidence.
No live provider dispatch occurred. Initial harness attempts lacked a clinician
profile or intercepted a policy denial; these were corrected before recording
the successful committed-message journey above.

The multi-session check initially exposed a CRM dependency on the facility
administration branch API. The new minimal, paginated CRM branch list uses the
operator's reviewed branch grant and CRM read permission. The repaired browser
check passed for a custom role without facility administration permissions.
The full staff feedback check explicitly enables the existing optional feedback
module in the isolated fixture. Initial disabled-module/shared-tab attempts are
not recorded as successful acceptance; the complete journey was rerun in isolation.

Broader device coverage, the remaining W01–W34 browser journeys and simultaneous booking operators,
production performance/query plans, provider delivery, rollout and restore/rollback
execution remain pending. Backend transaction and authority tests provide separate
evidence; they do not stand in for those browser or operational gates.

### Approved family authority and existing-flow continuation

The user explicitly approved the separate P0.6 organization family-authority change
on 2026-10-10 for local code and synthetic tests. Fresh isolated Chrome contexts
used the actual API, canonical patients and a disposable replica set.

| Observed journey | Result |
| --- | --- |
| Independent reviewer grants communication and consent, leaving data rights ungranted | Passed; one revision and independently recorded evidence |
| Drop committed family-review response, close/resume and exact retry | Passed; frozen submitted values and one canonical review |
| Explicitly select a reviewed family recipient | Passed; previous patient channel consent becomes unknown and requires fresh evidence |
| Family member opens portal and records an authorized organization's consent | Passed; consent-only controls work and export without a data-rights grant returns 403 |
| Canonical patient relationship branch and owner transfer | Passed; authorized destination, canonical revision and branch-transfer activity |
| Same staff identity switches between two employers | Passed; old private task clears and each workspace uses its own role and work |
| Minimum desk registration with name and phone only | Passed; one canonical patient, no invented DOB and required-fee visit remains payment pending |
| Clinician concludes visit with a one-week care recommendation | Passed; CRM-only desk sees the unassigned administrative follow-up without private clinical values |
| Desk reschedules that required-fee visit to next local day, then cancels it | Passed; payment remains pending after reschedule and explicit cancellation commits |
| Laboratory order, sample collection and result recording | Passed with the existing laboratory module enabled only in the synthetic fixture; CRM-only desk sees the completed handoff without test name, range, result or clinical notes |
| CRM-only role loads header and diagnostic task detail | Passed after gating facility-header requests by VIEW_LOCATIONS; no Access Denied notification or uncaught runtime exception |
| Two actual desk operators convert the same inquiry simultaneously | Passed in separate Chrome contexts; one canonical booking commits, the other operator receives an explicit conflict |
| Clinician orders a test for the current visit, receives the result and resumes review | Passed on 2026-10-12; canonical investigation frees the room and the existing visit resumes for result review |
| Close OPD while the resumed consultation remains incomplete | Passed; explicit warning and the visit remains in consultation, requiring clinician completion |
| Record synthetic received cash, then explicitly record nonattendance | Passed; canonical visit changes from payment pending to confirmed, then no-show; recovery exists and invoice stays paid with zero balance, without a claimed refund |
| Password sign-in, TOTP and explicit employer selection | Passed; selected workspace has the expected user and membership role |
| Enroll a virtual passkey, sign out, sign in and choose the other employer | Passed; TOTP remains required and the other workspace has its own role |
| Doctor absence cockpit with checked-in and legacy records, then explicit cancellation | Passed; structured original status identifies waiting patients, legacy notes do not prove attendance, and cancellation requests financial review without claiming a refund or delivery |
| Drop the committed minimum-entry booking response, close/resume and retry | Passed; immutable registration/booking commands produce one canonical patient and one payment-pending visit |
| Clinician recommendation followed by explicit CRM desk courtesy booking | Passed after the courtesy-state fix; task completed, visit confirmed, payment not required, zero invoice paid and canonical patient preserved |

Family relationship and consent views fit the 390-pixel viewport without horizontal
overflow. Temporary screenshots and JSON observations use the
`ekavyu-crm-family-transfer`, `family-consent`, `workspace-switch`, `minimal-walkin`,
`clinical-handoff`, `reschedule-cancellation`, `diagnostic-handoff` and `crm-header`
prefixes in the local temporary directory. No live provider dispatch occurred.

The family portal initially blocked family_member accounts on the patient-only
personal-profile endpoint. The fix loads their family list directly and presents
only separately granted privacy controls. The clinical and diagnostic task checks
also exposed the header's unauthorized facility read; its permission gate was fixed
and the browser repeated successfully. Harness-only attempts with premature waits,
an unfinished date range or incorrect DOM selectors are excluded from passed results.

The first courtesy-conversion observation exposed contradictory payment-pending
visit state beside a zero paid invoice. It is excluded from passed evidence. The
state was corrected and the actual clinician-to-desk journey was repeated successfully.

Remaining browser acceptance includes impersonation, branch-grant removal, broader
device/accessibility coverage and the same minimum-entry new patient's complete
desk-to-clinical journey. Controlled migration, performance/query plans, separate
worker-process restart, provider callbacks and deployed pilot/restore gates remain
separate. These synthetic sessions do not establish production acceptance.

## Shared communication boundary

Automatic approval review rejected changing the shared patient WhatsApp/email
dispatcher, consent enforcement and delivery states under general plan approval.
The user explicitly approved this reviewed change on 2026-10-09. Implementation
and focused local verification have passed; live provider configuration and deployment
remain outside this approval. The user separately approved the specific P0.6
organization family-authority change on 2026-10-10, covering local code and
synthetic checks. Operational rollout and live provider actions remain separate.

The implemented policy is defined in
`backend/services/PatientCommunicationPolicy.ts`, with focused integration cases
in `backend/tests/crmCommunicationPolicy.test.ts`. The enqueue and delivery consumers
now apply this policy.

The shared dispatcher applies these boundaries:

- Bind each patient message to organization, branch, canonical patient and source.
- Validate evidence for its channel and, separately, follow-up or feedback purpose.
- Pin a recipient hash when queued, then recheck the current recipient, consent,
  preferences, active source, staff membership and branch permissions before sending.
- Suppress messages after withdrawal, contact correction, revocation, source closure
  or workspace suspension. Family recipients require a separately reviewed
  organization communication grant, explicit recipient selection and fresh consent.
- Reuse the encrypted OutboundMessage queue and NotificationLog; create no new queue.
- Distinguish provider acceptance from sent, delivered and read. Suppression and
  unavailable/console SMS would not be represented as successful delivery.
- Preserve OTP as its existing separate authentication flow. CRM would offer only
  minimal approved WhatsApp templates and email, with no generic transactional SMS.
- Keep shared-sender replies for explicit routing, without matching a patient or
  creating a login account from a phone number. STOP remains a channel suppression.
