# Ekavyu visual identity

Current identity, 2026-10-07. Product name: Ekavyu. Tagline: **Care That Keeps Moving**. The supplied transparent leaf artwork in public/image.png is the source for the application mark and install icons.

## Brand and appearance

| Brand token | Value |
| --- | --- |
| brand-primary | Deep Teal #0F6F66 |
| brand-secondary | Fresh Teal #49B39D |
| brand-soft | Soft Mint #8EDFD3 |
| brand-warm | Warm Sand #DCC9A3 |
| brand-ink | Ink Green #0E2A28 |
| brand-mist | Mist White #F7F7F2 |

Screen colors come from semantic tokens in src/app/globals.css. Brand colors identify the product; neutral surfaces keep clinical information readable. Fresh Teal and Soft Mint are not small text on white.

| Semantic color | Light | Dark |
| --- | --- | --- |
| background | #F7F7F2 | #141A19 |
| surface | #FFFFFF | #1C2422 |
| surface-muted | #F0F2EF | #222C29 |
| surface-elevated | #FFFFFF | #2A3531 |
| text-primary | #202B29 | #F7F7F2 |
| text-secondary | #505D58 | #CFD8D2 |
| text-muted | #64716B | #AFBEB5 |
| border | #DDE3DD | #46544D |
| input-border | #7A8982 | #7C9186 |
| accent/focus-ring | #0F6F66 | #8EDFD3 |

Success, warning and danger use dedicated semantic foreground/background pairs. Charts retain labels and distinct series colors. Screen controls follow [design-system.md](design-system.md). Navigation retains full-width geometry and the separate dashboard toolbar.

ThemeProvider and the hydration bootstrap store light/dark/system appearance under ekavyu-mode. There is no selectable color palette. Shared controls use canonical semantic tokens; unused surface and numbered status aliases have been removed.

## Assets, installation and print

EkavyuLogo uses ekavyu-leaf.png with theme-aware text. Run npm run brand:assets to regenerate the transparent UI mark, favicons, Apple touch icon, application icons and maskable icon. The script resizes/composites the supplied artwork; it does not trace or recolor it. Install icons use an opaque brand mist canvas and a safe maskable circle.

Current assets are app-icon-192.png, app-icon-512.png, app-icon-maskable-512.png, apple-touch-icon.png and the favicon files referenced by metadata. Removed duplicate assets have no redirects. Root metadata owns manifest/icon tags once. Manifest ID is ekavyu-healthcare-pwa; start URL is /dashboard and scope is /. The service-worker cache and asset query versions are defined in public/sw.js and public/manifest.json.

Cookies, current application storage and infrastructure names use Ekavyu. The retired offline database name is retained solely to erase previously cached patient data. Cryptographic derivation constants remain stable because they bind existing authenticated ciphertext; they are not visible branding.

PrintBrand copies fixed paper colors into standalone documents, location QR posters, tickets, prescriptions, invoices and laboratory output. Thermal output remains monochrome. QR/payment values retain provider-required formats.

Cleanup validation and the remaining operational release checks are in [pre-production-cleanup.md](pre-production-cleanup.md) and [production-readiness-tracker.md](production-readiness-tracker.md). Source validation does not certify live provider transactions.
