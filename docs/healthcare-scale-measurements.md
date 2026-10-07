# Healthcare workload measurements — 2026-10-04

Reproducible harness: `backend/scripts/measure-healthcare-scale.ts`. Run from the backend with `node --experimental-strip-types scripts/measure-healthcare-scale.ts`. It creates and removes its own MongoDB replica set, never loads `.env`, and does not use configured databases, Redis, payment providers or real patients. Raw results: `backend/docs/measurements/healthcare-scale-baseline.json`.

## Local baseline

One warm-up followed by seven sequential timed samples, on the machine recorded in the JSON artifact. These are local warm measurements, not network/browser timings, concurrent-load results, tail-latency estimates or production SLA evidence.

| Workload | Fixture size | Median / max | JSON payload |
| --- | --- | --- | --- |
| Replacement-provider API, 10 providers | 1,000 appointments; 100/provider on the location day | 16.66 / 35.86 ms | 2,304 bytes |
| Replacement-provider API, 100 providers | 10,000 appointments; 100/provider on the location day | 38.33 / 80.29 ms | 24,984 bytes |
| ROOT dashboard service, 50 organizations | 500 providers, 15,000 appointments, 50 subscriptions, 33 captures | 75.15 / 91.70 ms | 8,549 bytes |
| ROOT dashboard service, 500 organizations | 5,000 providers, 150,000 appointments, 500 subscriptions, 333 captures | 570.75 / 663.23 ms | 8,597 bytes |

Replacement measurements run through authenticated Fastify injection. ROOT measurements call the existing dashboard service with a fixed date and include its database/aggregation work; they do not include route/auth or HTTP overhead. Each ROOT organization has one location, ten active Doctor/User identity pairs, 100 visits across forty recent days and 200 older visits from 190-389 days ago. The harness asserts the joined provider total and monthly booking count. Rich clinical documents, diagnostics, multi-location operations, audit history and competing users are not represented. The final measurement ran after the full test process ended to avoid that process distorting timings; it replaces the initial recent-only fixture.

## Execution plans and decisions

- Replacement location/day load uses existing `locationId_1_status_1_appointmentTime_-1`, examining 1,000/10,000 matching documents. The query count remains constant as provider count grows; returned choices grow from 9 to 99. Keep the existing batched reads. A 25 KB selector response does not by itself justify a pagination rewrite.
- ROOT's organization inventory performs an expected global COLLSCAN of 50/500 organizations. The representative booking match uses `organizationId_1`, examining 15,000/150,000 records to return 5,000/50,000 recent records. The JSON response stays near 8.6 KB because activity and organization snippets are bounded.
- The ROOT median grows about 7.6 times for tenfold fixture volume. Retained history triples documents examined compared with recent matches, making a tenant/date index a concrete candidate for a measured follow-up. Compare the full aggregation plan and end-to-end latency with candidate indexes on disposable fixtures, then validate concurrent staging load before any migration. This baseline does not prove an index benefit or justify a materialized-summary service.
- No production index, pagination, infrastructure or customer-size-specific architecture change follows from this baseline. Current data supports a specific future investigation of ROOT aggregation cost, not a claim that all workloads are fast at 500 organizations.

## Next measurement gate

On staging with synthetic tenants, repeat representative response sizes and execution plans with retained history and controlled concurrency. Record p50/p95/p99 with enough samples, database CPU/working-set size, error rate and pool saturation. Include daily queue, invoice/patient lists, team selectors and multi-location permissions. Agree response/latency budgets from actual use before optimizing those paths.
