# Organization management

## Domain and ownership

This document describes the frontend and sibling backend implementation inspected on 2026-10-02.

| Capability | Source of truth / API | Management responsibility |
| --- | --- | --- |
| Organization details, branding, legal country, capacity and status | `Organization`; `/api/organizations`, `PUT /api/organizations/:id`, existing `/api/onboarding/organization/me` | Root across organizations; permitted tenant accounts within their signed organization. Status and capacity overrides require Root. |
| Creation and initial provisioning | `/api/onboarding/organization`; organization, administrator `User`/`OrgMember`, primary `Clinic`, default `Role`/modules and `Subscription` | Root creation. Initial subscription belongs to the provisioning transaction. |
| Identity | `User`; `/api/admin/users`, `PUT /api/admin/users/:id/status` | Root global directory. Deactivation affects all memberships and revokes sessions. |
| Membership | `OrgMember`, unique `(userId, organizationId)`; `/api/onboarding/organizations/:id/members`, `/api/organizations/:id/members/:userId` | Authorized organization staff management. Removal retains global identity and other memberships; self and last active administrator removal are blocked. |
| Clinical staff | `Doctor`, `Receptionist`, `DoctorAssignment` and existing staff APIs | Shared clinical profile and assignment editors. Doctor/receptionist profiles currently have one unique `userId`, unlike multi-organization membership. |
| Roles and permissions | `Role`, tenant overrides and database permission resolution; existing `/api/roles` and `/api/users/:id/role` | Existing administrative governance authority; Root may choose explicit organization scope. Authentication still uses the global identity role. Organization-only edits cannot silently change that role for identities with multiple memberships. |
| Locations | `Clinic`; `/api/onboarding/clinics` and existing clinic APIs | Existing clinic permissions within the selected/authorized organization. |
| Billing and trial | `Subscription`, `SaaSPlan`, `SubscriptionPayment`; existing billing APIs | Existing billing permissions. Changing plans goes through Billing; initial trial can use a plan default or a custom duration. |
| Communications, AI and modules | Existing organization SMTP/WhatsApp configuration, AI settings and module registry | Existing backend guards retained. Root controls SMTP gateway configuration, AI and optional module enablement; authorized tenant accounts see/manage their allowed communication settings. |
| Login as | Existing impersonation authentication and return-session flow | Root explicitly selects organization/member, confirms and starts an audited identity session. Organization selection in management does not impersonate or switch authentication. |

There is no separate `Workspace` model or `workspaceId` ownership hierarchy in the traced implementation. The previous workspace management experience was an organization selection UI. Organization switching remains necessary for signed authentication context; login-as changes identity and permissions and does not replace it. The duplicate workspace presentation was removed while retaining authentication switching and clinical stores.

There is no separate normal platform-admin identity category in this model. `root` has platform authority; `admin` belongs to a tenant. Impersonation retains the original Root return-session information, while the new management actions use the effective authenticated role and tenant scope.

## Navigation and reuse

`/dashboard/organizations` is the shared management entry. Root receives a compact organization list and opens an explicit organization context through `organizationId` in the URL. Tenant accounts open their own organization. The sections are Overview, Details & branding, Members, Roles & permissions, Locations, Subscription and Configuration, filtered by existing permissions.

`/dashboard/admin/users` remains a platform identity directory. It shows every membership with links to the relevant organization; it does not repeat the organization hierarchy or clinical team CRUD.

| Previous duplication | Decision |
| --- | --- |
| Organization detail forms in organization management and Settings | SHARE: `OrganizationDetails` |
| Staff and clinic editors reachable through separate pages | SHARE: `TeamManagement`, `LocationManagement`; original routes delegate to them |
| Notifications/SMTP, AI and modules in Settings and organization management | SHARE: organization configuration components and `OrganizationModules` |
| Access configuration | SHARE: existing `RBACPermissionMatrix`, now explicitly scoped |
| Global user hierarchy repeated organization management | REMOVE from the directory; KEEP the hierarchy API for its existing Root dashboard consumer |
| Signed organization switching vs impersonation | KEEP both authentication responsibilities; REMOVE duplicate workspace management UI |

Management clinic selection uses `useOrganizationClinics` local state. It does not replace the clinical clinic store or modify Root's signed session.

## Creation lifecycle

The bounded, two-step dialog collects required organization name, city, country and plan, then administrator name, email and password. Country provides currency/timezone defaults. Plan trial defaults or a custom 1–365 day trial are supported. Logo, cover, primary location name and timezone are optional through disclosure.

Provisioning already creates the primary location, administrator, default access roles, modules and initial subscription. The new flow returns to that organization's management area. Clinical profiles/assignments, communications, branding and opening hours remain contextual follow-up configuration. Administrator MFA remains an administrator-owned security step; it is not bypassed by Root setup.

## Branding persistence

The original generic uploader returned a key in the existing private R2 bucket. Organization records stored that key, while image elements treated it as a directly renderable URL. Previews could work locally without demonstrating persisted rendering. Removal also omitted fields instead of explicitly clearing them, and the Settings update path did not consistently preserve the cover.

The fixed flow is:

1. `ImageUpload` holds a `File` or existing saved reference. Local previews are temporary.
2. `saveWithBranding` uploads each new file before the organization write. PNG/JPEG/WebP are limited to 5 MB, with backend magic-byte and existing malicious-content checks.
3. The existing R2 service stores bytes under `organization-branding/{ownerId}/{uuid}` in the same bucket. `OrganizationBrandingAsset` records owner, organization, object key, state and expiry.
4. The uploader returns `/api/public/organization-branding/{assetId}`. It is attached during the organization transaction and saved in `logo_url`, `image_url` or `images`.
5. A fresh organization fetch returns the same reference. Images use the existing same-origin `/api` proxy, including public organization DTOs.
6. Public delivery only serves an attached asset still referenced by its owning organization. It does not expose a general private-vault download endpoint.
7. Replacement retires unused tracked assets; explicit `null` clears a logo/cover. Omitted fields preserve existing values. Gallery removal sends the retained array.
8. Failed multi-file uploads/save attempts clean staged assets. A save whose response is lost cannot delete an already attached image. The leased cleanup job retries deletes, expires abandoned uploads after 24 hours, and preserves currently referenced objects.

Existing legacy keys resolve through a narrowly scoped organization-and-field endpoint. External public URLs remain supported. Historical objects that predate the ownership registry are not automatically deleted: they may be shared with other existing records, and deletion requires a reviewed reference inventory. New tracked replacement/removal cleanup is supported.

## Permission boundaries

The backend remains authoritative. Non-Root requests are limited to their signed organization and reject mismatching query/body scope. Management selection is not an authority signal. Root can select a target organization explicitly without switching identity.

Creation, organization suspension/deletion, global identity status, capacity overrides and login-as remain platform operations. Organization admins use the same components for authorized tenant details, members, clinic setup, billing, access and communications. Ordinary members require the actual route/action permissions. Shared global identities cannot be silently reassigned or deleted through a tenant profile operation.

Organization deletion retains the existing scoped cascade contract. The unrelated global orphan-clinic/subscription purge was removed. The existing cascade remains nontransactional; this change does not claim to make deletion an atomic archival system.

## Verification and limits

Risk level: 4, because this change includes authentication scope, tenant writes, membership and persisted uploads.

- Focused backend integration/regression checks passed across nine files; includes branding, creation, tenant isolation, members, roles, clinical invitations, global status, scoped SMTP testing and impersonation. SMTP loading also uses one shared helper, avoiding a MongoDB parent/child projection collision.
- Frontend organization flows, shared dialog controls, navigation and floating-message checks passed; TypeScript and changed-file lint passed (existing warnings remain).
- Frontend production build passed. API and five worker bundles compiled and were validated in an isolated output directory; normal backend build output was blocked by Windows permissions on existing worker files.
- Chrome exercised organization list/details/create at 390, 768 and 1440 pixels, members, global identities, tenant permissions, loading/error/empty states and a 390 × 450 dialog. No horizontal overflow, broken branding images, uncaught exceptions or console errors with the fixture APIs. The short dialog has one scrollable body and a visible footer.
- Backend persistence tests use MongoDB and mocked R2 byte storage. Browser verification uses intercepted fixture APIs, not live account mutations. A deployed R2 upload smoke check remains an environment verification step.
