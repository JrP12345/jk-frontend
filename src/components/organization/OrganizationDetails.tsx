"use client";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button, Input, ImageUpload, ScheduleEditor, Alert, useToast, Textarea } from "@/components/ui";
import { organizationImageUrl, saveWithBranding, type OrganizationRecord } from "@/services/organization.service";
import styles from "./OrganizationDetails.module.css";

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
  const preview = (value: ImageValue) => {
    if (value instanceof File) return value;
    return organizationImageUrl(value) || null;
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
        ...(root ? { maxLocations: form.maxLocations, maxDoctors: form.maxDoctors, maxStaff: form.maxStaff } : {}),
      }));
      onSaved({ ...organization, ...response.data.data });
      toast({ title: "Organization saved", description: "Details and branding are saved.", variant: "success" });
    } catch (err: unknown) { setError((err as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message || (err as Error).message || "Could not save organization"); }
    finally { setSaving(false); }
  }
  const field = (key: keyof OrganizationRecord, label: string, type = "text", required = false) => <Input label={label} type={type} required={required} value={String(form[key] || "")} onChange={(event) => setForm({ ...form, [key]: event.target.value })} disabled={saving} />;
  return <form onSubmit={save} className={styles.form} aria-label="Organization details">
    <header className={styles.formHeader}><h2 className="text-base font-semibold">Details &amp; branding</h2><Button type="submit" size="sm" loading={saving} disabled={saving}>Save changes</Button></header>
    {error && <Alert variant="error" title="Could not save">{error}</Alert>}
    <div className={styles.columns}>
    <section className={styles.panel} aria-labelledby="organization-profile-heading">
      <h3 id="organization-profile-heading" className={styles.panelTitle}>Organization profile</h3>
      <fieldset disabled={saving} className={styles.controls} aria-label="Organization profile">
      {field("name", "Organization name", "text", true)}
      <div className={styles.fields}>{field("city", "City", "text", true)}{field("timezone", "Operating timezone")}{field("email", "Contact email", "email")}{field("phone", "Contact phone", "tel")}</div>
      {field("address", "Address")}
      <Textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} label="Description" />
      </fieldset>
    </section>
    <section className={styles.panel} aria-labelledby="organization-branding-heading">
      <h3 id="organization-branding-heading" className={styles.panelTitle}>Branding</h3>
      <fieldset disabled={saving} className={styles.controls} aria-label="Organization branding">
      <p className="text-xs leading-relaxed text-text-secondary">Logo and cover appear on your public pages. PNG, JPEG or WebP, up to 5 MB.</p>
      <div className={styles.uploads}><ImageUpload className={`${styles.upload} ${styles.logo}`} label="Organization logo" helperText="" value={preview(logo)} onChange={setLogo} disabled={saving} /><ImageUpload className={styles.upload} label="Cover photo" helperText="" value={preview(cover)} onChange={setCover} disabled={saving} /></div>
      <details className={styles.disclosure}><summary className={styles.disclosureSummary}><span>Gallery ({gallery.length} {gallery.length === 1 ? "photo" : "photos"})</span><ChevronDown className="h-4 w-4 shrink-0" /></summary><div className={`${styles.disclosureBody} ${styles.gallery}`}>{gallery.map((value, index) => <ImageUpload className={styles.upload} key={index} label={`Photo ${index + 1}`} helperText="" value={preview(value)} onChange={(next) => setGallery((items) => next ? items.map((item, i) => i === index ? next : item) : items.filter((_, i) => i !== index))} disabled={saving} />)}<ImageUpload className={styles.upload} label="Add a photo" helperText="" value={null} onChange={(value) => { if (value) setGallery((items) => [...items, value]); }} disabled={saving} /></div></details>
      </fieldset>
    </section>
    </div>
    <section className={styles.panel} aria-labelledby="organization-additional-settings-heading">
      <h3 id="organization-additional-settings-heading" className={styles.panelTitle}>Additional settings</h3>
      <fieldset disabled={saving} className="min-w-0" aria-label="Additional organization settings">
      <details className={styles.disclosure}><summary className={styles.disclosureSummary}><span>Legal information</span><ChevronDown className="h-4 w-4 shrink-0" /></summary><div className={`${styles.disclosureBody} ${styles.fields}`}>{field("taxId", "Tax ID / GSTIN")}{field("licenseNumber", "License number")}<p className={`${styles.fullWidth} text-xs leading-relaxed text-text-secondary [overflow-wrap:anywhere]`}>Country: {form.countryCode || "Not configured"} · Currency: {form.currency || "INR"}. Changing legal country requires a reviewed migration.</p></div></details>
      <details className={styles.disclosure}><summary className={styles.disclosureSummary}><span>Organization opening hours</span><ChevronDown className="h-4 w-4 shrink-0" /></summary><div className={styles.disclosureBody}><ScheduleEditor label="Opening hours" value={form.timings || ""} onChange={(timings) => setForm({ ...form, timings })} /></div></details>
      {root && <details className={styles.disclosure}><summary className={styles.disclosureSummary}><span>Platform quota overrides</span><ChevronDown className="h-4 w-4 shrink-0" /></summary><div className={styles.disclosureBody}><p className="text-xs leading-relaxed text-text-secondary">Root can adjust capacity for this organization. Plan changes in Billing may replace these limits.</p><div className={styles.fields}>{(["maxLocations", "maxDoctors", "maxStaff"] as const).map((key) => <Input key={key} label={key === "maxLocations" ? "Location limit" : key === "maxDoctors" ? "Doctor limit" : "Staff limit"} type="number" min={1} step={1} value={form[key] ?? ""} disabled={saving} onChange={(event) => setForm({ ...form, [key]: event.target.value ? Number(event.target.value) : undefined })} />)}</div></div></details>}
      </fieldset>
    </section>
    <footer className={styles.saveBar}><p className="text-xs text-text-secondary">Changes apply to this organization.</p><Button type="submit" aria-label="Save changes to organization details" loading={saving} disabled={saving}>Save changes</Button></footer>
  </form>;
}
