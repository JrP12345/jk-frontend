# Pharmacy counter: local preparation and authoritative checkout

Reviewed and implemented 11 November 2026. This review covers the pharmacy counter, its bounded product search response, encrypted browser storage, payment handoff and public offline preparation shell. Clinical offline storage remains retired.

## Verified root causes

- Every cart edit invalidated the displayed quote and scheduled a new transactional quote after 250 ms. Eight edits separated by 300 ms generated eight quote requests. A quote loads issuer/customer evidence and rechecks captured stock lots; that work is necessary at checkout but excessive while typing.
- Every product lookup required a server request, including repeated names and known barcodes. There was no reusable catalogue working set. The exact-barcode database index already exists; no speculative database-index change was needed.
- A normal in-flight issue immediately displayed a pending-sale recovery warning. Successful collection then required both acknowledgment and starting another sale. Opening collection also loaded unrelated sales-history records.
- Reload preserved operation keys but lost frozen request bodies. Cart persistence existed, but product/price snapshots and a usable offline application shell did not.

## Current behavior

Search or scan, add instantly from the cached working set, adjust quantity, issue a verified bill, then record actual payment. Scanner focus stays ready for another product. Repeated in-flight scans share one lookup while preserving the scanned quantity. Final payment automatically opens an empty cart; the last bill and receipt remain available. Genuine pending-operation, stock, pricing, permission and payment exceptions still require resolution.

The counter uses estimated prices immediately after edits. A missing price is fetched promptly; known-price edits coalesce for 1.2 seconds before background validation. Explicit issue verifies a matching server quote. If the verified total differs from the displayed estimate, the cashier reviews the new total before issue. Estimates contain no authority to issue, reserve stock or record money.

The product cache contains at most 250 recently requested products and 50 bounded query pages. Name prefixes and exact barcode maps serve local lookups. Completed fresh queries can answer narrower prefixes. Only requested pages refresh; the app does not download or poll the full catalogue. Product names, units, barcode aliases, physical-stock snapshots and anonymous captured lot/price/GST evidence are allowlisted. Acquisition costs, customer contact details, complete quote assertions and issued documents are excluded from that cache. Snapshot coverage and stock are never represented as guaranteed availability.

Current/held carts, catalogue snapshots and submitted recovery intents use separate encrypted IndexedDB records. Cart drafts remain minimal. Confirmed issue and collection request bodies are retained separately for an identical explicit retry after reload; they are never automatically replayed as writes. A newer revision rejects stale-tab writes. Independent tabs have separate keys, and clearing one tab's session does not delete another tab's drafts.

## Offline policy and synchronization

The implemented offline policy is **preparation only**. The existing system has no approved offline-sale allocation or provisional-invoice policy. No official invoice number, stock deduction, restricted dispensing, payment receipt or external-payment verification is created offline.

The **Offline preparation** link opens `/pharmacy-offline.html`, a small public shell that loads encrypted session data locally. Its service worker caches only explicit public assets. A failed navigation to `/dashboard/pharmacy` can fall back to this shell; authenticated dashboard HTML and API responses never enter the service-worker cache. Other clinical routes retain their existing network-only behavior. Opening the preparation page also installs its public assets when developing locally.

The shell supports cached search/barcodes, quantities, discounts, active and held drafts, and estimated totals. It checks the actual authenticated server, not only `navigator.onLine`. Supported automatic synchronization is read-only: reconnect verifies the same identity and revalidates the latest draft quote. Failed reads retry with bounded backoff and foreground/manual fallback. Stale responses are discarded after further edits. Draft, Pending Sync, Synced, Conflict and Failed states describe preparation/reconciliation, not an official offline transaction.

Final billing always runs through the existing server transaction, current issuer/tax/customer/unit/stock checks and idempotency key. Uncertain submitted operations retain their original bodies/keys and use authorized result lookup; writes require an explicit retry. Manual cash, UPI and card receipts retain actual-receipt confirmation and separate collection authority. Hosted patient payment checkout is unchanged.

## Isolation and retention

Keys stay in session storage; browser records use AES-GCM, authenticated scope/branch/namespace binding, bounded retention and hashed identifiers. The twelve-hour session preparation lease supports reloads and browser-restored tabs. Sign-out, confirmed session rejection, account/organization/impersonation/permission changes and lease expiry remove access to drafts. A verification outage suspends online authority but preserves the same session's encrypted preparation work; reauthentication must match the original scope. Offline screens mask their contents when another tab signs out or changes organization. A fresh independent tab is a separate counter, not a shared draft.

Storage denial/quota failure is visible and falls back to memory where possible; it is not durable crash protection. A tab closed without restoration loses its session key. Physical stock can change on another device throughout an outage. Such conflicts are resolved by the authoritative server before issue; the browser never silently adjusts or finalizes them.

## Measurements and verification

Measurements used desktop Chrome, Next development mode and synthetic API responses with a 400 ms read delay. They are not low-end-device or production guarantees.

| Observation | Before | After |
| --- | --- | --- |
| Quote requests for eight spaced quantity edits | 8 | 1 |
| Initial uncached search | 886 ms | 893 ms in the same synthetic profile; still network-dependent |
| Repeated cached search | Previously always dispatched a request; repeated-search latency was not separately captured | 14–29 ms in development checks; 32 ms in the production smoke check, zero lookup requests |
| Quantity input to next animation frame | No comparable in-page baseline captured | Mostly 24–44 ms at desktop/mobile viewport sizes, with development-run spikes up to 137 ms |
| Successful counter completion | Record receipt, acknowledge collection, start another sale | Record receipt, automatically prepare the next bill |
| Sales-history fetch during counter collection | 1 per checkout | 0 |

Focused frontend tests cover cache isolation/expiry/eviction, money and quantity validation, persistence/recovery, stale responses, concurrent barcode input, same-key retries, payment methods/partial payments, shared finance/document consumers, auth suspension and service-worker privacy. Mongo-backed backend counter tests cover the authoritative financial/inventory boundary and the barcode projection without acquisition costs. Browser checks used synthetic sales/payments and real browser IndexedDB/service-worker behavior at desktop and narrow mobile widths, including dark mode, full offline reload, reconnect, stale-stock rejection, receipt access and next-bill readiness. No real client stock, invoice or payment was mutated.

Local evidence is in `.next/pharmacy-pos-baseline/profile.json`, `.next/pharmacy-pos-after/profile.json` and `.next/pharmacy-pos-local-review/`. The standard local production build initially rejected the development HTTP API URL; an isolated build with synthetic HTTPS public settings and a local read-only fixture backend passed. This is build verification, not a deployment.

The optimized production browser smoke check also passed offline reload, cached preparation, reconnect validation, stock conflicts, payment completion and receipt access. Its sampled quantity-to-animation-frame timings were 5.1–19.8 ms at a 1440 px viewport. Results and screenshots are in `.next/pharmacy-pos-production-review/`. This does not establish those timings on low-end physical devices.

Verification completed: 206 focused frontend cases across the changed counter/cache/recovery/security paths and direct consumers, the 16-case Mongo-backed backend counter suite, a focused assertion for the new barcode projection, package TypeScript checks, the hosted-payment boundary and the isolated production build. Counter cases include recorded-customer part-payment completion with retained dues and zero-value bills without a collection receipt. Changed-file lint has no errors; pre-existing effect/dependency warnings in the shared dashboard layout and collection list remain. Browser journeys used synthetic API transactions, separately from the backend integration tests; there is no claim of a live-provider end-to-end checkout.

Remaining release checks include real low-end devices and large real catalogues, actual scanners/printers, prolonged field outages, physical cashier handover, and full CI. The under-50 ms interaction target is not established across those devices. No background financial outbox or provisional offline receipt is claimed.
