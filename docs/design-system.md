# Ekavyu interface system

Current decisions, 2026-10-07. The implementation uses Next App Router, Tailwind 4, globals.css and shared React primitives in src/components/ui. Keep one shared control and appearance system.

## Navigation and layout

Public headers and mobile bottom navigation are full-width. The dashboard toolbar stays above its separate content scroller with established spacing and safe areas. Do not introduce inset, floating or rounded navigation containers. Preserve permission-filtered destinations, aria-current, mobile indicators and browse spacing beneath the fixed header.

Use the shared title, section, body and caption scales, layout gutters and section spacing. Containers use the container radius; controls use the control radius. Keep compact, comfortable and spacious table density choices.

## Appearance

Semantic surface, text, border, accent and status tokens in globals.css are the source of truth. Light appearance uses a warm neutral canvas; dark appearance uses layered charcoal surfaces. Fixed brand colors remain separate from semantic appearance. Print colors remain fixed for paper. Tenant brand colors and QR specifications are data.

Use bg-surface, bg-surface-elevated, text-text-secondary, border-input-border and status subtle/text pairs. Consumers use canonical semantic variables directly. Numbered secondary/status aliases and unused surface aliases have been removed. The primary ramp remains a current brand scale.

ThemeProvider and the pre-hydration bootstrap share light/dark/system resolution and the ekavyu-mode preference. Storage restrictions retain a usable in-memory appearance. System mode responds to OS changes.

## Shared controls

Input, Select, Textarea and DatePicker use controlStyles.ts. Preserve validation, IDs, described-by errors, readable disabled states and opaque keyboard focus. Buttons keep caller variants and asynchronous handling. Card offers default, outline and flat surfaces; a loading card is busy and inert. Static content has quiet surfaces.

Dialogs, sheets, menus and popovers retain portals, focus handling/restoration, dismissal and scroll locks. Material tokens are limited to the selected compact controls and elevated popovers. They have opaque rendering for unsupported filters, reduced transparency, increased contrast and forced colors. Navigation and large content surfaces stay solid. Avoid full-viewport blur and blanket GPU layers.

Tables preserve search, sort, export, selection and pagination. Tabs use stable selection without spring scaling. Alerts, badges and toasts combine text/icons with status colors and retain live regions and timers. Skeletons respect reduced motion; empty and error states provide useful recovery.

The responsive BarChart has one measured-width implementation. Labels, legends and values stay readable. Clinical and billing print output retains its paper palette.

## Accessibility and verification

Preserve keyboard focus, semantic labels, mobile 44px targets, reduced motion and text enlargement. Public page illustrations/layout belong in CSS Modules. Keep current control contracts and business rules.

Use [verification-workflow.md](verification-workflow.md) to select direct controls, theme/overlay and consumer checks. Package TypeScript does not cover frontend test files. Prior viewport reviews are recorded in [production-readiness-tracker.md](production-readiness-tracker.md); final cleanup validation is recorded in [pre-production-cleanup.md](pre-production-cleanup.md).
