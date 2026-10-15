# Public landing page redesign

## Product and audience

The primary business conversion is an organization setup request. The existing `/onboarding?mode=new_org` flow collects practice and contact details, optionally carries a configured plan, and waits for team review. It is not instant organization activation. Patients have a separate task: discover providers through `/browse`, or sign in for linked visits, records and bills.

The page describes capabilities present in the inspected appointment, queue, consultation, patient, billing, location and staff workflows. It avoids promises about outcomes, compliance certifications, response times, customers or planned functionality. Feature availability is qualified by permissions, enabled modules and plan capacity.

## Decisions implemented

- Introduce the product category before the headline, name booking through billing in the supporting copy, and explain the setup action immediately below it.
- Give healthcare teams the main page narrative. Keep a direct patient discovery link visible in the mobile header, with a separate patient section and sign-in destination.
- Replace the abstract checklist with a static, labelled queue example showing booked, arrived and in-consultation visits. It contains synthetic labels and no interactive-looking buttons or live-data claim.
- Explain the visit as four connected stages: book/register, check in/call next, consult, and complete/bill. Role-specific benefits then show what reception, doctors and practice owners do within that workflow.
- Use restrained brand colors, editorial sections, separators and consistent typography. Avoid decorative imagery, scrolling effects, feature-card walls and new frontend dependencies.
- Keep the existing public plan source, viewport-triggered loading, monthly/annual comparison, capacity limits, trials, enterprise contact, failure recovery and selected-plan setup links.
- Combine the final business CTA with practical FAQs about setup, practice size, walk-ins and access. Preserve contact details and the existing authentication/booking-guest redirects.
- Improve navigation dismissal through Escape and outside pointer interaction. Retain focus recovery, native FAQ disclosures, a focusable skip-link destination, reduced-motion support and bounded mobile navigation.
- Align the SEO description and generated social preview with the new message. Canonical URLs and social metadata remain in place.

## Verification

This is a Level 2 page-local presentation/navigation change; it does not change shared application contracts or authentication rules.

- Changed-file ESLint and `git diff --check` passed.
- Four focused Vitest files passed: `homepage`, `homepagePricing`, `organizationSetupRequest`, and `publicEntry` (19 distinct cases after the navigation refinement). The native config loader avoids the workspace's temporary-config write restriction.
- Headless Chrome reviewed 320, 390, 430, 768 and 1440px layouts. Light and dark modes were sampled. No page/header horizontal overflow, broken section anchors or runtime exceptions were found in these samples.
- Mobile first views retain both patient discovery and the setup CTA. Browser checks confirmed viewport-triggered pricing, pricing failure/retry recovery, mobile navigation Escape dismissal, and selected-plan navigation into the real setup form.
- Browser pricing data was intercepted with synthetic plans. No setup request was submitted to a live backend. The social image was generated and visually inspected at 1200 × 630.
- No full test suite or production build was run. This is an expert/code/browser review, not observed user testing or a measured conversion experiment. Deployment was outside the requested existing-checkout implementation.
