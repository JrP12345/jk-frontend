import type { OfflineLedgerAcknowledgement, StoredOfflineReceipt } from "./pharmacyOfflineLedger";

export type OfflineSyncState =
  | { status: "idle" | "syncing" | "offline" | "paused"; imported: number }
  | { status: "retry"; imported: number; retryAt: number }
  | { status: "review"; imported: number; commandId?: string; message: string };
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
}) {
  const now = options.now ?? Date.now, random = options.random ?? Math.random;
  let running: Promise<OfflineSyncState> | null = null, state: OfflineSyncState = { status: "idle", imported: 0 }, failures = 0, paused = false;
  let controller: AbortController | null = null;
  const update = (value: OfflineSyncState) => { state = value; options.onState?.(structuredClone(value)); return structuredClone(value); };
  const review = async (message: string, commandId?: string) => {
    try { await queue.suspendIssuance?.(); }
    catch { message += " The counter was locked because the review hold could not be stored. Recover this PC before billing."; }
    return update({ status: "review", imported: state.imported, commandId, message });
  };
  async function run(): Promise<OfflineSyncState> {
    if (paused) return update({ status: "paused", imported: state.imported });
    if (state.status === "review") return structuredClone(state);
    if (!options.online()) return update({ status: "offline", imported: state.imported });
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
    retryOriginal() { failures = 0; state = { status: "idle", imported: state.imported }; paused = false; },
  };
}
