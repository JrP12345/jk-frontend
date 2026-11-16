# Branch billing-only mode — 15 November 2026

The user selected a **whole-branch** setting. This increment extends the existing counter, catalogue, source documents and return pipeline. It does not introduce a second invoice or payment system.

## Implemented behavior

- Locations → branch actions → **Pharmacy settings** → **Branch inventory mode**. Existing branches default to tracked stock. Saving requires current settings authority, an expected revision and a real review reference; the setting and required audit commit together.
- In billing-only mode, catalogue products are billable with zero stock. Cart edits and display totals remain local. Save sends product IDs, base quantities, unit versions, discounts, the expected branch mode, confirmed amounts and any confirmed payment. Fresh server catalogue prices, classification, tax, issuer and supply evidence determine the actual invoice.
- The product editor reuses **Stock & pricing** for selling price and actual supply batch, printed expiry precision/value and MRP per base unit. These details describe the goods currently supplied; they do not create a stock receipt. Update them when the supplied batch changes. This first version supports one current supplied batch per product; it does not invent expiry, MRP or batches.
- Save reuses the existing atomic invoice/payment transaction, stable idempotency key, encrypted pending-intent recovery, numbering and saved-document printing. No `MedicineBatch` is created or decremented; aggregate stock and stock revisions are unchanged. Normal confirmed Save still resets the counter for the next customer.
- Classification and tax reviews still apply. The existing outside-prescription path retains pharmacist qualification, prescription allowances/progress and captured supply-register evidence. Existing Schedule X/narcotic restrictions remain in force. Clinical dispensing that depends on tracked inventory is unavailable in this mode.
- Each immutable dispense source records its inventory mode. Returns use the **original sale's mode**, not the branch's current setting. Billing-only returns create source-priced financial credit without increasing stock; returned goods still require physical quarantine. Tracked invoices retain their existing owned-lot/quarantine-stock return behavior.
- Receiving, stock adjustments, transfers and opening-stock imports are unavailable for new billing-only operations, enforced within inventory transactions. Supplier bills, collections, credit/refund workflows, financial reports and authorized history remain available.
- Current stock/expiry/valuation reports are unavailable while balances are frozen. Catalogue and counter rows say **Stock not tracked**. Public lists can remain published with **Contact pharmacy for availability**; automatic stock-based pickup requests are paused. Existing tickets remain reviewable.
- Mode-specific encrypted price caches prevent a previous FEFO lot quote from becoming the billing-only catalogue price. The pending command journal preserves its original mode. An old tab cannot switch inventory semantics by retrying Save. Offline preparation uses the appropriate cache and remains draft preparation.

## Boundaries and remaining work

**Direct switching after billing-only sales remains blocked; physical reconciliation is now implemented.** Use Pharmacy settings to pause the branch, enter/import actual batch counts, preview and confirm. Count adjustments and enabling tracked stock commit together. Frozen balances are not treated as an actual count. See the [Save and reconciliation follow-up](pharmacy-save-and-reconciliation-2026-11-15.md) for permissions, recovery, validation and limits. Switching directly back before any billing-only supply is still allowed.

Finalized offline billing is **not implemented** in this increment. Existing IndexedDB carts/catalogues are offline preparation, and an unconfirmed queued command is not an issued invoice. No bill is presented as paid or committed before server confirmation.

The next offline increment needs durable device identity and scoped operator authority, expiring branch/device invoice-series allocations, an explicit stock-allocation policy for tracked branches, encrypted immutable commands, same-key replay and actor-bound recovery, drawer/payment continuity, conflict review, revocation behavior, storage-loss handling and printer acceptance. Billing-only removes inventory deduction, but not those financial and synchronization requirements. Build a device enrollment/authority contract before exposing an offline finalization control.

Other P2 procurement/accounting/integration scope remains separate. This increment makes no blanket Indian statutory-compliance or physical-printer acceptance claim; it preserves existing reviewed document and supply evidence.

The user subsequently approved starting final offline billing for **one designated PC per branch**. Its internal durable ledger, [owner-defined invoice numbering](pharmacy-owner-numbering-2026-11-15.md) and [designated-PC enrollment/number reservation](pharmacy-designated-pc-2026-11-15.md) are now implemented and tested; exclusive stock/drawer authority, offline operator authorization, import/sync, common preparation, checkout wiring and protected backup remain. See the [offline implementation order and evidence](pharmacy-offline-final-billing-2026-11-15.md). The counter still requires internet to finalize.

## Verification

Risk level 4: focused backend integration tests cover settings permissions/CAS/audit rollback, zero-stock billing, atomic payment and print evidence, no inventory mutations, replay/recovery, stale mode/price rejection, malformed supply input, expired goods/MRP limits, tenant isolation, prescription registers, return continuity and an injected concurrent branch configuration write. Frontend tests cover the setting, catalogue editor, local counter totals, mode-specific caches, exact pending-intent recovery, public availability and existing consumers. Final check results are recorded in the audit status document.
