# Product catalogue audit and implementation — 16 November 2026

## Audit and plan, before implementation

Existing: `Medicine` is branch-owned and already separates prices, reviewed dispensing/tax classifications and units from `MedicineBatch` stock. Literal indexed brand/generic/manufacturer/strength search, barcode uniqueness, reviewed catalogue CSV imports, encrypted import manifests, exact source retries, supplier CSV mappings, purchase drafts and later stock receiving already work. Catalogue import creates zero stock. Global clinical identity and a discovery/adoption workflow are missing; purchase CSV matching currently requires an existing branch medicine. Reuse those boundaries instead of adding another inventory or purchase system.

Implementation stages:

1. Add one shared identity collection with source/release/licence evidence, bounded indexed search and operator-controlled, rights-reviewed ingestion. Keep organization data out of it.
2. Add confirmed branch adoption using existing permissions, transactions, units, audit and zero-stock medicines. Never infer prices, dispensing approval, taxes, lots or a clinical substitution.
3. Expose discovery in inventory and purchase CSV matching. Reuse reviewed branch imports and supplier mappings; improve duplicate review without merging uncertain identities.
4. Verify tenant isolation, concurrent/repeated adoption, stock/price preservation, permission denial, unavailable sources and UI flows. Risk level 4; scoped frontend/backend tests and types, not unrelated release gates.

## Official source research

| Source | Verified on 16 November | Integration decision |
| --- | --- | --- |
| [CDCI / NRCeS](https://www.nrces.in/services/national-releases) | Latest release linked there: [31 August 2026](https://www.nrces.in/download/files/pdf/CommonDrugCodesForIndia_ReleaseNotes_20260831.pdf). The owner subsequently supplied the real ZIP and `License.txt`. All seven masters were read: 93,911 branded and 10,305 generic records, with exact joins validating 93,897 brands and flagging 14 missing-reference records. The package identifies CC BY 4.0 and India-scoped use, with additional SNOMED CT affiliate conditions. [NRCeS FAQs](https://www.nrces.in/faqs) confirm that an affiliate licence is still required for included SNOMED content. | The actual seven-master adapter and read-only package review are complete. The owner confirmed no affiliate licence is currently held, so real reference records have not been published. No live government API or update SLA is claimed. |
| [ABDM Drug Registry](https://drugregistry.abdm.gov.in/) / [sandbox](https://drugregistrysbx.abdm.gov.in/dr/v3) | Browser research fetches returned 403; direct read-only fetches reached public React HTML. The supplied `/dr/v3` is the portal base, not proof of an unauthenticated JSON API. The portal links an API specification PDF. | Do not invent endpoints, authentication or commercial reuse rights from a public portal. Production API access, limits, refresh schedule and permission to persist/redistribute data remain unverified. |
| [eVitalRx catalogue documentation](https://docs.evitalrx.in/api-for-product-catalogue/medicines/search-product) | Documented `POST https://api.evitalrx.in/v1/catalog/medicines/search`, API key and search string; name/GTIN/content search; returned medicine IDs, composition, manufacturer and pack text. Staging files are advertised for testing, not a production corpus. [Getting started](https://docs.evitalrx.in/) calls for subscription/API-key access. Direct [pricing-page](https://www.evitalrx.in/api-pricing/) fetch lists tiered quotas and paid plans; browser research fetch returned 403. Patient plans list ₹25,000/₹75,000/₹150,000 annually and paid onboarding; doctor plans differ. This does not establish the standalone catalogue agreement or redistribution rights. | No account/key/contract supplied. Do not spend quota, fetch another pharmacy's inventory or publish a copied commercial corpus. Confirm the specific catalogue contract, taxes, quota, update coverage and persistence rights before activation. |

The owner has now supplied the CDCI package, but confirmed no SNOMED affiliate licence is held. No commercial API credentials/approval have been supplied. The source parser and validation can run without a database connection; actual publication remains gated on the required rights evidence. Missing values, pack conversion, schedules, GST and barcodes remain explicit rather than being guessed from names or public examples.

Research artifacts are development-only under `.next/catalogue-research/`; they contain public documentation, not a licensed production drug dataset. No external provider outage may block existing branch medicines, local creation, billing or stock receiving.

## Implemented

- One `PharmacyGlobalProduct` MongoDB model: brand/name, generic, composition, strength, dosage form, manufacturer, pack text, barcode aliases, provider/source ID, revision and release/licence/file/row hashes. It contains no branch, price, stock, batch, supplier or patient fields. Provider/source identity is unique; active barcode, paginated and substring-gram searches are indexed.
- Existing `Medicine` gains optional `globalProductId`, `globalProductRevision` and source provenance. A partial unique active branch/reference index prevents repeated adoption. An adopted medicine is a branch-owned snapshot; later reference releases do not rewrite it.
- `GET /api/pharmacy/catalogue/global`: current pharmacy staff/view-stock permission and branch access; literal brand/generic/composition/manufacturer/strength search, exact barcode and 25-row query-bound cursor pagination. Queries have execution time bounds. No remote API is called. Searches debounce and cancel obsolete reads; branch-specific results are not stored in a shared browser cache.
- `POST /api/pharmacy/catalogue/global/:id/adopt`: current catalogue and stock-view authority, explicit identity confirmation, actual unit conversion, form and branch selling price. Uses the existing active-branch/offline-owner fence, majority transaction and required audit. It creates zero stock and no lots, movements, supplier entries or approvals. A retry returns the existing link without overwriting prices. Barcode/exact-identity conflicts, withdrawn or stale references require review.
- Inventory **Find in catalogue**, using the existing modal, controls, auth scope and read utilities. Existing **Add medicine** remains the local fallback. An empty shared catalogue explains the situation; it does not show fabricated medicines.
- Purchase-file matching opens the same discovery component for missing products. Confirmed adoption adds only an empty owned product and selects it for the source item; existing purchase preview, explicit price/tax/quantity review, supplier mappings, draft save and later batch receiving remain responsible for the purchase.
- Existing reviewed catalogue CSV imports now flag identical barcode-free medicine/pack rows and existing branch identities. Commit rechecks inside the serialized transaction, covering another operator creating the same identity after preview. There is no fuzzy automatic clinical merge.
- Both existing product/source imports and supplier purchase-line imports accept bounded values-only `.xlsx` as well as UTF-8 CSV. Excel converts to the same server-reviewed CSV contract; no second import database/workflow. One visible worksheet, 200 source rows, 40 columns, 512 KB input, 2 MB total decompressed contents. Text barcodes preserve zeros. Formulas, merged cells, external links, macros, custom numeric/date coercion and oversized archives are rejected for explicit CSV review. `fflate` 0.8.3 is a pinned MIT dependency loaded only when Excel is selected. Older `.xls` needs CSV export.

## Source ingestion and actual connection status

### Start without CDCI approval (19 November 2026)

Counter sale now offers **Add custom product** to users with catalogue authority.
It opens the same existing medicine editor with the search name prefilled, keeps
the current cart, disables counter actions while the editor is open and refreshes
product search after a successful save. Shared catalogue discovery exposes the same
local-create option. Custom products remain branch-owned, and creating a product
does not automatically grant sale/tax approval or manufacture tracked stock.

Inventory → **Find in catalogue** → **Import my product list** opens the existing
branch import when the operator has catalogue-import permission. It is also available
from **Import source CSV**. Select **Empty catalogue products** and download the blank
CSV template. It contains column names only, with no fabricated medicines, prices,
stock or classifications. Fill it using a pharmacy's own export or a supplier list
whose use is permitted. Stable source IDs, real pack conversions and selling prices
per base unit are required. Keep the same source reference when retrying an import.

Preview up to 200 rows, review errors and explicitly confirm product facts before
posting. Existing duplicate detection, branch isolation, idempotent source records,
10-unit posting chunks and zero-stock creation remain in use. The confirmation for
catalogue imports now refers to product facts rather than physical stock. Record
actual stock through the separate receiving/opening-stock flow. Do not infer tax or
dispensing approval from an imported product. If there is no source file, create
reviewed local products individually; no complete branded-medicine corpus is bundled.

The operator can inspect storage from the backend checkout:

```powershell
npm run check:pharmacy-storage
# Adjust only to the actual cluster budget and desired operational reserve:
npm run check:pharmacy-storage -- --limit-mib=512 --reserve-mib=128
```

This bounded metadata-only command reads the configured database's uncompressed
document size plus index size and the two product collection counts/sizes. It neither
scans medicine records nor changes indexes, stock or products. The 512 MiB budget and
128 MiB reserve are planning defaults, not detected Atlas settings or an enforced
quota. Other databases on the cluster also consume its allowance. A successful report
does not prove that a future import will fit. Start with products actually used and
check again after each small import; retain room for invoices, movements and audits.

The development check on 19 November reported 13,454,374 bytes (about 12.8 MiB) across
the configured database's documents and indexes, zero global products and one branch
medicine. This is a dated observation, not a continuing capacity guarantee. No real
source products were loaded: the owner has no pharmacy/supplier file yet, and CDCI
approval is still pending. The normal source-rights gate remains unchanged.

**Working today:** owned/local CSV and values-only Excel imports, shared-reference storage/search/adoption with rights-reviewed operator input, and purchase discovery through that local reference store. Synthetic datasets exist only in disposable test databases.

**Source status:** the real CDCI ZIP adapter is implemented and the supplied package has been fully validated without publication. It uses exact source IDs, retains joined external codes and keeps source suppliers separate from verified manufacturers. No live ABDM/eVitalRx feed, scheduled refresh or commercial API key is configured. No provider corpus was published into the development database. The eVitalRx documented record normalizer remains a tested mapping helper, not a live integration. The generic canonical batch loader remains available; CDCI operators can use the verified ZIP loader directly after rights approval.

An operator can load legally approved, canonical JSON batches using backend `scripts/import-pharmacy-catalogue.ts`. Default is disconnected validation. Apply requires an active root user, explicit commercial storage/shared redistribution review, licence SHA-256, source/release/review references, and prepared database indexes. It appends immutable existing global `AuditLog` entries containing batch counts and source/row hashes; no new import-history collection is introduced. Existing tenant import manifests remain encrypted and tenant scoped. Identical rows retry unchanged, changed rows increment reference revisions, and errors roll back the whole batch.

Canonical batch contract (values are examples, not a real dataset or licence):

```json
{
  "provider": "cdci",
  "release": "ACTUAL_RELEASE_ID",
  "reference": "RETAINED_SOURCE_PACKAGE_AND_MAPPING_REFERENCE",
  "licenceSha256": "SHA256_OF_ACTUAL_REVIEWED_LICENCE_FILE",
  "reviewReference": "ACTUAL_COMMERCIAL_STORAGE_AND_REDISTRIBUTION_APPROVAL",
  "commercialStorageAndRedistributionApproved": false,
  "snomedAffiliateReference": "ACTUAL_AFFILIATE_OR_WRITTEN_NRces_PERMISSION_REFERENCE",
  "indiaDeploymentAndUsersConfirmed": false,
  "products": [{
    "sourceId": "ACTUAL_BRANDED_MEDICINE_ID",
    "name": "ACTUAL_BRAND",
    "genericName": "ACTUAL_GENERIC",
    "composition": "ACTUAL_COMPOSITION",
    "strength": "ACTUAL_STRENGTH",
    "dosageForm": "ACTUAL_FORM",
    "manufacturer": "ACTUAL_MANUFACTURER",
    "packSize": "ACTUAL_SOURCE_PACK_TEXT",
    "barcodes": []
  }]
}
```

Do not set the approval flag from a public URL or a price plan. Retain the actual licence, approved mapping and original files outside the application repository, then record their real hashes/references. Split reviewed source mappings into at most 200 products / 512,000 bytes per batch. No inferred pack conversion, prices, stock or dispensing/tax approval is allowed in these mappings.

Backend operator commands:

```powershell
node scripts/import-pharmacy-catalogue.ts --help
node scripts/import-pharmacy-catalogue.ts 'D:\approved-data\mapped-batch.json'
# After rights review and database setup through the existing db:indexes procedure:
node --env-file=.env scripts/import-pharmacy-catalogue.ts 'D:\approved-data\mapped-batch.json' --apply --actor=ACTUAL_ROOT_OBJECT_ID
```

The schema/index definitions are included in the existing index-setup discovery. No migration/backfill is needed and no development database collections/indexes were changed as a verification shortcut. Existing products keep their IDs, prices, batches and stock. Operational index setup and a rights-approved actual dataset remain prerequisites for enabling a real shared catalogue corpus.

Pricing qualification: the eVitalRx page also advertises limited Freemium tiers; the annual paid figures above are examples of specific bundles, not a catalogue quotation or a licence to cache/redistribute a medicine database. No dependable production coverage count, update SLA or general commercial redistribution grant was verified for ABDM/eVitalRx.

## Verification results

- Backend: 77 distinct focused cases passed across global catalogue (9), reviewed imports, supplier CSV preview/mappings and purchase drafts. Includes tenant/role denial, strict rights/input validation, literal search, exact barcode, query-bound pagination, stale/withdrawn sources, concurrent adoption, retry preservation, audit rollback and existing financial/stock import boundaries. The global reference is transactionally pinned so a simultaneous source update cannot bypass revision confirmation.
- Frontend: 112 distinct focused cases passed across catalogue discovery, bounded Excel parsing, reviewed imports, purchase CSV matching, purchase workflow and existing pharmacy workspace. Includes leading-zero Excel identifiers, formula/external-link/expansion limits, late reads, explicit adoption and discovery-to-purchase matching without a stock/purchase write.
- Frontend `check:types`, backend `check:fast`, changed-file ESLint and both repository `git diff --check` passed. ESLint reports one pre-existing state-in-effect warning in the pharmacy page; no new lint errors. Frontend `src/tests` is excluded from package TypeScript checking; the frontend case counts above are Vitest execution, not a claim of test-file type coverage.
- Both bundle builds passed. Frontend production validation initially rejected the development HTTP API URL; a process-only `https://api.example.invalid` URL was used for the compile check, with no environment-file change or deployment. Backend worker output writes required the existing sandbox exception. No physical pharmacy/printer acceptance, live provider authentication or real licensed dataset mapping was tested.

## Supplied CDCI package implementation follow-up

The backend's `scripts/import-pharmacy-cdci.ts` now validates the original ZIP directly and generates a report containing source/licence/file hashes, exact join results and all rejected IDs. On the supplied package, 93,897 records validate and 14 need explicit missing-reference review; no field values or stock relationships are guessed. Source supplier names and every joined source ID are retained, while physical packs, barcodes, verified manufacturer roles, prices, stock, batches and approvals stay separate.

Ingestion now performs one source lookup and one bulk write per transaction batch of at most 200 medicines. Retrying the same package/release preserves already written identities and revisions. Audit failure rolls back the entire batch. A changed source row increments the shared reference revision without rewriting branch medicines. A revised source/rights reference is retained in the required audit trail. There is no automatic retirement of records absent from a future release; that remains a reviewed source-maintenance action.

The picker shows NRCeS/C-DAC credit, the CC BY 4.0 link and the additional SNOMED condition. It labels source suppliers accurately and explains why physical units still need confirmation. CDCI search/adoption is limited to India organizations, in addition to the operator's deployment/rights review.

The owner confirmed no affiliate licence is held, so publication is intentionally gated on that actual missing prerequisite. Full commands, approval format, observed counts and evidence hashes are in the backend [CDCI operator guide](../../backend/docs/pharmacy-cdci-import.md). No fake/live source connection is claimed.

Follow-up validation passed: 47 focused backend cases (including the exact ZIP mapper and existing import/purchase regressions), 32 frontend cases, both TypeScript checks, changed-file lint, diff checks and the backend bundle build. The earlier larger suite/build figures above describe the initial catalogue implementation. The supplied ZIP review is read-only and real dataset publication remains pending the affiliate/deployment rights review.

## Activation preparation while the application is pending

The owner's MLDS application now shows **Submitted / Applying**; that is not rights approval. The existing CDCI command supports `--draft-review=<new-path>` to prepare a package-bound pending evidence file and `--check --actor=<root-id>` for database-readiness checks without writes. Drafts leave both rights flags false and evidence references empty. The original package was revalidated: 93,897 valid identities, 14 missing-reference exclusions, with no data publication.

The backend [activation handoff](../../backend/docs/pharmacy-cdci-import.md#activation-handoff-after-approval) covers approval review, actual source release identification, existing index setup, preflight, resumable apply, source search, explicit zero-stock branch adoption and purchase-file discovery verification. Pending development artifacts are `backend/build/cdci-activation-report.json` and `backend/build/cdci-activation-pending.json`; the build directory is ignored by Git. Completed licence evidence belongs outside the repository.

Synthetic activation coverage verifies that preflight does not create records/audit/operator changes, missing indexes and inactive roots block apply, a database without transaction support is refused, an interrupted 201-product import resumes without duplicates, rejected rows stay excluded, and owned prices/stock remain unchanged. Actual provider approval and post-import verification remain to be performed once approval is available. No additional live API or unrelated billing/UI work is introduced by this preparation.

Preparation verification: 26 focused backend cases and backend TypeScript passed. Read-only preflight against the actual development database confirmed transaction support, an active root and all 31 expected indexes across five models; no setup was needed and no database changes were made. Only rights approval remains pending in that readiness report. After approval, review the evidence, recheck then-current readiness, import and verify the real source flow. Frontend code was unchanged in this preparation; its earlier focused results remain the applicable UI evidence.

## Verified workflow comparison — catalogue maintenance and sale restrictions

Requested follow-up research used official vendor help/API pages and regulator material on 16 November 2026. These are documented user-facing capabilities, not access to competitor source code, provider contracts or service-level guarantees.

| Verified source | What it documents | What it does not establish |
| --- | --- | --- |
| [Marg ERP purchase import](https://care.margcompusoft.com/margerp/transaction-import/153/1/purchase%20import) | Import supplier Excel/CSV/DBF files, map existing items, create missing items and confirm/save the transaction. | A complete automatic medicine master or error-free clinical matching. |
| [MargBooks item creation, Status field](https://care.margcompusoft.com/marg-books/inventory-master/170482/9/trees) | Users can set an item to Discontinue to prohibit its billing; government-banned stock is an example in its help. | That every discontinuation represents a regulatory ban, or that status is automatically populated from government feeds. The page was too large for full-page retrieval; the official indexed Status section was available. |
| [Marg ERP Item Ban help](https://care.margcompusoft.com/margerp/error-queries/77209/1/Item-Ban) | An Item Ban billing alert can be tied to a selected batch's Hold field. | That every hold is regulatory or that a cashier should clear a genuine restriction. Ekavyu should require an authorized reason/evidence to release restrictions. |
| [eVitalRx product-catalogue search](https://docs.evitalrx.in/api-for-product-catalogue/medicines/search-product) | API-key search by name, GTIN or composition with source medicine IDs and product details. | Bulk storage/redistribution permission, an update SLA, current regulatory eligibility or a live government ban feed. |
| [eVitalRx patient medicine search](https://docs.evitalrx.in/api-for-patient-app/medicines/search-products) | Inventory-first results, separate `discontinued`, patient availability and inventory-availability fields. | That `discontinued` means legally banned, or any server-side sale-enforcement contract. These fields are documented for the patient-search endpoint; they must not be assumed present on the separate catalogue endpoint. |
| [Vyapar item/batch Excel import](https://vyaparapp.in/videos/how-to-import-batches-through-excel) and [expiry guide](https://vyaparapp.in/guides/how-to-add-expiry-dates-of-items-in-vyapar-app) | Reviewed item/batch imports, store-specific batch/MRP data, expiry reports and alerts. | Comprehensive catalogue sourcing or automatic regulatory monitoring. |
| [NRCeS national releases](https://www.nrces.in/services/national-releases) | Reference medicine codes and descriptions combined with implementers' own batches, prices and purchase/sale data; DISB is a service software bundle. | A verified free public hosted API, constant availability, complete market coverage or a real-time ban/recall feed. |
| [CDSCO FDC notifications](https://www.cdsco.gov.in/opencms/opencms/en/Drugs/FDC/) and [government explanation of quality alerts](https://sansad.in/getFile/annex/271/AU2648_0K6CeQ.pdf?source=pqars) | Regulatory prohibition/restriction documents and batch-identified quality alerts. | An automatic reliable product-to-notification mapping. Effective scope, formulation, manufacturer, batch and any later changes need review. |

The selected direction is a synthesis of these verified capabilities, not a claim that one competitor uses this exact architecture or CDCI:

1. Keep Ekavyu's own fast shared catalogue, using approved CDCI releases initially. Keep branch products, batches, prices and stock separate; external search never becomes a prerequisite for ordinary billing.
2. Grow actual store catalogues through existing reviewed purchase imports and explicit product creation. Reuse confirmed supplier mappings; uncertain clinical identity/pack matches remain reviewable.
3. Maintain source revisions and explicitly reviewed additions/corrections/withdrawals. Disappearance from a release does not mean banned, and catalogue refresh must never clear a separately reviewed sale restriction. Current ingestion activates reference rows and is not a regulatory-state updater.
4. Before production reliance, add authorized product sale blocks and selected-batch holds with reason, source reference, effective scope/date and an audit trail, checked at finalization as well as selection. Preserve invoices and physical stock evidence. Existing return/transfer quarantine is reusable inventory behavior, not a complete regulatory-recall workflow.
5. Synchronize verified restrictions with offline data and expose the last successful update. Disconnected PCs cannot learn new events; no real-time offline safety guarantee is possible. Uncertain notice matches must not be silently auto-blocked or auto-cleared.

The items above were the plan at the time of the research; the implemented follow-up is recorded below. No public documentation verified a universal automated ban/recall feed, competitor synchronization cadence, or a licence exemption for Ekavyu. A commercial live catalogue provider remains optional and requires its own contract/credentials and confirmed storage rights.

## Catalogue and sale-control follow-up — 17 November 2026

Implemented using the existing medicines, batches, branch, global catalogue and audit collections:

- **Counter discovery:** authorized catalogue editors can open shared discovery directly from the counter. Adoption selects the exact global identity, reuses an existing link and preserves the branch's price/units. New products still need the existing dispensing/tax review. Tracked branches must receive actual stock; billing-only branches enter printed batch, expiry and MRP in the adoption form without creating stock. Search/add and quantity calculation remain local; catalogue discovery does not issue a bill.
- **Independent sale holds:** Inventory → product actions → **Product / batch sale holds** lets an organization administrator block or release an exact product/batch with reason, source/review reference and explicit confirmation. Revision checks reject stale/concurrent actions. Required audit failure rolls back the hold. Physical quantities and historical financial documents are unchanged. Releasing a product hold cannot clear an independent batch hold.
- **Server enforcement:** fresh counter quotation/finalization, billing-only sales and shared clinical FEFO dispensing check product/lot holds. Public browsing/request availability excludes held supply. Ready/collect checks original billed batches again, so a hold applied after billing prevents parcel handover. Dispatch and saleable transfer receiving reject held supply; quarantined receiving preserves physical custody. Stock reports distinguish physical on-hand from eligible units.
- **Prepared offline counter:** held products/lots are excluded from new snapshots; a hold after snapshot preparation prevents activation. An authenticated, bounded background check runs at most every 30 seconds, independently of Save and even with an empty outbox. A changed-control signal durably stops new issuance and shows the last successful check. Existing signed receipts still synchronize: bills issued before a new hold can import, while a bill issued during that hold is retained for review. Hold release requires reconciling and closing the original offline ownership session. The signed-out restart shell explicitly explains that it cannot receive new restrictions.
- **Reviewed source maintenance:** the existing operator command accepts `--maintenance` for exact reference availability changes (`available`, `withdrawn`, `discontinued`). Withdrawn/discontinued rows disappear from new discovery/adoption; later source imports cannot clear that separate status. Root authority, exact source revision and required audit are enforced. This changes reference availability only; it never declares a legal ban or rewrites existing branch products, prices, batches, quantities or sale holds. Corrections/new products continue through the existing reviewed release importer. Absence from a source release never retires a product automatically.

No new collection, migration/backfill or automatic regulatory feed was introduced for these controls. Existing zero-stock catalogue imports and reviewed purchase discovery remain the import paths. For operator commands and exact request fields, see [catalogue maintenance and sale controls](../../backend/docs/pharmacy-catalogue-maintenance.md).

### Limits and remaining external steps

The actual CDCI package has **not** been published. The MLDS application is still **Submitted / Applying**, so genuine affiliate/deployment-rights review and real-source activation/search verification remain outstanding. No live ABDM/eVitalRx connection or automated medicine-ban mapping is claimed. Current own/local products remain usable without those providers.

A disconnected PC cannot receive a newly applied restriction. Contact its operator immediately, physically isolate affected goods, and reconnect/reconcile before using a refreshed preparation. The current controls use the time an administrator applies a hold; they do not implement a retrospective recall investigation, automated patient tracing or legal-notification assessment. Actual pharmacy/printer/device acceptance remains separate from these synthetic development checks.

### Scoped verification

Risk level 4. Focused disposable-Mongo integration checks cover stock-preserving holds, billing-only enforcement, clinical allocation, permissions/tenant boundaries, concurrent revisions, mandatory-audit rollback, offline receipt preservation, post-preparation activation refusal, pickup handover, transfer quarantine, reporting and reviewed source maintenance. Frontend cases cover discovery/adoption, printed supply fields, held-product display, uncertain-write recovery, offline stop signalling and existing counter/workspace/ledger consumers. Package type checks, changed-file lint, payment-boundary checks, offline public-asset generation and the API/four-worker bundle build are included. One existing pharmacy-page state-in-effect lint warning remains; no new lint errors. No browser E2E or physical-store acceptance is claimed.
