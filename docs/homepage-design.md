# Ekavyu homepage and public entry

Current implementation: **11 November 2026**. The homepage now presents three audiences under **Care, connected.** Existing application workflows and authentication are preserved.

## Visitor paths

| Audience | Destination | Actual next step |
| --- | --- | --- |
| Patients | `/browse` | Explore providers and their available booking/contact options |
| Clinic and hospital teams | `/onboarding?mode=new_org` | Request assisted setup; review and provisioning are separate |
| Pharmacy teams | `/pharmacy-start` | View eligible published trials, verify business email and continue branch setup |
| Existing users | `/login` | Existing authentication and workspace selection |

## Structure and visual direction

Navigation, real-product hero, three audience choices, patient journey, clinic workspace, pharmacy workspace, audience-specific setup, configured clinic plans, practical FAQ, closing actions, and grouped footer. Development notices and repeated demonstration labels have been removed from the public interface.

System sans-serif replaces serif accents. Ivory and charcoal use the shared semantic palette, supported by forest, emerald and restrained gold. Messaging evidence is part of the clinic journey. The desktop clinic preview has workflow navigation alongside it. Below 900px, patient evidence appears before the visit steps. Phones use a compact landscape hero preview, vertical audience choices, fully visible clinic screen selectors and horizontal comparison for multiple plans.

`src/app/page.tsx` owns server-rendered content, metadata and the preserved auth redirect. `src/app/home/` contains navigation, `HomeAction` (shared button link appearance), `HomePricing`, reusable `ProductScreenshots`, and patient/clinic/pharmacy screen definitions. `home.module.css` owns landing-only layout, responsive rules, dark appearance, reduced motion and forced colours. Shared plan cards, theme controls and logo are reused. The social image is generated with `npm run brand:social`.

Public actions and screen selectors reuse `Button` and `buttonClassName`; pricing also reuses `Card`, `Breadcrumbs`, `Skeleton`, `cn` and the currency formatter. CSS modules retain page composition and responsive layouts. The clinic screen selector supplies local semantic colors for its forest background without changing the shared button contract. Booking, setup, pharmacy and messaging requirements remain in the public copy.

No runtime 3D, remote fonts, new application dependencies, hardcoded prices, new integrations or unrelated workflow edits were introduced.

The 11 November pricing refinement gives a single published plan a full-width desktop composition and a stacked phone card. Multiple plans keep the responsive comparison layout. The shared card CSS preserves readable spacing inside the landing page; the full pricing route reuses it and omits care search. [Current previews and scoped verification](public-pages-review.md#11-november-refinement). The four discovery/booking captures affected by public navigation were refreshed; the manifest records this batch separately. Earlier lab/performance measurements remain dated baselines.

## Feature truth

A saved booking is not necessarily confirmed; requirements vary by provider. A setup request does not instantly activate a clinic. Tools depend on plans, modules, roles and location assignments.

WhatsApp needs a configured sender, recorded consent, recipient authorization, applicable access, approved templates and shared-mode credits. Accepted, delivered and read differ; there is no booking chatbot or delivery guarantee.

Pharmacy operating, issuer and professional requirements apply. Published pharmacy trials are separate from the public clinic catalogue. The page does not establish live operating approval.

All pictured people, records, amounts and delivery states are fictional. No customer testimonials, adoption statistics, certifications, clinical outcomes or placeholder legal destinations were invented.

## Assets and capture safety

WebPs: `public/landing/product/`. Original PNGs and SHA-256 provenance: `docs/landing-page/connected/product/`.

The 9 November monochrome-brand update refreshed all **18 captures**: discovery, booking, reception, queue, doctor, billing, overview, WhatsApp and pharmacy, each at desktop/mobile sizes. PNG hashes and WebP byte counts match the current manifest. Source artwork and header composition are documented in [the design system](design-system.md#assets-installation-and-print). Earlier full-page review screenshots below predate the logo replacement; their layout findings remain dated evidence.

`landing-demo.mjs` provides fictional practice/pharmacy records. `capture-connected-product.mjs` renders the actual application through a loopback-only in-memory API, blocks external services and writes, and simulates only known initialization responses. It allows development HMR but closes application real-time sockets. Future-date booking selection keeps captures valid after the current morning. Capture cleanup runs even if artifact writing fails.

Use `PRODUCT_CAPTURE_SCREENS`, `PRODUCT_CAPTURE_OUTPUT` and `PRODUCT_CAPTURE_ASSETS` for scoped captures and ignored review output.

## Reference-led refinement — 9 November

The [design review](landing-page/refinement-review-2026-11-09.md) records the critical audit, references and access limitations, implemented decisions, current screenshots and verification. This pass makes the copy concrete, removes a repetitive section, balances clinic imagery, improves tablet/patient ordering and finishes the footer.

**Current checks passed:** changed-file lint, 20 focused tests, production build with TypeScript, eight production browser scenarios and eight read-only entry journeys. Axe reported zero violations and zero incomplete checks in default/changed states. Six image-recovery cases and a JavaScript-disabled FAQ fragment check also passed.

The [current Lighthouse samples](landing-page/connected/lighthouse-refinement-2026-11-09.json) scored desktop/mobile performance **100/94**, accessibility and best practices **100**, with CLS **0**. Mobile LCP was **2.97s**, still above target. Local SEO was 66 solely because this preview is intentionally blocked from indexing. These are local lab measurements, not field performance.

Current previews: [desktop](landing-page/connected/review/desktop-full.png), [768px tablet](landing-page/connected/review/tablet-full.png), [390px mobile](landing-page/connected/review/mobile-full.png), [dark desktop](landing-page/connected/review/dark-desktop-full.png). [Current browser results](landing-page/connected/review/refinement-results.json) and [recovery results](landing-page/connected/review/refinement-failure-states.json) record the final review. Raw output: `.next/brand-handoff/refinement-final/`.

`review-connected-landing.mjs` exercises the current page. `landing-journeys.mjs` follows actual care, pricing, assisted setup and pharmacy links without submitting forms. `landing-review.mjs --lighthouse` combines browser QA and Lighthouse; `--lighthouse-only` avoids repeating a passing browser review. Audit dependencies stay outside the application.

The October reports retain their original dates and are not current performance evidence. Live transactions, external-provider delivery, professional operating approval, assistive-technology certification and deployment were not exercised.
