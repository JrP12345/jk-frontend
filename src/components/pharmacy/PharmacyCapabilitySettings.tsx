"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { parsePharmacyCapabilities, type PharmacyCapabilities } from "@/lib/pharmacyCapabilities";
import { organizationPath } from "@/services/organization.service";
import { useAuthStore } from "@/store/authStore";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { PharmacyIssuerSettings } from "./PharmacyIssuerSettings";

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
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [issuerOpen, setIssuerOpen] = useState(false), [issuerBusy, setIssuerBusy] = useState(false);
  const alive = useRef(true);
  const saveLock = useRef(false);
  const path = organizationPath(`/pharmacy/locations/${encodeURIComponent(location.id)}/settings`, organizationId || location.organizationId);
  const canManage = hasAnyPermission(user, "PHARMACY_MANAGE_SETTINGS", "MANAGE_ORGANIZATION");
  const issuerOrganizationId = organizationId || location.organizationId || user?.organization_id;
  const canManageIssuer = hasAnyPermission(user, "MANAGE_ORGANIZATION");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setSettings(null); setError(""); setReference("");
    api.get(path, { signal: controller.signal }).then(response => {
      const current = parsePharmacyCapabilities(response.data?.data, location.id);
      if (!controller.signal.aborted && authScopeKey(useAuthStore.getState().user) === scope) {
        setSettings(current); setEnabled(current.enabled);
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
      const response = await api.patch(path, { enabled, expectedRevision: settings.revision, reviewReference: reference.trim() });
      parsePharmacyCapabilities(response.data?.data, location.id);
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) { onSaved(); onClose(); }
    } catch (failure) {
      if (alive.current && authScopeKey(useAuthStore.getState().user) === scope) {
        setSettings(null);
        setError((failure as { response?: { data?: { message?: string } } }).response?.data?.message || "The save outcome could not be confirmed. Reload settings before trying again.");
      }
    } finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }

  return <Modal open onClose={onClose} busy={saving || issuerBusy} title="Pharmacy settings" description={location.name} size="md" footer={<>
    <Button size="sm" variant="outline" disabled={saving || issuerBusy} onClick={onClose}>Cancel</Button>
    <Button size="sm" type="submit" form="pharmacy-capability-settings" loading={saving} disabled={issuerBusy || loading || !settings || !settings.actions.manageSettings || !canManage || reference.trim().length < 3}>Save pharmacy settings</Button>
  </>}>
    <form id="pharmacy-capability-settings" onSubmit={save} className="space-y-4">
      {loading && <p role="status">Loading pharmacy settings...</p>}
      {error && <Alert variant="error" title="Settings unavailable" action={<Button size="sm" variant="outline" disabled={saving} onClick={() => setReload(value => value + 1)}>Reload settings</Button>}>{error}</Alert>}
      {settings && <>
        <Checkbox label="Enable pharmacy at this location" checked={enabled} disabled={!canManage || saving || issuerBusy || !settings.actions.manageSettings} onChange={event => setEnabled(event.target.checked)} />
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
      {issuerOpen && <PharmacyIssuerSettings locationId={location.id} organizationId={issuerOrganizationId} disabled={saving} onBusyChange={setIssuerBusy} />}
    </section>}
  </Modal>;
}
