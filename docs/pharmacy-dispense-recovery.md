# Pharmacy dispense recovery (T04)

T04 adds recorded commands to the existing clinic dispensing endpoint. It preserves its patient-required workflow, FEFO allocator, invoice creation/unpaid-visit append, audit and prescription status update. [T05's prescription authority contract](pharmacy-prescription-authority.md) now strengthens new commands with finalized prescription selection, explicit allocations and committed supply provenance; existing T04 receipts remain replayable. Complete controlled-register evidence is T07. This increment is not a standalone pharmacy release.

## Submit once and retry the same operation

`POST /api/pharmacy/dispense` now requires `Idempotency-Key`, containing 8–100 letters, digits, underscores or hyphens. A UUID is suitable. Missing/invalid mutation-key syntax returns `428`; keys outside the recorded-command format return `400`. The server never generates a replacement key. The existing body is unchanged; item arrays are capped at 100 and selected prescription IDs at 200.

```http
POST /api/pharmacy/dispense
Idempotency-Key: <stable UUID for this deliberate dispense>
Content-Type: application/json
```

```json
{
  "patientId": "<patient ObjectId>",
  "doctorId": "<doctor user ObjectId>",
  "locationId": "<location ObjectId>",
  "encounterId": "<encounter ObjectId>",
  "prescriptionIds": ["<selected prescription ObjectId>"],
  "items": [{ "medicineId": "<medicine ObjectId>", "quantity": 2 }]
}
```

The trusted organization, branch and operation kind scope the receipt. The authenticated operator is bound into its payload hash and encrypted response. IDs are normalized and item/prescription order canonicalized. Same key and details replay the original result; changed details or another actor reusing that key return `409`. A key is a command identity, not a permission grant.

The existing `data` invoice shape remains, with an added `dispenseOperation`:

T06 now issues a separate pharmacy document for each new supply, so new commands return `appendedToExisting: false`. Earlier receipts may retain `true` and still replay exactly. See [the current tax-document contract](pharmacy-tax-documents.md) for reviewed configuration and issue gates; this document's sample below also describes historical append receipts.

```json
{
  "version": 1,
  "key": "<original key>",
  "invoiceId": "<actual created or appended invoice>",
  "invoiceNumber": "<invoice number>",
  "locationId": "<location ObjectId>",
  "addedAmount": 24,
  "appendedToExisting": true,
  "allocations": [{
    "medicineId": "<medicine ObjectId>",
    "quantity": 2,
    "lineAmount": 24,
    "batches": [{ "batchId": "<batch ObjectId>", "batchNumber": "B-1", "quantity": 2 }]
  }]
}
```

First commit returns `201`; replay returns `200`. `Idempotency-Replayed` identifies the latter. The response snapshot includes the invoice at posting, the actual added amount and allocations. It stays identical after payment, later invoice edits, stock depletion, medicine soft deletion or prescription fulfillment. Use normal billing reads for current invoice state; the recovery result reports the committed operation.

The existing command helper owns the transaction. It claims the receipt, reloads mutable business state, allocates stock, records movements, writes/extends the invoice, updates prescriptions, appends the required audit, saves the encrypted versioned response and result link, and commits with majority write concern. New receipt durability options are optional; existing helper callers retain their defaults. Required-write failures roll back all effects. Non-finite response amounts also reject the transaction. Existing FEFO and register services participate in the same session. WebSocket updates are best effort after commit, and replay does not emit another notification.

## Recover a committed result

`GET /api/pharmacy/dispense-operations/:key?locationId=<location ObjectId>`

Both submission and lookup require current authenticated pharmacy staff, the pharmacy module, `PHARMACY_DISPENSE_RESTRICTED` (or legacy `MANAGE_MEDICINES`) and branch authority. T08's [location capability](pharmacy-capabilities.md) blocks new supply when disabled while allowing authorized lookup/replay of committed results. Lookup returns the initiating operator's recorded response. Another actor cannot retrieve it merely by knowing the key. Branch/role revocation is checked before replay or lookup. All lookup responses, including `404`, use `Cache-Control: no-store`.

A `404` means **no committed result is currently visible**. It does not certify rollback or authorize a new key. A timeout, unavailable transaction, corrupt snapshot, network failure or failed lookup keeps the original reference for retry/review. Repeating the original POST with the original body/key is safe; the receipt is checked before mutable stock/prescription validation. Standalone MongoDB fails closed.

## Frontend lifecycle

The workspace reserves an opaque key before dispatch and pins the payload in memory. Axios requires that explicit key and preserves it across token refresh. A transport failure triggers a lookup; the operator can check again or retry the same in-memory payload/key. Queue refresh, depleted stock or changed selections do not turn that retry into another command.

Only the key is saved in local browser storage, under the effective actor/organization/impersonation/branch namespace. No patient, prescription, selection, invoice or financial body is persisted. Storage failure prevents dispatch. Where available, Web Locks serialize reference reservation across tabs; storage events update the other open workspace. A receipt can acknowledge only its own reference, so an older tab cannot clear a newer pending operation.

Reload restores the reference and performs an authorized lookup. It does not automatically resubmit or reconstruct an unavailable request body. If a committed result is found, the workspace displays the actual invoice number, added amount and total at posting. The operator acknowledges it with **Done** before another dispense. If lookup remains unresolved and the in-memory payload is gone, keep the reference for operator review; exception-resolution tooling belongs to T18. No new bill is offered while that reference remains unresolved.

Identity or branch changes discard private drafts and ignore late responses in that workspace. Returning to the original scope can recover its saved reference. No financial body is carried into the new scope. T05's prescription-source validation now prevents duplicate source fulfillment under deliberately different keys; operation idempotency alone does not establish clinical authority.

## Compatibility and release scope

The repository's frontend and affected backend callers now submit stable keys. Other deployed integrations must adopt the header before enforcing this backend version. No migration, production deployment, price/tax change, payment-provider action or browser financial-body persistence is part of T04. T07 now supplies trusted controlled-route context and validates restricted evidence inside the transaction; the recovery regression uses the production HTTP route under concurrent retries. See [the restricted dispensing contract](pharmacy-restricted-dispensing.md). Professional and production validation remain release gates.
