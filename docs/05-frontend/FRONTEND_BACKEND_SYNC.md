# Frontend ↔ Backend Connection Matrix & Architecture Mapping (`FRONTEND_BACKEND_SYNC.md`)

> **Architectural Status**: FROZEN (Milestone 0 Freeze)  
> **Source of Truth**: Fastify Backend REST Endpoints (`d:\Project JK\backend`)

---

## Folder Structure Contract

```
d:\Project JK\frontend\src\
├── api/              # Low-level Axios client & HTTP interceptors (api.ts)
├── services/         # Domain Business Logic Services (10 bounded contexts)
├── repositories/     # Data Access, DTO Mapping, Cache & Optimistic Reconciliation
├── hooks/            # Custom React UI Hooks
├── providers/        # Decoupled React Context State Providers
├── events/           # EncounterEventBus & Event Constants
├── components/       # Presentational & Container UI Components
│   ├── clinical/     # Clinical Consultation Workspace Components
│   ├── ehr/          # Longitudinal EHR Timeline Components
│   └── ui/           # Atomic UI Design System Components
├── types/            # TypeScript Domain Models & DTO Interfaces
└── utils/            # Helper utilities, formatters, and validators
```

---

## Domain Module Synchronization Table

| Module Domain | Page Route | Primary UI Component | Custom Hook | Repository | Domain Service | Provider Context | Event Bus Subscriptions |
|---|---|---|---|---|---|---|---|
| **Auth & Session** | `/login`, `/browse` | `LoginForm`, `Header` | `useSession` | `auth.repository.ts` | `auth.service.ts` | `SessionProvider` | `AUTH_EXPIRED`, `SESSION_REFRESHED` |
| **RBAC & Permissions** | `/dashboard/staff` | `RBACPermissionMatrix` | `usePermissions` | `rbac.repository.ts` | `rbac.service.ts` | `PermissionProvider` | `PERMISSIONS_UPDATED` |
| **Patient Profile** | `/dashboard/appointments`, `/browse` | `PatientHeader`, `PatientSearchModal` | `usePatient` | `patient.repository.ts` | `patient.service.ts` | `PatientProvider` | `PATIENT_SELECTED`, `PATIENT_UPDATED` |
| **Encounter Workspace** | `/dashboard/consultations/[id]` | `EncounterWorkspace` | `useEncounter` | `encounter.repository.ts` | `encounter.service.ts` | `EncounterProvider` | `ENCOUNTER_INITIALIZED`, `ENCOUNTER_CLOSED` |
| **SOAP Note Editor** | Workspace Tab 1 | `SOAPNoteEditor` | `useSOAP` | `soap.repository.ts` | `soap.service.ts` | `EncounterProvider` | `SOAP_NOTE_CREATED`, `SOAP_NOTE_SIGNED`, `SOAP_NOTE_AMENDED` |
| **NEWS2 Engine & Alerts** | Workspace Tab 6 | `NEWS2Calculator`, `VitalTrendsChart` | `useNEWS2` | `news2.repository.ts` | `news2.service.ts` | `EncounterProvider` | `NEWS2_EVALUATED`, `NEWS2_ALERT_TRIGGERED`, `NEWS2_ALERT_ACKNOWLEDGED` |
| **Diagnostic Orders** | Workspace Tab 3 | `OrderTable`, `PlaceOrderModal`, `RecordResultModal` | `useOrders` | `orders.repository.ts` | `orders.service.ts` | `EncounterProvider` | `ORDER_CREATED`, `ORDER_COLLECTED`, `ORDER_PROCESSING`, `ORDER_COMPLETED`, `ORDER_CANCELLED` |
| **Medication Admin (MAR)** | Workspace Tab 2 | `MARRow`, `ScheduleDoseModal` | `useMAR` | `mar.repository.ts` | `mar.service.ts` | `EncounterProvider` | `MAR_SCHEDULED`, `MAR_ADMINISTERED`, `MAR_REFUSED`, `MAR_HELD`, `MAR_MISSED` |
| **Discharge Summary** | Workspace Tab 4 | `DischargeSummaryModal` | `useDischarge` | `discharge.repository.ts` | `discharge.service.ts` | `EncounterProvider` | `DISCHARGE_COMPILED`, `DISCHARGE_FINALIZED`, `DISCHARGE_COUNTERSIGNED` |
| **Longitudinal EHR Timeline** | Workspace Tab 5 | `PatientTimeline` | `useTimeline` | `timeline.repository.ts` | `timeline.service.ts` | `EncounterProvider` | Subscribes to: `SOAP_NOTE_SIGNED`, `ORDER_COMPLETED`, `MAR_ADMINISTERED`, `DISCHARGE_FINALIZED` |
| **Executive Analytics & Audit** | `/dashboard/analytics`, `/dashboard/audit` | `AnalyticsDashboard`, `AuditLogTable` | `useAnalytics` | `analytics.repository.ts` | `analytics.service.ts` | — | Subscribes to: `SOAP_NOTE_SIGNED`, `ORDER_COMPLETED`, `MAR_ADMINISTERED`, `DISCHARGE_FINALIZED` |
| **FHIR R4 Export** | Contextual Dropdowns | `FHIRExportButton` | `useFHIR` | `fhir.repository.ts` | `fhir.service.ts` | — | `FHIR_BUNDLE_EXPORTED` |

---

## Layer Responsibilities

1. **`Component`**: Handles layout, user input capture, rendering states (loading, error, empty), and triggering hook mutations. **Zero raw HTTP calls.**
2. **`Hook`**: Provides reactive state, loading flags, error objects, and dispatch handlers to components. Connects UI to Repositories.
3. **`Repository`**: Manages HTTP transport execution, local cache storage (`localStorage` / in-memory), DTO transformation, pagination cursor state, retries, and optimistic UI reconciliation.
4. **`Service`**: Enforces client-side domain validation rules, CDS safety evaluation helpers, state machine transitions, and event bus emissions (`EncounterEventBus.emit`).
5. **`API Client`**: Base Axios instance (`api.ts`) managing CORS credentials, JWT bearer headers, 401 transparent token refresh queue, and global rate-limit error catching.
