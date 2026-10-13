"use client";

import { useState } from "react";
import { Button, Modal, Select } from "@/components/ui";
import api from "@/lib/api";
import type { User } from "@/store/authStore";
import type { WorkspaceSelection } from "@/types/workspace";

export default function LoginWorkspacePicker({ selection, onSuccess, onCancel }: {
  selection: WorkspaceSelection; onSuccess: (user: User) => void; onCancel: () => void;
}) {
  const [organizationId, setOrganizationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  return <Modal open onClose={onCancel} busy={busy} size="sm" title="Choose your workspace"
    description="Select the organization you are working with. Each workspace has its own access and patient records.">
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (busy || expired || !selection.workspaces.some(workspace => workspace.organizationId === organizationId)) return;
      setBusy(true); setError("");
      try {
        const response = await api.post("/auth/login/workspace", { workspaceToken: selection.workspaceToken, organizationId });
        const user = response.data?.data?.user;
        if (!user?.id) throw new Error("Sign-in did not return an account. Please sign in again.");
        onSuccess(user);
      } catch (failure: unknown) {
        const response = (failure as { response?: { status: number; data?: { message?: string } } }).response;
        setExpired(response?.status === 401 || response?.status === 503);
        setError(response?.data?.message || "Could not select this workspace. Please try again or sign in again.");
      } finally { setBusy(false); }
    }}>
      <Select label="Organization" value={organizationId} placeholder="Choose an organization" disabled={busy || expired}
        options={selection.workspaces.map(workspace => ({ value: workspace.organizationId, label: `${workspace.name} · ${workspace.role}` }))}
        onChange={event => setOrganizationId(event.target.value)} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" fullWidth loading={busy} disabled={!organizationId || expired}>Open workspace</Button>
      <Button type="button" variant="outline" fullWidth disabled={busy} onClick={onCancel}>Back to sign in</Button>
    </form>
  </Modal>;
}
