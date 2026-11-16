// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createPharmacyOfflineSync } from "@/lib/pharmacyOfflineSync";
import type { StoredOfflineReceipt } from "@/lib/pharmacyOfflineLedger";
afterEach(() => vi.useRealTimers());

function fixture(count = 2) {
  const pending = Array.from({ length: count }, (_, index) => ({ receipt: { version: 2, authorityId: "original-authority", commandId: `original-command-${index}`, sequence: index + 1, invoice: { invoiceNumber: `ORIGINAL/${index + 1}` } }, digest: String(index).repeat(64), deviceSignature: "A".repeat(86) })) as StoredOfflineReceipt[];
  const acknowledge = vi.fn(async () => { pending.shift(); });
  const queue = { pending: vi.fn(async () => pending.slice(0, 1)), acknowledge };
  const ack = (original: StoredOfflineReceipt) => ({ commandId: original.receipt.commandId, sequence: original.receipt.sequence, authorityId: original.receipt.authorityId,
    digest: original.digest, invoiceNumber: original.receipt.invoice.invoiceNumber, serverInvoiceId: "a".repeat(24) });
  return { pending, queue, ack };
}
it("imports sequentially, acknowledges exact evidence and coalesces concurrent flush calls", async () => {
  const f = fixture(), sent: number[] = [];
  const send = vi.fn(async (original: StoredOfflineReceipt) => { sent.push(original.receipt.sequence); return f.ack(original); });
  const sync = createPharmacyOfflineSync(f.queue, send, { online: () => true });
  const first = sync.flush(); expect(sync.flush()).toBe(first);
  expect(await first).toEqual({ status: "idle", imported: 2 }); expect(sent).toEqual([1, 2]); expect(f.pending).toHaveLength(0);
});
it("keeps the original receipt on response loss and waits through bounded backoff", async () => {
  const f = fixture(1), original = structuredClone(f.pending[0]); let time = 1000;
  const send = vi.fn().mockRejectedValueOnce(new Error("Connection lost after server commit")).mockImplementation(async (value: StoredOfflineReceipt) => f.ack(value));
  const sync = createPharmacyOfflineSync(f.queue, send, { online: () => true, now: () => time, random: () => 0.5 });
  expect(await sync.flush()).toEqual({ status: "retry", imported: 0, retryAt: 2000 }); expect(f.pending[0]).toEqual(original);
  await sync.flush(); expect(send).toHaveBeenCalledTimes(1); time = 2000;
  expect(await sync.flush()).toEqual({ status: "idle", imported: 1 }); expect(send.mock.calls[1][0]).toEqual(original);
});
it.each(["digest", "invoiceNumber", "authorityId", "sequence", "serverInvoiceId"])("retains evidence and stops the queue on mismatched %s", async field => {
  const f = fixture(), send = vi.fn(async (original: StoredOfflineReceipt) => ({ ...f.ack(original), [field]: "changed" }));
  const sync = createPharmacyOfflineSync(f.queue, send, { online: () => true });
  expect((await sync.flush()).status).toBe("review"); await sync.flush(); expect(send).toHaveBeenCalledTimes(1); expect(f.queue.acknowledge).not.toHaveBeenCalled(); expect(f.pending).toHaveLength(2);
});
it("treats stock/document conflicts as review and authentication loss as retry without skipping a receipt", async () => {
  const f = fixture(), send = vi.fn().mockRejectedValueOnce({ response: { status: 401 } }).mockRejectedValueOnce({ response: { status: 409 } });
  const sync = createPharmacyOfflineSync(f.queue, send, { online: () => true });
  expect((await sync.flush()).status).toBe("retry"); sync.retryOriginal(); expect((await sync.flush()).status).toBe("review"); expect(f.pending).toHaveLength(2);
});
it("persists the issuance hold before reporting financial review and never discards the original receipt", async () => {
  const f = fixture(1), suspendIssuance = vi.fn(async () => {}), onState = vi.fn();
  const sync = createPharmacyOfflineSync({ ...f.queue, suspendIssuance }, vi.fn().mockRejectedValue({ response: { status: 409 } }), { online: () => true, onState });
  expect((await sync.flush()).status).toBe("review"); expect(suspendIssuance).toHaveBeenCalledOnce();
  expect(suspendIssuance.mock.invocationCallOrder[0]).toBeLessThan(onState.mock.invocationCallOrder.at(-1)!); expect(f.pending).toHaveLength(1);
});

it("does not send while offline and yields after ten imported bills", async () => {
  const f = fixture(12); let online = false;
  const send = vi.fn(async (original: StoredOfflineReceipt) => f.ack(original));
  const sync = createPharmacyOfflineSync(f.queue, send, { online: () => online });
  expect((await sync.flush()).status).toBe("offline"); expect(send).not.toHaveBeenCalled(); online = true;
  expect(await sync.flush()).toEqual({ status: "idle", imported: 10 }); expect(f.pending).toHaveLength(2);
  expect(await sync.flush()).toEqual({ status: "idle", imported: 12 });
});
it("retains evidence after local acknowledgement failure so the same command can recover", async () => {
  const f = fixture(1); f.queue.acknowledge.mockRejectedValueOnce(new Error("Storage unavailable"));
  const send = vi.fn(async (original: StoredOfflineReceipt) => f.ack(original));
  const sync = createPharmacyOfflineSync(f.queue, send, { online: () => true });
  expect((await sync.flush()).status).toBe("review"); expect(f.pending).toHaveLength(1); sync.retryOriginal();
  expect((await sync.flush()).imported).toBe(1); expect(send.mock.calls[0][0]).toEqual(send.mock.calls[1][0]);
});
it("aborts a hung upload at twenty seconds and retries the exact original receipt after backoff", async () => {
  vi.useFakeTimers(); vi.setSystemTime(1000);
  const f = fixture(1), original = structuredClone(f.pending[0]); let aborted = false;
  const send = vi.fn().mockImplementationOnce((_value, signal: AbortSignal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new DOMException("Timeout", "AbortError")); }, { once: true });
  })).mockImplementation(async (value: StoredOfflineReceipt) => f.ack(value));
  const sync = createPharmacyOfflineSync(f.queue, send, { online: () => true, random: () => 0.5 });
  const upload = sync.flush(); await vi.advanceTimersByTimeAsync(19999); expect(aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1); expect(await upload).toEqual({ status: "retry", imported: 0, retryAt: 22000 }); expect(aborted).toBe(true); expect(f.pending).toEqual([original]);
  await sync.flush(); expect(send).toHaveBeenCalledOnce(); await vi.advanceTimersByTimeAsync(1000);
  expect(await sync.flush()).toEqual({ status: "idle", imported: 1 }); expect(send.mock.calls[1][0]).toEqual(original);
});
it("pauses an in-flight request without acknowledging it and resumes its original command", async () => {
  const f = fixture(1), original = structuredClone(f.pending[0]); let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const send = vi.fn().mockImplementationOnce((_value, signal: AbortSignal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Paused", "AbortError")), { once: true }); started();
  })).mockImplementation(async (value: StoredOfflineReceipt) => f.ack(value));
  const sync = createPharmacyOfflineSync(f.queue, send, { online: () => true });
  const upload = sync.flush(); await ready; sync.pause(); expect(await upload).toEqual({ status: "paused", imported: 0 });
  expect(f.queue.acknowledge).not.toHaveBeenCalled(); expect(f.pending).toEqual([original]);
  sync.resume(); expect(await sync.flush()).toEqual({ status: "idle", imported: 1 }); expect(send.mock.calls[1][0]).toEqual(original);
});
