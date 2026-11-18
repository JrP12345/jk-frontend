import type { OfflineLedgerAcknowledgement, StoredOfflineReceipt } from "./pharmacyOfflineLedger";

export type OfflineSyncState = (
  | { status: "idle" | "syncing" | "offline" | "paused"; imported: number }
  | { status: "retry"; imported: number; retryAt: number }
  | { status: "review"; imported: number; commandId?: string; message: string }) & {
    issuanceStopped?: boolean; controlsCheckedAt?: string; controlsUpdatedAt?: string | null;
  };
export interface OfflineIssuanceCheck { continueIssuance: boolean; checkedAt: string; controlsUpdatedAt: string | null }
interface LedgerQueue {
  pending(limit: number): Promise<StoredOfflineReceipt[]>;
  acknowledge(value: OfflineLedgerAcknowledgement): Promise<void>;
  suspendIssuance?(): Promise<void>;
}
type Ack = OfflineLedgerAcknowledgement & { authorityId: string; sequence: number };
/** Small, sequential imports stay off the Save path. The authenticated API
 * adapter owns credentials; neither a timeout nor an uncertain response removes
 * local evidence. Reconnect repeats the very same device-signed command.
 */
export function createPharmacyOfflineSync(queue: LedgerQueue, send: (value: StoredOfflineReceipt, signal: AbortSignal) => Promise<unknown>, options: {
  online: () => boolean; now?: () => number; random?: () => number; onState?: (state: OfflineSyncState) => void;
  checkIssuance?: (signal: AbortSignal) => Promise<OfflineIssuanceCheck>;
}) {
  const now = options.now ?? Date.now, random = options.random ?? Math.random;
  let running: Promise<OfflineSyncState> | null = null, state: OfflineSyncState = { status: "idle", imported: 0 }, failures = 0, paused = false;
  let controller: AbortController | null = null;
  let lastSafetyAttempt = -Infinity;
  const update = (value: OfflineSyncState) => {
    state = { ...(state.issuanceStopped ? { issuanceStopped: true } : {}),
      ...(state.controlsCheckedAt ? { controlsCheckedAt: state.controlsCheckedAt, controlsUpdatedAt: state.controlsUpdatedAt } : {}), ...value };
    options.onState?.(structuredClone(state)); return structuredClone(state);
  };
  async function checkSafety() {
    const elapsed = now() - lastSafetyAttempt;
    if (!options.checkIssuance || state.issuanceStopped || elapsed >= 0 && elapsed < 30000) return;
    lastSafetyAttempt = now();
    const attempt = new AbortController(); controller = attempt;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([options.checkIssuance(attempt.signal), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { attempt.abort(); reject(new Error("Safety check timed out")); }, 8000);
      })]);
      if (paused) return;
      const valid = result && typeof result.continueIssuance === "boolean" && Number.isFinite(Date.parse(result.checkedAt)) &&
        (result.controlsUpdatedAt === null || Number.isFinite(Date.parse(result.controlsUpdatedAt)));
      if (valid) update({ ...state, controlsCheckedAt: result.checkedAt, controlsUpdatedAt: result.controlsUpdatedAt });
      if (!valid || !result.continueIssuance) {
        update({ ...state, issuanceStopped: true });
        // Stop only NEW issuance. Original receipts must still reconcile, including
        // legitimate bills issued before a later hold; never discard that evidence.
        await queue.suspendIssuance?.();
      }
    } catch {
      // No connection/authentication is not a fresh safety confirmation. Retain
      // the last successful check and the bounded original offline authority.
    } finally { clearTimeout(timer); if (controller === attempt) controller = null; }
  }
  const review = async (message: string, commandId?: string) => {
    try { await queue.suspendIssuance?.(); }
    catch { message += " The counter was locked because the review hold could not be stored. Recover this PC before billing."; }
    return update({ status: "review", imported: state.imported, commandId, message });
  };
  async function run(): Promise<OfflineSyncState> {
    if (paused) return update({ status: "paused", imported: state.imported });
    if (state.status === "review") return structuredClone(state);
    if (!options.online()) return update({ status: "offline", imported: state.imported });
    await checkSafety();
    if (paused) return update({ status: "paused", imported: state.imported });
    if (state.status === "retry" && state.retryAt > now()) return structuredClone(state);
    let imported = state.imported;
    // Yield to UI/network scheduling after ten bills, even with a large backlog.
    for (let count = 0; count < 10; count++) {
      if (paused) return update({ status: "paused", imported });
      if (!options.online()) return update({ status: "offline", imported });
      let pending: StoredOfflineReceipt[];
      try { pending = await queue.pending(1); }
      catch { return review("Unlock or recover the original ledger before synchronization."); }
      if (!pending.length) { failures = 0; return update({ status: "idle", imported }); }
      const original = pending[0], receipt = original.receipt;
      if (receipt.version !== 2 || !receipt.authorityId || !original.deviceSignature) return review("This record has no original activated PC signature. Retain it for recovery.", receipt.commandId);
      update({ status: "syncing", imported });
      controller = new AbortController();
      const attempt = controller, timeout = setTimeout(() => attempt.abort(), 20000);
      let response: unknown;
      try { response = await send(structuredClone(original), attempt.signal); }
      catch (failure) {
        if (paused) return update({ status: "paused", imported });
        const status = Number((failure as { response?: { status?: number }; status?: number })?.response?.status ?? (failure as { status?: number })?.status);
        if (status >= 400 && status < 500 && ![401, 408, 425, 429].includes(status)) return review("The server needs review of this original receipt. Its number, payment and stock evidence have been retained.", receipt.commandId);
        failures++;
        return update({ status: "retry", imported, retryAt: now() + Math.round(Math.min(60000, 1000 * 2 ** Math.min(failures - 1, 6)) * (0.8 + random() * 0.4)) });
      } finally { clearTimeout(timeout); if (controller === attempt) controller = null; }
      const ack = response as Ack;
      if (!ack || ack.commandId !== receipt.commandId || ack.digest !== original.digest || ack.invoiceNumber !== receipt.invoice.invoiceNumber ||
          ack.authorityId !== receipt.authorityId || ack.sequence !== receipt.sequence || !/^[a-f0-9]{24}$/.test(ack.serverInvoiceId)) return review("Server acknowledgement differs from the original bill. Keep it pending for review.", receipt.commandId);
      try {
        await queue.acknowledge({ commandId: ack.commandId, digest: ack.digest, invoiceNumber: ack.invoiceNumber, serverInvoiceId: ack.serverInvoiceId });
      } catch { return review("The server saved this bill but the local acknowledgement needs recovery. Retry its original reference.", receipt.commandId); }
      imported++; failures = 0;
    }
    return update({ status: "idle", imported });
  }
  return {
    state: () => structuredClone(state),
    flush() {
      if (!running) running = run().finally(() => { running = null; });
      return running;
    },
    pause() { paused = true; controller?.abort(); },
    resume() { paused = false; },
    /** An explicit operator action can retry a reviewed command; nothing is
     * discarded, renumbered or marked paid merely because this is called.
     */
    retryOriginal() { failures = 0; update({ status: "idle", imported: state.imported }); paused = false; },
  };
}
