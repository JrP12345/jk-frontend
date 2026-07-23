# Master Clinical Platform Release & Acceptance Checklist (`RELEASE_CHECKLIST.md`)

> **Release Target**: Enterprise Clinical Operating System (v2.0 Production Release Candidate)  
> **Source of Truth**: Fastify Backend Engines & Next.js 16 Frontend Architecture

---

## 1. Milestone Delivery Progress

- [x] **Milestone 0**: Domain Contract & Architecture Freeze (`FRONTEND_BACKEND_SYNC.md`, `API_CONTRACT.md`, `WORKFLOW_STATE_MACHINES.md`)
- [x] **Milestone 1**: Provider Architecture (`EncounterProvider`), EventBus (`EncounterEventBus`), & 11 Bounded Domain Services
- [x] **Milestone 2**: Critical Route Repairs (NEWS2 `/evaluate-score`, MAR `administer|refuse|hold`, Discharge `/compile` & `/finalize`)
- [x] **Milestone 3**: Consultation Workspace Coordinated Pipeline (`/dashboard/consultations/[id]` → Full 6-tab `EncounterWorkspace` + FHIR R4 Export)
- [x] **Milestone 4**: SOAP Lifecycle Completion (Draft → Autosave → Local Recovery → Sign → Lock → Amend → History → Audit Trail)
- [x] **Milestone 5**: NEWS2 Deterioration & Clinical Alerts Engine (Vitals Validation → Evaluate → Trend Sparkline → Alert Escalation → Acknowledgment)
- [x] **Milestone 6**: Diagnostic Orders State Machine (Place → Collect → Process → Result → Cancel Block Guard)
- [x] **Milestone 7**: MAR State Machine (Schedule Doses → 5 Rights Administer → Refuse → Hold → History)
- [x] **Milestone 8**: Discharge Reconciliation & SHA-256 Immutable Lock Lifecycle (Compile → Review → Finalize → Countersign → Lock)
- [x] **Milestone 9**: Operational RBAC UI Guards & Executive Quality Metrics Dashboard
- [x] **Milestone 10A**: Contextual FHIR R4 Exports (Patient, Encounter, DiagnosticReport, Composition)
- [x] **Milestone 10B**: End-to-End Clinical Workflow Regression Test
- [x] **Milestone 10C**: Performance Budgets & Network Optimization (LCP < 2s, Tab Switch < 200ms)
- [x] **Milestone 10D**: WCAG 2.1 AA Accessibility & Failure Mode Hardening

---

## 2. Clinician Persona Journey Acceptance Matrix

### A. Doctor Journey
`Login` ──> `Queue` ──> `Consultation` ──> `SOAP` ──> `Vitals` ──> `NEWS2` ──> `Orders` ──> `Medication` ──> `Discharge` ──> `Complete`
- [x] Login & Authentication
- [x] View Live Patient Queue & Priority Slots
- [x] Open Coordinated Encounter Workspace
- [x] Document SOAP Note (Draft, Autosave, Sign, Amend, Version History)
- [x] Evaluate NEWS2 Score
- [x] Place Diagnostic Orders
- [x] Review & Prescribe Medication
- [x] Finalize Discharge & SHA-256 Lock
- [x] Complete Appointment Status

### B. Nurse Journey
`Login` ──> `Ward` ──> `MAR` ──> `Vitals` ──> `NEWS2` ──> `Medication Admin` ──> `Documentation`
- [x] Login & Session Authentication
- [x] Access Inpatient Ward / MAR Schedule
- [x] Perform 5 Rights Medication Administration Verification
- [x] Record Administered / Refused / Held Doses
- [x] Record Vitals & Trigger NEWS2 Score Evaluation
- [x] Acknowledge High-Risk Deterioration Alerts

### C. Receptionist Journey
`Appointment` ──> `Queue` ──> `Patient Search` ──> `Billing & Collect`
- [x] Book New Appointment (Search existing or create new patient profile)
- [x] Manage Queue Tokens & VIP Overrides
- [x] Generate Patient Token Slip & Print Receipt
- [x] Collect Outpatient Consultation Payments

### D. Lab Technician Journey
`Orders` ──> `Collect Sample` ──> `Process Sample` ──> `Upload Results`
- [x] View Diagnostic Order Worklist
- [x] Mark Sample Collected
- [x] Transition Order to Processing State
- [x] Upload Lab Results & Flag Abnormal References

### E. Pharmacist Journey
`Prescription` ──> `Safety Check` ──> `Dispense` ──> `MAR Audit`
- [x] View Prescribed Medications Queue
- [x] Run CDS Drug Interaction Safety Check
- [x] Dispense Prescription & Deduct Inventory Stock
- [x] Verify MAR Schedule Synced

---

## 3. Final Release Quality Gates

- [x] **Backend Test Suite**: 103/103 tests passing 100% (`npx vitest run`)
- [x] **Frontend Build**: Zero TypeScript errors (`npm run build`)
- [x] **Zero 404/405 Errors**: All network requests hit valid backend routes
- [x] **Performance Budgets**: LCP < 2.0s, Tab switch < 200ms, Search < 300ms
- [x] **Accessibility**: WCAG 2.1 AA compliant, 100% keyboard navigable
- [x] **Security & Audit**: Audit trail generated for all clinical mutations
- [x] **Release Candidate Approved**: Ready for deployment
