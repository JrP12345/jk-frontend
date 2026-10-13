# P0 workflow reconciliation

This records the implemented workflow boundaries and their verification sources.
The progress log records executed checkpoints; a test filename is not by itself
proof of a completed live or browser journey. Full local runs completed; their
failures were corrected and the affected checks passed, as recorded in the log.
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
| W31 Legacy uncertainty | `crmMigrationReview`, `crmReviewedBackfill`; bounded read-only report and reviewed, version-pinned backfill with no inferred identity/consent/payment | Approved snapshot, manifest, write window, indexes/query plans and rollback drill |
| W32 Contact correction | `crmPatientIdentity`, `crmCommunicationPolicy`; organization contact revisions, no login mutation, queued-recipient suppression | Pilot |
| W33 Payment pending | `crmConversion`, `crmCareFollowUp`, `crmExistingBookingFlows`, `crmPaymentReceipts`; actual ledger, required fee, immutable transaction references and pending-state copy | Authorized payment/provider browser journey; pilot |
| W34 Partial-write/read recovery | Transaction/audit failure cases across inquiry, conversion, booking, task, feedback, diagnostic, receipt and backfill files, including `crmStaffBookingReceipt`; actual minimum-entry committed response loss/close/resume produces one patient and visit; frozen retries and current-workspace read guards | Pilot reconciliation and production rollback |

Backend names above refer to `backend/tests/<name>.test.ts`; frontend component
names refer to `frontend/src/tests/<name>.test.tsx`. Source links and observations
for the actual browser checks are in [crm-browser-acceptance.md](crm-browser-acceptance.md).
Operational prerequisites and commands are in [crm-migration-pilot.md](crm-migration-pilot.md).
Unobserved journeys are intentionally left open; this matrix does not complete P0.
