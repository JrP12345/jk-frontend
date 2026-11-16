"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { PharmacyOfflineCheckoutSettings } from "./PharmacyOfflineCheckoutSettings";
import { browserDevice, cancelDeviceEnrollment, clearCancelledEnrollment, confirmEnrollmentLocally, enrollOfflineDevice, proveDeviceEnrollment, readOfflineDevice, readPendingEnrollment,
  requestDeviceChallenge, revokeOfflineDevice, savePendingEnrollment, type OfflineDeviceStatus, type PendingEnrollment, type ReservationEvidence } from "@/lib/pharmacyOfflineDevice";

interface Props { locationId: string; organizationId: string; disabled?: boolean; onBusyChange: (busy: boolean) => void }
export function PharmacyOfflineDeviceSettings(props: Props) {
  const user = useAuthStore(state => state.user), [reload, setReload] = useState(0);
  return <DeviceForm key={`${authScopeKey(user)}:${props.organizationId}:${props.locationId}:${reload}`} {...props} onReload={() => setReload(value => value + 1)} />;
}
function DeviceForm({ locationId, organizationId, disabled, onBusyChange, onReload }: Props & { onReload: () => void }) {
  const user = useAuthStore(state => state.user), scopeKey = authScopeKey(user), scope = { organizationId, locationId };
  const canManage = hasAnyPermission(user, "MANAGE_ORGANIZATION"), alive = useRef(true), lock = useRef(false);
  const [status, setStatus] = useState<OfflineDeviceStatus | null>(null), [evidence, setEvidence] = useState<ReservationEvidence | null>(null);
  const [pending, setPending] = useState<PendingEnrollment | null>(null), [thisPC, setThisPC] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [name, setName] = useState(""), [count, setCount] = useState("100"), [reference, setReference] = useState(""), [confirmed, setConfirmed] = useState(false);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scopeKey;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!canManage) return () => controller.abort();
    (async () => {
      const result = await readOfflineDevice({ organizationId, locationId }, controller.signal);
      const identity = await browserDevice({ organizationId, locationId }), attempt = await readPendingEnrollment({ organizationId, locationId });
      if (controller.signal.aborted || !current()) return;
      const matches = Boolean(identity && result.status.device?.deviceId === identity.deviceId);
      if (matches) await confirmEnrollmentLocally({ organizationId, locationId }, result.status);
      if (controller.signal.aborted || !current()) return;
      setStatus(result.status); setEvidence(result.evidence); setThisPC(matches); setPending(matches ? null : attempt);
    })().catch(failure => { if (!controller.signal.aborted && current()) setError((failure as Error).message || "PC enrollment could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted && current()) setLoading(false); });
    return () => controller.abort();
    // The keyed form remounts whenever its authority or branch changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, locationId, canManage]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || disabled || !status || !canManage || !user || !current() || !confirmed || reference.trim().length < 3) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError("");
    try {
      if (status.device?.status === "enrolled") {
        const result = await revokeOfflineDevice(scope, status.device.revision, reference);
        if (current()) { setStatus(result.status); setEvidence(result.evidence); setConfirmed(false); setReference(""); }
      } else {
        const identity = await browserDevice(scope, true);
        if (!identity || !current()) throw new Error("Device identity or operator changed. Reload before enrollment.");
        const challenge = await requestDeviceChallenge(identity, user.id);
        if (!current()) throw new Error("Operator changed. Reload before enrollment.");
        const request = await proveDeviceEnrollment(identity, challenge, { expectedRevision: status.device?.revision ?? 0, expectedNumberingRevision: status.numberingRevision,
          expectedFinancialYear: status.financialYear, count: Number(count), deviceName: name, reviewReference: reference, confirmed: true });
        const attempt = { actorId: user.id, request };
        await savePendingEnrollment(scope, attempt); // Durable exact retry before the financial POST.
        if (current()) setPending(attempt);
        if (!current()) throw new Error("Operator changed. Check the original enrollment before retrying.");
        const result = await enrollOfflineDevice(scope, request);
        await confirmEnrollmentLocally(scope, result.status);
        if (current()) { setStatus(result.status); setEvidence(result.evidence); setThisPC(true); setPending(null); setConfirmed(false); setReference(""); }
      }
    } catch (failure) {
      if (current()) { setStatus(null); setConfirmed(false); setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || (failure as Error).message || "Outcome uncertain. Check PC enrollment before retrying."); }
    } finally { lock.current = false; if (alive.current) { setBusy(false); onBusyChange(false); } }
  }
  async function retry(cancel = false) {
    if (!pending || pending.actorId !== user?.id || lock.current || disabled || !canManage || !current()) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError("");
    try {
      const result = cancel ? await cancelDeviceEnrollment(scope, pending.request.challengeId) : await enrollOfflineDevice(scope, pending.request);
      const ownEnrollment = result.status.device?.enrollmentId === pending.request.challengeId;
      if (ownEnrollment) await confirmEnrollmentLocally(scope, result.status);
      else if (cancel) await clearCancelledEnrollment(scope, pending.request.challengeId);
      if (current()) { setStatus(result.status); setEvidence(result.evidence); setThisPC(ownEnrollment); setPending(null); }
    } catch (failure) { if (current()) setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "The original enrollment could not be confirmed. Check again before replacing this PC."); }
    finally { lock.current = false; if (alive.current) { setBusy(false); onBusyChange(false); } }
  }
  const revoking = status?.device?.status === "enrolled";
  const edit = () => setConfirmed(false), validCount = /^[1-9]\d{0,3}$/.test(count) && Number(count) <= 1000;
  return <section aria-label="Designated pharmacy PC" className="space-y-3">
    <p className="text-sm text-text-secondary">Enroll this PC and browser profile for this branch, then prepare its protected offline cash counter. Reserved invoice numbers are valid for up to 24 hours.</p>
    {loading && canManage && <p role="status">Checking branch PC...</p>}
    {error && <Alert variant="error" title="PC enrollment needs attention">{error}</Alert>}
    <Button type="button" size="sm" variant="outline" disabled={loading || busy || disabled || !canManage} onClick={onReload}>Check PC enrollment</Button>
    {status?.device && <div className="space-y-1 text-sm">
      <p><strong>{status.device.deviceName}</strong> · {status.device.status === "revoked" ? "Revoked" : thisPC ? "This browser is enrolled" : "Another browser is enrolled"}</p>
      {evidence && <p>Reserved: {evidence.lease.prefix}{String(evidence.lease.next).padStart(evidence.lease.format?.digits ?? 6, "0")} – {String(evidence.lease.last).padStart(evidence.lease.format?.digits ?? 6, "0")}. Valid until {new Date(evidence.lease.validUntil).toLocaleString("en-IN")}.</p>}
      <p>Reserved numbers are retained after expiry or revocation. Before replacement, synchronize and reconcile every original bill, then revoke the old PC. An expired grant does not release ownership.</p>
    </div>}
    {pending && <Alert variant="warning" title="Enrollment outcome pending">
      Check or retry the original request. A new request could reserve extra numbers.
      <Button type="button" size="sm" disabled={busy || disabled || pending.actorId !== user?.id || !canManage} onClick={() => { void retry(); }}>Retry original enrollment</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy || disabled || pending.actorId !== user?.id || !canManage} onClick={() => { void retry(true); }}>Cancel uncommitted enrollment</Button>
      {pending.actorId !== user?.id && <p>The original enrolling operator must recover this request.</p>}
    </Alert>}
    {status && !pending && <form aria-label="Pharmacy PC enrollment" onSubmit={save} className="space-y-3">
      <fieldset disabled={busy || disabled || !canManage} className="space-y-3">
        {!revoking && <>
          <Input label="Billing PC name *" value={name} maxLength={80} minLength={2} required onChange={event => { setName(event.target.value); edit(); }} placeholder="Main counter PC" />
          <Input label="Invoice numbers to reserve *" value={count} inputMode="numeric" pattern="[1-9][0-9]{0,3}" maxLength={4} required onChange={event => { setCount(event.target.value); edit(); }} />
          <p className="text-sm text-text-secondary">Choose 1–1000. Online invoices skip this range. Unused numbers stay reserved; expiry does not return them to the sequence. This browser profile holds the private device key.</p>
        </>}
        <Input label={revoking ? "Revocation review reference *" : "Enrollment review reference *"} value={reference} minLength={3} maxLength={500} required onChange={event => { setReference(event.target.value); edit(); }} />
        <Checkbox label={revoking ? "I confirm revocation; the old ledger must still be reconciled" : "I confirm this is the branch's designated billing PC"} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        <Button type="submit" size="sm" loading={busy} disabled={!confirmed || reference.trim().length < 3 || !revoking && (!validCount || name.trim().length < 2)}>{revoking ? "Revoke PC enrollment" : status.device ? "Enroll replacement PC & reserve numbers" : "Enroll this PC & reserve numbers"}</Button>
      </fieldset>
    </form>}
    {status?.device && <PharmacyOfflineCheckoutSettings organizationId={organizationId} locationId={locationId} canPrepare={thisPC && status.device.status === "enrolled"} disabled={disabled || busy} onBusyChange={onBusyChange} />}
  </section>;
}
