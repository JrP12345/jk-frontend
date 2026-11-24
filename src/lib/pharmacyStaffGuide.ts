import type { PharmacyCapabilities } from "./pharmacyCapabilities";

export interface PharmacyGuideTask {
  id: string;
  title: string;
  tab?: string;
  action?: string;
  steps: string[];
  check: string;
}

/** Instructions follow the current branch capabilities; they grant no access. */
export function pharmacyStaffGuide(capabilities: PharmacyCapabilities): PharmacyGuideTask[] {
  const { actions, inventoryMode } = capabilities;
  const tracked = inventoryMode !== "billing_only";
  const prepareReturns = Boolean(actions.viewPurchases && actions.processReturn);
  const canStart = capabilities.enabled && capabilities.moduleEnabled && capabilities.commercialEntitlement !== "unavailable";
  const tasks: PharmacyGuideTask[] = [];
  if (actions.viewTill) tasks.push({
    id: "drawer", title: "Start with your own cash drawer", tab: "till", action: "Open Cash drawer",
    steps: ["Check the selected branch and your signed-in account. Use your own assigned drawer; do not share another cashier's login.", "Count the opening cash. If your role can open a drawer, enter the actual float; otherwise ask the authorized owner to open it before collecting cash."],
    check: "The active drawer belongs to you, at the correct branch, with the actual opening cash recorded.",
  });
  if (actions.sell && canStart) tasks.push({
    id: "counter", title: "Busy counter: five medicines and three loose tablets", tab: "counter", action: "Open Counter sale",
    steps: ["Scan a barcode or search the medicine name. Verify the exact strength, form and pack before adding it. Try the actual scanner with Enter; check for leading zeros and accidental repeated scans.",
      "Add five medicines. For the loose medicine, enter three loose base units; use the product's recorded box/strip/tablet conversion for packs. A missing conversion needs product review before use.",
      tracked ? "Check the selected batch, expiry and saleable quantity. A held, recalled or expired lot cannot be sold. Prescription medicines need the separate authorized prescription workflow; an uploaded file alone does not authorize supply." : "This branch does not track stock or batches. Verify the actual goods and expiry yourself. Prescription medicines need the separate authorized prescription workflow; an uploaded file alone does not authorize supply.",
      actions.collect ? "Review the total and actual cash, UPI, card or split payment. Confirm only money actually received; use named-customer credit only when authorized. Save once, then print the saved bill." : "Review the total and save through the permitted billing flow. Ask an authorized collector to record the actual payment; billing access does not grant collection access.",
      "If saving times out, keep the cart and original pending reference. Use Check outcome or the same-request retry shown by the counter. For a printer problem, reprint the saved invoice from Sales & collections; do not save another bill."],
    check: tracked ? "The bill contains all five correct products and exactly three loose units. The saved invoice and receipt agree, and stock falls by the actual base units sold." : "The bill contains all five correct products and exactly three loose units. The saved invoice and payment evidence agree; no stock balance is claimed.",
  });
  if (actions.viewPurchases) tasks.push({
    id: "purchase", title: "New distributor stock: review 50 medicines", tab: "purchases", action: "Open Purchases",
    steps: ["Choose the correct supplier and original invoice reference. Reuse a reviewed supplier CSV/XLSX mapping, or review extracted PDF/photo data when that provider is configured. Check every medicine match and unresolved row.",
      "Compare the invoice total, tax, discount, pack conversion and billed/free quantities. Review all 50 medicines before posting. Posting records the supplier bill; it does not confirm physical delivery.",
      tracked ? "At receiving, use the posted invoice's delivery template or enter the actual received lots. Check every batch, printed expiry, billed quantity and free quantity against the goods. Split deliveries must retain the original invoice allowances." : "This billing-only branch does not receive stock into a tracked balance. Ask the owner to review the branch's inventory mode before claiming a stock receipt.",
      "Only authorized purchase and receiving staff can commit their respective stages. If a result is uncertain, recover the existing command before entering the same invoice or goods again."],
    check: tracked ? "The supplier payable is posted once, and the actual received batches and billed/free base units enter stock once. Short deliveries remain outstanding." : "The supplier bill is recorded once. Do not describe this branch as tracking received batches or stock.",
  });
  if (tracked && (actions.viewStock || prepareReturns)) tasks.push({
    id: "expiry", title: "Expiry return: 20 strips across three suppliers", tab: prepareReturns ? "finance" : "alerts", action: prepareReturns ? "Open Finance & dues" : "Open Alerts",
    steps: ["Open the expiry window for next month and verify the relevant branch date. Select the original purchase-linked lots: eight, seven and five strips, using each product's actual pack factor.",
      prepareReturns ? "In Finance & dues, open Prepare expiry returns by supplier. Check original purchase and receipt lines, remaining source allowances, quarantine and earlier returns. Unlinked opening stock needs investigation; do not assign it to an arbitrary supplier." : "Ask an authorized purchase-return operator to prepare the supplier groups in Finance & dues. Your stock access lets you identify expiring goods; it does not grant return access. Unlinked opening stock needs investigation.",
      "Download each supplier's packing draft. An authorized operator reviews the source invoice return separately. A packing draft does not move goods, reduce dues or confirm a supplier credit.",
      "Keep physical dispatch, supplier acceptance, any short/rejected claim, posted credit and actual refund distinct. Recover the original return command if its result is uncertain."],
    check: "The drafts identify all 20 strips under the correct three suppliers. Only reviewed return transactions change stock, and only actual posted credits or refunds change financial balances.",
  });
  if (actions.sell) tasks.push({
    id: "outage", title: "Internet failure: recover safely",
    steps: ["If the connection fails during Save, first retain the original pending bill and check its outcome. Do not create a replacement bill or assume the payment failed.",
      tracked ? "Only a previously prepared and activated original PC can issue offline cash bills within its signed medicines, time and number limits. Unlock its existing counter and use its own ledger. An unprepared PC can keep drafts but cannot issue offline invoices." : "This billing-only branch cannot activate the prepared stock-tracked offline cash counter. Keep drafts and restore connectivity before final billing. Do not print a draft as an issued invoice.",
      "Keep issuing on that one designated PC only. Shared LAN offline billing across two counters is not available. Another counter must not issue against a copied key, copied ledger or another cashier's identity.",
      "After reconnecting, synchronize the original receipts in order, stop the local ledger and reconcile its stopped checkpoint before returning the branch to cloud billing. Expiry or closing a browser does not release the branch. If the PC or ledger is lost, preserve it and contact the designated support operator."],
    check: tracked ? "Prepared single-PC cash bills retain their original numbers, payment and stock effects exactly once. The branch stays held while any original receipt or stopped checkpoint is unresolved; shared LAN offline billing is unavailable." : "Keep drafts only during this billing-only branch's outage. Final billing requires connectivity and original pending results must be resolved first.",
  });
  if (actions.viewReports) tasks.push({
    id: "closing", title: "End of day: the owner's 10 PM check", tab: "daily", action: "Open Daily overview",
    steps: ["Select the correct branch and business day. Check freshness, incomplete offline work and unresolved payment or reconciliation messages before relying on totals.",
      "Read sales, cash collected, UPI collected, card/split collections, new credit sales and outstanding customer dues. A payment of an older debt is a collection today, not another sale today.",
      "Use gross contribution as an estimate based on recorded acquisition cost. Review unknown costs and returns. It is not net profit after rent, wages and other operating expenses.",
      tracked ? "Review low physical stock, sale restrictions, expiry and supplier dues. Physical stock can include units unavailable for sale; open the source stock report before reordering." : "This branch does not track stock. Review supplier and customer dues without claiming low-stock or batch completeness.",
      "Count the actual drawer cash and compare opening float, cash collections, cash movements and refunds. Record and explain differences through the cash drawer workflow; do not edit an old bill to force agreement."],
    check: "The owner can explain the day's sales, actual collections, gross contribution estimate, credit and stock coverage. Closing cash differences and incomplete sources remain visible.",
  });
  return tasks;
}

export const pharmacyGuideOpening = "Use a designated training branch for practice. Saving a bill, receiving goods, returning stock and recording money are real transactions. This guide does not certify training or pharmacy readiness.";
export const pharmacyGuideRecovery = "If a result is uncertain, keep its original reference and use the existing outcome/retry controls. Do not create a replacement transaction. Ask the owner for the agreed support contact; never send patient files or credentials through an unapproved channel.";
export function pharmacyStaffGuideText(capabilities: PharmacyCapabilities) {
  return ["EKAVYU PHARMACY — DAILY STAFF CHECKLIST", "Check your branch, your own account and drawer before starting. Open the in-app staff guide for each task's full steps.", ...pharmacyStaffGuide(capabilities).map(task => `${task.title}\n${task.check}`), "Printer/scanner: test the actual device before the rush. Reprint a saved invoice after a print failure; never save a replacement bill.", pharmacyGuideRecovery].join("\n\n");
}
