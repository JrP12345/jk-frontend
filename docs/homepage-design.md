# Ekavyu homepage and public entry

Updated 7 October 2026.

## Current direction

A short introduction to practice management, with the headline **Your care team. One clear workspace.** The primary action is **Request setup**; patients can use **Find care** without signing in. The product serves healthcare organizations with one or several locations; a location may be a clinic, hospital or another supported facility type. See [the domain audit](domain-model-audit.md).

The previous page repeated the visit journey across a hero snapshot, an interactive walkthrough, team capabilities, practice-size progression and patient information. The new page keeps one compact, static example and three practical benefits. Removing the interactive preview from the homepage reduces the initial client-side work and the amount visitors must interpret.

## Ideas considered

| Direction | Benefit | Decision |
| --- | --- | --- |
| Minimal introduction and compact product example | Clear category, concrete functions and an immediate action | Selected |
| Large product screenshot | Direct product evidence, but crowded on small screens | Keep for a future dedicated product tour |
| Guided booking-to-records walkthrough | Explains the visit handoff in detail | Too much detail for the landing page |

Reference: [Jane's practice management landing page](https://jane.app/). Its visible practice category, recognizable functions and guided getting-started path informed the emphasis on clarity. Ekavyu uses its own existing capabilities and brand; no testimonials or marketing claims from that reference were reused.

## Page structure

1. Product introduction and setup / find-care actions.
2. One static illustrative workflow: booking, check-in, consultation.
3. Three essentials: appointments, queue and consultation context.
4. A short patient discovery band.
5. Existing configured plans and billing-cycle controls.
6. Three concise practical questions and a final setup action.

The example contains no live patient information. There are no invented metrics, customer quotes or compliance claims. Team access follows roles and enabled modules; patient records must be available and linked to the patient's account.

## Setup requests

The public form submits practice and contact details to the backend. It no longer opens an email draft.

SetupRequest stores submissions. A submission key prevents duplicate records after uncertain network responses. Public submissions are rate limited and validated; selected plans must be active configured plans. A request does not provision an organization or activate a subscription.

Root reviews entries at **/dashboard/admin/setup-requests**, reachable from the root dashboard and organization management. The inbox shows contact details, selected plan, received date and New / Contacted / Closed statuses, with filtering, pagination and retry. Backend authorization requires the root account outside impersonation; ordinary users cannot read or update entries.

## Public browsing and login

- Location and doctor URLs use stable readable slugs with a random suffix to distinguish duplicate names. PublicLink maps them to internal records.
- Provider routes accept published slugs only. Booking and follow-up query options are retained.
- Organization affiliation appears only for multiple active locations. Counts are independent of search filters and pagination.
- Website sharing uses the resolved public link. Availability and booking operations retain authoritative internal IDs after resolution.
- Anonymous public entry skips the initial session request. Signed-in sessions are verified; dashboards retain authentication.
- Passkey challenge cookies share the session domain, secure and SameSite settings. Cancellation gives visible guidance. HTTPS (or localhost), an enrolled passkey and existing two-factor requirements still apply.
- Queue reconciliation continues every 15 seconds and through real-time events. Loaded rows stay mounted during refreshes. Changing location, doctor or date resets the view; a failed refresh retains rows and shows retry guidance.

## Verification

Highest risk: **Level 4**, because authentication, booking references, saved submissions and root access are involved. Both repositories received focused tests and type checks. Changed-file frontend ESLint completed with no errors; warnings remain, including the inbox's existing-style effect-based loading pattern. The backend bundle build passed.

Backend tests cover cryptographic passkey enrollment/login, cross-site challenge cookies, zero-counter credentials, incorrect origins, retained two-factor requirements, provider visibility and stable links, location counts, duplicate submissions, validation and root authorization.

Frontend regressions cover anonymous entry, auth and workspace isolation, passkey cancellation, browsing and availability through slugs, slug-only routes, setup submission/retry, root inbox access, queue continuity, pricing and affected organization screens.

The production compile passed using temporary HTTPS API placeholders: the existing production guard rejects the local development API URL. No environment file was changed; no deployment occurred.

Browser checks cover public home and setup entry, mobile navigation, one H1, overflow, initial scroll position and absence of anonymous session requests. Hardware passkey prompts and a deployed setup submission were not exercised; protocol and persistence behavior were tested against an isolated backend test database.
