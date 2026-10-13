"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button, Modal, Select, Checkbox } from "@/components/ui";
import type { OrganizationMember } from "@/services/organization.service";

export default function MemberLocationAccess({ organizationId, member, onClose, onSaved }: {
  organizationId: string; member: OrganizationMember; onClose: () => void; onSaved: () => void;
}) {
  const [mode, setMode] = useState<"all" | "selected">(member.locationAccess?.mode || "selected");
  const [selected, setSelected] = useState(member.locationAccess?.locationIds || []);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void api.get("/onboarding/locations", { params: { organizationId }, signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) { setLocations(response.data.data); setError(""); }
    }).catch(() => { if (!controller.signal.aborted) setError("Locations could not be loaded. Please retry."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [organizationId, retry]);
  return <Modal open onClose={onClose} busy={busy} title={`Location access · ${member.name}`} size="md"
    description="Grant only the branches needed for this member's work. Saving ends their sessions in this organization.">
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (busy || loading || conflict) return;
      setBusy(true); setError("");
      try {
        await api.patch(`/organizations/${organizationId}/members/${member.id}/location-access`, {
          mode, locationIds: mode === "all" ? [] : selected, expectedRevision: member.accessRevision || 0,
        });
        onSaved();
      } catch (failure: unknown) {
        const response = (failure as { response?: { status?: number; data?: { message?: string } } }).response;
        setConflict(response?.status === 409);
        setError(response?.data?.message || "Access could not be saved. Close and reload the member before retrying an uncertain save.");
      } finally { setBusy(false); }
    }}>
      {!member.locationAccess && <p className="text-sm text-text-muted">Location access has not been explicitly reviewed. CRM uses verified assignments until a grant is saved.</p>}
      <Select label="Access scope" value={mode} disabled={busy || conflict} onChange={event => setMode(event.target.value as "all" | "selected")}
        options={[{ value: "selected", label: "Selected locations" }, { value: "all", label: "All organization locations" }]} />
      {loading ? <p role="status">Loading locations…</p> : mode === "selected" && <fieldset disabled={busy || conflict}>
        <legend className="text-sm font-medium">Permitted locations</legend>
        {locations.map(location => <Checkbox checked={selected.includes(location.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, location.id] : ids.filter(id => id !== location.id))} label={(location.name)} key={location.id} />)}
        {!selected.length && <p className="text-sm text-text-muted">No selected locations means no branch access.</p>}
      </fieldset>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {error && !locations.length && !conflict && <Button type="button" variant="outline" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Reload locations</Button>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button>
        <Button type="submit" loading={busy} disabled={loading || conflict || Boolean(error && !locations.length)}>Save access</Button></div>
    </form>
  </Modal>;
}
