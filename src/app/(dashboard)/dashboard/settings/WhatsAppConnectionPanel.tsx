"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button, Input, Toggle, Badge, useToast, InlineLoader, Table } from "@/components/ui";
import { ChevronDown } from "lucide-react";
import styles from "./WhatsAppConnectionPanel.module.css";

export default function WhatsAppConnectionPanel({ organizationId, isRoot, mode, scope = "organization" }: { organizationId?: string; isRoot: boolean; mode: string; scope?: "organization" | "platform" }) {
  const { user } = useAuthStore();
  const platform = scope === "platform" && isRoot && user?.role === "root";
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
    enabled: mode !== "disabled" && (scope !== "platform" || platform) && (platform || !!organizationId || !!user?.organization_id), refetchInterval: 15_000 });
  const mutation = useMutation({ mutationFn: async (action: string) => {
    if (scope === "platform" && !platform) throw new Error("Platform messaging requires Root");
    if (health.isPending || health.isError || !health.data) throw new Error("Load the saved connection before making changes");
    if (action === "save") return api.patch(base, { enabled: enabled ?? health.data?.connection.enabled ?? false,
      wabaId: wabaId.trim() || undefined, phoneNumberId: phoneNumberId.trim() || undefined, accessToken: accessToken.trim() || undefined, appSecret: appSecret.trim() || undefined });
    return api.post(`${base}/${action}`, {}, { params });
  }, onSuccess: (result) => {
    setAccessToken(""); setAppSecret("");
    queryClient.invalidateQueries({ queryKey: ["whatsapp-health"] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
    toast({ title: "WhatsApp setup updated", description: result.data.message || "Credentials saved securely", variant: "success" });
  }, onError: (error: any) => toast({ title: "WhatsApp setup failed", description: error.response?.data?.message || "Please try again", variant: "error" }) });
  if (mode === "disabled" || (scope === "platform" && !platform)) return null;
  const data = health.data;
  const unavailable = health.isPending || health.isError || !data;
  const busy = mutation.isPending || unavailable;
  return <div className={platform ? styles.platformConnection : styles.connection}>
    <div className={styles.statusHeader}>
      <h3>{platform ? "Connection status" : "Connection and delivery"}</h3>
      <Badge variant={!unavailable && data?.connection?.connectionStatus === "connected" ? "success" : "outline"} className={styles.statusBadge}>{health.isPending ? "Loading" : health.isError ? "Unavailable" : data?.connection?.connectionStatus?.replace(/_/g, " ") || "Not connected"}</Badge>
    </div>
    {health.isLoading && <InlineLoader label="Loading connection details" />}
    {health.isError && <div className={styles.recovery}><p>Could not load connection details.</p><Button size="sm" variant="outline" onClick={() => health.refetch()}>Retry</Button></div>}
    {platform && <form className={styles.section} onSubmit={event => { event.preventDefault(); mutation.mutate("save"); }}>
      <fieldset disabled={busy} className={styles.credentials}>
        <legend>Sender credentials</legend>
        <p className={styles.hint}>Root controls the shared sender. Leave credential fields blank to keep saved values.</p>
      <div className={styles.fieldGrid}>
        <Input label="Platform WABA ID" value={wabaId} placeholder={data?.connection.wabaId || "Business account ID"} onChange={e => setWabaId(e.target.value)} />
        <Input label="Platform phone number ID" value={phoneNumberId} placeholder={data?.connection.phoneNumberId || "Phone number ID"} onChange={e => setPhoneNumberId(e.target.value)} type="tel" inputMode="tel" />
        <Input label="System user access token" type="password" autoComplete="new-password" value={accessToken} placeholder={data?.connection.hasToken ? "Saved — leave blank to keep" : "Paste access token"} onChange={e => setAccessToken(e.target.value)} />
        <Input label="Meta app secret" type="password" autoComplete="new-password" value={appSecret} placeholder={data?.connection.hasAppSecret ? "Saved — leave blank to keep" : "Paste app secret"} onChange={e => setAppSecret(e.target.value)} />
      </div>
      <div className={styles.gatewayToggle}><Toggle checked={enabled ?? data?.connection.enabled ?? false} onChange={setEnabled} label="Enable shared gateway" disabled={busy} /></div>
      </fieldset>
      <div className={styles.saveAction}><Button type="submit" disabled={busy} loading={mutation.isPending && mutation.variables === "save"}>Save platform credentials</Button></div>
    </form>}
    {(platform || mode === "dedicated") && <>
      <details className={styles.disclosure}>
        <summary><span>Webhook setup</span><ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
        <div className={styles.disclosureBody}>
          <p className={styles.hint}>Save credentials, then add this HTTPS callback in Meta. Subscribe to messages and template updates.</p>
      <div className={styles.fieldGrid}>
        <Input label="Meta webhook callback URL" readOnly value={data?.connection.webhookUrl || ""} />
        <Input label="Webhook verify token" readOnly value={unavailable ? "" : data?.connection.verifyToken || "Save credentials to generate"} />
      </div>
        </div>
      </details>
      <div className={styles.section}>
        <h3>Connection checks</h3><p className={styles.hint}>After saving, test the sender and refresh approved templates.</p>
      <div className={styles.actions}>
        <Button variant="outline" disabled={busy} loading={mutation.isPending && mutation.variables === "test"} onClick={() => mutation.mutate("test")}>Test connection</Button>
        <Button variant="outline" disabled={busy} loading={mutation.isPending && mutation.variables === "templates/sync"} onClick={() => mutation.mutate("templates/sync")}>Sync templates</Button>
      </div>
      </div>
    </>}
    {!!data?.issues?.length && <ul className={styles.issues}>{data.issues.map((issue: string) => <li key={issue}>{issue}</li>)}</ul>}
    <dl className={styles.deliverySummary} aria-label="WhatsApp delivery summary" aria-busy={health.isPending}>
      <div><dt>Queued</dt><dd>{unavailable ? "\u2014" : data?.pending ?? 0}</dd></div>
      {(data?.today || []).map((row: any) => <div key={row._id}><dt>Today {row._id}</dt><dd>{unavailable ? "\u2014" : row.count}</dd></div>)}
      <div><dt>Last webhook</dt><dd>{unavailable ? "\u2014" : data?.lastWebhookAt ? new Date(data.lastWebhookAt).toLocaleString() : "None yet"}</dd></div>
    </dl>
    {!!data?.templates?.length && <section className={styles.section} aria-label="Message templates">
      <div className={styles.sectionHeading}><h3>Message templates</h3><span>{data.templates.length} templates</span></div>
      <div className={styles.records}>
      <Table className={styles.dataTable} caption="WhatsApp templates" density="compact" variant="flat" fitContent
        searchable={false} showColumnVisibility={false} pagination={false}
        data={data.templates.map((row: any) => ({ ...row, id: `${row.name}:${row.language}` }))}
        columns={[
          { header: "Template", width: "55%", render: row => <span>{row.name}</span> },
          { header: "Language", accessor: "language", width: "20%" }, { header: "Status", accessor: "status", width: "25%" },
        ]}
        renderMobileCard={row => <article className={styles.record}><h4>{row.name}</h4><dl><div><dt>Language</dt><dd>{row.language}</dd></div><div><dt>Status</dt><dd>{row.status}</dd></div></dl></article>}
      />
      </div>
    </section>}
    {!!data?.messages?.length && <details className={styles.disclosure}>
      <summary><span>Recent message delivery</span><ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
      <div className={styles.records}><Table className={styles.dataTable} caption="Recent WhatsApp message delivery" density="compact" variant="flat" fitContent
        searchable={false} showColumnVisibility={false} pagination={false}
        keyField="_id" data={data.messages}
        columns={[
          { header: "Time", width: "23%", render: row => <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time> },
          { header: "Recipient", accessor: "recipientPhone", width: "23%" }, { header: "Status", accessor: "status", width: "19%" },
          { header: "Detail", width: "35%", render: row => <span>{row.errorReason || row.templateId}</span> },
        ]}
        renderMobileCard={row => <article className={styles.record}><h4>{row.recipientPhone}</h4><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time><dl><div><dt>Status</dt><dd>{row.status}</dd></div><div><dt>Detail</dt><dd>{row.errorReason || row.templateId || "\u2014"}</dd></div></dl></article>}
      /></div>
    </details>}
  </div>;
}
