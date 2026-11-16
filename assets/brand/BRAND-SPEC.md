# EKAVYU — Monochrome logo geometry and usage specification

## Source and accuracy

This is a **clean, vector-outline reconstruction** from the supplied **771 × 713 px raster reference**.
The emblem retains the reference's distinctive **two separated, right-tapered curved shapes**, rising to the right; this is **not a new symbol**. The original gradient and highlight were deliberately removed. The wordmark keeps the original six uppercase letters, placement and visual tracking, using carefully reconstructed vector glyphs. The descriptor uses a compatible neutral sans-serif, outlined into vectors for reliability.

Because the source was raster artwork (not the original designer's Bézier or font files), **exact original control points and font outlines are unknowable**. Treat this kit as a high-fidelity, cleaned redraw, not a claim of mathematically exact identity to an absent master vector.

## Proportional measurements (native source-coordinate grid)

- Emblem: x≈261.5 to 554.5, y≈115.5 to 330.5; width≈293, height≈215.
- Emblem optical center: x≈408; wordmark optical center: x≈407.
- Wordmark: x≈142 to 672; y≈380 to 432; width≈530, height≈52.
- Emblem-to-wordmark gap: ≈49.5 native units.
- Wordmark-to-descriptor gap: ≈32 native units.
- Main wordmark uses deliberate letter-specific optical spacing; DO NOT retype as a normal text element.
- Top emblem tip and lower emblem curve retain their independent proportions; do not flip, merge or rotate.
- Use the SVG `viewBox` values for correct aspect and clear space; never crop inside the viewBox.

## Colors

- Black-only artwork: `#000000`.
- White-only artwork: `#FFFFFF`.
- No gradients, greens, gray fills, shadows, glossy effects, bevels or outlines on the master logo.
- Previews and supporting docs may use gray UI labels, but brand-mark exports are strictly black/white.

## Minimum usage sizes

- Favicon: provided at 16/32/48/64 px, although the thinnest tip naturally softens at 16 px.
- Mark-only logo for small spaces: ideally 24 px or larger.
- Horizontal lockup in navigation: use 150–230 CSS px wide or more.
- Full stacked lockup: use 240 CSS px or larger for descriptor legibility.

## Allowed combinations

1. Black emblem + black wordmark on white/light background.
2. White emblem + white wordmark on black/dark background.
3. Black emblem without background (transparent asset), when placed on light UI.
4. White emblem without background (transparent asset), when placed on dark UI.
5. Standalone mark for favicons/app icons; full lockup for landing page and large placements.

## Prohibited modifications

Do not stretch, rotate, mirror, recolor, apply CSS `filter`, add a medical cross/leaf/star, add a drop shadow, replace the wordmark with generic font rendering, change the upper/lower silhouette, draw gradients, or add 'hospital' or 'balance' beneath the name.

## Brand identity notes

- Platform positioning: healthcare software connecting clinics, doctors, pharmacies and patient-facing services.
- The master mark should communicate a single credible software platform rather than an individual hospital or pharmacy.
- SVGs use **actual outline paths** and have **no runtime font dependency**.
- Monochrome icons are supplied on white and black square backgrounds, with transparent mark versions separately.
