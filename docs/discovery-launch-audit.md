# Public discovery: Phase 1 audit

Initial implementation audit, 2026-10-08, against both repositories. See the [independent readiness review](discovery-readiness-review.md) for subsequent findings, fixes and current release gates. Production profiles, Google accounts and rankings were not verified or modified.

## Existing architecture and workflows

This is Next.js 16 App Router/React with Fastify/MongoDB, not Nuxt. Installed Next.js guides governed the changes.

Organization owns the tenant/subscription. Location owns a physical facility's type, address, timezone, contacts, hours, amenities and operations. Doctor references a global User and primary organization. DoctorAssignment connects that User to an organization/location, with independent fees, schedules and booking modes. Doctors can practice across organizations; selected location determines public organization context. Facility type grants no permissions/modules.

The directory already server-rendered its first page and supported doctor/specialty/city search and pagination. Facility details were server-loaded. Doctor pages already displayed location-specific booking and the clinician's public locations within the selected organization. Persisted public slugs, QR reception posters, WhatsApp contact, native sharing, website button code and owner readiness checks existed.

Booking already enforced schedules, overrides, slot/token availability, subscriptions and patient authority. Confirmation used tracker capabilities. Organization branding already had safe uploads, ownership, public serving, attachment and cleanup. Location logo forms instead used the private document uploader, saving unusable object keys.

Actual gaps: generic provider metadata; missing canonical/social metadata, structured data and sitemap; no independent publishing control; ordinary recovery pages for missing profiles; inconsistent disabled-doctor/inactive-organization checks; individual doctor emails in legacy public organization detail.

## Implemented priorities

| Improvement | Patient/owner value and approach |
| --- | --- |
| Provider metadata/previews | Actual facility/doctor identity, canonical, Open Graph and Twitter metadata using existing public data/images |
| Structured data | MedicalClinic/Hospital/MedicalBusiness for facilities; ProfilePage with Person for clinicians; branch address, valid coordinates and explicit saved hours only |
| Sitemap | Bounded catalog feed and batched persisted slugs discover previously unvisited providers; no patient, appointment, queue or subscription queries in that feed |
| Publishing | Location.isPublished defaults true to preserve existing visibility; scoped location permission; separate publication action works after expiry |
| Google setup | Existing Website booking dialog gains branch/doctor links, practitioner guidance and official instructions |
| Sharing privacy | Clean provider URLs exclude follow-up parameters; clipboard/share failures are handled |
| Location logos | Reuses organization branding ownership/lifecycle; rejects private keys, serves attached branch images and protects referenced assets during cleanup |
| Public DTO | Explicit facility fields exclude operational/payment settings; individual doctor email and raw private image keys removed |

Existing branding, descriptions, contact/map fields, hours, amenities, doctor details, fees and schedules remain the customization tools. No new paid API, dependency, patient attribution record, CMS, domain system or marketing infrastructure was added.

## Visibility and edge cases

| State | Result |
| --- | --- |
| Active published branch and active organization | Facility and active assigned doctor contexts appear publicly and in sitemap |
| Unpublished or archived/deleted branch | Removed from directory/sitemap; public detail/doctor context unavailable; new patient/guest bookings, public slots and QR registration blocked |
| Inactive/deleted organization | Its branch/doctor contexts unavailable; legacy public organization endpoints honor inactive status |
| Expired/cancelled plan | Published contact pages remain; new booking is subscription-gated; owner can unpublish without renewal |
| Missing/disabled doctor or assignment | Doctor context omitted; facility can show no-doctors/contact recovery |
| Missing/full/unavailable schedule | Existing availability checks remain authoritative; copying a Google link is not proof of completed booking |
| Renamed provider | Existing persisted slug remains valid; no URL history required |
| Unknown slug/raw provider ID | Not-found/noindex; no redirect to an unrelated branch |
| Timeout/upstream failure | Upstream failure, not a deleted profile |
| Tracker, join, check-in, TV, auth/setup and dashboard | Operational responses carry noindex/nofollow; authorization/capabilities remain separate security controls |

Doctor canonicals preserve `?location=<public slug>` because it selects a real practice/organization. Other booking parameters are excluded. Bare doctor URLs canonicalize to the displayed branch. Sitemap uses the same location context. Publication is controlled per physical location; organization operational activation remains its existing control.

Next.js can start streaming HTTP 200 before a lookup fails. Provider lookups now happen before a loading boundary: the generic root loader is scoped to auth, dashboard/directory loaders remain, and provider loading appears within the confirmed page. The documented `htmlLimitedBots: /.*/` option blocks metadata uniformly for all visitors. Metadata/page lookups share a request during rendering. This trades an early provider shell for dependable metadata/status handling without another profile request. Production-rendered HTTP checks verified 404/noindex for missing profiles, 500 for upstream failure, and one profile request per healthy page.

Configure APP_URL (or NEXT_PUBLIC_APP_URL) with the confirmed frontend origin, without path/query/fragment/credentials. Provider pages stay noindex without it; sitemap fails visibly instead of emitting localhost, an API origin or a partial feed. Sitemap traverses all catalog pages, rejects repeated/invalid cursors, and requires partitioning above 50,000 URLs. It fabricates no freshness timestamps.

The sibling coming-soon site is separate static HTML and already advertises `https://ekavyu.com/` in its social metadata. Hosting/domain assignment cannot be inferred from source. Confirm which application owns the marketing domain and the booking domain; APP_URL must be the origin actually serving these provider routes. The coming-soon repository was not modified.

Existing locations stay published unless an owner unpublishes them. This compatibility default does not verify addresses/qualifications/Google eligibility. Already cached Google/social content does not disappear immediately. Old private-vault logo keys must be cleared or reuploaded through branding; no migration or private-object publication was performed.

## Manual owner/deployment setup

1. Review actual branch name/type, address/map pin, phone, hours, assigned doctors, fees and schedules. Publish when ready.
2. Open **Website booking**, preview while signed out, and test the entire booking flow on a phone.
3. Claim/verify the Google Business Profile for the real staffed branch. Google chooses verification methods. Keep real name/address/phone/hours consistent.
4. In Search select **Booking → Add link**, or the available booking option under **Edit profile** in Maps. Paste this branch's URL, save and set preferred where offered. Category/region/verification/Google approval determine eligibility. Use a website link and remove appointment actions while booking is paused.
5. Configure each branch separately. Practitioners must be public-facing and directly contactable at the verified location during stated hours. Use their branch-specific doctor URL. Several practitioners can have separate profiles using their names; Google's guidance recommends a shared branded profile for a sole practitioner in that practice. Avoid duplicate location/specialty listings.
6. Remove/update external links when unpublishing/archiving. Ekavyu does not automatically connect Google accounts, configure listings, provide Reserve with Google or guarantee rankings.
7. Deployment owner: set APP_URL, verify the production domain in Search Console, submit `/sitemap.xml`, and validate live markup/previews. Hosting/WAF must allow legitimate business-link verification/preview crawlers. No production firewall changes were made.

## Deferred

Reserve with Google/OAuth/partner integrations lack an existing integration or partnership. Separate city/specialty landing pages lack curated content; existing filters suffice. Custom domains, page builders, organization websites and bulk campaigns add unnecessary launch infrastructure. New attribution persistence would duplicate existing booking-source/traffic utilities. Credential verification and ratings markup need trusted evidence/policy; new schema claims neither. Slug history is unnecessary until URL editing exists. Revisit sitemap partitioning/caching with measured catalog size/traffic before the single-sitemap limit.

## Official sources checked

- [Google link setup](https://support.google.com/business/answer/6218037?hl=en), [link policies](https://support.google.com/business/answer/13769188?hl=en), [business/practitioner eligibility](https://support.google.com/business/answer/3038177?hl=en), [verification](https://support.google.com/business/answer/7107242?hl=en). Actions require dedicated location pages and direct completion; local links are manually configured, without API/spreadsheet automation promises.
- [Google LocalBusiness markup](https://developers.google.com/search/docs/appearance/structured-data/local-business), [canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing). Robots.txt is not access control; crawlers can read operational noindex headers.
- [Schema.org MedicalClinic](https://schema.org/MedicalClinic), [Hospital](https://schema.org/Hospital), [Physician](https://schema.org/Physician), [ProfilePage](https://schema.org/ProfilePage). Person describes the clinician without claiming a separate practitioner business.
- [WAI labels](https://www.w3.org/WAI/tutorials/forms/labels/): copying inputs have associated labels/status messages.
- Installed Next.js guides cover metadata, JSON-LD escaping, sitemap/robots, async data, not-found status and blocking metadata. Nuxt APIs do not apply to this repository.

## Focused verification

Classified Level 4 because publishing affects public booking, tenant boundaries and persisted branding. Frontend focused tests cover metadata/canonicals, truthful schema, sitemap pagination/failures, robots headers, sharing, owner publication, branding preservation, organization creation and existing booking consumers. Backend focused integration tests cover public catalogs/DTOs, disabled/inactive/unpublished states, multi-location doctor links, tenant permissions, expired-plan publication, patient versus staff booking, QR flows and branding ownership/cleanup. The final backend image-filter regression run passed 40 cases across four affected files.

Changed-file frontend ESLint, frontend and backend TypeScript, frontend production build, and backend API/worker bundle build passed. Production-rendered HTTP smoke checks with controlled fixtures verified actual metadata/JSON-LD, canonical URLs, sitemap entries, operational noindex, missing-profile 404, upstream-failure 500 and shared healthy-profile fetches. Initial sandbox/temp-output restrictions were handled with native Vitest config loading, non-incremental frontend TypeScript and approved generated-worker build access.

No full suite, browser E2E, real mobile viewport review, live Google verification, production data change or deployment was performed. Owners must complete the signed-out mobile booking and live Google/Search Console checks above; CI/release gates still apply before production rollout.
