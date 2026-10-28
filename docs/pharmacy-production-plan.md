# Pharmacy implementation and release scope

Current scope, consolidated 24 October 2026. The project is in development with no production customers or legacy production data. No historical backfill, entitlement grandfathering or old-deployment compatibility programme is required. Current clinical, financial, security and inventory behavior remains authoritative.

## Implementation status

The October 22 checkpoint records local implementations for T01–T25 and T27–T31. T26 remains open for exact-revision CI, configured hosting and actual professional, business, provider, device, restore and capacity acceptance. Earlier instructions to start T21 and the original copyable implementation prompt are superseded. Current verification is in [the cleanup plan](pre-production-cleanup.md); the dated pharmacy release baseline and operator procedures are in [release gates](pharmacy-release-evidence.md).

| Area | Maintained contract |
| --- | --- |
| T01/T08/T09/T23/T28/T31: grants, branch capability, signup and products | [Setup and commercial access](pharmacy-capabilities.md) |
| T02/T03/T10/T11/T24/T29: stock modes, catalogue, receipts, counts, imports and custody | [Inventory](pharmacy-inventory.md) |
| T12/T13: parties, purchase drafts, posting and deliveries | [Purchasing](pharmacy-purchasing.md) |
| T04/T05/T07/T15/T18/T27: dispensing, explicit quantity, restricted supply, counter and print recovery | [Dispensing](pharmacy-dispensing.md) |
| T06/T14/T16/T17/T19/T20/T21/T22/T30: issued documents, collection, returns, dues, drawers and reports | [Documents and finance](pharmacy-finance.md) |
| T25/T26: current schema, diagnostics, staging and actual acceptance | [Release and operating gates](pharmacy-release-evidence.md) |

## Architecture and invariants

Pharmacy capability, physical Location, membership grants and purchased product are separate. Buying capacity does not grant staff access. Standalone sales do not require Doctor, Appointment, Encounter or a clinical Patient; connected dispensing preserves its existing authority and signed prescription source. Existing Medicine/MedicineBatch, Invoice/payment, transaction, operation receipt, outbox and audit systems remain the authorities.

Stock and money commands use actual source revisions, stable keys, bounded inputs and atomic replica-set transactions. Recover an uncertain committed command before creating a replacement. Print or QR display is not evidence of payment. Never fabricate units, consent, prescriber authority, opening stock, tax approval or professional evidence. Keep immutable documents and financial history; current aggregate-only and batch workflows remain supported application paths.

Online finalization is authoritative. Unconfigured restricted categories, cross-issuer/interstate transfer requirements and unsupported electronic reporting stay blocked. Actual price/tax/trial terms require business review; dated example prices are not a published offer.

## External questions and owners

These are material uncertainties with default recommendations. They do not block writing this plan or routine implementation preparation; they gate the relevant launch action.

| Question / owner | Recommended default / required validation | Blocking gate |
| --- | --- | --- |
| Launch state(s), licence forms and professional supervision — product + registered pharmacist/state adviser | Choose first pilot state explicitly; per-location licence/registration evidence, current retention/conditions; verify electronic registers/records accepted | Sales activation |
| Schedule X/narcotic/NDPS and other restricted categories — pharmacist/regulatory counsel | Block new X/narcotic sales by capability until all additional licences, storage, records and professional rules are reviewed. No assumption existing enum means lawful support | Category enablement |
| Exact current prescription repeat/substitution/partial quantity policy — pharmacist/counsel | Explicit signed evidence and allowance; no fuzzy substitution or dosage-derived quantities; external Rx without tenant Doctor | Restricted supply / T27 |
| SKU HSN/tax/MRP and July/Sept 2025 onward amendments — CA/pharmacist | Effective-dated reviewed product data; zero/exempt and composition/unregistered supported deliberately. NPPA June 2026 amendment implications not substantively verified here | Document issue |
| E-invoice/e-way/GST registration/transfer thresholds — CA | Do not assume ₹499 customer size exempts all. Pilot excludes unsupported transaction types until implemented/validated; same org is not same GSTIN | Relevant supply/transfer |
| DPDP phased commencement, existing IT/SPDI duties, minors/breach/retention — privacy counsel | Current official commencement is staged; verify notifications at release. Set category retention/legal holds and secure export; avoid claiming blanket already-effective DPDP processing compliance | Production personal-data terms |
| Doctor inclusion per extra clinic location, standalone second-branch price, staff/storage allowance — product/finance | One included organization doctor as default; price extra standalone branch explicitly before sale; all prices configurable | Selling multi-location/add-on tier |
| ₹499/₹799/₹299 inclusive of GST, annual discounts/proration, refunds/grace — finance/product | Monthly list prices as given; no invented annual discount; quote snapshots and current-period continuity. Validate tax display/terms | Paid commercial activation |
| Real supported scanners, 58/80mm printer/browser combos — pilot pharmacy | USB keyboard scanner and browser print first; actual device verification. No silent promise of native ESC/POS/direct printer integration | Counter readiness |
| Production Mongo topology/backup durability and RPO/RTO — operations | Verify current deployed setup; proposed starting objectives RPO ≤24h/RTO ≤4h only if business accepts and measured tooling meets them; captured provider evidence supports reconciliation after restore | Release |
| Offline operational tolerance — pharmacist/operator | Online authoritative finalize; manual downtime documents and reviewed recovery, no complex synchronization | Operational SOP |
| Competitor offline/idempotency, digital-register legality, external product catalogue licence — research/product/legal | Unverified; do not use as implementation guarantee. No proprietary medicine catalogue import without rights | Any dependent claim/integration |

## Dated research register

All entries below were accessed/retrieved **19 October 2026**. “Indexed text” means the search tool returned substantive official source content but a subsequent full-page open failed; the claim is limited to that returned text. No inaccessible page is asserted to have been read in full. Source publication/compilation dates are distinguished from access date. URLs are official primary sources; vendor product claims are labelled. This is a source register, not an exhaustive statement that every later amendment was reviewed.

### Competitor workflows

| ID | Direct official source | Verification/use |
| --- | --- | --- |
| C01 | [Marg ERP: process of Counter Sale entry](https://care.margcompusoft.com/margerp/sale/44661/utils/crc32) | Manual text retrieved: temporary customer entries, stock effect and later sale-bill conversion; do not copy deferred financial posting |
| C02 | [Marg ERP shortcut keys](https://care.margcompusoft.com/margerp/general-queries/166661/1/SHORTCU) | Official shortcut table retrieved; keyboard counter/search/discount/save actions |
| C03 | [RetailGraph/SwilERP keyboard shortcuts](https://support.swildesk.com/portal/en/kb/articles/keyboard-shortcuts) | Manual opened; transaction/search/print/batch/branch keys |
| C04 | [GOFRUGAL RetailEasy purchase-management conversion guide index](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasy/purchase-management) | Official support index explicitly describes box purchase / loose sale; detailed configuration not independently exercised |
| C05 | [GOFRUGAL RetailEasy purchase return with conversion](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasy/tools/configuration/articles/purchase-return-with-conversion-functionality-31-1-2024) | Dated path 31 Jan 2024; official steps for return conversion configuration retrieved |
| C06 | [GOFRUGAL RetailEasy creating batch/expiry items](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasy/inventory-management/physical-inventory/articles/batch-and-expiry) | Manual retrieved: supplier invoice/inward, batch choice, expired exclusion and save/no-print |
| C07 | [RetailGraph/SwilERP purchase invoice](https://support.swildesk.com/portal/en/kb/articles/purchase-invoice) | Official manual retrieved: vendor reference, batch/expiry/HSN/MRP/rates/discount/tax/payment details |
| C08 | [RetailGraph purchase challan and invoice conversion](https://support.swildesk.com/portal/en/kb/articles/create-purchase-challan-convert-into-invoice) | Official workflow retrieved: inward document and later invoice clearing; no claim about database atomicity |
| C09 | [Marg ERP fresh-goods/sale return](https://care.margcompusoft.com/margerp/sale-return/4244/1/crc32) | Official steps retrieved: sale return/credit note and batch/expiry quantities |
| C10 | [eVitalRx Order Return API](https://docs.evitalrx.in/api-for-patient-app/orders/order-return) | Indexed official API text retrieved; full open later errored. Medicine+batch, quantity/strip-loose, tax and payment modes; not proof of UI or refund guarantees |
| C11 | [RetailGraph inventory-management knowledge base](https://support.swildesk.com/portal/en/kb/retailgraph/retailgraph-swilerp/inventory-management) | Official index describes reorder, nonmoving stock, reconciliation/conversion/valuation articles; use limited to described workflow coverage |
| C12 | [eVitalRx B2B Order Save API](https://docs.evitalrx.in/api-for-b2b/orders/order-save) | Official API text retrieved: quantity in pills, batch/MRP/tax, credit/due date and optional doctor; explicitly B2B, not retail consent/dispensing evidence |
| C13 | [RetailGraph opening stock and reconciliation](https://support.swildesk.com/portal/en/kb/articles/opening-stocks-entry) | Official manual retrieved: opening product/lot/batch/expiry and actual-stock count |
| C14 | [GOFRUGAL ServeEasy cash handover/day end](https://community.gofrugal.com/portal/en/kb/gofrugalserveeasy/general/reports/reports-faq/articles/cash-hand-over-day-end-process) | Official adjacent retail workflow; date/counter/user/opening cash/cash out, not pharmacy-specific feature certification |
| C15 | [GOFRUGAL RetailEasy OnCloud HQ/branch transfer](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasyoncloud/purchase/purchase-order/articles/how-to-transfer-stock-from-headquarter-to-branch-in-retaileasy-on-cloud-13-7-2022) | Official received-quantity/branch transfer workflow retrieved; dated path July 2022 |
| C16 | [GOFRUGAL RetailEasy OnCloud transfer-out edit/report guide](https://community.gofrugal.com/portal/en/kb/gofrugalretaileasyoncloud/sales-management/transfer-out/articles/how-to-edit-stock-transfer-out-in-retaileasyon-cloud) | Official text retrieved: edit permission and transfer/discrepancy reports; no recommendation to edit finalized Ekavyu dispatches |
| C17 | [Marg ERP purchase-import hold/reimport guide](https://care.margcompusoft.com/margerp/transaction-import/133306/1/after-purchase-import-item-getting-hold) | Official manual retrieved: XLS/DBF/CSV import and hold configuration; not proof of complete legacy porting |
| C18 | [eVitalRx pharmacy efficiency and CSV inward](https://www.evitalrx.in/products/run-your-pharmacy-efficiently/) | Official **product claims**, not manual/tested guarantee: CSV inward and scan workflow. Does not validate “always accurate” marketing wording |

### Indian regulation and guidance

| ID | Direct official source | Verified scope / limitation |
| --- | --- | --- |
| R01 | [CDSCO Drugs Rules compilation, amended through 1 July 2024](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/drug_rules/Drugs%20Rules%201945_2024%2009.pdf) | PDF opened, 963 pages; relevant Rule 65 pages 43–49 and Rule 96 p.113 inspected via text. Compilation is not a guarantee all later amendments included |
| R02 | [Delhi Drugs Control: procedures for obtaining licences](https://drugs.delhi.gov.in/drugs/procedures-obtaining-licences) | Official retail forms/professional/premises guidance retrieved; Delhi-specific example, not nationwide licence approval |
| R03 | [Delhi updated retail licence checklist, July 2025](https://drugs.delhi.gov.in/sites/default/files/2025-07/updated_checklist_for_grant_of_retail_licence.pdf) | Official checklist retrieved; Forms 20/21/20F and pharmacist evidence |
| R04 | [CDSCO official older Rules compilation, H1 Rule 65 text](https://www.cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/Ethics-Committee/Guideline-Document/Drugs_CosmeticsAct1940_Rules1945.pdf) | Indexed H1 separate-register/three-year text retrieved; cross-checked in R01 p.44. Historical compilation, not a current schedule list |
| R05 | [CBIC consolidated CGST Rules, 15 October 2020: Rule 46](https://cbic-gst.gov.in/pdf/15102020_CGST-Rules-2017-Part-A-Rules.pdf) | PDF opened; tax-invoice particulars/≤16 characters inspected. Historical consolidated text, current applicability/amendments require CA review |
| R06 | [CBIC Tax Information Portal: Section 34 credit/debit notes](https://taxinformation.cbic.gov.in/content-page/explore-act/1000304/1000001) | Indexed current official amended text returned 30 November/annual-return limit; later direct open failed. Reverify at implementation/release |
| R07 | [CBIC sectoral FAQs: invoice series/discounts/transfer challan](https://cbic-gst.gov.in/hindi/sectoral-faq.html?initialSessionID=257-2271604-6843051&ld=SDINSOADirect) | Official FAQ text retrieved; informational/historical examples, governing amended law prevails |
| R08 | [CBIC-hosted Notification 9/2025 Integrated Tax (Rate), 17 Sept 2025](https://courier.cbic.gov.in/advisory/2025/NOTIFICATION%20NO.%209_2025-INTEGRATED%20TAX%20%28RATE%29%20-1759486719.pdf) | Official-hosted indexed rate document; not an audited full medicine HSN/rate matrix or substitute for relevant central/state notifications |
| R09 | [CBIC CGST Act compilation, 30 Sept 2020: Section 36](https://cbic-gst.gov.in/pdf/CGST-Act-Updated-30092020.pdf) | Official text retrieved: 72-month retention and proceedings hold. Verify current amended obligations with CA |
| R10 | [CBIC/NACIN accounts and records guidance](https://cbic-gst.gov.in/hindi/pdf/e-version-gst-fliers/eflier-accts-records21062017.pdf) | Official guidance retrieved: records, electronic backup/readable production; publication 2017, not current tax rate authority |
| R11 | [NPPA DPCO 2013 orders/amendment index](https://nppa.gov.in/en/drugspricescontrolorder2013) | Indexed official list includes 13th amendment dated 30 June 2026. Detailed amendment/active SKU ceilings not fully verified; pharmacist review required |
| R12 | [MeitY G.S.R.843(E), DPDP Act commencement, 13 Nov 2025](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf), [official Rules/timeline/corrigendum index](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digit) | Commencement PDF opened; phased 1-year/18-month provisions verified. Index lists Rules dated 14 Nov 2025 and Dec corrigendum; do not use Jan 2025 draft as final law |
| R13 | [ABDM Health Data Management Policy](https://abdm.gov.in/static/media/health_management_policy_bac9429a79.80f74bc3e039c00acd4f.pdf) | Official policy retrieved: consent/privacy-governed interoperability; 2020 document, current ABDM integration specification validation required before participation |
| R14 | [CDSCO Gazette Notifications current index](https://cdsco.gov.in/opencms/opencms/en/Notifications/Gazette-Notifications/), [G.S.R.791(E) Sept 2026 CCTV draft](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadGazette_NotificationsFiles/2026.09.08%20G.S.R.%20791%28E%29_Draft%20notification%20for%20amendment%20in%20the%20Drugs%20Rules%201945%20regarding%20mandatory%20installation%20of%20CCTV%20surveillance%20system%20at%20sales%20premises.pdf) | Current index/draft text retrieved; Sept CCTV and advertising items labelled **drafts**, no final enactment asserted |

### Architecture and security

| ID | Direct official source | Decision supported |
| --- | --- | --- |
| M01 | [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/) | Multi-document transaction/durability and replica-set requirements; opened current manual |
| M02 | [Mongoose transactions](https://mongoosejs.com/docs/transactions.html) | Session/transaction handling, AsyncLocalStorage and no parallel operations within transaction; current docs opened, match behavior against installed version |
| M03 | [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) | JSON Schema validation and response serialization/projection; official current docs opened |
| M04 | [MongoDB atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/), [unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/) | Conditional single-document writes and uniqueness complement transactions; both opened |
| S01 | [OWASP ASVS official project/stable 5.0.0](https://owasp.org/projects/asvs?adhoc_referrer=568483403&tab=main) | Stable 5.0.0 and versioned requirement citation guidance retrieved; no invented exact control IDs |
| S02 | [OWASP ASVS 5.0 taxonomy](https://cornucopia.owasp.org/taxonomy/asvs-5.0), [OWASP ASVS cheat-sheet index](https://cheatsheetseries.owasp.org/IndexASVS.html) | Chapter mapping for validation, auth/session, authorization, data protection and logging |
| S03 | [OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x00-header/), [API5 function-level authorization](https://api-security.owasp.org/editions/2023/en/0xa5-broken-function-level-authorization/) | Object/function/property authority, resource use, business-flow and provider risks; official current edition retrieved |

Repository framework sources (read locally on the same date): Next.js installed `01-app/01-getting-started/02-project-structure.md` and `06-fetching-data.md`; frontend/backend `package.json`, both AGENTS files and frontend verification workflow. The maintained contract guides above identify current source boundaries; the deleted implementation timeline is superseded.
