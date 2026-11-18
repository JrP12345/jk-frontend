"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { cancelOfflinePreparation, openOfflineCheckout, prepareOfflineCheckout, startOfflineCheckout, synchronizePharmacyBackup } from "@/lib/pharmacyOfflineCheckout";
import { readOfflineSession, type OfflineSessionControl } from "@/lib/pharmacyOfflineSession";

export function PharmacyOfflineCheckoutSettings({ organizationId, locationId, disabled, canPrepare = true, onBusyChange }: {
  organizationId: string; locationId: string; disabled?: boolean; canPrepare?: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const user = useAuthStore(state => state.user), owner = authScopeKey(user), alive = useRef(true), lock = useRef(false);
  const [control, setControl] = useState<OfflineSessionControl | null>(null), [ready, setReady] = useState(false);
  const [passphrase, setPassphrase] = useState(""), [reference, setReference] = useState(""), [count, setCount] = useState("100"), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const [backup, setBackup] = useState<File | null>(null), [recoveryStatus, setRecoveryStatus] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === owner;
  useEffect(() => {
    alive.current = true;
    void readOfflineSession({ organizationId, locationId }).then(value => { if (current()) setControl(value); }).catch(failure => { if (current()) setError((failure as Error).message); }).finally(() => { if (current()) setReady(true); });
    return () => { alive.current = false; };
    // Parent form is keyed by operator and branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, locationId]);
  async function act(action: "prepare" | "backup" | "close" | "cancel" | "restore") {
    if (!current() || !user || lock.current || disabled) return;
    lock.current = true; setBusy(action); onBusyChange(true); setError(""); setBackupStatus("");
    let runtime: Awaited<ReturnType<typeof openOfflineCheckout>> | undefined;
    try {
      const saved = await readOfflineSession({ organizationId, locationId });
      if (action === "prepare") {
        const original = saved && saved.phase !== "closed" ? saved : await startOfflineCheckout({ organizationId, locationId }, user.id, reference, Number(count));
        if (current()) setControl(original);
        await prepareOfflineCheckout(original, user.id, passphrase);
      } else if (action === "restore") {
        if (!backup || backup.size > 64 * 1024 * 1024) throw new Error("Choose an encrypted recovery backup up to 64 MB.");
        const result = await synchronizePharmacyBackup({ organizationId, locationId }, await backup.text(), passphrase,
          (done, total) => { if (current()) setRecoveryStatus(`Original bills confirmed: ${done} of ${total}`); });
        if (current()) setRecoveryStatus(`${result.imported} original bills confirmed. ${result.released ? "The stopped session is reconciled." : "The original PC must still stop and reconcile its ledger before branch release."}`);
      } else if (action === "cancel") {
        if (!saved) throw new Error("Original preparation is missing.");
        await cancelOfflinePreparation(saved, user.id, reference);
      } else {
        if (!saved) throw new Error("Original protected session is missing.");
        runtime = await openOfflineCheckout(saved, user.id, passphrase);
        if (!current()) return;
        if (action === "close") { await runtime.stop(reference); await runtime.reconcile(reference); }
        else {
          const content = await runtime.ledger.exportRecoveryBackup(), link = document.createElement("a"), url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
          link.href = url; link.download = `ekavyu-offline-${locationId.slice(-6)}-${saved.authorityId}.json`; document.body.append(link);
          try { link.click(); if (current()) setBackupStatus("Backup download requested. Check your browser downloads, keep a separate USB or cloud copy, and verify that file through backup recovery. A download request does not confirm a stored backup."); }
          finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
        }
      }
    } catch (failure) { if (current()) setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || (failure as Error).message); }
    finally {
      runtime?.close(); lock.current = false;
      if (current()) {
        const latest = await readOfflineSession({ organizationId, locationId }).catch(() => null);
        if (current()) { setPassphrase(""); setBusy(""); setConfirmed(false); setControl(latest); onBusyChange(false); }
      }
    }
  }
  const inPreparation = Boolean(control && ["claiming", "owned", "prepared"].includes(control.phase)), issued = Boolean(control && ["active", "stopped", "closed"].includes(control.phase));
  return <section aria-label="Final offline cash billing" className="space-y-3 rounded-control border border-border p-3">
    <p className="text-sm font-semibold">Offline cash billing on this PC</p>
    <p className="text-sm text-text-secondary">One operator, reviewed ordinary medicines and tracked stock. This PC owns the branch stock and cash drawer until you stop and synchronize. Other stock changes wait until then.</p>
    {!ready && <p role="status">Opening saved offline setup…</p>}
    {control && <p className="text-sm">Session: <strong>{control.phase === "closed" ? "Reconciled" : control.phase}</strong></p>}
    {error && <Alert variant="error" title="Original offline session needs attention">{error}</Alert>}
    <Input label="Offline passphrase" type="password" autoComplete="off" minLength={12} maxLength={128} value={passphrase} disabled={Boolean(busy) || disabled} onChange={event => setPassphrase(event.target.value)} />
    <p className="text-xs text-text-secondary">Use 12–128 characters and keep it with your protected backups. It is required after restarting this browser; it is never sent to the server.</p>
    <Input label="Preparation or reconciliation review reference" value={reference} maxLength={500} disabled={Boolean(busy) || disabled} onChange={event => setReference(event.target.value)} />
    {canPrepare && (!control || control.phase === "closed") && <Input label="Numbers for the next session (1–1000)" inputMode="numeric" value={count} maxLength={4} onChange={event => setCount(event.target.value)} disabled={Boolean(busy) || disabled} />}
    {canPrepare && (!control || inPreparation || control.phase === "closed") && <>
      <Checkbox label="I confirm this is the designated PC and understand the cash-only branch ownership" checked={confirmed} disabled={Boolean(busy) || disabled} onChange={event => setConfirmed(event.target.checked)} />
      <Button type="button" size="sm" disabled={!ready || disabled || Boolean(busy) || !confirmed || passphrase.length < 12 || reference.trim().length < 3 || Boolean(control?.cancellation)} loading={busy === "prepare"} onClick={() => { void act("prepare"); }}>{inPreparation ? "Recover original preparation" : "Prepare offline cash billing"}</Button>
    </>}
    <div className="flex flex-wrap gap-2">
      {inPreparation && <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(busy) || reference.trim().length < 3} onClick={() => { void act("cancel"); }}>Cancel unactivated preparation</Button>}
      {issued && <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(busy) || passphrase.length < 12} onClick={() => { void act("backup"); }}>Download encrypted recovery backup</Button>}
      {control && ["active", "stopped"].includes(control.phase) && <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(busy) || passphrase.length < 12 || reference.trim().length < 3} loading={busy === "close"} onClick={() => { void act("close"); }}>Stop, synchronize &amp; release branch</Button>}
    </div>
    {backupStatus && <p role="status" className="text-xs text-text-secondary">{backupStatus}</p>}
    <details><summary className="cursor-pointer text-sm">Recover original bills from an encrypted backup</summary><div className="mt-3 space-y-3">
      <p className="text-xs text-text-secondary">Recovery verifies the original PC signatures and preserves invoice numbers. It never restores a writable number lease or enrolls a replacement PC.</p>
      <Input label="Encrypted recovery backup" type="file" accept=".json,application/json" disabled={Boolean(busy) || disabled} onChange={event => setBackup(event.target.files?.[0] || null)} />
      <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(busy) || !backup || backup.size > 64 * 1024 * 1024 || passphrase.length < 12} onClick={() => { void act("restore"); }}>Verify &amp; synchronize original backup</Button>
      {recoveryStatus && <p className="text-sm" role="status">{recoveryStatus}</p>}
    </div></details>
    {busy && <p role="status">{busy === "prepare" ? "Verifying and saving the original prepared stock…" : busy === "close" ? "Stopping this ledger and synchronizing its original receipts…" : busy === "backup" ? "Exporting encrypted recovery evidence…" : "Recovering the original cancellation…"}</p>}
  </section>;
}
