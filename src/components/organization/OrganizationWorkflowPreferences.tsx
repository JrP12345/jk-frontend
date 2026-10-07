"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Select, Spinner, useToast } from "@/components/ui";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import { organizationPath } from "@/services/organization.service";

export function OrganizationWorkflowPreferences({ organizationId }: { organizationId: string }) {
  const { preferences, loading, error, reload } = useWorkflowPreferences(organizationId);
  const [registration, setRegistration] = useState(preferences.registration);
  const [consultation, setConsultation] = useState(preferences.consultation);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => { setRegistration(preferences.registration); setConsultation(preferences.consultation); }, [preferences]);
  async function save() {
    setSaving(true);
    try {
      await api.put(organizationPath("/onboarding/organization/me", organizationId), { workflowPreferences: { registration, consultation } });
      await reload();
      toast({ title: "Workflow preferences saved", variant: "success" });
    } catch { toast({ title: "Preferences could not be saved", variant: "error" }); }
    finally { setSaving(false); }
  }
  return <Card><CardHeader><CardTitle as="h2">Everyday workflow</CardTitle><p className="text-sm text-text-muted">Choose the usual starting point. Full registration, clinical documentation and billing stay available.</p></CardHeader><CardContent className="space-y-4">
    {loading ? <Spinner label="Loading workflow preferences" /> : error ? <Alert variant="error" action={<Button onClick={reload}>Retry</Button>}>Preferences could not be loaded.</Alert> : <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Patient entry" value={registration} onChange={e => setRegistration(e.target.value as typeof registration)} options={[{ value: "full", label: "Full registration (current default)" }, { value: "essential", label: "Essential details — search, name and contact" }]} />
        <Select label="Consultation starting view" value={consultation} onChange={e => setConsultation(e.target.value as typeof consultation)} options={[{ value: "full", label: "Full clinical workspace (current default)" }, { value: "focused", label: "Focused visit — optional notes and medicine" }]} />
      </div>
      <p className="text-xs text-text-muted">Focused visits can finish without a SOAP note. Saved clinical drafts must still be signed in the full editor. Fee, invoice, payment and permission rules stay in effect.</p>
      <Button onClick={save} loading={saving} disabled={saving || (registration === preferences.registration && consultation === preferences.consultation)}>Save preferences</Button>
    </>}
  </CardContent></Card>;
}
