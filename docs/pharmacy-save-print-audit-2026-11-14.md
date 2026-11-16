# Pharmacy Save and Save & print audit — 14 November 2026

## Findings and implemented changes

The existing first-payment path was already atomic: the invoice, supplied stock, payment, collection receipt and required audits commit together. This review preserves that boundary, the reviewed-product restriction, branch/permission checks, current unit definitions, FEFO lot allocation, MRP/tax validation, recorded-customer revision, and same-key recovery.

| Problem | Effect | Implemented solution |
| --- | --- | --- |
| A cart with local display prices still awaited a fresh quote before sending Save | Two dependent network requests, repeated authorization and stock/pricing preparation | `current_total` confirmation sends product IDs, quantities, unit versions, discounts, each displayed line amount and the payable amount in one Save request. The transaction loads current records and recalculates everything. Client amounts are assertions, never pricing authority. |
| Only comparing the total would miss offsetting changes to individual prices | Two changed line prices could leave the grand total unchanged | Compare every line's amount after line discount, plus the final total after invoice discount. A mismatch rolls back and returns `COUNTER_TOTAL_CHANGED`; the UI loads the fresh quote for explicit review. |
| Rejected prices could reach the stock mutation loop before total validation | Work performed only to roll it back | Confirm amounts immediately after preparation, before FEFO writes, invoice numbering or collection. |
| Product preparation fetched each medicine separately | N medicine reads for an N-line cart, in both quote and issue preparation | One bounded, branch-scoped `$in` read and an ID map. Existing per-product lot bounds and reconciliation checks remain. Database operations inside a transaction remain sequential. |
| Save & print fetched the invoice again after committing it | Another network request and repeat invoice/source reads before printing | `includeDocument` returns the captured invoice plus supplied lot evidence with the committed result. The normal response stays small when printing was not requested. The encrypted operation result retains the same document for replay/recovery. History and checkout share the document serializer. |
| Retrying failed print preparation reread an already loaded document | Unnecessary delay and reliance on another API response | Reuse the validated saved document in memory. A printing retry issues no financial commands and does not reread an already loaded invoice. |
| Successful automatic print preparation left a hidden print component mounted | Stale lifecycle state and retained document DOM | Close that component after handing off to native printing. Failed preparation keeps a local retry action. A preparing status is fixed-position and does not replace checkout. |
| A successful-looking response with a different total was not explicitly rejected | Cart could clear after an inconsistent API response | Validate the saved total against the frozen confirmed amount before accepting success. Uncertain outcomes retain the original reference. |
| Save latency lacked a dedicated response measurement | Browser, API and printer time were difficult to distinguish | Save responses now include `Server-Timing: counter_save;dur=…`, including rejected commands. This measures the sale service; HTTP middleware/network time is additional. |

Normal priced cart:

```text
Before: local cart → quote request → durable intent → atomic Save → invoice GET → print assets → native print
After:  local cart → durable intent → atomic Save + saved document → print assets → native print
```

Missing display prices still require a quote. Explicit Refresh prices still produces a strict quote with issuer, customer, stock and quote-hash assertions. Ordinary Save can use that unchanged quote. The new current-total path intentionally selects current eligible lots at commit rather than requiring a stock revision from an earlier provisional read; current unit/customer identity and conditional stock updates still apply.

## Necessary waits and operational limits

- IndexedDB draft/recovery persistence remains before the mutation. Success is shown only after the database commit and receipt validation; an optimistic “Paid” message would be incorrect.
- A timed-out command may have committed. Recovery and retries retain its key, original amounts, payment components and print preference; they never mint another payment automatically.
- Stock validation, required audit writes, drawer claims and majority commit remain synchronous. Optional history/overview refreshes stay outside the Save dependency chain.
- Native `window.print()` blocks while the print dialog is open in supporting browsers. That time is separate from saving. Closing a print dialog does not prove that a physical printer produced a page.
- The supplied screenshots do not establish live database/network latency. Use the new timing header and browser Network timing to distinguish handler time from network or print preparation. No claim of instant physical printing or a production latency SLA is made.
- Restart the development backend to load the changed Save contract before testing this frontend against it. No migration or external infrastructure is required.

## Design references

- [AWS: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): caller-owned identifiers preserve intent across uncertain outcomes. The existing encrypted command journal and durable receipt remain the recovery boundary.
- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html): transaction operations must not be parallelized with `Promise.all`. The read optimization batches medicines in one query instead.
- [MDN: Window.print](https://developer.mozilla.org/en-US/docs/Web/API/Window/print): native printing waits for document loading and blocks while its dialog is open. Printing is therefore a separate post-commit stage.

## Verification

- Replica-set integration coverage: ordinary atomic cash/UPI/card settlement, payment audit/drawer rollback, idempotent retries, same-key recovery, strict-quote regressions, changed per-line/total amounts, current-stock concurrent sales, current units, saved-document/read equality, discounts, zero-value bills, collection permissions and recorded-customer credit.
- Frontend coverage: local-priced one-request Save, price-conflict review, slow Save layout, digital receipt evidence, recovery, original-key journal, inline saved-document printing and print-only retries.
- Results: 58 backend integration cases passed across checkout, counter and collections coverage, including the two added discount/credit edge cases. All 108 frontend cases passed across counter, document recovery, command journal, payment, collections and invoice documents; the initial-entry case was rerun after giving its asynchronous hydration a 5-second test wait instead of the default 1 second. Frontend changed-file lint, both TypeScript checks and the payment boundary check passed.
- Isolated browser preview at 1440 and 390 px: zero preflight quote requests, one financial Save, zero separate collection requests, zero invoice GETs for Save & print, one print invocation, stable Save footer, no horizontal overflow, nested forms, page errors or automated WCAG A/AA violations in checked views. Responses were synthetic; native print was stubbed, so no physical printing was performed.
- Synthetic commit-response-to-print-invocation samples were 622 ms desktop and 520 ms mobile in the development preview. These include rendering/style preparation and are not actual database timings or a before/after production benchmark.

The full release suites remain CI/release checks. Physical printers and live payment-provider settlement were not exercised.

The standard backend build encountered Windows access denial on existing `dist/workers/*.js` output files. The same esbuild entrypoints/options were then verified successfully in `.cache/pharmacy-save-build/` (API plus four workers), without changing file permissions or stopping user services.
