"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Select, useToast, LoadingState, SkeletonForm } from "@/components/ui";
import { useWorkflowPreferences } from "@/hooks/useWorkflowPreferences";
import { organizationPath } from "@/services/organization.service";
import { announcePatientToken, CHIME_OPTIONS, type ChimeType, type VoiceAnnounceLanguage } from "@/utils/audioChimes";

export function OrganizationWorkflowPreferences({ organizationId }: { organizationId: string }) {
  const { preferences, loading, error, reload } = useWorkflowPreferences(organizationId);
  const [registration, setRegistration] = useState(preferences.registration);
  const [consultation, setConsultation] = useState(preferences.consultation);
  const [queueChime, setQueueChime] = useState<ChimeType>(preferences.queueChime || "bell");
  const [queueVoiceLanguage, setQueueVoiceLanguage] = useState<VoiceAnnounceLanguage>(preferences.queueVoiceLanguage || "en");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    setRegistration(preferences.registration);
    setConsultation(preferences.consultation);
    setQueueChime(preferences.queueChime || "bell");
    setQueueVoiceLanguage(preferences.queueVoiceLanguage || "en");
  }, [preferences]);
  const changes = Object.fromEntries(Object.entries({ registration, consultation, queueChime, queueVoiceLanguage })
    .filter(([key, value]) => value !== (preferences[key as keyof typeof preferences] ?? (key === "queueChime" ? "bell" : "en"))));
  async function save() {
    setSaving(true);
    try {
      await api.put(organizationPath("/onboarding/organization/me", organizationId), { workflowPreferences: changes });
      await reload();
      toast({ title: "Workflow preferences saved", variant: "success" });
    } catch { toast({ title: "Preferences could not be saved", variant: "error" }); }
    finally { setSaving(false); }
  }
  return <Card><CardHeader><CardTitle as="h2">Everyday workflow</CardTitle><p className="text-sm text-text-muted">Choose the usual starting point. Full registration, clinical documentation and billing stay available.</p></CardHeader><CardContent className="space-y-4">
    {loading ? <LoadingState label="Loading workflow preferences"><SkeletonForm fields={2} /></LoadingState> : error ? <Alert variant="error" action={<Button onClick={reload}>Retry</Button>}>Preferences could not be loaded.</Alert> : <>
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
        <Select label="Patient entry" value={registration} onChange={e => setRegistration(e.target.value as typeof registration)} options={[{ value: "full", label: "Full registration (current default)" }, { value: "essential", label: "Essential details — search, name and contact" }]} />
        <Select label="Consultation starting view" value={consultation} onChange={e => setConsultation(e.target.value as typeof consultation)} options={[{ value: "full", label: "Full clinical workspace (current default)" }, { value: "focused", label: "Focused visit — optional notes and medicine" }]} />
      </div>
      <p className="text-xs text-text-muted">Focused visits can finish without a SOAP note. Saved clinical drafts must still be signed in the full editor. Fee, invoice, payment and permission rules stay in effect.</p>
      <section className="space-y-3 border-t border-border pt-4" aria-labelledby="queue-announcements-heading">
        <div><h3 id="queue-announcements-heading" className="text-sm font-semibold">Queue announcements</h3><p className="mt-1 text-xs leading-relaxed text-text-secondary">Bell and spoken language for staff calling patients from the queue. Saved for all staff and locations in this organization.</p></div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
          <Select label="Bell sound" value={queueChime} disabled={saving} onChange={event => setQueueChime(event.target.value as ChimeType)} options={CHIME_OPTIONS.map(option => ({ value: option.id, label: option.label }))} />
          <Select label="Announcement language" value={queueVoiceLanguage} disabled={saving} onChange={event => setQueueVoiceLanguage(event.target.value as VoiceAnnounceLanguage)} options={[{ value: "off", label: "Voice off" }, { value: "en", label: "English" }, { value: "hi", label: "Hindi" }, { value: "both", label: "English and Hindi" }]} />
        </div>
        <Button variant="outline" size="sm" disabled={saving || (queueChime === "mute" && queueVoiceLanguage === "off")} onClick={() => announcePatientToken({ tokenNumber: 1, language: queueVoiceLanguage, chimeType: queueChime })}>Preview announcement</Button>
        <p className="text-xs text-text-muted">Preview plays a sample token on this device.</p>
      </section>
      <Button onClick={save} loading={saving} disabled={saving || Object.keys(changes).length === 0}>Save preferences</Button>
    </>}
  </CardContent></Card>;
}
