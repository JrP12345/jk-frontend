# Role and workflow coverage

Source inventory: [feature-inventory.json](feature-inventory.json), generated with
`node scripts/feature-inventory.mjs` from both checkouts. It records 53 page entry
points, 462 literal HTTP registrations (including prefixed upload/shift/platform
routes), 93 models and eight worker/job entry files. It includes direct page API
calls, links, handler names and discoverable route guards. This is a source map;
it does not imply that every route/action/state combination has passed a runtime test.

Navigation sources are the dashboard layout, role-ordered sidebar, permission-filtered
mobile navigation, dashboard actions and contextual patient/appointment links. The
server remains authoritative. Built-in roles are root, admin, doctor, receptionist,
nurse, lab_tech, pharmacist, cashier, location_manager, patient, family_member and
guest; custom staff roles use organization presets. Twenty registered module keys
cover P1/P2 functionality; CRM and platform operations also have independent routes.

`S` below means source traced, `R` means a focused regression was executed in this
implementation, and `E` means an external/manual deployment check remains. Test files
listed for pending rows identify existing coverage to inspect/select, not claimed runs.

| Role | Module / entry point | Action and meaningful state | Server authority | Result / coverage |
| --- | --- | --- | --- | --- |
| All accounts | Login/register/reset/verify-email; direct auth pages | Password/OTP/Google/passkey; active/revoked/expired session | Live session, authVersion, ownership, signed challenges | S; staff enrollment R; real provider E |
| Staff | Account → Security; enrollment gate | Set up, verify, lose factor, recover | Recent login, session-bound secret, MFA; independent operator recovery | R (`phaseOneCloseout`, frontend enrollment/recovery) |
| Root | Organizations / setup requests / onboarding | Provision organization/admin, reject duplicate identity | Platform-root; transactional membership/subscription/module setup | S; `organizationProvisioning` |
| Admin | Organization/settings; contextual organization editor | Workflow/currency/timezone/branding; missing config | MANAGE_ORGANIZATION; active tenant | S; settings/provider validation E |
| Root/admin | Modules / role editor | Enable/disable module, edit/assign preset; forbidden consumer/root target | Root module control; ADMINISTRATIVE_GOVERNANCE; owned roles | S + role boundary R |
| Admin/location manager | Locations → assignments | Add/update/deactivate branch, assign doctor, selected/all grants | MANAGE_LOCATIONS / MANAGE_STAFF; tenant ownership and revisions | S + legacy/location workflow R; assignment list needs scope correction |
| Admin | Team → add/edit/invite/remove | Invitation accepted/expired, membership removed, role changed | MANAGE_STAFF; catalog/tenant restrictions, session revocation | S; `workspaceAuthority`, `permissionCacheRevocation` |
| Admin | Shift roster | Assign, overlap, publish shifts | MANAGE_STAFF; location/organization | S; `shifts` |
| Receptionist / clinical staff | Patients directory / appointment entry / walk-in | Search minimum/account patient, register, associate, identity conflict | VIEW/MANAGE_PATIENTS; relationship/location and identity-review gates | S + patient privacy/search R; `locationWorkflow`, `crmPatientIdentity` |
| Patient / family | Portal → family/claim | Self, active proxy, revoked relationship; edit demographics | Current patient/family ownership; claim OTP | S; `crmFamilyAuthority`, `patientPortal` |
| Patient/guest/family | Browse provider/location → booking | Slot/queue, lock, pay at clinic/online; retry/duplicate | Public DTO + authenticated capability; patient relationship; idempotency | S; `browseBookingSecurityPolish`, `doctorAvailabilityAndSmartBooking` |
| Receptionist | Appointments / Today's patients | Register → walk-in/reception booking → check-in | Booking permission, authorized doctor/location, durable request receipt | S; `locationWorkflow`, `publicTrackerAndQuickWalkIn` |
| Receptionist / doctor / nurse | Queue desk / Today's patients | Call next, arrive, park/resume, break, delay, STAT | Staff-only queue; MANAGE_QUEUE; location and status CAS | S + location workflow R; `queueIntegrity`, `vitalsAndConsultationLoop` |
| Doctor / clinical writer | Consultations list → visit workspace | Pending arrival → checked-in → consultation, optional note, finish | MANAGE_APPOINTMENTS + MANAGE_CLINICAL_NOTES; patient/workspace checks | S; full list incorrectly depends on VIEW_STAFF; fix required |
| Patient/family | Consultations/history direct links | Read owned visit, completed records; revoked family | Patient ownership, active proxy, staff-only writes | Original boundaries R; list family loader needs correction |
| Doctor/nurse | Encounter → vitals/score/alerts | Incomplete/complete NEWS2, acknowledge, longitudinal trend | Clinical write permission; encounter/patient/org/location | R (`clinicalAuthorizationBoundaries`) |
| Doctor | SOAP/OPD presets, note draft/sign/amend | Private/shared catalog, draft/signed/obsolete version | Clinical writer; tenant/author, immutable signed revision | R for template boundaries; `clinicalNote`, `opdTemplatesAndFollowUpRecall` |
| Doctor / pharmacist / patient | Prescription → print/verify/refill | Safety checks, override, seal, dispensing/refill status | Patient ownership, clinical permissions, signed metadata | Integrity boundary R; `prescriptionSafety`, `pharmacyFulfillmentLoop` |
| Clinical staff / lab tech | Laboratory / encounter order / sample | Order → collected → resulted; panic, report review | Lab/order permission, matching patient/encounter/tenant/branch | S; `labHandshakeAndUpiLoop`, `laboratory` |
| Clinical staff | Radiology/PACS / encounter | Order, preview, report upload, DICOMweb | Clinical/order permission, private verified attachments | S; `imaging`, `dicomWeb`; provider E |
| Pharmacist | Pharmacy → inventory/dispense | Stock, batch, expiry, fulfillment, Schedule H1 | MANAGE_MEDICINES; stock transaction/tenant | S; `pharmacyInventory`, `pharmacyFulfillmentLoop`, `scheduleH1Register` |
| Doctor / patient | Teleconsultation list/contextual meeting | Ready/in progress/completed; open configured room | Authorized appointment/patient, configured HTTPS provider | S; `teleconsultation`; real provider E |
| Cashier/reception/admin | Patient billing / VisitInvoices / checkout | Invoice → partial/full payment → till close; duplicate/retry | MANAGE_BILLING; owned encounter/appointment, idempotency, transactions | S; `postConsultationFeeWorkflow`, `clinicalContinuityAndTillClose` |
| Patient/family | Bills / tracker / invoice payment link | Unpaid, partial, paid/refunded, revoked proxy | Patient/family ownership or narrow tracker proof | S; `billingAuthorization`, `patientTrackerUpiAndWebhook` |
| Cashier/admin | Services / insurance / claims/preauth | Tariff, order charges, approval/rejection/settlement | Billing permissions; organization-scoped references | S; `tenantRouteMatrix`, `preAuth` |
| Staff with reporting grant | Analytics/export/daily summary/dashboard | Count/totals across pages, partial payments, restricted branch | VIEW_ANALYTICS / billing grants; tenant+location | S; executive totals/branch scope and dashboard dependency issues identified |
| Staff with CRM grants | CRM inbox/inquiries/tasks/calls/communications | New/contacted/booked/completed, handoff, revocation, consent | CRM permission + relationship/location/owner scope | S; `crmAuthority`, `crmRevocation`, `crmExistingBookingFlows` |
| Patient / authorized staff | Feedback / care review | Completed visit feedback; follow-up/care task | Appointment ownership or CRM analytics/task permission | S; `feedback`, `crmCareFollowUp` |
| All accounts / staff | Notifications/settings/realtime | Unread/read, preferences, delivery retry/failed | Authenticated user; scoped realtime; MFA gate | S + websocket boundary R; worker/provider E |
| Root | Audit/admin monitor/platform gateway | Read audit/traffic, outbox replay, subscription console | Root or explicit operations permission; audit minimization | S; `platformDashboard`, `outboxReplay` |
| Root/admin | SaaS billing/settings/credits | Checkout/webhook/refund, subscription expiry/downgrade | Root/commercial ownership; verified provider HMAC | S; `billingAndSubscription`, `billingReconciliationJob`; provider E |
| Authorized staff / public display | Queue TV / QR join / track / check-in | Sanitized display, capability expires/reissued, public join | Public DTO or narrow patient capability; no full public queue | S; `publicTrackerAndQuickWalkIn`, `trackerCors` |
| Authorized patient/staff | Documents/upload/private download | Staging → verified immutable object; MIME/size/ownership failure | Tenant/patient-bound upload intent, signature/content checks | R (`phase1SecurityContracts`); bucket/accepted-file threat E |
| Authorized clinical staff | Search/AI/ABDM/SSO/platform services | Scoped record search, draft assistance, configured integration | Route permissions + tenant/subject validation; no simulated production success | S; `aiValidationAndSecurity`, `abdmSandboxGuard`; provider/consent E |
| Operators | Worker health/jobs/backup/restore | Durable delivery/retry/lease, shutdown; archive/drill | Restricted deployment credentials, bounded work, operator authorization | Codec R; live worker, snapshot/application restore E |

Known direct code issues are tracked in `production-readiness-tracker.md#security-recovery-and-configured-provider-acceptance`. Advanced
integrations are existing optional capabilities, not automatically part of a small
clinic's P1 go-live. Disable/withhold unconfigured modules and run their separate
acceptance checks before enabling them. Source enumeration is not an exhaustive
penetration test or browser/device acceptance exercise.
