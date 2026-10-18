"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import styles from "./OrganizationSections.module.css";
import api from "@/lib/api";
import type { LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, LoadingState, Select } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useAuthStore } from "@/store/authStore";
import { authScopeKey } from "@/lib/authScope";
import { hasAnyPermission } from "@/lib/permissions";
import { validSingleChoice } from "@/lib/locationWorkflow";
import { locationPath, doctorPath } from "@/lib/publicPaths";
import { getPublicBookingStatus } from "@/lib/publicBooking";
import { publicBookingChecklist } from "@/lib/publicBookingSetup";
import { organizationPath } from "@/services/organization.service";

interface SetupLocation { id: string; slug?: string; name: string; isActive?: boolean; isPublished?: boolean }

export function OrganizationBookingSetup({ organizationId, onNavigate }: { organizationId: string; onNavigate: (section: string) => void }) {
  const { user } = useAuthStore();
  const scope = authScopeKey(user);
  const canRead = hasAnyPermission(user, "VIEW_LOCATIONS", "MANAGE_LOCATIONS");
  const [locations, setLocations] = useState<SetupLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const [checking, setChecking] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [retry, setRetry] = useState(0);
  const beginLocationsRead = useLatestRead();
  const beginPublicRead = useLatestRead();
  const selected = locations.find(location => location.id === locationId);
  const publicDetail = detail?.id === selected?.id ? detail : null;

  const load = useCallback(async () => {
    if (!canRead) { setLoading(false); return; }
    const request = beginLocationsRead();
    setLoading(true); setError(""); setDetail(null);
    try {
      const response = await api.get(organizationPath("/onboarding/locations", organizationId), { signal: request.signal });
      if (!request.isCurrent() || authScopeKey(useAuthStore.getState().user) !== scope) return;
      const list: SetupLocation[] = response.data?.data;
      if (!Array.isArray(list)) throw new Error("Incomplete location response");
      const active = list.filter(location => location.isActive !== false);
      setLocations(active);
      setLocationId(previous => validSingleChoice(active, location => location.id, previous));
      setRetry(value => value + 1);
    } catch { if (request.isCurrent()) setError("Setup status could not be loaded. Please retry."); }
    finally { if (request.isCurrent()) setLoading(false); }
  }, [canRead, organizationId, scope, beginLocationsRead]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const request = beginPublicRead();
    setDetail(null); setDetailError("");
    if (!selected?.slug || selected.isPublished === false || loading) { setChecking(false); return; }
    setChecking(true);
    api.get(`/public/locations/${encodeURIComponent(selected.slug)}`, { signal: request.signal }).then(response => {
      if (!request.isCurrent() || authScopeKey(useAuthStore.getState().user) !== scope) return;
      const data: LocationDetail = response.data?.data;
      if (data?.id !== selected.id || data.organization?.id !== organizationId || !Array.isArray(data.doctors)) throw new Error("Incomplete public response");
      setDetail(data);
    }).catch(() => { if (request.isCurrent()) setDetailError("The public page could not be checked. Please retry; setup has not been marked complete."); }).finally(() => { if (request.isCurrent()) setChecking(false); });
    return () => { beginPublicRead(); };
  }, [selected?.id, selected?.slug, selected?.isPublished, organizationId, scope, loading, retry, beginPublicRead]);

  if (!canRead) return null;
  const status = publicDetail ? getPublicBookingStatus({ ...publicDetail, doctorCount: publicDetail.doctors.length }) : null;
  const checklist = publicDetail ? publicBookingChecklist(publicDetail) : [];
  return <Card><CardHeader><div className={styles.sectionHeader}><CardTitle as="h2">Public booking setup</CardTitle><Button variant="outline" size="sm" className={styles.iconAction} aria-label="Refresh setup status" title="Refresh setup status" onClick={load} disabled={loading} loading={loading}><RotateCw className="h-4 w-4" /></Button></div><p className="text-sm text-text-muted">Review each location's team, contact details and hours before sharing its booking link.</p></CardHeader><CardContent className="space-y-4">
    {loading ? <LoadingState label="Checking setup" /> : error ? <Alert variant="error" title="Setup status unavailable" action={<Button onClick={load}>Retry setup status</Button>}>{error}</Alert> : !locations.length ? <Alert variant="warning" title="Create a location first" action={<Button onClick={() => onNavigate("locations")}>Open location setup</Button>}>A doctor needs an active practice location before appearing publicly.</Alert> : <>
      <Select label="Review location" value={locationId} onChange={event => setLocationId(event.target.value)} options={[{ value: "", label: "Choose a location" }, ...locations.map(location => ({ value: location.id, label: location.name }))]} />
      {selected?.isPublished === false && <Alert variant="warning" title="Location page is unpublished" action={<Button variant="outline" onClick={() => onNavigate("locations")}>Review publication</Button>}>Complete its details and publish the page from Locations when ready.</Alert>}
      {selected && !selected.slug && selected.isPublished !== false && <Alert variant="warning" title="Public link unavailable">Refresh the location setup or review this location in Locations.</Alert>}
      {checking && <LoadingState label="Checking public page" />}
      {detailError && <Alert variant="error" title="Public status unavailable" action={<Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry public check</Button>}>{detailError}</Alert>}
      {publicDetail && <>
        <Alert variant={status === "check_availability" ? "info" : "warning"} title={status === "no_doctors" ? "Location assignment required" : status === "contact_location" ? "Online booking is paused" : "Public page available"}>{status === "no_doctors" ? "No active doctors are listed at this location. Complete their location assignments in clinical team setup." : status === "contact_location" ? "Patients can view the page and contact reception. Review the subscription before offering online appointments." : "Patients can check availability. Review the remaining details and preview the page before sharing."}</Alert>
        <ul aria-label="Public booking checklist" className={styles.checklist}>{checklist.map(item => <li key={item.label}><span>{item.label}</span><span className={item.complete ? "text-success-text" : "text-warning-text"}>{item.complete ? "Complete" : "Needs attention"}</span></li>)}</ul>
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline" href={locationPath(publicDetail)} target="_blank" rel="noopener noreferrer">Preview public location page</Link>
        {publicDetail.doctors.length > 0 && <ul aria-label="Doctor public previews" className="space-y-2">{publicDetail.doctors.filter(doctor => doctor.slug).map(doctor => <li key={doctor.id}><Link className="inline-flex min-h-11 items-center text-sm text-accent hover:underline" href={doctorPath(doctor, publicDetail)} target="_blank" rel="noopener noreferrer">Preview {doctor.name}&apos;s doctor page</Link></li>)}</ul>}
      </>}
      <div className={styles.sectionActions}>
        {hasAnyPermission(user, "VIEW_STAFF", "MANAGE_STAFF") && <Button variant="outline" size="sm" onClick={() => onNavigate("members")}>Open clinical team setup</Button>}
        <Button variant="outline" size="sm" onClick={() => onNavigate("locations")}>Review location details</Button>
        {status === "contact_location" && hasAnyPermission(user, "MANAGE_BILLING") && <Button variant="outline" size="sm" onClick={() => onNavigate("subscription")}>Review subscription</Button>}
      </div>
    </>}
  </CardContent></Card>;
}
