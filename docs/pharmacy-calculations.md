# Pharmacy calculation contract

T16 is implemented locally. `B:services/InvoiceCalculationService.ts` owns the `pharmacy-paise-v2` policy. The calculator is deterministic and has no database writes, rate lookup, professional approval or payment/stock effects. Existing clinical invoice arithmetic and issued historical documents retain their existing policies. No rate or issuer configuration has been activated.

## Inputs and rounding

Every request explicitly names the policy, INR currency, inclusive/exclusive price basis and tax mode. Every stable, unique line ID carries a positive safe base-unit quantity, a rational unit price (`numeratorPaise / denominatorUnits`) and an explicit effective GST rate in integer basis points. Zero rates are retained. Rational quantities are multiplied using BigInt before a single half-up rounding to whole line paise; a purchase's captured cost total can therefore be spread over billed and free units without rounding a per-tablet price first.

Line discounts apply to that document's price basis first: inclusive amounts for inclusive sales, before-tax amounts for exclusive purchase bills. Invoice discounts then allocate proportionally over remaining line amounts. Largest remainders receive the remaining paise; stable line IDs break ties using code-unit order, independent of line order or locale. A fully discounted line has no base or tax. Inclusive base rounds half up and tax is the remainder of the exact discounted gross; exclusive tax rounds half up on the discounted base.

Tax mode explicitly selects CGST/SGST, CGST/UTGST, IGST, unsplit draft GST or no collection. An odd local tax paise goes to SGST/UTGST, preserving existing SGST behavior. Non-collecting profiles must supply an explicit effective zero rate. The calculator never decides which jurisdiction or registration applies. Issuing services must validate effective issuer/product/source evidence and capture its revision, rate, HSN and date before calling it. Historical return credit must use the original source policy and tax snapshot, rather than current rates.

Optional captured rational MRP is always tax-inclusive. Both the undiscounted exact unit price including tax and the rounded line gross must fit the captured cap; discounts cannot hide an excessive selling price. A return is calculated as a positive credit magnitude. Remaining source quantity, cumulative credit caps, credit numbering and refund authority remain T19/T20 transaction responsibilities.

Round-off is an explicit signed integer from −99 to 99 paise, added after line totals. Default is zero; no automatic rounding or balancing to a user-entered stated total occurs. Calculated totals and inputs must remain nonnegative safe integers, except signed round-off. Negative payable, unsupported policy/currency/modes, invalid quantities/rates/denominators, non-finite/fractional/overflowing money, null financial values, duplicate IDs and excessive discounts fail closed. BigInt intermediates avoid precision loss before bound checks. Output contains only serializable integer numbers.

## Existing bills and purchase drafts

The existing `inclusive-paise-v1` utility delegates its decomposition to the same primitive, retaining its four-field DTO and exact historical rounding. Connected supply aggregates actual captured lot prices before calculation, as previously, and retains its issued document version, tax snapshot, totals and rupee projections. It does not round lots independently or rewrite stored invoices. Print templates continue to consume the original committed fields.

New or explicitly edited purchase drafts save a server-owned `calculation` snapshot, including policy, basis, tax mode, line results and totals. Base and discounts come from the source supplier bill. The exact acquisition amount is distributed over billed plus free units. Draft GST remains `unallocated`: current draft capture has no reviewed place-of-supply evidence and must not fabricate a local/interstate split. Entered GST remains unreviewed source evidence, including for an unregistered party, until posting validation is implemented. No calculated amount becomes a posted liability.

The UI displays the saved calculated base/GST/total and signed difference `stated − calculated`; it labels these as saved amounts while edits are in progress. Save and reopen refreshes the snapshot. The supplier's stated total is retained even when it differs. T13 must require reviewed tax evidence and explain/reconcile any difference before posting. There is no client-side financial calculator, automatic total substitution or client-supplied calculated snapshot. Existing draft allowlists reject injection of `calculation`.

Older drafts without a snapshot remain readable, and reads/replays do not recalculate or backfill them. An explicit revision-checked save captures the new policy. No historical invoices or draft records were migrated.

## Verification and activation

Level 4 verification covers synthetic sale, purchase and credit magnitudes; mixed rates; deterministic invoice discounts; full discounts/free goods; odd tax paise; exact rational costs; MRP; invalid/overflowing inputs; legacy rounding parity; actual document issue, consolidated billing and settlement consumers; draft persistence/replay and UI presentation. These fixtures are engineering evidence, not CA approval.

Before production activation, a qualified reviewer must approve the rounding fixtures, rates/effective dates, jurisdiction selection, discount treatment and source-document/return policy. T13 purchase posting, T14/T15 retail transactions and T19 source-bound credit notes must reuse this calculator and retain their policy/tax snapshots. Their transaction, authority and legal-evidence checks remain separate work. No live index, migration, deployment or real printer certification is included here.
