# Outside prescriptions at a standalone pharmacy

Implemented 14 November 2026. This adds a pharmacist workflow for an actual prescription brought to the pharmacy. It does not create a clinic encounter or fictitious internal patient/doctor records.

## Problems addressed

| Gap | Implemented behavior |
| --- | --- |
| Standalone pharmacies cannot use the internal clinic prescription queue | A separate **Outside prescriptions** workspace uses explicit dispensing permission. The clinic queue stays separate. |
| Arbitrary doctor text could otherwise authorize restricted stock | A qualified pharmacist reviews the signed source, prescriber registration evidence, patient details, original directions, medicine bindings, permitted quantities and supply deadline. Evidence references are not government verification or document uploads. |
| Two operators could consume the same prescription allowance | A conditional prescription revision advances in the same transaction as the bill, FEFO stock, register and optional payment. |
| Partial fills lose their history | Permitted, supplied and remaining quantities are shown with every linked bill. Returns do not replenish prescription allowance. |
| Retrying after a lost response could issue another bill | The existing encrypted device journal retains the exact financial intent/key in a separate namespace. An opaque session reference also permits outcome lookup. Pending financial operations block a new supply. |
| Source details could leak into local carts or stale screens | Original evidence stays encrypted on the server. Retry intents retain IDs, revisions, quantities and monetary intent, not patient/prescriber text. Branch/auth changes clear the screen and invalidate old reads. |
| Pharmacists need bill history without cashier authority | A branch-scoped external-prescription bill read supports printing. Ordinary sales and collection permissions are not silently granted. |

## Staff flow

1. Open **Outside prescriptions**, under More in the compact pharmacy workspace.
   Before first use, an organization administrator can open **Pharmacist registrations** from the same tools menu, select an active staff member and review their registration evidence for this branch. This uses the existing professional-review API and does not grant dispensing or location access by itself.
2. Choose **Review new prescription**. Record its reference/date, patient name/address, outside prescriber name/address/registration/council and references to the retained signed source and registration review.
3. Bind reviewed medicines, transcribe original directions, enter the remaining quantities permitted for supply and set the reviewed deadline. Account for earlier supplies written on the original. Confirm the pharmacist review.
4. Enter quantities to supply now. Editing stays local. **Prepare bill** requests current batches, expiry, prices and tax using the existing financial engine.
5. With collection permission, select Cash/UPI/Card, enter cash tender or a verified transaction reference, confirm actual receipt and save. Payment and stock commit atomically; cash change is displayed. Without collection permission, **Issue bill for collection** creates an unpaid bill for an authorized cashier. Payment must be collected before handover.
6. Print the saved bill, or open it through existing Sales & collections when authorized. Each partial fill remains linked to its bill. Annotate the original prescription as required.

The UI reuses Input, DatePicker, Checkbox, Modal, Button, QuantityInput, payment validation, quote/result validation, financial recovery and saved-bill printing. Success uses a compact saved-bill strip. Closing the administrator registration form returns to the previously selected pharmacy tab.

## Authority and integrity

- `externalDispense` and `viewExternalPrescriptions` require `PHARMACY_DISPENSE_RESTRICTED` or `MANAGE_MEDICINES`, or the existing root override. New review/supply also requires current pharmacist qualification; permission alone is insufficient.
- The supplying pharmacist must have active branch membership, an active user and a current `PharmacyProfessionalReview` with actual registration, council, address, review reference and validity. The administrator form supports recording, reloading stale evidence and deactivation. Revocation shares transaction locks with supply.
- Original source evidence is encrypted and immutable. A unique branch-local prescriber/council/prescription reference prevents duplicate source records independently of retry keys. Reads are scoped, audited and not cached.
- Each supply rechecks the source revision/deadline, remaining allowance, medicine classification and unit version. A changed classification blocks supply; it never silently reinterprets the original review.
- The append-only `PharmacyDispense` links the invoice to its outside prescription. H/H1 register entries use an explicit version 2 external source with captured recipient/prescriber evidence, qualified pharmacist, actual batches and expiry. Internal clinical version 1 remains strict.
- Source progress, stock, invoice, H/H1 register, payment, audit and operation receipt commit together or roll back together. Required transactions fail closed on standalone MongoDB. A network error is not payment success.
- The private review form is not saved in device cart storage. Retry an uncertain review using its existing open form. After reload, check prescription history and the original reference before recording again; the source uniqueness guard rejects duplicates.

## Boundaries

This is one reviewed remaining allowance, with partial supplies capped at that limit. It does not automatically authorize repeat courses or substitutions, accept public pickup requests for restricted medicines, verify registrations with a government service, or support Schedule X/narcotic supply. It does not infer quantities from dosage text. History covers this branch; previous supplies elsewhere must be reviewed on the actual prescription.

Existing invoice/pricing behavior is India/INR specific. Review and register design was checked against [CDSCO's official Drugs Rules text, Rule 65](https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/drug_rules/Drugs%20Rules1945n.pdf), including pharmacist supervision, prescription records and repeat/substitution restrictions. This implementation does not certify electronic signatures or pharmacy licensing.

## Database setup

The new `PharmacyExternalPrescription` collection has a unique `(organizationId, locationId, sourceKey)` index. External H/H1 entries have a separate version 2 uniqueness index. New prescription recording fails closed if its source uniqueness index is missing; ordinary counter sales retain their existing readiness checks.

Use the backend's existing operator-controlled current-schema setup for the selected development database before enabling the workflow. `npm run db:indexes` previews the current schema without connecting; applying uses the existing explicit `--apply --writes-paused` procedure. No selected application database, migration, backfill or seed was used for implementation verification.

## Verification

Level 4 coverage includes source evidence, pharmacist and branch authority, ordinary-counter separation, unsupported schedules, malformed evidence, partial fills, competing source revisions, retries, rollback, expiry, drawer closure and historical bills. Existing checkout, clinical authority, dispensing recovery and pharmacy authorization regressions are included.

Frontend cases cover review attestations, directions, local quantity changes, quote invalidation, overfills, actual receipt, original-key recovery, scope changes and private-data exclusion from retry intents. Existing counter/workspace regressions remain covered. Both package type checks, changed-file lint, payment boundary and isolated backend API/worker bundles are checked.

Desktop 1440px/dark and mobile 390px/light browser checks used the actual application with loopback-only synthetic fixtures: prepare, save, print, prescription review and administrator registration review. The eight inspected views had no page overflow, nested forms, clipped header controls, page errors or WCAG A/AA axe violations. The two forms were rechecked after applying the shared DatePicker. Synthetic browser checks complement the Mongo-backed transaction tests.
