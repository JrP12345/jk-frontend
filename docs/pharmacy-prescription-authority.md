# Prescription authority and committed pharmacy charges (T05)

Connected dispensing completes selected prescription rows once. It is still patient and visit based; standalone sales and quantity-partial allowances remain T14 and T27. [T06 now issues separate pharmacy documents](pharmacy-tax-documents.md) and requires reviewed tax configuration for new supply. This is a local implementation, not a production release.

`POST /api/pharmacy/dispense` retains the T04 idempotency and recovery contract. New commands require a nonempty, duplicate-free `prescriptionIds` selection. Every selected row must be active, sealed with a valid hash/signature, not superseded/deleted, and associated with the same organization, branch, patient, prescriber and completed encounter. A supplied doctor, encounter or appointment must match the source; omitted visit references are derived from that source.

Authority comes from the current signed/amended clinical note and its selected prescription IDs; ambiguous multiple latest notes require review. A prescription-only amendment absent from the current note requires explicit clinical reconciliation; dispensing does not rewrite the signed note or guess its membership. The existing focused completion path deliberately has no SOAP note: it requires the completed linked appointment and the matching `CONSULTATION_COMPLETED_WITHOUT_CLINICAL_NOTE` audit. A draft or stale note cannot fall back to focused authority. Ordinary visit completion now seals its finalized prescription rows as well. Pending queues, public tracker and prescription printing select finalized current rows.

The workspace sends explicit mappings before stock aggregation:

```json
{
  "prescriptionIds": ["<rx A>", "<rx B>"],
  "items": [{ "medicineId": "<stock medicine>", "quantity": 7 }],
  "prescriptionAllocations": [
    { "prescriptionId": "<rx A>", "medicineId": "<stock medicine>", "quantity": 3 },
    { "prescriptionId": "<rx B>", "medicineId": "<stock medicine>", "quantity": 4 }
  ]
}
```

Every selected prescription appears once, every stock line is covered exactly, and mapped positive whole quantities reconcile with the aggregated stock quantity. Selecting a different catalogue item remains an explicit operator choice for general medicines; T07 requires restricted supply to match the prescribed catalogue item and current reviewed registration in its sealed source. No medicine name, dosage or duration is used to guess a match or quantity. Older callers can omit mappings only for an unambiguous one-to-one catalogue association or a single prescription/single stock selection. Ambiguous selections return `409` before stock changes. A request without prescription authority also returns `409`; it cannot act as an undocumented retail-sale endpoint.

The receipt transaction locks the encounter, linked appointment and current note. It writes stock movements, an append-only `PharmacyDispense`, invoice lines carrying `pharmacyDispenseId` and `pharmacyDispenseLineId`, conditional fulfillment revisions, audit and encrypted replay result together. The source stores the selected prescription-to-stock quantities, actual FEFO batches and actual sale amounts. Unique source-prescription and invoice-source-line indexes reinforce the conditional write boundary. A deliberately different key cannot supply an already completed row again. Unselected rows remain pending. A replay of an older T04 receipt still returns its original encrypted snapshot before current prescription checks.

Both encounter billing and appointment checkout use those committed sources. Unissued historical T05 bills retain their exact source quantities and prices when recompiled. New T06 pharmacy documents are issued separately; clinical compilation lists their linked bills and excludes their source lines from another invoice. Missing, cancelled, refunded, deleted or altered source invoices require review; the compiler never recreates their medicine charges. Unfilled finalized prescriptions appear separately as **awaiting pharmacy supply (unbilled)** and contribute no amount. The old quantity-one catalogue estimate and appointment free-text price fallback are removed.

New server-generated consultation and consolidated bills carry `clinicalChargeVersion: 1`, identifying the compiler that no longer estimates pharmacy charges. The marker is not accepted from manual invoice input. An unversioned historical or unclassified manual visit bill requires provenance review before dispensing or checkout recompilation. There is no automatic text matching, historical reclassification or migration. Ordinary invoice history and existing settlement routes remain available. Operational review tooling remains later work.

T06 supersedes new unpaid-clinical-draft append behavior: each new pharmacy supply issues a separate document and links to the existing visit bill where present. Draft, paid, partially paid and issued clinical bills stay unchanged. Issued pharmacy amounts and issuer snapshots cannot be rewritten; payment collection remains available. Historical rows are not retrospectively classified or re-taxed. Complete standalone issuance/quotes remain T14/T16, controlled-register evidence T07 and returned-stock/refund policy T19.

Release preparation must include the new source and partial unique invoice-line indexes through the existing database-index maintenance workflow. No index application or production data changes run as part of local verification. Existing T04 uncertain-response and reload behavior remains in force; a missing lookup result never authorizes a replacement reference.

T07 now adds reviewed H/H1 professional/classification evidence, actual recipient/prescriber details and captured append-only register rows to this transaction. Restricted supply requires the matching signed clinical note; focused completion alone does not establish that evidence. X/narcotic supply remains blocked. See [the restricted dispensing contract](pharmacy-restricted-dispensing.md); professional/production approval remains pending.

T27 supersedes the selected-row completion rule for explicitly quantified prescriptions: exact remaining allowance/revision, repeated partial supplies and per-revision fulfillment claims now apply. Unquantified sources retain a single supply. See [the quantity contract](pharmacy-prescription-quantities.md); the source, billing, sealed-instruction and replay controls above remain in force.
