# Cross-platform and PWA readiness review

2026-10-08. **Overall: CONDITIONAL for Phase 1 staging. Production approval remains pending.** Verified compatibility defects are fixed. Local tests support an online-first PWA; deployed sessions/payments, Safari, installed mobile devices and complete clinical journeys remain unverified.

## Implementation assessed

Inspected actual source: shared controls/navigation, focus/scroll/viewport hooks, public booking, patient/staff authorization, workspace/query-cache resets, API refresh/payment replay, clinical draft guards, queue polling, notification ownership, uploads/printing, manifest/service worker, CSP, server cookie/CSRF/session guards, staging configuration and CI. Previous audit results were not substituted for these checks.

Installed: Next.js **16.3.8**, React **19.3.0**, Tailwind **4.3.3**, Vitest **5.0.3**, Axios **1.20.0**, SimpleWebAuthn browser **14.0.0**, Fastify **5.12.5**, Mongoose **9.10.4**. Local commands used Node **24.7.0**; containers were not executed. Installed Next browser/PWA/CSP guides were read before framework edits.

Dependency baseline: Chrome/Edge 111+, Firefox **128+**, Safari **16.4+**. Next alone lists Firefox 111+, but [Tailwind v4 requires Firefox 128](https://tailwindcss.com/docs/compatibility). This is a framework baseline, not certification of every workflow on its oldest version. Samsung Internet requires actual device checks.

## Findings and implemented fixes

| Classification | Verified cause and action | Source |
| --- | --- | --- |
| Launch Blocker — fixed for restricted-storage patients | Preference removal threw during patient login/hydration, rejecting a verified session. Session-storage cleanup could reject logout. Preferences/cleanup now fail independently; server authorization and immediate private-state clearing remain authoritative. | [Auth](../src/store/authStore.ts), [regressions](../src/tests/workspaceIsolation.test.tsx) |
| Important Improvement — fixed | Worker cache open/write/eviction failures rejected fetches or replaced successful responses with stale/offline content. Cache failure now preserves network success; unavailable network/cache returns controlled 503. Public allowlist unchanged. | [Worker](../public/sw.js), [tests](../src/tests/serviceWorkerPrivacy.test.ts) |
| Important Improvement — fixed | Dismissed install prompts remained reusable, simultaneous calls prompted twice, rejection escaped, and appinstalled listener survived unmount. Events are now consumed once, rejected prompts handled and listeners removed. Blocked banner storage no longer crashes the view. | [Hook](../src/hooks/usePWA.ts), [banner](../src/components/ui/PWAInstallBanner.tsx), [tests](../src/tests/pwaRecovery.test.tsx) |
| Important Improvement — fixed | Firefox production console exposed CSP-blocked server-rendered border/background branding. Facility/doctor styling now uses a nonce-protected server stylesheet with validated hex input. CSP was not relaxed. Computed branding and strict CSP checks pass. | [Styles](../src/components/PublicBrandStyles.tsx), [facility](../src/app/browse/[slug]/page.tsx), [doctor](../src/app/doctor/[slug]/page.tsx), [tests](../src/tests/publicBrandStyles.test.tsx) |
| Important Improvement — fixed | Contact labels overlapped at 200% root text size despite zero page-level overflow. Contact actions now adapt their grid to text size and wrap; the mobile booking bar can wrap identity/action rows. Screenshots and label-fit assertions verify this. | [Booking view](../src/app/browse/[slug]/BrowseDetailClient.tsx) |
| Important Improvement — release follow-up | Clinical browser Back/Forward protection is not established across engines. The hook handles only cancelable Navigation API traversals; older supported browsers lack that API. Link/reload warnings pass, which does not prove history protection. Verify actual unsaved-note traversal and resolve reproduced loss before clinical approval. No history rewrite or browser PHI persistence was introduced. | [Draft guard](../src/hooks/useUnsavedClinicalChanges.ts), [tests](../src/tests/locationWorkflowRecovery.test.tsx), [Navigation limitations](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) |
| Optional/Future | Background Web Push and offline clinical synchronization are not implemented. Existing notifications use foreground WebSocket/SSE. These are capability limits, not required Phase 1 additions. | [Notifications](../src/components/NotificationRealtime.tsx), [offline status](../src/components/clinical/OfflineStatusBanner.tsx) |
| Optional/Future | No tracked Playwright/Cypress browser CI exists. Temporary CDP/BiDi checks reused installed browsers without dependencies. Field INP, long-session memory, crawler/DB cost and physical low-end performance remain unmeasured. | [Workflow](verification-workflow.md), [CI](../.github/workflows/ci.yml) |

Already Correct within inspected/tested scope:

- Manifest has stable id, dashboard start URL, root scope, any orientation, standalone display, shortcuts and opaque 192/512 icons with maskable safe-circle artwork. Viewport permits zoom and includes viewport-fit=cover; safe-area/reduced-motion styles exist. [Manifest](../public/manifest.json), [layout](../src/app/layout.tsx), [CSS](../src/app/globals.css).
- Worker excludes API/dashboard/auth/clinical/tracker/storage and cross-origin resources; redirected/private/no-store responses cannot be cached. Clinical IndexedDB persistence is retired; deletion is attempted. Success on previously used physical devices remains manual. [Worker](../public/sw.js), [retired storage](../src/lib/offlineStore.ts).
- Dialogs trap/restore focus, isolate background interaction, handle nested overlays and critical-submit dismissal, and fit VisualViewport. Tables already offer mobile cards/filtering/sorting and paging; date/select/input controls have named keyboard paths. This is scoped evidence, not WCAG certification. [Modal](../src/components/ui/Modal.tsx), [focus](../src/hooks/useOverlayFocus.ts), [viewport](../src/hooks/useOverlayViewport.ts), [table](../src/components/ui/Table.tsx).
- API refresh coalesces requests and settles failed waiters. Financial retries retain operation keys in memory. Workspace changes clear scoped stores/query caches and reject stale responses. Browser preferences do not authorize tenants. [API](../src/lib/api.ts), [providers](../src/components/providers.tsx), [auth](../src/store/authStore.ts).
- Booking retains authoritative availability/full/closed/error/expired-plan fallbacks. Shared async buttons prevent repeated activation. Consultation entry failures fail closed; queue refresh preserves loaded UI; failed diagnostic refresh preserves loaded orders without claiming success.
- Uploads return private object references through the canonical API. Printing isolates selected documents and waits for assets/fonts. Actual mobile file pickers, downloads and print dialogs remain manual. [Upload](../src/hooks/useR2Upload.ts), [printing](../src/lib/printBrand.ts).
- QR posters are scanned through the phone camera outside Ekavyu; there is no built-in scanner to certify. Teleconsultation opens a validated external meeting with no-referrer; camera/microphone behavior belongs to that provider. [Poster](../src/components/dashboard/LocationQrPosterModal.tsx), [teleconsultation](../src/app/(dashboard)/dashboard/teleconsultation/page.tsx).
- Authenticated API responses carry no-store; cookie/CSRF/session rotation guards exist. Staging uses one HTTPS dev.ekavyu.com origin, same-origin /api, private services and host-only Secure/Lax cookies. WebAuthn origin/RP ID are configurable. Deployed behavior remains unverified. [Auth middleware](../../backend/middleware/auth.ts), [CSRF](../../backend/middleware/csrf.ts), [staging settings](../../backend/deploy/.env.staging.example).

## Compatibility matrix

PASS applies only to the named scope. Windows headless browsers with resized/emulated viewports are not physical Android/iOS devices. Browser API responses were synthetic intercepted fixtures; SSR used a local fixture API. No production booking/payment/data operation was performed.

| Configuration / gate | Result | Evidence and limits |
| --- | --- | --- |
| Chrome 154.0.8037.98; 320x640, 390x844, 768x1024, 1024x768, 1366x768, 844x390 | PASS | Facility reflow, keyboard containment/Escape, landscape dialog/footer, 200% root text/contact-label fit. Facility and selected-branch doctor journeys reach guest confirmation with pointer input. Full/closed/error, empty roster and expired-plan states prevent progression. |
| Edge 154.0.4258.62; same viewports | PASS | Same scoped fixture journeys/layout/keyboard checks against the final affected UI. |
| Firefox 146.0.1; 320x640, 390x844, 768x1024, 1366x768, 844x390 | PASS | Actual Gecko layout, computed nonce branding, focus containment/Escape, slot selection and guest details. Confirmation/payment not tested in Firefox. |
| Chrome production service worker | PASS | Actual registration/control and public-only cache inspection. Cached icon works while temporary frontend is stopped; uncached browse returns 503; private API has no offline response. CLEAR_USER_CACHE removes product caches. |
| Storage/cache denial; installation cancellation/rejection/repeated calls; cleanup | PASS | Focused adversarial unit/VM tests, not physical-device quota testing. |
| Manifest/icon sizes, opacity, maskable circle | PASS | Existing Sharp-backed asset assertions executed. Actual OS icon/install remains manual. |
| Shared tables/select/date/dialog/touch controls | PASS | Focused jsdom keyboard/focus/gesture/required-validation/retry tests, not every authenticated screen in every engine. |
| Permission boundaries, stale workspace, expiry, refresh/payment retry | PASS | Selected frontend unit and Fastify/Mongoose-memory integration cases. Full role journeys and browser cookie persistence unverified. |
| Production-mode public SEO/HTTP | PASS | 16 gates: visitor/Googlebot/Google-BusinessLinkVerification provider 200, missing 404/noindex, upstream 500, canonical/JSON-LD nonce, sitemap/robots and shared reads, under fixtures. |
| Safari/WebKit desktop; iOS Safari/Home Screen | NOT VERIFIED | No WebKit runtime or Apple device. Safari 16.4+ is a CSS/framework baseline, not an installed booking result. |
| Android Chrome/Samsung Internet; installed PWA; foldable hinge/safe areas | NOT VERIFIED | No physical devices. Viewports exercise layout only, not OS keyboard/touch/app switching/segmentation. |
| Native zoom/OS large text, actual virtual keyboards, screen readers, complete contrast/focus-obscuration | NOT VERIFIED | 320 CSS-pixel reflow/200% root text are probes, not complete equivalence to zoom/AT. VisualViewport has unit coverage. |
| Doctor/reception/admin/root handoff: walk-in → queue → consultation → invoice/payment → report | NOT VERIFIED | Individual boundaries/recovery tested; no persistent browser handoff or external payment completion. |
| Clinical dirty-note Back/Forward/app kill; deployed multi-tab sessions | NOT VERIFIED | See draft-guard limitation. Save Draft online and check every approved clinical browser. |
| Real dev.ekavyu.com TLS/cookies/WAF/API; later ekavyu.com cutover | NOT VERIFIED | No live infrastructure/credentials changed or probed in this task. Existing staging runbook requires separate deployment approval. |
| Android TWA / iOS App Store distribution | NOT VERIFIED | Feasibility researched only; no native project/signing/APK/AAB/publication. |

## Verification actually performed

**186 distinct cases passed: 168 frontend, 18 backend, across 26 selected files.** Ten new regressions failed on original code and passed after fixes. One existing canonical test assumed a fixed JSX child index; it now finds the booking child by its canonical record, preserving its behavior assertions. The affected test was rerun successfully. Counts below exclude reruns.

| Selection | Unique final cases |
| --- | ---: |
| Frontend pwaRecovery; serviceWorkerPrivacy; workspaceIsolation | 26 |
| authAndNavigation; architecturePaymentRetry; experienceContinuity | 19 |
| responsiveControls; installAndInteractionPolish; mobileAppearanceAndGestures | 59 |
| NotificationRealtime; notificationWorkspaceIsolation | 3 |
| consultationEntryIdentity; queueRefresh; locationWorkflowRecovery | 7 |
| r2UploadContract; unifiedPrinting; passkeySignIn | 20 |
| publicBrandStyles; publicDiscovery; publicCanonicalLinks; doctorProfilePage; browseDoctorDetail; cspRegression | 34 |
| Backend auth; securityHardening; notificationsRealtime | 18 |

Frontend command: npm test -- --configLoader native with only the named src/tests files. Backend command: node node_modules/vitest/vitest.mjs run --configLoader native tests/auth.test.ts tests/securityHardening.test.ts tests/notificationsRealtime.test.ts. Backend used its existing Mongo memory-server harness. Changed frontend ESLint: zero errors, seven warnings in existing synchronous-effect/dependency patterns. Diff checks passed. Final Next production build passed compilation/application TypeScript; frontend test files remain excluded from that TypeScript project.

Three production builds were executed as verified findings expanded: storage/PWA corrections, then nonce SSR branding, then screenshot-confirmed text reflow. Each later build verified a changed production artifact. No full suite, installation, backend rebuild, migration or deployment was performed.

Local harnesses used Node WebSocket support, CDP for Chrome/Edge and BiDi for Firefox. Sandbox renderer commands timed out; isolated local browser execution outside the sandbox succeeded. Canceled Firefox interception requests are retained as harness warnings; final application console errors were zero. A first Chrome offline-emulation assertion was invalid because worker networking remained available; final checks stopped the temporary frontend, verified fallback/denial, and restarted it. No product change was made for those harness limitations.

One final Edge automated click missed its target immediately after simulated text resizing. Its evidence was retained; after allowing scrolling/layout to settle before pointer input, all 17 affected Edge gates passed. No additional application defect was reproduced.

Evidence directory: %TEMP%\ekavyu-cross-platform-20261008. Contains before/after, adjacent, backend, branding and final-affected JSON reports; isolated smoke source; runtime JSON/server logs; mobile/320px/large-text/Firefox screenshots; preserved pre-fix large-text screenshot. Build/lint logs: %TEMP%\ekavyu-cross-platform-*.log. Nothing uploaded. The generated .next contains **example.test verification origins** and must be rebuilt for the real release domain.

## Performance and accessibility limits

One Chrome cold-cache sample, worker bypassed, with 4x CPU slowdown, 150ms configured latency and 1.6Mbps download: **LCP 1.22s**, **CLS 0.00011**, **26 resource entries**, approximately **555KB recorded resource transfer**, **3.25s load completion**; document transfer approximately 11.6KB separately. This is one local fixture sample, not field Core Web Vitals, INP, sustained-memory evidence or production DB capacity. No measured bottleneck justified new caching, dependencies or infrastructure.

Sampled token contrast: muted text/white 5.10:1; muted/light background 4.75:1; dark muted/surface 8.19:1; input border/white 3.67:1. All four allowed branch colors contrast with white at 6.02:1 or better. These samples do not cover every opacity/gradient/state or certify WCAG 2.2 AA. Screenshots exposed the label overlap missed by page-width assertions. [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Necessary staging and real-device checks

1. Deploy through the separately approved [staging runbook](../../backend/deploy/STAGING.md), with dev.ekavyu.com, isolated data and matching build/runtime origins. Verify TLS, host-only Secure cookie storage/refresh, CSRF/CORS, private cache controls and API/WebSocket/SSE proxying. Later ekavyu.com cutover needs a domain-specific rebuild and fresh cookie/WebAuthn/PWA checks; dev/apex are distinct sessions/installations.
2. On actual Android and iPhone/iPad, test browser and installed/Home Screen discovery → facility/doctor → guest/patient confirmation/payment. Check keyboard, rotation, safe areas, large text, QR camera entry, clipboard/share, external video/payment switching, return links and refresh. Include Samsung Internet/Safari; Chromium cannot verify WebKit.
3. With synthetic staging accounts, exercise patient self/family boundaries and receptionist walk-in/queue → doctor consultation → cashier payment → patient report. Check durable tenant ownership, denied/repeated/unknown-outcome payments, role restrictions, deep links/refresh/network recovery, admin/root switching in multiple tabs, and revocation on a second tab/stream.
4. Specifically test dirty clinical notes with browser Back/Forward, internal links, refresh and OS termination. Link/reload warnings cannot guarantee every traversal or mobile process kill. Resolve reproduced unsafe loss before clinical approval; do not persist plaintext PHI to solve it. [Navigation API limits](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API), [beforeunload limits](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
5. Test keyboard-only and VoiceOver/TalkBack/NVDA on actual controls/booking flows, native zoom, error announcements and sticky-element focus visibility. Check upload cancellation/large files, private report authorization, downloads/save-to-PDF and thermal/A4 printing on actual operating systems.
6. Install the prior release, open a form, update the worker, and verify no unexpected reload/loss. Check legacy clinical browser-data removal on a previously used device. Inspect Cache Storage after authenticated use/logout; verify no private patient/tenant API data enters it. Test honest offline errors and retry after reconnect.
7. Run normal CI for the final revision and existing deployment health/rollback gates. Measure deployed latency/INP, long-session memory, queue/realtime load and crawler/DB work before adding optimizations.

## PWA and future store verdict

**PWA: conditional for online-first staging; production-installed devices not certified.** Manifest/assets, actual worker and focused recovery pass. iOS has no custom beforeinstallprompt; use OS/browser installation. iOS Home Screen Web Push support does not mean Ekavyu sends background push. Existing safe areas, explicit origins and server persistence provide a simple basis; no native bridge/offline sync is justified now. [MDN prompt rules](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/prompt), [WebKit Home Screen/Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

**Future Android: TWA/Bubblewrap is technically suitable, subject to device/store gates.** TWA uses the browser; it does not repair unsupported web features, connectivity or payment callbacks. Target final HTTPS ekavyu.com after testing; choose a stable package name; secure upload/signing keys; publish /.well-known/assetlinks.json per authorized host with the actual Play App Signing SHA-256 certificate. Test release-signed App Links, private/deep-linked journeys and external returns. No placeholder association file was added. [Android TWA/Bubblewrap](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2?hl=en), [official CLI](https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli), [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started), [signing fingerprints](https://developer.android.com/training/app-links/troubleshoot).

As checked on 2026-10-08, new Play mobile apps/updates require **Android 16/API 36**, effective August 31, 2026. Recheck current policy/tooling at submission; older TWA tutorials are not current target-SDK requirements. [Current API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).

Before submission: accurate Health apps/Data safety declarations, accessible privacy policy, applicable account/data-deletion processes and retention explanations, reviewer access and necessary permissions only. Separate physical healthcare payments from digital SaaS subscriptions/features: web checkout cannot be assumed compliant for every Play transaction. Alternative-billing/market programs require an explicit distribution decision. These are future store gates, not Phase 1 features. [Health declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en), [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-GB), [Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

**iOS App Store is separate.** Home Screen testing is next; TWA is Android-specific. A repackaged website is not assured acceptance under Apple guideline 4.2. Native review/privacy/auth/payment/minimum-functionality requirements need assessment if requested. No wrapper was built. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/).

Implementation references: [React effect cleanup](https://react.dev/reference/react/useEffect), [storage exceptions](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [cache writes](https://developer.mozilla.org/en-US/docs/Web/API/Cache/put), [CSP attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr) (modified April 22, 2026), [Next CSP](https://nextjs.org/docs/app/guides/content-security-policy). Installed Next guides governed framework changes; current Play policies were checked directly.

**Decision:** proceed to approved staging verification. Production/clinical/store GO remains withheld until relevant deployed/device gates pass. No production data, infrastructure, credentials, schema, URLs, permissions or dependencies were changed.
