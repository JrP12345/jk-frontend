# Public discovery, booking links and release checks

Current public-route contracts and dated validation boundaries. Source/fixture results do not certify the deployed booking origin, Google acceptance or real payment completion. Follow [operational release gates](production-readiness-tracker.md) before launch.

For page purpose, content hierarchy, cards, responsive behavior, data ownership and the patient journey, start with the [Browse-page product and engineering handoff](browse-pages-handoff.md).

- [Public catalogue and owner setup](#public-catalogue-and-owner-setup)
- [Provider ownership and metadata](#provider-ownership-and-metadata)
- [Deployed acceptance checklist](#deployed-acceptance-checklist)

## Public catalogue and owner setup

### Existing architecture and workflows

This is Next.js 16 App Router/React with Fastify/MongoDB, not Nuxt. Installed Next.js guides governed the changes.

Organization owns the tenant/subscription. Location owns a physical facility's type, address, timezone, contacts, hours, amenities and operations. Doctor references a global User and primary organization. DoctorAssignment connects that User to an organization/location, with independent fees, schedules and booking modes. Doctors can practice across organizations; selected location determines public organization context. Facility type grants no permissions/modules.

The directory already server-rendered its first page and supported doctor/specialty/city search and pagination. Facility details were server-loaded. Doctor pages already displayed location-specific booking and the clinician's public locations within the selected organization. Persisted public slugs, QR reception posters, WhatsApp contact, native sharing, website button code and owner readiness checks existed.

Booking already enforced schedules, overrides, slot/token availability, subscriptions and patient authority. Confirmation used tracker capabilities. Organization branding already had safe uploads, ownership, public serving, attachment and cleanup. Location logo forms instead used the private document uploader, saving unusable object keys.

Actual gaps: generic provider metadata; missing canonical/social metadata, structured data and sitemap; no independent publishing control; ordinary recovery pages for missing profiles; inconsistent disabled-doctor/inactive-organization checks; individual doctor emails in legacy public organization detail.

### Visibility and edge cases

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

### Manual owner/deployment setup

1. Review actual branch name/type, address/map pin, phone, hours, assigned doctors, fees and schedules. Publish when ready.
2. Open **Website booking**, preview while signed out, and test the entire booking flow on a phone.
3. Claim/verify the Google Business Profile for the real staffed branch. Google chooses verification methods. Keep real name/address/phone/hours consistent.
4. In Search select **Booking → Add link**, or the available booking option under **Edit profile** in Maps. Paste this branch's URL, save and set preferred where offered. Category/region/verification/Google approval determine eligibility. Use a website link and remove appointment actions while booking is paused.
5. Configure each branch separately. Practitioners must be public-facing and directly contactable at the verified location during stated hours. Use their branch-specific doctor URL. Several practitioners can have separate profiles using their names; Google's guidance recommends a shared branded profile for a sole practitioner in that practice. Avoid duplicate location/specialty listings.
6. Remove/update external links when unpublishing/archiving. Ekavyu does not automatically connect Google accounts, configure listings, provide Reserve with Google or guarantee rankings.
7. Deployment owner: set APP_URL, verify the production domain in Search Console, submit `/sitemap.xml`, and validate live markup/previews. Hosting/WAF must allow legitimate business-link verification/preview crawlers. No production firewall changes were made.

### Deferred

Reserve with Google/OAuth/partner integrations lack an existing integration or partnership. Separate city/specialty landing pages lack curated content; existing filters suffice. Custom domains, page builders, organization websites and bulk campaigns add unnecessary launch infrastructure. New attribution persistence would duplicate existing booking-source/traffic utilities. Credential verification and ratings markup need trusted evidence/policy; new schema claims neither. Slug history is unnecessary until URL editing exists. Revisit sitemap partitioning/caching with measured catalog size/traffic before the single-sitemap limit.

### Official sources checked

- [Google link setup](https://support.google.com/business/answer/6218037?hl=en), [link policies](https://support.google.com/business/answer/13769188?hl=en), [business/practitioner eligibility](https://support.google.com/business/answer/3038177?hl=en), [verification](https://support.google.com/business/answer/7107242?hl=en). Actions require dedicated location pages and direct completion; local links are manually configured, without API/spreadsheet automation promises.
- [Google LocalBusiness markup](https://developers.google.com/search/docs/appearance/structured-data/local-business), [canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing). Robots.txt is not access control; crawlers can read operational noindex headers.
- [Schema.org MedicalClinic](https://schema.org/MedicalClinic), [Hospital](https://schema.org/Hospital), [Physician](https://schema.org/Physician), [ProfilePage](https://schema.org/ProfilePage). Person describes the clinician without claiming a separate practitioner business.
- [WAI labels](https://www.w3.org/WAI/tutorials/forms/labels/): copying inputs have associated labels/status messages.
- Installed Next.js guides cover metadata, JSON-LD escaping, sitemap/robots, async data, not-found status and blocking metadata. Nuxt APIs do not apply to this repository.

## Provider ownership and metadata

### Already Correct

- Persisted slug uniqueness preserves renamed URLs; provider routes reject raw IDs. Doctor canonicals/sitemap retain meaningful selected-location context and omit follow-up parameters. [Paths](../src/lib/publicPaths.ts), [slugs](../../backend/utilities/publicLinks.ts), [doctor page](../src/app/doctor/[slug]/page.tsx).
- Provider lookups precede loading boundaries, share reads, call notFound only on real 404 and throw on upstream failures. Installed Next.js documents blocking metadata and non-streamed 404 semantics. This is static evidence of intended behavior, not a new hosted HTTP measurement. [Profile reader](../src/lib/publicProfile.ts), [facility page](../src/app/browse/[slug]/page.tsx), [configuration](../next.config.ts).
- JSON-LD uses saved branch information, explicit valid hours, escaped scripts and CSP nonce. No rating, credential or guaranteed booking action is fabricated. [SEO helper](../src/lib/publicSeo.ts), [JSON-LD](../src/components/PublicStructuredData.tsx).
- Publishing defaults true for compatibility, including new branches. It is an owner setting, not medical verification or completed onboarding. No-doctor/expired-plan states have fallbacks, and owners can change publication after expiry. Organization activation is distinct; active organization business contacts remain accessible through legacy organization endpoints. [Location](../../backend/models/Location.ts), [publication route](../../backend/routes/locations.ts), [subscription access](../../backend/services/billing/SubscriptionAccess.ts).
- Public DTOs allowlist fields. Tracker capabilities and patient permissions remain independent of robots. Public uploaded branding requires an attached asset and active published reference; cleanup preserves referenced assets for restoration. [DTOs](../../backend/types/publicDtos.ts), [branding routes](../../backend/routes/organizationBranding.ts).
- Guest booking can proceed without login on provider pages. Date/full-capacity/error states recover, sharing excludes patient parameters, and copy fields have labels/status with existing modal focus handling. Touch, keyboard, contrast and actual mobile rendering remain manual checks.

### Authoritative sources

[Google action-link policies](https://support.google.com/business/answer/13769188?hl=en), [business/practitioner eligibility](https://support.google.com/business/answer/3038177?hl=en), [canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [Schema.org MedicalClinic](https://schema.org/MedicalClinic), [ProfilePage](https://schema.org/ProfilePage). Installed Next.js metadata, htmlLimitedBots, not-found, sitemap and JSON-LD guides governed the framework review.

## Deployed acceptance checklist

### Remaining release steps

1. Confirm the intended HTTPS booking domain and apex/subdomain routing. Marketing can remain at the apex if that is intended. Build the release image with matching real APP_URL at build/runtime and the correct NEXT_PUBLIC_API_URL at build; verify BACKEND_INTERNAL_URL resolves directly to the API. Under the checked-in Compose recipe, use Caddy's same-origin /api route. For native hosting, verify the compiled rewrite target as well as runtime SSR; never route /api back into itself.
2. Obtain passing normal CI for the release revision and start the actual production containers through the authorized release process. Check health/readiness and available rollback image. Verify DNS/TLS, CORS origin, Secure cookie storage/refresh, redirects and private-route protection on the final topology.
3. On authorized staging fixtures, complete signed-out facility and practitioner bookings on a real phone through confirmation, including payment when required. Verify selected branch, durable appointment/invoice tenant ownership, tracker access and self/family boundaries. Exercise disabled/missing/foreign assignments, unpublished/inactive branches, no doctors, full/closed/error schedules and expired plans; verify owner unpublishing after expiry.
4. On the deployed booking origin, verify provider 200, genuinely missing/unpublished 404/noindex, upstream 5xx, canonicals/social images, CSP/resource loading and complete sitemap/robots. Inspect ordinary and Google-BusinessLinkVerification requests through the actual CDN/WAF. Measure representative latency, database work and crawler 429s before changing caching or limits.
5. Open each saved Google action link signed out, confirm its branch/practitioner identity and complete the designated booking action. Use one appointment link per domain/profile; remove links while booking is paused. Confirm eligibility and resources load without challenges or obstructive throttling. These requirements come from [Google's current action-link policy](https://support.google.com/business/answer/13769188?hl=en).

## Dated local verification

The 8 October 2026 discovery checkpoint recorded 104 focused passing cases:
73 backend and 31 frontend, including six temporary CORS/ownership probes.
It also recorded a controlled HTTPS production build, local HTTP/browser smoke
and read-only Compose/origin checks. Its synthetic API origins and local browser
observations did not certify deployed infrastructure, real payment completion
or provider delivery. The temporary probes and detailed old command log are
historical evidence; exact-revision CI and the acceptance checklist above remain
release requirements. Current cleanup checks are in [the working plan](pre-production-cleanup.md).
