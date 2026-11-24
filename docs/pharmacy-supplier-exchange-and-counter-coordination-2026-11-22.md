# Supplier response files and counter coordination

This continues the [pharmacy POS extensions](pharmacy-pos-extensions-2026-11-22.md). It implements a distributor handoff without partner API access and makes existing exclusive offline ownership visible to other cashiers. No provider account, local service, deployment or pharmacy database was activated.

## Research and selected approach

[Marg's requirements](https://care.margcompusoft.com/margerp/general-queries/35868/1/crc32) specify a reliable LAN for multi-user operation. [GoFrugal's requirements](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasy/configurations/barcode-printer/articles/system-requirements-to-use-gofrugal-software-in-retail-business) distinguish server and counter clients. Its separate [disconnected-counter documentation](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasy/configurations/gst-calculations/articles/offline-billing-9-4-2023) documents loyalty and cross-counter reconciliation restrictions. These support choosing shared local coordination for Ekavyu; they do not establish how those products resolve every inventory conflict.

The selected next architecture is **one durable local coordinator per branch, shared over the LAN**, with one stock writer, one invoice sequencer and accountable cashier drawers. Counters must stop final billing when disconnected from that coordinator. This is a technical choice for the next implementation, not a deployed capability. Existing signed browser authority remains single-PC.

[GoFrugal's purchase import](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasy/purchase-management/purchase-import/articles/purchase-import) describes distributor CSV/XLS handoff; its [item-mapping instructions](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasy/purchase-management/purchase-import/articles/item-mapping-importing-the-invoice) require matching supplier items to local items. Ekavyu already has reviewed supplier invoice CSV mapping. This increment adds the earlier **order-response** handoff with exact source identities. It does not implement a distributor's proprietary format or live stock API.

## Implemented supplier handoff

Open an existing sent purchase order, then **Supplier response CSV**. Download the template and deliberately send it to the supplier through the existing communication process. The supplier fills only `accepted_base_units`, `quoted_price_inr_per_base_unit` and `supplier_note`. Review the returned file on that same order revision.

- Every row carries the format, exact order ID/reference/revision, branch, supplier, original line/product, composition and unit version/pack definition. Immutable cells must match. Row/column sorting is supported; substitutions, changed units, fuzzy names and stale revisions are rejected.
- Every line needs an explicit whole base-unit quantity, including zero for unavailable goods. Blank is never acceptance. Optional nonnegative INR prices per base unit have at most two decimals, converted with integer arithmetic. Unknown price differs from zero.
- Files are bounded to 256 KB, 100 product rows and bounded plain cells. Malformed quoting/text, duplicate/missing identities, control characters, invalid UTF-8 replacement text, oversupply and invalid money are rejected. Exported text protects spreadsheet formula prefixes.
- Parsing is local and has no business write. A complete valid file fills the existing response form, resets confirmation/reference and requires staff review. Reading disables submission. A rejected file preserves existing fields.
- Recording uses the existing encrypted journal, original idempotency key, current order revision, backend supplier-response rules and audit transaction. Existing uncertain-result recovery remains. Reading does not send orders, post invoices, record payments or receive stock. File content supplies no verified supplier identity.
- Existing management permissions apply. Dispatched, closed and invoiced orders cannot import responses. Clinical and receiving reviews remain separate.

Issuing/replacing supplier links or another order action can change its revision. Obtain a newly reviewed response using a fresh template after such changes. The existing printable order CSV remains a separate human-readable handoff.

## Implemented counter notice

`GET /api/pharmacy/locations/:locationId/counter-availability` requires current selling permission and branch access, uses `no-store`, and returns only branch/check time, mode, designated PC label, whether this is the prepared operator, and authorization expiry. It excludes other actors' IDs, device keys, grants, signatures, numbering allocations and authority IDs.

Modes distinguish cloud operation, offline preparation, active offline checkout and expired authorization awaiting reconciliation. Expiry never releases stock/drawers. Inconsistent reads across a concurrent claim/release fail visibly. This read is advisory: existing transactional ownership remains the posting boundary.

The normal counter retains carts and preparation while a hold is known, disables new Save/Save & print/F10, and explains original-PC recovery. Existing result lookup and same-request recovery remain. Failed/malformed refresh preserves a known hold. An initially failed read displays uncertainty; attempted server saves still undergo authoritative stock/drawer checks. The prepared local ledger is unchanged.

Refresh runs at mount, focus, network return and once a minute while visible. Concurrent reads are coalesced, superseded reads discarded, hidden-page polling skipped and cleanup aborts reads/timers. Availability never queues a financial mutation.

## Local coordinator still required

A coordinator needs a new authority/receipt contract. Today's browser grant binds one actor, a non-exportable browser-profile key and one drawer. Copying that key or attributing other cashiers' sales to that actor is not a valid multi-user implementation.

Required work includes signed bounded coordinator/cashier authorizations, per-cashier drawers, authenticated pairing, a trusted local HTTPS origin, encrypted durable storage/backups, atomic stock/number/payment journal commits, same-key retry, ordered source-bound cloud import and fenced stop/release. Coordinator restart must recover the original journal. A satellite losing LAN access must stop final issuance. Cloud writes stay fenced until all local results and a terminal stopped checkpoint reconcile; expiry or a missing heartbeat cannot release ownership.

Concurrent last-unit sales, duplicate requests, power loss after commit, revoked cashier authority, financial-year boundaries, incomplete imports and loss of the coordinator need adversarial verification. Store installation, certificates, LAN equipment and backup recovery need operating acceptance. **No runnable coordinator or multi-PC final-billing capability is claimed here.**

## Verification

Risk level 4. Checks were batched after logical implementation:

- 140 distinct focused frontend tests passed across exchange, purchase orders, availability, ordinary/prepared counter and daily operations. Final affected reruns passed 15 order cases and 77 availability/counter cases; these are included in the 140, not added again.
- 66 backend cases passed across offline ownership/import, atomic checkout and purchase orders. New cases cover seller-only access, sanitized output, tenant denial, ownership races and expiry preserving holds.
- Both package type checks, backend API/four-worker bundles, the hosted-payment boundary and both diff checks passed. The initial native-input lint error was corrected to shared Input; final changed-file lint has zero errors and zero warnings.
- Eight real-Chrome checks passed at 360/390/768/1440 px: template download, stale-file refusal, real File API review, exact quantities/paise, expired ownership and retained preparation. Mobile screenshots were inspected. The fixture makes only local GET requests with no business database/provider calls.

Probe: `node scripts/performance/check-pharmacy-supplier-exchange.mjs`. Ignored evidence: frontend `.next/pharmacy-continue-*`, `.next/pharmacy-supplier-exchange/` and backend `build/pharmacy-continue-*`. Component browsers and isolated MongoDB integration tests are separate checks. Live distributor, physical-store, deployed full-stack and full CI/release acceptance remain separate.
