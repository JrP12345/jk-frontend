# Pharmacy daily-workflow pilot

Updated 22 November 2026. This is an acceptance checklist for the existing implementation, not a declaration that a real store has passed acceptance.

## Pilot decisions and unanswered owner questions

| Question | Current answer / action |
| --- | --- |
| Where should testing start? | One branch, one designated billing PC, a pharmacist and a cashier. Test the same branch on a phone as a secondary view. Expand to two branches after the first branch balances correctly. |
| Which journeys matter? | Ordinary cash/UPI/card sales, prescriptions plus ordinary goods, customer credit, purchases and partial receipts, counts/disposal, returns/refunds, pickup, closing and reports. |
| Is the real store GST registered? | Unknown. The owner must supply its actual status and applicable issuer information. Do not treat the synthetic development issuer as real evidence or guess a GSTIN. |
| Who can sell restricted medicines? | Existing professional-evidence and prescription checks remain required. A role name does not establish a real pharmacist qualification. Unsupported restricted categories remain blocked. |
| Should customers receive credit? | Optional. No limit or overdue block is imposed by default. An organization administrator can set a customer's limit and terms; an exception needs an explicit audited administrator reference. |
| Can cashiers create customers? | Only with `PHARMACY_MANAGE_CUSTOMERS` or organization-management authority. This does not grant supplier, patient, pricing or stock-write access. |
| Can an accountant inspect records without selling? | Assign the independent sales, purchase and finance read permissions plus the relevant report/source grants. Write permissions remain separate. |
| Can downloaded CDCI content be loaded? | The reported affiliate application is pending. No licensed package was imported by this increment. Synthetic/local products remain usable. |
| Which hardware/network is supported in practice? | Actual store PC, scanner, printer, power-loss recovery and representative slow-network acceptance still need real-device testing. Passing isolated tests cannot establish this. |

## Implemented workflow changes

- Inventory **Batches, counts & history** distinguishes physical units from saleable, quarantined, expired and held units. Invalid or unreconciled evidence is shown as requiring review. Acquisition cost requires its existing independent permission.
- A physical count uses the selected lot and expected stock revision. Durable local recovery storage is required before sending it. An uncertain response retains the original command; a confirmed stale rejection permits a fresh count. Returned quarantined goods may only be reduced through a referenced damaged/expired disposal, never released through this form.
- Archive preserves history and refuses remaining physical stock, unreceived purchase quantities and unresolved applicable transfers. Completed purchase history alone does not block archive.
- Ordinary stock receiving requires printed per-base-unit MRP and explains classification/tax readiness. Receiving remains separate from approving a medicine for sale.
- Counter customer creation reuses existing parties, offers possible name/phone matches and requires explicit confirmation for a separate person.
- **Split / part payment** reuses the receipt ledger. Named customers may retain a balance; anonymous customers must settle in full. Digital components require verified references. Stock, invoice and the confirmed receipt commit together; a retry does not issue another invoice.
- Optional customer credit policies apply across that customer's branch records within the organization. Competing new credit is serialized. New credit invoices retain immutable due dates when terms exist. Earlier invoices are not assigned guessed due dates. Over-limit/overdue credit is blocked unless an authorized administrator records an audited exception. Paid sales do not acquire an extra credit-history query.
- Outside-prescription bills may include reviewed ordinary items when the operator also has counter-sale permission. Ordinary quantities do not consume prescription allowance. Restricted evidence and remaining prescribed quantities still apply.
- **Prepare parcel bill** loads exact requested products and commits the unpaid invoice, stock deduction and ready status together. Actual payment remains at handover. Cancelled/expired linked parcels provide a direct saved-bill return-resolution entry; stock/refunds never reverse automatically.
- Reports retain page exports and add **Load complete report** / complete reviewed CSV. Complete results use one snapshot with complete-result totals, no residual cursor and an exact export digest. The safe budget is 2,000 source records/result rows, 80 source pages and an elapsed read budget. A larger request fails explicitly; it never silently exports the first page as complete.
- Owner recall impact reuses global identity or explicitly labelled barcode candidates across accessible active branches, with paginated retained retail supply trace. Each branch/product/batch hold still needs its existing reviewed form. Unlinked local products, inactive branches and clinical supplies need separate review; there is no automatic ban feed or bulk hold.

## Real-store acceptance sequence

Run the five [mandatory store demonstrations](pharmacy-final-implementation-plan-2026-11-22.md#five-mandatory-store-demonstrations) alongside the detailed cases below: a five-medicine bill including three loose tablets; a 50-product distributor invoice with batches/expiry/free goods; 20 near-expiry strips across three suppliers; internet failure with original-receipt recovery; and the owner's 10 PM sales/collections/gross-contribution/credit/low-stock review. Timing targets in the plan are proposed targets, not measured store results. Multi-counter offline acceptance remains pending the shared LAN coordinator.

Sales & collections also supports an optional sale-date range using full days in the branch timezone. Apply/Clear retains search and payment criteria and restarts paging. Invalid ranges do not issue a read; missing or mismatched server period confirmation is shown as an error. This reuses the existing invoice date index and adds no stock/payment write or database collection.

Use a separate test branch and clearly synthetic products. Never reconcile a real stock count by copying a synthetic fixture.

| Step | Scenario | Expected result |
| --- | --- | --- |
| 1 | Review issuer, unit conversion, medicine classification, tax treatment, printed batch, expiry and MRP. | Missing evidence is visible and the relevant sale stays blocked. No guessed licence, MRP or tax data. |
| 2 | Receive two strips and loose tablets, including a free quantity on a purchase. | One base-unit count, captured lot cost and immutable receipt reference; a purchase draft alone adds no stock. |
| 3 | Bill loose tablets with keyboard shortcuts, then a whole pack. | Correct base quantity and exact paise, no request for every quantity keystroke, fresh server validation on Save. |
| 4 | Save cash with change, verified UPI, verified card and a mixed receipt. | Correct net drawer amount, references, receipt and stock. Save and Save & print issue one bill each. |
| 5 | Pay partly and retain customer credit. Try the same with an anonymous customer. | Named credit is permitted within policy; anonymous part payment is refused. |
| 6 | Create a customer with an existing phone/name. | Possible matches are offered. A separate person needs explicit confirmation; an uncertain save retries the same reference. |
| 7 | Issue two competing credit bills near a limit. Then test an overdue customer and an owner exception. | No limit overshoot from a race. Cashier override is denied. Owner exception is audited without changing the policy. |
| 8 | Supply a reviewed prescription with an ordinary item. Attempt a restricted extra or excess prescribed quantity. | One mixed bill with independent grants; unauthorized extras/over-supply are refused. |
| 9 | Another cashier sells a batch after a count screen opens. | Stale count is rejected and must be reloaded/recounted; no absolute stock overwrite. |
| 10 | Return damaged goods, record credit, then approve any actual refund separately. Dispose returned quarantine with a reference. | Goods remain quarantined, credit is distinct from cash, disposal cannot release or increase quarantine. |
| 11 | Try archiving stocked goods and an empty product on an unresolved receipt/transfer. | Both fail without hiding goods. A fully resolved empty product can be archived; history remains. |
| 12 | Request pickup, prepare it, then collect payment and scan/handover. Also test cancellation after preparation. | Ready is atomic with its unpaid bill; collection precedes handover. Cancellation requires explicit bill/physical-goods resolution. |
| 13 | Review a recall candidate at a second branch and an exact batch's saved supplies. | Only accessible branches appear; uncertain matches are labelled. Nothing is held or refunded by a read. |
| 14 | Load a multi-page report, then the complete result and export. Change a source after preview. | Page/complete totals are explicit; changed-source export is refused. Unsupported size fails with a narrowing instruction. |
| 15 | Disconnect/slow the network before Save, lose the response after Save, restart and repeat recovery. | Unknown results retain their original references; no duplicate invoice, receipt or stock deduction. Offline final billing uses only its existing designated-PC authority and supported scope. |
| 16 | Finish shift, count actual drawer cash, compare sales, receipts, credit, refunds and stock movements. | Differences have source references and are not concealed by editing historical bills. |

## Implementation and validation boundaries

This increment extends existing MongoDB models and services. It adds optional party credit policy, immutable invoice due date, a customer-credit lookup index, narrow permissions and bounded API reads. It adds no provider integration, catalogue import, migration, new business collection or dependency. Development data was not seeded or reset as part of these fixes.

Automated coverage uses isolated database fixtures and synthetic browser responses. See the final implementation report for the checks actually run. Full release gates, real pharmacy legal details, representative workload measurement, physical prints and backup/restart exercises remain separate acceptance work.

### Verification recorded for this increment

- Backend: 16 focused integration suites, 328 distinct cases including the added archive case. The broad run initially had one invalid report fixture (an opening receipt on a product with existing history); the fixture was corrected to a normal receipt and the affected complete-report case passed. Affected daily-operation and recall cases were rerun after their final edits. Billing, collections, returns, stock movements, transfers, purchases, capabilities, clinical prescription authority and clinical fulfillment were included.
- Frontend: 16 focused suites, 277 distinct cases across the broad run and affected reruns. Four assertions using the old delete label/no-read-menu behavior were updated to verify the intended archive/read-only behavior, retaining the write-denial assertions. Counter, workspace, collections, returns, prescriptions, pickup, parties, finance, reports, journals and new dialog workflows were included.
- Both application TypeScript checks passed. Frontend changed-file lint passed with four existing effect warnings; no rule or test was disabled. The patient payment-boundary check and both repository diff checks passed.
- API and all four workers compiled with the production build options into an isolated ignored output directory. The ordinary backend build could not overwrite existing `dist/workers/*.js` files because Windows returned access denied. Resolve those output permissions before using the ordinary build/deployment command; the isolated compilation is not a deployed build.
- The full application CI/release suite, Next production build, live pharmacy browser/device acceptance and external-provider acceptance were not run as part of this scoped change. No timing in these tests establishes real-store Save latency.

### Sales-history date follow-up, 22 November

- Backend counter integration suite: 22 cases passed, including full branch-local midnight boundaries, multi-page date/search/status filtering, cross-branch/organization isolation and invalid dates.
- Frontend collections and counter-access suites: 24 distinct cases passed across the initial run and final affected rerun. Includes explicit Apply/Clear, retained criteria and cursor reset, stale responses, mismatched response periods and no list/date-filter work in checkout mode.
- Both application TypeScript checks, changed-file frontend lint and both repository diff checks passed. No dependency, route, schema, index, environment or production build configuration changed in this follow-up. No new build or full release suite was run; the ordinary build-output permission limitation above remains unresolved.
