"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button, Input, Toggle, Badge, useToast } from "@/components/ui";

export default function WhatsAppConnectionPanel({ organizationId, isRoot, mode }: { organizationId?: string; isRoot: boolean; mode: string }) {
  const platform = isRoot && mode === "shared";
  const base = platform ? "/admin/whatsapp" : "/organization/whatsapp";
  const params = !platform && organizationId ? { organizationId } : undefined;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [enabled, setEnabled] = useState<boolean | undefined>();
  const health = useQuery({ queryKey: ["whatsapp-health", base, organizationId], queryFn: async () => (await api.get(`${base}/health`, { params })).data.data,
    enabled: mode !== "disabled", refetchInterval: 15_000 });
  const mutation = useMutation({ mutationFn: async (action: string) => {
    if (action === "save") return api.patch(base, { enabled: enabled ?? health.data?.connection.enabled ?? false,
      wabaId: wabaId.trim() || undefined, phoneNumberId: phoneNumberId.trim() || undefined, accessToken: accessToken.trim() || undefined, appSecret: appSecret.trim() || undefined });
    return api.post(`${base}/${action}`, {}, { params });
  }, onSuccess: (result) => {
    setAccessToken(""); setAppSecret("");
    queryClient.invalidateQueries({ queryKey: ["whatsapp-health"] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
    toast({ title: "WhatsApp setup updated", description: result.data.message || "Credentials saved securely", variant: "success" });
  }, onError: (error: any) => toast({ title: "WhatsApp setup failed", description: error.response?.data?.message || "Please try again", variant: "error" }) });
  if (mode === "disabled") return null;
  const data = health.data;
  return <div className="space-y-4 rounded-2xl border border-border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">{platform ? "Platform WhatsApp connection" : "Connection and delivery"}</h4>
      <Badge>{data?.connection?.connectionStatus || "Not connected"}</Badge>
    </div>
    {health.isLoading && <p className="text-sm text-text-muted">Loading connection details…</p>}
    {health.isError && <p className="text-sm text-text-muted">Could not load connection details. <button type="button" className="underline" onClick={() => health.refetch()}>Retry</button></p>}
    {platform && <div className="space-y-3">
      <p className="text-xs text-text-muted">Root controls the shared sender for all clinics. Blank credential fields keep the saved values.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Platform WABA ID" value={wabaId} placeholder={data?.connection.wabaId || "Business account ID"} onChange={e => setWabaId(e.target.value)} />
        <Input label="Platform phone number ID" value={phoneNumberId} placeholder={data?.connection.phoneNumberId || "Phone number ID"} onChange={e => setPhoneNumberId(e.target.value)} />
        <Input label="System user access token" type="password" autoComplete="new-password" value={accessToken} placeholder={data?.connection.hasToken ? "Saved — leave blank to keep" : "Paste access token"} onChange={e => setAccessToken(e.target.value)} />
        <Input label="Meta app secret" type="password" autoComplete="new-password" value={appSecret} placeholder={data?.connection.hasAppSecret ? "Saved — leave blank to keep" : "Paste app secret"} onChange={e => setAppSecret(e.target.value)} />
      </div>
      <Toggle checked={enabled ?? data?.connection.enabled ?? false} onChange={setEnabled} label="Enable shared gateway" />
      <Button onClick={() => mutation.mutate("save")} disabled={mutation.isPending}>Save platform credentials</Button>
    </div>}
    {(platform || mode === "dedicated") && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Meta webhook callback URL" readOnly value={data?.connection.webhookUrl || ""} />
        <Input label="Webhook verify token" readOnly value={data?.connection.verifyToken || "Save credentials to generate"} />
      </div>
      <p className="text-xs text-text-muted">Save your credentials first, then test the connection and sync templates. Configure this HTTPS callback in Meta and subscribe to messages and template updates.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate("test")}>Test connection</Button>
        <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate("templates/sync")}>Sync templates</Button>
      </div>
    </>}
    {!!data?.issues?.length && <ul className="list-disc space-y-1 pl-5 text-xs text-text-muted">{data.issues.map((issue: string) => <li key={issue}>{issue}</li>)}</ul>}
    <div className="flex flex-wrap gap-4 text-xs text-text-muted">
      <span>Queued: {data?.pending ?? 0}</span>
      {(data?.today || []).map((row: any) => <span key={row._id}>Today {row._id}: {row.count}</span>)}
      <span>Last webhook: {data?.lastWebhookAt ? new Date(data.lastWebhookAt).toLocaleString() : "None yet"}</span>
    </div>
    {!!data?.templates?.length && <div className="max-h-52 overflow-auto">
      <table className="w-full text-left text-xs"><thead><tr><th className="p-2">Template</th><th className="p-2">Language</th><th className="p-2">Status</th></tr></thead>
        <tbody>{data.templates.map((row: any) => <tr key={`${row.name}:${row.language}`}><td className="p-2 break-all">{row.name}</td><td className="p-2">{row.language}</td><td className="p-2">{row.status}</td></tr>)}</tbody>
      </table>
    </div>}
    {!!data?.messages?.length && <details><summary className="cursor-pointer text-sm font-medium">Recent message delivery</summary>
      <div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Time</th><th className="p-2">Recipient</th><th className="p-2">Status</th><th className="p-2">Detail</th></tr></thead>
        <tbody>{data.messages.map((row: any) => <tr key={row._id}><td className="p-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td><td className="p-2">{row.recipientPhone}</td><td className="p-2">{row.status}</td><td className="p-2 break-all">{row.errorReason || row.templateId}</td></tr>)}</tbody>
      </table></div>
    </details>}
  </div>;
}
