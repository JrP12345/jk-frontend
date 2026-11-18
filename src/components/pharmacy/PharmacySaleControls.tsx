"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Checkbox, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/apiError";
import { readPharmacySaleControls, savePharmacySaleControl, type PharmacySaleControls as Controls } from "@/lib/pharmacySaleControls";

interface Props { medicineId: string; locationId: string; onClose: () => void; onChanged: () => void }
export function PharmacySaleControls(props: Props) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <ControlSession key={`${scope}:${props.locationId}:${props.medicineId}`} {...props} />;
}
function ControlSession({ medicineId, locationId, onClose, onChanged }: Props) {
  const user = useAuthStore(state => state.user), scope = authScopeKey(user), canManage = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const [data, setData] = useState<Controls | null>(null), [cursor, setCursor] = useState<string>(), [reload, setReload] = useState(0), [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("product"), [reason, setReason] = useState(""), [reference, setReference] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const beginRead = useLatestRead(), lock = useRef(false), alive = useRef(true);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const request = beginRead();
    readPharmacySaleControls(medicineId, locationId, cursor, request.signal).then(value => { if (request.isCurrent()) setData(value); })
      .catch(failure => { if (request.isCurrent()) setError(apiErrorMessage(failure, "Sale controls could not be loaded.")); })
      .finally(() => { if (request.isCurrent()) setLoading(false); });
    return () => { beginRead(); };
  }, [medicineId, locationId, cursor, reload, beginRead]);
  const selected = target === "product" ? data?.saleControl : data?.batches.find(lot => lot.id === target)?.saleControl;
  const blocked = selected?.blocked === true;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!data || !canManage || !confirmed || lock.current || !current() || target !== "product" && !data.batches.some(lot => lot.id === target)) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await savePharmacySaleControl(target === "product" ? "product" : "batch", target === "product" ? medicineId : target, locationId,
        { expectedRevision: selected?.revision || 0, blocked: !blocked, reason: reason.trim(), reviewReference: reference.trim(), confirmed: true });
      if (current()) { setData(null); setConfirmed(false); setReason(""); setReference(""); setNotice(result.offlineNotice || (blocked ? "Sale hold released. Other product, batch, expiry and dispensing checks still apply." : "Sale hold saved. Physical stock and historical bills are unchanged.")); setLoading(true); setReload(value => value + 1); onChanged(); }
    } catch (failure) { if (current()) { setData(null); setConfirmed(false); setError(`${apiErrorMessage(failure, "Sale control could not be confirmed.")} Reload its current result before retrying.`); } }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  return <Modal open title="Product and batch sale holds" description={data?.name} onClose={onClose} busy={busy} size="lg">
    <div className="space-y-4">
      <p className="text-sm">Block the exact product or batch after reviewing your source. These controls do not change stock counts, classify a medicine as legally banned, or replace physical quarantine.</p>
      {error && <Alert variant="error" title="Sale controls need attention">{error}</Alert>}
      {notice && <Alert variant="info" title="Sale control saved">{notice}</Alert>}
      <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => { setLoading(true); setData(null); setConfirmed(false); setError(""); setReload(value => value + 1); }}>Reload sale controls</Button>
      {loading && <p role="status">Loading sale controls…</p>}
      {data && <form onSubmit={save} className="space-y-3"><fieldset disabled={busy || !canManage} className="space-y-3">
        <Select label="Apply to" value={target} options={[{ value: "product", label: "Whole product — all batches" }, ...data.batches.map(lot => ({ value: lot.id, label: `${lot.batchNumber} · ${lot.status}${lot.saleControl?.blocked ? " · On hold" : ""}` }))]} onChange={event => { setTarget(event.target.value); setConfirmed(false); }} />
        <Badge variant={blocked ? "warning" : "neutral"}>{blocked ? "Sale hold active" : "No sale hold on this selection"}</Badge>
        {selected && <p className="text-sm">{selected.reason} · Reference: {selected.reviewReference} · {new Date(selected.changedAt).toLocaleString()}</p>}
        {target !== "product" && data.saleControl?.blocked && <p className="text-sm">The whole product is also blocked. Releasing this batch hold will not release the product hold.</p>}
        {canManage && <><Input label="Reason for this action" required minLength={3} maxLength={500} value={reason} onChange={event => { setReason(event.target.value); setConfirmed(false); }} />
          <Input label="Source / review reference" required minLength={3} maxLength={200} value={reference} onChange={event => { setReference(event.target.value); setConfirmed(false); }} />
          <Checkbox label={`I verified the exact selection and intend to ${blocked ? "release" : "apply"} this sale hold`} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
          <Button type="submit" disabled={!confirmed || loading} loading={busy}>{blocked ? "Release sale hold" : "Stop selling selection"}</Button></>}
      </fieldset></form>}
      {data && <div className="flex gap-2">{cursor && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setTarget("product"); setConfirmed(false); setData(null); setLoading(true); setCursor(undefined); }}>First batch page</Button>}{data.nextCursor && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setTarget("product"); setConfirmed(false); setLoading(true); setCursor(data.nextCursor!); setData(null); }}>More batches</Button>}</div>}
      {!canManage && <p className="text-sm">An organization administrator must change sale holds.</p>}
      <p className="text-xs text-text-secondary">A disconnected billing PC cannot receive a new hold until it reconnects. Contact its operator immediately. Hold release requires closing any original offline session.</p>
    </div>
  </Modal>;
}
