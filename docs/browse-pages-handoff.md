# Ekavyu Browse pages — product and engineering handoff

Reviewed against the repository on **27 October 2026**. This document describes the current implementation, including the latest doctor-card layout. It is a guide for explaining, maintaining, designing, or reviewing these pages; it is not a proposal for a new design.

## 1. A description you can share

Ekavyu's Browse experience helps patients find a healthcare facility, understand the care available there, and choose their next step. The directory at `/browse` supports list/map discovery, search, city/specialty/opening-hours filters, sorting, directions, and calling. Opening a facility leads to `/browse/[slug]`, where patients can compare its doctors, read facility information, check appointment options, and book through the existing appointment flow. Visitors can browse without signing in, and guest booking does not require an account.

The directory answers **“Which facility should I open?”** The facility page answers **“Which doctor should I choose here, and how do I arrange my visit?”**

## 2. Scope, routes, and intended users

| Route | What it represents | Main patient task |
| --- | --- | --- |
| `/browse` | Directory of published physical healthcare locations | Find, compare, locate, and contact facilities |
| `/browse?search=…` | Directory opened with a keyword search | Continue a search submitted from another page |
| `/browse/[slug]` | One physical location and its assigned doctors | Understand the facility and select a doctor or contact reception |
| `/doctor/[slug]?location=[facility-slug]` | Related doctor profile in a selected practice context | Evaluate a doctor while preserving the chosen facility |

The route often called `/browse/id` in conversation is implemented as **`/browse/[slug]`**. For example, `/browse/aarogya-clinic-35c762d7eab1` is a readable public slug. It should not be replaced with a database ID.

Primary users are first-time patients, returning patients, and people helping a family member arrange care. Signed-in patients can select eligible linked family members during booking. Clinics and hospitals benefit from a public, location-specific destination, but these pages are not administrative workspaces.

## 3. What the data represents

| Entity | Responsibility | Why the distinction matters |
| --- | --- | --- |
| Organization | Tenant, subscription, shared branding and organizational ownership | An organization can operate several locations |
| Location / facility | A physical branch with its own name, type, address, contacts, hours and publication setting | Each directory card and facility page represents this entity |
| Doctor / public profile | Clinician identity, specialty, qualifications and profile information | A doctor is not a facility card |
| Doctor assignment | Connects a doctor to an organization and location, including practice-specific configuration | Fees, schedules and booking context must follow the selected practice |
| Appointment | Patient visit with a selected doctor and location | Created only when the booking form is submitted |

Supported facility classifications include clinic, hospital, diagnostic center, medical center, specialty center, pharmacy, and other healthcare facility. Display the saved facility name. Do not append a hardcoded “Clinic” label to every result or treat every organization as a hospital.

Only active, publicly published locations belonging to eligible active organizations should be discoverable. A published contact page can remain available when online booking is unavailable. Publication, facility opening hours, doctor availability, and booking entitlement are separate concepts.

## 4. /browse: list and map discovery

The current directory follows the supplied desktop list, desktop map, mobile list and mobile map boards. The former reception hero, specialty-chip row and multi-column card grid are replaced by a compact search header and facility rows. Existing account controls, brand assets and light/dark tokens remain in use.

### Header and search

The shared fixed header includes the real Ekavyu identity, appearance/account actions, and a directory search slot. Desktop combines keyword, city and Search. Phones put a single-line keyword form with an icon submit button beneath the brand/account row; city selection is in Filters. Header height is 64px on desktop and 126px on mobile.

Typing is debounced by 300ms; Enter or Search submits immediately. Searches use the public facility/clinician API. An explicit search query takes precedence over saved discovery state. The heading is “Clinics & hospitals,” followed by the selected city when applicable. The count represents loaded results, with “shown” when another cursor exists; it is not an invented full-directory total.

Appearance uses the existing Button, Input, Select, Checkbox, Card and page-title system. Facility action links reuse Button's exported buttonClassName utility while retaining native link navigation. Local CSS handles responsive arrangement and map positioning rather than recreating ordinary control colors, corners and hover states. Map pins and Leaflet controls retain their map-specific presentation.

### Filters and ordering

| Control | Behavior |
| --- | --- |
| Specialty checkboxes | Multiple supplied specialties can be selected; matching any selected specialty includes a facility. Values are sent as repeated specialization parameters. |
| Specialty counts | Distinct published facilities with the specialty across the public catalogue, not doctor counts or fabricated filtered totals. Missing counts are omitted. |
| Open now | Server checks saved hours in the facility timezone before pagination. Unknown hours do not match. Active open-now results refresh each minute. |
| Open 24 hours | Filters for explicit round-the-clock hours. |
| City | Desktop search selector or filter sheet. |
| Clear all | Clears keyword, city, specialties, hours and map-area constraint, retaining view/sort. |
| Sort | Nearest first when a usable user/map-area origin exists; otherwise Top rated. Lowest fee remains supported. |
| Load more | Retains the same query, specialties, hours, map bounds and ordering; duplicate IDs are excluded. |

Desktop List view has a sticky filter sidebar. Below 900px, and in desktop Map view, Filters opens the existing responsive sheet instead. Changes update shared result state; Show results closes the sheet. There is no favorites feature or duplicate applied-filter row.

Nearby ranking happens across the visible catalogue before pagination, not on one downloaded page. A failed nearby request falls back to rating order with an explanation. Ratings and minimum fees can support sorting without becoming extra information rows inside facility cards.

### Facility-row hierarchy

Desktop rows have a fixed square logo beside a single information column: actual name, opening status, specialties, address, and callable phone. A narrow, divided action column sits on the right with Book/View above Directions.

Phones use the same identity order with stacked full-width actions below a divider. Map rows use a compact variant with side-by-side actions. The selected map summary shows identity/status/city and its own Directions/Book-or-View actions.

| Element | Purpose and fallback |
| --- | --- |
| Logo | Contained square, 56px desktop / 48px phone / 44px map row. Missing logo uses the facility initial; failed images use an icon. |
| Name | Strongest text, linking to the saved public facility slug. No hardcoded Clinic suffix. |
| Opening status | Existing timezone-aware status engine; unknown hours stay unknown. |
| Specialties | At most two distinct supplied specialties. No individual doctor details on facility rows. |
| Address | Readable wrapping, with city/location fallback. Qualified distance is shown only with usable nearby data. |
| Phone | Validated native call link; missing/invalid phone says Phone not listed. Email stays on the detail page. |
| Main action | Book appointment only for explicitly eligible online booking; otherwise View clinic, View hospital, or View facility. Opens the facility page, without reserving a visit. |
| Directions | Separate labelled action opening Google Maps using valid coordinates or facility name/address. Address text remains read-only. |

Directory rows load only the identity logo. They do not download cover/gallery images or show doctor biographies, qualifications, doctor fees, speculative availability, or extra feedback rows.

### Map view and interaction

The desktop List/Map switch sits beside sorting. Phones have a floating Map/List button. Both views share filters, ordering, results and navigation. Switching views does not request another directory page. The view=map query parameter can open Map directly.

Desktop Map view removes the filter sidebar, puts compact rows on the left and a sticky map on the right. Mobile hides the list/visible heading, keeps Filters and sorting under the header, and fills the remaining viewport with the map.

- Numbered pins follow the current row order. Selected pins are larger/filled, and the selected row is marked.
- A pin or map-row logo/number button selects a facility; name and booking links still navigate.
- The selected summary is at bottom-left on desktop and above the floating List button on phones.
- Zoom buttons, keyboard movement, and optional centering on the user's approximate location work.
- Panning/zooming alone does not fetch results. Search this area sends visible bounds to the API, which filters before ranking/pagination.
- Ordinary search/filter changes clear stale map bounds. Clear map area is also available in Filters.
- Map view exposes additional-page loading and request errors/retry.
- Only finite saved coordinates in range produce pins. The zero pair is unmapped. Missing coordinates never receive invented positions; those facilities remain in List view.
- Pins clipped by the map boundary or covered by its controls/summary are not exposed as tiny partial touch targets. Pan/zoom or use List view to reach those facilities.
- Empty/unmapped results, failed map-code loading and failed raster tiles have recovery states. Tile failure does not remove pins or List view.

The actual map uses on-demand Leaflet 1.9.4, raster tiles and visible OpenStreetMap attribution. Map code and tiles load only when Map is opened. The reference boards' drawn roads are not shipped as a pretend map.

### Location, continuity and loading

Browser geolocation, then approximate IP-location providers, can supply a ranking origin. Valid location is session-cached for five minutes. Detection does not force a city filter. IP/low-accuracy results are qualified as approximate, and distance bands are not road-travel estimates.

Before facility navigation, session storage retains keyword, city, selected specialties, hours filters, sort, view and scroll position. Returning can restore that context; storage failure never prevents browsing.

Initial loading shows row skeletons. Refresh preserves previous results with busy/status feedback. Failed updates retain the last available rows and offer retry. Empty states distinguish no matches from a service error. Filters, recovery and pagination use the same data state in both views.

## 5. `/browse/[slug]`: page structure and behavior

### Overall composition

The facility page shares the directory's navbar, content width, gutters, theme tokens, controls and status treatment. A breadcrumb/back action returns to Browse Locations. The navbar provides a native GET search that opens `/browse?search=…`; on mobile it is accessed through a search dialog.

At 900px and above, **doctors are on the left and facility information is on the right**. Below 900px, facility information comes first, followed by doctors. This order also follows the rendered document structure. There is no separate full-width facility banner above these columns.

### Integrated facility-information card

Read from top to bottom:

1. A short saved cover strip, fading into the card surface; opening status and Share sit together at the top right.
2. Contained facility logo and actual facility name. Organization affiliation is shown only for a multi-location organization with a different name.
3. City and a saved opening-hours summary.
4. Facility description, or a reception-contact explanation when no description is supplied.
5. One grouped contact area: full address, directions, phone/copy, email/copy, and WhatsApp contact when a phone is supplied.
6. An explicitly configured embedded map, when available.
7. Native Opening hours disclosure, followed by Facilities & photos only when real amenities/photos exist.

The logo is 72px on larger screens and 64px below 640px. The cover strip is 88px high; it is decorative context, with the title rendered on an opaque readable surface. Directory cards do not download this cover.

Phone and email open the device's calling/email applications. Copy buttons provide clipboard feedback. Share uses the existing public-profile sharing component. Opening the WhatsApp link starts an external conversation with a prefilled appointment enquiry; it is not an in-page chat service or evidence that automated notifications were delivered.

Without an embedded map, the address row provides the directions action. With an embed, directions sits below the map instead, avoiding a duplicate directions control. The saved map loads lazily. There is no fabricated map preview when a map has not been configured.

Opening hours remain a disclosure rather than a long permanent schedule. Amenities are saved facility attributes, not inferred services. Photo thumbnails and the gallery viewer use the actual saved gallery; there are no About/Plan your visit tabs or unsupported Reviews tab.

### Doctor-list structure

The section is labelled **Doctors**, with a short instruction that changes when booking is unavailable. More than eight doctors enables a local name/specialty search; more than one distinct specialty enables a specialty selector. Initially up to 12 doctors are shown; Show all expands the roster. Local roster filtering does not fetch every doctor's availability.

```text
┌────────────────────────────────────────────┐
│ Portrait   Doctor name                      │
│            Specialty                        │
│            Qualifications · Experience      │
│            Rating, when supported           │
│ ────────────────────────────────────────── │
│ Availability/mode   Consultation fee [Book] │
└────────────────────────────────────────────┘
```

The latest doctor card has two sections:

- **Identity header:** portrait/initials, name, specialty, qualifications, experience, and optional supplied feedback. This is a link to the doctor's public profile in the same facility context.
- **Action footer:** doctor availability/queue-mode information, a consultation-fee label with its value underneath, and the booking button directly beside the fee. On narrower containers, availability occupies its own line above the fee/action row.

The portrait is a fixed 64px circle, reducing to 56px in the narrowest doctor containers. A missing portrait uses the existing DR fallback. Long text wraps rather than being forced over the fee or action. The doctor list uses individual cards without an additional decorative card around the entire list.

Fee display follows the supplied fee type:

| Fee data | Label |
| --- | --- |
| Explicit free consultation | Free |
| Fixed positive fee | Formatted currency amount |
| Post-consultation with a minimum | From [amount] |
| Post-consultation without a positive minimum | Set after consultation |
| Unspecified/nonpositive fixed fee | Ask reception for fee |

The action says Book now for an ordinary bookable context, Find next date when the doctor is unavailable/online booking is closed today, or Contact reception when location booking is unavailable. Opening this action invokes the existing availability/booking flow; the card itself does not establish that a slot is free.

A single-doctor facility also has the existing Check times bar below 1024px when booking is allowed and no booking/ticket surface is open. It uses the same doctor, fee and booking handler.

### Opening status is not appointment availability

Facility status is calculated from saved hours in the facility timezone and refreshed every minute. It can represent open, closing soon, break, closed, closed today, 24-hour operation, or unspecified hours.

A facility can be physically open while a doctor's online queue is closed or full. A facility closed now can still accept a future appointment. Do not equate a green opening chip with an available appointment or guaranteed booking.

## 6. Booking journey reached from the facility page

1. **Choose a doctor.** The existing handler opens a two-step booking sheet. Related doctor-profile routes reuse this flow inline.
2. **Select date and time/token.** The frontend can preview schedule information while it requests authoritative slots for the selected doctor, location and date. Selection/continuation is blocked until the availability state permits it.
3. **Handle capacity and exceptions.** Time-slot and sequential-queue modes have different selection rules. Closed days, holidays, full tokens, locked/unavailable slots and request errors have recovery states. Find next available checks later listed days only when requested; it does not invent the next available appointment.
4. **Enter patient details.** Guests provide required name and mobile number, with optional email. Current guest booking is OTP-free and uses a restricted booking session. Signed-in patients use their account context and can select eligible linked family members. Notes and applicable payment preferences are handled in the existing form.
5. **Confirm.** Submission creates an appointment for the resolved doctor and location. Duplicate submission is guarded, and the backend remains responsible for authorization, availability, capacity and booking policy.
6. **Show the ticket.** Confirmation includes the saved visit details, token/status where supplied, print action and private tracking link. Follow-up query triggers are removed after success so they do not reopen the completed flow.

Free, post-consultation, pay-at-reception and online-payment preferences follow existing fee/payment rules. The current online option is restricted to the supported India/INR context. **Creating an appointment or payment order is not completed payment.** The current facility flow can show online payment pending or payment-setup failure while preserving the saved appointment. Do not describe this page as a completed embedded checkout.

Tracker links can include a private capability token. They must not be copied into public-profile links, screenshots, documentation or metadata. Public browsing does not grant access to patient records.

## 7. Data placement and ownership

| Information | Directory | Facility page | Source / editing responsibility |
| --- | --- | --- | --- |
| Facility name/type/city/address | Name/address shown; type informs fallback action | Name, city and full address | Location management |
| Phone | Callable | Callable, copyable; WhatsApp link | Published location contact data |
| Email | Deferred | Email link and copy | Published location contact data |
| Logo | Small, contained | Contained facility/organization fallback | Published branding configuration and effective API response |
| Cover/gallery | Not loaded | Short cover and optional photo disclosure | Saved public branding/gallery |
| Facility hours/timezone | Compact status | Status, summary and detailed hours | Saved location/organization context |
| Specialties | Compact supplied summary | Assigned doctors and roster filter | Public clinician/assignment data |
| Doctor qualifications/experience | Deferred | Doctor identity section | Clinician profile |
| Doctor fee and booking mode | Not repeated on facility card | Doctor footer and booking flow | Selected practice's public configuration |
| Reviews/ratings | Only supported feedback values | Conditional doctor feedback; no review tab | Supplied public feedback; no invented trust/verification badge |
| Maps coordinates/embed | Coordinates inform directions/ranking | Directions and optional saved map | Location management |
| Publication/online booking | Controls discovery and action labels | Controls availability entry points | Backend publication and booking-policy checks |

Owners configure maps under location details using **Map coordinates (optional)** and **Google Maps embed (optional)**. The embed field accepts Google's copied iframe HTML or its supported embed URL. The app extracts and validates the URL; pasted HTML is never rendered directly. A regular short/share link is not an embeddable map. The accepted URL is restricted to HTTPS `www.google.com/maps/embed` with the supported parameters.

These public pages do not edit facility records. Correcting a wrong phone, address, photo, schedule or clinician assignment requires changing the source configuration, not hardcoding the public component.

## 8. APIs and loading boundaries

Paths below include the `/api` prefix; the shared client supplies that prefix when code uses `/public/…` or `/appointments`.

| Request | Role |
| --- | --- |
| `GET /api/public/locations` | Directory results/facets; accepts search, city, repeated specialization, sort, coordinates, cursor, openNow/open24Hours and bounds=south,west,north,east |
| `GET /api/public/locations/[slug]` | Selected public facility and assigned doctors |
| `GET /api/public/doctors/[doctorId]/slots?locationId=…&date=…` | Authoritative availability for one selected context/date |
| `GET /api/family` | Authenticated patient's linked family choices during patient-details step |
| `POST /api/public/booking-session` | Restricted guest booking session |
| `POST /api/appointments` | Appointment creation |
| `POST /api/appointment-payments/pay-at-location` | Save applicable reception-payment preference |
| `POST /api/appointment-payments/create-order` | Start applicable online-payment setup; not proof of payment |

The directory's first page is fetched server-side with no-store caching and a three-second timeout. Client state handles later filtering, retry, geolocation and cursor pages. The next cursor is returned in `X-Next-Cursor`; filter facets should remain usable when the result set is empty.

The facility profile is fetched before the loading boundary through a request-deduplicated, no-store public-profile reader with a five-second timeout. A real missing profile becomes not-found; timeout/upstream failure remains a service failure. Client recovery distinguishes an unavailable location from a temporary load problem.

Pending requests are cancelled when relevant state changes. Availability is fetched for selected contexts rather than eagerly for every doctor card. Directory normalization removes duplicate/invalid records and applies honest display fallbacks. Profile-link prefetching is limited to the sole directory result or pointer/keyboard/touch intent on a facility link.

Current facility deep links can use `doctor=[doctor-slug]` with `openBooking=true`, or with the follow-up parameters `followUp=true` and `prevAppointmentId`. The doctor-profile integration can also supply its resolved doctor ID internally through component props. Public doctor links must resolve to a doctor at the displayed facility and follow the same booking checks; URL parameters do not grant patient or follow-up authority. Generate provider paths through the shared path helpers.

## 9. Responsive design and shared visual rules

| Width / container condition | Current layout rule |
| --- | --- |
| Desktop List | Filter sidebar and one facility row per line; sidebar collapses below 900px |
| Directory below 768px | Two-row header, compact controls, stacked-action cards and floating Map button |
| Desktop Map | Compact left results and pinned right map; no filter sidebar |
| Mobile Map | Full remaining viewport under header/filter controls, summary card and List button |
| Facility below 900px | Information first, doctors second |
| Facility 900px and above | Doctors left, information right; shared responsive column ratios |
| Doctor container at most 560px | Availability line above a full-width fee/action row |
| Doctor container at most 360px | Smaller portrait/type/padding and 128px action column |

The facility and directory Map frames are capped at 1600px; directory List uses a 1320px frame. Side padding is 32px on larger screens and 16px below 768px. Both pages use the existing warm light and charcoal dark surfaces, emerald actions, border tokens and focus-ring tokens. Do not introduce separate page palettes.

Cards use readable wrapping, consistent radii and 44px primary interactive targets. Facility logos remain square and contained; doctor photographs cover a fixed circular frame. Pointer cursors apply to real links/buttons, while read-only metadata keeps its ordinary cursor. Hover effects are restrained, keyboard focus stays visible, and reduced-motion settings disable the relevant transitions/movement. Loading skeletons follow the same page order and card grouping.

Semantic headings, labelled search/select controls, live result/error messages, disclosure summaries, distinct link/button roles, and existing modal focus handling support keyboard and assistive-technology use. These implementation measures are not a blanket accessibility certification.

## 10. Expected states and limits

| State | Expected experience |
| --- | --- |
| Directory loading | Skeleton cards rather than empty fabricated previews |
| Results updating | Previous results retained, busy/status announcement |
| No matches | Explanation and reset when filters are active |
| Request failure | Retry; previous results preserved when present |
| No location permission/provider failure | Ordinary directory remains usable; no required location gate |
| Missing logo/contact/specialty | Contained fallback or omitted optional information |
| No assigned doctors | Contact/browse recovery, without a booking promise |
| Online booking unavailable | Published facility information stays useful; reception guidance |
| Doctor unavailable or full date | Authoritative later-date/retry/contact recovery |
| Long names/addresses/credentials | Wrap inside the card without overlap or horizontal overflow |
| Missing/unpublished profile | Not-found behavior rather than another facility's page |
| Payment setup fails after appointment creation | Preserve the appointment and show pending/recovery instructions |

Not implemented here: favorites, review submission/browsing, verified-provider badges, medical advice, a facility website builder, guaranteed appointment availability, in-page WhatsApp messaging, or automatic Google Business Profile management. A directions/share link is not a Google account integration.

## 11. SEO, privacy, and public links

The directory and facility route provide titles/descriptions through shared SEO utilities. Facility metadata uses the actual location name/city, saved description and appropriate public image. Canonical URLs and indexing depend on a valid configured public application origin.

Facility structured data uses the saved classification (`MedicalClinic`, `Hospital`, or the applicable general medical-business fallback), branch address and explicit supported hours. It does not invent aggregate ratings, credentials or a guaranteed booking action. Provider slugs and branch-specific doctor links preserve identity across navigation.

Public APIs expose selected public fields rather than internal tenant settings. Session-based discovery continuity and approximate location are browsing context, not patient history. Screenshots or demo fixtures must use public information or clearly identified synthetic records. Do not include patient details or tracker capabilities in shared assets.

For publication, domain configuration and deployment acceptance, use [Public discovery](public-discovery.md). This handoff describes page behavior; it does not replace those operational checks.

## 12. Implementation map

| File | Responsibility |
| --- | --- |
| [Directory server page](../src/app/browse/(directory)/page.tsx) | Initial keyword/server fetch and directory metadata |
| [BrowseClient](../src/app/browse/BrowseClient.tsx) | Results, normalization, filters, sorting, pagination, recovery and continuity |
| [BrowseSearch](../src/app/browse/BrowseSearch.tsx), [BrowseFilters](../src/app/browse/BrowseFilters.tsx) | Header search and shared sidebar/sheet filters |
| [BrowseMap](../src/app/browse/BrowseMap.tsx), [map CSS](../src/app/browse/BrowseMap.module.css), [presentation helpers](../src/app/browse/browsePresentation.ts) | Lazy map, coordinates, selection, bounds and shared actions |
| [LocationCard](../src/app/browse/LocationCard.tsx) | Facility-card content and independent actions |
| [Directory CSS](../src/app/browse/browse.module.css), [card CSS](../src/app/browse/LocationCard.module.css) | Directory layout and facility-card styling |
| [Facility server page](../src/app/browse/[slug]/page.tsx) | Public lookup, metadata, structured data and brand context |
| [BrowseDetailClient](../src/app/browse/[slug]/BrowseDetailClient.tsx) | Facility state, roster filtering, availability, booking, ticket and gallery |
| [FacilityProfile](../src/app/browse/[slug]/FacilityProfile.tsx), [profile CSS](../src/app/browse/[slug]/FacilityProfile.module.css) | Information card, doctor cards and their responsive presentation |
| [MarketplaceNavbar](../src/components/MarketplaceNavbar.tsx), [shared layout CSS](../src/components/MarketplaceLayout.module.css) | Shared header, account/search controls, gutters and columns |
| [Directory skeletons](../src/components/ui/LocationCardSkeletons.tsx), [detail skeleton](../src/components/ui/BrowseDetailSkeleton.tsx) | Loading layouts |
| [LocationStatusBadge](../src/components/ui/LocationStatusBadge.tsx), [status engine](../src/lib/timing/locationStatus.ts) | Facility opening-status calculation and display |
| [Public paths](../src/lib/publicPaths.ts), [booking status](../src/lib/publicBooking.ts) | Consistent routes and booking-eligibility interpretation |
| [Location detection](../src/lib/geo/locationDetector.ts), [map normalization](../src/lib/geo/googleMapsEmbed.ts) | Approximate location/ranking context and safe map input |
| [Public profile reader](../src/lib/publicProfile.ts), [SEO utilities](../src/lib/publicSeo.ts) | Server profile reads and public metadata |
| [Location management](../src/components/organization/LocationManagement.tsx) | Owner-editable source details, maps and publication |
| [Backend public routes](../../backend/routes/public.ts), [controllers](../../backend/controllers/public.ts), [public DTOs](../../backend/types/publicDtos.ts) | Public API contracts, visibility and selected fields |

## 13. Map configuration and verification

The default raster endpoint is https://tile.openstreetmap.org/{z}/{x}/{y}.png. Deployment can supply NEXT_PUBLIC_MAP_TILE_URL and a plain-text NEXT_PUBLIC_MAP_TILE_CREDIT at build time for another suitable raster provider. Keep visible attribution, provider caching and referrer requirements. Default OSM tiles are a best-effort external service, not a purchased map SLA. See [Leaflet documentation](https://leafletjs.com/examples/quick-start/) and the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). The default does not require a map API key.

Owners must save actual facility coordinates in location management. At the 27 October read-only checkpoint, Aarogya Clinic had the zero pair: its address-based directions worked, but it had no map pin. No database coordinates or configuration were changed for screenshots.

The list/map implementation passed 29 fixture browser cases across 320/375/390/768/1024/1440px and light/dark themes, plus focused live-tile and short-screen checks. These cover selection, zoom, area requests, hours filtering, empty/error/unmapped/long/single-result states, layout and Axe checks. Ordinary fixture runs mock raster images; live-tile reviews use the real provider with synthetic facility coordinates. Actual public-page captures use read-only traffic.

Focused frontend coverage includes facility actions, directory orchestration, mobile navigation and booking-entry preservation. Backend coverage checks specialty/bounds/hours filtering before cursor pagination, published visibility, missing hours, timezone and overnight behavior. Package type checks and a controlled production build verify integration. These are scoped checks, not a replacement for release gates or accessibility certification.

- Current evidence: [Connected results](landing-page/connected/browse/connected-results.json).
- Directory actual data: [desktop](landing-page/connected/browse/connected-directory-actual-1440.png), [phone](landing-page/connected/browse/connected-directory-actual-390.png).
- Map layout with isolated synthetic facilities and live map tiles: [desktop](landing-page/connected/browse/connected-directory-map-1440.png), [phone](landing-page/connected/browse/connected-directory-map-390.png).
- Facility page, unchanged by this redesign: [desktop](landing-page/connected/browse/connected-facility-actual-1440.png), [phone](landing-page/connected/browse/connected-facility-actual-390.png).
- Browser review: [List/map checks](../scripts/performance/review-browse-directory.mjs).
- Frontend tests: [cards](../src/tests/browseLocationCard.test.tsx), [directory](../src/tests/browseAndMobilePolish.test.tsx), [doctor/detail/booking](../src/tests/browseDoctorDetail.test.tsx).
- Backend tests: [catalogue](../../backend/tests/publicLocationCatalog.test.ts), [filters](../../backend/tests/publicBrowseFilters.test.ts).
- Check selection: [Verification workflow](verification-workflow.md). Related rationale: [Interaction patterns](interaction-patterns.md).

Review multiple facilities, one result, long/missing content, keyboard focus, narrow/short phones and both themes. Check that ordinary filter changes clear map bounds, pagination keeps its area, unmapped facilities remain reachable, and facility opening status never promises appointment availability. No real appointment, payment, patient record or organization configuration was changed by the reviews.
