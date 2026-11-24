"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
type Settings = { locationId: string; configured: boolean; keyId: string; enabled: boolean; revision: number; webhookPath: string };
export function PharmacyGatewaySettings({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Pharmacy merchant payment gateway</summary>{open && <GatewayForm key={locationId} locationId={locationId} />}</details>;
}
function GatewayForm({ locationId }: { locationId: string }) {
  const scope = authScopeKey(useAuthStore(state => state.user)), alive = useRef(true), lock = useRef(false);
  const [settings, setSettings] = useState<Settings | null>(null), [keyId, setKeyId] = useState(""), [secret, setSecret] = useState(""), [webhook, setWebhook] = useState(""), [enabled, setEnabled] = useState(false), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0), [notice, setNotice] = useState("");
  const current = () => alive.current && authScopeKey(useAuthStore.getState().user) === scope;
  useEffect(() => { alive.current = true; const controller = new AbortController(); setSettings(null);
    void api.get("/pharmacy/merchant-gateway", { params: { locationId }, signal: controller.signal }).then(response => { const data = response.data?.data as Settings; if (!data || data.locationId !== locationId || !Number.isSafeInteger(data.revision) || typeof data.keyId !== "string" || typeof data.webhookPath !== "string") throw Error("Merchant settings could not be confirmed"); if (current()) { setSettings(data); setKeyId(data.keyId); setEnabled(data.enabled); } }).catch(failure => { if (!controller.signal.aborted && current()) setError(failure?.response?.data?.message || failure.message); });
    return () => { alive.current = false; controller.abort(); };
  }, [locationId, scope, retry]);
  async function save() {
    if (!settings || lock.current || !confirmed) return; lock.current = true; setBusy(true); setError(""); setNotice("");
    try { const response = await api.put("/pharmacy/merchant-gateway", { locationId, expectedRevision: settings.revision, keyId, keySecret: secret, webhookSecret: webhook, enabled, merchantConfirmed: true }); if (response.data?.data?.locationId !== locationId || response.data?.data?.revision !== settings.revision + 1) throw Error("Gateway save needs confirmation; reload before another save"); if (current()) { setSecret(""); setWebhook(""); setConfirmed(false); setNotice("Merchant settings saved. Verify test-mode checkout and webhook delivery before live use."); setRetry(value => value + 1); } }
    catch (failure) { if (current()) setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message || (failure as Error).message); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  return <section className="space-y-3"><p>Use this pharmacy's Razorpay merchant account. These credentials receive pharmacy customer payments; Ekavyu subscription credentials are separate. Start with test keys. Existing checkouts retain their original merchant evidence if keys change.</p>{error && <Alert variant="error" title="Merchant gateway needs attention">{error}<Button size="sm" onClick={() => setRetry(value => value + 1)}>Reload merchant settings</Button></Alert>}{notice && <p role="status">{notice}</p>}
    {settings && <><p className="break-all">Configure the merchant's payment.captured webhook at the API server's public HTTPS origin plus {settings.webhookPath}. Use the same webhook secret entered below.</p><fieldset disabled={busy} className="space-y-3"><Input label="Pharmacy Razorpay key ID" value={keyId} autoComplete="off" onChange={event => { setKeyId(event.target.value); setConfirmed(false); }} /><Input label="Pharmacy Razorpay key secret" type="password" autoComplete="new-password" value={secret} onChange={event => { setSecret(event.target.value); setConfirmed(false); }} /><Input label="Pharmacy webhook secret" type="password" autoComplete="new-password" value={webhook} onChange={event => { setWebhook(event.target.value); setConfirmed(false); }} /><Checkbox label="Enable pharmacy online checkout" checked={enabled} onChange={event => { setEnabled(event.target.checked); setConfirmed(false); }} /><Checkbox label="I confirm this merchant account belongs to this pharmacy and the credentials match its test/live mode" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><Button size="sm" disabled={!confirmed || !secret || !webhook} onClick={() => { void save(); }}>{busy ? "Saving merchant settings..." : "Save pharmacy merchant gateway"}</Button></fieldset></>}
  </section>;
}
