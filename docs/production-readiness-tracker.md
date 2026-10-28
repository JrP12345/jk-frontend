# Frontend operational release gates

Current operational requirements, consolidated 2026-10-24. Source cleanup and local verification are recorded in [pre-production-cleanup.md](pre-production-cleanup.md). Interface decisions: [design-system.md](design-system.md), [visual identity](design-system.md#brand-assets-and-print-appearance), [homepage](homepage-design.md) and [domain model](domain-model-audit.md).

## Browser and deployment checks

- Build with the deployed absolute HTTPS API origin. NEXT_PUBLIC_API_URL is compiled into browser code; changing a runtime environment cannot repair a previously built artifact. Server rewrites must target the backend rather than loop through the frontend. Keep CSP, HTTPS, cookie, CSRF and session guards.
- Review full-width public navigation, mobile bottom navigation and the separate dashboard toolbar at mobile/tablet/desktop widths in light/dark, reduced motion, keyboard navigation and enlarged text. Check overlays, focus restoration, errors and recovery. Earlier viewport reports are not a new authenticated production journey.
- Exercise login, OTP/MFA, a real hardware passkey, session revocation, patient/family authority and selected organization context in a designated test environment. Anonymous browse/setup should not request a login session.
- Exercise slug-only discovery/join, saved setup request and Root inbox, booking/payment recovery, desk arrival, queue continuity, consultation/printing, laboratory files, billing/refund review and organization branding. A background refresh retains loaded data and errors provide retry.
- Confirm current leaf icons, Ekavyu manifest identity, service-worker assets and install behavior on actual mobile devices. Browser cache clearing does not replace an OS-managed launcher icon directly.

## Source and release evidence

CI retains TypeScript, full lint/tests, payment-boundary checks, dependency audit and production build. Frontend TypeScript excludes test files; Vitest is their runtime check. Focused consumer tests use mocked APIs and do not certify live payment settlement or deployed provider delivery.

Complete backend [runtime, provider, recovery and capacity gates](../../backend/docs/production-readiness-tracker.md), authenticated browser checks and hosted CI before release. No deployment, hardware passkey prompt or live provider transaction was performed by source cleanup.

## Security, recovery and configured-provider acceptance

1. Review actual configured staff grants, including nurses/custom roles; assign deliberately
   reviewed branches before enabling access. Communicate an MFA deadline and rehearse primary
   sign-in, enrollment, loss/recovery and membership changes with real authenticators.
2. Verify deployed HTTPS/certificates, firewall/origin protection, exact proxy topology,
   cookie domain/SameSite/Secure/HttpOnly, CORS/CSRF, WebSocket origins and cache headers.
3. Confirm Mongo TLS/ACLs/replica set and indexes, private R2/backup policies, upload
   quarantine/accepted-file risk, persistent encryption/signing/JWT keys and independent
   escrow. Review repository history and historical/external logs for secret/PHI exposure.
4. Perform an authorized real snapshot/PITR restore with keys, indexes, patient reads,
   audit integrity, booking/clinical/billing/file workflows and workers. Record RPO/RTO,
   recovery ownership and rollback evidence. Archive codec tests are not recovery proof.
5. Validate each deployed worker and alerts, and real provider sandbox callbacks,
   financial reconciliation/refunds, SMTP and WhatsApp consent/delivery. Do not enable
   unaccepted AI, ABDM, PACS, video or SSO integrations based on source inspection alone.
6. Complete hosted CI/release gates, representative capacity measurements and designated
   authenticated browser/device acceptance across the enabled role/module matrix.

P1 acceptance should use a reviewed clinic configuration and currency. Mixed-currency
historical/global executive reporting and long-record search capacity need explicit
deployment acceptance; daily cards separate currencies, but this task does not certify
every legacy/global reporting assumption. Existing lint debt remains. Optional integrations
and route/state combinations outside the focused checks are unverified, not assumed safe
or functional. No production data, credentials, infrastructure or deployment was changed.

## Staging and domain handoff

The intended staging origin is `https://dev.ekavyu.com`; an apex cutover to `https://ekavyu.com` is a separate action. The executable source of truth is the backend [staging runbook](../../backend/deploy/STAGING.md). Local configuration checks do not establish deployed TLS, cookies, database capacity or recovery.

1. Approve/provision the VM and staging Atlas/replica set; restrict network/database access. Set dev DNS without changing the apex.
2. Configure persistent private secrets, a staging bucket and test-only payment/email credentials when those journeys are exercised. Obtain passing normal CI for the committed backend/frontend revisions.
3. Build the correctly configured application/operator images; validate Caddy. Explicitly authorize fresh DB index/account writes and encrypted MFA enrollment before public startup.
4. Start the staging stack, verify all container readiness, then finish real-phone authentication/booking/payment/resource/privacy checks. Retain previous images/config and private DB/secret backups for manual rollback.
5. After staging acceptance, approve the ekavyu.com release: choose the production data/backup plan, rebuild the frontend for the apex, update cookies/WebAuthn/webhook configuration, switch marketing DNS/hosting deliberately and use production Caddy without staging noindex. Passkeys tied to dev require re-enrollment on the apex.

**No cloud/DNS/deployment action, production-data mutation or credential change was executed.** Only local source/configuration and ephemeral test data changed. Git's case-only ignore-file rename is staged by git mv; no commit or push was made.

## Browser, PWA and physical-device scope

### Compatibility matrix

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

### Performance and accessibility limits

One Chrome cold-cache sample, worker bypassed, with 4x CPU slowdown, 150ms configured latency and 1.6Mbps download: **LCP 1.22s**, **CLS 0.00011**, **26 resource entries**, approximately **555KB recorded resource transfer**, **3.25s load completion**; document transfer approximately 11.6KB separately. This is one local fixture sample, not field Core Web Vitals, INP, sustained-memory evidence or production DB capacity. No measured bottleneck justified new caching, dependencies or infrastructure.

Sampled token contrast: muted text/white 5.10:1; muted/light background 4.75:1; dark muted/surface 8.19:1; input border/white 3.67:1. All four allowed branch colors contrast with white at 6.02:1 or better. These samples do not cover every opacity/gradient/state or certify WCAG 2.2 AA. Screenshots exposed the label overlap missed by page-width assertions. [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

### Necessary staging and real-device checks

1. Deploy through the separately approved [staging runbook](../../backend/deploy/STAGING.md), with dev.ekavyu.com, isolated data and matching build/runtime origins. Verify TLS, host-only Secure cookie storage/refresh, CSRF/CORS, private cache controls and API/WebSocket/SSE proxying. Later ekavyu.com cutover needs a domain-specific rebuild and fresh cookie/WebAuthn/PWA checks; dev/apex are distinct sessions/installations.
2. On actual Android and iPhone/iPad, test browser and installed/Home Screen discovery → facility/doctor → guest/patient confirmation/payment. Check keyboard, rotation, safe areas, large text, QR camera entry, clipboard/share, external video/payment switching, return links and refresh. Include Samsung Internet/Safari; Chromium cannot verify WebKit.
3. With synthetic staging accounts, exercise patient self/family boundaries and receptionist walk-in/queue → doctor consultation → cashier payment → patient report. Check durable tenant ownership, denied/repeated/unknown-outcome payments, role restrictions, deep links/refresh/network recovery, admin/root switching in multiple tabs, and revocation on a second tab/stream.
4. Specifically test dirty clinical notes with browser Back/Forward, internal links, refresh and OS termination. Link/reload warnings cannot guarantee every traversal or mobile process kill. Resolve reproduced unsafe loss before clinical approval; do not persist plaintext PHI to solve it. [Navigation API limits](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API), [beforeunload limits](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
5. Test keyboard-only and VoiceOver/TalkBack/NVDA on actual controls/booking flows, native zoom, error announcements and sticky-element focus visibility. Check upload cancellation/large files, private report authorization, downloads/save-to-PDF and thermal/A4 printing on actual operating systems.
6. Install the prior release, open a form, update the worker, and verify no unexpected reload/loss. Check legacy clinical browser-data removal on a previously used device. Inspect Cache Storage after authenticated use/logout; verify no private patient/tenant API data enters it. Test honest offline errors and retry after reconnect.
7. Run normal CI for the final revision and existing deployment health/rollback gates. Measure deployed latency/INP, long-session memory, queue/realtime load and crawler/DB work before adding optimizations.

### PWA and future store verdict

**PWA: conditional for online-first staging; production-installed devices not certified.** Manifest/assets, actual worker and focused recovery pass. iOS has no custom beforeinstallprompt; use OS/browser installation. iOS Home Screen Web Push support does not mean Ekavyu sends background push. Existing safe areas, explicit origins and server persistence provide a simple basis; no native bridge/offline sync is justified now. [MDN prompt rules](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/prompt), [WebKit Home Screen/Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

**Future Android: TWA/Bubblewrap is technically suitable, subject to device/store gates.** TWA uses the browser; it does not repair unsupported web features, connectivity or payment callbacks. Target final HTTPS ekavyu.com after testing; choose a stable package name; secure upload/signing keys; publish /.well-known/assetlinks.json per authorized host with the actual Play App Signing SHA-256 certificate. Test release-signed App Links, private/deep-linked journeys and external returns. No placeholder association file was added. [Android TWA/Bubblewrap](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2?hl=en), [official CLI](https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli), [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started), [signing fingerprints](https://developer.android.com/training/app-links/troubleshoot).

As checked on 2026-10-08, new Play mobile apps/updates require **Android 16/API 36**, effective August 31, 2026. Recheck current policy/tooling at submission; older TWA tutorials are not current target-SDK requirements. [Current API policy](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).

Before submission: accurate Health apps/Data safety declarations, accessible privacy policy, applicable account/data-deletion processes and retention explanations, reviewer access and necessary permissions only. Separate physical healthcare payments from digital SaaS subscriptions/features: web checkout cannot be assumed compliant for every Play transaction. Alternative-billing/market programs require an explicit distribution decision. These are future store gates, not Phase 1 features. [Health declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en), [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-GB), [Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

**iOS App Store is separate.** Home Screen testing is next; TWA is Android-specific. A repackaged website is not assured acceptance under Apple guideline 4.2. Native review/privacy/auth/payment/minimum-functionality requirements need assessment if requested. No wrapper was built. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/).

Implementation references: [React effect cleanup](https://react.dev/reference/react/useEffect), [storage exceptions](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [cache writes](https://developer.mozilla.org/en-US/docs/Web/API/Cache/put), [CSP attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr) (modified April 22, 2026), [Next CSP](https://nextjs.org/docs/app/guides/content-security-policy). Installed Next guides governed framework changes; current Play policies were checked directly.

**Decision:** proceed to approved staging verification. Production/clinical/store GO remains withheld until relevant deployed/device gates pass. No production data, infrastructure, credentials, schema, URLs, permissions or dependencies were changed.
