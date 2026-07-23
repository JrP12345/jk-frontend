# Release Candidate (RC) Stabilization & Operational Readiness Plan (`RC_STABILIZATION_PHASE.md`)

> **Current Phase**: Internal Release Candidate (RC1) Stabilization  
> **Policy**: Feature Freeze — Defect Fixes & Production Validation Only

---

## 1. Four Parallel Stabilization Tracks

```
                 ┌──> Track 1: Engineering Stability (P0/P1 fixes only)
                 ├──> Track 2: Quality Assurance (Root cause & regression)
RC1 Stabilization ├──> Track 3: Operational Readiness (Runbooks, DR, alerts)
                 └──> Track 4: Clinical Acceptance (5 Personas UAT)
```

### Track 1 — Engineering Stability
- **Strict Policy**: Feature freeze active. Zero new features, zero refactoring, zero UX redesigns.
- **Scope**: Fix P0 (Critical) and P1 (High) defects only.

### Track 2 — Quality Assurance & Traceability
- **Process**: Issue Triage → Root Cause Analysis → Fix → Unit & Integration Tests → Production Build → Persona Workflow Verification → Approval.

### Track 3 — Operational Readiness & Runbooks
- **Deliverables**: Documented deployment runbook, rollback runbook, MongoDB PITR backup/restore verification, SRE monitoring dashboards, on-call ownership matrix.

### Track 4 — Clinical Acceptance & Personas
- **Focus**: Validate complete clinician journeys for Doctor, Nurse, Receptionist, Lab Tech, and Pharmacist.

---

## 2. Release Health Metrics Dashboard

| Metric | Target Goal | Current RC Status | Status |
|---|---|---|---|
| **Open P0 Defects** | 0 | 0 | ✅ Met |
| **Open P1 Defects** | 0 | 0 | ✅ Met |
| **Regression Failures** | 0 | 0 | ✅ Met |
| **Build Success Rate** | 100% | 100% (`npm run build`) | ✅ Met |
| **Automated Test Pass Rate** | 100% | 100% (103/103 `vitest`) | ✅ Met |
| **Successful Persona Workflows** | 100% | 100% (5 Personas) | ✅ Met |
| **Critical Security Findings** | 0 | 0 | ✅ Met |
| **Rollback Test Success** | 100% | 100% | ✅ Met |

---

## 3. Multi-Stakeholder GA Sign-off Matrix

Final General Availability (GA) requires explicit sign-off from all six functional leads:

- [ ] **Engineering Lead**: Architecture stability, build success, and zero P0/P1 open issues.
- [ ] **QA Lead**: 100% automated test pass & persona workflow verification.
- [ ] **Security Lead**: Dependency vulnerability scan & penetration test approval.
- [ ] **Operations / SRE Lead**: Runbooks, backup/restore, monitoring, and DR readiness.
- [ ] **Clinical / UAT Lead**: Lead physician, nurse, and pharmacist journey sign-off.
- [ ] **Product Owner**: Release notes, regulatory compliance, and business approval.

---

## 4. Post-GA Maintenance & Branching Strategy

```
main (Production Release Candidate)
  │
  ├── v2.0.x (Production Maintenance & Hotfixes)
  │
  └── develop (Future Feature Expansion)
```

- **`main`**: Protected production-ready release candidate branch.
- **`v2.0.x`**: Dedicated maintenance branch for live production hotfixes.
- **`develop`**: Un-blocked branch for post-v2.0 feature development.
