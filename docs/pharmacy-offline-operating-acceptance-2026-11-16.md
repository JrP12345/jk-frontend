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

## Actual-store acceptance still open

Use a development test branch/profile with synthetic stock and invoices on the intended billing PC. Record browser/OS, CPU, RAM, disk, catalogue/cart sizes and printer model alongside results.

1. Enroll and prepare the designated browser online. Test scanning, pack/loose quantities, discounts, cash/change, ten or more Saves, Save & print, cancellation of printing and reprinting a saved bill.
2. Disconnect the test PC's network. Repeat billing, close/reopen the test browser and unlock. Reconnect and confirm each original invoice, payment and stock deduction occurs once; a conflicting bill must remain available for review.
3. Check the actual printer's paper width, margins, rupee glyph, long medicine names, batch/expiry, totals and multi-page output. The public restart shell currently produces A4 output; thermal output must be checked through the app's supported print layouts.
4. Copy an encrypted export to the store's intended external backup destination. Open that copy through the existing read-only recovery workflow, verify the original receipts and stopped checkpoint, then reconcile before replacing a PC. Keep the offline passphrase separately accessible to authorized staff.
5. Review the actual issuer/licence/classification records and the daily preparation, reconciliation and backup routine. Store-specific operating evidence and release checks remain necessary.

Broader offline payment/dispensing modes and optional P2 features remain deferred. This follow-up adds acceptance evidence, not those new workflows.
