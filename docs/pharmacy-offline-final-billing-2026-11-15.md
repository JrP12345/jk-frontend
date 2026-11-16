# Final offline billing: one designated PC per branch

The first final-offline billing scope is implemented and connected to the existing pharmacy counter. **A prepared designated browser can issue and print ordinary anonymous cash invoices without internet.** Each Save commits the invoice, payment, owned stock deduction, next reserved number and synchronization entry locally before reporting success.

This replaces the earlier draft-only status. Online checkout and whole-branch online billing-only mode retain their existing paths. Offline digital payments, credit, restricted/prescription dispensing, returns and billing-only issuance are outside this first scope. Optional P2 integrations remain deferred.

## Owner and cashier workflow

1. In Locations → Pharmacy settings → Designated billing PC, enroll the intended browser and reserve 1–1000 numbers using the owner's configured series.
2. Open the original operator's cash drawer. Prepare offline cash billing while connected, choose a 12–128-character offline passphrase and record the actual review reference.
3. Preparation verifies and saves the signed issuer, product/unit/tax and owned-lot snapshot, confirms durable browser storage and verifies the public restart assets. The server grants at most 24 hours of cash issuance, clipped to the Indian fiscal-year boundary.
4. The branch stock and original drawer belong exclusively to that prepared counter until reconciliation. Other branches remain independent; competing writes in this branch wait. This is one PC and one operator, not unrestricted multi-terminal offline billing.
5. Search/scan, change whole quantities or pack quantities, enter discounts and actual cash received. Local calculations use the captured prices and FEFO lots. Save and Save & print require no financial HTTP request.
6. Save freezes a durable command, then atomically writes the financial receipt, stock/product balances, number and outbox. The cart clears durably and the counter is ready for the next bill. Recent bills print from their committed evidence.
7. On reconnect, the signed-in counter sends bounded, ordered original receipts with timeouts and backoff. A lost acknowledgement retries the same receipt. The server never reprices or renumbers an issued bill.
8. Download encrypted recovery backups regularly. To finish a session, stop the ledger, synchronize every original receipt, then reconcile and release the branch. The next session uses a fresh permanent number range. Expired authority or revoked enrollment never releases stock or recycles numbers.

After a full browser restart without internet, open the installed public pharmacy counter (or the pharmacy route's offline fallback). Unlock with the original browser key and passphrase. The shell caches no authenticated HTML or financial API responses. Synchronization needs a current authenticated session when connectivity returns.

## Implemented boundaries

| Area | Implementation |
| --- | --- |
| Calculation | Generated shared server/browser paise calculator and document builder. Integer quantities, rational unit prices, line/invoice discounts, GST and captured numbering are checked again at commit/import. |
| Preparation | Independently pinned server signing key; bounded signed pages; issuer, classification, units, lot prices/expiry and stock revisions verified before activation. Maximum 10,000 products and 50,000 lots. |
| Protection | Random AES-GCM record key wrapped with PBKDF2-SHA256 (600,000 iterations); passphrase remains local; non-extractable browser PC key signs receipts. Idle lock clears plaintext. |
| Atomic Save | Strict IndexedDB transaction; compare-and-swap head revision serializes tabs. Failure consumes neither stock nor number. Durable staged intent recovers a crash between commit and cart clearing. |
| Import | Original PC signature, manifest, frozen calculator policy, chain, sequence, prices, stock revisions, operator/tenant access and financial evidence checked. Invoice, collection, dispensing, stock movements, progress and required audit commit together. |
| Weak network | One receipt at a time, at most ten per flush, 20-second request timeout, bounded exponential backoff/jitter. Financial review durably holds new issuance across restarts while preserving original receipt recovery/import. No background execution guarantee after the app closes. |
| Deployment changes | Byte-pinned original calculation/document policy remains available for older already-issued receipts. Unknown policies fail closed; an outdated prepared policy becomes read-only for new issuance. |
| Restart | Durable financial database is separate from temporary drafts/session storage. Public static counter modules survive logout; authenticated/other cache resources are cleared. Storage denial clearly disables issuance. |
| Backup recovery | Encrypted bounded export; passphrase plus authenticated original PC public key verifies the complete signed chain. Read-only recovery imports original receipts and can release only an original signed stopped checkpoint. It never restores a writable old lease. |
| PC replacement | Revoke and reconcile the original PC first. Archive its immutable enrollment/public-key evidence, reserve fresh numbers and enroll the new browser atomically with audit. Original receipts remain verifiable after replacement. |
| Printing | Existing saved-invoice component in the app; structured A4 committed-snapshot document in the public restart shell. Printer errors/reprints create no second sale or payment. |

Preparation and key derivation can take time on older hardware; they are outside the per-bill Save path. Search renders at most 25 products; local lookups use cached indexes and only the relevant protected balances. No memory-only success fallback is used for financial issuance.

The browser key identifies a profile, not attested hardware. Persistent storage cannot protect against deliberate deletion, a failed disk or a compromised operating system/origin. An unbacked lost ledger cannot be reconstructed honestly. A backup without a terminal stopped checkpoint may restore receipts, but cannot prove that the original PC stopped issuing or release its ownership.

## Verification recorded on 15 November 2026

Risk level 4. Focused checks, not a full release gate:

- **22 real Chrome/IndexedDB checks passed**, including atomic cash/stock/number commit, quota rollback, competing tabs, exact retries, encryption, authorization expiry, numbering boundaries, staged-intent recovery, signed chains, stopped checkpoints, backup verification, durable review holds, process restart and a cold public-shell Save & print while the browser is offline. Desktop and mobile panels were inspected; locking clears bill/print plaintext.
- The headless print handoff is captured and the original paper is rendered to a synthetic A4 PDF. CDP's context-scoped durable-storage permission is explicitly renewed after restart; storage denial is exercised before renewal. Neither financial commits nor the storage APIs are mocked in that browser probe.
- **77 frontend policy/crypto/preparation/ledger/sync/device/asset cases passed** at the application checkpoint; follow-up UI, SDK durable-request recovery and service-worker checks pass separately. Existing online counter regressions passed earlier in this increment.
- Backend device, ownership and import integration tests cover native financial posting, HTTP sanitization, tenant access, required-audit rollback, cancellation races, late original imports, replacement and exact acknowledgements.
- Frontend production compilation and backend API/worker bundles pass. Package types, payment-boundary check and scoped frontend lint pass.
- Read-only selected-development-database readiness reports **125 models, 569 expected indexes, transaction-capable, ready**. No index/data preparation mutation was needed at this checkpoint.

Browser evidence is generated by:

```powershell
node scripts/performance/check-pharmacy-offline-ledger.mjs
```

Artifacts: `.next/pharmacy-offline-ledger-acceptance/results.json`, `synthetic-offline-counter.png` and `synthetic-offline-invoice.pdf`. The fixtures use synthetic data and no business API/database writes. A recorded isolated local commit took 12 ms; this excludes initial preparation, authorization, synchronization and printing, and is not a store performance SLA.

## Remaining acceptance

The [16 November stress follow-up](pharmacy-offline-operating-acceptance-2026-11-16.md) passes a 10,000-product/126-bill probe with CPU/network throttling, lost usable acknowledgements, forced Chrome termination, ordered queue recovery and detached encrypted-file verification. It distinguishes the transport simulator from native financial API coverage and records a concrete actual-store checklist.

The agreed first software scope is connected. Before calling it store-ready, complete these checks with actual operating equipment:

- Measure Save/search/print percentiles on the intended old PC, disk and realistic catalogue/cart sizes.
- Exercise real weak connectivity, a large accumulated queue and interrupted shutdown; retain and verify an external encrypted backup.
- Check physical A4/thermal printer output and device/browser storage settings.
- Review actual issuer/licence/classification records and the store's backup procedure.

These operating checks do not turn this development implementation into a deployment or compliance certification. Optional P2 and broader offline payment/dispensing modes remain deferred.
