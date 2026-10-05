# Ekavyu homepage: clarity redesign and product evidence

## Current decision

**Practice management software for doctors, clinics and care teams, with connected patient discovery, booking and visit information.**

The selected concept is **Your practice day**. The root page first establishes the software category and the team's daily work, then follows one illustrative visit from booking to reception, consultation and recorded information.

The healthcare organization is the primary commercial customer. Patients participate through the same system. Organization-scoped subscriptions, staff permissions, location assignments and operational workspaces support this positioning; they do not establish measured adoption, revenue or market leadership.

Primary action: **Request setup**, using the existing assisted organization request. Secondary action: **Find care**, opening the existing provider directory.

## 1–6. Diagnosis before implementation

### Current-page diagnosis

The previous “Run your practice. Connect your patients.” version was clearer than its patient-first predecessor, but still made visitors interpret the product.

- “Healthcare software” appeared in a small label while the largest headline expressed a broad promise.
- The large paired patient/team preview competed with the category statement. Visitors could read it as a booking product with a clinic add-on.
- The hero preview, journey summary and later workbench repeated the visit story instead of progressively proving it.
- Hospital language in the initial category suggested more scope than the inspected workflows establish.
- An oversized patient records composition gave the secondary audience another dominant visual moment.
- Repeated medium-sized sections diluted the difference between understanding the product, seeing it work and evaluating it.

### Five-second interpretation before this redesign

A first-time visitor could reasonably infer **clinic software plus online booking**. The relationship between the paid team workspace and patient entry remained less immediate. “Practice management” was not the dominant category, and the visual hierarchy required comparing two sides of the product.

This is an editorial outside-visitor assessment, not a timed user study.

### Correct positioning in one sentence

Ekavyu is practice management software that brings appointments, reception and consultations into one workspace, with connected patient discovery, booking and visit information.

### Primary customer

The doctor or person running a practice, clinic or healthcare team, including larger and multi-location organizations within the supported workflows and selected plan. Receptionists, doctors and staff are recurring operational users. The organization is the SaaS subscription customer.

### Secondary participant

Patients find providers, book when enabled, follow their visit and return to information available and linked to their account. Their booking and recorded care connect to the organization's workflow.

### Product story in three sentences

Your team runs appointments, reception and consultations in one workspace. A booked or walk-in visit moves through reception to the doctor and its recorded information. Patients can find providers, book where available and access the linked side of that same visit.

## 7–8. Three distinct concepts and recommendation

| Attribute | The visit path | Two sides, one system | Your practice day — selected |
| --- | --- | --- | --- |
| Core idea | One visit forms a linear narrative | A patient interaction appears in the team workspace | Start with work a clinic team recognizes |
| Hero structure | Category and CTA beside a vertical visit path | Category and CTA beside paired patient/team views | Category, functions and actions beside a compact practice snapshot |
| Visual metaphor | A visit moving between stations | Two perspectives on one shared interaction | A familiar operational workspace |
| Product demonstration | Each stage expands into its relevant workspace | Booking receipt and reception update appear together | One workspace changes through booking, reception, doctor and records |
| Section flow | Intro → visit stages → capabilities → fit → plans → action | Intro → paired handoffs → team tools → patient access → plans → action | Intro → visit walkthrough → team work and fit → patient entry → practical questions → plans → action |
| Motion idea | State changes follow the visit path | The appointment crosses into reception | Manual workspace transitions retain visit 14 |
| Comprehension | Explains continuity well, but category can become secondary | Explains differentiation quickly, but can resemble two products | Establishes the paid operational product before its patient connection |
| Healthcare fit | Familiar care sequence | Recognizable patient/front-desk relationship | Familiar registration, queue and consultation work |
| Conversion logic | Demonstrate the complete visit before requesting setup | Demonstrate the connection as the reason to choose | Show immediate team relevance, prove the workflow, then compare capacity |
| Mobile behavior | Short stages or a lengthy vertical narrative | Paired views require compression and careful sequencing | Copy and actions first; compact three-row snapshot; readable manual walkthrough |
| Technical complexity | Moderate if scroll-driven, low with manual stages | Moderate to coordinate paired presentations | Low: server content, existing primitives, one small stateful preview |

**Recommendation:** Your practice day gives a clinic owner the clearest initial category and recognizable work. The visit walkthrough then proves the connection without making patients and organizations look like separate products. Team capabilities, size progression, practical questions and real plans each have a distinct evaluation job.

Selection priorities: comprehension, organization value, differentiation, trust, conversion, then visual quality. Novelty does not carry the category explanation.

## 9–10. Information architecture and hero wireframe

1. **Understand and recognize:** practice management, named audience, three core functions, connected patients and clear actions.
2. **See:** one manually controlled visit walkthrough, initially showing patient booking reaching reception.
3. **Evaluate and recognize fit:** four team outcomes, followed by one-doctor → multiple-staff → multiple-location progression within the same section.
4. **Patient entry:** a compact band for discovery, booking/tracking and available linked information.
5. **Trust:** four practical questions about walk-ins, larger teams, information access and the exact setup process.
6. **Price:** existing configured plans on the homepage, with the deeper pricing route retained.
7. **Act:** request setup, with patient discovery still accessible.

```text
SOFTWARE FOR DOCTORS, CLINICS & CARE TEAMS     THE WORK YOUR TEAM DOES, TOGETHER

Practice management                   Practice workspace · Illustrative
for your care team.                   ─────────────────────────────────
                                      14  APPOINTMENT
Manage appointments, reception            A patient books a visit.
and consultations in one place.       ─────────────────────────────────
                                          RECEPTION
Patients find, book where available        Your front desk receives it.
and follow the same visit.            ─────────────────────────────────
                                          CONSULTATION
[ Request setup → ]  Find care →          The doctor carries it forward.

Assisted setup. Plan confirmed.       One sample visit. One workspace.
See how a visit works ↓
```

At narrow widths, the category and actions precede the visual. The snapshot removes its repeated explanatory sentences, reduces row spacing and retains the three named stages. The detailed walkthrough remains readable rather than squeezing two desktop panels into narrow columns. Team capabilities and patient entry become concise rows; plans use a confined swipe region.

## 11. Motion and interaction

The visitor selects **Booking → Reception → Doctor → Records**. Each state changes the relevant product presentation while retaining sample visit 14:

- Booking: confirmation and the corresponding reception row.
- Reception: arrival/queue status and the context the doctor can open.
- Doctor: patient history, notes and prescriptions, with permission/module boundaries.
- Records: recorded visit/billing patterns and qualified patient account access.

A short CSS opacity/translation transition makes the workspace change perceptible. The visit does not autoplay. Reduced motion removes the custom entrance and stage animations. No scroll-driven narrative, video, animation library or additional observer is introduced.

Arrow keys, Home and End retain the shared tabs' keyboard behavior. The preview explicitly opts out of automatic active-tab scrolling so hydration does not move visitors away from the hero. Other Tabs consumers retain their default scrolling behavior.

## 12–14. Reuse, removal and preservation

### Actual components and utilities reused

| Existing source | Homepage use |
| --- | --- |
| `src/components/ui/Card.tsx` | Practice snapshot and visit workspace |
| `src/components/ui/Badge.tsx` | Illustrative labels and operational statuses |
| `src/components/ui/Tabs.tsx` | Four visit states and keyboard selection; optional scroll opt-out |
| `src/components/ui/Button.tsx` | Existing navigation disclosure and pricing retry |
| `src/components/ui/EkavyuLogo.tsx` | Header/footer identity |
| `src/components/ui/ThemeProvider.tsx` | Existing light/dark switch |
| `src/lib/appointmentPresentation.ts` | Booking and payment wording |
| `src/app/home/HomePricing.tsx` | Existing cached public plan read and loading/error/retry states |
| `src/components/billing/PublicPlanCard.tsx` | Shared plan presentation and billing-cycle switch |
| Existing currency formatter and billing service | Configured prices and existing monthly/annual calculations |
| Existing theme/brand tokens and Lucide icons | Semantic surfaces, typography, borders, spacing and familiar product language |

The preview simplifies real appointment, queue, consultation and record patterns. It is labelled illustrative and creates no appointment. No synthetic dashboard metrics or adoption numbers appear.

### Removed or merged

- Removed the oversized paired demo from the hero; the hero now has a compact practice snapshot.
- Replaced the separate duplicate workbench with one larger visit walkthrough immediately after the hero.
- Removed the repetitive journey recap; four team outcomes carry the capability explanation.
- Merged practice-size progression into the team section.
- Removed the oversized patient records mockup; three patient actions now form a compact band.
- Replaced the broad category/promise hierarchy with explicit practice management and concrete functions.
- Removed hospital language from the initial category; supported larger-team fit is explained later.

### Preserved

Existing root/auth behavior, public directory, login and setup destinations; public pricing source and calculations; deeper pricing route; theme system; mobile navigation and Escape focus recovery; reduced motion; truthful operational/privacy boundaries; actual email contact; configured canonical/social URLs; CTA event-name annotations without new analytics requests.

## Product evidence and boundaries

Frontend evidence re-inspected for this redesign:

- `src/app/(dashboard)/dashboard/queue/page.tsx`: walk-ins, patient entry, arrival/visit status and daily queue.
- `src/app/(dashboard)/dashboard/consultations/[id]/ConsultationClientWorkspace.tsx` and EncounterWorkspace: patient context, notes/history and consultation work.
- `src/app/(dashboard)/dashboard/billing/page.tsx`: invoices, payments and supported encounter checkout.
- `src/components/organization/OrganizationWorkflowPreferences.tsx`: essential/full entry and focused/full consultation.
- `src/components/organization/OrganizationSetupRequest.tsx`: plan selection, email draft and explicit manual send.
- Existing directory/doctor entry, patient portal, shared pricing and navigation/auth sources.

Backend evidence in the sibling backend repository:

- `models/Organization.ts`: organization capacities, workflow preferences and onboarding state.
- `models/SaaSPlan.ts`, `controllers/billing.ts`, billing routes and SubscriptionService: configured public plans and organization-scoped subscriptions.
- `controllers/public.ts`: active providers, location assignments and availability-dependent booking.
- `controllers/queue.ts`: queue, arrival and consultation state.
- Patient portal, appointment and clinical controllers remain the source for previously verified linked records and the visit lifecycle.

| Homepage promise | Product boundary |
| --- | --- |
| Discovery and booking | Existing `/browse`; enabled availability/provider booking mode |
| Visit handoff | Illustrative sample visit 14; no booking request |
| Team work | Assigned permissions and enabled modules |
| Small-practice fit | Actual essential patient entry and focused consultation configuration |
| Larger and hospital teams | Supported locations, roles and workflows within the plan; required workflows confirmed before setup |
| Patient information | Saved by provider, available and linked to account |
| Setup | Form prepares an email draft; user sends it; team confirms activation/capacity/trial |
| Pricing | Existing configured names, order, currency, popularity, trial terms and limits |
| Trust | Product evidence and actual contact; no invented testimonials, compliance badges or performance claims |

The title, description and generated 1200×630 social image now state practice management. Canonical and absolute social URLs still depend on configured `APP_URL` or `NEXT_PUBLIC_APP_URL`.

## Final independent cross-test

This is an editorial walkthrough of the rendered page, not measured comprehension testing.

| Hero-only question | Answer visible in the hero |
| --- | --- |
| What is this? | Practice management software |
| Who is it for? | Doctors, clinics and care teams |
| What problem does it solve? | Coordinating practice work and patient interactions in one place |
| What does it actually do? | Appointments, reception and consultations; the snapshot shows the handoff |
| How are patients involved? | They find doctors, book where available and follow their visit through the same system |
| What should a healthcare organization click? | Request setup |
| What should a patient click? | Find care |

**30-second explanation:** Ekavyu gives a practice team one workspace for appointments, reception and consultations. A patient's booking reaches reception and continues to the doctor as the same visit. Patients can find providers, book when enabled and return to available linked information.

Audience walkthrough:

- Clinic owner: category, daily functions, setup and plans establish the buying reason.
- Doctor: consultation preview and team outcomes name today's patients, context, notes and prescriptions.
- Receptionist: arrival, registration, walk-ins and queue appear as ordinary front-desk work.
- Patient: Find care appears beside setup and repeats in navigation, patient entry and closing.
- Larger/multi-location manager: assigned teams, schedules, locations and plan capacities explain fit; hospital workflows require confirmation.
- Small practice: one doctor/receptionist and the actual essential/focused configuration keep entry understandable.

## Verification

Highest risk is **Level 3**, because the shared Tabs interface gained an optional scroll opt-out. The main redesign is local copy, layout and preview behavior. Authentication, booking, payment, permissions, billing calculations and backend contracts are preserved.

- Changed-file ESLint passed without errors or warnings.
- Homepage Vitest: **11 tests passed**, covering root entry/redirects, action destinations, visit states, no automatic preview scrolling, keyboard selection and mobile navigation.
- Shared-tabs regression: **1 existing direct test passed**, including default scrolling, keyboard focus, disabled tabs and unique instance IDs. The unrelated 25 responsive-control cases were intentionally excluded.
- Package TypeScript: `npx tsc --noEmit --incremental false` passed.
- Browser layout: **320, 375, 430, 768, 1024, 1440 and 1920 px**, light/dark, with no page/header horizontal overflow.
- Final mobile refinement checked again at **320, 375 and 430 px**, including all four preview states. Setup remains visible before the sample workspace; the compact snapshot is under 330 px tall.
- Mobile navigation/Escape focus recovery, theme switching, reduced motion, keyboard scrolling of mobile plans and annual billing presentation checked.
- Initial page scroll remains at zero after hydration. Plan data is requested only near pricing; switching billing cycle does not repeat the request.
- One H1, readable category/title/description, primary setup and patient destinations verified.
- Anonymous and booking-guest HTTP entry returns 200; signed-in root entry returns 307 to `/dashboard`.
- Populated pricing layouts use browser-only fixtures with long names, different currencies and trial/no-trial cases. Production source contains no fixture plans.
- Final live pricing read returned **200** from the existing configured API and rendered the actual Starter, Professional and Enterprise plans with their returned prices, capacities and trial terms.
- A browser-only simulated 503 showed the price-free retry/contact state; retry then recovered the real configured plans with a 200 response.
- Social image visually reviewed; diff whitespace checked.

An earlier local plan probe returned 503; the final live read returned 200. Pricing still depends on the existing backend, and the homepage retains retry and contact guidance when a read fails.

Vitest uses `--configLoader runner` to avoid the denied temporary config write under `node_modules/.vite-temp`. No dependencies or project settings changed. The scoped checks above do not replace CI/release gates; no production build or deployment was performed.
