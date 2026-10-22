# Pharmacy location capability and roles (T08)

Implemented locally on 20 October 2026. No deployment, live configuration, role migration, real professional approval or commercial entitlement activation ran.

## Location configuration

Pharmacy uses the existing physical `Location`. A clinic can add pharmacy capability at the same location ID; its facility classification stays `clinic`. `facilityType: "pharmacy"` is also accepted by the existing assisted organization/location creation routes, with no doctor requirement. Newly created pharmacy facilities start with `pharmacyCapability: { enabled: false, revision: 0 }`.

Existing locations without the optional capability retain the current standard clinic module contract (`legacy_included` DTO mode). Reading capability creates no settings, module records, roles or billing. The organization pharmacy module remains the master operational switch. T23 now evaluates commercial access independently: `commercialEntitlement` is `plan_included`, `active` or `unavailable`. An enrolled product's new business requires its current selected pharmacy branch; history/recovery, existing-invoice collections, returns, settlements, drawers, reports and negative stock corrections remain available after commercial expiry under current grants. Explicit operational disable still blocks new stock/collection commands. Changing facility classification does not buy or enable a product. See [checkout and product access](pharmacy-commercial-quotes.md).

The existing Locations action menu exposes **Pharmacy settings** to staff with `PHARMACY_MANAGE_SETTINGS` or the legacy `MANAGE_ORGANIZATION` grant. It does not require general location-edit permission. Branch access still applies.

| Endpoint | Authority and behavior |
| --- | --- |
| `GET /api/pharmacy/locations/:locationId/capabilities` | Current staff and branch authority; returns enabled/module flags, mode, revision and effective action booleans. Available while the organization module is off. No licence or review evidence is returned. |
| `GET /api/pharmacy/locations/:locationId/settings` | Settings grant plus branch authority; additionally returns the saved capability review. |
| `PATCH /api/pharmacy/locations/:locationId/settings` | Settings grant, branch authority and a replica-set transaction; records a review and increments revision with a required audit. |
| `GET /api/pharmacy/role-presets` | Administrative governance grant; returns opt-in templates without writing any Role documents. |

PATCH accepts only `{ enabled: boolean, expectedRevision: number, reviewReference: string }`. A trimmed reference of 3–500 characters is required. Stale revisions return `409`; reload before another save, including after an uncertain response. Enabling requires the existing reviewed India/INR pharmacy issuer profile, operating licence particulars and supported tax/reporting settings from T06. Disabling requires a review reference but does not require an issuer profile. This records the operator's review; it is not a government licence lookup or professional certification. Professional qualifications for restricted supply remain separately enforced by T07.

Capability changes and new stock commands write the same Location in their transactions. A concurrent disable forces retry or rollback before stock, audit, register or invoice writes commit. The location write runs after stock validation and writes to limit lock contention. No transaction callback sends external notifications before commit.

Disabled locations block new catalogue writes, inward receipts, adjustments, dispensing and prescription queues. Authorized stock/history reads and already committed dispense/adjustment recovery remain available, subject to the organization module and current grants. Replaying an existing command does not re-enable activity; a new key is checked against the disabled location. The platform root retains existing module/grant bypass behavior; it cannot post new stock at an explicitly disabled location. Impersonation uses the effective staff identity and branch grants.

## Action grants and compatibility

Permission resolution reads live Role definitions, including explicit empty roles and revocation. Patient, family and guest roles remain denied independently of broad grants. Existing `MANAGE_MEDICINES` grants retain their old stock, costs, queue, dispense and register rights; `VIEW_EHR` retains its old stock/queue/register reads with costs hidden. Neither grants retail collection authority.

| Named grant | Existing route behavior |
| --- | --- |
| `PHARMACY_VIEW_STOCK` | Catalogue, batches and expiry reads; purchase cost is omitted unless separately granted. |
| `PHARMACY_VIEW_COST` | Acquisition cost visibility; does not authorize stock reads or mutations by itself. |
| `PHARMACY_MANAGE_CATALOG` | Zero-stock catalogue creation, metadata edit and soft deletion; supplied acquisition costs additionally require cost permission. Legacy opening-stock creation also requires receiving and cost grants. See [the catalogue contract](pharmacy-catalogue.md). |
| `PHARMACY_RECEIVE_STOCK` | Receive a batch with operator-entered cost; response hides stored purchase cost without the cost grant. Does not permit catalogue edits. |
| `PHARMACY_ADJUST_STOCK` | Existing count/revision adjustment command and movement history. |
| `PHARMACY_VIEW_RX_QUEUE` | Finalized prescription queue; does not require general EHR access or grant supply. |
| `PHARMACY_DISPENSE_RESTRICTED` | Existing connected prescription supply and committed-result recovery. Prescription, classification and qualification checks still apply. |
| `PHARMACY_EXPORT_REGISTER` | Branch-scoped register read/export. |
| `PHARMACY_VIEW_REPORTS` | Movement history, the operator's drawer reads and the report catalogue. Each report/export additionally checks its stock, independent cost or financial-source grants. See [operational reports](pharmacy-operational-reports.md). Receiving and adjustment grants also allow movement history. |
| `PHARMACY_MANAGE_SETTINGS` | Capability configuration only. Does not grant approval of tax, medicine classifications or professional qualifications. |
| `PHARMACY_PURCHASE` | Branch-scoped supplier/customer records and unposted purchase drafts, including their financial inputs. A separate product projection supports purchasers without granting stock, acquisition-cost or EHR reads. See [the draft contract](pharmacy-purchase-drafts.md). |
| `PHARMACY_SELL` | Reviewed ordinary patient-optional invoice issue and sales history; no clinical billing, restricted supply or collection authority. See [the retail invoice contract](pharmacy-retail-invoices.md). |
| `PHARMACY_COLLECT_PAYMENT` | Confirmed manual cash/UPI/card/split collection on pharmacy invoices and authorized sales/receipt history. No generic clinical billing or restricted supply authority. See [the collection contract](pharmacy-collections.md). |
| `PHARMACY_CLOSE_TILL` | Owned physical drawer opening, cash movements, counted closing and history. Organization management/root can also inspect or hand over another cashier's drawer. See [the drawer contract](pharmacy-cash-drawers.md). |

T19 uses independent `PHARMACY_RETURN` and `PHARMACY_APPROVE_REFUND` grants for source-bound return and credit approval. T20 adds `settle`/`viewSettlements` for actual credits and payments plus organization-managed reviewed opening dues. T21 adds `viewTill`/`openTill`/`closeTill`/`moveTillCash`, owned drawer assignment and a till-only workspace. Collection and refund staff may open/read their own drawer; refund approval also permits actual cash movements. Closing requires the separate till grant. `PHARMACY_TRANSFER` remains T29. Pharmacy grants do not unlock generic clinical billing, payment or till endpoints. T14 adds `sell`/`viewSales`; T17 adds `collect`, confirmed receipts and collection-only workspace access. T15 supplies quote/cart checkout and `counterSalesAvailable` follows current `sell` authority. T19 adds `viewReturns`/`processReturn`/`approveReturn` and a correction-only workspace. Purchase posting requires purchasing authority; linked deliveries additionally require receiving authority. New activity requires enabled pharmacy, while authorized history/recovery, source-bound returns and drawer handover remain available after disable. T16 supplies calculations and T13 supplies supplier posting/partial deliveries. See [the posting contract](pharmacy-purchase-posting.md).

Four templates are available in the existing custom-role builder: pharmacy owner, dispensing pharmacist, stock manager and pharmacy cashier. All include `VIEW_LOCATIONS`; none requires EHR or patient-directory access. The cashier has stock, sale, collection and till grants, with no cost, queue, restricted supply or generic billing grant. Administrators explicitly create custom roles and use existing staff/member/location controls to assign them. Existing subscription and staff quotas still apply; the integration fixture provides explicit synthetic capacity. No built-in role seeding or existing custom/empty role is changed by reading or applying a template to a new role.

The pharmacy workspace uses the server action DTO before loading records. It hides unavailable tabs/actions, omits prescription requests for stock-only staff, redacts cost inputs and clears records/forms on access-check failure. New pharmacy-only roles use manual refresh; they are not granted the broader clinical WebSocket. The settings form preserves revision checks and requires reload after an uncertain/conflicting save.

T24 adds an allowlisted `importKinds` capability independent of new-business availability, so authorized saved-source review/recovery/export remains accessible after commercial expiry. New posting still pins current product/capability access. Each kind combines its catalogue/stock/independent-cost or opening-dues/source grants; opening the import does not grant clinical access. See [reviewed import](pharmacy-imports.md).

## Verification scope

Level 4: focused capability, tenant/grant, stock transaction, prescription/recovery, restricted register, role-cache and facility integration tests; pharmacy/settings/role/location/navigation UI tests; both package type checks, changed-file frontend lint and backend bundle build. Exact final results are recorded in the production plan. Full release gates and real browser, printer, professional and production validation remain separate.
