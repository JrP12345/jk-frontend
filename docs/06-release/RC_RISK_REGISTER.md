# Release Candidate Risk Register (`RC_RISK_REGISTER.md`)

> **Release Target**: Enterprise Clinical Operating System (v2.0 Production Release Candidate)  
> **Governance Status**: Active Living Risk Log

---

## Active Risk Log

| Risk ID | Risk Description | Likelihood | Impact | Mitigation Strategy | Owner | Status |
|---|---|---|---|---|---|---|
| **RISK-01** | High concurrent clinician load under peak hospital hours causing DB pool contention | Medium | High | Perform load testing with 200+ simulated concurrent sessions on staging | SRE / Backend | Open |
| **RISK-02** | External security vulnerability / penetration testing not completed | Low | High | Schedule third-party penetration testing and dependency audit before GA | Security | Open |
| **RISK-03** | End-user clinician UAT feedback requiring workflow adjustments | Medium | High | Conduct 2-week pilot deployment in selected outpatient department | Clinical Ops | Open |
| **RISK-04** | Disaster Recovery (DR) MongoDB point-in-time restore (PITR) unverified | Low | High | Execute automated DR restore dry-run on staging environment | DevOps | Open |
| **RISK-05** | Legacy browser compatibility issues in hospital workstation environments | Low | Medium | Execute automated CrossBrowser testing across Chrome, Edge, and Safari | QA Lead | Open |

---

## Risk Review Cadence
This risk register is reviewed daily during the RC Stabilization Phase. Risks are closed only when concrete test evidence or sign-off documentation is provided.
