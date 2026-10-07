# Interaction patterns

Use the shared `Modal` and `Button` components for application tasks.

Use the existing Next App Router layouts, shared controls, Zustand workspace
stores, Axios client and TanStack Query consumers. Keep one light/dark Ekavyu
identity; browser translation handles other languages while doctor language and
queue voice settings retain their separate purposes. See
[visual identity](ekavyu-visual-identity.md) for tokens and asset regeneration.

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

Browse defaults to rating order, with unrated entries last. “Top rated” is a sort beside the result count: it changes order, while city and specialty change membership. Keep sort separate from specialty chips and active filter badges. Directory metadata remains available during filtered/empty results; successful refreshes replace data, failed refreshes preserve the previous cards. Missing data must be labeled honestly rather than presented as free fees or available doctors.

Booking retains one overlay through date selection, patient details, submission, and the saved token: the previous bottom panel on mobile and a centered dialog on desktop. Cached/local schedules are previews; the server confirms availability before Continue is enabled. Cancel superseded requests when dates/doctors change. Keep one submission indicator on Confirm, disable competing edits, and retain the form if submission fails. Longer content scrolls naturally; actions remain outside the scroll area. Lock background scrolling until the panel has fully closed and restore the page's scroll position.

Clinical AI follows the backend's clinical permissions. Staff use authenticated organization membership. A root user can explicitly choose a location; the location ID is sent to every chat operation for server-side authorization and organization resolution. Do not infer access from a browser tenant header or silently select an arbitrary organization. Clear conversation state and cancel pending reads when account/organization/location changes. Missing context, access denial, and connection failures have local, contextual recovery rather than raw technical messages or repeated session-creation requests.

Print actions use `PrintButton`, with a printer icon and consistent Print/Preview wording. Pass `PrintDialogActions` through `Modal.footer` so actions stay outside the scrolling preview. Use `printElement` for an isolated screen document and `printHtml` for an existing HTML template or authenticated server document. Both share `printWhenReady`, the fixed paper palette, readiness errors, cleanup, and focus restoration. Async preparation uses one loading indicator on its initiating action and prevents repeated clicks; opening an existing local preview does not show a fake loader. Default to A4, retaining existing 58/80mm thermal choices and preprinted letterhead offsets. Printer and PDF selection belongs to the native device dialog. Do not print the entire dashboard, silently ignore missing documents, add auto-print scripts to templates, or install component-level global `@page` rules. See [the printing audit](printing-workflow.md).

Install assets are generated from `public/image.png` by `npm run brand:assets`. Canonical 192/512px application icons and the 180px Apple touch icon are opaque on the brand mist canvas. Maskable artwork fits the central safe circle. Website artwork remains transparent. Version asset URLs and the service-worker cache when changing production artwork; use the current Ekavyu manifest ID. Removed duplicate asset URLs have no redirects. Existing OS-managed shortcuts may require a manifest refresh or reinstallation after deployment; browser cache deletion cannot directly replace a launcher-managed icon.
