import api from "./api";
import { organizationPath } from "@/services/organization.service";
import { activeDrawer } from "./pharmacyTill";
import { browserDevice, readOfflineDevice, readOriginalOfflineDevice, type DeviceScope, type BrowserDevice } from "./pharmacyOfflineDevice";
import { createPharmacyOfflineLedger, type OfflineCartIntent, type StoredOfflineReceipt } from "./pharmacyOfflineLedger";
import { offlineTrustedSigningKey, verifyOfflinePreparation } from "./pharmacyOfflinePreparation";
import { readOfflineSession, saveOfflineSession, type OfflineSessionControl } from "./pharmacyOfflineSession";
import { createPharmacyOfflineSync, type OfflineSyncState } from "./pharmacyOfflineSync";
import { offlineEvidenceCanonical } from "./generated/pharmacyOfflineDocument";
import { installPharmacyOfflineAssets } from "./pharmacyOfflineAssets";
import { openPharmacyOfflineRecovery } from "./pharmacyOfflineBackup";

const root = (scope: DeviceScope) => organizationPath(`/pharmacy/locations/${encodeURIComponent(scope.locationId)}/offline-authority`, scope.organizationId);
const post = async (scope: DeviceScope, action: string, body: unknown, signal?: AbortSignal) => (await api.post(`${root(scope)}/${action}`, body, { signal })).data?.data;
const get = async (scope: DeviceScope, path: string, signal?: AbortSignal) => (await api.get(`${root(scope)}/${path}`, { signal })).data?.data;
const sign = async (device: BrowserDevice, message: string) => {
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, device.privateKey, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const signalChange = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pharmacy-offline-session"));
  if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("ekavyu-pharmacy-offline-session"); channel.postMessage("changed"); channel.close(); }
};
async function ownDevice(control: OfflineSessionControl, actorId: string) {
  const device = await browserDevice(control);
  if (!device || device.deviceId !== control.deviceId || control.actorId !== actorId) throw new Error("Use the original prepared PC, browser profile and operator.");
  return device;
}
async function update(control: OfflineSessionControl, values: Partial<OfflineSessionControl>) {
  const next = await saveOfflineSession({ ...control, ...values }, control.revision); signalChange(); return next;
}

/** Persist an exact signed request before reserving anything server-side. Every
 * interrupted stage resumes its original authority/reference, never a new range.
 */
export async function startOfflineCheckout(scope: DeviceScope, actorId: string, reviewReference: string, count: number) {
  if (!navigator.storage?.persist || !await navigator.storage.persist()) throw new Error("Persistent browser storage is required for final offline billing. Install Ekavyu on this PC or allow persistent site storage, then retry. Online billing remains available.");
  await installPharmacyOfflineAssets();
  const prior = await readOfflineSession(scope);
  if (prior && prior.phase !== "closed") throw new Error("Recover the existing offline session before preparing another.");
  if (reviewReference.trim().length < 3 || !Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error("Enter a review reference and 1–1000 invoice numbers.");
  const { status, evidence } = await readOfflineDevice(scope), device = await browserDevice(scope), drawer = await activeDrawer(scope.locationId);
  if (!device || !status.device || status.device.deviceId !== device.deviceId || status.device.status !== "enrolled" || !drawer || drawer.cashierId !== actorId) throw new Error("Enroll this browser and open the original operator's cash drawer before preparing offline billing.");
  const ownership = (await api.get(root(scope))).data?.data;
  if (!ownership || typeof ownership.hasHistory !== "boolean" || ownership.owned !== false) throw new Error("Recover the original branch ownership before reserving another offline session.");
  const fresh = Boolean(prior || ownership.hasHistory || !evidence || Date.now() >= Date.parse(evidence.lease.validUntil));
  const fields = { authorityId: crypto.randomUUID(), deviceId: device.deviceId, expectedDeviceRevision: status.device.revision, drawerId: drawer.id, expectedDrawerRevision: drawer.revision,
    reviewReference: reviewReference.trim(), confirmed: true, requestedAt: new Date().toISOString(),
    ...(fresh ? { nextAllocation: { count, expectedNumberingRevision: status.numberingRevision, expectedFinancialYear: status.financialYear } } : {}) };
  const owner = { organizationId: scope.organizationId, locationId: scope.locationId, actorId };
  const claim = { ...fields, proof: await sign(device, `ekavyu.pharmacy.stock-drawer-claim.v1\n${JSON.stringify(owner)}\n${JSON.stringify(fields)}`) };
  const control = await saveOfflineSession({ version: 1, ...scope, actorId, deviceId: device.deviceId, authorityId: fields.authorityId, phase: "claiming", claim, signingKey: status.signingKey }, prior?.revision ?? null);
  signalChange(); return control;
}

export async function prepareOfflineCheckout(control: OfflineSessionControl, actorId: string, passphrase: string, signal?: AbortSignal) {
  if (control.cancellation) throw new Error("Recover the original cancellation before preparing another offline session.");
  const device = await ownDevice(control, actorId), signer = await offlineTrustedSigningKey(control.signingKey);
  let current = control;
  if (current.phase === "claiming") {
    const result = await post(control, "acquire", current.claim, signal);
    if (result?.authorityId !== control.authorityId || result.state !== "held") throw new Error("Original ownership could not be confirmed. Retry this setup reference.");
    current = await update(current, { phase: "owned" });
  }
  const ledger = await createPharmacyOfflineLedger(control, control.authorityId);
  try {
    // A saved preparation is recovered first, including after a lost local
    // completion callback. Never overwrite stock or reset the local sequence.
    let existing = null;
    if (await ledger.exists()) { await ledger.unlock(passphrase); existing = await ledger.preparation(); }
    if (!existing) {
      const manifest = await post(control, "prepare", { authorityId: control.authorityId }, signal);
      const deviceStatus = await readOfflineDevice(control, signal), enrollmentId = deviceStatus.status.device?.enrollmentId;
      if (!enrollmentId || deviceStatus.status.device?.deviceId !== device.deviceId) throw new Error("Original PC enrollment changed during preparation.");
      const prepared = await verifyOfflinePreparation(manifest, { organizationId: control.organizationId, locationId: control.locationId, deviceId: control.deviceId,
        actorId, authorityId: control.authorityId, enrollmentId }, signer, page => get(control, `${control.authorityId}/snapshot/${page}`, signal), { signal });
      const storage = await navigator.storage?.estimate?.(), required = new TextEncoder().encode(JSON.stringify(prepared)).length * 3 + 16 * 1024 * 1024;
      if (storage?.quota !== undefined && storage.usage !== undefined && storage.quota - storage.usage < required) throw new Error("This PC needs more free browser storage before activating offline billing. Keep or cancel this preparation and free space first.");
      await ledger.initialize({ prepared, devicePublicKey: device.publicKey, lease: prepared.lease, lots: prepared.lots, calculationEngineSha256: prepared.calculationEngineSha256 }, passphrase);
      existing = prepared;
    }
    if (current.phase === "owned") current = await update(current, { phase: "prepared" });
    await installPharmacyOfflineAssets(signal);
    if (!current.activation) {
      const owner = { organizationId: control.organizationId, locationId: control.locationId, actorId };
      const fields = { authorityId: control.authorityId, expectedRevision: 1, manifestDigest: existing.manifestDigest,
        reviewReference: String(current.claim.reviewReference), requestedAt: new Date().toISOString(), confirmed: true };
      const activation = { ...fields, proof: await sign(device, `ekavyu.pharmacy.checkout-activation.v1\n${JSON.stringify(owner)}\n${JSON.stringify(fields)}`) };
      current = await update(current, { activation });
    }
    let grant: unknown;
    try { grant = await get(control, `${control.authorityId}/grant`, signal); }
    catch (failure) { if ((failure as { response?: { status?: number } }).response?.status !== 404) throw failure; grant = await post(control, "activate", current.activation, signal); }
    await ledger.activate(grant, signer);
    return await update(current, { phase: "active" });
  } finally { ledger.close(); }
}

export async function cancelOfflinePreparation(control: OfflineSessionControl, actorId: string, reviewReference: string) {
  const device = await ownDevice(control, actorId); let current = control;
  if (!current.cancellation) {
    const result = (await api.get(root(control))).data?.data;
    if (!result || result.owned && result.authority?.authorityId !== control.authorityId) throw new Error("Original branch ownership differs. Retain this setup reference.");
    const fields = { authorityId: control.authorityId, expectedRevision: result.authority?.revision ?? 0, reviewReference: reviewReference.trim(), confirmed: true };
    const owner = { organizationId: control.organizationId, locationId: control.locationId, actorId };
    const cancellation = { ...fields, proof: await sign(device, `ekavyu.pharmacy.unused-ownership-release.v1\n${JSON.stringify(owner)}\n${JSON.stringify(fields)}`) };
    current = await update(current, { cancellation });
  }
  const cancelled = await post(control, "cancel", current.cancellation);
  if (cancelled?.authorityId !== control.authorityId || cancelled.state !== "closed") throw new Error("Original cancellation could not be confirmed. Recover this setup reference.");
  return update(current, { phase: "closed" });
}

/** No network is required to unlock or Save. A caller must clear its draft
 * durably before finishSale; interrupted Saves reopen via activeSale().
 */
export async function openOfflineCheckout(control: OfflineSessionControl, actorId: string, passphrase: string, onState?: (state: OfflineSyncState) => void) {
  const device = await ownDevice(control, actorId), ledger = await createPharmacyOfflineLedger(control, control.authorityId);
  try {
    await ledger.unlock(passphrase);
    const prepared = await ledger.preparation();
    if (!prepared || prepared.actorId !== actorId || prepared.authorityId !== control.authorityId) throw new Error("Original prepared operator differs from this ledger.");
    const persistent = await navigator.storage?.persisted?.() ?? false;
    const sync = createPharmacyOfflineSync(ledger, (original, signal) => post(control, "import", { receipt: original.receipt, digest: original.digest, deviceSignature: original.deviceSignature }, signal),
      { online: () => navigator.onLine, onState });
    return {
      ledger, prepared, sync, persistent,
      async save(cart: OfflineCartIntent): Promise<StoredOfflineReceipt> {
        if (!persistent) throw new Error("Persistent browser storage is unavailable. Recover and synchronize existing bills before enabling new offline billing.");
        const active = await ledger.activeSale();
        if (active) {
          if (active.sale.commandId !== cart.commandId) throw new Error("Recover the earlier local Save before billing this cart.");
          return active.saved ?? ledger.commit(active.sale, device.privateKey);
        }
        const sale = await ledger.prepareSale(cart); await ledger.stageSale(sale); return ledger.commit(sale, device.privateKey);
      },
      async stop(reference: string) {
        const stopped = await ledger.stop(reference, device.privateKey), latest = await readOfflineSession(control);
        if (!latest || latest.authorityId !== control.authorityId) throw new Error("Local session changed during stop. Retain the original stopped ledger.");
        if (latest.phase !== "stopped" && latest.phase !== "closed") await update(latest, { phase: "stopped" });
        return stopped;
      },
      async reconcile(reference: string) {
        const stopped = await ledger.stop(reference, device.privateKey);
        while ((await ledger.pending(1)).length) {
          const result = await sync.flush(); if (result.status !== "idle") throw new Error("Keep this PC's stopped ledger and synchronize its remaining original bills before closing.");
        }
        const result = await post(control, "close", stopped);
        if (result?.authorityId !== control.authorityId || result.state !== "closed" || result.sequence !== stopped.sequence || result.reservedNumbersRetained !== true) throw new Error("Original closure could not be confirmed. Keep this stopped ledger.");
        const latest = await readOfflineSession(control); if (!latest || latest.authorityId !== control.authorityId) throw new Error("Local session changed during reconciliation.");
        await update(latest, { phase: "closed" }); return result;
      },
      close() { sync.pause(); ledger.close(); },
      fingerprint: offlineEvidenceCanonical({ authorityId: control.authorityId, manifestDigest: prepared.manifestDigest }),
    };
  } catch (failure) { ledger.close(); throw failure; }
}

/** Read-only restore never enrolls a replacement PC or installs an old writable
 * lease. Original PC signatures and the authenticated server decide each import.
 */
export async function synchronizePharmacyBackup(scope: DeviceScope, serialized: string, passphrase: string, onProgress: (done: number, total: number) => void = () => {}) {
  if (serialized.length > 64 * 1024 * 1024) throw new Error("Recovery backup exceeds its supported bound.");
  let header: { scope?: { organizationId: string; locationId: string; deviceId: string } };
  try { header = JSON.parse(serialized); } catch { throw new Error("Choose the original encrypted pharmacy backup JSON file."); }
  if (header.scope?.organizationId !== scope.organizationId || header.scope.locationId !== scope.locationId || !header.scope.deviceId) throw new Error("This backup belongs to another branch.");
  const { status } = await readOriginalOfflineDevice(scope, header.scope.deviceId);
  if (!status.device || header.scope?.organizationId !== scope.organizationId || header.scope.locationId !== scope.locationId || header.scope.deviceId !== status.device.deviceId) throw new Error("This backup belongs to another branch or enrolled PC.");
  const recovery = await openPharmacyOfflineRecovery(serialized, passphrase, header.scope, status.device.publicKey);
  try {
    const original = await recovery.overview(), refs = recovery.references();
    if (refs.length > 1000 || refs.length !== original.next - original.first) throw new Error("The backup does not contain its complete original issued range. Retain all backup copies for recovery.");
    const rows: Array<{ commandId: string; sequence: number; digest: string; previousDigest: string | null | undefined }> = [];
    for (const reference of refs) {
      const saved = await recovery.receipt(reference);
      if (saved.receipt.authorityId !== original.authorityId) throw new Error("Original receipt belongs to another offline authority.");
      rows.push({ commandId: reference, sequence: saved.receipt.sequence, digest: saved.digest, previousDigest: saved.receipt.previousDigest });
    }
    rows.sort((a, b) => a.sequence - b.sequence);
    if (rows.some((row, index) => row.sequence !== original.first + index || row.previousDigest !== (index ? rows[index - 1].digest : null)) ||
        (rows.at(-1)?.digest ?? null) !== original.lastDigest) throw new Error("The original backed-up receipt chain has a gap or changed evidence.");
    const stopped = await recovery.stopped();
    if (stopped && (stopped.authorityId !== original.authorityId || stopped.sequence !== original.next - 1 || stopped.lastDigest !== original.lastDigest)) throw new Error("The stopped checkpoint differs from this backup's complete receipt chain.");
    let done = 0;
    const sync = createPharmacyOfflineSync({ pending: async () => done < rows.length ? [await recovery.receipt(rows[done].commandId)] : [], acknowledge: async () => { done++; onProgress(done, rows.length); } },
      (value, signal) => post(scope, "import", { receipt: value.receipt, digest: value.digest, deviceSignature: value.deviceSignature }, signal), { online: () => navigator.onLine });
    onProgress(0, rows.length);
    while (done < rows.length) {
      const result = await sync.flush();
      if (result.status !== "idle") throw new Error("Recovery synchronization paused. Keep the encrypted file and retry its original receipts; confirmed imports will not duplicate.");
    }
    let released = false;
    if (stopped) {
      const closed = await post(scope, "close", stopped);
      if (closed?.authorityId !== original.authorityId || closed.state !== "closed" || closed.sequence !== stopped.sequence || closed.reservedNumbersRetained !== true) throw new Error("Original stopped-session release needs review. Retain this encrypted backup.");
      released = true;
    }
    return { imported: done, released, authorityId: original.authorityId };
  } finally { recovery.lock(); }
}
