# Ekavyu domain model

Reviewed 2026-10-07 across frontend and backend. This document describes the current implementation. See [cleanup audit](pre-production-cleanup.md) for removals, verification and retained exceptions.

## Ownership and naming

| Concept | Meaning | Canonical implementation |
| --- | --- | --- |
| Organization | Tenant/customer | Organization, organizationId, OrgMember |
| Location | Physical healthcare location | Location, locationId, locations module |
| Facility type | Kind of location | facilityType: clinic, hospital, diagnostic_center, medical_center, specialty_center, other |
| Amenities | Equipment/services advertised by a location | amenities |
| Subscription capacity | Allowed physical locations | maxLocations |
| Location administrator | Current operational role | location_manager |

The word clinic describes a clinic facility or a specific clinical standard. A tenant may own different facility types. Facility type does not grant modules or permissions. A null type remains a generic location; names are not used to infer a type.

Organization owns subscriptions, memberships, configuration and communication settings. Location owns address, hours, local timezone, appointments/queue settings and merchant details. Global User identities gain organization context through memberships and persisted sessions. Doctor profiles belong to an organization. DoctorAssignment.doctorId references User; assignments carry organizationId and locationId with independent schedules, fees and booking settings. Tenant patient records are not owned by a single location.

Clinical visits, encounters, prescriptions, queue operations and stock use explicit location context alongside tenant authority. Related payment records inherit scope from their appointment/order. Global family relationships do not bypass consent, tenant or patient access checks.

## Current contracts

Backend uses models/Location.ts and the locations collection, controllers/location.ts and routes/locations.ts. Frontend uses useLocationStore, useOrganizationLocations and LocationManagement. Administration is /dashboard/locations. Location permissions are MANAGE_LOCATIONS and VIEW_LOCATIONS. Setup uses LOCATION_CREATED.

There is one /api representation. Public /browse/[slug] and /doctor/[slug] routes resolve published slugs; raw database IDs are rejected in provider URLs. /join/[locationSlug] resolves the public location before submitting its internal ID for booking. Availability and booking requests require the resolved location; the slug is never substituted for its database ID. Public directory data is an array with pagination headers. Internal IDs remain appropriate in authorized operational API payloads and database relations.

Public doctor assignment fields are id, overrideStatus and appointmentDuration. Booking responses use trackingUrl. Private upload responses use objectKey and intentId; a storage key is not a public URL. Appointment capability links use #t= fragments, with headers for tracker requests and trackerToken queries where browser document downloads require them.

Organization images use ownership-registry references or public external URLs. Arbitrary private-vault keys cannot become public branding. Root provisioned organizations use the canonical professional plan key where that plan is selected.

## Security and data lifecycle

Protected HTTP and private websocket requests require persisted session authority. Tenant scope, effective permissions, patient/family access, payment verification, file validation and revocation remain enforced. Root creation requires explicit tenant selection and platform-root authority; no first-tenant or test-only provisioning exemption remains.

Development records with superseded names must be reset and reseeded using the guarded [development lifecycle](../../backend/docs/development-data.md). No startup field backfill or permanent reader for previous model representations is provided. Current ciphertext uses enc:v1 and DATA_ENCRYPTION_KEY; encrypted MFA enrollment is required. These source changes do not reset a database or rotate a secret.

Retain original full-width navigation, mobile bottom bars and the separate dashboard toolbar. Shared presentation follows [design-system.md](design-system.md).
