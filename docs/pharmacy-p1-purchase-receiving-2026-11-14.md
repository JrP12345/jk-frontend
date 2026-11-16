# Purchase posting and receiving — 14 November 2026

This increment addresses the navigation and repeated quantity entry left open by the [pharmacy priority audit](pharmacy-priority-audit-2026-11-14.md), following CSV preparation and saved supplier mappings. It reuses the existing purchase draft, posting and receipt commands; no backend contract, financial authority, database setup or schema changes are introduced.

## Problems and changes

| Problem | Change |
| --- | --- |
| Saving a draft closed the editor; posting required finding and reopening it. The old review button could also open the saved version while current edits were unsaved. | **Save & continue** saves current edits first and opens posting from the validated saved response. **Save purchase draft** remains available. Neither action posts automatically. |
| After posting, staff had to leave and reopen the purchase to receive stock. | **Continue to receiving** refreshes the posted purchase and advances within the same dialog. The confirmed posting reference is cleared only after a valid refresh. A failed refresh retains confirmation and retries only the read. |
| Receiving started with one zero-quantity row, requiring quantities from the supplier invoice to be entered again. | Prefill every unfinished source line with its remaining billed and free base units. Partial deliveries remain editable; extra lots allow splitting a product across printed batches. Batch, expiry and actual delivery reference are never invented. |
| Split lots could exceed the remaining source quantity before reaching server validation. | Validate aggregated billed and free quantities separately before dispatch. Reject malformed/incomplete receipt progress rather than assuming no stock was received. The server still checks the latest revision and source quantities. |
| Fully received purchases still offered another receiving form. | Show completion with recorded delivery history; omit the receiving form when nothing remains. |
| Closing the new direct workflow could leave the invoice list stale. | Refresh the purchase list on closing the operations workspace. |

## Preserved boundaries

Posting and receiving remain distinct durable operations: posting establishes the supplier payable, while receipt records actual delivery lots and inventory movements. Current supplier/tax review and permissions remain required. No client acquisition-cost/payable override or direct stock overwrite is introduced.

The transition reads the fresh revision/progress before receiving; a concurrent receipt still causes the existing server revision conflict. Each receipt gets a separate operation identity from posting. Uncertain operations retain the opaque reference and frozen submitted payload. Reloading a pending receipt starts with blank details for deliberate original-detail reentry/recovery, rather than guessing that the original request contained the current remaining quantity. Late responses after auth/branch changes are ignored.

The normal path is now: enter/import invoice → **Save & continue** → review and post → **Continue to receiving** → record actual batch/expiry and adjust any partial quantities → **Record purchase delivery**. Staff can still stop after draft preparation or posting.

## Verification

Risk level 4: purchase/stock workflow and quantity submission. Focused coverage exercises saved revisions, unsaved edits, partial/free quantities, split-lot limits, complete deliveries, posting recovery, frozen receipt retries, pending reloads, failed refreshes, changed references, late responses, read-only permissions and the existing CSV-to-draft path.

- **72 distinct frontend cases passed**: 18 purchase-editor, 21 posting/receiving/recovery, 16 receiving-plan/payload and 17 CSV/mapping cases. The editor and operations suites were rerun after their final changes; unchanged passing cases were not rerun solely to produce another full-suite result.
- Package TypeScript passed. Changed-file ESLint passed with no errors and the purchase parent's existing `set-state-in-effect` warning. Scoped tracked diff checks passed.
- The first run's one failing assertion selected both the dialog's live announcer and the completion status. The selector was corrected; the final operations suite passes without that failure or its early-test-exit warnings.
- No backend files or API contracts changed, so backend tests/builds were not repeated. No selected database, live supplier delivery, browser geometry review or physical scanner/printer was exercised. Real-store acceptance remains open.

## Remaining audit work

Full branch offline catalogue/delta synchronization, scalable indexed medicine search, shortbook/rack/expiry shortcuts, prescription-to-bill handoff and real-store/readiness acceptance remain open. Specialized XLS/OCR formats, direct batch/expiry CSV receipt import and original-file archives remain separate purchasing work. This increment does not claim all P1 or operational acceptance complete.
