# Patient-optional pharmacy invoices

T14 is implemented locally. Counter issue reuses `Invoice`, `PharmacyDispense`, FEFO, the shared calculator, numbering and command receipts. It creates no Patient, Doctor, Encounter, appointment or prescription. Positive-value issue produces an **unpaid issued invoice**, never proof of payment. T17 now supplies confirmed collections and T15 supplies the keyboard counter workspace. A fully discounted zero-total bill settles without a money receipt.

The user confirmed on 20 October 2026 that the whole project is in development with no production customers or legacy records. Use the current intended contracts directly, without historical backfill or speculative compatibility work. Preserve current clinical, financial and security flows.

## API and authority

| Route | Contract |
| --- | --- |
| `POST /api/pharmacy/sales` | Staff, pharmacy module, current branch authority, `PHARMACY_SELL` or organization-management grant, enabled branch and stable `Idempotency-Key`. |
| `GET /api/pharmacy/sale-operations/:key?locationId=…` | Current sales/history authority, selected branch and original actor; immutable committed result. |
| `GET /api/pharmacy/invoices?locationId=…&cursor=…` | Sales/history authority, explicit branch, ID cursor, 25 rows per page and no clinical invoices. |
| `GET /api/pharmacy/invoices/:id?locationId=…` | Sales/history authority and branch ownership; committed invoice with captured selling/unit/batch/printed-expiry/MRP evidence, excluding acquisition costs. |

`viewSales` is granted by `PHARMACY_SELL`, `PHARMACY_COLLECT_PAYMENT` or organization management. `sell` permits issue and requires enabled pharmacy; authorized history/recovery remains available after disable. Patient/family/guest denial applies independently of grants. Generic clinical billing and stock permissions do not authorize retail issue. Responses use `Cache-Control: no-store`.

The strict input contains location, expected issuer revision, confirmed total in paise, optional customer ID/revision, optional invoice discount/round-off and 1–100 distinct product lines. Each line supplies stable line ID, product ID, positive whole base quantity, expected unit/stock revisions and optional integer discount. No client selling price, clinical ID, paid status, arbitrary customer snapshot or allocation is accepted. Numeric strings/null are not coerced into financial values.

The confirmed total is an assertion, not client calculation authority. The server prices actual allocated lots and rolls back the whole command if the total differs. T15 provides the trusted quote/cart, current revisions and material quote hash; no frontend financial calculator is introduced.

## Issue transaction

This first path accepts reviewed **general** products only. Restriction/tax classifications must have actual captured review evidence matching current product metadata. Schedule H/H1/X, narcotics and unreviewed ordinary classifications cannot use it. Authorized clinical dispensing keeps its own supported prescription path; external restricted prescriptions need their separate evidence workflow.

The issuer requires a reviewed India/INR profile and matching expected revision. Existing local counter-pickup, inclusive-price, B2C, high-value recipient-evidence and electronic-reporting boundaries apply. No interstate/B2B/export/reverse-charge path is activated. Anonymous issue displays “Walk-in customer” without manufacturing an identity. Identified customers must be active branch-visible customer parties at the expected revision; their name/address/contact are captured. A GSTIN requires a separately supported B2B path.

Counter stock requires captured owned lots with valid unit/cost/expiry snapshots and actual MRP. Lot quantities must reconcile to the aggregate within the 5,000-lot review bound. FEFO validates captured units/prices/MRP and eligible expiry. Source HSN/GST must match reviewed product classification. Selling prices come from those lots, never catalogue/client overrides.

`pharmacy-paise-v2` calculates inclusive paise amounts, line and deterministic invoice discounts, tax and explicit round-off. The transaction creates `kind: pharmacy`, `documentVersion: 2`, actual `createdBy`, customer/tax/calculation snapshots, numbered Invoice items with dispense/source-line references, and an append-only `PharmacyDispense` with no clinical IDs. Source lines capture real units, lots, selling prices, printed expiry and MRP.

Stock deltas, movements, invoice, source, required audit, capability pin and encrypted result commit together with majority write concern. Same-key/same-input retry returns the original invoice; changed committed input conflicts. A separate sale uses a new key and current revisions. Concurrent last-unit sales cannot both commit. Later-line, total or audit failures roll back earlier stock changes. Recovery returns invoice/dispense IDs, number, paise total, unpaid status and key without reconstructing current stock or collecting money.

Prescription uniqueness now applies to `PharmacyDispense.kind: clinical`. Retail empty prescription lists do not collide with each other. Initial development indexes must match this current schema; issue returns 503 for an obsolete unscoped index instead of modifying it. Prepare current indexes through the existing development setup workflow. No live database/index action ran here.

## Shared readers and print

Clinical invoices still require Patient and Doctor. Clinical list/detail/payment routes exclude retail bills; clinical insurance and hosted payment-link lookups also reject retail IDs. Portal consumers cannot inherit counter customer access. Clinical billing exports remain clinical, avoiding fabricated patient labels. CRM appointment receipts still require actual appointment/patient evidence and are not triggered by unpaid issue.

Issued pharmacy documents freeze kind, actor, customer, source, amounts, calculation/tax and issue metadata. Model validation checks line/aggregate paise reconciliation, source IDs, positive quantities, version/currency and local tax mode. Later authorized settlement may update payment fields; correction through editing/deleting an issued bill is blocked. Source-bound returns/credits remain T19.

The existing pharmacy print component and shared print lifecycle accept committed version-2 snapshots without clinical IDs. They display captured issuer/recipient, number/date, units, real lots, printed expiry/MRP, tax, discounts already included in line totals and round-off. Missing actor/customer/calculation/lot evidence or inconsistent totals blocks print. Reprint never issues again or changes stock/money.

T20 additionally uses `documentVersion: 3` for explicit opening balance statements in the pharmacy payment aggregate. These are source-reviewed debts, with their own `O…` sequence and statement preview; they create no supply/tax/stock/clinical records. Retail supply and return readers use version 2. Customer collections against opening statements still use the same authoritative receipt ledger. See [the finance contract](pharmacy-finance.md).

T17 supplies collection, split/credit authority and confirmed receipt recovery. T15 supplies quote/cart/scanning UX; `counterSalesAvailable` follows current sales authority. T18 supplies broader print/recovery tools and real-device checks. Professional licensing/tax review and release gates remain required; legacy migration is outside current scope.
