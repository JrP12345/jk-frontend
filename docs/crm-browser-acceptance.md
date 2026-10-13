# CRM focused browser acceptance — 2026-10-10

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

## Approved family authority and existing-flow continuation

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
