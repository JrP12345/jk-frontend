# Discovery release verification

[Staging deployment preparation](staging-deployment-readiness.md) records the subsequent dev.ekavyu.com setup and planned ekavyu.com cutover; the verification below describes the earlier release check.

2026-10-08. **Final decision: NO-GO for production approval.** The implemented fixes pass the focused local gates. The intended production booking origin and deployed journey have not been verified. No release-blocking source defect was reproduced, so application code was left unchanged.

Reviewed [the independent review](discovery-readiness-review.md) and the changed booking, tenant, branding, SEO and deployment paths. This was targeted release verification, not another broad audit.

## Release gates

PASS applies to the stated scope. FAIL means the required production evidence is absent or the observed target cannot support launch; it does not imply a newly discovered source defect.

| Gate | Result | Evidence and limits |
| --- | --- | --- |
| Booking authorization and practitioner eligibility | **PASS** | Real Fastify/Mongoose integration tests reject disabled users/profiles, inactive assignments, unpublished locations and expired-plan consumer bookings. Missing assignment returns 400; foreign assignment returns 409 before booking/invoice creation. Staff booking and existing-care access regressions pass. [Service](../../backend/services/AppointmentService.ts), [slots](../../backend/services/SlotService.ts), [eligibility](../../backend/utilities/doctorBookingEligibility.ts). |
| Tenant isolation and privacy | **PASS** | Cross-organization consumer booking records appointment, newly created patient and consultation invoice under the selected branch. Signed access token and persisted refresh session retain the original organization. Self/family/guest and clinical-access denials pass. Public DTO/branding tests exclude private contact fields, operational fields and vault keys. [Controller](../../backend/controllers/appointment.ts), [DTOs](../../backend/types/publicDtos.ts), [branding](../../backend/services/OrganizationBranding.ts). |
| Publishing and branding compatibility | **PASS** | Hidden/inactive organizations and branches, disabled doctors, missing/foreign assignments, cross-owner publishing, expired-plan publishing and unchanged legacy-logo edits pass the selected regressions. Attached branding ownership/reference and archival retention checks pass. |
| Docker/environment source wiring | **PASS** | Both manifests parse. Production Compose also resolves with synthetic values: APP_URL matches frontend build/runtime and backend/frontend origin; browser API uses the same HTTPS origin; SSR uses http://backend:5000. Only Caddy publishes ports, and its API route precedes the frontend route. Docker excludes local environment files. [Dockerfile](../Dockerfile), [Compose](../../backend/deploy/docker-compose.production.yml), [Caddy](../../backend/deploy/Caddyfile). No real deployment environment was read. |
| HTTPS, cookie and CORS implementation | **PASS** | Eight production APP_URL guard cases pass. Production access/refresh cookies are Secure, HttpOnly, path /; default host-only production cookies use SameSite=None. Indicator cookie is intentionally readable. Three real API CORS probes allow only the configured origin with credentials, withhold access for an unrelated origin, and allow SSR without Origin. Actual TLS/cookie persistence and any separate API-domain cookie scope remain unverified. [Origin](../src/lib/siteUrl.ts), [cookies](../../backend/utilities/types.ts), [API CORS](../../backend/index.ts). |
| Production-mode SEO and HTTP behavior | **PASS** | Fresh Next production build and 16 HTTP checks pass against controlled public API fixtures. Ordinary visitor, Googlebot and Google-BusinessLinkVerification each receive provider 200, missing facility/doctor 404 with noindex, and upstream-failure 500. Canonical/social origin is HTTPS; doctor canonical retains selected location and excludes follow-up/patient parameters. MedicalClinic/ProfilePage JSON-LD parses, uses saved branch address/hours, escapes script text and carries CSP nonce. Sitemap contains all four fixture provider URLs plus three static URLs; robots permits branding images and operational responses carry noindex. Repeated metadata/page access shares one facility read. [Profile reader](../src/lib/publicProfile.ts), [SEO](../src/lib/publicSeo.ts), [sitemap](../src/app/sitemap.ts), [robots](../src/app/robots.ts), [proxy](../src/proxy.ts). |
| Local mobile booking and Google destination journeys | **PASS** | Chrome 154 at 390 x 844 reaches signed-out facility and selected-branch doctor confirmation using browser pointer input. Submitted doctor/branch IDs match their links. Full, closed, failed availability, empty roster and expired-plan states prevent progression; provider and confirmation views have no horizontal overflow or uncaught browser exceptions. **API responses were intercepted fixtures**, so this does not prove real cookie persistence, backend/browser integration or payment. [Booking UI](../src/app/browse/[slug]/BrowseDetailClient.tsx), [owner links](../src/components/organization/GoogleBookingLinks.tsx). |
| Production container startup and deployed origin | **FAIL** | Docker daemon is unavailable; no image/container startup was executed. Read-only unrestricted HTTPS homepage probe returns 200 with title ?Ekavyu ? Coming Soon? at ekavyu.com. dev.ekavyu.com returns ENOTFOUND from this environment. The intended booking domain is not established by these results. No deployed provider, sitemap, TLS/CORS/cookie or browser journey is certified. |
| Saved Google appointment links and real-phone completion | **FAIL** | No Business Profile access or deployed booking target was available. Saved URLs, branch/practitioner identity, WAF/resource access, cookie retention and applicable payment confirmation remain manual release gates. Local route correctness cannot certify Google approval. |
| Current release CI and production capacity/health | **FAIL** | No passing CI run for these dirty working trees or deployed health/capacity evidence was available. Full suites were intentionally not repeated. Bounded catalog pagination and shared profile reads pass focused checks; production latency, DB work, crawler 429s and sitemap cost remain unmeasured. No performance defect was reproduced. |

## Tests actually executed

Backend command: `node node_modules/vitest/vitest.mjs run --configLoader native <files>`. Frontend command: `npm test -- --configLoader native <files>`. JSON/default reporters retained evidence outside the repositories.

| Repository | Focused test file | Passed |
| --- | --- | ---: |
| Backend | tests/publicDiscovery.test.ts | 9 |
| Backend | tests/browseBookingSecurityPolish.test.ts | 12 |
| Backend | tests/organizationManagement.test.ts | 12 |
| Backend | tests/publicLocationCatalog.test.ts | 14 |
| Backend | tests/publicOrganizationDto.test.ts | 7 |
| Backend | tests/physicalToDigitalBridge.test.ts | 6 |
| Backend | tests/appointment.test.ts | 7 |
| Frontend | src/tests/publicDiscovery.test.tsx | 8 |
| Frontend | src/tests/publicCanonicalLinks.test.tsx | 4 |
| Frontend | src/tests/doctorProfilePage.test.ts | 2 |
| Frontend | src/tests/locationMapCoordinates.test.tsx | 6 |
| Frontend | src/tests/browseDoctorDetail.test.tsx | 11 |
| Backend | Temporary focused CORS probes | 3 |
| Backend | Temporary missing/foreign assignment and invoice/session-scope probes | 3 |

**104 tests passed, zero failed: 73 backend and 31 frontend.** Temporary probes used the existing Mongo memory-server setup and were removed afterward; their source is retained with local evidence. The assignment probe logged a caught background booking-notification MongoClientClosedError during database teardown after the 201 response and assertions; it exited successfully. This is a harness teardown limitation, not evidence that production notifications were delivered.

Additional checks executed: one fresh `npm run build` with controlled HTTPS APP_URL/API origins and a direct local SSR backend; two read-only Compose config validations plus synthetic resolved-production assertions; eight origin-helper cases; production cookie-helper assertions; production-mode HTTP/browser smoke; homepage-only live probes; frontend/backend `git diff --check`. Backend TypeScript and changed-file frontend lint passed in the preceding review and their covered source did not change here. No full suite, dependency installation, backend rebuild, database migration, deployment, credential edit or production booking was performed.

Evidence directory: `%TEMP%\ekavyu-discovery-release-20261008`. It contains backend/frontend/CORS/assignment JSON reports and logs, frontend-build.log, compose-wiring.json, production-runtime.json, the isolated smoke/probe source, and facility/confirmation mobile screenshots. Chrome renderer commands timed out inside the sandbox; the isolated browser check passed outside it. Initial restricted apex probing returned EACCES; the unrestricted read-only probe established the Coming Soon response.

The locally generated .next artifact contains **example.test verification origins**. It is a verification artifact and must be rebuilt with the real release settings before deployment. The checked-in frontend CI build also uses a placeholder API origin and omits APP_URL; its uploaded artifact is verification evidence, not a configured production release image. [CI](../.github/workflows/ci.yml).

## Remaining release steps

1. Confirm the intended HTTPS booking domain and apex/subdomain routing. Marketing can remain at the apex if that is intended. Build the release image with matching real APP_URL at build/runtime and the correct NEXT_PUBLIC_API_URL at build; verify BACKEND_INTERNAL_URL resolves directly to the API. Under the checked-in Compose recipe, use Caddy's same-origin /api route. For native hosting, verify the compiled rewrite target as well as runtime SSR; never route /api back into itself.
2. Obtain passing normal CI for the release revision and start the actual production containers through the authorized release process. Check health/readiness and available rollback image. Verify DNS/TLS, CORS origin, Secure cookie storage/refresh, redirects and private-route protection on the final topology.
3. On authorized staging fixtures, complete signed-out facility and practitioner bookings on a real phone through confirmation, including payment when required. Verify selected branch, durable appointment/invoice tenant ownership, tracker access and self/family boundaries. Exercise disabled/missing/foreign assignments, unpublished/inactive branches, no doctors, full/closed/error schedules and expired plans; verify owner unpublishing after expiry.
4. On the deployed booking origin, verify provider 200, genuinely missing/unpublished 404/noindex, upstream 5xx, canonicals/social images, CSP/resource loading and complete sitemap/robots. Inspect ordinary and Google-BusinessLinkVerification requests through the actual CDN/WAF. Measure representative latency, database work and crawler 429s before changing caching or limits.
5. Open each saved Google action link signed out, confirm its branch/practitioner identity and complete the designated booking action. Use one appointment link per domain/profile; remove links while booking is paused. Confirm eligibility and resources load without challenges or obstructive throttling. These requirements come from [Google's current action-link policy](https://support.google.com/business/answer/13769188?hl=en).

**Changes this turn:** added this verification record and linked it from the independent review. No application, schema, permission, URL, credential or deployment change was necessary.
