# Location-product quotes, checkout and access (T09/T23)

T09's quote foundation and T23's checkout/activation are implemented locally. No product prices were seeded, live plans changed, real provider transaction performed or production access activated. Configured prices, tax, refund and commercial terms require business approval before release.

## Catalogue and compatibility

The existing SaaSPlan optionally stores `commercialFamily: "location_products"`, a required explicit compatibility `legacyTier`, and `commercialPricing`. Organization.plan retains its existing starter/professional/enterprise contract for mapped plans. Existing plans without these additions keep their current behavior, including historical custom slugs; no migration rewrites old subscriptions.

Configure new product catalogues through the existing root-only plan API. Existing legacy plans cannot be converted in place, and a product catalogue cannot clear/change its family. Create a separate slug and archive unwanted catalogues. Pricing edits require a higher revision and compare the stored revision on save. No proposed prices, tax treatment, discounts or resource allowances are automatically installed.

Commercial pricing requires integer paise for monthly clinic, standalone pharmacy, pharmacy-at-clinic and extra-doctor lines; optional explicit annual rates; an optional additional-standalone-pharmacy price; inclusive/exclusive tax treatment with a basis-point rate; included organization doctors and doctors included per additional clinic. All capacities and monetary bounds are validated. An absent annual or additional-pharmacy price is unsupported, not an inferred discount or reused first-store price.

`GET /api/billing/plans` continues returning legacy flat-price plans. `GET /api/billing/plans?kind=location_products` returns the separately configured location-product catalogues. This prevents an unused flat-price field on a product catalogue appearing as a free legacy plan.

## Quote API

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

## Stored selection and evaluation

Strict `commercialQuote` snapshots use the existing Subscription, SubscriptionPayment and SaaSInvoice models. Preview writes none of them. Checkout captures its issued selection; verified/free/root activation stores the effective grant. Captured-review invoices preserve their payment snapshot. No parallel money ledger or historical entitlement backfill is introduced.

The entitlement evaluator returns mode, active period, source, capacity and selected clinic/pharmacy location IDs. It validates snapshot reconciliation/fingerprint, branch ownership, dates and source evidence. Paid grants need a matching captured payment, subscription, plan, currency, amount and snapshot. Captured-review/refunded evidence is insufficient. Manual grants need attributed review evidence; trial/free bases are checked separately. Duplicate subscriptions, malformed snapshots or inaccessible branches require review. Refund persistence updates payment/invoice and touches the subscription transactionally so revocation serializes with new pharmacy business.

Stored selections retain captured prices/capacities when the mutable catalogue changes. Product subscriptions set `enforcement: true`; a product catalogue without a valid selection requires review. Current standard clinic plans retain their existing module-included pharmacy contract (`legacy_included` is the retained DTO name); this is current supported clinic behavior, not a grandfathering or migration layer. Product enrollment cannot be cleared by a flat-plan switch. No rates or production inclusion policy were changed automatically.

New catalogue/inward/purchase/sale/dispense/opening-dues commands require an active pharmacy product at their actual branch when product enforcement applies. The check and subscription write occur inside the recorded transaction after replay lookup; expiry/revocation cannot turn a replay into a second supply or leave a denied sale's stock/invoice writes committed. Clinic bookings use the selected clinic branches; pharmacy-only branches need no clinic product or doctor seat. Existing care editing and medical invoice settlement retain their current paths.

After commercial expiry, current staff/source grants still permit records, saved-operation recovery, reprints, collections on existing invoices, returns, actual settlements/refunds, drawers and reports/exports. Negative stock corrections remain available; positive restocking requires product access. The separate organization module, branch access, explicit operational capability disable and professional/tax/source requirements still apply. Expiry does not enable a deliberately disabled branch or disclose data after authority revocation.

The billing screen previews server totals, explicitly starts reviewed checkout/free activation, displays the captured product price rather than an unused flat price and recovers saved orders after reload. Selection/account/organization changes discard private quote/form state; late order/SDK/callback responses from another scope are ignored. Expired or incomplete quotes cannot appear as free offers. A mismatched order total never opens the SDK and remains visible for status recovery. Pharmacy capability responses expose product availability and preserve continuity actions after expiry.

## Zero limits

Zero doctor capacity blocks direct doctor creation, generic staff delegation, invitation acceptance and new/reactivated administrator doctor profiles. Existing active profiles can still edit their metadata. Doctor seat claims serialize through the organization in the same transaction, so two concurrent requests cannot consume the last seat twice. Existing explicit root overrides remain unchanged. Staff/location checks also retain zero rather than replacing it with a default; the UI displays zero without an invalid progress percentage.

## Validation

Focused tests cover the requested prices, duplicate/same-ID locations, explicit annual/second-store prices, odd paise and tax modes, month/year boundaries, stale revisions, immutable snapshot calculations, tenant/branch/consumer denial, legacy tiers, paid/manual/trial evidence, active-footprint limits, zero capacity, invitation rollback and concurrent doctor creation. Exact checks and counts are recorded in the production plan. Full release, business/professional approval and production activation remain separate gates.
