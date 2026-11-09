# Ekavyu Browse pages — product and engineering handoff

Directory, facility and doctor presentation updated against the repository on **9 November 2026**; booking policy retains its **27 October 2026** review. This document describes the current implementation. It is a guide for explaining, maintaining, designing, or reviewing these pages; it is not a proposal for a new design.

The 9 November typography pass uses the existing system sans-serif throughout these pages: restrained semibold headings, plain labels, consistent fee figures and subtle card shadows. Decorative serif fonts, heavy black weights and wide uppercase booking labels are removed. Titles remain readable at phone widths; date targets use 64px minimum widths so their labels do not crowd. Responsive layouts and booking behavior are preserved.

Typography verification: all 32 synthetic browser review cases passed, covering phone and desktop layouts, light/dark themes, booking details, missing or long content, availability states and short screens. Desktop and phone screenshots were visually inspected. Changed-file ESLint reported no errors and the same five existing hook warnings; the diff passed whitespace checks. No booking logic changed in this pass.

### Final UI review: weak points and corrections

The second 8 November review found problems that a page-overflow check alone did not catch:

| Weak point | Current correction |
| --- | --- |
| Clipped quick filters and sort text at 320px; crowded desktop toolbar | Three filters share a responsive grid. Phone results and controls occupy separate rows. One Map/List action works at every width. |
| Phone/email text squeezed beside copy buttons; empty columns when data is missing | Fact columns fit supplied content, copy buttons have separate space, and contacts use full rows below 360px. |
| Fixed booking bar covering a visible doctor card | The bar starts hidden and appears only after the doctor card leaves the usable viewport. Current geometry avoids stale observer entries; facility/doctor changes reset the observer. |
| Oversized breadcrumbs, missing-field gaps and fragile share-button styling | Breadcrumb labels truncate within their own slots, supplied facts fill the available grid, and Share uses the shared component's explicit icon-only option. |
| Doctor profile rounding a fractional fee differently from booking | Both use `publicConsultationFee`; free, unspecified and post-consultation fees keep distinct meanings and fractional amounts are preserved. |
| Tiny date badges and incomplete date context | Date targets have a 64px minimum width, readable badges and complete accessible dates including year. |
| Long booking forms leaving controls off short desktop screens | Header and footer stay in the bounded panel while its body scrolls. Input icons cannot bleed into the footer, focused fields stay visible, and Change Slot uses the shared 44px Button. |

Verification includes 91 focused Vitest cases, TypeScript, changed-file ESLint, responsive light/dark browser checks and targeted 520px-high booking-form checks. The latter exercise input focus and button hit testing as well as screenshot/layout inspection. Checks use isolated synthetic data; no local live backend was running for an actual-data review. Five existing hook warnings in `BrowseDetailClient` remain separate technical debt. Full release gates remain in CI.

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

## 4. /browse: facility discovery

The directory layout was updated on **31 October 2026** from the supplied search/list/map and mobile-filter references. It uses the shared Navbar, Button appearance utility, Card, Input, Select, Checkbox, Modal and location-status engine. Custom CSS is limited to responsive composition and map presentation.

The consistency pass reuses MarketplaceLayout.content for header-aligned gutters and widths, CardTitle for facility headings, fieldLabel for filter section labels, and the status component's existing pill appearance. Shared typography utilities replace page-specific title and caption scales. The search container uses Card, the ordinary page surface matches the other public pages, and action links use the shared compact Button size.

### Header and search

The fixed 64px public header keeps the real Ekavyu identity, account/appearance actions and links to existing patient/provider destinations. A full-width search card sits on the warm page surface in ordinary document flow. Its page heading remains available to screen readers without a large visual banner. Keyword search, city and Search share one field group; phones put keyword above city and submit. Enter/Search submits immediately; typing remains debounced by 300ms.

The visible result count describes loaded facilities, using “shown” while another cursor exists. It is not an invented catalogue total. Approximate detected locations are labelled. Use precise location explicitly requests browser geolocation; denial leaves city search usable.

### Filters and API behavior

| Control | Actual behavior |
| --- | --- |
| Facility type | Multiple saved classifications, matched with OR semantics; no name-based clinic inference. Facet counts come from the full public catalogue. |
| Specialty | Multiple supplied specialties, matched with OR semantics; real catalogue counts. |
| Online booking | Server requires eligible organization booking access and an active public doctor assignment. It does not promise a slot. |
| Open now / Open 24 hours | Saved facility hours and timezone, evaluated before pagination. Unknown hours never match. |
| Distance | Any distance by default; 1–50 km can be selected once a usable location is available. This is straight-line distance, not driving distance. Unmapped facilities do not match a radius. |
| City / keyword | Existing public facility/clinician search. |
| Search this area | Explicit map-bounds request; panning/zooming alone never requests directory data. |
| Clear / applied filters | Clear all or remove an individual constraint. Ordinary filter changes clear old map bounds. |
| Sort / pagination | Nearby, rating and minimum-fee ordering remain server-wide before pagination; requests retain the entire filter context. |

The grouped desktop sidebar uses collapsible sections. On phones, quick buttons expose Filters, Open now and Online booking. The existing sheet provides city, all filter groups, a distance slider, Clear all and Show results. Filters apply live; Show results closes the sheet. It does not fabricate a total beyond the loaded page.

Distance starts unrestricted so an approximate city or absent facility coordinates cannot silently hide real facilities. A small, nonempty filtered result set offers widening to 50 km only when a smaller radius is actually active, or resetting to all facilities. The unfiltered catalogue does not offer a redundant reset. A selected city does not become an invented coordinate.

### Facility-card structure

1. A fixed, contained 44px logo or real-name initials, the saved facility name and up to two specialties. The opening-status chip wraps alongside the title.
2. Compact address and phone text below the specialties; calling remains a separate native action.
3. A quiet action band with a full-width Book/View action and compact Directions and Call buttons when supported. The primary action communicates booking access without repeated booking notes. Buttons and links share the existing component appearance.
4. Names and the primary action retain the current public slug and booking entry. Directions use saved coordinates or the real facility name/address. Address text is read-only.

Doctor biographies, fees, email and extended information remain on the detail page. No verified badge, saved/favorite action, invented availability dates, ratings or doctor profiles are added to directory cards. The supplied “Today”, “Next 3 days” and date chips are intentionally absent because the directory API does not provide authoritative appointment availability; that remains in the existing doctor/date booking flow.

### List, map and responsive layout

At 1200px and wider, List view shows the filter sidebar, facility cards and a sticky real map together. Smaller List views avoid downloading map tiles. A desktop Map view gives more width to the map and exposes filters through the sheet. On phones, the floating List/Map group switches between the directory and a map filling the area below the 64px header and compact controls.

The on-demand Leaflet map retains real coordinate pins, selection, zoom, keyboard movement, area search, provider attribution, failure/retry states and unmapped-facility messaging. Desktop selected summaries stay compact; phone map summaries retain navigation actions. Only finite, in-range, non-zero-pair saved coordinates produce pins. No placeholder roads or made-up facility pins are shipped.

### Continuity and recovery

Session storage preserves search, city, types, specialties, booking/hours/distance choices, ordering, view and scroll position. An explicit incoming search takes precedence. Storage or location-provider failure never prevents ordinary browsing.

Existing abort/race protection, cursor deduplication, nearby-sort recovery, loading skeletons, stale-result retry and empty/error/partial-data states remain. This redesign changes public discovery presentation and filters; it does not create appointments, alter booking policy or write organization/patient records.

## 5. `/browse/[slug]`: page structure and behavior

### Overall composition

The facility page shares the directory's navbar, content width, gutters, theme tokens, controls and status treatment. Breadcrumbs return to Browse locations. The shared header keeps Find care, For patients and For providers navigation on desktop and existing account, theme and mobile-menu controls.

A full-width forest header introduces the location, followed by an overlapping contact-summary card. Below 900px, ordinary section links lead to Doctors, Hours, Location and optional About; these are not hidden tab panels.

At 900px and above, the doctor list and About occupy the left column, with a sticky Location card and weekly-hours disclosure on the right. Below 900px, the document order is Doctors, Location and weekly hours, then optional About. A single-doctor booking bar appears below 900px while the booking/ticket surface is closed.

### Facility summary and supporting sections

Read the summary from top to bottom:

1. A forest header with breadcrumbs and a contained logo (88px desktop, 60px mobile), with real-name initials if no logo is available.
2. Actual facility name, city and address. Organization affiliation appears only for a multi-location organization with a different name. The separate contact strip shows Today, Hours, Reception and Email when supplied.
3. Existing booking entry on desktop, plus Call, Directions, WhatsApp and Share where supported by saved contact data. Mobile contact actions form a compact row; the contact strip uses two columns.

Fees and specialties stay with the doctors, the full schedule stays in the weekly-hours disclosure, and booking-mode exceptions stay on the relevant doctor card. The contact strip contains no consultation-fee or appointment-availability promises.

The page does not download the old decorative facility banner. The summary uses the same shared Card, Button, Badge, Breadcrumbs and theme tokens as the rest of Ekavyu.

**Weekly opening hours** groups consecutive days with identical saved schedules and keeps today distinct using the facility timezone. The Hours summary opens the full schedule. Unlisted days say Not listed; they are not asserted to be closed. Split shifts, overnight hours and explicit 24-hour schedules remain supported. Phone and email links open the device's applications; shared buttons copy their saved values with feedback. The opening status appears once under Today; WhatsApp appears once in the identity header. WhatsApp opens an external enquiry, not an in-page chat or a claim that automated notifications were delivered.

**Location** contains the lazily loaded configured map embed, saved address, directions and copy action. Without an embed, it presents the address and supported actions without a large empty map placeholder.

**About** shows supplied facility or applicable organization descriptions. Real amenities/photos remain under Facilities & photos; the existing gallery viewer is preserved. The section and navigation link are omitted when no description, amenities or photos are supplied.

Repeated FAQ and generic visit-instruction content are omitted. The public facility contract has no verification flag or facility-review feed, so there is no invented Verified badge, reviews panel, claim-listing flow or patient-review count.

### Doctor-list structure

The section is labelled **Doctors**, with one short availability instruction when booking is supported and a reception notice when booking is temporarily unavailable. More than eight doctors enables a local name/specialty search; more than one distinct specialty enables a specialty selector. Initially up to 12 doctors are shown; Show all expands the roster. Local roster filtering does not fetch every doctor's availability.

```text
Portrait   Doctor name                     Consultation fee
           Specialty
           Qualifications · Experience
           Rating, when supported
----------------------------------------------------------
Applicable booking context                 [Book / Next date]
```

The doctor card separates identity, fee, booking context and action:

- **Identity header:** portrait/initials, name, specialty, qualifications, experience, and optional supplied feedback. This is a link to the doctor's public profile in the same facility context.
- **Fee and action:** the fee sits beside identity on larger cards and moves to its own row below 480px. A quiet bottom band pairs applicable booking context with the booking button. Ordinary rows do not repeat the section's availability instruction.

The portrait is a fixed 64px circle, reducing to 48px on phones. A missing portrait uses initials from the actual doctor name. Long text wraps rather than being forced over the fee or action. The doctor list uses individual cards without an additional decorative card around the entire list.

Fee display follows the supplied fee type:

| Fee data | Label |
| --- | --- |
| Explicit free consultation | Free |
| Fixed positive fee | Formatted currency amount |
| Post-consultation with a minimum | From [amount] |
| Post-consultation without a positive minimum | Set after consultation |
| Unspecified/nonpositive fixed fee | Ask reception for fee |

The action says Book now for an ordinary bookable context, Find next date when the doctor is unavailable/online booking is closed today, or Contact reception when location booking is unavailable. Opening this action invokes the existing availability/booking flow; the card itself does not establish that a slot is free.

A single-doctor facility also has a sticky fee and Book now / Find next date bar below 900px when booking is allowed, the doctor card has left the usable viewport, and no booking/ticket surface is open. It uses the same doctor, fee and existing booking handler.

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

### Doctor profile presentation

The canonical route remains `/doctor/[slug]?location=[facility-slug]`. It shares the public Ekavyu navigation, system-font headings/fees and elevated cards with the facility page. On desktop, identity, experience/fee/booking facts, About and selected practice appear left of a sticky Book a visit panel. Below 900px, booking follows identity and facts, before About and practices. Practice-specific booking mode comes from the existing public profile contract.

The inline panel keeps the shared two-step booking flow and availability gates. Its date ribbon scrolls without widening the page; queue guidance explains arrival and assignment after booking without speculative token/wait tiles. Time-slot, full-queue, failed-request, guest/family, follow-up and payment recovery remain in the existing flow. Effect cleanup clears the auto-open guard so a canceled initial availability request is rechecked on a Strict Mode remount.

## 7. Data placement and ownership

| Information | Directory | Facility page | Source / editing responsibility |
| --- | --- | --- | --- |
| Facility name/type/city/address | Name/address shown; type informs fallback action | Name, city and full address | Location management |
| Phone | Callable | Callable, copyable; WhatsApp link | Published location contact data |
| Email | Deferred | Email link and copy | Published location contact data |
| Logo | Small, contained | Contained facility/organization fallback | Published branding configuration and effective API response |
| Cover/gallery | Not loaded | Forest identity header and optional photo disclosure | Saved public branding/gallery |
| Facility hours/timezone | Compact status | Status and detailed hours | Saved location/organization context |
| Specialties | Compact supplied summary | Assigned doctors and roster filter | Public clinician/assignment data |
| Doctor qualifications/experience | Deferred | Doctor identity section | Clinician profile |
| Doctor fee and booking mode | Not repeated on facility card | Doctor identity/fee row and booking flow | Selected practice's public configuration |
| Reviews/ratings | Only supported feedback values | Conditional doctor feedback; no review tab | Supplied public feedback; no invented trust/verification badge |
| Maps coordinates/embed | Coordinates inform directions/ranking | Directions and optional saved map | Location management |
| Publication/online booking | Controls discovery and action labels | Controls availability entry points | Backend publication and booking-policy checks |

Owners configure maps under location details using **Map coordinates (optional)** and **Google Maps embed (optional)**. The embed field accepts Google's copied iframe HTML or its supported embed URL. The app extracts and validates the URL; pasted HTML is never rendered directly. A regular short/share link is not an embeddable map. The accepted URL is restricted to HTTPS `www.google.com/maps/embed` with the supported parameters.

These public pages do not edit facility records. Correcting a wrong phone, address, photo, schedule or clinician assignment requires changing the source configuration, not hardcoding the public component.

## 8. APIs and loading boundaries

Paths below include the `/api` prefix; the shared client supplies that prefix when code uses `/public/…` or `/appointments`.

| Request | Role |
| --- | --- |
| `GET /api/public/locations` | Directory results/facets; accepts search, city, repeated specialization, sort, coordinates, cursor, repeated facilityType, onlineBooking, radiusKm (1–50), openNow/open24Hours and bounds=south,west,north,east |
| `GET /api/public/locations/[slug]` | Selected public facility and assigned doctors |
| `GET /api/public/doctors/[slug]/profile?location=[facility-slug]` | Public doctor identity and practice-specific fee/booking configuration |
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
| Directory below 768px | Two-row search below the 64px header, compact cards and floating List/Map switch |
| Desktop Map | Compact left results and pinned right map; no filter sidebar |
| Mobile Map | Full remaining viewport under header/filter controls, summary card and List button |
| Facility below 900px | Forest header, two-column contact strip, section navigation, Doctors, Location/weekly hours and optional About |
| Facility 900px and above | Forest header/contact strip; doctors/About left, sticky Location/weekly hours right |
| Doctor cards | Fee beside identity; applicable context and action in a quiet footer; fee moves below identity under 480px |
| Doctor profile below 900px | Identity and facts, inline booking, About, then practice locations; dates scroll within their ribbon |

The facility and directory frames are capped at 1600px; the doctor frame is capped at 1440px. Side padding is 32px on larger screens and 16px below 768px. All three pages use the existing warm light and charcoal dark surfaces, emerald actions, border tokens and focus-ring tokens. PublicCare.module.css shares the system-font profile headings/fees and 12px elevated cards; getAvatarInitials is a pure utility shared by server profiles and client avatars. Do not introduce separate page palettes.

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
| [FacilityProfile](../src/app/browse/[slug]/FacilityProfile.tsx), [profile CSS](../src/app/browse/[slug]/FacilityProfile.module.css), [hours presentation](../src/app/browse/[slug]/facilityView.ts) | Facility header/contact strip, doctor cards, grouped hours, location and optional About |
| [Doctor page](../src/app/doctor/[slug]/page.tsx), [doctor CSS](../src/app/doctor/[slug]/doctor.module.css), [booking CSS](../src/app/browse/[slug]/BookingPanel.module.css) | Doctor identity, practice context and the shared inline booking flow |
| [Public care styles](../src/components/PublicCare.module.css), [initials utility](../src/lib/avatar.ts), [public fees](../src/lib/publicFees.ts) | Reused profile headings, cards, fact strips, consistent fees and server/client name initials |
| [Facility booking bar](../src/app/browse/[slug]/FacilityBookingBar.tsx) | Contextual phone booking action without covering the doctor card |
| [MarketplaceNavbar](../src/components/MarketplaceNavbar.tsx), [shared layout CSS](../src/components/MarketplaceLayout.module.css) | Shared header, account/search controls, gutters and columns |
| [Directory skeletons](../src/components/ui/LocationCardSkeletons.tsx), [detail skeleton](../src/components/ui/BrowseDetailSkeleton.tsx) | Loading layouts |
| [LocationStatusBadge](../src/components/ui/LocationStatusBadge.tsx), [status engine](../src/lib/timing/locationStatus.ts) | Facility opening-status calculation and display |
| [Public paths](../src/lib/publicPaths.ts), [booking status](../src/lib/publicBooking.ts) | Consistent routes and booking-eligibility interpretation |
| [Location detection](../src/lib/geo/locationDetector.ts), [map normalization](../src/lib/geo/googleMapsEmbed.ts) | Approximate location/ranking context and safe map input |
| [Public profile reader](../src/lib/publicProfile.ts), [SEO utilities](../src/lib/publicSeo.ts) | Server profile reads and public metadata |
| [Location management](../src/components/organization/LocationManagement.tsx) | Owner-editable source details, maps and publication |
| [Backend public routes](../../backend/routes/public.ts), [controllers](../../backend/controllers/public.ts), [public DTOs](../../backend/types/publicDtos.ts) | Public API contracts, visibility and selected fields |

## 13. Map configuration and verification

The **8 November** reference polish passed 28 isolated facility/doctor browser cases at 320/390/768/1024/1440px and in both themes, including long content, missing contacts/doctors, saved-map embeds, unavailable booking, full queues, failed availability and date-to-details transitions. The final directory review passed 15 list/map, selection/zoom/area-search and mobile filter cases; empty/error/unmapped/long-content states were also checked during this pass. These checks use synthetic data and include overflow, action containment, nested-link, browser-error and focused Axe checks. No real booking, patient, payment or configuration writes were made.

Focused Vitest coverage, TypeScript and changed-file ESLint passed (the booking client retains five existing hook warnings). A new Strict Mode regression verifies that inline availability recovers after an effect remount. The reusable local review is [review-public-care.mjs](../scripts/performance/review-public-care.mjs), alongside the existing directory review. Run with the already-installed local Chrome/Playwright/Axe tooling; screenshots and JSON evidence go under `.next/brand-handoff/care-final-polish` and `.next/brand-handoff/browse-final-polish`. Full release gates remain owned by CI.

The default raster endpoint is https://tile.openstreetmap.org/{z}/{x}/{y}.png. Deployment can supply NEXT_PUBLIC_MAP_TILE_URL and a plain-text NEXT_PUBLIC_MAP_TILE_CREDIT at build time for another suitable raster provider. Keep visible attribution, provider caching and referrer requirements. Default OSM tiles are a best-effort external service, not a purchased map SLA. See [Leaflet documentation](https://leafletjs.com/examples/quick-start/) and the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). The default does not require a map API key.

Owners must save actual facility coordinates in location management. The 31 October reference update adds server-backed type, booking-eligibility and radius filtering; it does not add date availability to the directory. At the 27 October read-only checkpoint, Aarogya Clinic had the zero pair: its address-based directions worked, but it had no map pin. No database coordinates or configuration were changed for screenshots.

The earlier list/map implementation passed 29 fixture browser cases across 320/375/390/768/1024/1440px and light/dark themes, plus focused live-tile and short-screen checks. These cover selection, zoom, area requests, hours filtering, empty/error/unmapped/long/single-result states, layout and Axe checks. Ordinary fixture runs mock raster images; live-tile reviews use the real provider with synthetic facility coordinates. Actual public-page captures use read-only traffic.

Focused frontend coverage includes facility actions, directory orchestration, mobile navigation and booking-entry preservation. Backend coverage checks specialty/bounds/hours filtering before cursor pagination, published visibility, missing hours, timezone and overnight behavior. Package type checks and a controlled production build verify integration. These are scoped checks, not a replacement for release gates or accessibility certification.

The **1 November** polish passed 36 focused synthetic browser cases across 320/390/768/1440px and both themes, including list/map selection and filters, empty/error/unmapped/long-content states, facility contacts, gallery, and ordinary/single-doctor booking entry. The final doctor footer was checked for fee/button alignment and containment. Scoped lint, TypeScript, directory/card/detail tests and booking-continuity regressions passed. No appointment or configuration writes were made. The captures linked below predate this polish.

- Earlier directory evidence: [Connected results](landing-page/connected/browse/connected-results.json).
- Directory actual data: [desktop](landing-page/connected/browse/connected-directory-actual-1440.png), [phone](landing-page/connected/browse/connected-directory-actual-390.png).
- Map layout with isolated synthetic facilities and live map tiles: [desktop](landing-page/connected/browse/connected-directory-map-1440.png), [phone](landing-page/connected/browse/connected-directory-map-390.png). The current [mobile filter sheet](landing-page/connected/browse/connected-directory-filters-390.png) uses the same fixture set.
- Facility reference update: [desktop](landing-page/connected/browse/connected-facility-1440.png), [phone](landing-page/connected/browse/connected-facility-390.png). These use isolated synthetic facilities; the configured-map fixture is labelled illustrative.
- Browser review: [List/map checks](../scripts/performance/review-browse-directory.mjs).
- Frontend tests: [cards](../src/tests/browseLocationCard.test.tsx), [directory](../src/tests/browseAndMobilePolish.test.tsx), [doctor/detail/booking](../src/tests/browseDoctorDetail.test.tsx).
- Backend tests: [catalogue](../../backend/tests/publicLocationCatalog.test.ts), [filters](../../backend/tests/publicBrowseFilters.test.ts).
- Check selection: [Verification workflow](verification-workflow.md). Related rationale: [Interaction patterns](interaction-patterns.md).

Review multiple facilities, one result, long/missing content, keyboard focus, narrow/short phones and both themes. Check that ordinary filter changes clear map bounds, pagination keeps its area, unmapped facilities remain reachable, and facility opening status never promises appointment availability. No real appointment, payment, patient record or organization configuration was changed by the reviews.
