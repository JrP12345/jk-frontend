# Pharmacy reconciliation review (T25-A)

**Scope correction — 20 October 2026:** the user confirmed that the entire project is in development, with no production customers or legacy records. Historical backfill, entitlement grandfathering, production snapshot migration and legacy cutover are out of the active plan. Keep the existing read-only tool as an optional development diagnostic. Remaining T25 work is current schema/index readiness and deterministic initial setup; backup/restore release evidence remains T26. The original contract below describes what was built, not a requirement to invent historical data or run a migration.

**T25 current setup is now implemented locally.** See [the schema/index setup contract](pharmacy-setup.md) for disconnected preview, read-only readiness, explicit repeat-safe setup and development fixture procedures. No live database/index action ran; release/restore evidence remains T26.

The optional read-only scoped diagnostic at `scripts/review-pharmacy-migration.ts` retains its original exception-manifest contract below. It performs no backfill and does not approve rollout. Historical production migration/cutover requirements in this older diagnostic contract are superseded by the development-only scope correction above.

Use a frozen, reviewed replica-set snapshot with a read-only database principal. Set `PHARMACY_REVIEW_MONGODB_URI` through the operator's secret environment; the tool does not fall back to the application's connection, load `.env`, or accept a connection string in arguments. It imports no application models and disables automatic collection/index creation. Connection failures redact connection details.

From the backend checkout, the command shape is:

```powershell
node --experimental-strip-types scripts/review-pharmacy-migration.ts `
  --organization <organization-id> --location <location-id> `
  --snapshot-id <reviewed-snapshot-label> --as-of 2026-10-20T00:00:00.000Z `
  --section inventory --limit 100
```

The timestamp above is an example, not an instruction to use that date for a real review. No snapshot connection or live review was run during implementation. The snapshot label is supplied by the operator; the tool cannot prove that a database is a frozen backup. Preserve that external evidence.

Run all six sections for each owned location, including inactive locations. Follow each section's `nextCursor` using `--cursor`; a completed page or section is never rollout approval. All counts are page-local. Data sections use a snapshot transaction per page and abort it even on success. Different pages require the same frozen snapshot for a consistent overall review. Transient conflicts or unsupported transactions fail the review; they never cause a partial success report. Index metadata is read separately because MongoDB does not support listing indexes inside a transaction.

| Section | Evidence and exceptions |
| --- | --- |
| `inventory` | Aggregate/batch sums, eligible/expired quantities at the explicit timestamp, mixed ownership/location, unknown units, invalid quantities/prices/expiry/status, duplicate batch labels, active barcode conflicts, deleted products retaining stock, latest ledger checkpoint. Legacy-only records are identified without inventing an opening receipt. |
| `batches` | Independently pages location batches to identify missing or foreign medicine references, including orphan batches that an inventory-led scan would miss. |
| `invoices` | Pages every branch invoice, flags legacy charge provenance, missing/conflicting organization and broken or duplicate linked pharmacy sources; issued invoice contents remain untouched. This is provenance review, not a replacement for tax validation or bank reconciliation. |
| `register` | Flags historical restricted-supply evidence gaps and missing scoped supply sources without reconstructing prescriber/patient details. |
| `access` | Organization subscription cardinality and legacy/manual/product evidence, implicit pharmacy module/capability mappings, paginated member branch-grant exceptions. No plan, paid entitlement or role is activated. |
| `indexes` | Captures existing keys, uniqueness, sparse/partial filters, collation and TTL metadata. It creates, drops or replaces no index. |

Pages contain at most 100 primary rows. Related inventory/source evidence is bounded at 500 rows; excess evidence yields an explicit exception and null totals rather than a partial sum. A heavily populated product needs separately reviewed evidence before migration. Output excludes names, addresses, clinical notes and patient identifiers. Source and manifest SHA-256 fingerprints detect changes in the projected evidence; they are neither signatures nor authorization to apply a migration. Reports can still contain internal business identifiers and quantities and should stay within the review process.

Every proposed opening quantity is null. Unknown unit bases, unexplained stock deltas and legacy receipt/entitlement assumptions require owner/pharmacist/finance review. The tool does not guess a conversion, add saleable stock, rewrite invoice/register history, infer payment proof or change a capability. Complete T25-B also requires a collection-wide orphan/ownership inventory (records without a usable location are outside this scoped tool), reviewed unit/lot mappings, compatible services, repeat-safe migration markers, backup/isolated restore evidence, before/after reconciliation and a scoped cutover window. Review and prepare indexes separately through the existing operator tooling after those prerequisites.

T11 adds captured lot fields and a separate receipt identity index. The review recognizes their unit/cost/expiry evidence and distinguishes legitimate captured lots sharing a printed batch from legacy label conflicts. It still performs no index change or backfill. See [the compatible receipt and index contract](pharmacy-stock-receipts.md).

Verification: 22 focused replica-set cases cover deterministic repeated manifests, pagination, tenant isolation, uppercase IDs, unknown/unsafe/overflow stock, expiry, wrong-location/orphan batches, source drift, bounded incomplete sums, captured repeated batches, immutable invoice/register history, grant ambiguity, inactive locations and index preservation. Native Mongo command monitoring confirms the data review issues reads and transaction aborts without write, index or commit commands. Backend TypeScript passed. Only synthetic test databases were used.
