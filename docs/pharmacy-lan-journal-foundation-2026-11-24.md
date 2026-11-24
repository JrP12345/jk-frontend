# Shared LAN journal foundation

Implemented 24 November 2026 as an internal backend component at `backend/coordinator/PharmacyLanJournal.ts`. This advances P4 in the [controlling plan](pharmacy-final-implementation-plan-2026-11-22.md). It is not a runnable LAN counter, a deployment package, or completion of R08/R43/D4. Existing single-PC offline contracts are unchanged.

## Implemented core

The journal uses [Node's built-in SQLite interface](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), tested on local Node 24.7.0. A separate kernel-held SQLite lock permits one local process to operate that journal. Process exit releases the lock; no heartbeat or expiry grants another writer permission. Actual stock, product revisions, numbered receipt, cash evidence, original command and sequence/digest head commit in one `synchronous=FULL` transaction.

Values are AES-256-GCM encrypted with authority/row-bound associated data. A durable authenticated origin marker binds the original path and journal. Missing original head/database files cannot be reseeded automatically. Copied original files at another path fail the origin check. Keys are supplied by the internal caller; machine-bound key custody and protection against a privileged user cloning an entire installation are still deployment work. The class must not accept arbitrary seeds from a public request.

Prepared cashier entries have distinct counter keys, actor identities and drawers, separate from the coordinator signing key. P-256 proofs authenticate exact cash-sale intents. Same command/same intent recovers the same result, including after restart, stop, revocation or expiry. A changed command payload cannot create another effect under that reference. Each receipt retains original cashier/counter/permit, manual cash/change, issuer/product/unit snapshots, stock checkpoints, calculation versions and the preceding digest, signed by the coordinator.

New bills use prepared FEFO lots, current local balances and explicit reviewed unit versions. Expired lots are excluded; unavailable goods cannot consume other physical stock. Exact amount/cash checks, bounded allocations, engine versions, number limits, fiscal-year checks and backwards/drifting clock checks fail before commit. Quotes are explicitly unissued and expose no issued invoice number.

Local operator revocation and terminal stopped checkpoints are durable and signed. These are internal manager operations without a public endpoint; the authenticated administration layer remains required. Recovery exports contain encrypted rows and a coordinator signature with a read-only purpose, without private signing/encryption keys. There is no live-ledger restore/import path. Cloud synchronization acknowledgements and ownership release are not implemented by this class.

## Verification and remaining work

All **13** focused Node test cases passed against temporary real SQLite files. They cover exact retries, distinct cashier attribution, serialized last-unit contenders, rollback after a simulated failed head write, denial of a second process, recovery after process exit immediately after commit, revocation/stop, stale/expired clocks, FEFO expiry, physical versus saleable quantities, invalid key/number/stock preparation, exhaustion, encrypted export, tampering, copied paths and missing original evidence. This is not a physical power-cut, disk-pressure, two-browser or full cloud reconciliation demonstration. Temporary test directories are checked before recursive cleanup. The backend type check passed.

Run `npm run check:pharmacy-lan-journal` in the backend. These tests are also included in `check:tooling`, separate from Mongo-backed API tests. Evidence: ignored `backend/build/pharmacy-lan-journal-final-{cases,types}.log`.

Remaining engineering: independently verified cloud coordinator/cashier grants and preparation; fixed installation identity and protected keys; authenticated local HTTPS pairing, cashier sessions and revocation delivery; a LAN counter UI; source-bound cloud receipt import/acknowledgements and all-drawer stop/release; installer/service/update and read-only recovery tooling. A second separately seeded installation must never be allowed to spend the same authority. The seed interface is not evidence that these authorization boundaries exist. Do not expose this core for billing until the complete lifecycle and its adversarial integration checks pass.
