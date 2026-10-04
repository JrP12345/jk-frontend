"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import api from "@/lib/api";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";

export function RefundReconciliationAction({ appointmentId, onReconciled }: {
  appointmentId: string;
  onReconciled: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ scope: string; message: string } | null>(null);
  const scope = authScopeKey(useAuthStore(state => state.user));
  const check = async () => {
    if (loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const response = await api.post("/appointment-payments/reconcile-refund", { appointmentId });
      if (scope !== authScopeKey(useAuthStore.getState().user)) return;
      const result = response.data.data;
      setNotice({ scope, message: result.message || (result.status === "processed" ? "Refund confirmed." : "Refund needs billing review.") });
      if (result.status === "processed") onReconciled();
    } catch {
      if (scope === authScopeKey(useAuthStore.getState().user)) setNotice({ scope, message: "Could not confirm the refund. Check the provider ledger before taking further action." });
    } finally {
      setLoading(false);
    }
  };
  return <div className="max-w-64 text-left">
    <Button size="xs" variant="outline" loading={loading} onClick={check}>Check refund status</Button>
    {notice?.scope === scope && <p role="status" className="mt-1 text-xs text-text-secondary">{notice.message}</p>}
  </div>;
}
