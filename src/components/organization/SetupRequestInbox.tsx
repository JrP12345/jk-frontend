"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Select, Spinner } from "@/components/ui";
import api from "@/lib/api";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";

type RequestStatus = "new" | "contacted" | "closed";
type Request = { id: string; organization: string; city: string; name: string; email: string; planName: string; status: RequestStatus; createdAt: string };
const statuses = [{ value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "closed", label: "Closed" }];

export default function SetupRequestInbox() {
  const { user } = useAuthStore();
  const allowed = user?.role === "root" && !user.impersonatedBy;
  const [status, setStatus] = useState("new");
  const [requests, setRequests] = useState<Request[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const beginRead = useLatestRead();
  const load = useCallback(async (next?: string) => {
    if (!allowed) return;
    const read = beginRead();
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams(status ? { status } : {});
      if (next) query.set("cursor", next);
      const response = await api.get(`/admin/setup-requests?${query}`, { signal: read.signal });
      if (!read.isCurrent()) return;
      const data = response.data.data;
      setRequests(previous => next ? [...previous, ...data.items] : data.items);
      setCursor(data.nextCursor);
    } catch { if (read.isCurrent()) setError("Setup requests could not be loaded. Please retry."); }
    finally { if (read.isCurrent()) setLoading(false); }
  }, [allowed, beginRead, status]);
  useEffect(() => { setRequests([]); setCursor(null); void load(); }, [load]);
  const updateStatus = async (request: Request, value: RequestStatus) => {
    if (busy) return;
    setBusy(request.id); setError(null);
    try {
      await api.patch(`/admin/setup-requests/${request.id}`, { status: value });
      await load();
    } catch { setError("Request status could not be saved. Please retry."); }
    finally { setBusy(null); }
  };
  if (!allowed) return <Alert variant="warning" title="Root access required">Sign in to your platform root account to review setup requests.</Alert>;
  return <div className="mx-auto max-w-4xl space-y-5 pb-16">
    <header><h1 className="page-title">Setup requests</h1><p className="mt-2 text-sm text-text-secondary">Practice details submitted from the website. Review requests and track your follow-up here.</p></header>
    <div className="flex flex-wrap items-end gap-3"><Select label="Request status" value={status} disabled={busy !== null} onChange={event => setStatus(event.target.value)} options={[{ value: "", label: "All requests" }, ...statuses]} /><Button variant="outline" onClick={() => void load()} disabled={loading || busy !== null}>Refresh</Button></div>
    {error && <Alert variant="error" title="Request inbox unavailable" action={<Button variant="outline" onClick={() => void load()}>Try again</Button>}>{error}</Alert>}
    {loading && <Spinner label="Loading setup requests" />}
    {!loading && !error && !requests.length && <Card><p className="text-sm text-text-muted">No {status || "setup"} requests.</p></Card>}
    <ul className="space-y-4">{requests.map(request => <li key={request.id}><Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold break-words">{request.organization}</h2><p className="text-sm text-text-secondary">{request.city}</p></div><Badge variant={request.status === "new" ? "primary" : "outline"}>{statuses.find(item => item.value === request.status)?.label}</Badge></div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-text-muted">Contact</dt><dd className="mt-1 break-words">{request.name}</dd><dd className="break-all">{request.email}</dd></div><div><dt className="text-text-muted">Requested plan</dt><dd className="mt-1">{request.planName}</dd></div></dl>
      <div className="flex flex-wrap items-end justify-between gap-3"><p className="text-xs text-text-muted">Received {new Date(request.createdAt).toLocaleString()}</p><Select label={`Status for ${request.organization}`} value={request.status} disabled={busy !== null} onChange={event => void updateStatus(request, event.target.value as RequestStatus)} options={statuses} /></div>
    </Card></li>)}</ul>
    {cursor && <Button variant="outline" onClick={() => void load(cursor)} disabled={loading || busy !== null}>Load more requests</Button>}
  </div>;
}
