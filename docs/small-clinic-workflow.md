# Everyday clinic workflow

Current implementation, 2026-10-07. Organization settings select registration (full / essential) and consultation (full / focused). Defaults are full. These preferences change the usual UI depth; Patient, Appointment, Encounter, ClinicalNote, Prescription and Invoice remain authoritative.

## Reception and daily work

Today's patients shares canonical patient matching and booking. Essential registration accepts a name and phone/email without inventing DOB or gender. One valid location/doctor assignment is inferred; multiple options require a choice. Phone/desk bookings use reception and require arrival confirmation. Online appointments retain availability, capacity and payment checks.

Successful patient/visit identifiers stay selected if a later booking or arrival step fails. Failed reads show recovery controls. Location changes cancel obsolete reads and clear the previous scope before new actions become available.

## Consultation and money

The focused tab belongs to the same EncounterWorkspace as detailed SOAP, vitals, diagnosis, orders, signatures and amendments. Optional-documentation completion requires the focused preference, consultations module and clinical completion permission. Prescribing requires the attending doctor and explicit dosing. Saved notes or prescriptions require their clinical signing path; closed encounters reject draft writes.

Completion releases the consultation lock, records audit/notifications and follows charge capture. Complete and next uses Call Next. Focused completion never invents SOAP content or automatically dispatches a prescription. Full documentation remains available.

Payments use current invoices and receipt APIs, including balances and partial payments. Daily totals use actual payment dates and invoice currencies and require billing visibility. Today's invoices outstanding is the balance on invoices issued today. No separate registration, prescription or financial pipeline is introduced.

## Service catalog

`/dashboard/billing/services` loads every API page before exposing complete
counts. Search, All/Active/Inactive tabs, category filtering and sorting reuse the
loaded catalog. A failed later page cannot become a successful partial catalog.
Refresh failures preserve the previous view with retry; writes require a fresh
successful read.

Service and Pricing & tax editor panels retain drafts and select validation
errors, including zero-price, decimal and finite-value checks. Duplicate codes
and failed submissions remain recoverable; inactive status and nonstandard GST
rates survive edits. Starter-service provisioning and status changes require
confirmation. `VIEW_BILLING` is read-only; `MANAGE_BILLING` controls writes, with
backend authorization authoritative. Organization/authority changes clear drafts
and ignore obsolete responses. The editor does not change tax applicability or
backend billing calculations.

Use shared controls, `QueueDialog` and `formatCurrency`; preserve mobile cards,
desktop rate rows and pinned actions. Existing regressions: `catalogContinuity`,
`servicesWorkspace` and `billingWorkspace`. Live pricing and billing persistence
remain release-environment checks.

## Boundaries and verification

Tenant and location permissions remain enforced for patient search, booking, clinical completion and collection. Transactions require production MongoDB prerequisites. Historical clinical and financial authority is not rewritten by this UI flow.

Tests cover minimum registration, identifier retention after failure, explicit multi-doctor choice, arrival, encounter reuse, closed drafts, full/focused completion, prescriber authority, invoice reuse and location-local day boundaries. See [cleanup verification](pre-production-cleanup.md) and the outstanding [release gates](production-readiness-tracker.md).
