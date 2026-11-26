"use client";

import { useState } from "react";
import { Alert, Button, Card, Tabs } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { usePharmacyFinanceCommand } from "@/hooks/usePharmacyFinanceCommand";
import { PharmacySupplierFinance } from "./PharmacySupplierFinance";
import { PharmacyCustomerFinance } from "./PharmacyCustomerFinance";
import { PharmacyOpeningBalances } from "./PharmacyOpeningBalances";
import { PharmacyCollections } from "./PharmacyCollections";
import { money } from "./pharmacyWorkspace";

export interface PharmacyFinanceProps {
  locationId: string;
  canViewSuppliers: boolean;
  canViewCustomers: boolean;
  canSettle: boolean;
  canReturn: boolean;
  canCollect: boolean;
  canViewSales: boolean;
  canOpening: boolean;
  initialReturn?: { purchaseId: string; batchId: string };
}

export type FinanceCommand = ReturnType<typeof usePharmacyFinanceCommand>;

const modeFor = (kind: string) =>
  kind === "opening_balance" ? "opening" : kind === "customer_refund" ? "customer" : "supplier";

const titles = {
  supplier_return: "Supplier return recorded",
  supplier_credit: "Supplier credit recorded",
  supplier_payment: "Supplier payment recorded",
  supplier_refund: "Supplier refund received",
  customer_refund: "Customer refund recorded",
  opening_balance: "Opening balance recorded",
};

export function PharmacyFinance(props: PharmacyFinanceProps) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <FinanceSession key={`${scope}:${props.locationId}`} {...props} />;
}

function FinanceSession(props: PharmacyFinanceProps) {
  const command = usePharmacyFinanceCommand(props.locationId);
  const [mode, setMode] = useState(() =>
    command.pending
      ? modeFor(command.pending.kind)
      : props.canViewSuppliers
        ? "supplier"
        : props.canViewCustomers
          ? "customer"
          : "opening"
  );
  const [resume, setResume] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const locked = command.busy || command.submitted || Boolean(command.result);

  const allowed = (kind: string) =>
    kind === "opening_balance"
      ? props.canOpening
      : kind === "supplier_return"
        ? props.canReturn && props.canViewSuppliers
        : props.canSettle && (kind === "customer_refund" || props.canViewSuppliers);

  function acknowledge() {
    if (command.acknowledge()) setRefresh(value => value + 1);
  }

  const after = command.result?.data.after as { refundPayablePaise?: number } | undefined;

  return (
    <section className="min-w-0 space-y-3" aria-label="Pharmacy finance and dues">
      {(command.error || command.pending) && (
        <div className="space-y-2.5">
          {command.error && (
            <Alert variant="error" title="Financial outcome needs attention">
              {command.error}
            </Alert>
          )}
          {command.pending && (
            <Alert
              variant={command.result ? "success" : "warning"}
              title={command.result ? titles[command.result.kind] : "Pending financial command"}
            >
              <div className="space-y-2 text-xs">
                <p className="break-all font-mono text-[11px]">Reference {command.pending.key}</p>
                {command.result ? (
                  <>
                    <p className="font-medium text-text">
                      {command.result.label} · {money(command.result.amountPaise / 100)}
                    </p>
                    {command.result.kind === "supplier_return" ? (
                      <p>This is expected supplier credit. Confirm actual credit-note evidence separately.</p>
                    ) : command.result.kind === "opening_balance" ? (
                      <p>Reviewed source due. No current sale, tax or stock effect was recorded.</p>
                    ) : (
                      <p>
                        Actual reference {String(command.result.data.referenceNumber)}. Recorded{" "}
                        {new Date(String(command.result.data.recordedAt)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (IST).
                      </p>
                    )}
                    {after && Number.isSafeInteger(after.refundPayablePaise) && (
                      <p>Refund payable after this payout {money(after.refundPayablePaise! / 100)}</p>
                    )}
                    <div>
                      <Button size="xs" disabled={command.busy} onClick={acknowledge}>
                        Done with financial command
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Check the original result before another command. Reload retains this reference.</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="xs"
                        disabled={command.busy}
                        onClick={() => {
                          void command.recover();
                        }}
                      >
                        Check financial result
                      </Button>
                      {command.submitted && (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={command.busy || !allowed(command.pending!.kind)}
                          onClick={() => {
                            if (allowed(command.pending!.kind)) void command.retry();
                          }}
                        >
                          Retry same financial command
                        </Button>
                      )}
                      {(!command.submitted || command.canReview) && (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={command.busy}
                          onClick={() => {
                            command.review();
                            setMode(modeFor(command.pending!.kind));
                            setResume(value => value + 1);
                          }}
                        >
                          Load original financial source
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Alert>
          )}
        </div>
      )}

      {command.result?.invoiceId && props.canViewSales && (
        <PharmacyCollections locationId={props.locationId} canCollect={props.canCollect} initialInvoiceId={command.result.invoiceId} />
      )}

      <Card padding="none" className="rounded-xl shadow-none" contentClassName="gap-0">
        <header className="border-b border-border/70 px-3 py-3 md:px-4">
          <h2 className="text-sm font-semibold text-text md:text-base">Finance &amp; dues</h2>
          <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
            Source balances, supplier credits and confirmed money movements. Incoming customer collections remain in the saved document receipt ledger.
          </p>
        </header>

        <Tabs
          variant="underline"
          scrollActiveIntoView={false}
          activeTab={mode}
          onChange={setMode}
          tabs={[
            {
              id: "supplier",
              label: "Suppliers",
              disabled: Boolean(command.pending),
              content: (
                <div className="p-3 md:p-4">
                  {props.canViewSuppliers ? (
                    <PharmacySupplierFinance
                      key={refresh}
                      locationId={props.locationId}
                      command={command}
                      canSettle={props.canSettle}
                      canReturn={props.canReturn}
                      initialReturn={props.initialReturn}
                      locked={locked}
                      resume={resume}
                    />
                  ) : (
                    <p className="rounded-xl border border-border/70 bg-surface-alt/40 p-3 text-xs text-text-secondary">
                      Supplier statement permission is required to load this financial source.
                    </p>
                  )}
                </div>
              ),
            },
            {
              id: "customer",
              label: "Customer dues & refunds",
              disabled: Boolean(command.pending),
              content: (
                <div className="p-3 md:p-4">
                  {props.canViewCustomers ? (
                    <PharmacyCustomerFinance
                      key={refresh}
                      locationId={props.locationId}
                      command={command}
                      canSettle={props.canSettle}
                      canCollect={props.canCollect}
                      canViewSales={props.canViewSales}
                      locked={locked}
                      resume={resume}
                    />
                  ) : (
                    <p className="rounded-xl border border-border/70 bg-surface-alt/40 p-3 text-xs text-text-secondary">
                      Customer statement permission is required to load this financial source.
                    </p>
                  )}
                </div>
              ),
            },
            {
              id: "opening",
              label: "Reviewed opening dues",
              disabled: Boolean(command.pending),
              content: (
                <div className="p-3 md:p-4">
                  {props.canOpening ? (
                    <PharmacyOpeningBalances
                      key={refresh}
                      locationId={props.locationId}
                      command={command}
                      locked={locked}
                      resume={resume}
                    />
                  ) : (
                    <p className="rounded-xl border border-border/70 bg-surface-alt/40 p-3 text-xs text-text-secondary">
                      Organization management is required for new opening dues. Existing source outcomes can still be checked above.
                    </p>
                  )}
                </div>
              ),
            },
          ].filter(tab =>
            tab.id === "supplier"
              ? props.canViewSuppliers || mode === "supplier"
              : tab.id === "customer"
                ? props.canViewCustomers || mode === "customer"
                : props.canOpening || mode === "opening"
          )}
        />
      </Card>
    </section>
  );
}
