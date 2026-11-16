# Assisted pharmacy setup audit — 11 November 2026

Scope: Root organization creation and management, independent pharmacy onboarding, staff presentation, branch readiness and reviewed subscription activation. No client records, live credentials, grants or payments are changed as part of verification.

## Existing implementation

- Shared organization provisioning creates the organization, primary Location, administrator membership, modules and subscription transactionally.
- Independent pharmacy signup already validates published product terms, creates a branch-bound trial with zero doctor seats, and requires staff MFA.
- Branch issuer administration, capability settings, module control, roles, branch assignments, inventory receipts, counter sales and drawers already exist.
- Billing already validates signed product quotes and supports Root-attributed manual or configured-trial activation.

## Confirmed gaps and changes

| Gap | Implemented change |
| --- | --- |
| Every organization overview renders public booking readiness | Select the checklist from the target organization's workspace profile; retain the clinical checklist for clinical workspaces. |
| Pharmacy readiness is scattered | Show scoped branch details, issuer support, module/capability state, commercial access and administrator security, with explicit follow-up links. Never infer stock or staff readiness from organization status. |
| Root staff screens infer pharmacy mode from the Root session | Pass the selected organization's profile through membership, invitation and team presentation. Server permissions remain authoritative. |
| Assisted creation initializes a generic flat subscription | For pharmacy creation, require current published pharmacy trial terms and reuse the canonical branch-bound trial initializer. Require actual branch contact details and staff MFA. Preserve clinical creation. |
| Root manual grant UI omits product quote/trial inputs | Reuse the product quote preview and add a separate attributed confirmation for manual or configured-trial activation. Preserve paid checkout and flat-plan grants. |
| Creation status is mistaken for operational readiness | Explain outstanding branch, stock, staff and drawer steps without claiming automatic readiness or adding clinical requirements. |
| Plan editor cannot configure the product catalogue | Add explicit location-product prices in INR, optional annual rates, tax treatment, base tier and clinic seat configuration. Saving an existing product plan advances its pricing revision. Product cards show location-based pricing instead of an unrelated flat price. Blank additional-pharmacy rates remain unavailable, not free. |
| New branches and invitation dialogs use clinical defaults | Use the target workspace profile for branch defaults, pharmacy role choices and setup labels. Hide clinical booking/poster actions for pharmacy branches and clinical workflow/AI settings for standalone pharmacy workspaces. |
| Existing assisted pharmacies lack an actionable MFA policy check | Show administrator account/enrollment and staff policy separately. Root can explicitly require staff MFA through an audited, enable-only change; the live session resolver applies it to unenrolled staff sessions. Missing identities cannot be marked active. |
| A lost manual grant response permits another submission | Disable the old confirmation after an uncertain result. Require checking the subscription and previewing a fresh quote before another grant. No write is automatically retried. |

Risk: Level 4 for provisioning, tenant scope, authentication policy and billing. Verification must cover both repositories' affected contracts, rollback/stale-term cases, clinic regressions, focused frontend tests, type checks and appropriate build checks. Use synthetic records and isolated databases only.

## Verification

- Focused frontend tests passed across 12 files: organization creation/booking/scope, product quotes, platform and organization billing, staff/locations, pharmacy capability/issuer/workspace, and the new assisted-setup regressions. The last changed subset passed 53 cases in four files. The clinical leave regression now uses the form's future date rather than an expired fixed fixture.
- Backend coverage passed 68 cases across pharmacy onboarding, clinical onboarding, pharmacy product activation, pharmacy capabilities and provisioning authorization. It includes stale/absent terms, rejected custom trial overrides, branch contact requirements, canonical capacity, no payment fabrication, Root-only MFA changes and enforcement on an existing session.
- Frontend and backend TypeScript checks passed. Both production builds passed. The backend build regenerated local bundles after a Windows output-file access restriction; it did not deploy or connect to a database.
- Browser review covered 28 distinct cases at 1440px, 390px, 320px and dark 390px: overview, branch creation, invitations, assisted creation, product pricing, grants and uncertain-grant recovery. The initial 24 screens passed; the final 12 product/grant screens replace eight earlier observations and add four recovery cases. Checked screens had no browser errors, nested forms, horizontal overflow or Axe violations. Initial telemetry writes were blocked; the final harness suppresses them in memory. No application writes reached a real backend.
- Changed-file ESLint: zero errors, nine existing effect/dependency warnings in organization/staff/location code. The final product components and pricing editor have zero warnings. Diff whitespace checks passed in both repositories.

Raw browser evidence is under `.next/pharmacy-setup-browser/` and `.next/pharmacy-setup-browser-final/`. These are isolated synthetic production previews, not live-provider or production-readiness certification. Frontend tests do not type-check test files as a project; backend tests use the isolated MongoDB replica-set fixture.

## Complete the already-created pharmacy

Do not recreate the existing organization. Restart the running frontend/backend if they have not reloaded the new source, then open the organization Overview.

1. In Root **Plans & subscriptions**, create a **Location products — clinics and pharmacies** plan if no compatible catalogue exists. Enter the actual agreed INR prices, limits, tax treatment and trial duration. Publish independent pharmacy signup when offering that trial for new assisted/self-service creation.
2. In the existing pharmacy **Subscription** tab, select the catalogue, **Standalone pharmacy** for its branch and zero doctor seats. Preview the quote. Root can grant reviewed manual access or the configured trial with a reason; paid checkout remains a separate action. Do this only when commercial branch access needs it.
3. In **Locations**, complete the branch address, phone and hours. Open **Pharmacy settings**, review actual issuer/licence details and supported invoice settings, and explicitly enable the branch. Confirm the Pharmacy module under **Configuration**.
4. If Overview reports staff MFA is not required, Root can explicitly enable the policy. The administrator completes their own authenticator enrollment; Root does not enroll it for them.
5. Under **Members**, invite pharmacy staff and assign branch access and action permissions. Verify using the client/staff session, rather than relying on Root bypasses.
6. In the pharmacy workspace, configure product units/classification and actual opening stock with batch, expiry, cost and price. Open the real cash drawer before cash collections. Ordinary counter invoices and received payments are separate operations; the setup checklist does not certify stock, restricted supply or professional approval.

### Product classification review

Inventory product actions and Counter sale now open the same **Review product** dialog for users with `MANAGE_ORGANIZATION` and branch stock visibility. Counter cashiers see an administrator follow-up message instead of an approval control. A blocked exact barcode scan exposes the product for review; cart products also retain a review action for missing tax details.

Save **Sale classification** and **Tax classification** separately, each with an explicit confirmation and supporting reference. The tax review records HSN, document unit code, treatment and rate. The dialog reads the selected product from its branch, uses each review's actual expected revision, validates the acknowledgement and rereads the saved record. A conflict or uncertain response blocks another save until a fresh read. Reviews do not change stock or batch tax snapshots. Restricted classifications remain unavailable in ordinary counter checkout.

Closing counter review reloads server eligibility; it does not automatically add or sell the product. Opening review invalidates a previous quote. Configure any missing units in **Edit medicine → Units & codes**, and retain existing batch classification checks when issuing a quote or invoice.

## Source map

- [Pharmacy overview](../src/components/organization/OrganizationPharmacySetup.tsx), [organization workspace](../src/components/organization/OrganizationManagement.tsx), [assisted creation](../src/components/organization/CreateOrganization.tsx).
- [Product pricing editor](../src/components/billing/ProductPlanFields.tsx), [reviewed product access](../src/components/billing/ProductAccessSetup.tsx).
- [Shared trial provisioning](../../backend/services/PharmacyTrialService.ts), [existing independent signup](../../backend/services/PharmacyOnboardingService.ts), [assisted setup and MFA endpoint](../../backend/controllers/onboarding.ts).
