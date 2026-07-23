# Complete API Contract Specification (`API_CONTRACT.md`)

> **Architectural Status**: FROZEN (Milestone 0 Freeze)  
> **Source of Truth**: Fastify Backend Routes (`auth.ts`, `onboarding.ts`, `public.ts`, `upload.ts`)

---

## Error Response Taxonomy

Every API endpoint responds with a standardized error structure when non-2xx status codes are returned:

```json
{
  "success": false,
  "message": "Human-readable error explanation",
  "details": []
}
```

### Standard Error Code Matrix

| Status Code | Error Classification | Frontend Handling |
|---|---|---|
| **400 Bad Request** | Schema Validation Failure | Display field-level inline validation error messages |
| **401 Unauthorized** | Missing/Expired JWT Cookie | Intercepted by `api.ts` → attempt `/auth/refresh` or trigger `auth-expired` |
| **403 Forbidden** | Insufficient RBAC Permissions | Display permission denied toast; disable non-authorized UI controls |
| **404 Not Found** | Missing Record ID | Display 404 EmptyState banner with back navigation |
| **409 Conflict** | Optimistic Lock / State Machine Violation | Open Conflict Resolution modal showing current server state vs local draft |
| **422 Unprocessable Entity** | Clinical Business Rule Violation | Display warning banner (e.g. Cannot finalize discharge with active un-administered stat orders) |
| **429 Too Many Requests** | Rate Limit Exceeded | Display "Please wait a moment before retrying" notification |
| **500 Internal Server Error** | Unexpected Server Exception | Display generic server error banner with retry button |

---

## Complete 78 Backend Endpoint Contracts

### 1. Authentication Domain

#### `POST /api/auth/login`
- **Permission**: Public (Rate-limit: 5 req/min)
- **Request DTO**: `{ email: string (email), password: string (min 6 chars) }`
- **Response DTO**: `{ success: true, data: { user: UserDTO, accessToken: string } }`
- **Error Codes**: 400 (Invalid credentials), 429 (Rate limit)

#### `POST /api/auth/register`
- **Permission**: Public (Rate-limit: 5 req/min)
- **Request DTO**: `{ name: string, email: string, password: string, phone?: string, dob?: string, gender?: string }`
- **Response DTO**: `{ success: true, data: { user: UserDTO, accessToken: string } }`

#### `POST /api/auth/refresh`
- **Permission**: Public (Cookie: `refresh_token`)
- **Response DTO**: `{ success: true, data: { accessToken: string } }`
- **Error Codes**: 401 (Invalid/expired refresh token)

#### `POST /api/auth/logout`
- **Permission**: Public
- **Response DTO**: `{ success: true, message: "Logged out successfully" }`

#### `GET /api/auth/me`
- **Permission**: Authenticated
- **Response DTO**: `{ success: true, data: { id: string, name: string, email: string, role: string, permissions: string[], organizationId: string } }`

---

### 2. Clinical Documentation (SOAP) Domain

#### `POST /api/encounters`
- **Permission**: `MANAGE_CLINICAL_NOTES`
- **Request DTO**: `{ clinicId: string, patientId: string, appointmentId?: string, encounterType?: "opd" | "ipd" | "emergency" }`
- **Response DTO**: `{ success: true, data: { id: string, status: "in_progress", startedAt: string } }`

#### `POST /api/clinical-notes`
- **Permission**: `MANAGE_CLINICAL_NOTES`
- **Request DTO**:
  ```json
  {
    "clinicId": "ObjectId",
    "encounterId": "ObjectId",
    "patientId": "ObjectId",
    "chiefComplaint": "string (required)",
    "historyOfPresentIllness": "string",
    "symptoms": ["string"],
    "physicalExamination": "string",
    "diagnoses": [{ "code": "string", "codingSystem": "ICD-10", "description": "string", "status": "active" }],
    "severity": "mild | moderate | acute | severe",
    "treatmentPlan": "string",
    "vitals": { "bpSystolic": "number", "bpDiastolic": "number", "pulseRate": "number", "spO2": "number", "temperatureF": "number" },
    "prescriptions": [{ "name": "string", "dosage": "string", "duration": "string" }]
  }
  ```
- **Response DTO**: `{ success: true, data: ClinicalNoteDTO }`

#### `PUT /api/clinical-notes/:id/sign`
- **Permission**: `MANAGE_CLINICAL_NOTES`
- **Response DTO**: `{ success: true, data: { id: string, isFinal: true, signedAt: string } }`
- **Error Codes**: 409 (Note already signed)

#### `POST /api/clinical-notes/:id/amend`
- **Permission**: `MANAGE_CLINICAL_NOTES`
- **Request DTO**: `{ amendmentReason: string, subjective?: object, objective?: object, assessment?: object, plan?: object }`
- **Response DTO**: `{ success: true, data: ClinicalNoteDTO (version N+1, parentNoteId) }`

#### `GET /api/patients/:id/clinical-notes/history`
- **Permission**: `VIEW_EHR`
- **Query Params**: `page=1&limit=10`
- **Response DTO**: `{ success: true, data: { notes: ClinicalNoteDTO[], total: number } }`

---

### 3. NEWS2 Deterioration & Alerts Domain

#### `POST /api/encounters/:id/evaluate-score`
- **Permission**: `VIEW_EHR`
- **Request DTO**: `{ algorithmId?: "NEWS2" }`
- **Response DTO**:
  ```json
  {
    "success": true,
    "data": {
      "score": { "totalScore": 8, "riskCategory": "High", "evaluatedAt": "ISOString" },
      "alert": { "id": "ObjectId", "severity": "High", "acknowledged": false } | null
    }
  }
  ```

#### `GET /api/encounters/:id/scores`
- **Permission**: `VIEW_EHR`
- **Response DTO**: `{ success: true, data: ObservationScoreDTO[] }`

#### `POST /api/alerts/:id/acknowledge`
- **Permission**: `MANAGE_CLINICAL_NOTES`
- **Response DTO**: `{ success: true, data: { id: string, acknowledged: true, acknowledgedAt: string } }`

#### `GET /api/patients/:id/vital-trends`
- **Permission**: `VIEW_EHR`
- **Response DTO**: `{ success: true, data: { vitals: [{ code: string, readings: [{ value: string, timestamp: string }] }] } }`

---

### 4. Diagnostic Orders Domain

#### `POST /api/encounters/:id/orders`
- **Permission**: `MANAGE_ORDERS`
- **Request DTO**: `{ patientId: string, testId: string, priority: "routine" | "urgent" | "stat", clinicalReason?: string }`
- **Response DTO**: `{ success: true, data: LabOrderDTO }`

#### `GET /api/encounters/:id/orders`
- **Permission**: `VIEW_EHR`
- **Response DTO**: `{ success: true, data: LabOrderDTO[] }`

#### `PUT /api/orders/:id/collect`
- **Permission**: `MANAGE_ORDERS`
- **Response DTO**: `{ success: true, data: { id: string, status: "sample-collected", collectedAt: string } }`

#### `PUT /api/orders/:id/process`
- **Permission**: `MANAGE_ORDERS`
- **Response DTO**: `{ success: true, data: { id: string, status: "processing" } }`

#### `PUT /api/orders/:id/result`
- **Permission**: `MANAGE_ORDERS`
- **Request DTO**: `{ value: string, unit?: string, referenceRange?: string, interpretation?: "normal" | "abnormal" | "critical", isAbnormal: boolean }`
- **Response DTO**: `{ success: true, data: { id: string, status: "result-uploaded", result: ResultDTO } }`

#### `PUT /api/orders/:id/cancel`
- **Permission**: `MANAGE_ORDERS`
- **Request DTO**: `{ cancellationReason: string }`
- **Error Codes**: 422 (Cannot cancel order already in processing or completed state)

---

### 5. Medication Administration Record (MAR) Domain

#### `POST /api/encounters/:id/mar`
- **Permission**: `ADMINISTER_MEDICATION`
- **Request DTO**: `{ prescriptionId: string, medicationName: string, dosage: string, route: string, scheduledTime: string }`
- **Response DTO**: `{ success: true, data: MARDoseDTO }`

#### `GET /api/encounters/:id/mar`
- **Permission**: `VIEW_EHR`
- **Response DTO**: `{ success: true, data: MARDoseDTO[] }`

#### `PUT /api/mar/:id/administer`
- **Permission**: `ADMINISTER_MEDICATION`
- **Request DTO**: `{ notes?: string }`
- **Response DTO**: `{ success: true, data: { id: string, status: "administered", administeredAt: string } }`

#### `PUT /api/mar/:id/refuse`
- **Permission**: `ADMINISTER_MEDICATION`
- **Request DTO**: `{ refusalReason: string }`
- **Response DTO**: `{ success: true, data: { id: string, status: "refused" } }`

#### `PUT /api/mar/:id/hold`
- **Permission**: `ADMINISTER_MEDICATION`
- **Request DTO**: `{ holdReason: string }`
- **Response DTO**: `{ success: true, data: { id: string, status: "held" } }`

#### `GET /api/prescriptions/:id/mar`
- **Permission**: `VIEW_EHR`
- **Response DTO**: `{ success: true, data: MARDoseDTO[] }`

---

### 6. Discharge Summary Domain

#### `POST /api/encounters/:id/discharge/compile`
- **Permission**: `MANAGE_DISCHARGE_SUMMARY`
- **Response DTO**: `{ success: true, data: DischargeSummaryDraftDTO }`

#### `GET /api/encounters/:id/discharge`
- **Permission**: `VIEW_EHR`
- **Response DTO**: `{ success: true, data: DischargeDocumentDTO }`

#### `PUT /api/discharge/:id/finalize`
- **Permission**: `MANAGE_DISCHARGE_SUMMARY`
- **Request DTO**: `{ summaryNarrative: string, dischargeInstructions?: string, followupDate?: string }`
- **Response DTO**: `{ success: true, data: { id: string, isFinal: true, documentHash: string (SHA-256), finalizedAt: string } }`

#### `PUT /api/discharge/:id/countersign`
- **Permission**: `MANAGE_DISCHARGE_SUMMARY`
- **Response DTO**: `{ success: true, data: { id: string, countersignedBy: string, countersignedAt: string } }`

#### `GET /api/discharge/:id`
- **Permission**: `VIEW_EHR`
- **Response DTO**: `{ success: true, data: DischargeDocumentDTO }`

---

### 7. Clinical Search, Analytics & FHIR Domain

#### `GET /api/patients/:id/search`
- **Permission**: `VIEW_EHR`
- **Query Params**: `q=string&category=notes|medication|lab|discharge|all`
- **Response DTO**: `{ success: true, data: { items: SearchResultItemDTO[], total: number } }`

#### `GET /api/encounters/:id/summary-report`
- **Permission**: `VIEW_EHR`
- **Response DTO**: `{ success: true, data: EncounterSummaryReportDTO }`

#### `GET /api/analytics/quality-metrics`
- **Permission**: `VIEW_ANALYTICS`
- **Response DTO**: `{ success: true, data: QualityMetricsDTO }`

#### FHIR R4 Interoperability Endpoints
- `GET /api/fhir/R4/Patient/:id` → FHIR Patient Resource
- `GET /api/fhir/R4/Encounter/:id` → FHIR Encounter Resource
- `GET /api/fhir/R4/Observation/:id` → FHIR Observation Resource
- `GET /api/fhir/R4/Encounter/:id/$export` → FHIR Bundle Export Document
- `GET /api/fhir/R4/DiagnosticReport/:id` → FHIR DiagnosticReport Resource
- `GET /api/fhir/R4/MedicationAdministration/:id` → FHIR MedicationAdministration Resource
- `GET /api/fhir/R4/Composition/:id` → FHIR Composition Document
