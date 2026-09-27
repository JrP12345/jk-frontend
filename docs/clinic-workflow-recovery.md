# Clinic workflow fixes

The G1–G10 product audit fixes were implemented locally on 2026-09-27. The shared
implementation record, validation and operational limits are in
[the backend workflow tracker](../../backend/docs/clinic-workflow-recovery-2026-09-27.md).

Frontend changes cover truthful booking/payment slips, full appointment search
and server pagination, queue/tracker reconciliation, explicit kiosk visit
selection, unsaved SOAP warnings, independent portal recovery, diagnostic-order
refresh, truthful doctor-assignment outcomes, and arrival/standby clarity.

Verification: 110 tests across 18 files passed; the production build and its type
checks passed; focused lint had zero errors and 53 warnings. No live deployment,
payment or provider-message transaction was performed.
