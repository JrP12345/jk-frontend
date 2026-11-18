# Pharmacy supplier ordering: audit and implementation

Reviewed and implemented on 17 November 2026. The first phase added purchase orders, printable documents, staff-recorded supplier communication and comparison with existing invoices/receiving. The follow-up adds secure supplier response links, private file attachments, queued supplier email and a consolidated supplier workspace. It does not depend on CDCI licence approval.

## Audit and decisions

| Area | Existing functionality reused | Gap addressed in this phase |
| --- | --- | --- |
| Products and suppliers | Branch products, captured pack/base-unit definitions, supplier contact/licence details and permissions | Order selection uses those same records; no second product or supplier master |
| Procurement preparation | Shortbook and purchase-invoice drafts | Shortbook can seed an order; a previous posted supplier invoice or order can seed a new order without copying old prices |
| Purchases | Supplier invoice entry/import, review/posting and duplicate protection | Separate purchase order intent from the actual supplier invoice; link exact posted invoices |
| Inventory | Confirmed partial receiving, batch/expiry/rate/MRP/tax validation and stock movements | Compare ordered, accepted, invoiced and actually received quantities; reuse the receiver for stock changes |
| Accounts | Supplier balances, purchase payments and returns/credit-note workflows | Orders create no payable, payment, tax invoice or stock entry |
| Reliability | Organization/branch permissions, transactions, operation receipts, audit logs and encrypted local command storage | Stable retry keys, revision checks, durable original-request recovery and bounded history |
| Documents | Existing print dialog, print preferences and A4 styles | Printable order, browser Save as PDF and downloadable CSV |

No supplier ordering lifecycle existed alongside these purchase-invoice functions. Existing clinical/patient uploads were not reused as a supplier document archive because their ownership and privacy contracts are different.

## Official workflow research

- [Marg eRetail](https://margcompusoft.com/eretail_retailers_order_app.html) describes retailer ordering from connected suppliers, product search and order/bill tracking. [Its order-entry instructions](https://care.margcompusoft.com/ebusiness-app/eretail-app/73810/utils/messages) follow supplier, product, quantity, cart and confirmation.
- [Marg FAQs](https://margcompusoft.com/faq.html) distinguish ordering and subsequent distributor synchronization/billing/dispatch. [Marg e-business FAQs](https://care.margcompusoft.com/ebusiness-app/e-business/16044/5/FAQ-s-on-Android-ap) also cover retailer and salesman ordering. The requested eOrder category could not be retrieved directly; no undocumented API contract was inferred from it.
- [Pharmarack for pharmacies](https://www.pharmarack.com/pharmacies) and [SaaS solutions](https://www.pharmarack.com/saas_solutions) describe ordering with existing distributors, supplier product/price/scheme visibility and distributor billing/inventory connectivity.

The useful pattern is a separate order followed by a supplier invoice and physical receiving. These sources do not grant Ekavyu access to their private supplier data or establish an approved integration. Their marketing latency statements are not performance guarantees for Ekavyu.

## Staff flow

1. Open **Pharmacy → Purchases → Purchase orders**. Select an existing supplier and branch products, enter packs/loose units, optionally enter an owner-defined reference, and save the draft. Supplier licence details and current product units must be valid.
2. Print the saved order, use the browser's **Save as PDF**, or download CSV. Share the document through the supplier's normal channel. After recording it as sent, **Supplier link and documents** can create a private response link, open a deliberate WhatsApp share, or queue an email to the supplier's current saved email address when SMTP is configured.
3. Record that it was sent, including channel and actual communication reference. Sent orders cannot have their quantities edited silently.
4. Record the supplier's actual accepted quantities, optional quoted base-unit price and availability/scheme notes. Unavailable quantities stay visible. Record dispatch reference and an optional supplier-provided expected delivery date. These are staff records, not a live supplier response feed or guaranteed delivery promise.
5. Enter/import the actual supplier invoice using the existing **Supplier invoices** flow. Review its product, pack, batch, expiry, rates, MRP and taxes, then post it through that flow. Posting the invoice creates its existing financial record, not stock.
6. Link the posted invoice to its order. The branch, supplier, exact product IDs and captured unit definitions must match. Substitutions require separate review; uncertain names are never matched automatically. Invoiced quantities above the ordered/accepted quantities require explicit variance acknowledgement. Billed and free goods both count toward the comparison.
7. Open **Review / receive** from the order to use the existing confirmed receiver. Only the receiver increases batch stock. Partial receipts remain partial; order status is derived from actual posted invoices and their receipt evidence.
8. If all linked goods were received but the supplier will not fill the remaining order quantity, explicitly close the unfilled remainder with a reference. Missing quantities remain visible. This action does not mark them received or cancel an invoice balance.

Use existing purchase-return and account flows for damaged/returned goods and financial corrections. Copying Shortbook entries leaves them open until staff verify actual stock and resolve the shortage.

The order list and supplier workspace report **fulfilment** separately from the persisted **supplier stage** and linked invoice count. Fulfilment comes from actual posted invoice quantities and confirmed receipt evidence in one tenant/branch-scoped aggregation for the visible page. It is not cached in a second mutable order status or read with a separate invoice query for every order. Opening an order still provides the exact product/unit comparison and source invoices.

In **Suppliers & customers**, open **Supplier workspace** to consolidate a supplier's orders/dispatch, invoices, balances/returns, actual payments/credit notes/refunds, and retained order attachments. Records come from existing sources; no second supplier ledger is created. Return and balance pages are independent.

## Supplier links and documents

- Staff issue a link only for an existing sent order, choose a lifetime of 1–168 hours and explicitly confirm its intended supplier. Issuing another replaces the old one; revocation and expiry stop future API access. It grants access to one order, not the supplier's entire account.
- `/supplier-order#<token>` keeps a 256-bit random token in the fragment. The public client sends it in credential-free, noncached POST bodies with no-referrer requests. It is not stored in browser persistent storage or sent in API URLs. The server retains a SHA-256 lookup value and encrypted copy for recovery/email. Normal order reads exclude this access object, storage keys and email internals.
- This is delegated bearer access, not proof of legal supplier identity. Staff must send it to the intended recipient. Audits identify a `supplier_link_holder`, without attributing the response to a staff user.
- Suppliers explicitly accept/reject exact line quantities, optionally enter actual quoted base-unit prices and availability/scheme notes, record dispatch/ETA and upload evidence. Full-quantity filling is deliberate and saving still needs confirmation. They cannot change ordered products, create purchases/payments, receive stock or read another supplier's records.
- Supplier views show invoiced and actually received progress from existing receiving evidence. Once invoices are linked, accepted quantities cannot be rewritten. Cancelled/closed orders cannot accept further supplier changes/uploads.
- Existing private storage holds PDF/PNG/JPEG/WebP files, up to 4 MB each and 25 per order. Supplier invoices, credit notes, statements, dispatch and other evidence are categorized and downloadable from the workspace. Attaching a file never parses, imports, posts or approves it automatically.
- Staff attachments are internal by default; sharing needs an explicit checkbox. Supplier uploads are shared with that order's link holder. Downloads recheck authority and issue a private attachment URL for at most 60 seconds; a previously signed URL can remain usable for that short lifetime after revocation.
- File checks cover filename/MIME/size, signatures and existing active-content patterns. Active/encrypted/embedded-content PDFs are rejected. This is not a comprehensive antivirus certification; staff still review external evidence before posting.
- Stable keys, audit, revision checks and transactions protect link changes, responses, file metadata and queued email. Identical retained files reuse the record without another storage upload. Unretained uploads are cleaned up when their database outcome can be checked; uncertain database outcomes never delete a possibly committed file. Abrupt termination between object upload and metadata commit can leave an unreferenced private object for storage maintenance.

## Data and API changes

- Added one MongoDB model/collection, `PharmacyPurchaseOrder`, for order intent, snapshots, supplier response, dispatch, closure, revision and authorship. It also holds bounded document metadata, supplier access and latest email reference. Indexes cover branch/reference (unique), branch/supplier, branch/order cursor and a unique sparse supplier-token hash. File bytes remain in existing private storage.
- Added an optional `purchaseOrderId` and scoped index to existing `PharmacyPurchase`. The first link is allowed; reassignment/removal is blocked. No historical stock or prices are rewritten.
- Reused `AuditLog`, `OperationReceipt`, the encrypted `OutboundMessage` email outbox and existing R2 helpers; no new supplier, product, payment or stock collection. No data migration/backfill was run.
- Added scoped list/read/create/update/action/history endpoints under `/api/pharmacy/purchase-orders` and command recovery under `/api/pharmacy/purchase-order-commands/:key`.
- Added staff collaboration/link/email/document endpoints beneath each order and paginated `/api/pharmacy/suppliers/:id/archive` for documents/financial events. Public read/respond/upload/download endpoints under `/api/public/pharmacy-supplier-order` require a current expiring capability and have route rate limits. Public input cannot select an organization, supplier, product or financial account.
- Added optional supplier, posted/draft and unlinked filters to existing purchase listing; its default behavior is preserved.
- Existing purchase view/manage permissions protect order read/write routes. Every record lookup and mutation is branch/organization scoped. Quoted supplier terms are not exposed through a public endpoint.
- Commands require a stable idempotency key and run in transactions with majority write concern and required audit evidence. Concurrent edits reject stale revisions. One invoice cannot be claimed by two orders.
- Bounds: 100 distinct products per order, 50 linked invoices per order, 25-record cursor pages. In this phase one invoice belongs to one order; consolidated invoices spanning several orders need separate future design.

## Connectivity and limitations

Saved drafts live on the server. A frozen submitted command is saved through the existing encrypted, authentication/branch-scoped local journal before sending. Lost responses can be checked and retried with the original key and payload. If durable browser storage is unavailable, the screen warns staff to keep the tab open. This is not automatic offline order delivery or general offline form autosave. Existing offline stock ownership is preserved because order commands do not mutate stock.

Supplier-side failed submissions retain their original payload/key in memory for same-request retry; keep the tab open. Staff collaboration commands additionally use the existing encrypted local journal. Expired/revoked public access hides the previously displayed order when refreshed. Neither side promises automatic offline supplier delivery. Products and manual invoice entry remain independent of file/email provider availability.

External configuration and explicit limits:

- File upload/download needs existing private R2 credentials and bucket (`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, optional `R2_BUCKET_NAME`). Existing credentials and bucket access passed the read-only connection check below; no bucket was provisioned or file uploaded during that check.
- Email needs existing SMTP/sender configuration, a correct public `APP_URL` and the existing outbound worker. It is durably **queued**, not described as delivered/read. SMTP acceptance cannot guarantee human receipt; worker retries can redeliver the same link. No real supplier was emailed during verification.
- WhatsApp opens a deliberate compose/share flow. There is no autonomous supplier WhatsApp/SMS integration or delivery webhook; that needs an approved account/consent/template integration. No supplier account is needed for the order link.
- No live Marg, Pharmarack or distributor feed is connected. Stock, price and schemes are actual manually recorded terms, not a live marketplace.
- Supplier uploads are order evidence, not OCR/automatic purchase entry. Consolidated invoices spanning multiple orders remain outside this contract.
- CDCI publication remains pending genuine licence approval; CDCI supplies identity data, not supplier stock or commercial terms.

## Verification

Risk level 4 (tenant isolation, financial records and inventory boundaries).

- Backend: 70 distinct focused cases passed across purchase orders (11), existing purchase drafts, posting and returns. Cases cover same-key retry/recovery, changed-payload rejection, stale revisions, supplier/product/branch isolation, permissions, exact units, substitutions, over-supply acknowledgement, concurrent invoice claims, mandatory-audit rollback, confirmed partial receiving, closing the remainder and the offline stock-owner boundary.
- Frontend: 56 distinct focused cases passed across purchase orders (9), purchase workspace, purchase operations and Shortbook. Includes lost-response/remount recovery, frozen-payload retries, supplier response confirmation, invoice filters, existing receiver navigation, reordering, Shortbook copying and safe CSV/HTML print content.
- Backend TypeScript and executable bundle build passed; frontend application TypeScript passed. Changed-file frontend ESLint had no errors and one existing `PharmacyPurchases` effect warning. Both repositories passed `git diff --check`.
- Tenant advisory scan completed with existing warnings elsewhere; scoped integration cases, not that advisory scan, establish the tested tenant boundaries.
- Initial checks used disposable/synthetic development data; no pharmacy development database was migrated or seeded by this work. Follow-up Chrome and read-only provider acceptance is recorded below. Physical printer acceptance and actual-store timing remain unperformed.

Initial follow-up verification for supplier collaboration added 12 backend cases plus the default-security-header regression, and 11 frontend cases. Coverage includes link isolation/revocation, internal/private attachments, validation/deduplication/cleanup, concurrent responses, real partial receiving, encrypted email and audit rollback, supplier history, retries, revoked-link display and independent return pagination. Existing order and purchase UI regressions also passed. Those integration tests mock private storage and SMTP. Backend/frontend type checks and both builds passed, with the frontend route build isolated under `.next` using a nonproduction verification API URL.

## Completion acceptance: 17 November 2026

Fixed actual mobile clipping caused by long medicine names and intrinsic form widths. The supplier page now wraps product identity and bounds form controls at narrow widths. Supplier responses remain usable when file storage is unavailable; uploads are disabled with a clear message. Response labels distinguish supplier-link responses from staff-recorded communication.

Supplier links use the configured public origin when available. Email requires an explicit public HTTPS `APP_URL`; missing, localhost, private-network, credential-bearing and path-bearing addresses are rejected before creating an email. Development links have an explicit local-only warning. The existing worker remains responsible for delivery.

Verification completed:

- 27 backend cases passed: 13 supplier collaboration integration cases and 14 configuration/read-only checker cases. Backend types and executable bundles passed.
- 21 frontend cases passed: 12 collaboration cases and 9 purchase-order cases. Application types and changed-file ESLint passed.
- Installed Chrome 157 exercised the real components at 360, 390, 768 and 1440 px with synthetic API responses. Long medicine names caused no horizontal overflow. Confirmation, same-key/same-payload retry after an uncertain response, file upload/download, revoked-link clearing, staff sharing, supplier-workspace tabs and a 48-row multi-page A4 purchase order passed. Native print invocation was simulated; the PDF was generated by Chrome. This is component/browser acceptance, not a deployed full-stack or physical-printer test.
- Real R2 bucket HEAD and SMTP TLS/authentication verification both passed. Neither check sent email, uploaded/listed objects or accessed the pharmacy database. HEAD does not establish bucket privacy/write permission; SMTP verification does not establish inbox delivery or worker operation.

Run the backend operator check with `npm run check:pharmacy-supplier-providers` (configuration only), or add `-- --live` for the read-only provider probes. A nonzero result means a required setting or connection remains unavailable. The current sole email configuration gap is `APP_URL_PUBLIC_HTTPS_ORIGIN`: this environment has no deployed supplier-facing HTTPS address. Configure the real address after deployment, then verify the outbound worker and deliberate end-to-end email/file delivery.

Repeat browser acceptance with `node scripts/performance/check-pharmacy-supplier-flow.mjs`. It needs `playwright-core` in `.next/supplier-tools` (or `PLAYWRIGHT_TOOLS_DIR`), installed Chrome, sibling backend esbuild and compiled frontend CSS (`SUPPLIER_ACCEPTANCE_CSS_ROOT` overrides the default verification-build path). Artifacts are under `.next/pharmacy-supplier-acceptance/`, including `results.json`, viewport screenshots and `supplier-purchase-order-A4.pdf`.

Outstanding external acceptance: the actual public deployment address, outbound-worker/inbox and real attachment round trip, physical printer/store-device acceptance. CDCI publication still awaits the user's licence approval; live distributor data and autonomous WhatsApp need approved provider access. None of those are represented as connected by this supplier implementation.

## Attached-request reconciliation: 17 November 2026

Rechecked the complete supplier-ordering prompt against the implemented code. Official [Marg app FAQs](https://care.margcompusoft.com/ebusiness-app/e-business/16044/5/FAQ-s-on-Android-ap) distinguish order arrival, billing and dispatch; [Marg's app overview](https://care.margcompusoft.com/ebusiness-app/general-queries/64792/5/how-to-update-marg-app-eorder-eowner-eretail) distinguishes retailer ordering from distributor/salesman order capture. [Pharmarack SaaS](https://www.pharmarack.com/saas_solutions) describes distributor inventory/billing synchronization, network price discovery and delivery tracking. These depend on actual distributor connectivity; a government medicine catalogue does not supply these commercial facts. The requested Marg landing/FAQ/category URLs could not be fetched in this recheck; the official supporting articles above were available.

| Requested capability | Existing implementation or explicit boundary |
| --- | --- |
| Supplier contact and business details | Existing scoped supplier/customer master, licence/GST/contact fields and permissions |
| Search products, quantities and purchase cart | Purchase-order form reuses branch product search, pack/base-unit definitions and quantity controls |
| Draft, edit, submit and reorder | Saved server drafts, revision-checked edits, recorded sent communication; previous orders/invoices and Shortbook seed reusable orders without old prices |
| Supplier prices, schemes and availability | Actual dated supplier responses and notes; unknown terms remain unknown; no live distributor catalogue or comparison is fabricated |
| All order and receiving stages | Supplier stage plus invoice/receipt-derived fulfilment in list, detail and supplier workspace |
| Short/unavailable/substituted items | Ordered/accepted/invoiced/received comparisons, shortages, explicit variance confirmation and close-remainder action; substituted identities/units are blocked for separate staff review |
| Supplier response without an account | Expiring/revocable per-order link, exact accepted quantities, quoted terms, dispatch/ETA and bounded document upload |
| Email/WhatsApp/manual fallback | Queued existing email outbox, deliberate WhatsApp compose handoff and staff-recorded actual communication; public deployment required for remote links |
| Supplier history and financial records | Existing supplier workspace consolidates orders, invoices, statements, returns, credit notes, payments/refunds and retained order documents |
| Invoice review and receiving | Existing purchase import/posting and confirmed partial receiving verify product/pack/batch/expiry/rates/MRP/tax; only receiving changes stock |
| Damaged goods, returns and mismatches | Existing reviewed return/credit flows; no automatic substitution, file posting or guessed stock movement |
| Reliability and isolation | Stable command keys, original-request recovery, encrypted staff journal, revisions, required audit, bounded reads, organization/branch permissions and scoped supplier capabilities |
| Mobile/desktop and printing | Shared responsive UI; real Chrome component acceptance at four widths and multi-page A4 document |

The final discovered gap was receiving visibility in order history. Both history consumers now display current fulfilment while preserving the supplier stage. The backend aggregation reads only scoped linked posted invoices, groups exact product quantities, rejects incomplete receipt evidence and does not expose supplier terms or receipt documents. It adds no collections, indexes, migrations, cached counters or stock writes.

Latest scoped regression run: 25 backend cases (12 purchase-order and 13 collaboration cases) and 25 frontend cases (13 purchase-order and 12 collaboration cases) passed. Integration coverage includes list transitions through billed, partially received and received, accepted short supply, one batched history read, tenant isolation, duplicate receipt replay and unchanged stock boundaries. Backend/frontend types and changed-file ESLint passed. Earlier provider/readiness checks remain valid; they were not repeated because those inputs did not change.
