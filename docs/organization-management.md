# Organization management

## Domain and ownership

Organizations configure public maps per physical branch under **Locations → Edit → Google Maps embed (optional)**. In Google Maps, use **Share → Embed a map → Copy HTML** and paste that HTML or its embed URL into the field. Only the validated `https://www.google.com/maps/embed?pb=…` URL is saved; pasted HTML is never executed. A normal Maps share/short link is not an embed source. Clearing the field removes the inline map and keeps the existing address/directions fallback. Existing manage-location permissions and organization scoping govern create/update; this does not change the branch's coordinate pin or publication settings. See [Google's sharing instructions](https://support.google.com/maps/answer/7101463?hl=en).

This document describes the frontend and sibling backend implementation reviewed on 2026-10-07.

| Capability | Source of truth / API | Management responsibility |
| --- | --- | --- |
| Organization details, branding, legal country, capacity and status | `Organization`; `/api/organizations`, `PUT /api/organizations/:id`, existing `/api/onboarding/organization/me` | Root across organizations; permitted tenant accounts within their signed organization. Status and capacity overrides require Root. |
| Creation and initial provisioning | `/api/onboarding/organization`; organization, administrator `User`/`OrgMember`, primary `Location`, default `Role`/modules and `Subscription` | Root creation. Initial subscription belongs to the provisioning transaction. |
| Identity | `User`; `/api/admin/users`, `PUT /api/admin/users/:id/status` | Root global directory. Deactivation affects all memberships and revokes sessions. |
| Membership | `OrgMember`, unique `(userId, organizationId)`; `/api/onboarding/organizations/:id/members`, `/api/organizations/:id/members/:userId` | Authorized organization staff management. Removal retains global identity and other memberships; self and last active administrator removal are blocked. |
| Clinical staff | `Doctor`, `Receptionist`, `DoctorAssignment` and existing staff APIs | Shared clinical profile and assignment editors. Doctor/receptionist profiles currently have one unique `userId`, unlike multi-organization membership. |
| Roles and permissions | `Role`, tenant overrides and database permission resolution; existing `/api/roles` and `/api/users/:id/role` | Existing administrative governance authority; Root may choose explicit organization scope. Authentication still uses the global identity role. Organization-only edits cannot silently change that role for identities with multiple memberships. |
| Locations | `Location`; `/api/onboarding/locations` and `/api/locations` | Location permissions within the selected/authorized organization. |
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
| Staff and location editors reachable through separate pages | SHARE: `TeamManagement`, `LocationManagement`; current routes delegate to them |
| Notifications/SMTP, AI and modules in Settings and organization management | SHARE: organization configuration components and `OrganizationModules` |
| Access configuration | SHARE: existing `RBACPermissionMatrix`, now explicitly scoped |
| Global user hierarchy repeated organization management | REMOVE from the directory; KEEP the hierarchy API for its existing Root dashboard consumer |
| Signed organization switching vs impersonation | KEEP both authentication responsibilities; REMOVE duplicate workspace management UI |

Management location selection uses `useOrganizationLocations` local state. It does not replace `useLocationStore` or modify Root's signed session.

Receptionist dashboard follow-up (24 October 2026): organization-specific roles override the global defaults. A receptionist assigned to a location can have appointment access without `VIEW_LOCATIONS`. The dashboard now skips the location-management read in that case and uses the authorized daily summary's `locationCount`, calculated from the existing assigned-location scope. Location-management endpoints retain their permission guards. Read-only diagnosis confirmed this configuration in the reported account; no roles, memberships or database records were changed. Focused integration coverage checks the scoped summary, forbidden management read and foreign-location rejection.

## Creation lifecycle

The bounded, two-step dialog collects required organization name, city, country and plan, then administrator name, email and password. Country provides currency/timezone defaults. Plan trial defaults or a custom 1–365 day trial are supported. Logo, cover, primary location name and timezone are optional through disclosure.

Provisioning already creates the primary location, administrator, default access roles, modules and initial subscription. The new flow returns to that organization's management area. Clinical profiles/assignments, communications, branding and opening hours remain contextual follow-up configuration. Administrator MFA remains an administrator-owned security step; it is not bypassed by Root setup.

## Clinical team and public booking setup

In **Team** (`/dashboard/staff`), an administrator can choose **Set up myself as
a doctor**, save the clinical profile, then review and explicitly save a location
assignment. **My doctor setup** resumes an existing profile. A clinical profile
alone does not publish a doctor. Review consultation hours, fee model and amount,
then use **Review public booking setup** to check publication and online booking.
Zero-price and post-consultation fee models remain valid. One eligible location
is preselected for review; multiple eligible locations require a choice.

An unassigned doctor shows **Location assignment required**. The organization
overview's **Public booking setup** checks public listing, publication and booking
separately; a failed read remains unknown and retryable. Root uses **Login as
administrator** to perform the administrator's setup rather than making the
platform identity a clinic doctor.

**Add Member** offers existing-account invitations and new-account registration.
Profile/practice, assignment and leave dialogs keep drafts across panel changes,
select the panel with validation errors and guard duplicate submissions. Scope
or authority changes discard private forms and ignore obsolete responses. Failed
assignment removal or deactivation retains recovery actions. Insights labels
invoice sums as billed amounts and identifies its loaded-record snapshot limit;
it is not an aggregate financial report.

Relevant regressions are `doctorSetupFlow`, `staffWorkspace` and
`staffSecondaryPanels`. Their component tests and synthetic browser fixtures do
not establish deployed persistence or invitation delivery.

## Branding persistence

The original generic uploader returned a key in the existing private R2 bucket. Organization records stored that key, while image elements treated it as a directly renderable URL. Previews could work locally without demonstrating persisted rendering. Removal also omitted fields instead of explicitly clearing them, and the Settings update path did not consistently preserve the cover.

The fixed flow is:

1. `ImageUpload` holds a `File` or existing saved reference. Local previews are temporary.
2. `saveWithBranding` uploads each new file before the organization write. PNG/JPEG/WebP are limited to 5 MB. The backend checks the signature, decodes the pixels and re-encodes the same raster format using Sharp, removing metadata/appended bytes and applying EXIF orientation. Branding accepts still images up to 25 megapixels; malformed, mismatched, animated or oversized inputs are rejected with specific errors before storage. The processed image must also fit 5 MB. The generic clinical-document scanner is unchanged.
3. The existing R2 service stores bytes under `organization-branding/{ownerId}/{uuid}` in the same bucket. `OrganizationBrandingAsset` records owner, organization, object key, state and expiry.
4. The uploader returns `/api/public/organization-branding/{assetId}`. It is attached during the organization transaction and saved in `logo_url`, `image_url` or `images`.
5. A fresh organization fetch returns the same reference. Images use the existing same-origin `/api` proxy, including public organization DTOs.
6. Public delivery only serves an attached asset still referenced by its owning organization. It does not expose a general private-vault download endpoint.
7. Replacement retires unused tracked assets; explicit `null` clears a logo/cover. Omitted fields preserve existing values. Gallery removal sends the retained array.
8. Failed multi-file uploads/save attempts clean staged assets. A save whose response is lost cannot delete an already attached image. The leased cleanup job retries deletes, expires abandoned uploads after 24 hours, and preserves currently referenced objects.

External public image URLs remain supported. Private object keys require an ownership-registry upload; the organization-and-field key proxy is removed. Development records with superseded references must be reset or replaced through the current uploader.

The 24 October upload correction addresses a false positive: a valid PNG's
provenance chunk can contain an SVG thumbnail. Searching its raw bytes for
`<svg` rejected the entire image even though the actual file was PNG. Decoding
and [re-encoding without metadata](https://sharp.pixelplumbing.com/api-output/)
preserves raster pixels and transparency without publishing embedded metadata.
The user's original PNG was verified locally in memory; regression fixtures use
synthetic pixels and metadata, never the user's logo. Storage integration tests
use mocked R2 and a disposable database, not a live organization write.
Validation: 22 focused cases passed across the organization-management run and
two additional image edge cases; backend TypeScript and the API/four-worker
build passed. Cases cover provenance metadata, PNG transparency, JPEG/WebP XMP,
EXIF orientation, corrupt/mismatched/oversized and animated inputs, appended
content, storage failure, replacement/removal and tenant ownership. This is not
a deployed R2 smoke-test result.

Staff profile photos use the separate verified-avatar upload contract, not the
organization branding registry. The staff workspace sends `contentClass: avatar`
and its selected `organizationId` to `/uploads/base64` before creating/updating
the member. Root's platform session stays unchanged; the server validates the
explicit organization and checks that it exists. Tenant staff remain restricted
to their signed organization, and patient uploads still require patient access.
Avatar verification/download must use the same organization as the saved intent.
Avatar input and processed output remain limited to 2 MB; PNG/JPEG/WebP pixels
are re-encoded to discard embedded metadata. Clinical-document scanning is
unchanged. Upload notices dismiss on success/failure; failed uploads retain the
form, and a late response after changing organizations cannot create a member.

The 24 October staff-photo correction passed 18 focused frontend cases and 14
backend security/upload cases across scoped runs, including Root without a
signed organization, foreign/missing/invalid organizations, verification/download
scope, patient-bound documents, retries and changed-organization responses.
Frontend/backend TypeScript and the backend build are checked separately from
these synthetic integrations; live organization mutations are not used as tests.

## Permission boundaries

The backend remains authoritative. Non-Root requests are limited to their signed organization and reject mismatching query/body scope. Management selection is not an authority signal. Root can select a target organization explicitly without switching identity.

Creation, organization suspension/deletion, global identity status, capacity overrides and login-as remain platform operations. Organization admins use the same components for authorized tenant details, members, location setup, billing, access and communications. Ordinary members require the actual route/action permissions. Shared global identities cannot be silently reassigned or deleted through a tenant profile operation.

Organization deletion retains the existing scoped cascade contract. The unrelated global orphan-location/subscription purge was removed. The existing cascade remains nontransactional; this change does not claim to make deletion an atomic archival system.

## Verification and limits

Risk level: 4, because this change includes authentication scope, tenant writes, membership and persisted uploads.

- Focused backend integration/regression checks passed across nine files; includes branding, creation, tenant isolation, members, roles, clinical invitations, global status, scoped SMTP testing and impersonation. SMTP loading also uses one shared helper, avoiding a MongoDB parent/child projection collision.
- Frontend organization flows, shared dialog controls, navigation and floating-message checks passed; TypeScript and changed-file lint passed (existing warnings remain).
- Frontend production build passed. The current backend API and four worker executables build to five verified bundles; see the [cleanup audit](pre-production-cleanup.md) for final checks and their scope.
- Chrome exercised organization list/details/create at 390, 768 and 1440 pixels, members, global identities, tenant permissions, loading/error/empty states and a 390 × 450 dialog. No horizontal overflow, broken branding images, uncaught exceptions or console errors with the fixture APIs. The short dialog has one scrollable body and a visible footer.
- Backend persistence tests use MongoDB and mocked R2 byte storage. Browser verification uses intercepted fixture APIs, not live account mutations. A deployed R2 upload smoke check remains an environment verification step.

## Platform-owner dashboard

### Signals and definitions

| Question | Existing source | Definition |
| --- | --- | --- |
| Are subscriptions bringing in money? | SubscriptionPayment | Captured collections in major currency units, tax included, grouped by currency and paidAt. Refunded/review payments excluded; undated captures disclosed. |
| Are collections growing? | Same | Month to date versus the same elapsed portion of the previous month, capped at that month's end. |
| Are organizations healthy? | Organization, latest Subscription, SaaSPlan, captured payment proof | Reuse summarizeSubscription for expiry, disabled access, trial/free/manual/paid access. Paid counts require captured evidence and current access. Expiring soon is a subset. |
| Is the product used? | Appointment.createdAt | Bookings created this month and during the selected range. Later cancellations remain included; pending_payment placeholders excluded. Organization usage means at least one created booking. |
| Are visits happening? | Appointment.status and appointmentTime | Completed visits scheduled this month. Consistent completion timestamps are not available. |
| Who uses it? | Booking aggregation; Doctor and User | Distinct patients in this month's bookings; enabled doctor profiles with enabled identities. Not login-based active users. |
| What needs attention? | Subscription summaries, payment reviews, onboarding, doctors, bookings | Upcoming trial/plan ends, expiry/payment issues, missing subscriptions/doctors, incomplete setup, and no bookings for 30 days among organizations at least 30 days old. |
| Which organizations need follow-up? | Booking aggregation | Top/fewest month-to-date bookings, six rows each; organization links use organizationWorkspaceUrl. No dashboard impersonation mutation. |
| What changed? | Organization creation, captured subscription payments, ADMIN/BILLING audit records | Factual events; no clinical events, actor identities, audit details, credentials, patient records or provider payment identifiers in the DTO. |

Reporting boundaries and chart buckets use UTC, disclosed on the page. 7D/30D show daily totals; 90D uses weekly totals in the existing BarChart. Headline KPIs remain month to date when chart range changes.

### Omitted metrics

MRR/ARR, historical recurring price commitments, churn, conversion cohorts and login-based active users are not inferred from current plan prices or broad user counts. Collections are cash receipts, not recognized revenue. Location/patient invoice revenue is excluded from SaaS collections.

### API and performance

One read-only `/api/admin/dashboard?range=7D|30D|90D` endpoint uses existing platform root authorization and additionally rejects impersonated workspaces. The query range is validated. Mongo grouping and narrow projections avoid sending clinical records or a full member hierarchy. Queries run in parallel without per-organization database calls. Organization rows and recent activity are bounded; charts contain at most 90 daily aggregate points.

React Query caches one response per root identity/range for 60 seconds. Metric/currency changes use the same response. Refresh and range transitions retain the prior snapshot and label updates/failures. Errors are not rendered as zero totals. Initial load uses one structural skeleton.

Existing Card/StatCard, Badge, Button, Select, responsive Table, BarChart, Skeleton, EmptyState, Alert, currency formatting, API client and routing helpers are reused. BarChart has an opt-in responsive mode that preserves its requested height and adjusts label density to container width; existing consumers retain their sizing. Table omits empty toolbars when controls are disabled. No new chart dependency, audit architecture or billing mutation is introduced. Existing management pages retain their access/impersonation workflows.

Mobile prioritizes collections, organization health/follow-ups, supporting usage, trend, organization activity and recent events. Tablet uses two KPI columns; wide desktop uses four and a two-to-one chart/health composition. Zero collections use a compact state with a booking-trend action.
