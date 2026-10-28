# Remaining-page Lighthouse implementation

All 54 page templates are represented by 57 initial views, including four dashboard roles. 114/114 collected observations validated; 0 remain unverified and 0 profile observations are pending. These are local production-artifact audits with synthetic records, not deployed or real-user measurements. An audited initial view does not mean all workflow variants or performance targets are complete.

Repeated patient-dashboard CLS median: 0.1366 to 0.0772 across three cold samples each. Performance targets remain partial; individual pilot results below are historical diagnostics.

[Every route and both profiles](lighthouse-progress.md) · [Compact measurements](lighthouse-remaining-2026-10-23.json) · [Reproduction instructions](../../scripts/performance/README.md)

## Result

- Accessibility 100: 114/114 validated observations.
- Best Practices 100: 114/114.
- Performance below 90: 70/114; optimization is still partial.
- Console/HTTP diagnostics: 4 observations; inspect their retained errors in the JSON. A successful view is not a claim of an error-free browser console.

## Implemented

- Shared dashboard: load the AI interface and notification list after opening; stop speculative sidebar/mobile route prefetching; preserve SPA navigation and permitted links. Drawer gesture styling now uses stylesheet CSS so strict CSP accepts it.
- Dashboard stability: use real stat-card skeletons and a shared minimum height. A targeted patient pilot reduced CLS from 0.1366 to 0.00012; this is a single matched diagnostic, not a site-wide speed claim.
- Accessibility across remaining modules: heading hierarchy, main landmarks, date-picker visible labels, notification/menu/count names, progress naming and booking/tracker contrast. Clinical and financial operations retain their existing authority and transaction logic.
- Public pricing: reuse the public-plan query cache, including explicitly invalidating cached empty results before retry.
- Operational pages: meaningful tracking/check-in/queue landmarks and populated synthetic views; replace a broken bare /track link with reception/private-link guidance.
- SEO policy: public production indexing is consistent across metadata, proxy headers, robots and sitemap; previews, private pages and capability links remain noindex. Lower local SEO scores are expected and are not fixed by removing these controls.

## Verification

Scoped lint, affected Vitest files and the final isolated Next production build/type check passed. Covered consumers include date controls, MRN/timeline, plan retry, clinical workspace loading, notification/PWA isolation, navigation/gestures and operational trackers. This is scoped verification, not a full release or backend regression suite. No backend implementation changed.

The build used `.next/remaining-complete`, Lighthouse 13.5.0 and disposable Chrome contexts with cold HTTP/memory/CacheStorage resets retaining synthetic cookies. API responses use 40 ms fixture latency; local TLS WebSocket connections are real. Unknown fixture endpoints invalidate a view. Each measurement validates its route, single main/h1, populated content, browser exceptions and horizontal overflow. The JSON records actual throttling. Full reports remain in TEMP under `ekavyu-remaining-complete-<profile>-lighthouse`.

## Interpretation and continuation

Private cold mobile pages still spend substantial time on JavaScript and hydration. Investigate the slowest traces before further shared loading changes. A direct-import experiment reduced one UI chunk but increased total JS (929,393 to 1,003,646 bytes in its matched doctor sample); it was removed. The retained notification split was smaller. Repeated baselines must use the same cold settings; earlier private retained-storage runs are diagnostics only.

The homepage was concurrently redesigned by separate user work, so its old/new scores are not evidence for this optimization. The artifact freezes that homepage version; subsequent local edits require a new build before comparison. This machine also had concurrent development activity, so single-run performance fluctuations must not be presented as repeatable improvements.

Live Vercel/Render latency, backend cold starts, field Core Web Vitals, production indexing/crawl results and every mutation/auth variant remain unmeasured here. No deployment or new CI dependency was performed. Keep the existing release gates.

## Next performance targets

These are the lowest observed mobile scores in the complete sweep, not repeated rankings. Use their retained traces to separate JavaScript, layout and data-read costs before changing shared code.

| Representative | P | LCP ms | TBT ms | CLS |
| --- | --- | --- | --- | --- |
| locations | 46 | 6214 | 2327 | 0.0010 |
| settings-billing | 46 | 6881 | 3007 | 0.0001 |
| billing-services | 47 | 6894 | 2030 | 0.0012 |
| staff | 47 | 6629 | 2036 | 0.0010 |
| dashboard-root | 48 | 6246 | 2939 | 0.0000 |
| patients | 48 | 6403 | 2684 | 0.0102 |
| security | 48 | 6094 | 2909 | 0.0032 |
| queue-tv | 48 | 5727 | 4281 | 0.0001 |

## Interaction and repeated checks

4/4 browser interaction checks validated. Details and any failures are preserved in the JSON. 3 failed initial observations required explicit retries; their original reasons are retained under `replacedAttempts`.

Repeated final cold samples are separate from the one-observation route table. They describe final variability, without asserting an old/new improvement.

| Representative | Profile | Valid samples | Median P | Median LCP ms | Median TBT ms | Median CLS |
| --- | --- | --- | --- | --- | --- | --- |
| pricing | mobile | 3 | 78 | 2926 | 769 | 0.0001065516310518786 |
| dashboard | mobile | 3 | 51 | 5833 | 1491 | 0.00936574297038566 |
| dashboard-patient | mobile | 3 | 50 | 5934 | 1777 | 0.07724883149312634 |

## Detailed accessibility follow-up

The main Lighthouse sweep reported Accessibility 100, but its unscored visible-label rule still identified notifications, avatar initials, mobile More, timeline categories, queue-date selection and the tracker link. The final corrections are in `.next/remaining-aria`, after the intermediate `.next/remaining-accessibility` build. The full-route performance table belongs to the earlier frozen artifact; no speed improvement is claimed for name-only edits.

The final WCAG 2 A/AA and 2.1 A/AA axe pass validated 114/114 populated views across both profiles. Violations and items requiring manual review are retained separately in the JSON; automated checks are not exhaustive accessibility certification.

## Repeated cold comparison

Before uses `.next/remaining-baseline`; after uses the artifact recorded on each repeated row. Both use the same current synthetic contracts, cold settings and Lighthouse version. Public-plan caching already existed in this baseline: pricing therefore checks stability, while its warm navigation benefit is measured separately. The homepage is excluded because of the concurrent redesign. Three samples cannot remove concurrent machine-load variance; inspect ranges in the raw measurements before asserting a speed gain. JS resource bytes are uncompressed; transfer bytes are recorded separately in the JSON.

| Representative | Samples B / A | Median P B / A | Median BP B / A | LCP ms B / A | TBT ms B / A | CLS B / A | JS resource bytes B / A |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pricing (mobile) | 3 / 3 | 91 / 78 | 100 / 100 | 2878 / 2926 | 345 / 769 | 0.0001 / 0.0001 | 842173 / 842337 |
| dashboard (mobile) | 3 / 3 | 60 / 51 | 92 / 100 | 5822 / 5833 | 760 / 1491 | 0.0447 / 0.0094 | 947048 / 923144 |
| dashboard-patient (mobile) | 3 / 3 | 48 / 50 | 92 / 100 | 5769 / 5934 | 1561 / 1777 | 0.1366 / 0.0772 | 947048 / 923144 |

The first detailed desktop pass also exposed joined account/tracker text, plural filter labels and a patient-table row containing other controls. Final corrections use `.next/remaining-aria`: explicit word boundaries, supported avatar image/category group roles, names containing the visible filter text, and existing patient-profile links without an enclosing row button. Original WCAG findings remain under `accessibilityInitial`; final checks are under `accessibility`. The unread badge is static: its palette contrast is 5.43:1 in light mode and 8.20:1 in dark mode; the previous opacity pulse reduced that contrast.

Manual-review findings, including gradient backgrounds and icon-only pagination, remain in the JSON. Automated absence of violations is not a claim that every gradient, theme, zoom level or assistive-technology workflow has been manually certified.

## Final scoped regression checks

The label/navigation check set passed 98 cases across seven files after updating three exact-name queue selectors; the final avatar/timeline/patient-directory/appointment/tracker set passed 45 cases across six files. These sets overlap and must not be added into a unique-test count. The patient-directory assertion checks that every profile link remains a link without a surrounding row button. Scoped ESLint passed, and the final production build completed compilation and package TypeScript. No final test-file type-check or full release-suite result is claimed.

## Public navigation follow-up

The preceding repeated pricing median did not improve. Its trace contained seven speculative RSC requests, including a plan-specific onboarding redirect, during initial rendering. The shared public navbar and public-plan CTA now disable automatic prefetch; links and client navigation remain available. The signed-in public account label also includes its visible initials/name. This change uses `.next/remaining-public` and has its own retained measurements.

Latest pricing: 3 mobile samples, median performance 85, median initial RSC requests 0 and median total requests 18. The earlier trace had seven RSC and 26 total requests. The route tracker uses this latest pricing follow-up while keeping the complete original sweep in JSON. 10/10 affected public WCAG views and 2/2 pricing-to-browse interactions validated.

Public navigation, plan recovery and homepage pricing checks passed 20 cases across three files. Scoped lint and the isolated public-follow-up production build/type check passed. Pricing remains below its earlier baseline median of 91; the retained improvement is fewer initial requests, with no claim of a completed cold-start performance target.
