# Frontend operational release gates

Current requirements, 2026-10-07. Source cleanup and local verification are recorded in [pre-production-cleanup.md](pre-production-cleanup.md). Interface decisions: [design-system.md](design-system.md), [visual identity](ekavyu-visual-identity.md), [homepage](homepage-design.md) and [domain model](domain-model-audit.md).

## Browser and deployment checks

- Build with the deployed absolute HTTPS API origin. NEXT_PUBLIC_API_URL is compiled into browser code; changing a runtime environment cannot repair a previously built artifact. Server rewrites must target the backend rather than loop through the frontend. Keep CSP, HTTPS, cookie, CSRF and session guards.
- Review full-width public navigation, mobile bottom navigation and the separate dashboard toolbar at mobile/tablet/desktop widths in light/dark, reduced motion, keyboard navigation and enlarged text. Check overlays, focus restoration, errors and recovery. Earlier viewport reports are not a new authenticated production journey.
- Exercise login, OTP/MFA, a real hardware passkey, session revocation, patient/family authority and selected organization context in a designated test environment. Anonymous browse/setup should not request a login session.
- Exercise slug-only discovery/join, saved setup request and Root inbox, booking/payment recovery, desk arrival, queue continuity, consultation/printing, laboratory files, billing/refund review and organization branding. A background refresh retains loaded data and errors provide retry.
- Confirm current leaf icons, Ekavyu manifest identity, service-worker assets and install behavior on actual mobile devices. Browser cache clearing does not replace an OS-managed launcher icon directly.

## Source and release evidence

CI retains TypeScript, full lint/tests, payment-boundary checks, dependency audit and production build. Frontend TypeScript excludes test files; Vitest is their runtime check. Focused consumer tests use mocked APIs and do not certify live payment settlement or deployed provider delivery.

Complete backend [runtime, provider, recovery and capacity gates](../../backend/docs/production-readiness-tracker.md), authenticated browser checks and hosted CI before release. No deployment, hardware passkey prompt or live provider transaction was performed by source cleanup.
