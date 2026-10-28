# Interaction patterns

Use the shared `Modal` and `Button` components for application tasks.

Use the existing Next App Router layouts, shared controls, Zustand workspace
stores, Axios client and TanStack Query consumers. Keep one light/dark Ekavyu
identity; browser translation handles other languages while doctor language and
queue voice settings retain their separate purposes. See
[visual identity](design-system.md#brand-assets-and-print-appearance) for tokens and asset regeneration.

Dashboard navigation stays off-canvas below 1024px. Shared controls and table
cards use mobile behavior through 767px, with readable input text and touch
targets. Mobile table views retain sorting, filtering, selection and secondary
details. Clamp pagination after dataset changes and keep compact phone controls.
Use the existing focus, popover-position and scroll-lock helpers for nested
overlays; keyboard focus, Escape and trigger restoration belong to the active
overlay. Native Select validation remains available. DatePicker emits one string value
per change; range callbacks return their structured date range.

Distinguish failed initial reads from successful empty results. Preserve loaded
rows during background refresh and expose local retry controls. Patient, catalog,
organization and radiology reads use `useLatestRead` to cancel obsolete requests
and reject late results; commit query/page state together and retain the existing
300ms catalog debounce. Do not cancel or automatically replay writes. Keep Table
row actions usable during refresh and use skeletons only before initial data.
Technical-message filtering belongs to presentation; preserve transport errors
and meaningful domain validation messages.

Use `LoadingState` for a full-width content region; supply skeleton children when
the layout is known and let its default spinner center an unknown body. Keep
`InlineLoader` for a small field or update, and Button feedback for the initiating
action. Expose one named progress status per region, keep decorative shapes out
of the accessibility tree, and use semantic dimensions or responsive utilities
for `Skeleton`. A required organization selection should show a selection prompt,
not a permanent loader. See [the page loading audit](interaction-patterns.md#loading-and-read-recovery).

Use native Next Link pending state and the delayed route indicator; programmatic
navigation retains framework loading fallbacks. Button keeps idle content as its
size reference during processing. Respect reduced motion and keep clinical,
payment and permission behavior in the existing domain code. Profile actual
routes before adding virtualization, cache layers or pagination contracts.

Theme controls act as one button: clicking either icon or anywhere on the track toggles the theme. The accessible label names the next mode. Respect reduced-motion preferences during theme changes.

In authenticated workspaces, appearance belongs in the account menu beside profile/settings on desktop and mobile. In mobile Browse navigation, use a labelled Appearance row that shows the current mode and next action. Signed-out desktop visitors use a labelled Appearance menu. Keep the header focused on navigation, notifications, and the account; standalone authentication and kiosk screens can retain their existing theme control.

Use `useSwipeGesture` only where the surface implies a gesture: swipe left to close the left navigation drawer, swipe up from the mobile Browse menu header to close it, drag down from the booking sheet handle, swipe photos horizontally in the gallery, and swipe transient messages to dismiss them. Short drags return to rest. Sheets cannot be dragged closed during submission. Leave ordinary dialogs, confirmations, AI conversation, medical image tools, and forms on their explicit controls. Preserve close buttons, Escape, gallery arrows, keyboard navigation, and native browser back/edge gestures. Gestures ignore controls, nested horizontal scrollers, cancelled touches, and multi-touch. Horizontal lists keep native touch scrolling instead of changing tabs as the user swipes; chart inspection must allow vertical page scrolling and pinch zoom.

Transient notifications sit top-center below the visible application header on every device, with safe-area and visual-viewport clearance. Cards use their natural height, and multiple messages have an explicit touch/keyboard expansion control. Pause dismissal while messages are focused, hovered, expanded, hidden behind newer messages, or the browser tab is inactive. The notification centre remains a compact preview with an internally scrolling list and a separate full inbox route.

Order the existing permission-filtered navigation by role and daily workflow. Keep clinical work, diagnostics, finance, administration, reporting, and account utilities grouped; place notifications with secondary utilities. Apply the same priorities to mobile shortcuts without creating separate role-specific sidebars.

After booking or opening a private tracker, show one contextual Live tracker link in the marketplace header. Preserve its capability in the existing browser session storage, scope the shortcut to the current account, and remove the shortcut on expiry, logout, or a terminal appointment state. Retain completed tracker capabilities for receipts and prescriptions. This recovery path survives closing the booking ticket or tracker tab while the application session remains; after the entire browser session ends, use the original private booking link.

| Surface | Use it for | Behavior |
| --- | --- | --- |
| Dialog | A focused task: MFA, confirmation, configuration, booking, a short form, a detail preview, notifications, or AI conversation | Centered with viewport margins, bounded height, an internally scrolling body, and fixed header/actions. Notifications use top-center placement on every device. |
| Drawer | Navigation or supplementary tools that need the current workspace as a reference | Lock background scrolling and interaction while modal. Use the shared overlay focus hook and restore focus/scroll on close. |
| Bottom sheet | Mobile booking, a deliberately chosen mobile selection, or a short contextual action | Opt in with `presentation="sheet"`; it must not be the default for every dialog. Booking retains its previous full-width mobile panel with rounded top corners, bounded height, and safe-area clearance; desktop stays centered. |
| Full page | Long, independently navigable work such as an encounter, complex editing, or a records workspace | Use a route with normal page scrolling. Immersive image viewers can occupy the viewport. |

`Modal` observes the visual viewport so the keyboard cannot cover its actions. Pass primary actions through `footer`; connect form submission with `form="form-id"`. Choose a width for the content, not an arbitrary mobile full-screen override. Use `busy` during submission to prevent closing, and let the initiating button supply feedback. Reserve `loading` for fetching an entire unknown body. Do not combine a modal loading overlay, a form spinner, and a loading submit button.

Buttons use `loading` for form submissions or external state and automatically track promises returned by `onClick`. Return or await an async operation from click handlers. Mutation libraries whose `mutate` method returns void need explicit `loading` for that action's pending state. Keep errors in the initiating feature. Preserve normal action text; use `loadingText` for a short progress label. Prefer `icon`/`iconRight` for decorative icons. Icon-only controls need an accessible label. Cancellation, tabs, navigation, and other synchronous controls do not show loaders merely because a different action is pending.

Browse initially server-renders rating order, with unrated entries last. When valid location coordinates are available, the client can use nearest-first ordering; otherwise it retains Top rated. Sorting changes order, while city and specialty change membership. Keep sort separate from specialty choices; phones put city and specialty in Filters without a duplicate applied-filter row. Directory metadata remains available during filtered/empty results; successful refreshes replace data, failed refreshes preserve the previous cards. Missing data must be labeled honestly rather than presented as free fees or available doctors. The [Browse-page handoff](browse-pages-handoff.md) describes the current page structures and booking journey.

Directory cards represent physical healthcare locations. Search and specialty filters query the existing public directory API and return matching facilities. Doctor evaluation and authoritative appointment availability remain on the facility and doctor pages.

### Browse List/Map presentation, 27 October 2026

The supplied four-board reference now governs the directory. It supersedes the reception hero, specialty chips and multi-column grid. The shared header accepts a directory-only search slot: keyword/city/Search on desktop, with keyword/icon Search below the identity/account row on phones. The directory List frame is 1320px, while Map and facility-detail frames use a 1600px upper limit. Existing brand assets, theme tokens and account behavior remain in use.

List uses compact horizontal facility rows with a 56px contained logo/initial and name, opening status, specialty, address and phone. A divided action column has Book/View and Directions. Phones use 48px logos and stacked actions; compact map rows use 44px logos and side-by-side actions. No cover/gallery photos, clinician identities, fees, or extra feedback rows appear in directory results. Doctor evaluation and authoritative availability remain on the detail pages.

Desktop List has a specialty/opening-hours filter sidebar. Real specialty counts represent distinct public facilities. Filters becomes a shared sheet below 900px and in Map view. Multi-specialty, open-now, 24-hour and map-bounds constraints are applied by the public API before sorting and cursor pagination. Unknown hours remain unknown. No favorites or duplicate applied-filter row is added.

Desktop Map puts numbered rows left and a sticky Leaflet map right. Mobile shows a full remaining-viewport map below header/filter controls, a selected summary, and floating List/Map controls. Pins use valid saved coordinates only; the zero pair is unmapped. Selection, zoom, keyboard controls, optional user-location centering, area search, error recovery and additional-page loading are functional. Changing ordinary filters clears the area constraint. Map code/tiles load only on demand, with visible attribution; the drawn reference map is not used as a real basemap.

Details, API contracts, configuration, source files and verification scopes are in the [Browse-page handoff](browse-pages-handoff.md). The former illustrative reception assets and header component were removed because the directory no longer uses them. Earlier directory evidence is historical; current List/Map evidence is recorded separately in [connected results](landing-page/connected/browse/connected-results.json).

### Facility detail presentation, 25 October 2026

The facility detail uses one desktop grid: the doctor list on the left, and one combined facility-information panel on the right. The standalone full-width banner is removed. The information panel starts with the actual logo/name over the saved, faded cover, with opening status and Share in the top-right corner; city and the saved hours summary follow. Description, full address, native phone/email links and copy actions continue directly below, without About headings or Plan your visit tabs. Below 900px, the facility panel precedes doctors in both DOM and visual order. Existing themes, controls, readable doctor profiles, qualifications, fee types, queue/closure states, search, specialty filters, show-all and authoritative booking callbacks are preserved.

Weekly opening hours use a native expandable section. Facilities & photos appears only for saved amenities or gallery images; thumbnails are limited to six and still open the existing complete lightbox. Parent affiliation retains the multiple-location rule. Saved validated Google Maps embeds remain lazy and 210px high, after contacts; without one, a single Directions action sits beside the address. No decorative map placeholder or duplicate directions action is shown. WhatsApp inquiry and public-link sharing are preserved. Missing descriptions, contacts, images and doctors have existing fallbacks. No map SDK, external dependency or data contract was added.

Native GET search remains in the desktop navbar, with the focus-managed phone search sheet. Queries go to `/browse?search=…` and take precedence over saved discovery state. The integrated panel uses a 72px logo (64px on phones), a compact title and metadata, with no full-width hero above the grid. Doctor identity, fee and booking action retain their aligned responsive rows. The loading skeleton follows the same panel-first phone order and shared desktop column ratios. Map editing continues to accept only the restricted copied Google embed HTML/URL contract, with no arbitrary HTML or server-side fetching.

Verification for the integrated panel: all 16 focused doctor/profile/booking cases pass and scoped lint has zero errors. The latest `facilityIntegratedPanel` checkpoint in [paired review evidence](landing-page/connected/browse/connected-results.json) covers 52 passing rendered layout, navigation, disclosure/gallery/copy, booking and missing/long-data checks from 320px through 1920px, including both themes. It verifies the hero stays inside the sidebar, doctors stay left on desktop, information precedes doctors on phones, controls remain at least 44px, and information tabs are absent. The map frame is mocked, so live provider content is not verified. Image-backed text contrast remains incomplete in Axe; this is not accessibility certification. Actual Aarogya captures use GET-only traffic. Current [desktop](landing-page/connected/browse/connected-facility-actual-1440.png) and [phone](landing-page/connected/browse/connected-facility-actual-390.png) show the combined panel.

The directory and facility now share [MarketplaceLayout.module.css](../src/components/MarketplaceLayout.module.css): a 1600px content limit, 32px desktop / 16px phone gutters, the same surface background and a 64px navbar offset. The header uses the same mark size, wordmark, theme and authentication treatment in both views, including loading/error states. The clinic retains its contextual navbar search. Below 400px, Sign In remains the primary authentication action and Sign Up remains accessible from sign-in, leaving space for search and a contextual tracker shortcut. The facility banner, doctor/information panels and section headings use tighter spacing, a 16px gap and matching edge alignment. The loading skeleton shares the same frame and header rather than introducing a narrower layout while waiting.

The shared layout retains these details across directory and facility views:

| Detail | Refinement implemented |
| --- | --- |
| Cards and controls | Shared 16px panel / 12px control radii, primary foreground and outlined-action border tokens; matching title hover treatment. Narrow cards use container sizing to keep both actions on one line without reducing text size. |
| Opening status | The same 11px, minimum-24px badge treatment on cards and the facility header. Missing hours explicitly show Hours unavailable. |
| Logo frames | Images and failed-image fallbacks stay inside the frame's content box; facility frames use consistent 12px corners. |
| Header loading | Checking account replaces the incorrect Signing out message during initial load. Sign-in/sign-up slots and the theme-control frame reserve their final dimensions. |
| Breadcrumbs | One row on phones, with the city crumb deferred and the current name truncated visually. The full facility name remains in the page heading and accessibility text. |
| Maps and directions | Saved, validated embeds remain supported. Without one, show one address-level Directions action, with no empty map panel. |
| Doctor and gallery copy | Find next date replaces long schedule labels; queue/closure microcopy uses plain language. Photos and View all photos replace showcase/campus wording. Booking still calls the existing authoritative flow. |
| Fixed booking action | The named booking region uses the same responsive gutters as page content and a 44px button at tablet widths. |
| Loading layout | Skeletons share the loaded detail column ratios/breakpoints, panel corners and inner padding through the common marketplace layout module. |

The earlier 47-test/type-check checkpoint and 69 navigation/state observations in the consolidated report describe the preceding detail pass. The integrated-panel verification above supersedes its facility layout screenshots and tab interactions; current directory checks remain separate. Both fixture and public captures avoid live appointment or database writes.

Booking retains one overlay through date selection, patient details, submission, and the saved token: the previous bottom panel on mobile and a centered dialog on desktop. Cached/local schedules are previews; the server confirms availability before Continue is enabled. Cancel superseded requests when dates/doctors change. Keep one submission indicator on Confirm, disable competing edits, and retain the form if submission fails. Longer content scrolls naturally; actions remain outside the scroll area. Lock background scrolling until the panel has fully closed and restore the page's scroll position.

Clinical AI follows the backend's clinical permissions. Staff use authenticated organization membership. A root user can explicitly choose a location; the location ID is sent to every chat operation for server-side authorization and organization resolution. Do not infer access from a browser tenant header or silently select an arbitrary organization. Clear conversation state and cancel pending reads when account/organization/location changes. Missing context, access denial, and connection failures have local, contextual recovery rather than raw technical messages or repeated session-creation requests.

Print actions use `PrintButton`, with a printer icon and consistent Print/Preview wording. Pass `PrintDialogActions` through `Modal.footer` so actions stay outside the scrolling preview. Use `printElement` for an isolated screen document and `printHtml` for an existing HTML template or authenticated server document. Both share `printWhenReady`, the fixed paper palette, readiness errors, cleanup, and focus restoration. Async preparation uses one loading indicator on its initiating action and prevents repeated clicks; opening an existing local preview does not show a fake loader. Default to A4, retaining existing 58/80mm thermal choices and preprinted letterhead offsets. Printer and PDF selection belongs to the native device dialog. Do not print the entire dashboard, silently ignore missing documents, add auto-print scripts to templates, or install component-level global `@page` rules. See [the printing audit](interaction-patterns.md#printing-lifecycle).

Install assets are generated from the transparent SVG master in `assets/brand` by `npm run brand:assets`. Canonical 192/512px application icons and the 180px Apple touch icon render that vector onto an OS icon canvas; maskable artwork fits the central safe circle. The website mark is a transparent SVG under `public/brand`, with no background tile in either theme. Version asset URLs and the service-worker cache when changing artwork; use the current Ekavyu manifest ID. Existing OS-managed shortcuts may require a manifest refresh or reinstallation after deployment; browser cache deletion cannot directly replace a launcher-managed icon.

## Loading and read recovery

### Changes

- `LoadingState` occupies its content region, centers an unknown-layout loader,
  and accepts decorative skeletons for a known layout. Each region exposes one
  named progress status. Button and inline feedback retain their compact sizing.
- `Skeleton` respects utility dimensions and responsive sizes instead of applying
  overriding inline defaults. Shapes fit their parent, and mobile groups wrap.
- Tables distinguish initial reads from updates, retain loaded rows during
  updates and announce progress. Cards and dialogs avoid duplicate progress
  announcements while retaining their existing busy and focus behavior.
- Organizations use directory/form skeletons on first read. Successful empty
  results, initial failures and pending/failed refreshes have separate states.
  Account changes hide the previous directory and reject superseded responses.
- Notification, AI and WhatsApp settings request organization selection when
  Root has no organization selected. This is a user choice, not a pending read.
- Clinical, operational and finance summary cards use their loading state before
  a read completes, rather than presenting initialized zeroes as known results.
- Medical records wait for both reads and expose retry on failure rather than
  converting failures into empty clinical notes or invoices. Retry preserves the
  approved patient scope, successful sections remain available when another read
  fails, and cancelled patient reads cannot commit late data.
- Directory setup requests, organization subsections, timelines, invoice panels,
  booking entry and appointment dialogs use suitably sized loading regions.

## Reuse and time contracts

### Existing architecture

Consumers use `src/components/ui` exports. Shared UI primitives import their
peers directly to avoid an import cycle through their own barrel. The shared dialog is `Modal`
(not a component named Dialog); confirmations use `ConfirmDialog`. Controls are
`Input`, `Textarea`, `Select`, `DatePicker`, `Checkbox`, `Toggle` and `Button`.
Tables, pagination, alerts, loading/empty states, charts and toasts already exist.
`controlStyles.ts` and semantic tokens in `globals.css` own control appearance.
Layout and appearance conventions are documented in [the design system](design-system.md).

Reuse `cn`, `formatCurrency`, `localDateKey`, branch-aware `locationTime`,
`userFacingError`, patient presentation helpers, `useLatestRead`, `useToast`,
overlay focus/scroll helpers and shared printing utilities. Calendar dates,
browser-local time, branch-local time and UTC are distinct contracts: do not
replace one with another solely to shorten code.

## Mobile workflow composition

### Findings implemented

| Evidence in the existing UI | Change |
| --- | --- |
| Header combined a logo, workspace selector, notifications, and account controls in one nonshrinking row. At 320px their combined minimum widths exceeded the viewport. Location switching was available only inside the drawer on mobile. | Workspace and location controls share a dedicated, flexible row on small screens. Desktop keeps them in the header. Account controls and the navigation drawer remain reachable. |
| Queue settings and a 200px traffic chart preceded the patient list. Four explanatory statistic cards consumed two tall rows. | Keep walk-in, call next, refresh, OPD status, and session actions visible. Put availability, announcements, QR printing, and documents in a named disclosure. Collapse traffic analytics. Present all four queue counts in a compact definition list. |
| Active and parked queue cards combined default outer padding with a second padded content block. Recorded vitals were placed in an unwrappable inline row. | Use one layer of card padding and wrap vitals without removing any values, risk flags, or escalation actions. |
| Patient lookup was preceded by a repeated EMR badge, introductory copy, and four directory statistics. Search inputs in flex rows still requested their parent's full width beside a button. Patient cards truncated names and compressed them beside identifiers. | Prioritize registration and lookup, make directory statistics expandable, and let search fields shrink beside their actions. Remove nested list padding, wrap identity/contact details, and enlarge contact targets. No search, pagination, matching, or duplicate handling changes. |
| Appointment view switching occupied its own padded card, and server pagination used a long paragraph beside two actions. | Use a compact view switch with selected-state semantics, a full-width search field, and a concise results/page summary beside paging controls. Retain the explanation of page-scoped counts and exports. |
| Billing, appointments, and pharmacy wrapped the table in an additional padded card. Some screens stacked three or four summary cards vertically. | Remove the extra padding around table content. Use two-column mobile summaries with comfortable gaps; the third card spans the row where appropriate. |
| Shared statistic labels and values were truncated. Decorative icons competed with financial amounts in narrow cards. Loading placeholders could exceed their available width. | Allow complete labels and amounts to wrap, omit decorative icons on phones, and bound loading placeholders. Values are never rounded or abbreviated. |
| Tables forced search and utility buttons into separate mobile rows and rendered an empty control strip for closed column filters. Generic mobile rows could overflow with long labels or fixed-width cell content. | Let search and utility controls share a row when space permits, omit the empty strip, constrain mobile label/value columns, and retain filtering, sorting, row selection, and secondary details. Match both paging targets at 44px on phones. |
| Consultation tab labels consumed several screen widths; the workspace added padding inside the dashboard shell. Patient identity and allergy badges could truncate or overflow. | Shorten tab names, retain order counts as badges, remove redundant mobile workspace padding, wrap patient names/identifiers/allergies, and use a touch-oriented patient-search label. Keep all clinical alerts visible. |
| Portal names and email addresses could overflow. Long tab labels pushed records and family actions farther offscreen. | Wrap identity/contact text, provide shorter recognizable tabs, and keep the existing family-role filtering and booking behavior. |
| An install prompt took over 100px of the phone viewport and overlapped useful content. | Use a compact mobile prompt with the same install and dismiss behavior. Desktop retains the explanatory text and brand icon. |
| Many dashboard pages reserved 128px at the bottom in addition to the shell's own 128px. | Let the shell reserve safe-area-aware space for the existing mobile navigation and floating assistant; reduce redundant page-level spacing. Tablet content no longer reserves space for a navigation bar that is hidden there. |
| CRM workflow links had inconsistent, short touch targets. | Give the existing workflow links a consistent 44px target without introducing a second navigation system. |

## Printing lifecycle

Every existing frontend print surface uses `PrintButton` or `PrintDialogActions`. Local previews keep their existing workflow. Final printing uses the shared `printBrand.ts` infrastructure, an isolated iframe, the fixed paper palette, and the device's native print dialog.

| Existing surface | Entry and preview | Existing layout choices |
| --- | --- | --- |
| Browse booking confirmation | Print token slip stays in the booking panel's fixed footer | A4 token template |
| Staff check-in kiosk | Print token slip beside the completed check-in actions | Existing token template |
| Dashboard appointments | Token confirmation and prescription preview use fixed print footers | Existing token and prescription templates |
| Patient bills | Preview receipt from the invoice row or mobile card; print from its fixed footer | Existing receipt template |
| Billing | Preview invoice/receipt from rows, menus, or cards; print in the preview footer | Existing invoice and receipt templates |
| Cashier reconciliation | Print daily report is disabled until a report has been generated | Existing shift report layout |
| Laboratory | Preview verified report from existing order actions; print in its footer | Existing diagnostic report layout |
| Queue | Existing prescription/token preview actions use the shared print control | Unified documents and thermal slip preview |
| SOAP note editor | Unsaved notes retain their local preview; saved prescriptions use the authenticated server endpoint | Existing clinical prescription rendering |
| Unified clinical documents | Fixed Print/Close footer for prescription, invoice, report, discharge summary, certificate, referral, and token documents | Plain A4 or preprinted clinic pad with the existing 65mm offset |
| Thermal token slip | Print stays disabled while its QR code loads; failed codes offer retry | 58mm and 80mm paper controls stay available above the preview |
| Location QR poster | Existing preview, Copy join link, and fixed Print/Close actions | Existing A4 poster layout |
| ABDM standee | Print poster beside its existing scan/share actions | Existing A4 standee |
| Patient tracker | Fetch the private prescription through its existing capability and print using the shared lifecycle | Existing server prescription rendering |

Use explicit document names on entries. In an already-labelled preview, the visible final action is simply Print; its accessible label still names the document. The printer icon changes to one loading indicator while preparing, the button width remains stable, and unrelated actions remain available. Printing does not claim that a job succeeded: the native dialog may be cancelled.

Preparation waits for required images, styles, and fonts. A stalled or failed asset ends preparation with a contextual retry message instead of producing a partial document. Missing documents, unavailable printing, permission failures, and unavailable server documents have shared user-facing messages. Internal server wording is not shown.

Retain the isolated frame until afterprint, with a fallback cleanup for mobile engines that omit the event. Restore focus after cleanup. Existing HTML templates keep their content and layout; legacy scripts and inline event handlers are removed before printing so one action cannot open competing print dialogs. There are no frontend print popups or separate template auto-print scripts.
