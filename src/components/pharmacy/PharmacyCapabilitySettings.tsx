"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { parsePharmacyCapabilities, type PharmacyCapabilities } from "@/lib/pharmacyCapabilities";
import { organizationPath } from "@/services/organization.service";
import { useAuthStore } from "@/store/authStore";
import { Alert, Button, Checkbox, Input, Select } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { PharmacyIssuerSettings } from "./PharmacyIssuerSettings";
import { PharmacyInvoiceNumberingSettings } from "./PharmacyInvoiceNumberingSettings";
import { PharmacyOfflineDeviceSettings } from "./PharmacyOfflineDeviceSettings";
import { PharmacyStockReconciliation } from "./PharmacyStockReconciliation";
import { stockCountStorageKey } from "@/lib/pharmacyStockReconciliation";

interface Props {
  location: { id: string; name: string; organizationId?: string };
  organizationId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PharmacyCapabilitySettings(props: Props) {
  const user = useAuthStore(state => state.user);
  return <CapabilitySettingsSession key={`${authScopeKey(user)}:${props.organizationId || props.location.organizationId || "session"}:${props.location.id}`} {...props} />;
}
function CapabilitySettingsSession({ location, organizationId, onClose, onSaved }: Props) {
  const user = useAuthStore(state => state.user);
  const scope = authScopeKey(user);
  const [settings, setSettings] = useState<PharmacyCapabilities | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [inventoryMode, setInventoryMode] = useState<"tracked" | "billing_only">("tracked");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [issuerOpen, setIssuerOpen] = useState(false), [issuerBusy, setIssuerBusy] = useState(false);
  const [numberingOpen, setNumberingOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const alive = useRef(true);
  const saveLock = useRef(false);
  const path = organizationPath(`/pharmacy/locations/${encodeURIComponent(location.id)}/settings`, organizationId || location.organizationId);
  const canManage = hasAnyPermission(user, "PHARMACY_MANAGE_SETTINGS", "MANAGE_ORGANIZATION");
  const issuerOrganizationId = organizationId || location.organizationId || user?.organization_id;
  const canManageIssuer = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  const canCount = canManage && ["PHARMACY_ADJUST_STOCK", "PHARMACY_RECEIVE_STOCK", "PHARMACY_VIEW_COST"].every(code => hasAnyPermission(user, code, "MANAGE_MEDICINES"));
  let hasPendingCount = false;
  try { hasPendingCount = Boolean(sessionStorage.getItem(stockCountStorageKey(scope, location.id))); } catch { /* The count dialog reports unavailable recovery storage. */ }
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setSettings(null); setError(""); setReference("");
    api.get(path, { signal: controller.signal }).then(response => {
      const current = parsePharmacyCapabilities(response.data?.data, location.id);
      if (!controller.signal.aborted && authScopeKey(useAuthStore.getState().user) === scope) {
        setSettings(current); setEnabled(current.enabled); setInventoryMode(current.inventoryMode || "tracked");
      }
    }).catch(() => {
      if (!controller.signal.aborted) setError("Pharmacy settings could not be loaded. Reload before changing access.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, location.id, scope, reload]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saveLock.current || issuerBusy || !settings || !canManage || reference.trim().length < 3 || authScopeKey(useAuthStore.getState().user) !== scope) return;
    saveLock.current = true; setSaving(true); setError("");
    try {
      const response = await api.patch(path, { enabled, inventoryMode, expectedRevision: settings.revision, reviewReference: reference.trim() });
      parsePharmacyCapabilities(response.data?.data, location.id);
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) { onSaved(); onClose(); }
    } catch (failure) {
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) {
        setSettings(null);
        setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "The save outcome could not be confirmed. Reload settings before trying again.");
      }
    } finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }

  async function beginCount() {
    if (!settings || !canCount || saveLock.current || issuerBusy || !canManage || authScopeKey(useAuthStore.getState().user) !== scope) return;
    if (hasPendingCount || !settings.enabled) { setCountOpen(true); return; }
    if (reference.trim().length < 3) return;
    saveLock.current = true; setSaving(true); setError("");
    try {
      const response = await api.patch(path, { enabled: false, inventoryMode: "billing_only", expectedRevision: settings.revision, reviewReference: reference.trim() });
      const current = parsePharmacyCapabilities(response.data?.data, location.id);
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) { setSettings(current); setEnabled(false); setInventoryMode("billing_only"); setCountOpen(true); onSaved(); }
    } catch (failure) {
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) { setSettings(null); setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "Branch pause could not be confirmed. Reload settings."); }
    } finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }

  if (countOpen) return <PharmacyStockReconciliation locationId={location.id} organizationId={issuerOrganizationId} onClose={() => { setCountOpen(false); setReload(n => n + 1); }} onCompleted={() => { onSaved(); onClose(); }} />;

  return <Modal open onClose={onClose} busy={saving || issuerBusy} title="Pharmacy settings" description={location.name} size="md" footer={<>
    <Button size="sm" variant="outline" disabled={saving || issuerBusy} onClick={onClose}>Cancel</Button>
    <Button size="sm" type="submit" form="pharmacy-capability-settings" loading={saving} disabled={issuerBusy || loading || !settings || !settings.actions.manageSettings || !canManage || reference.trim().length < 3}>Save pharmacy settings</Button>
  </>}>
    <form id="pharmacy-capability-settings" onSubmit={save} className="space-y-4">
      {loading && <p role="status">Loading pharmacy settings...</p>}
      {error && <Alert variant="error" title="Settings unavailable" action={<Button size="sm" variant="outline" disabled={saving} onClick={() => setReload(value => value + 1)}>Reload settings</Button>}>{error}</Alert>}
      {settings && <>
        <Checkbox label="Enable pharmacy at this location" checked={enabled} disabled={!canManage || saving || issuerBusy || !settings.actions.manageSettings} onChange={event => setEnabled(event.target.checked)} />
        <Select label="Branch inventory mode" value={inventoryMode} disabled={!canManage || saving || issuerBusy || !settings.actions.manageSettings} onChange={event => setInventoryMode(event.target.value as "tracked" | "billing_only")} options={[{ value: "tracked", label: "Track stock and batches" }, { value: "billing_only", label: "Billing only — no stock tracking" }]} />
        <p className="text-sm text-text-secondary">This applies to the whole branch. Billing-only sales use catalogue prices and printed supply details without deducting stock. Existing stock and invoices are preserved. Use physical reconciliation to return to stock tracking after billing-only sales.</p>
        {(settings.inventoryMode === "billing_only" || hasPendingCount) && <section className="space-y-2" aria-label="Return to stock tracking">
          <p className="text-sm text-text-secondary">Reconciliation pauses new branch sales while you count actual batches. Closing the count leaves the branch paused. Confirming records stock adjustments and enables tracking.</p>
          <Button type="button" size="sm" variant="outline" disabled={saving || issuerBusy || !canCount || !hasPendingCount && settings.enabled && reference.trim().length < 3} onClick={() => { void beginCount(); }}>{hasPendingCount ? "Check earlier physical count" : settings.enabled ? "Pause branch & count stock" : "Count stock & enable tracking"}</Button>
          {!canCount && <p className="text-sm text-text-secondary">Stock adjustment, receiving and acquisition-cost permissions are also required.</p>}
        </section>}
        {settings.commercialEntitlement && <p className="text-sm">Branch commercial access: {settings.commercialEntitlement === "active" ? "active product" : settings.commercialEntitlement === "plan_included" ? "included in current plan" : "unavailable for new business"}. Staff branch permissions are managed separately.</p>}
        {settings.mode === "legacy_included" && <p className="text-sm text-text-secondary">This location currently uses included pharmacy access. Saving records an explicit location setting.</p>}
        {!settings.moduleEnabled && <Alert variant="warning" title="Organization pharmacy module disabled">The organization module must also be enabled for staff operations.</Alert>}
        <p className="text-sm text-text-secondary">Enabling requires a reviewed pharmacy issuer profile with operating licence details. Enter the reference for your actual review.</p>
        <Input label="Review reference *" value={reference} maxLength={500} disabled={saving || !canManage} onChange={event => setReference(event.target.value)} required minLength={3} />
        <p className="text-sm text-text-secondary">Disabling stops new stock changes and prescription supply. Authorized history and recovery of committed operations stay available.</p>
      </>}
    </form>
    {settings && canManageIssuer && issuerOrganizationId && <section className="mt-4 space-y-3" aria-label="Branch issuer administration">
      <Button type="button" size="sm" variant="outline" disabled={saving || issuerBusy || !settings.moduleEnabled} onClick={() => setIssuerOpen(value => !value)}>{issuerOpen ? "Hide issuer details" : "Review issuer and licence details"}</Button>
      {issuerOpen && <PharmacyIssuerSettings locationId={location.id} organizationId={issuerOrganizationId} disabled={saving || issuerBusy} onBusyChange={setIssuerBusy} />}
      <Button type="button" size="sm" variant="outline" disabled={saving || issuerBusy || !settings.moduleEnabled} onClick={() => setNumberingOpen(value => !value)}>{numberingOpen ? "Hide invoice numbering" : "Configure invoice numbering"}</Button>
      {numberingOpen && <PharmacyInvoiceNumberingSettings locationId={location.id} organizationId={issuerOrganizationId} disabled={saving || issuerBusy} onBusyChange={setIssuerBusy} />}
      <Button type="button" size="sm" variant="outline" disabled={saving || issuerBusy || !settings.moduleEnabled} onClick={() => setDeviceOpen(value => !value)}>{deviceOpen ? "Hide billing PC" : "Designated billing PC"}</Button>
      {deviceOpen && <PharmacyOfflineDeviceSettings locationId={location.id} organizationId={issuerOrganizationId} disabled={saving || issuerBusy} onBusyChange={setIssuerBusy} />}
    </section>}
  </Modal>;
}
