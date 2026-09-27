# Frontend refinement audit and implementation

The 2026-09-27 Ekavyu theme migration is documented in
[ekavyu-visual-identity.md](ekavyu-visual-identity.md). It replaces selectable
palettes with one light/dark identity while retaining the responsive controls
and workflows below. The supplied transparent leaf artwork is now used across
shared logos and browser/install icons, with “Care That Keeps Moving” as tagline.

Reviewed and implemented on 2026-09-27. This is a refinement of the existing
Ekavyu interface. It does not replace the product, change backend contracts,
or approve a production deployment.

## Audit before implementation

The study covered all 209 frontend source files through source inventory and
structural analysis, with detailed review of layouts, theme/provider code,
shared controls, permissions, services and the principal clinical and public
flows. A browser baseline verified the crowded dashboard header at 320px.

1. **Architecture:** Next.js App Router; React; Tailwind theme tokens; shared
   `components/ui` controls; Zustand authentication, clinic and module stores;
   Axios requests; TanStack Query for notifications and selected settings.
2. **Strengths:** Established branding and palettes, dark mode, role/module
   filtering, bottom navigation, mobile cards, loading indicators and existing
   booking/clinical workflows are worth retaining.
3. **Missing UX:** Failed requests sometimes resemble empty records. Mobile
   cards omit table selection, sorting and column filtering.
4. **Mobile:** The header overlaps at 320px; table/dialog breakpoints change at
   640px rather than the requested 768px; small controls and floating surfaces
   require more touch space and viewport bounds.
5. **Tablet:** A 256px sidebar appears at 768px and crowds the remaining workspace.
6. **Desktop:** Dataset changes can leave pagination on a nonexistent page;
   menus and tabs need actual keyboard focus movement.
7. **Consistency:** Controls use different heights and mobile breakpoints;
   install prompts, bulk actions and the AI launcher compete with bottom navigation.
8. **Accessibility:** Dialog IDs repeat; portaled controls conflict with focus
   trapping; menus lack roving focus; labels and secondary text need correction.
9. **Performance:** Large clinical pages remain expensive to maintain. Table
   search repeats deep extraction and card hover effects rerender on every move.
   The AI panel is eagerly imported into the dashboard shell.
10. **Dead code:** Unused glass, table-card and Vuesax CSS helpers and duplicate
    reduced-motion rules were verified against frontend consumers.
11. **Priorities:** Critical inaccessible mobile table actions; high-impact
    header/sidebar and dialog/menu behavior; then recovery states, consistency,
    contrast, performance and confirmed dead styles.
12. **Plan:** Fix the shared shell/table first; improve dialog and popover focus
    and placement; standardize controls, tabs and pagination; add contextual
    recovery to primary screens; remove confirmed dead styles; run unit tests,
    types, lint, build and browser verification across seven widths.

## Findings and resulting changes

| Priority | Location and verified issue | Why it matters / mobile impact | Implementation and reuse |
| --- | --- | --- | --- |
| Critical | Shared Table cards lose sorting, filtering and selection | Bulk workflows and result discovery are unavailable on phones | Existing Select, Input, Checkbox and Button restore the controls; custom mobile cards retain selection; secondary fields remain in expandable details |
| High | Dashboard header overlaps; sidebar opens at tablet width | Controls compete for space and clinical content is squeezed | Full-width clinic row below the phone header; off-canvas sidebar below 1024px; existing sidebar/bottom nav retain their route filtering |
| High | Modal IDs repeat and nested popovers escape the trap | Keyboard users can lose focus or close the wrong dialog | Unique IDs; shared focus ownership; topmost Escape handling; existing reference-counted scroll lock and submission guards retained |
| High | Dropdown focus and floating placement are incomplete | Menus can extend outside narrow screens; arrow keys only change decoration | Existing Dropdown moves real focus, skips disabled items, restores triggers and bounds the menu; shared placement also serves Select, DatePicker and notifications |
| High | Failed primary requests look empty | Users cannot distinguish missing data from a network failure | Existing Alert and Button provide contextual retry states on appointments, patients, billing, queue, staff, clinics, laboratory, pharmacy, consultations, notifications, settings and patient portal |
| High | Dark utilities follow the OS while tokens follow the app | Explicit light mode can use pale dark-mode text | Tailwind dark variant now follows the existing ThemeProvider class; muted tokens and action colors retain their hue with stronger contrast |
| Medium | Touch controls and dialogs switch at inconsistent widths | The 640–767px range behaves like desktop | Shared controls/card views remain mobile through 767px; readable native input text; bounded dialogs use dynamic viewport height; desktop controls remain compact |
| High | Queue and billing header actions extend outside clipped containers; long invoice text crowds status badges | Essential actions can disappear even when the page has no horizontal scrollbar | Stack header content and wrap action groups within the available workspace; keep invoice text shrinkable and wrap long identifiers |
| Medium | Long clinic names and translated operational status exceed listing cards | Narrow cards obscure names and opening information | Bound the existing name link and let city/status information wrap inside the card |
| Medium | Pagination outlives a page; mobile numeric pagination is wide | Refreshes can produce a false empty state or overflow | Clamp vanished pages and retain compact previous/page/next controls on phones |
| Medium | Tabs reuse IDs and do not move keyboard focus | Multiple instances conflict; overflow indicator drifts | Unique IDs, real arrow/Home/End focus, scroll-aware indicator and reduced-motion scrolling |
| Medium | Clickable public clinic cards contain links | Nested interactive roles confuse assistive technology | Shared Card supports group semantics; existing clinic links and whole-card pointer navigation are preserved |
| Medium | App language switching duplicates browser translation | Public navigation adds a language control and regional overrides | Removed the language menu, dictionaries and automatic language switching; serve English and use the browser's native translation |
| Medium | Lock screen lacks dialog focus ownership | Keyboard navigation can reach underlying content | Named, focus-contained lock dialog; password label/error association; foreground priority; existing unlock/sign-out policy unchanged |
| Medium | Install banner and launcher compete with bottom bar | Persistent controls obscure one another | Install prompt moves above the page; launcher and bulk bar respect navigation/safe-area spacing |
| Medium | Deep search extraction and hover React updates repeat work | Interaction cost grows with data and pointer movement | Cache row search strings; update cursor position via CSS variables; split the existing AI panel into a separate client chunk |
| Cosmetic | Unused styling helpers and duplicate motion rules | Extra CSS obscures the active system | Remove confirmed-unused helpers and retain one final reduced-motion override |

No dependency was added. Existing UI components, tokens and architecture were
reused. Backend files, authorization guards, routes, API payloads, booking rules,
financial calculations and clinical transitions were not changed by this work.
Native Select form values and required validation remain active. DatePicker's
existing string/event callback compatibility was retained.

## Verification

Final verification results are recorded in
[production-readiness-tracker.md](production-readiness-tracker.md).
Browser checks use local mock API responses, including long names, seeded
records and empty lists. They do not execute real clinical, payment or provider
transactions. Automated accessibility checks supplement keyboard and viewport
checks; they do not replace assistive-technology and real-device testing.

The interrupted work was resumed and its remaining clipping defects were fixed
on 2026-09-27. Final viewport checks also inspect descendants, because an
`overflow-hidden` container can hide actions without producing page overflow.
Temporary browser scripts, JSON reports, screenshots and the dedicated Chrome
profile are removed after their results are recorded in the validation tracker.

## Separate decisions and operational work

- The app's translation layer was removed on 2026-09-27 at the user's request.
  Public navigation, clinic listings and booking use English directly, with
  `lang="en"` on the root document. Translation is handled by the browser's
  built-in controls where supported. Location detection still selects nearby
  cities, and doctor language and queue voice settings retain their separate uses.
  Validation: all 78 frontend tests passed; the production build and its
  TypeScript checks passed; lint on the affected files reported zero errors
  and 22 existing warnings. Temporary migration scripts were removed.
- Large queue, appointments and billing files remain in the existing architecture.
  Extracting business modules or changing pagination to a server contract needs
  a separate scoped change. No virtualization library was introduced.
- The historical DatePicker callback calls both string and event forms. Removing
  that compatibility needs a coordinated caller migration; it was preserved.
- Backend request races, transaction failure reconciliation, provider credentials,
  payment capture, clinical approvals and real production data require their
  existing operational checks. Mock UI checks cannot certify them.
- Live deployment, real-device virtual keyboards, screen-reader sessions and
  third-party integrations remain release checks. No release was deployed.
