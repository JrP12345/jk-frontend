# P0.9 dispatch change for explicit review

Automatic approval review rejected changing the shared patient WhatsApp/email
dispatcher, consent enforcement and delivery states under general plan approval.
The user explicitly approved this reviewed change on 2026-10-09. Implementation
and focused local verification have passed; live provider configuration and deployment
remain outside this approval. The user separately approved the specific P0.6
organization family-authority change on 2026-10-10, covering local code and
synthetic checks. Operational rollout and live provider actions remain separate.

The proposed pure policy is reviewable in
`backend/services/PatientCommunicationPolicy.ts`, with focused integration cases
in `backend/tests/crmCommunicationPolicy.test.ts`. The enqueue and delivery consumers
now apply this policy.

The proposed shared dispatch change would:

- Bind each patient message to organization, branch, canonical patient and source.
- Validate evidence for its channel and, separately, follow-up or feedback purpose.
- Pin a recipient hash when queued, then recheck the current recipient, consent,
  preferences, active source, staff membership and branch permissions before sending.
- Suppress messages after withdrawal, contact correction, revocation, source closure
  or workspace suspension. Family recipients require a separately reviewed
  organization communication grant, explicit recipient selection and fresh consent.
- Reuse the encrypted OutboundMessage queue and NotificationLog; create no new queue.
- Distinguish provider acceptance from sent, delivered and read. Suppression and
  unavailable/console SMS would not be represented as successful delivery.
- Preserve OTP as its existing separate authentication flow. CRM would offer only
  minimal approved WhatsApp templates and email, with no generic transactional SMS.
- Keep shared-sender replies for explicit routing, without matching a patient or
  creating a login account from a phone number. STOP remains a channel suppression.

An apparent `claimmed` typo was in the rejected patch. That patch was not applied;
the review draft uses the existing `claim.claimed` guard. Live provider configuration
and deployment remain outside the approved local implementation scope.
