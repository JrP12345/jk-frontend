# Pharmacy stock adjustments (T03)

This backend contract extends the existing pharmacy routes. It requires pharmacy staff, the pharmacy module, `PHARMACY_ADJUST_STOCK` (or legacy `MANAGE_MEDICINES`), and current organization/branch access. T08's [location capability](pharmacy-capabilities.md) blocks new adjustments at disabled locations while preserving authorized replay of committed commands. No stock-count UI is introduced by T03.

## Count and submit

Read the medicine's `stockRevision` with the stock being counted. Historical records without a stored revision have revision **0**. For structured inventory, select a batch from the existing batch endpoint and pin its quantity with that revision. Preserve both values throughout the count and any retries. A conflict requires reloading and recounting; refreshing only the revision would defeat the safeguard.

`POST /api/pharmacy/adjust-stock`

```json
{
  "medicineId": "<medicine ObjectId>",
  "batchId": "<batch ObjectId>",
  "expectedQuantity": 10,
  "expectedRevision": 0,
  "newQuantity": 7,
  "reason": "physical_audit",
  "notes": "Counted seven units",
  "clientRequestId": "<stable UUID for this count>"
}
```

- Quantities and revisions are non-negative safe integers. `expectedRevision` must be below `Number.MAX_SAFE_INTEGER` so it can advance once.
- `expectedQuantity` and `newQuantity` refer to the selected batch. Omit `batchId` only for proven aggregate-only inventory; then they refer to the medicine's aggregate quantity.
- Structured counts require a batch belonging to that medicine and branch. Batch totals must reconcile with the aggregate. Mismatches require inventory review; this endpoint does not manufacture a balancing lot.
- Reasons are `physical_audit`, `damaged`, `expired`, `restock`, or `other`. `other` requires explanatory notes. Notes are optional otherwise and limited to 500 characters.
- Damage/expiry write-offs must decrease quantity; restock must increase it. Increasing expired or unknown-expiry stock is rejected. Expired stock remains unavailable to dispensing after a downward count.
- A write-off removes units from tracked stock. Its movement does not certify physical disposal, create a supplier return, or create a refund. Those workflows remain separate.
- The request identifier contains 8–100 letters, digits, underscores or hyphens. Keep it and the complete payload unchanged through transport retries. Use a new identifier for a new deliberate count.

A successful response is `200` with `data: { movement, replayed }`. The persisted movement includes `_id`, organization/location/medicine IDs, `kind`, `stockMode`, `revision`, aggregate `beforeQuantity`/`afterQuantity`/`quantityDelta`, selected-batch `allocations`, reason, disposition, actor, notes and creation time. It is the committed snapshot; replay does not substitute today's medicine balance. `replayed` is true when an existing receipt was returned.

All database effects commit together: command receipt, selected batch, aggregate projection, revision, movement and required audit. A stale quantity/revision, key reuse with changed details, unsupported aggregate edit, or reconciliation problem returns `409`. Invalid input returns `400`; inaccessible/deleted medicine or mismatched batch returns `404`; unsupported standalone MongoDB returns `503`. Failed writes leave no successful command receipt, so the same request may be retried after the failure is resolved. Current branch/role authority is checked before replay.

## Read movement history

`GET /api/pharmacy/medicines/:id/stock-movements?limit=50&beforeRevision=12`

History requires `PHARMACY_VIEW_REPORTS`, `PHARMACY_ADJUST_STOCK`, `PHARMACY_RECEIVE_STOCK` or legacy `MANAGE_MEDICINES`. `limit` defaults to 50 and is capped at 100. Omit `beforeRevision` for the latest page. The response contains `data: { movements, nextBeforeRevision }`, ordered by descending revision. Use the returned cursor for the next page. Authorized history remains readable after the medicine is soft-deleted; new adjustments and dispensing remain blocked.

The existing catalogue response exposes `stockRevision`; batch reads retain their current routes. Metadata PUT accepts an unchanged quantity field for compatibility, but any quantity change returns `409` and must use the adjustment endpoint. Old adjustment requests lacking expected quantity, revision or request identifier also return an actionable `409`. There is no frontend caller of the old adjustment endpoint in the inspected source.

## Prospective history and transaction boundary

The first receipt, dispense or adjustment after T03 creates one `opening_baseline` aggregate checkpoint at the observed revision. Its delta is zero and it does not alter stock. Subsequent movements advance the medicine revision once per operation and record aggregate arithmetic plus touched-lot quantities. Receipts and multi-batch FEFO dispensing use this same prospective ledger. Catalogue creation establishes its opening quantity; the first subsequent inventory operation checkpoints that opening balance.

The baseline records an observed aggregate, not a certification or backfill of historical inward/sale sources. Each touched batch carries its observed before/after balance. Existing aggregate/batch ambiguity remains a review case for T11/T25. Stock movements are append-only through the Mongoose model; corrections are new commands rather than edits to committed history.

Inventory mutation requires an active MongoDB transaction, including local development. Receipt, dispensing and adjustment fail closed on standalone MongoDB. No compensating aggregate overwrite is used in place of atomic ledger/projection writes. No migration or live-data backfill is part of T03.
