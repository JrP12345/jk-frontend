"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Alert, Button, Input, Modal, Select, useToast } from "@/components/ui";
import { authScopeKey } from "@/lib/authScope";
import { useAuthStore } from "@/store/authStore";
import { organizationPath } from "@/services/organization.service";

/** Use the existing acceptance workflow for both new and existing identities. */
export function InviteOrganizationMember({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("nurse");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuthStore();
  const context = `${organizationId}:${authScopeKey(user)}`;
  const currentContext = useRef(context);
  useEffect(() => { currentContext.current = context; return () => { currentContext.current = ""; }; }, [context]);
  const { toast } = useToast();

  return <Modal open onClose={() => { if (!busy) onClose(); }} title="Invite organization member" description="Use their existing account or let them create one when accepting the invitation." size="md" busy={busy} footer={<Button type="submit" form="invite-organization-member" loading={busy}>Send invitation</Button>}>
    <form id="invite-organization-member" className="space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      const submittedContext = context;
      setBusy(true); setError("");
      try {
        await api.post(organizationPath("/onboarding/invitations", organizationId), { email: email.trim().toLowerCase(), role });
        if (currentContext.current !== submittedContext || authScopeKey(useAuthStore.getState().user) !== authScopeKey(user)) return;
        toast({ title: "Invitation queued", description: "The email link expires in 48 hours. Membership appears after acceptance.", variant: "success" });
        onClose();
      } catch (err: unknown) {
        if (currentContext.current === submittedContext) setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || "Invitation could not be sent. Please retry.");
      } finally { if (currentContext.current === submittedContext) setBusy(false); }
    }}>
      {error && <Alert variant="error" title="Invitation failed">{error}</Alert>}
      <Input label="Email" type="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
      <Select label="Role" value={role} onChange={event => setRole(event.target.value)} disabled={busy} options={["admin", "doctor", "receptionist", "nurse", "lab_tech", "pharmacist", "cashier"].map(value => ({ value, label: value.replaceAll("_", " ") }))} />
      <p className="text-sm text-text-muted">The member chooses whether to join. For a doctor or receptionist, complete their clinical profile and location assignments after acceptance.</p>
    </form>
  </Modal>;
}
