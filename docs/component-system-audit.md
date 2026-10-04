# Component system audit

Reviewed 2026-10-04. This is a working audit of the existing frontend, not a replacement design system.

## Architecture and inventory

- The application uses Next 16 App Router, React 19, Tailwind 4, TanStack Query 5, Zustand 5, and Lucide. The installed packages are Next 16.3.8, React 19.3.0, Tailwind 4.3.3, TanStack Query 5.104.1, Zustand 5.0.15, and Lucide 1.50.0. No Radix, Headless UI, TanStack Table, form library, or component framework is installed. UI behavior is custom code.
- `src/app/globals.css` defines color, type, radius, shadow, motion, theme, and responsive utilities. `src/components/ui/index.ts` is the shared public barrel. `src/hooks` and `src/lib` provide positioning, focus, viewport, scroll lock, haptics, and error helpers.
- Shared primitives: Button, Input, Textarea, Select, Checkbox, Toggle, DatePicker, Badge, Avatar, Card, Table, Pagination, Tabs, Breadcrumbs, Sidebar, Stepper, Alert, EmptyState, Spinner, Skeleton, Tooltip, Dropdown, Modal, ConfirmDialog, Toast, progress, image upload, charts, print controls, and theme controls.
- Domain components are grouped under `appointments`, `clinical`, `ehr`, `billing`, `pharmacy`, `organization`, `dashboard`, `notifications`, `auth`, `analytics`, and `ai`. The dashboard shell has a separate scroll container and a persistent mobile navigation bar.
- The shared controls are widely consumed: a repository search finds more than 1,600 JSX occurrences of the main Button, Input, Select, Modal, Table, and Card tags. A public API change therefore needs direct consumer checks.

## Findings and sequence

| Priority | Family | Finding | Action |
| --- | --- | --- | --- |
| P0 | Overlay and scrolling | Dialogs lock the document, while dashboard content scrolls in its own `<main>`. Portaled overlays used unrelated z-index values. | Lock the dashboard scroll region with the document; use a named layer scale for dialog, popover, tooltip, toast, and route progress. Verify nested overlays and navigation. |
| P0 | Loading | Next route fallbacks, dashboard auth fallback, page skeletons, and local action spinners coexist. Table displayed a progress shimmer alongside initial skeleton rows. | Keep structural skeletons for initial data; use a progress indicator only when retained table rows refresh. Audit route/page pairs for sequential fallbacks and action loaders next. |
| P1 | Button | One-line text, hidden overflow, fixed desktop heights, and a measured loading width could clip labels on narrow layouts. | Allow labels and loading text to wrap, keep icons fixed, let height grow, and preserve the current variants and async behavior. |
| P1 | Forms | Input, Textarea, and Checkbox displayed only parent-provided errors. Select had native submit validation but little pre-submit feedback. There is no central FormField or validation library. | Expose native constraint errors after interaction and clear them as validity returns; preserve explicit server/business errors. Review custom validation in each high-value form separately. |
| P1 | Notifications | Toasts portal to `body`, but their layer was a magic number and popup layers were higher than toast. Preview uses Modal and viewport positioning. | Put all portal layers on one scale; keep the toast above navigation and dialogs, and popups above their owning dialog. |
| P1 | Tooltip | Portaled tooltips were not linked to their trigger with `aria-describedby`; edge placement used the layout viewport and scroll listeners were not fully removed. | Associate the trigger and tooltip, bound long content to the visible viewport, and keep hovered content available until dismissal. |
| P2 | Table | Mobile cards, sorting, filters, selection, CSV, pagination, and skeletons already exist. Default desktop cells have heavy vertical rules, uppercase headers, and no long-value wrapping. | Make default rows easier to scan, reserve vertical rules for `bordered`, wrap long values, and retain the existing desktop/mobile feature set. Context-specific mobile representation remains a consumer choice. |
| P2 | Card and empty states | Card is a useful grouping primitive, but several screens nest cards. Shared EmptyState is oversized and animated for routine no-results states. | Make the shared empty state compact. Review nested card composition in individual screens when changing those pages. |
| P3 | Navigation and layout | Shared Sidebar, Tabs, Breadcrumbs, dashboard header, and mobile bottom nav exist. Header and filter composition vary by route. | Review common page headers and dense dashboard workflows at 320, 390, 768, 1024, and 1440 px; migrate page-specific overrides carefully. |
| P4 | Domain UI | Clinical, booking, billing, and patient components reuse primitives but own workflow-specific states. | Audit by workflow with focused tests and preserve permissions, patient data, booking, and payment behavior. |

## Guidance used

- Installed Next documentation: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`, `layout.md` in the same directory, and `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`.
- [React input documentation](https://react.dev/reference/react-dom/components/input): native validation events and controlled input behavior.
- [Tailwind overflow-wrap documentation](https://tailwindcss.com/docs/overflow-wrap): wrapping inside flex layouts.
- [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus ownership, inert background, and Escape behavior.
- [WAI tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/): focus and hover behavior, Escape, and `aria-describedby`.
- [WAI sortable table example](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/): sorting semantics in headers.

## Verification boundary

The shared changes are Level 3 under `docs/verification-workflow.md`. Run changed-file lint, direct and consumer Vitest files, and TypeScript when shared types or JSX could fail. The repo has no browser automation; visual checks at the target widths still need a browser session. Full CI gates remain the release checkpoint.

`vitest.config.mts` sets `isolate: false`. Files that mock the same framework module can affect one another in a combined local run. Use `--isolate` for cross-file UI regression selections; each affected test file also passes independently.

This pass implemented the P0 and P1 shared fixes above plus the first Table and EmptyState refinements. The remaining page composition and clinical/business component review stays on the sequence above; the inventory alone is not evidence that every screen has been visually checked.
