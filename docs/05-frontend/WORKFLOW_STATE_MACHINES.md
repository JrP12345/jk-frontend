# Workflow State Machines & Event Model Specification (`WORKFLOW_STATE_MACHINES.md`)

> **Architectural Status**: FROZEN (Milestone 0 Freeze)  
> **Source of Truth**: Clinical Domain Engine Models (`d:\Project JK\backend\models`)

---

## 1. Canonical Event Constants (`EncounterEventBus`)

To ensure clean decoupling and eliminate imperative cross-component refresh calls, the frontend event bus (`EncounterEventBus`) communicates strictly using frozen canonical event strings:

```typescript
export const EncounterEvents = {
  // SOAP Domain Events
  SOAP_NOTE_CREATED: "SOAP_NOTE_CREATED",
  SOAP_NOTE_SIGNED: "SOAP_NOTE_SIGNED",
  SOAP_NOTE_AMENDED: "SOAP_NOTE_AMENDED",

  // NEWS2 Deterioration & Alerts Events
  NEWS2_EVALUATED: "NEWS2_EVALUATED",
  NEWS2_ALERT_TRIGGERED: "NEWS2_ALERT_TRIGGERED",
  NEWS2_ALERT_ACKNOWLEDGED: "NEWS2_ALERT_ACKNOWLEDGED",

  // Diagnostic Orders Events
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_COLLECTED: "ORDER_COLLECTED",
  ORDER_PROCESSING: "ORDER_PROCESSING",
  ORDER_COMPLETED: "ORDER_COMPLETED",
  ORDER_CANCELLED: "ORDER_CANCELLED",

  // Medication Administration Record (MAR) Events
  MAR_SCHEDULED: "MAR_SCHEDULED",
  MAR_ADMINISTERED: "MAR_ADMINISTERED",
  MAR_REFUSED: "MAR_REFUSED",
  MAR_HELD: "MAR_HELD",
  MAR_MISSED: "MAR_MISSED",

  // Discharge Summary Events
  DISCHARGE_COMPILED: "DISCHARGE_COMPILED",
  DISCHARGE_FINALIZED: "DISCHARGE_FINALIZED",
  DISCHARGE_COUNTERSIGNED: "DISCHARGE_COUNTERSIGNED",

  // System & Security Events
  AUTH_EXPIRED: "AUTH_EXPIRED",
  PERMISSIONS_UPDATED: "PERMISSIONS_UPDATED",
  ENCOUNTER_CLOSED: "ENCOUNTER_CLOSED",
} as const;
```

---

## 2. Event Subscriber Matrix

| Trigger Event | Event Subscribers (React Hook / Component) | Reactive Action |
|---|---|---|
| `SOAP_NOTE_SIGNED` | `TimelineRepository`, `AnalyticsRepository`, `SearchRepository`, `AuditRepository`, `PatientHeader` | Invalidate timeline cache, trigger quality refetch, clear search index, append audit log, update diagnosis badge |
| `NEWS2_ALERT_TRIGGERED` | `EncounterProvider`, `PatientHeader`, `NEWS2Calculator` | Render emergency red alert banner, play alert sound/toast, lock patient high-risk status badge |
| `NEWS2_ALERT_ACKNOWLEDGED` | `PatientHeader`, `NEWS2Calculator` | Clear active alert banner, update acknowledgment timestamp in score history |
| `ORDER_COMPLETED` | `TimelineRepository`, `DischargeRepository`, `AnalyticsRepository` | Invalidate timeline, update discharge summary lab table, recalculate diagnostic quality metrics |
| `ORDER_CANCELLED` | `OrderTable`, `AuditRepository` | Remove order row or mark cancelled, append audit log |
| `MAR_ADMINISTERED` | `TimelineRepository`, `DischargeRepository`, `AnalyticsRepository`, `MARRow` | Append timeline medication log, update discharge MAR summary, recalculate 5 Rights compliance rate % |
| `MAR_HELD` / `MAR_REFUSED` | `TimelineRepository`, `MARRow`, `AnalyticsRepository` | Mark MAR row state, log refusal/hold reason in audit and timeline |
| `DISCHARGE_FINALIZED` | `EncounterProvider`, `QueueRepository`, `TimelineRepository`, `AuditRepository`, `FHIRExportButton` | Lock encounter workspace, mark appointment status `completed`, append immutable audit log, enable FHIR bundle download |

---

## 3. Clinical Workflow State Machine Diagrams

### A. SOAP Note Lifecycle State Machine
```
 (Drafting) ──> [Save Draft] ──> (Draft Saved) ──┬──> [Sign Note] ──> (Signed / Immutable) ──> [Amend Note] ──> (Amended Version N+1)
      │                                          │                           │
      └──> (Autosave / LocalStorage)             └──> (Local Recovery)       └──> [Direct Edits Rejected (409 Conflict)]
```

### B. NEWS2 Deterioration State Machine
```
 (Vitals Entry) ──> [Client Validation] ──> [Evaluate Score] ──> [Persist ScoreDoc]
                                                                        │
                                               ┌────────────────────────┴────────────────────────┐
                                               ▼                                                 ▼
                                    (Score 0-6: Low/Med Risk)                        (Score 7+: High Risk)
                                               │                                                 │
                                    [Append Trend Sparkline]                         [Trigger ObservationAlert]
                                                                                                 │
                                                                                     [Acknowledge Alert Button]
                                                                                                 │
                                                                                     (Alert Acknowledged)
```

### C. Diagnostic Orders State Machine
```
 [Place Order] ──> (Requested) ──> [Collect Sample] ──> (Sample Collected) ──> [Mark Processing] ──> (Processing) ──> [Upload Result] ──> (Completed)
        │                                 │                                          │
        └──> [Cancel Order (200 OK)] ─────┴──> [Cancel Order (200 OK)]             └──> [Cancel Blocked (422 Error)]
```

### D. Medication Administration Record (MAR) State Machine
```
 [Schedule Dose] ──> (Scheduled) ──> (Due Window) ──┬──> [Administer (5 Rights Verified)] ──> (Administered)
                                                   ├──> [Refuse (Patient Choice)]        ──> (Refused)
                                                   ├──> [Hold (Clinical Reason)]         ──> (Held)
                                                   └──> [Missed (Window Expire)]         ──> (Missed)
```

### E. Discharge Reconciliation State Machine
```
 [Compile Draft] ──> (Draft Compiled) ──> [Review Aggregated Data] ──> [Finalize Discharge] ──> (SHA-256 Hash Generated) ──> [Countersign] ──> (Encounter Locked)
```

---

## 4. 10 Bounded Context Domain Services

Every service class owns a single domain boundary and contains client-side business logic, validation, and event bus emissions:

1. **`auth.service.ts`**: Session validation, JWT expiry checking, credential login/logout execution.
2. **`rbac.service.ts`**: Permission checking (`hasPermission`), route authorization, role matrix evaluation.
3. **`patient.service.ts`**: Demographic formatting, MRN validation, allergy/condition parsing.
4. **`encounter.service.ts`**: Workspace initialization, status transitions (`in_progress` → `completed`), encounter lifecycle.
5. **`soap.service.ts`**: SOAP draft autosave, ICD-10 code parsing, CDS drug interaction evaluation, signature lock enforcement.
6. **`news2.service.ts`**: Vitals range validation (SpO2 0-100, BP 40-300), client-side NEWS2 score estimation, alert threshold triggering.
7. **`orders.service.ts`**: Order status state machine transition validation (blocking cancellation during processing), result reference range formatting.
8. **`mar.service.ts`**: 5 Rights of Medication Safety verification (Right Patient, Right Drug, Right Dose, Right Route, Right Time), dose schedule calculator.
9. **`discharge.service.ts`**: Un-administered MAR check, required discharge narrative validation, SHA-256 hash formatting, countersignature verification.
10. **`timeline.service.ts`**: Longitudinal event categorization, cursor-based pagination calculation, category filter parsing.
11. **`analytics.service.ts`**: Quality metric aggregation, trend percentage calculation.
12. **`fhir.service.ts`**: FHIR R4 JSON bundle validation, download trigger execution.

---

## 5. Universal Definition of "Done" Checklist

Every milestone must satisfy this 11-point checklist before completion:

- [ ] **1. API Contract Verified**: Request/Response DTOs match backend schema 100%.
- [ ] **2. Service Layer Built**: Clean separation in `*.service.ts` with no raw HTTP in components.
- [ ] **3. Repository Layer Built**: Caching, DTO mapping, and optimistic reconciliation handled.
- [ ] **4. Hook Layer Built**: Reusable custom React hooks provided.
- [ ] **5. Provider Integration**: Connected to shared context providers where applicable.
- [ ] **6. UI Component Connected**: Visual interface consuming hooks with zero console warnings.
- [ ] **7. Standardized Error Handling**: Loading, toast, banner, and rollback on error implemented.
- [ ] **8. Permission Checks Enforced**: UI guards & backend 403 error feedback handled cleanly.
- [ ] **9. Optimistic Updates Applied**: Instant UI feedback on mutation actions.
- [ ] **10. Tests Passing**: Backend Vitest (103/103) & Frontend Next.js build clean.
- [ ] **11. Workflow & Docs Verified**: Manual clinician workflow validated and documentation updated.
