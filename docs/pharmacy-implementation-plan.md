# Existing pharmacy: implementation plan and final prompt

Prepared: 2026-10-19. Status: planning only; application implementation has not started under this plan.

**This plan updates the existing pharmacy at `/dashboard/pharmacy`, its existing backend, and its connected prescription/invoice flow.** Retain existing records, identifiers, tenant boundaries, shared components and working features.

## 1. Source of scope

This document is based on the current frontend and sibling backend source and [the completed pharmacy workspace report](pharmacy-workspace-refinement.md). Earlier chat messages and the referenced final prompt were not provided in this session. Therefore this document cannot certify that every earlier requirement is included. Any requirements recovered from that discussion must be reconciled here before claiming complete coverage of it.

The existing workspace behavior below is confirmed by source inspection. The additional integrity work is a proposed implementation scope derived from that inspection, rather than a claim that it was previously agreed.

[The Cloudflare report](cloudflare-vinext-blockers.md) concerns hosting. It does not implement pharmacy changes and is independent of this plan. Pharmacy work does not depend on migrating hosting.

## 2. Existing behavior to preserve

The previous workspace refinement is already implemented. Its report records scoped verification on 2026-10-18; those historical results are not fresh verification of this plan.

| Area | Current implementation |
| --- | --- |
| Workspace | Compact Inventory / Dispense / Alerts tabs, expandable stock overview, desktop rows and mobile cards. |
| Location | A sole location is shown as text; multiple locations can be selected. Dispensing and medicine creation require a concrete location. |
| Catalog | Paginated medicine reads, search and stock filters. Reads stop visibly above the existing 500-page bound rather than returning a silent partial result. |
| Forms | Medicine registration/edit and batch receipt dialogs retain values after failure, with scrollable bodies and pinned actions. |
| Dispensing | Explicit stock selection and positive whole quantities; no inferred dose quantity or automatic name-based substitution. Only selected prescription IDs are submitted. |
| Duplicate lines | Repeated selections of one medicine are aggregated into one stock line before submission. |
| Recovery | Busy states and a client write lock prevent repeated submissions in one workspace. A failed dispense triggers stock and pending-prescription refresh. |
| Authorization | Pharmacy module guard and server permissions; read access uses `MANAGE_MEDICINES` or `VIEW_EHR`, writes require `MANAGE_MEDICINES`. |
| Private state | Scope changes discard dialogs and ignore obsolete reads. |
| Alerts | Configured reorder level, default 20; low stock, upcoming expiry and expired batch views; explicit read failures and retries. |
| Inventory backend | `Medicine`, `MedicineBatch`, batch receipt, stock adjustment, FEFO allocation and an aggregate-only stock path for existing records. |
| Billing | Dispensing creates an unpaid invoice or appends to an eligible unpaid invoice for the visit. Server batch allocation determines medicine charges. |
| Related workflows | Clinical prescription events, audit logging, Schedule H1 register routes and existing billing/prescription consumers. |

## 3. Files and contracts to extend

Paths below are relative to their respective repository roots. Frontend and backend are separate repositories.

| Repository | Source | Responsibility |
| --- | --- | --- |
| Frontend | `src/app/(dashboard)/dashboard/pharmacy/page.tsx` | Workspace, location selection, forms, dispensing and refresh/events. |
| Frontend | `src/components/pharmacy/pharmacyWorkspace.ts` | Catalog reader, types, formatting and dispense preparation. |
| Frontend | `src/components/pharmacy/PharmacyAlertsCenter.tsx` | Stock and batch alerts. |
| Frontend | `src/components/pharmacy/PharmacyWorkspace.module.css` | Responsive workspace and dialogs. |
| Frontend | `src/lib/api.ts`, auth/location stores and shared UI | Existing infrastructure; change only where the pharmacy contract requires it. |
| Backend | `routes/pharmacy.ts`, `schemas/clinical.ts` | Existing routes, authorization and request validation. |
| Backend | `controllers/medicine.ts` | Catalog, receipt, dispensing, invoice integration and stock adjustment. |
| Backend | `services/PharmacyInventoryService.ts` | Batch receipt and server FEFO stock allocation. |
| Backend | `models/Medicine.ts`, `models/MedicineBatch.ts`, `models/Prescription.ts` | Existing persisted pharmacy records. |
| Backend | `models/ScheduleH1Register.ts`, `controllers/scheduleH1.ts`, `routes/scheduleH1.ts` | Existing controlled-medicine audit/register behavior. |
| Backend | Invoice model, billing consumers and `utilities/transaction.ts` | Charge integrity and transaction behavior; inspect direct consumers before changing contracts. |

Use the existing frontend API client. Its paths omit the `/api` prefix shown in this backend table.

| Method | Existing backend route | Use |
| --- | --- | --- |
| GET / POST | `/api/medicines` | Paginated catalog / registration. |
| PUT / DELETE | `/api/medicines/:id` | Update / soft delete. |
| GET | `/api/pharmacy/pending-prescriptions` | Pending dispensing groups. |
| GET | `/api/pharmacy/prescriptions/pending` | Existing alias; preserve compatibility. |
| POST | `/api/pharmacy/dispense` | Allocate stock, bill and fulfill selected prescriptions. |
| POST | `/api/pharmacy/batches` | Receive a batch for a specific medicine/location. |
| GET | `/api/pharmacy/medicines/:id/batches` | Inspect actual batches. |
| GET | `/api/pharmacy/expiring` | Batch expiry alerts. |
| POST | `/api/pharmacy/adjust-stock` | Existing stock adjustment contract. |
| GET | `/api/pharmacy/schedule-h1-register` | Existing scoped register read. |
| GET | `/api/pharmacy/schedule-h1-register/export` | Existing permission-controlled export. |

Current dispense body: `patientId`, `locationId`, optional `doctorId`, `encounterId`, `appointmentId`, `prescriptionIds`, and `items: [{ medicineId, quantity }]`. The current schema rejects unknown properties. Any new request field must be changed in the backend schema and frontend together.

## 4. Proposed integrity work

### 4.1 Stock and batch consistency

- Define the difference between catalog aggregate quantity, total batch quantity and currently dispensable quantity. Expired stock must never become dispensable because its aggregate quantity is positive.
- Preserve truly aggregate-only existing medicines. Distinguish them from medicines that have structured batches but no eligible batches. Explicitly test all-expired, all-depleted, inactive and insufficient-batch cases before relying on the fallback.
- Inspect medicine edit and stock adjustment: the current controller can change aggregate stock directly. For structured medicines, implement a validated batch-aware operation or reject unsupported aggregate edits with a clear recovery path. Reconcile stock and its audit record atomically.
- Keep FEFO allocation on the server. Use actual eligible batch expiry and batch selling prices; client catalog expiry and retail price remain informational/estimated.
- Agree and document the quantity and expiry rules from the existing domain contract. This scope retains positive whole stock units; pack conversion and fractional units require separate requirements. Test the chosen expiry boundary consistently without inventing a new clinical policy.
- Preserve IDs and history. If any data repair is necessary, produce a separately reviewable migration and dry-run report; application implementation does not authorize executing it against existing data.

### 4.2 Retry and concurrency safety

- The current client write lock is local to one mounted workspace. It does not establish server idempotency across tabs, devices, timeout retries or concurrent pharmacists.
- Reuse an existing server idempotency mechanism if one fits. Otherwise add a durable dispense operation identity scoped to the authorized organization/location and caller, with a unique database constraint and a canonical request fingerprint.
- A replay of the same operation/payload returns its committed result without another stock deduction, charge, fulfillment or audit/register duplication. Reusing an operation identity for a different payload returns a conflict.
- The frontend retains the same operation identity when retrying an uncertain outcome. A genuinely new dispense gets a new identity. If outcome recovery must survive reload, use minimal operation metadata; do not persist patient records or credentials in browser storage.
- Keep stock allocation, charge mutation, prescription transition, operation result and required audit/register writes in one transaction. A failed attempt leaves no partial committed business state. Keep notifications outside the transaction callback so driver retries do not duplicate external effects.
- Preserve the production requirement for transaction-capable MongoDB. Standalone development compensation does not prove production atomicity.
- Test concurrent requests with the same operation identity and with different identities targeting the same remaining stock/prescriptions. Exactly one valid fulfillment must commit; stock cannot become negative and the same prescription cannot be charged twice.

### 4.3 Prescription authority and partial selection

- Validate every supplied prescription ID against the patient, location, authorized organization, visit context and active/pending status before stock or invoice changes. Reject mismatched, unknown, already-dispensed or cancelled IDs explicitly.
- Validate supplied encounter, appointment and doctor references through existing authority helpers. Reference identifiers from the browser are not evidence of ownership.
- Do not silently drop invalid IDs and continue billing. A conditional status update must affect the intended records; stale selections fail without partial charges.
- Preserve selection of a subset of prescription rows: selected rows become dispensed, unselected rows stay pending. This is different from partially fulfilling the quantity of one prescription; quantity-level partial fulfillment is outside this scope unless separately specified.
- Keep deliberate pharmacist selection and prohibit automatic fuzzy substitution. Review what mapping evidence the current request can prove; if per-prescription medicine/quantity mapping must be enforced, add a compatible explicit allocation contract and tests before claiming that guarantee.

### 4.4 Invoice result and audit continuity

- Preserve eligible unpaid-invoice append behavior and paid/settled-invoice boundaries. Recalculate totals and balances on the server using the existing billing rules.
- Return and display the actual invoice result: invoice identifier/number, committed total or added charges as appropriate, and a link through the existing billing route. Success wording must cover both creation and append.
- Show the pre-submit catalog subtotal as an estimate. Batch prices may differ; never treat the client subtotal as the final payable amount or automatically mark the bill paid.
- Trace the real dispensing endpoint into Schedule H1/register creation. The inspected controller calls `dispenseMedicineFEFO` without its optional audit context, while existing register service tests supply context directly. Add route-level coverage and provide authorized patient/prescriber/dispenser context where required by the existing register model.
- Preserve scoped register access and export permissions. This plan asserts no legal certification or new retention/tax policy.

### 4.5 Workspace behavior

- Extend the current tabs, shared dialogs, controls and responsive patterns. Keep search, filters, read-only views and existing creation/receipt actions working.
- Add a batch detail view using the existing batch endpoint where needed to make quantity, expiry and price differences understandable. Do not label a catalog batch/expiry as the complete batch inventory.
- Keep a concrete location mandatory for dispensing and stock writes. An all-locations read must never select a write location implicitly.
- Preserve independent catalog/prescription failures, visible retries, stale-response protection, validation routing and form values on recoverable failure.
- Handle an uncertain dispense outcome through operation recovery; refresh alone must not be described as proof that retrying cannot double bill.
- After commit, refresh affected stock, pending prescriptions, alerts and invoice information. Existing clinical events may prompt refresh; manual refresh remains usable after a socket failure.
- On location, organization, account or permission changes, close private dialogs and clear outcome/operation UI from the old scope. Ignore late responses and close obsolete subscriptions.
- At 320px, 440px and 1440px, verify no horizontal overflow, accessible labels, keyboard focus, readable errors and reachable dialog actions.

## 5. Implementation sequence

1. **Reconcile requirements and baseline.** Read both repositories' `AGENTS.md`, [the verification workflow](verification-workflow.md), the existing refinement report, source contracts and relevant tests. Read the relevant installed Next.js guides in `node_modules/next/dist/docs/` before writing Next.js code. Preserve unrelated Cloudflare working changes. Resolve any recovered earlier-chat requirements against this scope.
2. **Write failing integrity regressions.** Cover fallback eligibility, invalid/stale prescription references, duplicate requests, concurrent fulfillment, invoice append and route-level register context. Confirm whether current test setup provides a replica set; use an isolated transaction-capable fixture for atomicity/concurrency evidence.
3. **Implement the backend boundary.** Add contract validation, durable operation recovery and transaction-safe allocation/fulfillment/billing/audit. Make batch-aware stock edits explicit. Keep existing callers compatible or update all direct consumers in the same change.
4. **Extend the existing frontend.** Wire operation identity/recovery, actual invoice outcomes and necessary batch visibility into the current workspace. Preserve baseline interactions and permissions.
5. **Verify both sides.** Run focused tests, changed-code lint and appropriate type/build checks based on the changed boundaries. Inspect the complete synthetic prescription-to-dispense-to-invoice flow and affected responsive views.
6. **Handoff.** Update this document with implemented items, remaining limitations, exact checks/results and any migration prerequisites. Keep the previous refinement report as historical evidence. Release/deployment remains a separate checkpoint.

Finish each coherent edit before scoped checks. Do not begin by replacing the whole pharmacy or rewriting unrelated shared infrastructure.

## 6. Acceptance checklist

All items below are targets, not claims of completed implementation.

- [ ] Existing route, records, tabs, searches, forms and permission behavior remain usable.
- [ ] Catalog pagination either completes or reports a visible failure; no silent incomplete stock selector.
- [ ] Batch receipt increases the correct scoped stock once; duplicate batch numbers and invalid numeric/date input have explicit outcomes.
- [ ] True aggregate-only records work; structured records cannot dispense from expired, depleted or otherwise ineligible batches through a fallback.
- [ ] Structured stock edits cannot leave aggregate/batch quantities inconsistent.
- [ ] Partial row selection leaves unselected prescriptions pending; repeated medicine selections use one validated aggregate stock line.
- [ ] Foreign, cancelled, stale or already-dispensed prescriptions and mismatched visit references cannot cause stock, invoice or fulfillment changes.
- [ ] A lost-response replay returns the original result; changed-payload identity reuse conflicts.
- [ ] Concurrent attempts cannot oversell, double fulfill, duplicate invoice lines or overwrite an invoice update.
- [ ] Failure after allocation, invoice mutation or audit/register creation rolls back all related business writes in a replica-set test.
- [ ] Server FEFO/batch prices determine final charges; invoice append/create results are shown accurately and payment remains a separate operation.
- [ ] Real endpoint coverage proves required audit/register context and verifies tenant-controlled reads/exports.
- [ ] Scope changes and late responses cannot display another scope's private records or leave its actions enabled.
- [ ] Read failures, uncertain outcomes and socket failures have usable recovery; success is shown only for confirmed results.
- [ ] Synthetic browser flow and 320px/440px/1440px views are inspected when browser tools are available; unavailable checks are reported.
- [ ] Existing data is preserved; any required migration is documented separately and has not been executed as routine verification.

## 7. Verification commands and limits

Writing this Markdown is Level 1 documentation work. Implementing the proposed inventory, billing, prescription and tenant changes is **Level 4**. Follow the repository workflow and expand only for affected consumers or failures.

Frontend root, after relevant implementation changes:

```powershell
git diff --check
npx eslint 'src/app/(dashboard)/dashboard/pharmacy/page.tsx' src/components/pharmacy/pharmacyWorkspace.ts src/components/pharmacy/PharmacyAlertsCenter.tsx
npm test -- src/tests/pharmacyWorkspace.test.tsx src/tests/pharmacyAlerts.test.tsx
npx tsc --noEmit --incremental false
```

Adjust lint targets for the files actually changed, including new tests/code. Add direct shared-consumer regressions if shared components/hooks/contracts change. Frontend TypeScript excludes `src/tests`; it is not test-file type coverage. Run a production build when routing, configuration, dependencies or compilation/bundling risks change, and at the release gate. Cloudflare builds are not required solely for pharmacy changes.

Backend root, after relevant implementation changes:

```powershell
git diff --check
npm test -- tests/pharmacyInventory.test.ts tests/pharmacyFulfillmentLoop.test.ts tests/scheduleH1Register.test.ts
npm run check:fast
```

Add the actual new idempotency/concurrency/transaction test files and affected billing, prescription and tenant regressions. Existing candidate consumers include `tests/tenantRouteMatrix.test.ts`, `tests/prescriptionSafety.test.ts` and `tests/consolidatedBillingAndBreak.test.ts`; select cases based on the changed contract. Run `npm run build` for backend API/entry/bundle changes. Standalone MongoDB tests cannot certify multi-document production rollback; explicitly report the topology used for integrity checks.

Use isolated synthetic fixtures. There is no tracked browser E2E runner; do not report automated E2E as passed. Full CI/release gates remain required for release. No deployment, live DB write, migration execution, seeding, data reset or infrastructure change is part of this planning request.

## 8. Final implementation prompt

Copy the following when starting implementation after reviewing the proposed scope and reconciling any missing earlier requirements:

```text
Update the existing Ekavyu pharmacy using docs/pharmacy-implementation-plan.md
as the implementation specification. Work in D:\Project JK\frontend and the
sibling D:\Project JK\backend. Extend /dashboard/pharmacy and the existing
pharmacy APIs, models, shared UI, prescription flow and billing integration.

First read both AGENTS.md files, docs/verification-workflow.md, the implementation
plan, docs/pharmacy-workspace-refinement.md and the relevant installed Next.js
guides before writing Next.js code. Inspect current source and direct consumers.
The plan records that earlier chat/final-prompt text was unavailable: do not
claim it covers unseen requirements. Reconcile any additional supplied
requirements before implementing their dependent changes.

Preserve the already implemented Inventory / Dispense / Alerts workspace,
responsive dialogs, full catalog pagination, explicit quantities, selected-row
fulfillment, permission controls, scope isolation and error recovery. Preserve
existing records/IDs and unrelated Cloudflare changes.

Follow sections 4-6 of the plan: fix batch/aggregate eligibility and consistency,
implement durable dispense idempotency and safe concurrent fulfillment, validate
prescription/visit ownership and pending state before mutations, keep stock,
invoice, fulfillment and required audit/register writes atomic, and verify the
actual route supplies required register context. Preserve FEFO server allocation,
authoritative prices, unpaid invoice append behavior and separate payment flow.

Extend the current frontend with operation recovery, accurate invoice results
and necessary batch detail visibility. Change both sides of any API contract
together; retain compatibility for existing callers. Do not infer quantities,
auto-substitute by fuzzy medicine name or treat client locks/refresh as server
idempotency. Use existing mechanisms where they already meet these requirements.

Add meaningful regressions for invalid/foreign/stale references, expired-only
structured stock, duplicate/replayed/conflicting requests, concurrent stock and
prescription attempts, invoice append and transaction rollback. Use an isolated
replica-set fixture to prove production atomicity; state test topology and limits.
Follow Level 4 risk-based verification in each affected repository, including
focused tests, changed-code lint, type checks and appropriate build checks.
Inspect the synthetic flow and responsive views when tools are available.

Complete the acceptance checklist and update the plan with actual results and
remaining limitations. Do not deploy, change hosting, touch live records, reset
data or execute migrations. If implementation needs a data migration, prepare
the reviewable migration and dry-run instructions as a separate handoff.
```

## 9. Planning verification

This planning pass inspected frontend pharmacy source/tests and backend routes, schemas, models, controller, inventory service, transaction helper and relevant test references. It did not execute application tests, browser flows or builds, and makes no new runtime or production-readiness claim.
