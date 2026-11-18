# Offline pharmacy acceptance follow-up — 16 November 2026

The agreed first offline cash-billing implementation now has an additional large-catalogue, weak-network and forced-browser-termination probe. This extends the [implementation report](pharmacy-offline-final-billing-2026-11-15.md); it does not certify actual store hardware or physical printer output.

## Checks completed here

The standalone Chrome harness uses actual IndexedDB transactions, protected keys, PC-signed version-2 receipts, the shared calculator, the public restart counter and the real synchronization engine. A local exact-evidence HTTP receiver simulates acknowledgements and their loss. **It is not the native financial API:** native invoice/payment/stock posting remains covered by the separate backend integration tests. No configured business database or customer data is touched.

The recorded run used 10,000 synthetic products/lots, 120 queued invoices, six additional UI Saves, 4× Chrome CPU throttling and a link with 400 ms latency, 64 KiB/s download and 32 KiB/s upload. The receiver adds 100 ms processing delay.

| Check | Recorded result |
| --- | --- |
| Initial protected preparation | 13.5 s. This is one-time preparation, outside per-bill Save. |
| 120 local prepare/stage/commit/finish operations | Median 61 ms; p95 116 ms. This excludes UI draft clearing and printing. |
| Six complete UI Saves while the first network acknowledgement was blocked | Median 315 ms; p95/max 477 ms. The cashier completed all six before the blocked acknowledgement was released. |
| Search in the public counter | Median 181 ms; p95 260 ms, including browser automation interaction. |
| Lost usable acknowledgement after receiver commit | Original sequence 7 remained pending. The browser was force-terminated after checking that the process belonged to the exact isolated test profile. |
| Restart and disconnect/reconnect | All 120 outstanding original bills survived. While disconnected, synchronization made no HTTP request. |
| Backlog drain on the throttled link | All 126 original receipts arrived once in sequence, with two exact retransmissions and at most one import in flight. No pending entries remained. Stock stayed at 874 units and the next number stayed 127. The drain took 72.4 s. |
| Detached encrypted backup file | A 19.8 MB export was written to the test filesystem, reopened read-only, and all 126 PC signatures plus the terminal checkpoint verified. Export/file round-trip/verification took 25.2 s under throttling. |

The 20-second timeout and pause/resume unit tests also pass: timeout aborts the transport, retains the exact receipt and observes backoff; pausing an upload acknowledges nothing and resumes the same command. A duplicate review-hold test was removed so counts reflect distinct cases. The focused synchronization file has **13 passing cases**.

These are measurements from one synthetic run. Six UI Saves are a small sample. CPU throttling does not reproduce an old PC's RAM, disk or thermal printer. Browser termination does not reproduce an OS power failure, failed drive or browser-profile deletion. The detached backup stayed on the test filesystem; an actual USB/cloud backup destination was not exercised.

## Repeat the probe

From the frontend checkout:

```powershell
node scripts/performance/check-pharmacy-offline-stress.mjs
npm test -- src/tests/pharmacyOfflineSync.test.ts
```

The harness uses the existing optional Playwright tooling under `.next/landing-tools` and sibling backend esbuild. `PLAYWRIGHT_TOOLS_DIR`, `PHARMACY_BROWSER_BUNDLER_ROOT` and `CHROME_PATH` can select existing local tools. It binds only to loopback, creates a separate synthetic Chrome profile and verifies that profile before terminating its browser process.

Results and synthetic backup evidence are under `.next/pharmacy-offline-stress/`. The receiver validates original signatures, digests, sequence and exact retry evidence; it does not replace authenticated backend import acceptance.

## Store rollout checklist — deferred until equipment exists

The owner confirmed that this is development only and no store equipment is connected. The items below are future rollout checks, not prerequisites for completing development or using Save/PDF in development. The software must handle unavailable peripherals without claiming a physical print or independent backup succeeded.

Use a development test branch/profile with synthetic stock and invoices on the intended billing PC. Record browser/OS, CPU, RAM, disk, catalogue/cart sizes and printer model alongside results.

1. Enroll and prepare the designated browser online. Test scanning, pack/loose quantities, discounts, cash/change, ten or more Saves, Save & print, cancellation of printing and reprinting a saved bill.
2. Disconnect the test PC's network. Repeat billing, close/reopen the test browser and unlock. Reconnect and confirm each original invoice, payment and stock deduction occurs once; a conflicting bill must remain available for review.
3. Check the actual printer's paper width, margins, rupee glyph, long medicine names, batch/expiry, totals and multi-page output. Both the app and public restart shell support A4/80/58 mm. Choose the matching driver paper size in the browser dialog; its return cannot prove that paper was printed.
4. Copy an encrypted export to the store's intended external backup destination. Open that copy through the existing read-only recovery workflow, verify the original receipts and stopped checkpoint, then reconcile before replacing a PC. Keep the offline passphrase separately accessible to authorized staff.
5. Review the actual issuer/licence/classification records and the daily preparation, reconciliation and backup routine. Store-specific operating evidence and release checks remain necessary.

Broader offline payment/dispensing modes and optional P2 features remain deferred. This follow-up adds acceptance evidence, not those new workflows.

## Saved-document print acceptance follow-up

The additional `scripts/performance/check-pharmacy-print-layouts.mjs` probe passes **six real Chrome layout checks** against the actual document renderers and shared print lifecycle:

- Saved app documents at A4, 80 mm and 58 mm, including the dashboard's actual global print reset.
- The public offline restart document at A4, 80 mm and 58 mm.
- Each sample has 48 products, 0/5/12/18% GST, line and invoice discounts, round-off, long issuer/medicine/batch text and captured licence/HSN/expiry details. These are synthetic tax fixtures, not a determination of a medicine's applicable GST rate.
- All product and batch rows remain in the DOM, with no horizontal element overflow at the printable width. PDFs use the requested page width and exercise multiple pages. The header remains visible despite the dashboard print reset.
- Product text containing HTML stays literal. Repeating the public print replaces the same paper; malformed totals are refused. App print frames clean up after the simulated dialog returns, and the input receipt stays unchanged. The probe makes no financial request.

Run it from the frontend checkout:

```powershell
node scripts/performance/check-pharmacy-print-layouts.mjs
```

The same optional Playwright/esbuild tooling and environment overrides as the ledger probes apply. PDFs, first-viewport screenshots and `results.json` are written to `.next/pharmacy-print-acceptance/`. The 48-item app samples span five A4 pages and eleven 297 mm segments at either thermal width. Restart samples span six A4 pages, eleven 80 mm segments and thirteen 58 mm segments. Segment counts describe the browser PDF, not a printer's roll-cut behavior. A4 restart and 58 mm screenshots were visually inspected. Automatic Save & print now uses the branch's remembered paper choice, falling back to A4; preview and restart print settings can change that device-local preference.

This probe simulates the native print function returning and dispatches `afterprint` for cleanup. It cannot distinguish a successful physical print from cancelling a system dialog, prove printer-driver margins or detect paper/feed/cutter faults. Existing ledger and print-recovery tests cover original receipt persistence and prevention of duplicate financial writes; this layout harness does not manufacture new financial receipts.

## Equipment availability checked here

A read-only equipment check on 16 November found Windows 11, an Intel i5-10300H, about 8 GB RAM and a fixed internal disk. Installed printer entries were Microsoft Print to PDF, OneNote and Fax. **No physical pharmacy printer or removable backup disk was exposed.** This is evidence about the current development machine, not confirmation that it is the intended store PC. No document was sent to the printer spooler and no unrelated drive or backup destination was written.

Physical output, the actual store PC/network, an independently stored backup copy and the store's issuer/classification/operating review require the future equipment and authorized operator. They are rollout checks rather than unfinished development work; no synthetic result certifies them.

## Development fallback fixes

- **No printer / unsupported printing / cancelled dialog:** saving does not require a printer. The browser offers its configured destinations, including PDF where supported. The app retains its saved-document preview/retry path; the restart counter names the already-saved bill and offers a print-only retry. It never retries the financial Save because of a print error.
- **Paper consistency:** A4/80/58 mm are available in both renderers. The device-local preference is scoped to the branch and contains no invoice or customer data. Blocked/corrupt preference storage falls back to A4; a manual choice still applies to the current preview or unlocked restart session.
- **History reads after Save:** the committed receipt immediately supplies its reprint entry. History refresh runs separately, with stale responses ignored. A pending/failed refresh cannot keep the next bill disabled or describe a successful commit as a failed Save.
- **Uncertain download destination:** both backup controls report a download request, then explain checking browser downloads, keeping an independent copy and verifying recovery. Browser export/download errors retain the original ledger and ownership; requesting a file is never called a verified external backup.
- **Lock/recovery cleanup:** locking clears the restart print target, paper, invoice-bearing warning and recovery controls. Completing an original recovered Save hides its recovery controls. Public assets were regenerated under cache version 25; authenticated responses remain excluded.
- **Interrupted offline software update:** installation must cache every required public counter resource before activation. A failed module download, private/redirected/missing response or cache write rejects installation, retaining the previous active worker/cache. Optional icons remain best-effort. First installation still requires connectivity; a failed initial preparation must be retried online.

Focused unit/component regressions and the real IndexedDB/browser probe cover the fallback changes. The cold restart probe now injects a native print failure after a real offline commit, retries only printing, and confirms there is still one original pending invoice/payment with the original number and cleared cart. Existing stress evidence above remains a prior measurement; no new latency claim is inferred from these changes.

Verification for this increment: 106 distinct focused frontend cases across scoped runs (counter/print/recovery/preferences/backup/assets/service-worker consumers), package application types, payment-boundary check and changed-file ESLint pass. The real-browser ledger run has 22 passing checks and the print-layout probe has six. Test files are outside the application's TypeScript project; the application type check is not test-file type coverage. Backend code and financial contracts did not change, so its prior integration evidence was not rerun. This was a development increment, not a full release gate.
