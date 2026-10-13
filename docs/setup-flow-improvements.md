# Organization and doctor setup improvements

Reviewed and implemented locally on 2026-10-13.

| Friction | Implemented behavior |
| --- | --- |
| Linking an admin sounds like public setup is finished | **Set up myself as a doctor** saves the profile, then opens the existing assignment dialog. Public listing still requires an explicitly saved location assignment. |
| Profile, assignment and preview are disconnected | The assignment dialog shows setup steps and links to the organization's public booking review. Existing linked admins use **My doctor setup** to resume without rewriting their profile. |
| A missing public doctor has no obvious explanation | Team shows **Location assignment required** with a resume action for each unassigned doctor. The organization overview checks public listing, publication and online booking separately. Failed checks remain unknown and retryable. |
| Assignment defaults discard profile fees | Assignment forms carry the profile's fee and fee model, including zero/free and post-consultation fees. Backend profile creation, editing and staff responses preserve fee models. The assignment request schema now accepts and validates the fee model instead of stripping it. |
| The only available location still needs manual selection | The sole active, unassigned location is preselected for review. Multiple eligible locations require an explicit choice. Populated `id` and `_id` references are both recognized. |
| Readiness is hidden inside website sharing | **Public booking setup** appears on the organization overview, reusing the website-sharing checklist rules. It checks one chosen location, offers canonical location/doctor previews, and opens clinical team setup directly. |
| Existing accounts and new registrations have separate entry points | **Add Member** offers **Use an existing account** and **Create a new account**. Existing accounts use the current invitation/acceptance API through a shared dialog also used by Members. |

## Use the flow

1. Open **Team** (`/dashboard/staff`) in the organization's administrator session.
2. Choose **Set up myself as a doctor**, or **My doctor setup** if already linked.
3. Review the location, consultation hours, fee model and amount; choose **Assign Location**.
4. Follow **Review public booking setup**, resolve the remaining checklist items, and preview the public pages.

The platform Root identity does not become the organization's doctor through this
control. Root uses the existing **Login as administrator** action to enter that
administrator's session. Existing profile edit, assignment edit/removal, leave,
new-account registration, membership and permission controls remain available.

## Focused verification

- Frontend: five affected files initially passed 57 tests; final doctor setup,
  readiness and organization-management verification passed 33 tests after the
  final navigation and asynchronous-response changes. Covered explicit saves,
  cancellation, existing/free/post-consultation profiles, multiple/no locations,
  populated references, retry, invitations, unpublished pages, paused online
  booking, foreign public responses and changed organization sessions.
- Backend: public catalog tests passed; final onboarding, location workflow and
  post-consultation billing verification passed 25 tests. Covered admin identity
  preservation, explicit assignment before public visibility, fee models,
  invalid fees and schema validation, plus existing booking/billing regressions.
- Both package TypeScript checks passed. Changed frontend files lint with zero
  errors (15 warnings). All five backend bundles built successfully.
- No dependencies, database migrations or live data changes. No full test suite,
  frontend production build or browser/device visual acceptance was run.
