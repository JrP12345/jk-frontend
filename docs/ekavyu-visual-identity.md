# Ekavyu visual identity migration

Implemented on 2026-09-27 from the supplied brand board and the subsequent
transparent leaf PNG in `public/image.png`. The official tagline is
**Care That Keeps Moving**. The theme and leaf-logo replacement are implemented.

## Audit and scope

The frontend had ten selectable palettes (blue, teal, emerald, cyan, indigo,
violet, rose, amber, bronze and slate), a duplicated system-dark fallback,
blue/purple accents, navy hardcoded surfaces, glowing controls, blurred floating
backgrounds, and separate print/chart colors. Pricing and public queue screens
used fixed dark colors. The repository initially contained the previous
geometric A mark; its active UI/browser/install assets now use the supplied leaf.

Existing reusable components, the font stack, spacing, responsive layouts,
light/dark/system preferences, form validation, routes, API calls, permissions,
clinical flows, data formats and integrations are retained. No dependency was
added. The main presentation pass used parsed TypeScript literal edits and
verified that the functional AST and JSX structure were unchanged. Other edits
are scoped to theme styling, keyboard focus for scrollable tables and copying
print tokens into standalone documents.

## Canonical design tokens

The source is `src/app/globals.css`. Tailwind utilities and existing
`--s-*` / `--p-*` names resolve through compatibility aliases rather than extra
palettes. Use `text-accent` for branded text that adapts to the mode, and
`bg-primary` with `text-brand-mist` for solid brand actions. Fresh Teal and Soft
Mint are not used as small text on white.

| Brand token | Exact supplied value |
| --- | --- |
| `--brand-primary` | Deep Teal `#0F6F66` |
| `--brand-secondary` | Fresh Teal `#49B39D` |
| `--brand-soft` | Soft Mint `#8EDFD3` |
| `--brand-warm` | Warm Sand `#DCC9A3` |
| `--brand-ink` | Ink Green `#0E2A28` |
| `--brand-mist` | Mist White `#F7F7F2` |

| Semantic token | Light | Dark |
| --- | --- | --- |
| `--background` | `#F7F7F2` | `#0E2A28` |
| `--surface` | `#FFFFFF` | `#143632` |
| `--surface-muted` | `#EDF5EF` | `#102E2B` |
| `--surface-elevated` | `#FFFFFF` | `#1B423C` |
| `--text-primary` | `#0E2A28` | `#F7F7F2` |
| `--text-secondary` | `#425F59` | `#C1DAD1` |
| `--text-muted` | `#526E65` | `#99BEB1` |
| `--border` | `#D3DED5` | `#3D635B` |
| `--input-border` | `#7A9188` | `#648C81` |
| `--accent` / `--focus-ring` | `#0F6F66` | `#8EDFD3` |

Success, warning and danger have separate foreground/background pairs. Red and
amber remain functional status colors. Charts use distinct teal, olive, sand
and status colors with their existing labels/legends. Navigation, dialogs,
tables, inputs, badges, loaders, toasts and buttons share semantic tokens.

Subtle brand washes are reserved for public/auth introductions. Decorative
control gradients, large color glows, glass layers and cursor-tracking card
shine were removed. Existing motion and reduced-motion support remain.
Waiting-room labels retain full text opacity; status dots can still animate.
Its locale-dependent clock uses a fixed-width initial placeholder until client
mount to avoid hydration errors. Queue timing and announcement behavior remain
unchanged.

`ThemeProvider.tsx`, the dashboard header and UI exports no longer expose a
palette selector. `jk-mode` still stores light/dark/system mode. Historical
`jk-palette` values are ignored and cannot change the identity. The bootstrap
resolves mode before paint; one DOM helper handles subsequent changes, including
system preference changes and unavailable browser storage. Buttons honor
callers' semantic foregrounds without competing default color utilities.

## Print, metadata and assets

Print tokens remain fixed to light paper colors in both screen modes.
`src/lib/printBrand.ts` copies the CSS values into standalone popup
documents and the clinic QR-poster iframe. Appointment tickets/prescriptions,
invoices/receipts, laboratory documents and the unified document modal use them.
Thermal output retains monochrome printing, and QR/payment libraries retain
valid HEX inputs suitable for scanning and provider APIs.

Browser theme color is Deep Teal, PWA launch background is Mist White, and
manifest/root SEO/social descriptions include “Care That Keeps Moving”. The
service-worker cache version was advanced. Manifest ID, start/scope URLs,
cookies, storage identifiers and payment destinations are unchanged.
Backend-generated emails/messages are outside this frontend visual change;
their Ekavyu copy was migrated in the preceding brand-name task.

The supplied `image.png` is retained unchanged as the source. Run
`npm run brand:assets` from the frontend repository to regenerate
the transparent 512px UI mark, 16/32px favicons, 180px Apple icon, 192/512px PWA
icons and light 192px icon. A separate opaque 512px maskable icon places the
entire source canvas inside the safe circle. Exports only resize and composite
the supplied artwork; no tracing, AI generation, recoloring or board cropping
is used. The existing installed app ID and shortcut URLs remain compatible.

`EkavyuLogo.tsx` uses the transparent leaf in both modes with theme-aware text;
compact navigation uses the symbol alone. Spacious registration, password-reset
and email-verification views display the tagline; login retains its tagline
badge. The install banner uses the leaf. Favicons have a new version query and
the service-worker cache is `ekavyu-cache-v6`. Legacy public URLs `logo-d.png` /
`logo-w.png` now serve the supplied leaf, preserving older cached clients without
retaining the previous artwork. Current UI uses `ekavyu-leaf.png` directly.

## Changed files and validation

Core files: `globals.css`, `ThemeProvider.tsx`, `Button.tsx`, `Card.tsx`,
`Badge.tsx`, `Table.tsx`, shared UI exports, root/dashboard layouts,
`printBrand.ts`, `manifest.json`, `sw.js` and `ekavyuTheme.test.tsx`.
Presentation changes cover auth/public/pricing pages, operational and platform
administration pages, clinical/billing/EHR components, navigation,
notifications, chart components and clinic-status styling. `EkavyuLogo.tsx`
and the generated public assets now contain the supplied leaf identity.

Final results are in
[production-readiness-tracker.md](production-readiness-tracker.md).
Browser runs use isolated mocked responses. They do not certify live provider
transactions or production data, and their local fixture run is not a CSP
security audit. No release was deployed.
