# Master Go-Live Playbook & Deployment Runbook (`GO_LIVE_PLAYBOOK.md`)

> **Release Target**: Enterprise Clinical Operating System (v2.0 Production Release Candidate)  
> **Source of Truth**: Fastify Backend Engines & Next.js 16 Production Architecture

---

## 1. Pre-Deployment Protocol

Before opening the maintenance window for production deployment, complete the following verification steps:

- [ ] **1. Release Tag Verification**: Confirm Git tag `v2.0.0-rc1` is tagged on the protected `main` branch.
- [ ] **2. Branch Integrity**: Verify `main` branch status is clean with zero uncommitted changes or unreviewed PRs.
- [ ] **3. Deployment Freeze Notice**: Issue maintenance window notification to all clinical departments 24h prior.
- [ ] **4. Production Database Backup**: Perform full MongoDB cluster snapshot & verify Point-In-Time Restore (PITR) oplog state.
- [ ] **5. Monitoring & Probes Active**: Confirm SRE readiness and liveness probes (`/api/health/readiness`, `/api/health/liveness`) are connected to monitoring dashboards.
- [ ] **6. Stakeholder Standby**: Confirm engineering on-call, QA lead, DevOps, and clinical leads are active in the deployment bridge.

---

## 2. Step-by-Step Deployment Runbook

```
[Maintenance Window Open] ──> [Deploy Backend] ──> [Run DB Migrations] ──> [Health Probe Check] ──> [Deploy Frontend] ──> [Smoke Tests] ──> [Enable Traffic]
```

### Execution Steps
1. **Maintenance Window Open (T-00:00)**: Route ingress traffic to maintenance splash page.
2. **Deploy Fastify Backend (T+00:05)**:
   - Deploy backend container image `healthos-backend:v2.0.0` to production cluster.
   - Verify environment configuration variables (`CORS_ALLOWED_ORIGINS`, `JWT_PUBLIC_KEY`, `MONGODB_URI`).
3. **Database Migration Execution (T+00:10)**:
   - Execute database schema migration scripts (`npm run db:migrate`).
4. **Backend Health Verification (T+00:15)**:
   - Query `GET /api/health/readiness`. Expect `200 OK` (`{ status: "ready", database: "connected", redis: "ready" }`).
5. **Deploy Next.js Frontend (T+00:20)**:
   - Deploy frontend container image `healthos-frontend:v2.0.0`.
6. **Production Smoke Testing (T+00:25)**:
   - Execute automated smoke test suite against staging ingress.
7. **Traffic Enablement (T+00:30)**:
   - Remove maintenance splash page; switch DNS / load balancer ingress to live production containers.

---

## 3. Immediate 30-Minute Post-Deployment Validation Protocol

During the first 30 minutes following traffic enablement, perform live validation across all 9 critical operational capabilities:

- [ ] **1. Authentication**: Verify user login (`POST /api/auth/login`) and token refresh (`POST /api/auth/refresh`).
- [ ] **2. Patient Search**: Perform patient search query (`GET /api/patients?search=jay`).
- [ ] **3. Consultation Session**: Initialize new consultation encounter (`POST /api/encounters`).
- [ ] **4. SOAP Document Signing**: Save draft note and execute digital signature (`PUT /api/clinical-notes/:id/sign`).
- [ ] **5. NEWS2 Deterioration**: Calculate NEWS2 score (`POST /api/encounters/:id/evaluate-score`).
- [ ] **6. MAR Administration**: Execute 5 Rights dose administration (`PUT /api/mar/:id/administer`).
- [ ] **7. Diagnostic Order Placement**: Place diagnostic order (`POST /api/encounters/:id/orders`).
- [ ] **8. Discharge Finalization**: Finalize discharge summary & verify SHA-256 hash generation (`PUT /api/discharge/:id/finalize`).
- [ ] **9. Audit Logging**: Confirm security audit log entries generated (`GET /api/audit-logs`).

---

## 4. Rehearsed Rollback Protocol & Decision Tree

```
Critical Failure Detected ──> [Disable Traffic] ──> [Rollback Frontend] ──> [Rollback Backend] ──> [Restore DB Oplog] ──> [Verify System] ──> [Incident Review]
```

### Rollback Decision Triggers
If any of the following occur within the 30-minute validation window, immediately trigger the Rollback Protocol:
- Backend `/api/health/readiness` fails for > 2 consecutive minutes.
- Unhandled 500 Error rate exceeds 0.5% of total requests.
- Data corruption or patient record linkage discrepancy detected.

### Rollback Execution Steps
1. **Disable Ingress Traffic**: Re-route public traffic immediately to maintenance splash page.
2. **Rollback Frontend Container**: Roll back frontend deployment to previous stable version tag (`v1.9.x`).
3. **Rollback Backend Container**: Roll back backend deployment to previous stable version tag (`v1.9.x`).
4. **Restore Database Oplog (If required)**: If DB migration altered schema destructively, restore MongoDB snapshot to pre-deployment timestamp.
5. **System Health Verification**: Confirm previous version health probes return `200 OK`.
6. **Re-Enable Traffic**: Remove maintenance page and resume production traffic on previous version.
7. **Post-Mortem Incident Review**: Schedule root cause analysis (RCA) meeting within 24 hours.

---

## 5. 24–72 Hour Hypercare Support Framework

Following General Availability (GA), the system enters a 72-hour Hypercare phase:

- **On-Call Ownership**: Primary SRE and Lead Engineer on 24/7 dedicated standby.
- **Response SLAs**:
  - **P0 Critical Incident**: `< 15 minute` initial response time.
  - **P1 High Incident**: `< 30 minute` initial response time.
- **Monitoring Cadence**: Hourly review of error logs, CPU/Memory utilization, and DB connection pool stats.
- **Dedicated Communication**: Active `#healthos-hypercare` Slack/Teams channel for instant hospital IT communication.

---

## 6. Post-GA Success Metrics

| Metric | Target | Evaluation Method |
|---|---|---|
| **System Availability** | `≥ 99.9%` | Automated uptime monitoring |
| **Open P0 Incidents** | `0` | SRE incident log |
| **Open P1 Incidents** | `0` | SRE incident log |
| **Failed Deployments** | `0` | Deployment pipeline logs |
| **Mean Time to Recover (MTTR)** | `< 15 min` | Incident response log |
| **Successful Clinician Workflows** | `≥ 99.0%` | End-to-end telemetry |
| **User-Reported Critical Defects** | `0` | Hospital IT helpdesk tickets |

---

## 7. Transition to Long-Term Maintenance Program

```
[Implementation] ──> [Release Candidate] ──> [General Availability] ──> [Hypercare (72h)] ──> [Maintenance (v2.0.x)] ──> [Next Cycle (develop)]
```

Upon successful completion of the 72-hour Hypercare period, the release project is formally closed:
- Maintenance releases and production hotfixes are conducted exclusively on `v2.0.x`.
- Feature expansion resumes on `develop`.
