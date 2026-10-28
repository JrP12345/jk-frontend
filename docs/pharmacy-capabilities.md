# Pharmacy setup, access and commercial products

Current implementation contracts, consolidated 24 October 2026. Examples are illustrative. Local implementation and dated checks do not establish live professional, provider or deployment approval. Use [release evidence and operating gates](pharmacy-release-evidence.md) for those prerequisites. New installations need current schema setup, not hypothetical historical migrations.

- [Location capabilities and staff grants](#location-capabilities-and-staff-grants)
- [Branch and issuer administration](#branch-and-issuer-administration)
- [Independent business signup](#independent-business-signup)
- [Product quotes and verified activation](#product-quotes-and-verified-activation)

## Location capabilities and staff grants

Implemented locally on 20 October 2026. No deployment, live configuration, role migration, real professional approval or commercial entitlement activation ran.

### Location configuration

Pharmacy uses the existing physical `Location`. A clinic can add pharmacy capability at the same location ID; its facility classification stays `clinic`. `facilityType: "pharmacy"` is also accepted by the existing assisted organization/location creation routes, with no doctor requirement. Newly created pharmacy facilities start with `pharmacyCapability: { enabled: false, revision: 0 }`.

Existing locations without the optional capability retain the current standard clinic module contract (`legacy_included` DTO mode). Reading capability creates no settings, module records, roles or billing. The organization pharmacy module remains the master operational switch. T23 now evaluates commercial access independently: `commercialEntitlement` is `plan_included`, `active` or `unavailable`. An enrolled product's new business requires its current selected pharmacy branch; history/recovery, existing-invoice collections, returns, settlements, drawers, reports and negative stock corrections remain available after commercial expiry under current grants. Explicit operational disable still blocks new stock/collection commands. Changing facility classification does not buy or enable a product. See [checkout and product access](pharmacy-capabilities.md#product-quotes-and-verified-activation).

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

### Action grants and compatibility

Permission resolution reads live Role definitions, including explicit empty roles and revocation. Patient, family and guest roles remain denied independently of broad grants. Existing `MANAGE_MEDICINES` grants retain their old stock, costs, queue, dispense and register rights; `VIEW_EHR` retains its old stock/queue/register reads with costs hidden. Neither grants retail collection authority.

| Named grant | Existing route behavior |
| --- | --- |
| `PHARMACY_VIEW_STOCK` | Catalogue, batches and expiry reads; purchase cost is omitted unless separately granted. |
| `PHARMACY_VIEW_COST` | Acquisition cost visibility; does not authorize stock reads or mutations by itself. |
| `PHARMACY_MANAGE_CATALOG` | Zero-stock catalogue creation, metadata edit and soft deletion; supplied acquisition costs additionally require cost permission. Legacy opening-stock creation also requires receiving and cost grants. See [the catalogue contract](pharmacy-inventory.md#catalogue-and-units). |
| `PHARMACY_RECEIVE_STOCK` | Receive a batch with operator-entered cost; response hides stored purchase cost without the cost grant. Does not permit catalogue edits. |
| `PHARMACY_ADJUST_STOCK` | Existing count/revision adjustment command and movement history. |
| `PHARMACY_VIEW_RX_QUEUE` | Finalized prescription queue; does not require general EHR access or grant supply. |
| `PHARMACY_DISPENSE_RESTRICTED` | Existing connected prescription supply and committed-result recovery. Prescription, classification and qualification checks still apply. |
| `PHARMACY_EXPORT_REGISTER` | Branch-scoped register read/export. |
| `PHARMACY_VIEW_REPORTS` | Movement history, the operator's drawer reads and the report catalogue. Each report/export additionally checks its stock, independent cost or financial-source grants. See [operational reports](pharmacy-finance.md#bounded-reports-and-exports). Receiving and adjustment grants also allow movement history. |
| `PHARMACY_MANAGE_SETTINGS` | Capability configuration only. Does not grant approval of tax, medicine classifications or professional qualifications. |
| `PHARMACY_PURCHASE` | Branch-scoped supplier/customer records and unposted purchase drafts, including their financial inputs. A separate product projection supports purchasers without granting stock, acquisition-cost or EHR reads. See [the draft contract](pharmacy-purchasing.md#parties-and-purchase-drafts). |
| `PHARMACY_SELL` | Reviewed ordinary patient-optional invoice issue and sales history; no clinical billing, restricted supply or collection authority. See [the retail invoice contract](pharmacy-finance.md#patient-optional-retail-invoices). |
| `PHARMACY_COLLECT_PAYMENT` | Confirmed manual cash/UPI/card/split collection on pharmacy invoices and authorized sales/receipt history. No generic clinical billing or restricted supply authority. See [the collection contract](pharmacy-finance.md#collections-and-uncertain-outcomes). |
| `PHARMACY_CLOSE_TILL` | Owned physical drawer opening, cash movements, counted closing and history. Organization management/root can also inspect or hand over another cashier's drawer. See [the drawer contract](pharmacy-finance.md#physical-cash-drawers). |

T19 uses independent `PHARMACY_RETURN` and `PHARMACY_APPROVE_REFUND` grants for source-bound return and credit approval. T20 adds `settle`/`viewSettlements` for actual credits and payments plus organization-managed reviewed opening dues. T21 adds `viewTill`/`openTill`/`closeTill`/`moveTillCash`, owned drawer assignment and a till-only workspace. Collection and refund staff may open/read their own drawer; refund approval also permits actual cash movements. Closing requires the separate till grant. `PHARMACY_TRANSFER` governs the implemented controlled-transfer workflow. Pharmacy grants do not unlock generic clinical billing, payment or till endpoints. T14 adds `sell`/`viewSales`; T17 adds `collect`, confirmed receipts and collection-only workspace access. T15 supplies quote/cart checkout and `counterSalesAvailable` follows current `sell` authority. T19 adds `viewReturns`/`processReturn`/`approveReturn` and a correction-only workspace. Purchase posting requires purchasing authority; linked deliveries additionally require receiving authority. New activity requires enabled pharmacy, while authorized history/recovery, source-bound returns and drawer handover remain available after disable. T16 supplies calculations and T13 supplies supplier posting/partial deliveries. See [the posting contract](pharmacy-purchasing.md#supplier-invoices-and-deliveries).

Four templates are available in the existing custom-role builder: pharmacy owner, dispensing pharmacist, stock manager and pharmacy cashier. All include `VIEW_LOCATIONS`; none requires EHR or patient-directory access. The cashier has stock, sale, collection and till grants, with no cost, queue, restricted supply or generic billing grant. Administrators explicitly create custom roles and use existing staff/member/location controls to assign them. Existing subscription and staff quotas still apply; the integration fixture provides explicit synthetic capacity. No built-in role seeding or existing custom/empty role is changed by reading or applying a template to a new role.

The pharmacy workspace uses the server action DTO before loading records. It hides unavailable tabs/actions, omits prescription requests for stock-only staff, redacts cost inputs and clears records/forms on access-check failure. New pharmacy-only roles use manual refresh; they are not granted the broader clinical WebSocket. The settings form preserves revision checks and requires reload after an uncertain/conflicting save.

T24 adds an allowlisted `importKinds` capability independent of new-business availability, so authorized saved-source review/recovery/export remains accessible after commercial expiry. New posting still pins current product/capability access. Each kind combines its catalogue/stock/independent-cost or opening-dues/source grants; opening the import does not grant clinical access. See [reviewed import](pharmacy-inventory.md#reviewed-csv-import).

## Branch and issuer administration

Implemented locally; real professional/licence/product approval and deployment remain separate gates. A pharmacy capability belongs to the existing physical Location. Enabling it does not create a second location, assign staff or purchase a product. The current product quote/billing flow continues to show distinct branch lines and include pharmacy at a selected clinic branch under its configured terms.

Use Locations → branch actions → Pharmacy settings. Staff with branch settings permission can review the capability and commercial availability. Organization managers can additionally open **Review issuer and licence details** to read or enter the actual legal issuer, registration, state/GSTIN, operating licence numbers, signatory, tax-price/reporting requirements and review reference for that branch. No fictional legal/licence details are prefilled. Saving requires explicit confirmation, a loaded revision and the existing organization-management grant. It neither enables pharmacy nor claims professional approval.

The existing tax-profile endpoint enforces staff, organization-management, module and live branch access independently. Profile reads use `no-store`; the client also verifies organization/location identity and revision. Save sends only the allowlisted profile fields. Response metadata cannot become request authority. An unregistered profile clears the prior GSTIN, including when a caller omits that field. Unsupported pricing/electronic-reporting declarations are retained and block document issue rather than preserving an older permissive profile.

Issuer/capability forms reset on effective account, permission, organization or branch changes. Old responses cannot overwrite the new branch. An uncertain save or revision conflict requires reload before another save; reload starts an empty scoped form and reads the committed revision. Capability and issuer writes cannot run together in the dialog. Branch settings staff receive no issuer request or owner control.

Existing member-location assignments remain independent of paid capacity. Use the current staff/member assignment controls; buying a branch does not grant anyone access. The shared location store/selector is retained. A sole branch displays without another selector; multiple branches require an explicit valid pharmacy branch. A global all-location context never authorizes a pharmacy write. Branch reports and current-page totals remain explicitly branch-scoped; the pharmacy report API does not silently turn them into organization totals. Authorized owners can choose another granted branch. Inactive branches retain their records and cannot acquire new business through these settings.

## Independent business signup

Implemented locally on 21 October 2026. No catalogue price, published offer, live account, database index or deployment was changed. Synthetic test licences are not professional approval.

### Owner journey

The sign-in page links to `/pharmacy-start`. Signup lists only active, explicitly published `location_products` catalogue plans that have valid INR pricing, staff/location limits and a configured 1–365 day trial. It displays the current monthly total for one pharmacy branch, trial duration and staff limit. It offers no fallback price or invented trial when the catalogue is empty. Paid activation remains the existing reviewed checkout flow.

An owner provides the actual business email, owner/business names, city and branch address. A new identity also needs a strong password. The business email receives a purpose-specific code. Requesting a code creates no User, Patient, organization, branch or membership. After verification, a new User is provisional and cannot sign in to operations until provisioning completes. An existing account retains its credentials, global role and patient records; a fresh verified business challenge authorizes only creation of that account's new business.

Completion creates one organization, owner membership, primary pharmacy branch, system roles/modules and a canonical product trial in the shared provisioning transaction. No Doctor, Appointment, Encounter, clinical Patient, provider payment or paid subscription is fabricated. The trial captures configured terms and entitlements, with zero doctor seats and one pharmacy location. Branch pharmacy capability begins disabled, revision zero. Subsequent completion requests, even with different command keys, return the same organization and original trial period.

The new organization's staff must enroll an authenticator before operational access. Existing account MFA is still challenged and binds the target organization to the signed login challenge. This policy is scoped to the new organization; it does not force unrelated clinic sessions into a changed global policy. Root accounts continue through assisted platform provisioning.

### Authority and recovery

| Route under `/api/pharmacy/onboarding` | Contract |
| --- | --- |
| `GET /options` | Bounded public catalogue summaries and pricing fingerprints, never purchase authority tokens |
| `POST /start` | Strict business intent; returns a request ID and opaque setup proof, records only its hash |
| `POST /resend` | Original proof, pending state and resend cooldown; new business-purpose email code |
| `POST /verify` | Original proof plus six-digit business code; commits failed attempt counts |
| `POST /status` | Original proof; pending, verified or provisioned state and recorded organization ID |
| `POST /complete` | Verified original proof and stable `Idempotency-Key`; atomically provisions or replays |

Setup proof expires after 30 minutes. The persistent unique email/owner claim has no TTL: proof expiry cannot erase a completed trial claim. Email codes bind purpose, request ID and proof hash. Generic patient OTP verification cannot consume a business code. Start/resend and proof endpoints have separate rate limits; resend also has a per-claim cooldown. Current unique indexes are checked before accepting setup; the read-only check never creates indexes. See [current schema setup](pharmacy-release-evidence.md#current-schema-and-index-setup).

The server encrypts pending intent and recorded result, including any new-account password hash. Once email verification has installed that credential on the provisional User, it removes the duplicate hash from the setup intent. An established account's password is never copied into setup intent. It records no plaintext password or proof in audit details/errors. Browser session storage keeps only the opaque request ID, setup proof and completion key; passwords and business form content are not persisted. This reference is sensitive and is cleared after confirmed workspace sign-in. Account/permission changes unmount private form state and ignore late responses.

A lost completion response retains the original key. Check saved setup and use **Create or resume pharmacy workspace**. A recorded business is resumed through secure sign-in; it does not create another trial. An expired proof requires ordinary sign-in for a completed business or a fresh verified request for an incomplete one. A malformed saved reference has an explicit reset. An invalid public proof does not refresh or sign out an unrelated operational session. Email-provider failure is reported as unavailable delivery and grants no verified identity.

Published terms are fingerprinted and pinned again inside the provisioning transaction. Changing prices, revision, limits, trial duration, status or publication invalidates stale intent. Missing transaction support, failed audit writes or invalid terms roll back organization, membership, trial and claim transition together. Required API/worker startup checks still apply.

### Pharmacy workspace

The authenticated organization profile selects the pharmacy home, counter default, navigation order, mobile links and staff role defaults. Unrelated clinical children are not mounted by the dashboard shell, and pharmacy capabilities omit the connected prescription queue/dispense actions. These UI defaults supplement existing server module, membership and clinical source authorization.

An existing patient with an actual staff membership can open their business through the workspace selector, including a single business. A personal patient session remains a patient session until the server authorizes that switch. Refresh and MFA retain the actual staff workspace role without rewriting the account's global patient role.

Before first sale, the owner reviews real branch issuer/licences and tax settings, enables pharmacy, configures actual product units/tax/dispensing classification, receives dated stock, and confirms a server quote. Cash collection additionally requires an actual drawer. Restricted supply still requires the supported clinical source, current professional evidence and restricted workflow; self-service signup grants no exemption. See [branch administration](pharmacy-capabilities.md#branch-and-issuer-administration), [stock receipts](pharmacy-inventory.md#captured-lots-and-opening-receipts) and [counter](pharmacy-dispensing.md#keyboard-counter-and-held-carts).

### Local evidence and remaining launch work

Focused verification passed 29 distinct backend cases across three files and 30 frontend cases across four files, including all 12 current signup cases after the credential-retention correction. Coverage includes new and existing patient identities, pending MFA, real authenticator enrollment, future workspace selection/refresh, existing MFA challenges, duplicate/concurrent completion, wrong-code exhaustion, purpose isolation, proof rotation/expiry, changed catalogue terms, audit rollback, unavailable email and first ordinary sale through owner routes with zero clinical records. Frontend tests cover published/empty catalogue, opaque reference retention, completion loss/retry, existing authenticator, malformed storage, late account responses, workspace routing/mobile links and pharmacy invitations. Shared clinic/root provisioning and navigation regressions are retained.

Real offer publication, email delivery, pharmacist/tax review, browser/device/print checks, provider test-mode evidence, restore/key recovery and measured capacity/cost remain release evidence. Record those against [T26](pharmacy-release-evidence.md); implementation alone does not approve activation.

## Product quotes and verified activation

T09's quote foundation and T23's checkout/activation are implemented locally. No product prices were seeded, live plans changed, real provider transaction performed or production access activated. Configured prices, tax, refund and commercial terms require business approval before release.

### Catalogue and compatibility

The existing SaaSPlan optionally stores `commercialFamily: "location_products"`, a required explicit compatibility `legacyTier`, and `commercialPricing`. Organization.plan retains its existing starter/professional/enterprise contract for mapped plans. Existing plans without these additions keep their current behavior, including historical custom slugs; no migration rewrites old subscriptions.

Configure new product catalogues through the existing root-only plan API. Existing legacy plans cannot be converted in place, and a product catalogue cannot clear/change its family. Create a separate slug and archive unwanted catalogues. Pricing edits require a higher revision and compare the stored revision on save. No proposed prices, tax treatment, discounts or resource allowances are automatically installed.

Commercial pricing requires integer paise for monthly clinic, standalone pharmacy, pharmacy-at-clinic and extra-doctor lines; optional explicit annual rates; an optional additional-standalone-pharmacy price; inclusive/exclusive tax treatment with a basis-point rate; included organization doctors and doctors included per additional clinic. All capacities and monetary bounds are validated. An absent annual or additional-pharmacy price is unsupported, not an inferred discount or reused first-store price.

`GET /api/billing/plans` continues returning legacy flat-price plans. `GET /api/billing/plans?kind=location_products` returns the separately configured location-product catalogues. This prevents an unused flat-price field on a product catalogue appearing as a free legacy plan.

### Quote API

`POST /api/billing/quote?organizationId=...` uses existing SaaS management/tenant checks plus staff-only authority and current branch access. A non-root caller cannot choose another tenant; impersonation uses current effective identity. Responses use `Cache-Control: no-store`.

Body:

```json
{
  "planId": "configured-catalogue-object-id",
  "priceRevision": 1,
  "billingCycle": "monthly",
  "doctorSeats": 2,
  "locations": [
    { "locationId": "existing-location-object-id", "clinic": true, "pharmacy": true }
  ]
}
```

Actual IDs must be ObjectIds. The server requires explicit India/INR organization settings, active owned locations and an active configured catalogue. It normalizes/sorts IDs, rejects duplicate physical locations, and reads current capability revisions itself. Every active physical location must be represented; active doctor profiles must fit the resulting capacity. A quote never deactivates a branch or profile to make a downgrade fit.

One clinic location produces one clinic line; selecting pharmacy there adds one pharmacy add-on at the same ID. A pharmacy-only location produces a standalone line. Doctor inclusion is configured per organization/additional clinic; extra requested seats produce a separate quantity line. Additional standalone pharmacies, including one alongside another pharmacy-enabled clinic, require the separately configured additional-pharmacy price.

The response captures price revision, compatibility tier, derived product family, line identities/quantities/prices, paise subtotal/tax/total, currency/tax treatment, effective period, location/capability revisions and resulting location/doctor/staff capacity. Calendar periods clamp month/year ends. Quotes expire after 15 minutes. The fingerprint identifies these server-computed facts; it is not a payment signature or proof of approval.

With synthetic fixtures configured at zero tax or inclusive prices, the requested monthly examples produce ₹499 standalone, ₹799 clinic, ₹1,098 clinic plus pharmacy, and ₹1,397 with an extra doctor. Those test fixtures do not establish approved production pricing or tax treatment.

`purchaseAvailable: true` includes a server-issued authenticated `quoteToken`. Its purpose, organization, plan and cycle are bound inside the existing encryption envelope; a client-computed fingerprint or plaintext snapshot cannot authorize a checkout. New checkout revalidates expiry, current catalogue revision, capacities, all active locations, capability revisions and active doctor/staff footprint. Current staff management and branch authority are checked independently. Consumer roles cannot access commercial subscription management even with broad role grants.

The existing checkout accepts `planId`, `billingCycle`, stable `checkoutIntentId` and `quoteToken`. One organization retains one payable order. Reusing an intent with another quote is rejected. The immutable quote, exact paise subtotal/tax/total and subscription billing-state fingerprint are captured on SubscriptionPayment. The ordinary configured flat-price fields do not price product orders. Original intents and saved order references recover an existing checkout; creating a new order requires a fresh valid quote. `POST /api/billing/checkout` with an existing `orderId` resumes that organization's original payable order without re-quoting or creating another provider order.

The existing signature/capture verification and webhook/reconciliation paths perform activation in their transaction. Currency, quote fingerprint, cycle, total, subtotal/tax, subscription baseline and current branch/capacity footprint must match. Prices already captured on an order are honored after a catalogue price edit. Changed locations/capabilities, later subscription changes, inconsistent amounts and missing selections enter captured review, retaining the invoice and payment evidence without granting a product. Duplicate captures produce one invoice/grant. No real provider call ran during local verification.

A renewal of the same product selection extends from the existing period end while retaining the current effective start, including cancelled-but-valid periods. Quote dates describe pricing intent; they do not truncate a verified renewed period. Different product/capacity selections during a valid product period are rejected because proration is not configured. Review a new selection after expiry. Flat checkout/free/manual paths cannot clear an established product selection to bypass pharmacy access.

An explicitly configured zero-total product uses the existing free switch with its reviewed token; repeat activation does not extend its still-active free period. The root-only attributed activation endpoint also accepts a reviewed token for `grantKind: "manual"` or `"trial"`, a review reason and the existing target subscription. Product trials use the catalogue's bounded configured trial days. Manual/trial actor, time, reason, selection and capacities remain captured; none of these paths fabricate a paid receipt.

### Stored selection and evaluation

Strict `commercialQuote` snapshots use the existing Subscription, SubscriptionPayment and SaaSInvoice models. Preview writes none of them. Checkout captures its issued selection; verified/free/root activation stores the effective grant. Captured-review invoices preserve their payment snapshot. No parallel money ledger or historical entitlement backfill is introduced.

The entitlement evaluator returns mode, active period, source, capacity and selected clinic/pharmacy location IDs. It validates snapshot reconciliation/fingerprint, branch ownership, dates and source evidence. Paid grants need a matching captured payment, subscription, plan, currency, amount and snapshot. Captured-review/refunded evidence is insufficient. Manual grants need attributed review evidence; trial/free bases are checked separately. Duplicate subscriptions, malformed snapshots or inaccessible branches require review. Refund persistence updates payment/invoice and touches the subscription transactionally so revocation serializes with new pharmacy business.

Stored selections retain captured prices/capacities when the mutable catalogue changes. Product subscriptions set `enforcement: true`; a product catalogue without a valid selection requires review. Current standard clinic plans retain their existing module-included pharmacy contract (`legacy_included` is the retained DTO name); this is current supported clinic behavior, not a grandfathering or migration layer. Product enrollment cannot be cleared by a flat-plan switch. No rates or production inclusion policy were changed automatically.

New catalogue/inward/purchase/sale/dispense/opening-dues commands require an active pharmacy product at their actual branch when product enforcement applies. The check and subscription write occur inside the recorded transaction after replay lookup; expiry/revocation cannot turn a replay into a second supply or leave a denied sale's stock/invoice writes committed. Clinic bookings use the selected clinic branches; pharmacy-only branches need no clinic product or doctor seat. Existing care editing and medical invoice settlement retain their current paths.

After commercial expiry, current staff/source grants still permit records, saved-operation recovery, reprints, collections on existing invoices, returns, actual settlements/refunds, drawers and reports/exports. Negative stock corrections remain available; positive restocking requires product access. The separate organization module, branch access, explicit operational capability disable and professional/tax/source requirements still apply. Expiry does not enable a deliberately disabled branch or disclose data after authority revocation.

The billing screen previews server totals, explicitly starts reviewed checkout/free activation, displays the captured product price rather than an unused flat price and recovers saved orders after reload. Selection/account/organization changes discard private quote/form state; late order/SDK/callback responses from another scope are ignored. Expired or incomplete quotes cannot appear as free offers. A mismatched order total never opens the SDK and remains visible for status recovery. Pharmacy capability responses expose product availability and preserve continuity actions after expiry.

### Zero limits

Zero doctor capacity blocks direct doctor creation, generic staff delegation, invitation acceptance and new/reactivated administrator doctor profiles. Existing active profiles can still edit their metadata. Doctor seat claims serialize through the organization in the same transaction, so two concurrent requests cannot consume the last seat twice. Existing explicit root overrides remain unchanged. Staff/location checks also retain zero rather than replacing it with a default; the UI displays zero without an invalid progress percentage.

### Validation

Focused tests cover the requested prices, duplicate/same-ID locations, explicit annual/second-store prices, odd paise and tax modes, month/year boundaries, stale revisions, immutable snapshot calculations, tenant/branch/consumer denial, legacy tiers, paid/manual/trial evidence, active-footprint limits, zero capacity, invitation rollback and concurrent doctor creation. Exact checks and counts are recorded in the production plan. Full release, business/professional approval and production activation remain separate gates.
