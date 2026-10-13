# CRM migration and pilot package

This package prepares a controlled rollout. No production migration, index write,
provider configuration or deployment has been executed. The implementation tracker
is [crm-implementation-progress.md](crm-implementation-progress.md).

## Review before writes

For the user's existing development installation, unchanged legacy global role
defaults were upgraded explicitly on 2026-10-12 using
`scripts/enable-development-crm.ts`. Preview without arguments; applying requires
`--apply --confirm-database=<exact-development-database>`. It requires one active
root and preserves customized/empty roles and organization overrides. It refuses
production mode and is not a production migration or an automatic permission
backfill. Production role grants still require explicit review before rollout.

Use a restored, reviewed snapshot and a read-only database account. Run from the
backend repository with the connection supplied through the operator's environment:

```powershell
node --experimental-transform-types scripts/review-crm-migration.ts --organization <reviewed-org-id> --limit 100
```

Continue using each returned `nextCursor` until it is null. Counts apply to that
page; do not present the first page as the organization's complete reconciliation.
Each reported appointment includes its exact `expectedUpdatedAt` for a reviewed
manifest. A missing source timestamp requires separate review rather than a guess.
The report excludes names, contacts, clinical notes, values and capabilities. It
contains operational references and must remain in the authorized review workspace.
`--apply` is unsupported. The CLI disables automatic collection/index creation.

Review missing/foreign branch and patient references, missing organization
relationships, legacy follow-up links, recommendations without tasks, financial
reference/state conflicts and unresolved disruption work. Missing staff branch
grants need independent review; migration cannot infer organization-wide access.
Existing sources/consents without evidence remain unknown. Shared contacts require
identity review and must never be merged automatically.

Family booking relationships and legacy global consent/data-rights flags do not
establish organization-specific communication, consent or data-rights authority.
Review each purpose independently through the family-authority workflow; do not
backfill these grants automatically. Recipient changes and grant revisions require
fresh attributable channel/purpose consent. Service communication authority does
not authorize clinical documents, prescription links or private tracker credentials.
Family export/erasure requests must recheck the exact current organization grant;
retained clinical and financial records still require the existing retention review.

## Additive compatibility and indexes

Retain all Patient/User, Appointment, Encounter, clinical, invoice/payment, audit,
consent-evidence and durable outbox records. New business collections are Inquiry,
PatientRelationship and CrmActivity; operational work remains in existing Task.
Missing new revisions default to zero. Existing financial operation keys have no
TTL. New automation remains off until a reviewed configuration enables it.

Preview schema indexes with `scripts/prepare-database-indexes.ts`. Before a separately
authorized application window, compare actual indexes and duplicates against the
schema, especially operation receipt scope/key, task organization/dedupe key,
relationship organization/patient, activity organization/event key and outbox keys.
Use the existing additive index preparation path with paused writes. Do not run
`syncIndexes`, drop old indexes, or activate workers before uniqueness is established.
Measure CRM list and analytics query plans on the reviewed snapshot and record
documents examined, returned rows, time and memory for the approved pilot volume.

## Controlled review/backfill

The read-only report is not an automatic migration. A reviewed write manifest must
pin organization, branch, source identifier/revision, action, operator and batch
identifier. Recheck every source before a transaction. References that cannot be
reconciled stay quarantined; do not attach clinical data to a new identity.

Validated legacy follow-up links can create deduplicated existing review tasks
using `recordLegacyFollowUpReview`; use `recordFollowUpRecommendation` only after
reviewing the recommendation's calendar date. Neither action confirms, cancels,
reschedules or collects payment. Reviewed relationship initialization uses unknown
consent and unassigned ownership until independently evidenced. Do not replay old
notifications, infer purpose grants, convert fake DOBs into recorded clinical facts,
or reinterpret old survey attribution as patient-submitted.

The bounded operator CLI is implemented; its underlying transactional commands
are verified on a synthetic replica set.
An approved manifest and a live write window remain pending. Supported actions
prepare human review tasks for legacy links or recommendations, or initialize a
missing relationship for a patient already owned by the reviewed organization.
They do not initialize patient identities, consent or financial records.

```powershell
node --experimental-transform-types scripts/apply-reviewed-crm-backfill.ts --manifest <reviewed-manifest.json> --writes-paused --authorized-rollout
```

The manifest contains `commands` with `organizationId`, `actorId`, `batchId`,
`clientRequestId`, `appointmentId`, exact `expectedUpdatedAt` and `action`
(`legacy_followup_review`, `recommendation_review` or `relationship_initialize`). Each batch pins one
organization, operator and batch identifier, with at most 100 commands. The
operator needs current explicit organization-wide branch access and CRM, task,
patient and appointment permissions. Exact retries restore the recorded task or relationship;
changed source versions or lost grants stop the batch for review. Audit failure
rolls back the task, source changes and command receipt together.

Relationship initialization refuses existing relationships and foreign-owned
patient references. It creates unassigned ownership, unknown contact availability
and no preferred communication channel; it neither infers consent nor changes a
visit, invoice or clinical record. Six synthetic backfill cases passed, including
rollback, concurrent retry, changed sources and revoked operator grants. The two
read-only review cases passed separately. No live manifest was applied.

Record
per-batch before/after references, task/relationship counts, skipped conflicts and
audit/receipt reconciliation. A concurrent change must produce a conflict for
review, rather than overwriting the newer record.

## Pilot and rollback

Legacy disrupted visits without `disruptionOriginalStatus` require attendance
review. Do not infer or backfill attendance from free-text notes. The optional
staff-booking `clientRequestId` preserves callers without a key; retain encrypted
command responses and receipts for retry reconciliation rather than expiring them
with a TTL. No production migration or index write was executed during local checks.

Pilot one reviewed organization and a small explicit branch/staff cohort. Use
synthetic contacts first, then only separately authorized real communication.
Verify all W01–W34 journeys in the tracker, with a designated owner and observed
evidence. Include two simultaneous operators, dropped responses, revoked grants,
expired entitlement, changed contact, consent withdrawal, worker restart, duplicate
webhook, local midnight and timezone transitions. Verify desktop/mobile keyboard
flows, focus restoration, readable errors and absence of clinical details in desk
queues. Record the actual state instead of checking off the expected state.

Before expansion, reconcile canonical patient/visit/invoice/payment references,
deduplicated tasks/events/receipts, consent evidence and provider delivery states.
Account for every suppressed/failed/uncertain item in a human review queue.
Use the existing CI/release gates and a reviewed backup/restore drill.

Rollback first disables CRM automation and pauses the relevant consumers while
retaining queued records, keys and evidence. Revert application behavior through
the reviewed release rollback. Preserve additive data for reconciliation; do not
delete financial receipts, erase clinical history, resend uncertain messages,
refund automatically, or reset revisions to enable replay. Resume only after the
same reconciliation and authority checks pass. Live pilot and rollback execution
require their own operational authorization.
