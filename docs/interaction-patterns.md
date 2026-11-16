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

Account-entry pages share [AuthPageShell](../src/components/auth/AuthPageShell.tsx). Above 900px, a forest brand panel sits beside a centered form; smaller screens show the compact real Ekavyu logo above the form. Login, registration, password recovery/reset, email verification, staff invitations, pharmacy signup and the public organization-setup request reuse this frame, including theme and Browse navigation. Registration and business setup can use the wider form area. Loading states retain the same frame.

The auth reference informs composition only: keep the established theme tokens, logo, shared Card/Input/Select/DatePicker/Button controls and keyboard-accessible Tabs. Use the larger field sizes for account entry. Staff password sign-in is the primary action, followed by passkey sign-in. Preserve OTP delivery/error states, resend timing, country handling, MFA, workspace selection, redirects, invitation tokens and recoverable pharmacy setup; the layout does not change authentication or provisioning policy. Preview-only screen switches from design references do not belong in the application.

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

### Public discovery and booking

The [Browse-page handoff](browse-pages-handoff.md) owns the directory, facility and doctor layout, API contracts, booking rules and responsive behavior. The [connected public-page review](public-pages-review.md) records current account navigation, loading, recovery, screenshots and verification. Superseded grid, integrated-panel and overlay screenshots have been removed.

The directory uses a search card, shared filters and compact facility rows. Map view loads Leaflet on demand and shows only valid saved coordinates, with visible attribution. Facility opening hours and booking availability are distinct. Facility pages use a header/contact strip, doctor list and location panel; doctor pages share the date/details booking flow. System sans-serif, shared controls, theme tokens and public navigation stay consistent across the loaded, loading and unavailable states.

Booking previews must be verified against server availability. Cancel superseded reads when dates, doctors or practices change. Keep one submission indicator, disable competing edits, and retain entered details if submission fails. The doctor route uses inline date/details booking; facility entry retains the shared booking controller. See the handoff for exact state transitions and permissions.

Clinical AI follows the backend's clinical permissions. Staff use authenticated organization membership. A root user can explicitly choose a location; the location ID is sent to every chat operation for server-side authorization and organization resolution. Do not infer access from a browser tenant header or silently select an arbitrary organization. Clear conversation state and cancel pending reads when account/organization/location changes. Missing context, access denial, and connection failures have local, contextual recovery rather than raw technical messages or repeated session-creation requests.

Print actions use `PrintButton`, with a printer icon and consistent Print/Preview wording. Pass `PrintDialogActions` through `Modal.footer` so actions stay outside the scrolling preview. Use `printElement` for an isolated screen document and `printHtml` for an existing HTML template or authenticated server document. Both share `printWhenReady`, the fixed paper palette, readiness errors, cleanup, and focus restoration. Async preparation uses one loading indicator on its initiating action and prevents repeated clicks; opening an existing local preview does not show a fake loader. Default to A4, retaining existing 58/80mm thermal choices and preprinted letterhead offsets. Printer and PDF selection belongs to the native device dialog. Do not print the entire dashboard, silently ignore missing documents, add auto-print scripts to templates, or install component-level global `@page` rules. See [the printing audit](interaction-patterns.md#printing-lifecycle).

Install assets are copied unchanged from the supplied monochrome kit in `assets/brand/icons` by `npm run brand:assets`. Canonical 192/512px application icons and the 180px Apple touch icon use the supplied black-on-white artwork; the separate maskable export preserves its safe area. Website symbol/wordmark vectors under `public/brand` use the supplied black/white variants without background tiles. Version asset URLs and the service-worker cache when changing artwork; use the current Ekavyu manifest ID. Existing OS-managed shortcuts may require a manifest refresh or reinstallation after deployment; browser cache deletion cannot directly replace a launcher-managed icon.

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
