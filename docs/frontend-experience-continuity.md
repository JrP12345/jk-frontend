# Frontend experience continuity — audit and implementation plan

Reviewed on 2026-09-27, after the existing responsive and Ekavyu identity work.
This work refines the existing frontend. It does not change backend contracts,
clinical/financial rules, authorization, branding or production configuration.
The backend security-remediation changes remain separate and pending deployment.

## Audit before code changes

Inventory and structural review covered all 211 files under `src` and all 45
`page.tsx` entrypoints: public browsing/booking/track/check-in/pricing, authentication,
dashboard clinical and operational pages, patient records, billing, organization
and master-admin screens, settings and notifications. Detailed tracing focused on
the shared shell/navigation, route fallbacks, tables/buttons/toasts, Axios client,
providers/stores and browse/patient/staff/clinic/catalog/organization listings.
This is not a claim that every branch has been exercised in a browser.

Keep: persistent dashboard layout, Next Link prefetching, permission/module-filtered
navigation, mobile bottom navigation/drawers, reduced-motion CSS, focus/scroll-lock
ownership, shared controls, existing skeletons, contextual clinical retry alerts,
lazy AI loading, server pagination where already implemented and single-flight
token refresh. Do not add a second cache architecture or optimistic clinical/payment
mutations. Existing errors must retain meaningful domain validation instructions.

## Prioritized plan

| Priority | Page / component | Current problem | User impact | Recommended behavior | Implementation approach |
| --- | --- | --- | --- | --- | --- |
| P0 | Browse listing | Fetch failure is followed by the same empty-directory message as a successful empty response | Users cannot tell failed loading from unavailable care | Show a contextual retry error; reserve empty state for a completed successful query; retain and label previous results during refresh/failure | Existing Alert/Button and existing abortable request; validate response shape and track successful load |
| P0 | Patient and catalog search | Overlapping queries can finish out of order; catalog requests run on every keystroke | Older results can replace newer search; request noise and flicker | Debounce search, cancel obsolete reads, commit only the latest response; retain loaded rows | Small reusable read-request controller, existing Axios AbortSignal support; preserve server query/pagination contract |
| P0 | Organizations / catalog / radiology listings | Failed initial reads only toast and leave empty tables | Failures resemble absent organizations/services/studies after the toast disappears | Persistent contextual error with retry; retain loaded records on background failure | Existing Table error/onRetry pattern and safe human-readable error messages |
| P1 | Core desktop/mobile navigation | Global progress intercepts arbitrary link clicks before Next handles them; modified/cancelled clicks can leave a simulated bar | False loading signal or stuck progress | Reflect actual Next Link pending state; suppress hints for fast navigation | Installed Next `useLinkStatus`, shared delayed indeterminate indicator; retain layouts and native scroll behavior |
| P1 | Clinics / staff / tables | Loaded clinic content is replaced by a skeleton during refresh; shared tables block all pointer interaction while refreshing | Workspace feels unavailable despite existing data | Use skeleton only before initial data; show a small refresh status and keep existing rows usable | Reuse existing loading flags and Table; reserve indicator space and avoid whole-page blocking |
| P1 | Shared submit buttons | Adding a spinner or longer loading label changes button width and moves adjacent actions | Actions jump immediately after clicking | Keep the idle button content as the size reference while overlaying processing feedback | Existing Button loading/disabled semantics; same minimum touch target and accessible processing label |
| P2 | Shared error feedback | Many pages forward backend/database messages directly into toasts | Technical details replace actionable instructions | Keep ordinary validation messages; replace stack/JSON/database/path details with a concise fallback | Presentation-layer error-message helper in shared Toast; preserve original transport errors for business/error classification |
| P2 | Route skeletons / movement | Some route fallbacks use arbitrary widths and generic page fade-in; mobile placeholders can exceed available space | Layout shift or blank visual stage | Bounded skeleton geometry; no unnecessary page-wide entrance animation | Existing Skeleton primitives and responsive classes; retain reduced-motion behavior |
| P3 | Route/data performance | Entire bundle totals are not initial transfer or measured interaction latency | Blanket optimization can add complexity without a benefit | Measure actual routes before adding virtualization/new caching | Browser checks and existing build/test tooling; no dependency additions |

## Verification and scope

Add regression tests for initial failure versus empty results, retained records,
out-of-order queries, nonblocking table refresh, actual navigation pending and
stable processing controls. Run frontend tests, TypeScript, affected-file lint,
production build and local mobile/tablet/desktop checks where browser access is
available. Browser API fixtures must not execute real bookings/payments/messages.
Record actual results and any unverified real-device/network behavior here.

## Implemented

All P0 and P1 items in this plan are implemented. Browse validates array responses,
distinguishes failures from successful empty results and labels retained clinics
during refresh/failure. Patient search commits its debounced query and page together;
patient/catalog/organization/radiology reads cancel superseded requests and reject
late responses even if a transport ignores cancellation. Catalog search debounces
at 300ms. Catalog, organization and radiology tables now have persistent errors and
retry actions. No write request is cancelled or automatically replayed.

Existing clinic content remains visible during refresh. Staff/patient/organization
tables now expose background refresh; the shared Table reserves its indicator space,
announces busy state and keeps loaded row actions usable. Native Next Link pending
state drives a delayed indeterminate bar for sidebar, bottom navigation and the
public brand link. Programmatic navigation retains native route loading fallbacks.
The old global click interceptor and simulated percentage are removed.

Shared Button retains idle content for sizing, overlays its processing content and
keeps disabled/busy/accessibility semantics. Long processing labels truncate within
the existing width and have a complete accessible label. Route wrappers no longer
fade the entire page; dashboard skeleton widths are bounded on phones. Existing
page-specific animations and reduced-motion rules remain.

The P2 shared error-message helper filters technical details only when presenting
error toasts, preserving ordinary validation text and original Axios error objects.
It is not a claim that every existing inline error has been migrated. P3 route
profiling/virtualization remains optional; no new dependencies or cache layer were
introduced.

## Validation results — 2026-09-27

- Frontend: **105 tests passed across 16 files**. New regression coverage includes
  actual catalog responses resolving out of order, debounce, aborted/unmounted
  reads, persistent errors/retry, browse response-shape failure, failed-load versus
  true empty results, retained clinics, usable table actions, duplicate submit
  prevention, pending-navigation cancellation and technical-message filtering.
- `npx tsc --noEmit`: passed. `npm run build`: passed, including the production
  TypeScript check and all 41 static-generation entries.
- Affected-source lint: **zero errors, 32 warnings** (existing hook/unused-variable
  patterns included). Final changed-test lint: zero errors/warnings. Git diff
  whitespace check passed.
- Headless Chrome against the local production bundle: browse has no document
  horizontal overflow at **320, 390, 768 and 1280px**; existing clinics survive a
  failed search; a subsequent successful empty response shows the true empty state
  and clears the error. Other routes were covered by source/type/test/build checks,
  not by a full authenticated browser walkthrough.
- Browser requests used local/intercepted fixtures. The test browser bypassed CSP
  and the service worker to isolate mock HTTP requests; application security and
  PWA configuration were not changed. These checks do not certify deployed CSP,
  offline behavior, real-device keyboards, screen readers or integration transactions.
- Temporary browser script/profile and local test services are removed after
  validation. No production deployment, booking, payment or message was performed.
