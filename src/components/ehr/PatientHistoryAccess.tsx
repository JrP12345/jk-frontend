"use client";

import { useEffect, useState } from "react";
import { Button, Input, Modal, useToast, Badge } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";

export default function PatientHistoryAccess({ patientId, token, onChange }: { patientId: string; token: string | null; onChange: (token: string | null) => void }) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  useEffect(() => { onChange(null); setOpen(false); setSent(false); setOtp(""); setExpiresAt(null); }, [patientId, user?.id, user?.organization_id]);
  useEffect(() => {
    if (!expiresAt) return;
    const timeout = setTimeout(() => { onChange(null); setExpiresAt(null); toast({ title: "Full-history approval expired", description: "Showing this organization's records.", variant: "info" }); }, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [expiresAt, onChange, toast]);
  if (!user || ["patient", "family_member", "guest"].includes(user.role) || !hasAnyPermission(user, "VIEW_EHR")) return null;
  const request = async () => {
    setBusy(true);
    try { const result = await api.post(`/patients/${patientId}/record-access/request`); setSent(true); toast({ title: "Patient approval requested", description: result.data.message, variant: "info" }); }
    catch (error: any) { toast({ title: "Could not request approval", description: error.response?.data?.message || "Please try again.", variant: "error" }); }
    finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      const result = await api.post(`/patients/${patientId}/record-access/verify`, { otp });
      onChange(result.data.data.token); setExpiresAt(new Date(result.data.data.expiresAt).getTime()); setOpen(false); setOtp("");
      toast({ title: "Full history approved", description: "Patient-approved access lasts 10 minutes.", variant: "success" });
    } catch (error: any) { toast({ title: "Approval failed", description: error.response?.data?.message || "Please check the OTP.", variant: "error" }); }
    finally { setBusy(false); }
  };
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-surface">
      <div><Badge variant={token ? "success" : "neutral"}>{token ? "Patient-approved full history" : "Organization records only"}</Badge><p className="text-xs text-text-muted mt-1">Records from other organizations require the patient's approval.</p></div>
      <Button size="sm" variant="outline" onClick={() => { if (token) { onChange(null); setExpiresAt(null); } else { setSent(false); setOtp(""); setOpen(true); } }}>{token ? "Use organization records" : "Request full history"}</Button>
    </div>
    <Modal open={open} onClose={() => setOpen(false)} title="Patient approval for full history" size="sm">
      <form onSubmit={verify} className="space-y-4">
        <p className="text-sm text-text-secondary">Send an OTP to the patient's registered phone or email. Ask the patient to share it only if they agree to let you view records from other organizations.</p>
        {sent && <Input label="Patient approval OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} />}
        <div className="flex flex-col sm:flex-row gap-2"><Button variant="outline" loading={busy && !sent} disabled={busy} onClick={request}>{sent ? "Resend OTP" : "Send OTP to patient"}</Button>{sent && <Button type="submit" loading={busy} disabled={busy || otp.length !== 6}>Verify and view history</Button>}</div>
      </form>
    </Modal>
  </>;
}
