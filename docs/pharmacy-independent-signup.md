# Independent pharmacy business signup (T31)

Implemented locally on 21 October 2026. No catalogue price, published offer, live account, database index or deployment was changed. Synthetic test licences are not professional approval.

## Owner journey

The sign-in page links to `/pharmacy-start`. Signup lists only active, explicitly published `location_products` catalogue plans that have valid INR pricing, staff/location limits and a configured 1–365 day trial. It displays the current monthly total for one pharmacy branch, trial duration and staff limit. It offers no fallback price or invented trial when the catalogue is empty. Paid activation remains the existing reviewed checkout flow.

An owner provides the actual business email, owner/business names, city and branch address. A new identity also needs a strong password. The business email receives a purpose-specific code. Requesting a code creates no User, Patient, organization, branch or membership. After verification, a new User is provisional and cannot sign in to operations until provisioning completes. An existing account retains its credentials, global role and patient records; a fresh verified business challenge authorizes only creation of that account's new business.

Completion creates one organization, owner membership, primary pharmacy branch, system roles/modules and a canonical product trial in the shared provisioning transaction. No Doctor, Appointment, Encounter, clinical Patient, provider payment or paid subscription is fabricated. The trial captures configured terms and entitlements, with zero doctor seats and one pharmacy location. Branch pharmacy capability begins disabled, revision zero. Subsequent completion requests, even with different command keys, return the same organization and original trial period.

The new organization's staff must enroll an authenticator before operational access. Existing account MFA is still challenged and binds the target organization to the signed login challenge. This policy is scoped to the new organization; it does not force unrelated clinic sessions into a changed global policy. Root accounts continue through assisted platform provisioning.

## Authority and recovery

| Route under `/api/pharmacy/onboarding` | Contract |
| --- | --- |
| `GET /options` | Bounded public catalogue summaries and pricing fingerprints, never purchase authority tokens |
| `POST /start` | Strict business intent; returns a request ID and opaque setup proof, records only its hash |
| `POST /resend` | Original proof, pending state and resend cooldown; new business-purpose email code |
| `POST /verify` | Original proof plus six-digit business code; commits failed attempt counts |
| `POST /status` | Original proof; pending, verified or provisioned state and recorded organization ID |
| `POST /complete` | Verified original proof and stable `Idempotency-Key`; atomically provisions or replays |

Setup proof expires after 30 minutes. The persistent unique email/owner claim has no TTL: proof expiry cannot erase a completed trial claim. Email codes bind purpose, request ID and proof hash. Generic patient OTP verification cannot consume a business code. Start/resend and proof endpoints have separate rate limits; resend also has a per-claim cooldown. Current unique indexes are checked before accepting setup; the read-only check never creates indexes. See [current schema setup](pharmacy-setup.md).

The server encrypts pending intent and recorded result, including any new-account password hash. Once email verification has installed that credential on the provisional User, it removes the duplicate hash from the setup intent. An established account's password is never copied into setup intent. It records no plaintext password or proof in audit details/errors. Browser session storage keeps only the opaque request ID, setup proof and completion key; passwords and business form content are not persisted. This reference is sensitive and is cleared after confirmed workspace sign-in. Account/permission changes unmount private form state and ignore late responses.

A lost completion response retains the original key. Check saved setup and use **Create or resume pharmacy workspace**. A recorded business is resumed through secure sign-in; it does not create another trial. An expired proof requires ordinary sign-in for a completed business or a fresh verified request for an incomplete one. A malformed saved reference has an explicit reset. An invalid public proof does not refresh or sign out an unrelated operational session. Email-provider failure is reported as unavailable delivery and grants no verified identity.

Published terms are fingerprinted and pinned again inside the provisioning transaction. Changing prices, revision, limits, trial duration, status or publication invalidates stale intent. Missing transaction support, failed audit writes or invalid terms roll back organization, membership, trial and claim transition together. Required API/worker startup checks still apply.

## Pharmacy workspace

The authenticated organization profile selects the pharmacy home, counter default, navigation order, mobile links and staff role defaults. Unrelated clinical children are not mounted by the dashboard shell, and pharmacy capabilities omit the connected prescription queue/dispense actions. These UI defaults supplement existing server module, membership and clinical source authorization.

An existing patient with an actual staff membership can open their business through the workspace selector, including a single business. A personal patient session remains a patient session until the server authorizes that switch. Refresh and MFA retain the actual staff workspace role without rewriting the account's global patient role.

Before first sale, the owner reviews real branch issuer/licences and tax settings, enables pharmacy, configures actual product units/tax/dispensing classification, receives dated stock, and confirms a server quote. Cash collection additionally requires an actual drawer. Restricted supply still requires the supported clinical source, current professional evidence and restricted workflow; self-service signup grants no exemption. See [branch administration](pharmacy-branch-administration.md), [stock receipts](pharmacy-stock-receipts.md) and [counter](pharmacy-counter.md).

## Local evidence and remaining launch work

Focused verification passed 29 distinct backend cases across three files and 30 frontend cases across four files, including all 12 current signup cases after the credential-retention correction. Coverage includes new and existing patient identities, pending MFA, real authenticator enrollment, future workspace selection/refresh, existing MFA challenges, duplicate/concurrent completion, wrong-code exhaustion, purpose isolation, proof rotation/expiry, changed catalogue terms, audit rollback, unavailable email and first ordinary sale through owner routes with zero clinical records. Frontend tests cover published/empty catalogue, opaque reference retention, completion loss/retry, existing authenticator, malformed storage, late account responses, workspace routing/mobile links and pharmacy invitations. Shared clinic/root provisioning and navigation regressions are retained.

Real offer publication, email delivery, pharmacist/tax review, browser/device/print checks, provider test-mode evidence, restore/key recovery and measured capacity/cost remain release evidence. Record those against [T26](pharmacy-release-evidence.md); implementation alone does not approve activation.
