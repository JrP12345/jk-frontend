# Pharmacy workspace refinement

Current module: `/dashboard/pharmacy`, inventory, prescriptions, alerts and existing dialogs.
Status: implementation and scoped local verification complete, 2026-10-18.
Highest verification risk: Level 4 (inventory, prescription fulfillment and invoice creation).

For the proposed next implementation scope and copyable final prompt, see
[Existing pharmacy: implementation plan](pharmacy-implementation-plan.md).
This report records the completed workspace refinement; the linked plan distinguishes
that baseline from proposed further work.

## Changes and confirmed defects

- Replaced the large banner, summary cards and long navigation with compact Inventory / Dispense / Alerts tabs. Stock overview is expandable; desktop rows and mobile cards share data and actions.
- Medicine identity/batch and pricing panels retain entered values and route validation errors to the correct tab. Medicine, batch and dispense dialogs have stable dimensions, scrolling bodies and pinned actions; the dispensing subtotal has a full row.
- A sole location is displayed as text. Multiple locations remain selectable; new medicine registration and dispensing require a location.
- Stock searches and medicine selection load the catalog's paginated API results rather than silently omitting later pages. The read is bounded at 500 pages of 100; exceeding it fails visibly.
- Fixed a missing dispensing busy state and guarded all writes against repeated submission. Read-only accounts do not see stock mutations or dispensing actions.
- Dispensing no longer infers quantities or substitutes similarly named formulations. Only selected prescription IDs become fulfilled. Repeated selections of one medicine are aggregated, with positive whole quantities and combined stock availability checked against the existing server contract.
- After a dispense failure, stock and pending prescriptions are reread. Items absent from the refreshed pending list cannot be billed again through that open dialog. This is client recovery behavior, not a server idempotency guarantee.
- Independent inventory/prescription failures retain loaded records with explicit retry states. Scope changes discard private dialogs, cancel replaceable reads and ignore late results.
- Low-stock checks consistently use the configured reorder level, defaulting to 20. Alerts separate low stock, upcoming expiry and expired batches; failed reads are not shown as successful empty results. A missing catalog match cannot restock an unrelated medicine.

## Verification

- `pharmacyWorkspace.test.tsx`: 15 focused cases covered, including catalog pagination/failure, inventory filtering, independent read recovery, medicine/batch payloads, partial fulfillment, repeat submissions, reconciliation, deletion confirmation, scope changes and read-only access. A 14-case full run passed before the last added independent-read case; affected form/dispensing cases and the additional case passed afterward.
- `pharmacyAlerts.test.tsx`: 5 passed (thresholds, exact restock target, read failure/retry, expiry-window races, refresh after stock updates and missing location/permissions).
- Frontend TypeScript passed with `npx tsc --noEmit --incremental false` after the behavior changes.
- Changed-code ESLint: zero errors; two effect-driven loading warnings remain. Scoped diff whitespace checks passed.
- Hidden Chrome with intercepted synthetic fixtures: inventory, prescriptions, low/expiring/expired stock, medicine panels, batch entry and dispensing at 320px, 440px and 1440px. No horizontal overflow detected. Medicine panel changes retained identical dialog/footer bounds. Separate 320px empty and reader views were inspected, including dark expiry rendering; reader mutation controls were absent.

## Limits and next work

No backend files, live records, payment providers or infrastructure changed. Existing medicine/pharmacy controllers and routes were inspected to retain authorization and request contracts. Tests and browser checks used synthetic data; they do not certify deployed persistence, invoice settlement, server idempotency, concurrent pharmacists, or real-device behavior. Those remain test-environment/release checks. This UI task makes no production-readiness recommendation.
