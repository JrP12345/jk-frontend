"use client";
import { useState } from "react";
import { Alert, Button, Tabs } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { usePharmacyFinanceCommand } from "@/hooks/usePharmacyFinanceCommand";
import { PharmacySupplierFinance } from "./PharmacySupplierFinance";
import { PharmacyCustomerFinance } from "./PharmacyCustomerFinance";
import { PharmacyOpeningBalances } from "./PharmacyOpeningBalances";
import { PharmacyCollections } from "./PharmacyCollections";
import { money } from "./pharmacyWorkspace";
import styles from "./PharmacyWorkspace.module.css";
export interface PharmacyFinanceProps { locationId: string; canViewSuppliers: boolean; canViewCustomers: boolean; canSettle: boolean; canReturn: boolean; canCollect: boolean; canViewSales: boolean; canOpening: boolean }
export type FinanceCommand = ReturnType<typeof usePharmacyFinanceCommand>;
const modeFor = (kind: string) => kind === "opening_balance" ? "opening" : kind === "customer_refund" ? "customer" : "supplier";
const titles = { supplier_return: "Supplier return recorded", supplier_credit: "Supplier credit recorded", supplier_payment: "Supplier payment recorded", supplier_refund: "Supplier refund received", customer_refund: "Customer refund recorded", opening_balance: "Opening balance recorded" };
export function PharmacyFinance(props: PharmacyFinanceProps) {
  const scope = authScopeKey(useAuthStore(state => state.user)); return <FinanceSession key={`${scope}:${props.locationId}`} {...props} />;
}
function FinanceSession(props: PharmacyFinanceProps) {
  const command = usePharmacyFinanceCommand(props.locationId), [mode, setMode] = useState(() => command.pending ? modeFor(command.pending.kind) : props.canViewSuppliers ? "supplier" : props.canViewCustomers ? "customer" : "opening"), [resume, setResume] = useState(0), [refresh, setRefresh] = useState(0);
  const locked = command.busy || command.submitted || Boolean(command.result);
  const allowed = (kind: string) => kind === "opening_balance" ? props.canOpening : kind === "supplier_return" ? props.canReturn && props.canViewSuppliers : props.canSettle && (kind === "customer_refund" || props.canViewSuppliers);
  function acknowledge() { if (command.acknowledge()) setRefresh(value => value + 1); }
  const after = command.result?.data.after as { refundPayablePaise?: number } | undefined;
  return <section className={styles.list} aria-label="Pharmacy finance and dues"><header><h2>Finance & dues</h2><p>Source balances, supplier credits and confirmed money movements. Incoming customer collections remain in the saved document receipt ledger.</p></header>
    {command.error && <Alert variant="error" title="Financial outcome needs attention">{command.error}</Alert>}
    {command.pending && <Alert variant={command.result ? "success" : "warning"} title={command.result ? titles[command.result.kind] : "Pending financial command"}><p>Reference {command.pending.key}</p>{command.result ? <>
      <p>{command.result.label} · {money(command.result.amountPaise / 100)}</p>{command.result.kind === "supplier_return" ? <p>This is expected supplier credit. Confirm actual credit-note evidence separately.</p> : command.result.kind === "opening_balance" ? <p>Reviewed source due. No current sale, tax or stock effect was recorded.</p> : <p>Actual reference {String(command.result.data.referenceNumber)}. Recorded {new Date(String(command.result.data.recordedAt)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST).</p>}
      {after && Number.isSafeInteger(after.refundPayablePaise) && <p>Refund payable after this payout {money(after.refundPayablePaise! / 100)}</p>}<Button size="sm" disabled={command.busy} onClick={acknowledge}>Done with financial command</Button>
    </> : <><p>Check the original result before another command. Reload retains this reference.</p><Button size="sm" disabled={command.busy} onClick={() => { void command.recover(); }}>Check financial result</Button>{command.submitted && <Button size="sm" disabled={command.busy || !allowed(command.pending!.kind)} onClick={() => { if (allowed(command.pending!.kind)) void command.retry(); }}>Retry same financial command</Button>}{(!command.submitted || command.canReview) && <Button size="sm" variant="outline" disabled={command.busy} onClick={() => { command.review(); setMode(modeFor(command.pending!.kind)); setResume(value => value + 1); }}>Load original financial source</Button>}</>}</Alert>}
    {command.result?.invoiceId && props.canViewSales && <PharmacyCollections locationId={props.locationId} canCollect={props.canCollect} initialInvoiceId={command.result.invoiceId} />}
    <Tabs activeTab={mode} onChange={setMode} tabs={[
      { id: "supplier", label: "Suppliers", disabled: Boolean(command.pending), content: props.canViewSuppliers ? <PharmacySupplierFinance key={refresh} locationId={props.locationId} command={command} canSettle={props.canSettle} canReturn={props.canReturn} locked={locked} resume={resume} /> : <p>Supplier statement permission is required to load this financial source.</p> },
      { id: "customer", label: "Customer dues & refunds", disabled: Boolean(command.pending), content: props.canViewCustomers ? <PharmacyCustomerFinance key={refresh} locationId={props.locationId} command={command} canSettle={props.canSettle} canCollect={props.canCollect} canViewSales={props.canViewSales} locked={locked} resume={resume} /> : <p>Customer statement permission is required to load this financial source.</p> },
      { id: "opening", label: "Reviewed opening dues", disabled: Boolean(command.pending), content: props.canOpening ? <PharmacyOpeningBalances key={refresh} locationId={props.locationId} command={command} locked={locked} resume={resume} /> : <p>Organization management is required for new opening dues. Existing source outcomes can still be checked above.</p> },
    ].filter(tab => tab.id === "supplier" ? props.canViewSuppliers || mode === "supplier" : tab.id === "customer" ? props.canViewCustomers || mode === "customer" : props.canOpening || mode === "opening")} />
  </section>;
}
