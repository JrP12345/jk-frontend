# Pharmacy designated-PC enrollment and reserved numbers

> Historical increment report. The later [connected final-offline implementation](pharmacy-offline-final-billing-2026-11-15.md) supersedes the disabled-checkout and remaining-work status below. Enrollment/preparation alone still grants no billing authority; verified activation is separate.

Implemented the enrollment and number-reservation increment from the [offline plan](pharmacy-offline-final-billing-2026-11-15.md). **Final offline checkout remains disabled.** Enrollment is a branch/browser identity and numbering prerequisite; it does not grant stock, drawer, payment, dispensing or offline operator authority.

## Owner workflow

**Locations → branch actions → Pharmacy settings → Designated billing PC.** Use the intended billing PC and browser profile, enter a name, reserve 1–1000 numbers, record the actual review reference and confirm. Organization management permission, branch scope, the pharmacy module and an active India/INR pharmacy branch are checked. Branch capability and commercial entitlement are pinned inside the reservation transaction.

The server issues a five-minute challenge scoped to the authenticated enroller, organization, branch, device and public-key fingerprint. The browser signs the challenge and the exact reviewed name, count, numbering revision and financial year. A non-extractable P-256 private key is persisted in a separate IndexedDB database before enrollment. Multiple tabs share the same branch identity. Storage errors fail without a temporary identity or financial POST.

The exact enrollment request is stored durably before POST. If a response is lost, **Check PC enrollment** recovers a committed enrollment; **Retry original enrollment** sends exactly the original evidence. No second range is allocated. A pending attempt from another operator requires that original operator for recovery. **Cancel uncommitted enrollment** first asks the server to consume/fence its challenge, then clears that specific local pending reference. Cancellation cannot race a late commit into an unnoticed reservation or erase committed enrollment.

## Number and financial integrity

- A unique branch enrollment and strict, majority-committed transaction enforce one winning PC. Distinct PCs racing to enroll cannot both succeed. Enrollment never creates an invoice, payment or stock movement.
- The reservation increments the same bounded counter used by online billing. For example, reserving `PJP/0137`–`PJP/0139` makes the next online bill `PJP/0140`. System numbering and owner formats are both supported. Online pharmacy and default clinical allocation skip their corresponding reserved ranges.
- Numbering revision and financial year are checked under the branch/configuration fences. Concurrent owner format edits serialize against enrollment. Exhaustion, invalid proof, disabled capability or required-audit failure roll back the counter, challenge consumption and enrollment together.
- The immutable, server-signed envelope contains organization, branch, device/key identity, enroller and captured number range. It is explicitly `checkoutEnabled: false`, has a separate signing domain, and is not an authentication JWT. Maximum validity is 24 hours, clipped before the India financial-year boundary. It cannot serve as an access token or a checkout grant.
- The server persists the signing public-key snapshot with the original signature, so historical evidence need not be regenerated when the service signing key rotates. The browser verifies the signature against the key returned by the authenticated branch endpoint, validates the captured format/range and matches local device possession before storing confirmation.
- Enrollment, reserved range and signing evidence are immutable through normal model mutations. Only revisioned revocation fields can change. Required audit is transactional for enrollment and revocation. Missing unique-index readiness fails closed.
- Expiry or revocation **does not recycle numbers or permit replacement**. The unique enrollment remains, and numbering edits are blocked until a future reconciliation/settlement workflow resolves it. No renewal, second-range top-up or force-replacement control is exposed yet. Revocation cannot instantly inform a disconnected device; future billing authorization must retain bounded validity and reconciliation rules.

The device key identifies a browser profile, not an attested physical machine. IndexedDB persistence and non-extractability are not protection against origin compromise, deliberate profile deletion or OS/profile cloning. Browser identity and public reservation metadata are separate from the encrypted issued-invoice ledger. Backup/key recovery and offline operator unlock are still required before enabling offline issuance.

The P-256 proof uses WebCrypto's P1363 signature representation and Node verification with `dsaEncoding: "ieee-p1363"`, rather than converting it into a JWT. Reference: [WebCrypto signing](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign), [Node crypto verification](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoverifyalgorithm-data-key-signature).

## Verification

Risk level 4. Focused checks use disposable replica-set fixtures and synthetic browser data, not actual store invoices:

- **41 distinct backend cases passed:** 16 enrollment cases plus the existing 12 numbering and 13 paid-checkout regressions. Enrollment coverage includes organization/branch authority, no-write reads, default/custom counter reservation, matching signature, duplicate recovery after challenge deletion, two-device and same-request contention, concurrent online numbering/settings, malformed/private-key input, changed/foreign/expired proof, required-audit rollback, exhaustion, stale numbering/year, capability disable, revocation, immutable evidence, cancellation races, fiscal cutoff and missing-index rejection.
- **34 distinct frontend cases passed:** signed evidence and scope validation, Node/WebCrypto proof interoperability, exact scoped API payloads, no-storage rejection, owner settings and direct parent integration, confirmation, double-submit lock, persist-before-POST ordering, disk failure, original-request retry, cancellation confirmation, losing-device recovery and revocation revision. Existing numbering settings regressions passed.
- Eight actual Chrome checks passed: real component enrollment with Node verification, non-extractable key and confirmed metadata after reload, mobile overflow, full browser-process restart, competing tabs, pending-record overwrite protection, injected quota rollback without uncaught errors, and another browser profile shown without replacement. Inspected desktop/mobile screenshots are in `.next/pharmacy-device-acceptance/`. Run `node scripts/performance/check-pharmacy-device.mjs`; it reuses optional Playwright/esbuild tooling and previously compiled app styles, and makes no business API calls.
- Both package TypeScript checks, changed-code ESLint, isolated API/four-worker bundles and whitespace checks passed. The existing parent settings synchronous-effect lint warning remains; new code has no lint errors. No dependencies were added.
- Read-only inspection of the selected development database reports **119 models, 555 expected indexes, transaction capable, ready and no issues**. New collections/indexes were already present through the development server. The API's liveness and readiness endpoints both returned 200 (`ok`/`ready`) after its automatic restart. No real branch was enrolled, no real invoice range was reserved and no business records were rewritten for verification.

## Next increment

Implement exclusive branch stock/drawer authority across every consuming writer, common reviewed offline preparation, bounded operator authorization and authenticated ordered import. Then wire the counter's Save/Print to the already durable ledger, add protected backup/recovery and verify actual printers/store latency. A cached catalogue, this enrollment or its reserved numbers alone must never enable offline billing.

The user also added explicit [weak-network and older-PC requirements](pharmacy-offline-final-billing-2026-11-15.md#weak-network-and-older-pc-acceptance-still-required): bounded indexed reads/rendering, chunked background work, small retry-safe sync batches and actual low-end hardware/network measurements. This remains implementation and acceptance work, not a capability established by enrollment tests.
