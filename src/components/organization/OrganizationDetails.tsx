"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button, Input, ImageUpload, ScheduleEditor, Alert, useToast } from "@/components/ui";
import { organizationImageUrl, saveWithBranding, type OrganizationRecord } from "@/services/organization.service";

type ImageValue = File | string | null;
export function OrganizationDetails({ organization, onSaved }: { organization: OrganizationRecord; onSaved: (org: OrganizationRecord) => void }) {
  const root = useAuthStore((state) => state.user?.role === "root");
  const [form, setForm] = useState(organization);
  const [logo, setLogo] = useState<ImageValue>(organization.logo_url || null);
  const [cover, setCover] = useState<ImageValue>(organization.image_url || null);
  const [gallery, setGallery] = useState<ImageValue[]>(organization.images || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  useEffect(() => { setForm(organization); setLogo(organization.logo_url || null); setCover(organization.image_url || null); setGallery(organization.images || []); setError(""); }, [organization]);
  const preview = (value: ImageValue, slot: string | number) => {
    if (value instanceof File) return value;
    const persistedSlot = typeof slot === "number" && value ? organization.images?.indexOf(value) : slot;
    return organizationImageUrl(value, organization.id, persistedSlot === undefined || persistedSlot === -1 ? slot : persistedSlot) || null;
  };
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!form.name.trim() || !form.city.trim() || /^[0-9+\s-]{6,}$/.test(form.city.trim())) { setError("Enter an organization name and a valid city."); return; }
    setSaving(true);
    try {
      const response = await saveWithBranding([logo, cover, ...gallery], organization.id, ([logo_url, image_url, ...images]) => api.put(`/organizations/${organization.id}`, {
        name: form.name.trim(), city: form.city.trim(), address: form.address || null, phone: form.phone || null,
        email: form.email || null, description: form.description || null, taxId: form.taxId || null,
        licenseNumber: form.licenseNumber || null, timezone: form.timezone || undefined,
        logo_url, image_url, images: images.filter(Boolean), timings: form.timings || null, working_days: form.working_days || null,
        ...(root ? { maxClinics: form.maxClinics, maxDoctors: form.maxDoctors, maxStaff: form.maxStaff } : {}),
      }));
      onSaved({ ...organization, ...response.data.data });
      toast({ title: "Organization saved", description: "Details and branding are saved.", variant: "success" });
    } catch (err: unknown) { setError((err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (err as Error).message || "Could not save organization"); }
    finally { setSaving(false); }
  }
  const field = (key: keyof OrganizationRecord, label: string, type = "text", required = false) => <Input label={label} type={type} required={required} value={String(form[key] || "")} onChange={(event) => setForm({ ...form, [key]: event.target.value })} disabled={saving} />;
  return <form onSubmit={save} className="space-y-6 max-w-4xl" aria-label="Organization details">
    {error && <Alert variant="error" title="Could not save">{error}</Alert>}
    <fieldset disabled={saving} className="space-y-4">
      <legend className="text-base font-semibold mb-3">Organization details</legend>
      <div className="grid gap-4 sm:grid-cols-2">{field("name", "Organization name", "text", true)}{field("city", "City", "text", true)}{field("email", "Contact email", "email")}{field("phone", "Contact phone", "tel")}{field("address", "Address")}{field("timezone", "Operating timezone")}</div>
      <label className="block text-sm font-medium">Description<textarea className="mt-2 block w-full rounded-xl border border-border p-3 bg-surface text-text" rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <details className="border-t border-border pt-3"><summary className="cursor-pointer py-2 text-sm font-medium">Legal information</summary><div className="grid gap-4 sm:grid-cols-2 pt-3">{field("taxId", "Tax ID / GSTIN")}{field("licenseNumber", "License number")}<p className="text-sm text-text-muted sm:col-span-2">Country: {form.countryCode || "Not configured"} · Currency: {form.currency || "INR"}. Changing legal country requires a reviewed migration.</p></div></details>
    </fieldset>
    <fieldset disabled={saving} className="space-y-4 border-t border-border pt-5">
      <legend className="text-base font-semibold">Branding</legend>
      <p className="text-sm text-text-muted">Logo and cover appear on organization and public clinic pages. PNG, JPEG or WebP, up to 5 MB.</p>
      <div className="grid gap-4 sm:grid-cols-2"><ImageUpload label="Organization logo" value={preview(logo, "logo_url")} onChange={setLogo} disabled={saving} /><ImageUpload label="Cover photo" value={preview(cover, "image_url")} onChange={setCover} disabled={saving} /></div>
      <details><summary className="cursor-pointer py-2 text-sm font-medium">Gallery ({gallery.length} photos)</summary><div className="grid gap-4 sm:grid-cols-3 pt-3">{gallery.map((value, index) => <ImageUpload key={index} label={`Photo ${index + 1}`} value={preview(value, index)} onChange={(next) => setGallery((items) => next ? items.map((item, i) => i === index ? next : item) : items.filter((_, i) => i !== index))} disabled={saving} />)}<ImageUpload label="Add a photo" value={null} onChange={(value) => { if (value) setGallery((items) => [...items, value]); }} disabled={saving} /></div></details>
    </fieldset>
    <details className="border-t border-border pt-3"><summary className="cursor-pointer py-2 text-sm font-medium">Organization opening hours</summary><div className="pt-3"><ScheduleEditor label="Opening hours" value={form.timings || ""} onChange={(timings) => setForm({ ...form, timings })} /></div></details>
    {root && <details className="border-t border-border pt-3"><summary className="cursor-pointer py-2 text-sm font-medium">Platform quota overrides</summary><p className="text-sm text-text-muted py-3">Root can adjust capacity for this organization. Plan changes in Billing may replace these limits.</p><div className="grid gap-4 sm:grid-cols-3">{(["maxClinics", "maxDoctors", "maxStaff"] as const).map((key) => <Input key={key} label={key === "maxClinics" ? "Location limit" : key === "maxDoctors" ? "Doctor limit" : "Staff limit"} type="number" min={1} step={1} value={form[key] ?? ""} disabled={saving} onChange={(event) => setForm({ ...form, [key]: event.target.value ? Number(event.target.value) : undefined })} />)}</div></details>}
    <div className="border-t border-border pt-4 flex justify-end"><Button type="submit" loading={saving} disabled={saving}>Save changes</Button></div>
  </form>;
}
