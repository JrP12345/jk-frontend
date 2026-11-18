# Pharmacy audit implementation status — 15 November 2026

The approved P0/P1 engineering work and selected-development-database activation are complete. Focused regressions, an isolated production build, actual Chrome IndexedDB checks and synthetic PDF checks passed. Physical printer output, real-store latency and actual licence/record/backup evidence remain operating acceptance items. This report does not certify deployment or legal compliance. Whole-branch billing-only mode and physical stock reconciliation are implemented. The user has now approved starting final offline billing for one designated PC per branch, including owner-defined numbering. Its [first local-ledger increment and remaining dependencies](pharmacy-offline-final-billing-2026-11-15.md) are recorded separately. Prepared ordinary cash final billing is now connected for one designated PC/operator per branch, including local Save/print, ordered authenticated synchronization, encrypted backup recovery and reconciled PC replacement. See the current offline report for its bounds and remaining equipment acceptance. Optional P2 work remains deferred.

The [original audit](pharmacy-priority-audit-2026-11-14.md) is the pre-change baseline. Earlier reports cover [Save and recovery](pharmacy-p0-save-reliability-2026-11-14.md), [search](pharmacy-p1-search-2026-11-14.md), [purchase CSV](pharmacy-p1-purchase-csv-2026-11-14.md), [supplier mappings](pharmacy-p1-supplier-mappings-2026-11-14.md), [receiving](pharmacy-p1-purchase-receiving-2026-11-14.md) and [branch catalogue preparation](pharmacy-p1-branch-catalogue-2026-11-15.md).

Development clarification, 16 November: no physical store equipment is connected or required to finish the agreed development scope. The [fallback follow-up](pharmacy-offline-operating-acceptance-2026-11-16.md) covers printer/PDF recovery, remembered A4/thermal formats, non-blocking post-Save history and honest backup download status. Equipment-specific operating checks belong to future rollout; optional P2 and broader offline modes remain deferred.

## Remaining code gaps addressed

| Problem | Implemented change | Boundary retained |
| --- | --- | --- |
| Literal server searches scanned the active branch catalogue. | Normalized substring keys and four branch/active/product-ID indexes cover brand, generic, strength and manufacturer. Exact normalized residual matching preserves literal multi-term search, punctuation, short terms and Unicode normalization. | Exact barcodes keep leading zeros. No fuzzy substitution or inferred dispensing authority. Stable 25-item cursor pages and query time limits remain. |
| Renames could make a derived search index stale. | Per-field projections update atomically with document saves, inserts, query updates, replacements and bulk writes. Independent name/manufacturer edits do not overwrite each other's keys. | Stock, price and authority updates perform no additional projection reads. Derived keys are excluded from ordinary JSON and default reads. Unsupported update pipelines/derived-key assignments fail closed. |
| Staff lacked a rack/shelf cue. | Optional, validated 60-character rack/shelf metadata in the existing medicine editor and optional catalogue CSV mapping; shown in inventory identity, counter search results and bill product rows; retained in encrypted catalogue snapshots. | It is operational product metadata, not a patient invoice field, batch identity, stock quantity or professional classification. |
| Low-stock alerts had no persistent replenishment follow-up. | Purchases → Shortbook stores one revisioned shortage per branch/product. Low-stock alerts open its product editor. Requested base units, note and open/resolved status can be reviewed; stale/concurrent edits are rejected. | Shortages do not reserve stock or create liabilities. Changed units require explicit quantity re-entry; archived products' original shortages can be resolved. Current purchase authority and branch scope are checked on the server. |
| Re-entering shortage quantities in an inward invoice was repetitive. | Select shortbook entries and copy them into the existing supplier invoice draft, converting base units into recorded packs/loose units. Entry IDs are carried in editable draft notes. | The actual supplier, invoice number/date, base amount and GST still require review. This is a quantity handoff, not a purchase order or a typed financial source binding. Copying does not resolve shortages, post a bill or receive stock. |
| Expiry alerts required finding the original supplier invoice manually. | Valid purchase-receipt lots expose an opaque purchase reference. Authorized staff open the existing supplier-return review at the matching received-lot page. | No shortcut is offered for unlinked opening, transferred, customer-return or invalid lot evidence. Fresh return-source reads and existing return/credit commands remain authoritative. Quantities start at zero; actual supplier credit-note confirmation remains separate. |
| Purchase/return staff could not reach that review without a settlement grant. | Finance navigation also admits the existing purchase-and-return authority combination. | Money settlement controls remain disabled without their own grants. Pending financial command recovery takes precedence over a shortcut. |
| Outside-prescription billing required unnecessary pointer movement. | Focus first remaining quantity on open; Enter advances quantities/prepares the selected supply; F8 prepares; F10 saves after required actual-payment confirmation. Prepared payment fields receive focus. | No quantities are automatically assumed supplied. Repeated/modifier shortcut events and unrelated dialogs are ignored. Expired/non-approved selection cannot prepare through a shortcut; server professional, allowance, stock and payment checks still run. |
| A synchronous IndexedDB write exception escaped its event callback, even when the draft subsequently fell back to memory. | Catch write exceptions inside the callback, abort the transaction and reject through the storage promise. Chrome quota-failure injection now produces memory-only status without an uncaught page error. | No failed disk write is reported as durable. Conflict rejection, encrypted storage, session clearing and financial-intent recovery remain intact. Offline assets were regenerated with cache version 19. |
| The global floating assistant covered the mobile counter's Pay action. | Dock the existing assistant trigger in the dashboard header on the pharmacy route. The same launcher remains mounted; other routes retain its floating placement. Loading and loaded triggers share the placement frame. | Existing clinical permissions, on-demand loading, chat state and dialog behavior remain. Closing the assistant no longer brings a floating trigger back over checkout. |

The shortbook uses the existing purchase permission, transaction, branch pinning, required audit and shared form/quantity components. It is an online procurement aid, with no background write replay. This table describes the earlier P0/P1 checkpoint. The later [final-offline increment](pharmacy-offline-final-billing-2026-11-15.md) adds separately activated, protected cash issuance; ordinary online checkout remains available outside a held offline session.

The search indexes add storage and catalogue-write work. Their size and behavior should be checked against the intended catalogue; stock-only writes do not rebuild their keys.

## Measured evidence

All measurements below use disposable local MongoDB replica-set fixtures and synthetic data, not the configured application database.

- Selective `maker 650` search: **10,000 branch products plus 1,000 foreign products; 21 ms** in the recorded request. The execution plan used `pharmacy_search_*`, examining **2 documents / 1 index key** rather than the branch-wide scan. This single selective query is not a latency SLA; common one-character searches can examine more candidates.
- Paid Save, 50 historical lots per product, three samples per bill size:

| Lines | First sample (ms) | Later samples (ms) | Sample median (ms) | Sample maximum (ms) |
| --- | ---: | --- | ---: | ---: |
| 1 | 215 | 127, 125 | 127 | 215 |
| 10 | 554 | 411, 381 | 411 | 554 |
| 20 | 643 | 634, 555 | 634 | 643 |

The fixture's first sample is a cold-operation sample after fixture setup, not a process/OS cold start. Three samples are insufficient for a reliable production p95. These results recheck the prior Save optimization; this increment does not claim another checkout speedup. Browser storage, internet latency, native print dialogs and paper output are outside these API measurements.

- Two authenticated tills with separate drawers each requested six of the last ten units: **201 / 409**, **one invoice / one collection receipt**, **four units remaining**. Recorded durations were 125/140 ms; combined probe including conservation assertions was 149 ms. The losing request did not create an unpaid orphan invoice or second receipt. This is a controlled contention case, not a sustained-load benchmark or retry distribution.

## Database preparation and activation

New schema indexes and derived search keys must be ready before enabling indexed lookup against an existing development catalogue. New/edited/imported products maintain the projection through normal model writes. There is no financial-data migration or compatibility mode.

The existing index tool and new search projection tool separate preview, read-only checks and explicit application. From the backend repository:

```powershell
npm run db:indexes
npm run db:medicine-search

# Connected, read-only checks against the operator-selected MONGODB_URI:
npm run db:indexes -- --check
npm run db:medicine-search -- --check
```

Only after selecting the intended database and pausing application writers, the explicit setup commands are:

```powershell
npm run db:indexes -- --apply --writes-paused
npm run db:medicine-search -- --apply --writes-paused
```

`db:medicine-search` also supports `--location=<24-hex-ID>` for a selected branch. It traverses active products in 200-row pages, reports aggregate counts without product/customer data, and modifies only derived search fields. Each update matches the original source identity, so a concurrent identity change is reported as a conflict rather than receiving stale keys. It does not create indexes, rewrite stock/prices/authority, or recreate bills. Repeat both read-only checks after setup.

### Selected development database: activated

The original connection failure was a sandbox DNS timeout. The same selected cluster's SRV lookup succeeded with network access. Connected checks then identified two missing collections, two obsolete unique indexes and one active medicine without derived search keys.

After the user authorized development setup, the identified local API watcher and its children were stopped; no separate local background workers were found. The exact obsolete index definitions and their current replacement indexes were reviewed before removal:

| Removed development constraint | Retained replacement / reason |
| --- | --- |
| `invoices.items.pharmacyDispenseLineId_1` | `pharmacyDispenseLineIds_1`. The current dedicated source-ID array avoids indexing missing source IDs in mixed clinical items. All 21 existing invoices had matching source projections; 20 had dispense sources. No invoice was rewritten. |
| `medicinebatches.medicineId_1_locationId_1_batchNumber_1` | `pharmacy_receipt_line_v1`. Actual receipt-line identity remains unique; separate receipts can retain the same manufacturer's printed batch label with their own cost/MRP evidence. No lot or quantity was rewritten. |

This was an explicit, reviewed removal of those two named constraints, not an automatic index synchronization. The captured index definitions are preserved in the backend [development evidence archive](../../backend/docs/measurements/pharmacy-development-2026-11/pharmacy-reviewed-index-metadata.json). `ChainTransitionRecord` and `OrgInvite` collections were prepared with their schema indexes; the medicine's derived keys were populated with source-identity comparison. No stock, prices, invoices, payments or audit records were rewritten. No backup or restore was performed.

After API restart, the read-only checks reported:

- Schema: **115 models, 550 expected indexes, no issues, transaction-capable database, ready**.
- Search: **indexes ready, 1 medicine scanned, 0 stale projections, ready**.
- Local API: liveness **200 / ok**, readiness **200 / ready**, MongoDB connected, Redis ready and bootstrap complete.
- A read-only configured-catalogue search returned the product, examining one document and one index key. A one-product catalogue does not demonstrate large-catalogue latency or require the planner to choose a substring index; the 10,000-product fixture above supplies that evidence.

Ignored backend evidence: `.cache/pharmacy-selected-activation.log`, `.cache/pharmacy-selected-readiness.log` and `.cache/pharmacy-selected-search-readiness.log`. Connection credentials and record identifiers are not included in these reports. The development API was restarted in a hidden process; its output is in `.cache/pharmacy-activation-api.stdout.log` and `.cache/pharmacy-activation-api.stderr.log`.

## Chrome storage and print checks

The reproducible [browser probe](../scripts/performance/check-pharmacy-browser.mjs) runs the actual storage modules, invoice component and shared print lifecycle against a loopback-only synthetic harness. It makes no application API or database writes. It uses optional local tooling, like the other performance scripts:

```powershell
# Set these to directories whose node_modules contain the named tooling.
$env:PLAYWRIGHT_TOOLS_DIR = '.next/landing-tools' # playwright-core
$env:PHARMACY_BROWSER_BUNDLER_ROOT = '../backend' # existing esbuild dev dependency
node scripts/performance/check-pharmacy-browser.mjs
```

All **10 checks passed**: encrypted disk writes and field allowlisting; draft reload; stale-writer rejection; exact paid-intent reload without resubmission; 10,000-product disk persistence/restoration; injected quota failure with truthful memory-only status; logout/key invalidation; and A4, 80 mm and 58 mm print handoffs/PDF layouts. The 35-line A4 fixture spans multiple pages; thermal content fits inside the caller's 2 mm margins. Captured issuer/signature content remains visible, and print frames clean up after the simulated print event. PDFs and screenshots are in `.next/pharmacy-browser-acceptance/`.

These are actual headless Chrome IndexedDB and rendering checks, not physical device/printer certification. Quota failure is injected rather than filling a disk. Print invocation and `afterprint` are intercepted; native dialog cancellation, printer drivers and paper output still need real hardware checks.

## Built-app Save and recovery acceptance

The [checkout browser probe](../scripts/performance/check-pharmacy-checkout.mjs) runs the actual standalone production package with synthetic, intercepted API contracts. It stages the public/static assets required by Next's standalone server. It makes no real business API or database writes. After creating the isolated build above, run:

```powershell
node scripts/performance/check-pharmacy-checkout.mjs
```

All **10 built-app scenarios passed**:

| Scenario | Browser evidence |
| --- | --- |
| Cash and slow Save | Quantity/total edits make no quote or financial request. Insufficient cash disables Save. A deliberately delayed response leaves the Save footer in place. One paid Save request resets the cart and focuses search after confirmation. |
| Mobile Save & Print | One Save includes document evidence; printing needs no invoice read or separate collection command. No second payment dialog or success banner replaces checkout. |
| Digital payment | UPI requires an entered reference, sends no cash tender and completes through one Save. |
| Recorded customer credit | Walk-in cannot use Credit. Selecting a recorded customer enables an unpaid account bill without recording payment. |
| Changed price | An explicit `COUNTER_TOTAL_CHANGED` response refreshes prices, clears the old digital reference and requires review. A subsequent confirmed Save uses a new key. Backend rollback integrity is established by integration tests, not this simulated response. |
| Lost response and reload | The exact pending key/draft restores. Read-only recovery opens the already saved result without sending another sale command. |
| Insufficient stock | The rejected Save retains quantity/cart and never shows a successful sale. |
| Printer failure and retry | The saved bill remains complete. Retry prints the saved evidence without another financial command. |
| Short desktop | Save remains visible at 1366 × 768; normal checkout has no outer workspace scroll. |
| Loaded mobile assistant | At 360 px, opening/closing the assistant keeps its trigger in the header and leaves Pay unobstructed. At 390 px, Save and Save & Print remain usable without horizontal page overflow. |

Results and screenshots are in `.next/pharmacy-checkout-acceptance/`. The deliberately controlled response times are **not** configured-store Save latency or a server throughput benchmark. Native print invocation is intercepted; physical printers and native dialogs remain separate acceptance work.

## Verification

Risk level 4. **13 distinct frontend suites and 12 backend suites passed across the scoped runs.** Frontend coverage includes shortbook edits/conflicts/scope changes, purchase draft handoff, alerts, finance, prescription keyboard/payment gating, cached catalogue/racks, counter Save/print/recovery, workspace permissions, imports, branch catalogue and offline/privacy assets. Backend replica-set suites cover indexed search and preparation, catalogue validation, shortbook scope/concurrency/audit rollback/pagination, expiry reports, imports, supplier returns, Save timing, competing tills, atomic paid checkout, stock preparation and prescription authority.

Both package TypeScript checks and the frontend payment-boundary check passed. Changed frontend files were linted; remaining warnings are in existing effect patterns, with no lint errors. The API and four workers bundled successfully into an isolated backend cache directory.

The completion pass additionally verified **44 backend cases in 3 suites** (schema setup, receipt lots and invoices), **132 frontend cases in 9 suites** (drafts/authority/hooks, journal, catalogue, counter and document recovery/rendering) and **12 offline/privacy cases in 3 suites**. The final storage source also passed its direct draft suite and TypeScript/build compilation. The isolated Next production build completed with safe synthetic API configuration in `.next/pharmacy-acceptance-build`; it is compilation evidence, not a deployable store configuration. Full unrelated CI/release suites were not rerun locally.

The subsequent checkout pass added the 10 standalone browser scenarios above, **6 focused assistant cases** (18 unrelated cases deliberately skipped) and **29 dashboard/navigation/mobile cases**. Changed code linted with no errors; six warnings concern existing dashboard/assistant effect patterns. The production build and its TypeScript compilation passed after the header placement fix. No backend source or financial contracts changed in this follow-up.

## What remains before operating acceptance

| Item | Status / evidence needed |
| --- | --- |
| Selected development database readiness | Complete. Reviewed setup applied; post-restart schema/search checks and local API readiness passed. |
| Actual Save latency | Operating acceptance remains open. The [Save/reconciliation follow-up](pharmacy-save-and-reconciliation-2026-11-15.md) fixes shared local queue blocking and exposes server/browser phase timings. Controlled Chrome contention improved from 714 ms to 8 ms; this is not a configured-store latency claim. |
| Weak networks and older billing PCs | Bounded counter catalogue search and index construction in 200-product yielding chunks are implemented; a 10,000-product synthetic 4× CPU Chrome probe passed. Prepared local Save/print and bounded ordered synchronization are implemented and pass synthetic restart/network-recovery checks. Actual network/CPU/RAM/disk/printer acceptance remains. No supported-hardware or instant-Save claim is made. See the [implementation evidence](pharmacy-ownership-and-performance-2026-11-15.md) and [acceptance criteria](pharmacy-offline-final-billing-2026-11-15.md#remaining-acceptance). |
| Thermal and A4 printers | Synthetic Chrome/PDF checks passed for all three supported paper sizes, long medicine names, margins and multi-page A4 output. Physical printers, native dialog cancellation and actual paper remain open. Reprints reuse the saved invoice. |
| IndexedDB device acceptance | Local Chrome disk persistence, reload, 10,000-product catalogue, conflict handling, logout and injected quota failure passed. Intended mobile devices, private browsing, storage eviction and real quota exhaustion remain open. |
| Store operating evidence | Open. Review the actual business/issuer profile, licences, professional authority, applicable records, inspection exports, retention and successful backup/restore evidence using existing workflows/runbooks. No blanket compliance claim is made. |
| Billing-only/no-stock mode | Implemented for the whole branch. The subsequent physical-count workflow now supports returning to tracking: pause, count/import, preview, confirm atomically, with exact recovery and source-mode return continuity. See the follow-up for bounds. |
| Final offline billing: one designated PC per branch | Implemented for separately activated ordinary anonymous cash billing: protected local atomic Save/print, verified preparation and operator unlock, ordered authenticated native import, restart shell, durable conflict hold, encrypted read-only backup recovery and reconciled PC replacement. First preparation and synchronization require internet; local authorized finalization does not. Actual equipment acceptance and broader offline payment/dispensing modes remain. See the [implementation order](pharmacy-offline-final-billing-2026-11-15.md) and [latest preparation/calculation evidence](pharmacy-offline-preparation-and-calculation-2026-11-15.md). |
| Owner-defined invoice numbering | Implemented in branch Pharmacy settings: prefix, next number, digits and fiscal-year policy, organization-scoped reservations, immutable captured formats, print/recovery/return continuity and reviewed development indexes. Default branches retain system numbering. Designated-PC enrollment reserves exclusive offline numbers; a separately verified activation enables bounded offline cash checkout. See the [numbering increment](pharmacy-owner-numbering-2026-11-15.md) and [device increment](pharmacy-designated-pc-2026-11-15.md). |
| Optional P2 procurement/accounting/integrations | Deferred until needed; separate from the now-approved final offline billing work. |
| Release | Full CI/release gates and intended-environment configuration remain required before deployment. The isolated build does not replace them. |

The approved P0/P1 engineering and development activation scope, whole-branch billing-only mode, and the subsequent bounded physical stock reconciliation are implemented. Actual operating acceptance remains open. The agreed first offline cash scope now includes connected server authority, checkout, synchronization and recovery; operating acceptance remains open. Remaining optional P2 scope is deferred. Current follow-up evidence is in [Save latency and physical reconciliation](pharmacy-save-and-reconciliation-2026-11-15.md) and the [offline implementation report](pharmacy-offline-final-billing-2026-11-15.md); the sections below record the earlier billing-only increment.

## Whole-branch billing-only increment

See [behavior, boundaries and remaining offline design](pharmacy-billing-only-2026-11-15.md). The final focused backend run passed all **9 billing-only cases and 3 billing-only external-prescription cases**; the remaining 11 external-prescription cases were deliberately excluded from that last focused rerun after their full suite passed. Coverage includes price/configuration races, required-audit rollback, preserved historical stock revisions, no unnecessary catalogue-edit audit, exact recovery, printable source evidence and returns without restocking. Adjacent checkout, returns, capability, stock movement/validation, transfer, report and pickup regressions were also exercised.

Frontend counter/workspace/returns/Save-status coverage passed **127 cases in 4 suites**. Settings passed **7 cases**, and the mode-specific catalogue/journal, public pickup, outside-prescription, offline asset/privacy and consumer suites passed in their scoped runs. The final native picker change passed its affected editor case. Changed-file lint has no errors; existing effect/purity warnings remain.

Both package type checks/compilation, the payment boundary check, the isolated Next production build and the API/four-worker bundle build passed. Next's temporary generated type-directory additions were removed from `tsconfig.json` afterward. The final small navigation label/filter edits were checked with lint and the affected editor flow; an unrelated full build was not repeated for those edits.

All **11 standalone browser scenarios passed**, including the added zero-stock billing-only Save & Print case: quantity edits made no request, one Save carried the branch mode/payment/document request, printing used the response, the cart reset, and no collection dialog opened. These use intercepted synthetic APIs and do not measure configured-store latency or physical printer output. No real branch was switched to billing-only as a test.
