"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Checkbox } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { pickupError, readStorefront, saveStorefront, type StorefrontSettings } from "@/lib/pharmacyPickup";

export function PharmacyStorefrontSettings({ locationId }: { locationId: string }) {
  const scope = authScopeKey(useAuthStore(state => state.user));
  return <StorefrontSession key={`${scope}:${locationId}`} locationId={locationId} scope={scope} />;
}
function StorefrontSession({ locationId, scope }: { locationId: string; scope: string }) {
  const [value, setValue] = useState<StorefrontSettings | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  const begin = useLatestRead(), lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  const load = useCallback(async () => { const request = begin(); setError(""); try { const next = await readStorefront(locationId, request.signal); if (request.isCurrent()) setValue(next); } catch (failure) { if (request.isCurrent()) setError(pickupError(failure)); } }, [begin, locationId]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  async function save() {
    if (!value || lock.current || !current()) return;
    lock.current = true; setBusy(true); setError(""); setSaved(false);
    try { const next = await saveStorefront(locationId, { catalogueEnabled: value.catalogueEnabled, pickupEnabled: value.pickupEnabled, expectedRevision: value.revision }); if (current()) { setValue(next); setSaved(true); } }
    catch (failure) { if (current()) setError(pickupError(failure)); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  return <Card className="max-w-2xl" contentClassName="gap-5"><header><h2 className="text-lg font-semibold">Public medicine list & pickup</h2><p className="mt-2 text-sm text-text-secondary">These options are off by default. Your location must also be published in Browse. Pharmacy-only locations do not need doctors or appointment booking.</p></header>
    {error && <Alert variant="error" title="Settings need attention">{error}<Button size="sm" variant="outline" disabled={busy} onClick={() => { void load(); }}>Reload settings</Button></Alert>}
    {!value ? <p role="status">Loading public pharmacy settings...</p> : <>
      <Checkbox label="Publish medicine list" description="Show reviewed general medicines and availability on your location page. Cost prices, stock counts and customer details stay private." checked={value.catalogueEnabled} disabled={busy} onChange={event => { setSaved(false); setValue({ ...value, catalogueEnabled: event.target.checked, pickupEnabled: event.target.checked && value.pickupEnabled }); }} />
      <Checkbox label="Allow pickup requests" description="Customers select medicines and receive a QR ticket. Staff prepare the request, link its counter bill, then scan and hand over after payment." checked={value.pickupEnabled} disabled={busy || !value.catalogueEnabled || value.inventoryMode === "billing_only"} onChange={event => { setSaved(false); setValue({ ...value, pickupEnabled: event.target.checked }); }} />
      {value.inventoryMode === "billing_only" && <p className="text-sm text-text-secondary">This branch does not track stock. Its catalogue can be published with availability confirmed by phone. Stock-based pickup requests are paused.</p>}
      <p className="text-xs text-text-secondary">Prescription and restricted medicines keep their existing pharmacist review workflow. Pickup requests do not reserve stock or collect online payments. Existing tickets remain accessible if you turn requests off.</p>
      <Button loading={busy} onClick={() => { void save(); }}>Save public pharmacy settings</Button>{saved && <p role="status" className="text-sm text-accent">Public pharmacy settings saved.</p>}
    </>}
  </Card>;
}
