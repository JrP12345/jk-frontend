# Connected public pages review

Initial connected review: **9 November 2026**. Latest focused refinement: **11 November 2026**, covering pricing, homepage plans, account-entry continuity and Browse provider entry.

## 11 November refinement

Latest account-entry follow-up: `/login` hosts both sign-in and patient registration, using `?mode=register` for direct registration links. [AuthEntry](../src/components/auth/AuthEntry.tsx) switches the forms locally with native history replacement; `/register` redirects to the canonical entry. The frame, logo, header and appearance control stay mounted. The sidebar uses the supplied horizontal logo at a compact size. Patient OTP and staff credentials/passkeys retain their existing endpoints, MFA, workspace selection and server permissions. Form switches are blocked during pending requests; changing audience clears the password.

This account-entry follow-up passed 10 focused Vitest files covering the entry controller, patient verification/registration, auth state, recovery, shared frame/navigation, mobile controls, passkeys and workspace selection. The production build including TypeScript passed. All 36 production-preview auth checks and 10 connected journey checks passed at desktop/phone widths and in both themes, including direct registration, the former route redirect, refresh, frame continuity and rejected-code recovery. Checked views had zero browser errors, horizontal overflow or Axe violations; rejected-code toasts retain incomplete contrast observations. Changed-file ESLint had zero errors and one existing session-expiry effect warning. All browser records and OTP responses were synthetic; no real accounts, messages or bookings were created.

Follow-up: public actions and screen selectors now reuse the existing Button and link-style helper; pricing reuses Card, Breadcrumbs, Skeleton and `cn`. Shared primitive interfaces are unchanged. CSS modules retain composition and responsive rules. Removed visible development notices and repeated demonstration labels while retaining booking, assisted setup and messaging requirements. This follow-up passed 30 focused tests and 34 synthetic browser checks at 1440/390/320px, including phone dark mode, screen switching, annual billing, comparison, long plan names and empty/error recovery. Checked views had no horizontal overflow, browser errors or Axe violations. Changed-file lint had zero errors and one existing pricing effect warning; no additional production build was run for this styling/copy follow-up.

- `/pricing` has no care search. It uses the shared plan card and billing switch, a full-width two-column presentation for one plan on desktop, stacked phone cards, and a scrollable limits/features comparison. Prices, currencies, limits, annual billing and trial terms still come from the existing catalogue.
- The homepage uses the same card. One plan fills the section; multiple plans retain their responsive comparison layout. Card spacing uses its own CSS module so landing-page resets cannot collapse descriptions, limits and actions.
- Account entry uses `/login` for both forms, with a persistent [auth layout](<../src/app/(auth)/layout.tsx>) and [shared frame](../src/components/auth/AuthRouteLayout.tsx). Form switches keep the same outer frame and header without fetching another route. Recovery/setup pages retain their own frames.
- Browse removes Find care / For patients / For providers from the header. “List your practice” opens `/onboarding?mode=new_org` directly. On phones, the navigation menu contains practice setup, patient sign-in and account creation. This opens the existing **Request organization setup** form; it does not provision or publish an organization.

Verification: **136 tests across 12 affected files**, changed-file ESLint (zero errors; two existing warnings), and the production build including TypeScript passed. **80 synthetic browser cases passed** across 1440/768/390/320px and both themes, including single/multiple/long plans, annual billing, comparison, empty/error retry, preserved auth-frame identity, setup destinations, booking-entry continuity and rejected registration codes. Axe reported zero violations in the checked pricing/account pages, homepage pricing section and Browse header; the rejected-code toast cases retain incomplete contrast observations. This is scoped UI/flow evidence, not live OTP, booking/payment persistence, request submission or whole-site accessibility certification.

Current previews: [pricing desktop](landing-page/connected/public-journey/pricing-1440.png), [pricing phone](landing-page/connected/public-journey/pricing-390.png), [homepage pricing](landing-page/connected/public-journey/home-pricing-1440.png), [phone navigation](landing-page/connected/public-journey/browse-menu-390.png). [Current results](landing-page/connected/public-journey/public-refinement-2026-11-11.json). Raw output: `.next/public-refinement/`. The reusable account journey tool now opens the phone navigation menu before choosing Sign in.

## Routes and continuity

| Page | Canonical route | Verified connection |
| --- | --- | --- |
| Sign in | `/login` | Patient OTP, Staff credentials, patient registration, Browse and home |
| Provider sign in | `/login?audience=staff` | Opens the Staff panel; offers clinic setup and pharmacy onboarding |
| Patient registration | `/login?mode=register` | Details → code entry → verification recovery; `/register` redirects here; verified-account handoff uses `/dashboard`, matching sign-in |
| Browse | `/browse` | Search → facility; returning preserves the search; footer connects account and provider entry |
| Facility | `/browse/[slug]` | Public doctor link retains the selected facility; breadcrumbs return to Browse |
| Doctor and booking | `/doctor/[slug]?location=[facility-slug]` | Practice selection, authoritative date/time selection, patient details and facility breadcrumbs |

The route called `browse/id/doctor` in conversation is the existing canonical doctor route above. Public links continue to use readable slugs, not internal database IDs. No competing nested doctor route was introduced.

## Corrections

- Public and account-page identities now link home. Browse remains an explicit action rather than the logo’s hidden destination.
- Directory, facility, doctor and loading/error states share the public brand/account controls. The 11 November refinement replaces landing-audience shortcuts with direct practice setup where appropriate.
- Provider footer links open Staff sign-in. Patient account creation and business setup now have distinct entry choices.
- Account pages use the shared “Care, connected.” identity and plain audience descriptions. Removed the decorative gradient/diagonal treatment from the account sidebar.
- Fixed the production-only login selector bug: the shared animated pill depended on inline positioning blocked by the strict style policy. Auth now uses a local CSS selected-state background while retaining the shared Tabs component and keyboard behavior. The security policy is unchanged.
- Phone account menus close and release their scroll lock when resized to desktop.
- Registration freezes fields during requests, guards repeated submission, clears an old code when returning to details and preserves entered data after failure.
- Rejected, incomplete, guest and additional-verification responses cannot silently complete registration. The code step offers Sign in for accounts that need the existing additional checks. A verified session stays disabled during its single dashboard handoff.
- Unavailable and failed profiles retain branded navigation, Browse and retry where appropriate. Inline booking failures stay inside the doctor page; removed doctor assignments link to available facility doctors.
- Empty doctor summary cards are omitted when no experience or practice facts exist.
- Facility and doctor routes now have matching route-level loading skeletons. Slow server reads show the public frame immediately instead of leaving the previous page on screen.
- Quick filters have the correct group role. Map attribution is no longer clipped at the frame edge; provider attribution remains visible.

## 9 November verification

Highest risk: **Level 4**, because local registration/session handoff behavior changed. No backend, authorization policy, financial contract or booking submission logic changed.

- **140 focused Vitest cases passed across 10 files**: sign-in, registration, auth state/recovery, shared navigation/loading, profile failures, canonical links, directory and doctor/booking regressions.
- Package TypeScript check and the final isolated Next production build passed. Vitest provides runtime test coverage; the package TypeScript configuration excludes test files.
- Changed-file ESLint passed with **no errors**. Six existing hook warnings remain: five in the booking client and one in the login expiry effect. No new unused-import or hook warnings remain from this pass.
- **47 final named browser cases passed**, covering all five pages at 1440/768/390/320px and dark phone layouts, plus connected journeys, rejected registration codes, unavailable facilities/doctors, recoverable upstream errors, removed doctor assignments and delayed profile loading.
- After visual review found the production tab-highlight defect, 15 affected cases were rerun. Adding route loading boundaries was followed by 32 scoped production checks, including four deliberately slow profile cases. The saved report replaces cases by name; pre-fix captures remain in ignored raw output.
- Loading was verified through cold in-app links. An initial direct-navigation timing probe missed the doctor fallback; the final link-based checks passed at both widths. Both observations are recorded in the report.
- Connected journeys reached booking details, changed to a second practice, returned through facility/Browse breadcrumbs, restored search, switched login/registration and opened provider sign-in. OTP delivery/verification in these browser checks were in-memory synthetic responses only.
- Axe reported **zero violations**. Incomplete checks remain for the Leaflet minus glyph and the notification overlay after a rejected code; these were visually reviewed and are retained in the report. The invalid filter-group label and login highlight findings were corrected.
- No blocked write attempts or unknown fixture endpoints remained. The local fixture server served both server-rendered profiles and browser reads; this review does not depend on a running real backend.

## 9 November evidence and limits

The [final browser report](landing-page/connected/public-journey/results.json) includes source runs and the final case list. Current previews:

| Page | Desktop | Phone |
| --- | --- | --- |
| Login | [1440px](landing-page/connected/public-journey/login-1440.png) | [390px](landing-page/connected/public-journey/login-390.png) |
| Registration | [1440px](landing-page/connected/public-journey/register-1440.png) | [390px](landing-page/connected/public-journey/register-390.png) |
| Browse | [1440px](landing-page/connected/public-journey/browse-1440.png) | [390px](landing-page/connected/public-journey/browse-390.png) |
| Facility | [1440px](landing-page/connected/public-journey/facility-1440.png) | [390px](landing-page/connected/public-journey/facility-390.png) |
| Doctor | [1440px](landing-page/connected/public-journey/doctor-1440.png) | [390px](landing-page/connected/public-journey/doctor-390.png) |

All displayed records are fictional. Browser booking checks stop at patient details; booking submissions and account handoff are covered by the focused frontend tests, not live external transactions. No real SMS/email, appointment creation, payment, patient record write or deployment was performed. This is a scoped product/engineering review, not a full release gate or assistive-technology certification.

Runner: [review-public-journey.mjs](../scripts/performance/review-public-journey.mjs). Raw outputs: `.next/brand-handoff/public-journey-final/`, `.next/brand-handoff/public-journey-auth-final/`, `.next/brand-handoff/public-journey-streaming-final/` and `.next/brand-handoff/public-journey-loading-final/`.
