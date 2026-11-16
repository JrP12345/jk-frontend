# Counter follow-up: history, save latency and invoice layout

## Filter strip

The existing horizontal strip now fades only the edges that have additional offscreen filters. The native bar is hidden; touch scrolling and keyboard focus continue to reveal the remaining chips and lookup mode. Overflow and viewport resizing update the fades without changing panel height.

## Save request path

Normal checkout previously sent a quote, issued the invoice, fetched the full saved invoice and then recorded the collection. It now sends the quote, issue and collection commands without the intervening full-document GET. The first collection uses a conditional zero-revision write against the just-issued total; the server independently checks the actual revision, balance, drawer and money. A stale or already-paid invoice is rejected rather than collected twice. Failed or recovered operations can still load the full bill for review.

The sale and collection services return the result captured during the transaction only after the recorded command has committed. This avoids rereading/decrypting their own newly committed receipt and reacquiring branch scope. Replayed commands still read their durable saved results. The calculation, stock transaction, ledger writes, audit rollback and same-key recovery rules are unchanged.

The UI identifies checking and saving stages. Browser timing is measured with deliberately delayed synthetic responses, so it is not a production latency benchmark; the removed request is asserted explicitly.

## Recorded customer history

Recorded already selects an existing pharmacy customer and stores that party identity on the bill; it does not create a patient or customer automatically. Customer maintenance and the broader customer dues/refunds workspace already exist separately.

The selected customer now has a Customer history action. It requests the latest 25 saved customer records at the selected branch, with server-side customer filtering and descending cursor pagination. Each row shows the date, original bill amount, received amount, current remaining due and status. Opening balances are identified separately from new sales. Saved documents open read-only for bill/receipt review. No partial page is presented as an all-time account balance.

This reuses the existing sales-view permission. The backend verifies customer membership and tenant/branch scope and adds an index for the customer/date ordering. The client verifies the returned customer and branch and ignores superseded reads. History is not stored in the device draft cache.

## Invoice and receipt paper

The saved-document component now has a structured issuer/invoice header, customer and supply section, fixed-column item table, captured batch/expiry/MRP evidence, aligned tax and payment summary, and signature footer. Amounts use two decimal places. Mixed lot prices are shown per batch instead of presenting a fabricated single rate. Discounts remain included in the recorded item amounts and are not deducted again by the print layout.

A dashboard-wide print reset previously hid semantic headers/footers and padded every table cell. Pharmacy paper now overrides those rules locally, preserving its issuer and signature. The clinical document modal's pharmacy branch uses the same isolated `printElement` lifecycle as the counter, so module styles reach the printed document. Other clinical print branches retain their existing print path.

A4 tables repeat their headings over longer documents. The 80 mm and 58 mm layouts stack the same captured fields and preserve all batch and tax evidence. No current catalogue, clinic branding or unsaved cashier values replace the saved document snapshot.

## Verification

- 45 backend counter/collection integration cases passed, including normal-response read counts, same-key replay, rollback, balance conflicts, scoped customer history, 25-row pagination and cross-tenant/branch denial.
- The focused frontend run covered counter, collections, payment validation, history, saved-document recovery and shared clinical printing. The changed print assertions were corrected for the new batch-row structure; the affected print/history files passed their reruns. An additional opening-balance label case verifies that customer history does not describe brought-forward debt as a new sale.
- Both source TypeScript checks passed. Changed pharmacy files pass ESLint; the shared clinical modal retains its existing state-in-effect warning. The patient payment-boundary check passed.
- Browser checks cover 1366 px desktop and 390 px mobile, dynamic edge fades, one fresh quote/issue/collection with no full-invoice GET, customer history, and the actual shared print iframe retaining its issuer/signature styles.
- Demo PDF exports cover A4, 80 mm, 58 mm and a longer mixed-batch invoice. Headers, signatures and horizontal bounds were checked in print media. Automated accessibility scans of the checked counter/history views reported no violations.

Ignored review artifacts: `.next/pharmacy-enterprise-review/` and `.next/pharmacy-enterprise-mobile-review/`. All browser records and PDF examples are synthetic. Physical printers and live payment providers were not exercised.
