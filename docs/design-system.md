# Ekavyu interface system

Current interface rules, with the brand palette and artwork updated on 2026-10-24. The implementation uses Next App Router, Tailwind 4, globals.css and shared React primitives in src/components/ui. Keep one shared control and appearance system.

## Navigation and layout

Public headers and mobile bottom navigation are full-width. The dashboard toolbar stays above its separate content scroller with established spacing and safe areas. Do not introduce inset, floating or rounded navigation containers. Preserve permission-filtered destinations, aria-current, mobile indicators and browse spacing beneath the fixed header.

Use the shared title, section, body and caption scales, layout gutters and section spacing. Containers use the container radius; controls use the control radius. Keep compact, comfortable and spacious table density choices.

Dashboard page gutters belong to `src/app/(dashboard)/layout.tsx`. The content frame and route workspaces fill the available width: do not add another centered page-level width cap or desktop horizontal padding. Side gutters are 12px on phones, 20px from 640px, and 24px from 768px, matching the desktop toolbar inset. Keep deliberate inner text, form, dialog, and empty-state widths; these are separate from the page frame. Loading views use the same frame as loaded content.

## Appearance

Semantic surface, text, border, accent and status tokens in globals.css are the source of truth. Light appearance uses coordinated cream surfaces; dark appearance uses neutral charcoal surfaces. Forest, emerald, sage and gold are brand accents, not a green canvas. Print colors remain fixed for paper. Tenant brand colors and QR specifications are data.

Use bg-surface, bg-surface-elevated, text-text-secondary, border-input-border and status subtle/text pairs. Consumers use canonical semantic variables directly. Numbered secondary/status aliases and unused surface aliases have been removed. The primary ramp remains a current brand scale.

ThemeProvider and the pre-hydration bootstrap share light/dark/system resolution and the ekavyu-mode preference. Storage restrictions retain a usable in-memory appearance. System mode responds to OS changes.

## Shared controls

Input, Select, Textarea and DatePicker use controlStyles.ts. Preserve validation, IDs, described-by errors, readable disabled states and opaque keyboard focus. Buttons keep caller variants and asynchronous handling. Card offers default, outline and flat surfaces; a loading card is busy and inert. Static content has quiet surfaces.

Dashboard forms use DatePicker for dates, local date-times (`mode="datetime"`) and time-only values (`mode="time"`), rather than native picker inputs. Use the existing Select and Checkbox controls for choices. Keep the same local date/time strings, required-field checks and date limits when migrating a form. Native backing fields inside shared controls provide form semantics; they are not separate visible controls.

For dashboard refinements, reuse these components and established Tailwind utilities, including `page-title`, semantic tokens and `cn`. Use shared formatting helpers such as `formatCurrency`. Do not add page-specific CSS for appearances the component library and utilities already provide.

Dialogs, sheets, menus and popovers retain portals, focus handling/restoration, dismissal and scroll locks. Material tokens are limited to the selected compact controls and elevated popovers. They have opaque rendering for unsupported filters, reduced transparency, increased contrast and forced colors. Navigation and large content surfaces stay solid. Avoid full-viewport blur and blanket GPU layers.

Tables preserve search, sort, export, selection and pagination. Tabs use stable selection without spring scaling. Alerts, badges and toasts combine text/icons with status colors and retain live regions and timers. Skeletons respect reduced motion; empty and error states provide useful recovery.

The responsive BarChart has one measured-width implementation. Labels, legends and values stay readable. Clinical and billing print output retains its paper palette.

## Accessibility and verification

Preserve keyboard focus, semantic labels, mobile 44px targets, reduced motion and text enlargement. Public page illustrations/layout belong in CSS Modules. Keep current control contracts and business rules.

Use [verification-workflow.md](verification-workflow.md) to select direct controls, theme/overlay and consumer checks. Package TypeScript does not cover frontend test files. Prior viewport reviews are recorded in [production-readiness-tracker.md](production-readiness-tracker.md); final cleanup validation is recorded in [pre-production-cleanup.md](pre-production-cleanup.md).

## Brand assets and print appearance

Current identity, 2026-10-24. Product name: Ekavyu. Tagline: **Care That Keeps Moving**. The transparent ribbon-and-star SVG comes from `05_VECTOR_ALTERNATE/EKAVYU_Pathways_Vector_Approximation.svg` in the supplied handoff, selected following the user's vector/no-background correction. It is path-based gradient artwork with no embedded image or background. It is the supplied vector variant, not an exact reproduction of the metallic raster rendering.

### Brand and appearance

| Brand token | Value |
| --- | --- |
| brand-primary | Deep Forest #0B2F2A |
| brand-secondary | Emerald #1F5C52 |
| brand-soft | Sage #668B7A |
| brand-warm | Champagne Gold #D4AF7A |
| brand-ink | Deep Forest #0B2F2A |
| brand-mist | Ivory #F6F2E8 |

Screen colors come from semantic tokens in src/app/globals.css. Brand colors identify the product; opaque content surfaces keep clinical information readable. Sage and gold are supporting colors, not small body text on white. Dark mode uses lighter sage-derived foregrounds for contrast.

| Semantic color | Light | Dark |
| --- | --- | --- |
| background | #F6F2E8 | #121314 |
| surface | #F8F5ED | #1B1D1F |
| surface-muted | #F1EDE3 | #232528 |
| surface-elevated | #FBF8F0 | #282B2E |
| text-primary | #29332E | #F6F2E8 |
| text-secondary | #555B56 | #D2D1CB |
| text-muted | #66675F | #B3B2AA |
| border | #DCD6CA | #42464B |
| input-border | #898879 | #858C94 |
| accent | #1F5C52 | #BDD8C6 |
| focus-ring | #1F5C52 | #D4AF7A |

Success, warning and danger use dedicated semantic foreground/background pairs. Charts retain labels and distinct series colors. Screen controls follow [design-system.md](design-system.md). Navigation retains full-width geometry and the separate dashboard toolbar.

ThemeProvider and the hydration bootstrap store light/dark/system appearance under ekavyu-mode. There is no selectable color palette. Shared controls use canonical semantic tokens; unused surface and numbered status aliases have been removed.

### Assets, installation and print

`assets/brand/ekavyu-mark.svg` retains the supplied vector master. `EkavyuLogo` uses the transparent `public/brand/ekavyu-mark.svg`, with theme-aware live wordmark text. The optimized file is about 63 KB uncompressed / 15 KB gzip and is cached independently of application JavaScript. Run `npm run brand:assets`, then `npm run brand:social` to regenerate exports. Browser favicons retain transparency; OS install icons use a deliberate opaque ivory canvas and the maskable safe circle. Superseded raster logo files are removed.

Login and the public marketplace header use `EkavyuLogo layout="stacked"`: the transparent symbol sits above a small, centered title-case name. Dense workspace and landing headers retain the horizontal option.

The background essence uses three static CSS gradients: low-opacity gold light,
a fine curved highlight and a neutral warm wash. It appears behind introductory sections
and the dashboard canvas; cards, data tables and dialogs keep opaque fills. No
image request, animation, blur filter, fixed overlay or JavaScript rendering loop
is added for this effect. Both themes have their own restrained gradient opacity.

Current assets are app-icon-192.png, app-icon-512.png, app-icon-maskable-512.png, app-icon-180.png and the favicon files referenced by metadata. Root metadata owns manifest/icon tags once. Manifest ID remains ekavyu-healthcare-pwa; start URL is /dashboard and scope is /. Brand URLs use `brand-5`; the service worker uses `ekavyu-cache-v13` and allowlists only the public SVG mark. Its private-data cache restrictions remain intact. An existing OS home-screen shortcut may need reinstalling to adopt a changed icon.

Cookies, current application storage and infrastructure names use Ekavyu. The retired offline database name is retained solely to erase previously cached patient data. Cryptographic derivation constants remain stable because they bind existing authenticated ciphertext; they are not visible branding.

PrintBrand copies fixed paper colors into standalone documents, location QR posters, tickets, prescriptions, invoices and laboratory output. Thermal output remains monochrome. QR/payment values retain provider-required formats.

Cleanup validation and the remaining operational release checks are in [pre-production-cleanup.md](pre-production-cleanup.md) and [production-readiness-tracker.md](production-readiness-tracker.md). Source validation does not certify live provider transactions.

## Shared form policy

- Use `DatePicker` for date, date-time, time and exact expiry-month entry.
  Preserve local `YYYY-MM-DD`, `HH:mm`, `YYYY-MM-DDTHH:mm` and `YYYY-MM`
  values; an unconfirmed time edit must not change the saved value.
- Keep required/min/max validation on the non-visible backing field and route
  validation focus to the visible control. Do not mutate incoming Date objects.
  A locked fieldset also locks its portaled calendar. Nested selects retain the
  owning picker and parent modal.
- Use `Select`, `Checkbox` and `Input` for reconciliation choices, schedule
  flags and filters. The application lint policy enforces shared form controls;
  native backing fields remain inside the shared primitives.
- Use `Card`, semantic utilities, `page-title` and `formatCurrency` for ordinary
  service-catalog composition. `QueueDialog` owns pinned Cancel/Save layout;
  saving blocks dismissal and restoration stays beside the active override.
