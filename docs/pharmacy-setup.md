# Current schema and index setup (T25)

Implemented locally for fresh installations and current development databases. There are no production legacy customers to migrate: no stock backfill, entitlement grandfathering, historical invoice rewrite or data-deleting reset is required. This extends the existing backend index preparation command; application requests never call the setup service.

From the backend checkout:

```powershell
npm run db:indexes
npm run db:indexes -- --check
npm run db:indexes -- --apply --writes-paused
```

The first command prints a deterministic current-schema index manifest without connecting to MongoDB. Connected modes use the operator-selected `MONGODB_URI`; the existing npm script loads the backend `.env`. No URI, credentials or source-record values are printed in error messages.

`--check` disables automatic collection/index creation and reads index metadata only. It reports missing collections/indexes, incompatible options/names, undeclared unique constraints and undeclared TTL indexes. Key order, uniqueness, sparse/partial filters, collation, hidden options, expiry and text-index weights/language are checked. Existing intended notification/auth TTLs remain supported; a surprise expiry on a durable receipt is a readiness failure. Final readiness also requires a transaction-capable replica set/managed cluster.

For a fresh selected database, pause application writes and run explicit `--apply --writes-paused`. Setup creates empty collections and current declared indexes, including collections with no additional indexes. It verifies readiness afterwards. Repetition preserves existing records/indexes. Setup never seeds users, modules, licences, prices, stock or dues; their reviewed provisioning workflows remain separate.

Stale development constraints block setup before changes. For example, old printed-batch uniqueness is incompatible with several genuine receipts carrying the same printed batch. Review that named index explicitly against current source identities; the command will not drop or replace it. Duplicate facts can also prevent a missing unique index from being created. The error omits duplicate values, preserves both facts and notes that earlier missing indexes may have been created. There is no automatic cleanup.

For a disposable fixture reset, choose a newly named empty development database, prepare its current schema and run the synthetic fixture flow against it. Leave the prior database intact until its owner explicitly chooses what to retain. The test harness uses isolated memory replica-set databases; it does not reset the application's configured database. Optional T25-A read-only diagnostics remain available for development investigation and are not a production migration requirement.

Ten focused cases verified all current registered models on a fresh database, repeat setup, no record mutations or readiness writes, actual receipt/source uniqueness, clinical/retail invoice coexistence, repeated printed batches, stale unique/partial/TTL constraints, safe duplicate errors and native Node preview/check execution. Backend types and whitespace checks passed. The Node probe caught and corrected unsupported parameter-property syntax; heterogeneous Mongoose model metadata uses compatible generic types. No frontend code changed for T25, and no full suite, production index application, migration or deployment ran. Backup/restore, real operational capacity and release evidence remain T26 gates.
