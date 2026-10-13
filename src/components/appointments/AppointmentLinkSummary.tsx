"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { useLatestRead } from "@/hooks/useLatestRead";
import { Alert, Button, Card, CardContent } from "@/components/ui";

interface Summary { id: string; status: string; paymentStatus: string; tokenNumber: number; appointmentTime: string; locationName: string; doctorName: string }
export function AppointmentLinkSummary() {
  const id = useSearchParams().get("appointmentId");
  const [summary, setSummary] = useState<Summary | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const request = beginRead(); setSummary(null); setError("");
    if (!id) return;
    if (!/^[a-fA-F0-9]{24}$/.test(id)) { setError("The booking reference is invalid."); return; }
    setLoading(true);
    try { const response = await api.get(`/appointments/${id}`, { params: { view: "administrative" }, signal: request.signal }); if (request.isCurrent()) setSummary(response.data.data); }
    catch { if (request.isCurrent()) setError("This booking could not be loaded in the current workspace. Reload or check your access."); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [id, beginRead]);
  useEffect(() => { void load(); }, [load]);
  if (!id) return null;
  return <Card><CardContent className="space-y-3"><h2 className="font-semibold">Linked booking</h2>{loading && <p role="status">Loading booking...</p>}{error && <Alert variant="error">{error}</Alert>}
    {summary && <><p>{summary.locationName} · Dr. {summary.doctorName} · Token #{summary.tokenNumber}</p><p>Booking: {summary.status.replaceAll("_", " ")}. Payment: {summary.paymentStatus.replaceAll("_", " ")}.</p><p>{new Date(summary.appointmentTime).toLocaleString()}</p>{summary.status === "pending_payment" && <Alert variant="warning">Payment is still required before confirmation. Continue through the existing payment workflow.</Alert>}</>}
    <Button variant="outline" loading={loading} onClick={load}>Reload linked booking</Button></CardContent></Card>;
}
