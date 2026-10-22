"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { getPublicBookingStatus } from "@/lib/publicBooking";
import { locationPath, doctorPath } from "@/lib/publicPaths";
import GoogleBookingLinks from "@/components/organization/GoogleBookingLinks";
import { parseLocationCoordinates } from "@/lib/geo/locationCoordinates";
import { Table, Button, Input, useToast, Badge, Checkbox, ConfirmDialog, ScheduleEditor, ImageUpload, Select, Dropdown, Tabs, Textarea } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import styles from "./LocationManagement.module.css";
import { useAuthStore } from "@/store/authStore";
import { useOrganizationLocations } from "@/hooks/useOrganizationLocations";
import { organizationPath, organizationWorkspaceUrl, saveWithBranding } from "@/services/organization.service";
import { publicBookingChecklist } from "@/lib/publicBookingSetup";
import { facilityTypeLabel, facilityTypeOptions, type FacilityType } from "@/lib/facility";
import { hasAnyPermission, isRootUser } from "@/lib/permissions";
import { RotateCw, Plus, Building2, Phone, Mail, QrCode, MoreHorizontal, Edit3, Archive, RotateCcw, Clock, Link2, Search } from "lucide-react";
import LocationQrPosterModal from "@/components/dashboard/LocationQrPosterModal";
import { PharmacyCapabilitySettings } from "@/components/pharmacy/PharmacyCapabilitySettings";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface Location {
  id: string;
  organizationId?: string;
  slug?: string;
  isPublished?: boolean;
  name: string;
  city: string;
  facilityType?: FacilityType | null;
  address?: string;
  timezone?: string;
  phone?: string;
  email?: string;
  description?: string;
  brandColor?: string;
  image_url?: string;
  logo?: string;
  timings?: string;
  amenities?: string[];
  upiVpa?: string;
  merchantName?: string;
  [key: string]: unknown;
}

export default function LocationManagement({ organizationId, embedded = false }: { organizationId?: string; embedded?: boolean }) {
  const user = useAuthStore((state) => state.user);
  return <LocationsWorkspace key={`${authScopeKey(user)}:${organizationId || "session"}`} organizationId={organizationId} embedded={embedded} />;
}

function LocationsWorkspace({ organizationId, embedded }: { organizationId?: string; embedded: boolean }) {
  const scopedPath = (path: string) => organizationPath(path, organizationId);
  const { user } = useAuthStore();
  const { locations, fetchLocations, isLoading: locationsLoading, error: locationLoadError } = useOrganizationLocations(organizationId);
  const canManageLocations = hasAnyPermission(user, "MANAGE_LOCATIONS");
  const canManagePharmacy = hasAnyPermission(user, "PHARMACY_MANAGE_SETTINGS", "MANAGE_ORGANIZATION");
  const [pharmacyLocation, setPharmacyLocation] = useState<Location | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [organizationsError, setOrganizationsError] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [organizationsRetry, setOrganizationsRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrLocation, setQrLocation] = useState<Location | null>(null);
  const [websiteLocation, setWebsiteLocation] = useState<Location | null>(null);
  const [publicationSaving, setPublicationSaving] = useState(false);
  const [websitePublicResponse, setWebsitePublicResponse] = useState<{ locationId: string; data: LocationDetail } | null>(null);
  const [websiteDetailLoadingFor, setWebsiteDetailLoadingFor] = useState<string | null>(null);
  const [websiteDetailErrorFor, setWebsiteDetailErrorFor] = useState<string | null>(null);
  const [websiteDetailRetry, setWebsiteDetailRetry] = useState(0);
  const [archivedLocations, setArchivedLocations] = useState<Location[]>([]);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [formTab, setFormTab] = useState("details");
  const invalidFocusPending = useRef(false);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const startArchivedRead = useLatestRead();
  const { toast } = useToast();
  const websitePublicDetail = websitePublicResponse && websitePublicResponse.locationId === websiteLocation?.id ? websitePublicResponse.data : null;
  const websiteUrl = websitePublicDetail && typeof window !== "undefined" ? `${window.location.origin}${locationPath(websitePublicDetail)}` : "";
  const websiteDetailLoading = websiteDetailLoadingFor === websiteLocation?.id;
  const websiteDetailError = websiteDetailErrorFor === websiteLocation?.id;
  const publicBookingStatus = websitePublicDetail ? getPublicBookingStatus({ ...websitePublicDetail, doctorCount: websitePublicDetail.doctors.length }) : null;
  const websiteButtonLabel = publicBookingStatus === "check_availability" ? "Check appointments" : publicBookingStatus === "contact_location" ? "Contact reception" : "View location";
  const buttonSnippet = websiteUrl ? `<a href="${websiteUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0F6F66;color:#fff;text-decoration:none;font:600 16px system-ui,sans-serif">${websiteButtonLabel}</a>` : "";
  const websiteChecklist = websitePublicDetail ? publicBookingChecklist(websitePublicDetail) : [];

  const openWebsiteBooking = (location: Location) => {
    setWebsitePublicResponse(null);
    setWebsiteDetailLoadingFor(location.id);
    setWebsiteDetailErrorFor(null);
    setWebsiteLocation(location);
  };
  const retryWebsiteDetail = () => {
    if (!websiteLocation) return;
    setWebsitePublicResponse(null);
    setWebsiteDetailLoadingFor(websiteLocation.id);
    setWebsiteDetailErrorFor(null);
    setWebsiteDetailRetry((value) => value + 1);
  };

  useEffect(() => {
    if (!websiteLocation) return;
    const controller = new AbortController();
    api.get(organizationPath(`/public/locations/${encodeURIComponent(websiteLocation.slug || "")}`, organizationId), { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) { const data = response.data?.data; if (data?.slug === websiteLocation.slug && Array.isArray(data?.doctors)) setWebsitePublicResponse({ locationId: websiteLocation.id, data }); else setWebsiteDetailErrorFor(websiteLocation.id); } })
      .catch(() => { if (!controller.signal.aborted) setWebsiteDetailErrorFor(websiteLocation.id); })
      .finally(() => { if (!controller.signal.aborted) setWebsiteDetailLoadingFor(null); });
    return () => controller.abort();
  }, [websiteLocation, websiteDetailRetry, organizationId]);
  const copyWebsiteText = async (value: string, title: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title, description: "Ready to paste into your website or business profile.", variant: "success" });
    } catch {
      toast({ title: "Could not copy", description: "Select and copy the text manually.", variant: "error" });
    }
  };
  const changePublication = async () => {
    if (!websiteLocation || publicationSaving || !canManageLocations) return;
    setPublicationSaving(true);
    try {
      const isPublished = websiteLocation.isPublished === false;
      await api.put(organizationPath(`/onboarding/locations/${websiteLocation.id}/publication`, organizationId || websiteLocation.organizationId), { isPublished });
      toast({ title: isPublished ? "Public page published" : "Public page unpublished", description: isPublished ? "Review your public details before sharing." : "Remove the booking link from your website and Google Business Profile.", variant: "success" });
      setWebsiteLocation(null);
      await fetchLocations(true);
    } catch {
      toast({ title: "Could not change publication", description: "Please try again.", variant: "error" });
    } finally { setPublicationSaving(false); }
  };

  // Load organizations list for Root Super-Admin selection
  useEffect(() => {
    if (isRootUser(user) && !organizationId) {
      const controller = new AbortController();
      setOrganizationsLoading(true);
      setOrganizationsError(false);
      api
        .get("/organizations", { signal: controller.signal })
        .then((res) => {
          if (controller.signal.aborted) return;
          const orgList = res.data.data?.organizations || res.data.data || [];
          setOrganizations(orgList);
        })
        .catch(() => { if (!controller.signal.aborted) setOrganizationsError(true); })
        .finally(() => { if (!controller.signal.aborted) setOrganizationsLoading(false); });
      return () => controller.abort();
    }
  }, [user, organizationId, organizationsRetry]);

  // Location Form Validation State
  const [locationErrors, setLocationErrors] = useState<Record<string, string>>({});

  const validateLocationField = (field: string, value: string) => {
    let error = "";
    if (field === "name" && !value.trim()) {
      error = "Location Name is required";
    } else if (field === "city") {
      if (!value.trim()) {
        error = "City is required";
      } else if (/^[0-9+\s-]{6,}$/.test(value.trim())) {
        error = "City appears to be a phone number. Please enter a valid city name.";
      }
    } else if (field === "email" && value.trim() && !EMAIL_REGEX.test(value)) {
      error = "Please enter a valid email address";
    }

    setLocationErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return !error;
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (locationErrors[field]) {
      setLocationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const fetchArchivedLocations = useCallback(async () => {
    const request = startArchivedRead();
    try {
      setArchivedError(null);
      setLoadingArchived(true);
      const res = await api.get(organizationPath("/onboarding/locations?status=inactive", organizationId), { signal: request.signal });
      if (!request.isCurrent()) return;
      const rawList = res.data.data || [];
      const list = rawList.map((c: any) => ({
        ...c,
        id: c.id || c._id,
      }));
      setArchivedLocations(list);
      setArchivedLoaded(true);
    } catch {
      if (request.isCurrent()) setArchivedError("Archived locations could not be loaded. Please try again.");
    } finally {
      if (request.isCurrent()) setLoadingArchived(false);
    }
  }, [organizationId, startArchivedRead]);

  const reloadLocations = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([fetchLocations(true), fetchArchivedLocations()]);
    } catch {
      toast({ title: "Error", description: "Failed to load locations list", variant: "error" });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchLocations, fetchArchivedLocations, toast]);

  const handleReactivate = async (location: Location) => {
    if (!canManageLocations || reactivatingId) return;
    setReactivatingId(location.id);
    try {
      await api.post(scopedPath(`/onboarding/locations/${location.id}/reactivate`));
      toast({
        title: "Branch Reactivated",
        description: `${location.name} is now active and ready for appointments.`,
        variant: "success",
      });
      await reloadLocations();
    } catch (err: any) {
      toast({
        title: "Reactivation Failed",
        description: err.response?.data?.message || "Failed to reactivate branch. Check your subscription plan limits.",
        variant: "error",
      });
    } finally {
      setReactivatingId(null);
    }
  };

  useEffect(() => {
    reloadLocations();
  }, [reloadLocations]);

  const openModal = () => {
    setFormTab("details");
    setEditingId(null);
    const defaultOrgId = organizationId || "";
    setFormData({ facilityType: "clinic", amenities: [], organizationId: defaultOrgId, upiVpa: "", merchantName: "", brandColor: "#0F6F66" });
    setLocationErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (row: Location) => {
    setFormTab("details");
    setEditingId(row.id);
    setFormData({
      ...row,
      image_url: row.logo || row.image_url || null,
      facilityType: row.facilityType || "",
      amenities: row.amenities || [],
      upiVpa: row.upiVpa || "",
      merchantName: row.merchantName || "",
      brandColor: row.brandColor || "#0F6F66",
      mapCoordinates: typeof row.latitude === "number" && typeof row.longitude === "number" ? `${row.latitude}, ${row.longitude}` : "",
    });
    setLocationErrors({});
    setIsModalOpen(true);
  };

  const handleAmenityChange = (facility: string, checked: boolean) => {
    const currentAmenities = formData.amenities || [];
    if (checked) {
      setFormData({ ...formData, amenities: [...currentAmenities, facility] });
    } else {
      setFormData({ ...formData, amenities: currentAmenities.filter((f: string) => f !== facility) });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canManageLocations) return;

    const isNameValid = validateLocationField("name", formData.name || "");
    const isCityValid = validateLocationField("city", formData.city || "");
    const isEmailValid = validateLocationField("email", formData.email || "");
    const isOrganizationValid = !isRootUser(user) || Boolean(organizationId || formData.organizationId);
    if (!isOrganizationValid) setLocationErrors(previous => ({ ...previous, organizationId: "Select an organization" }));
    const coordinates = parseLocationCoordinates(formData.mapCoordinates || "");
    if (!coordinates) setLocationErrors(previous => ({ ...previous, mapCoordinates: "Enter valid latitude, longitude (for example: 20.5992, 72.9342)." }));

    if (!isNameValid || !isCityValid || !isEmailValid || !coordinates || !isOrganizationValid) {
      setFormTab("details");
      toast({ title: "Validation Error", description: "Please correct the highlighted errors.", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const finalData = { ...formData, ...coordinates };
      delete finalData.mapCoordinates;
      if (!finalData.facilityType) delete finalData.facilityType; // Leave unclassified locations unclassified during unrelated edits.

      await saveWithBranding([finalData.image_url], organizationId || finalData.organizationId || user?.organization_id, async ([reference]) => {
        finalData.image_url = reference;
        // An explicit logo also makes clearing an existing image unambiguous.
        finalData.logo = reference;
        if (editingId) await api.put(scopedPath(`/onboarding/locations/${editingId}`), finalData);
        else await api.post(scopedPath("/onboarding/locations"), finalData);
      });
      toast({ title: "Success", description: editingId ? "Location updated successfully!" : "Location added successfully!", variant: "success" });
      setIsModalOpen(false);
      await reloadLocations();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to save location",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId || deactivating || !canManageLocations) return;
    setDeactivating(true);
    try {
      await api.delete(scopedPath(`/onboarding/locations/${deletingId}`));
      toast({ title: "Success", description: "Location deactivated and archived safely.", variant: "success" });
      await reloadLocations();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to delete location",
        variant: "error",
      });
    } finally {
      setDeactivating(false);
      setDeletingId(null);
    }
  };

  const formatTimings = (timingsStr: string | null | undefined): string => {
    if (!timingsStr) return "Hours not set";
    try {
      const data = JSON.parse(timingsStr);
      if (!data || typeof data !== "object") return "Hours not set";
      const days = Object.keys(data).filter((day) => Array.isArray(data[day]) && data[day].length > 0);
      if (!days.length) return "Hours not set";
      const first = data[days[0]][0];
      const sameHours = days.every((day) => JSON.stringify(data[day]) === JSON.stringify(data[days[0]]));
      return `${sameHours && first?.start && first?.end ? `${first.start}–${first.end}` : "Varied hours"} · ${days.length} ${days.length === 1 ? "day" : "days"}`;
    } catch {
      return timingsStr;
    }
  };

  const rows = activeTab === "active" ? locations as Location[] : archivedLocations;
  const cities = Array.from(new Set(rows.map((location) => location.city).filter(Boolean))).sort();
  const query = search.trim().toLowerCase();
  const filtered = rows.filter((location) => (!city || location.city === city) && [location.name, location.city, location.address || "", location.phone || "", location.email || ""].some((value) => value.toLowerCase().includes(query)));
  const readError = activeTab === "active" ? locationLoadError : archivedError;
  const reading = activeTab === "active" ? loading || locationsLoading : loadingArchived;
  const Heading = embedded ? "h2" : "h1";
  const locationIdentity = (location: Location) => <div className={styles.identity}>
    <div className={styles.avatar}>{location.logo || location.image_url ? <LoadingImage src={location.logo || location.image_url!} alt="" className="h-full w-full object-cover" /> : <Building2 size={19} />}</div>
    <div><strong>{location.name}</strong><span>{facilityTypeLabel(location.facilityType)} &middot; {location.city}</span>{location.address && <small>{location.address}</small>}</div>
  </div>;
  const publicationBadge = (location: Location) => <Badge size="sm" dot variant={activeTab === "archived" ? "neutral" : location.isPublished === false ? "default" : "success"}>{activeTab === "archived" ? "Archived" : location.isPublished === false ? "Unpublished" : "Published"}</Badge>;
  const locationActions = (location: Location) => <div className={styles.rowActions}>
    {activeTab === "archived" ? canManageLocations && <Button size="sm" variant="outline" loading={reactivatingId === location.id} disabled={Boolean(reactivatingId && reactivatingId !== location.id)} onClick={() => handleReactivate(location)}><RotateCcw size={15} /> Reactivate</Button> : <>
      {canManageLocations && <Button size="sm" variant="outline" onClick={() => openEditModal(location)}><Edit3 size={15} /> Edit</Button>}
      <Dropdown align="right" width="w-56" trigger={<Button size="sm" variant="ghost" className={styles.iconAction} aria-label={`Actions for ${location.name}`}><MoreHorizontal size={18} /></Button>} items={[
        { label: "QR poster", icon: <QrCode size={16} />, onClick: () => setQrLocation(location) },
        { label: "Website booking", icon: <Link2 size={16} />, onClick: () => openWebsiteBooking(location) },
        ...(canManagePharmacy ? [{ label: "Pharmacy settings", onClick: () => setPharmacyLocation(location) }] : []),
        ...(canManageLocations ? [{ divider: true, label: "" }, { label: "Deactivate location", icon: <Archive size={16} />, variant: "danger" as const, onClick: () => setDeletingId(location.id) }] : []),
      ]} />
    </>}
  </div>;

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><Heading>Locations</Heading><p>Contact details, hours and booking pages</p></div>
      <div className={styles.headerActions}>
        <Button size="sm" variant="ghost" className={styles.iconAction} aria-label="Refresh locations" disabled={isRefreshing} onClick={reloadLocations}><RotateCw size={17} className={isRefreshing ? "animate-spin" : ""} /></Button>
        {canManageLocations && <Button size="sm" onClick={openModal}><Plus size={16} /> Add location</Button>}
      </div>
    </header>
    <section className={styles.directory} aria-label="Location directory">
      <div className={styles.toolbar}>
        <Tabs variant="pills" scrollActiveIntoView={false} activeTab={activeTab} onChange={(value) => { setActiveTab(value as "active" | "archived"); setCity(""); }} tabs={[
          { id: "active", label: "Active", badge: loading ? undefined : locations.length },
          { id: "archived", label: "Archived", badge: archivedLoaded ? archivedLocations.length : undefined },
        ]} />
        <div className={styles.searchRow}>
          <Input type="search" aria-label="Search locations" placeholder="Name, city or address" icon={<Search size={16} />} value={search} onChange={(event) => setSearch(event.target.value)} />
          {(cities.length > 1 || city) && <Select aria-label="Filter by city" value={city} onChange={(event) => setCity(event.target.value)} options={[{ value: "", label: "All cities" }, ...cities.map((value) => ({ value, label: value }))]} />}
        </div>
      </div>
      <Table key={activeTab} variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} pagination={rows.length > 10} error={readError} onRetry={reloadLocations}
        loading={reading} mobileCardView data={filtered} emptyMessage={readError ? "Locations are unavailable. Try again." : query || city ? "No locations match your search." : activeTab === "archived" ? "No archived locations. Deactivated locations appear here." : "No locations yet. Add your first location to get started."}
        columns={[
          { key: "name", header: "Location", render: locationIdentity },
          { key: "contact", header: "Contact", render: (location: Location) => <div className={styles.contact}>{location.phone ? <a href={`tel:${location.phone}`}><Phone size={13} /><span>{location.phone}</span></a> : <span>No phone added</span>}{location.email && <a href={`mailto:${location.email}`}><Mail size={13} /><span>{location.email}</span></a>}</div> },
          { key: "timings", header: "Hours", render: (location: Location) => <span className={styles.hours}>{formatTimings(location.timings)}</span> },
          { key: "isPublished", header: "Public page", render: publicationBadge },
          { key: "actions", header: "", align: "right", render: locationActions },
        ]}
        renderMobileCard={(location: Location) => <article key={location.id} className={styles.locationCard}>
          {locationIdentity(location)}
          <div className={styles.cardMeta}>{publicationBadge(location)}<span><Clock size={13} />{formatTimings(location.timings)}</span></div>
          {location.phone && <a className={styles.phone} href={`tel:${location.phone}`}><Phone size={14} /> {location.phone}</a>}
          {locationActions(location)}
        </article>} />
      {!reading && !readError && <footer className={styles.resultCount}>{filtered.length} of {rows.length} {activeTab} {rows.length === 1 ? "location" : "locations"}</footer>}
    </section>

      {pharmacyLocation && canManagePharmacy && <PharmacyCapabilitySettings key={pharmacyLocation.id} location={pharmacyLocation} organizationId={organizationId} onClose={() => setPharmacyLocation(null)} onSaved={() => { void fetchLocations(true); }} />}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Location" : "Add location"} description={editingId ? formData.name : "Add the details your team and patients need."} size="lg" busy={submitting}
        bodyClassName={styles.dialogBody} headerClassName={styles.formHeader} header={<><h2>{editingId ? "Edit Location" : "Add location"}</h2><p>{editingId ? formData.name : "Add the details your team and patients need."}</p><Tabs className={styles.formTabs} variant="pills" activeTab={formTab} onChange={setFormTab} scrollActiveIntoView={false} tabs={[
          { id: "details", label: "Details" }, { id: "hours", label: "Hours" }, { id: "payments", label: "Payments" }, { id: "public", label: "Public page" },
        ]} /></>}
        footer={<><Button type="button" size="sm" variant="outline" disabled={submitting} onClick={() => setIsModalOpen(false)}>Cancel</Button><Button type="submit" size="sm" form="location-settings" loading={submitting}>Save location</Button></>}
      >
        <form id="location-settings" onSubmit={handleSave} onInvalidCapture={(event) => {
          const panel = (event.target as HTMLElement).closest<HTMLElement>("[data-location-section]");
          if (panel?.hidden) {
            event.preventDefault();
            if (invalidFocusPending.current) return;
            invalidFocusPending.current = true;
            setFormTab(panel.dataset.locationSection || "details");
            const target = event.target as HTMLElement;
            requestAnimationFrame(() => { target.focus({ preventScroll: true }); invalidFocusPending.current = false; });
          }
        }}>
          <section hidden={formTab !== "details"} data-location-section="details" aria-label="Location details" className={styles.formSection}>
          {/* Root Admin Target Organization Selector */}
          {isRootUser(user) && !organizationId && (
            <div className="bg-primary-500/10 border border-primary-500/20 p-3.5 rounded-2xl space-y-1.5">
              <Select
                label="Organization *"
                value={formData.organizationId || ""}
                required
                disabled={organizationsLoading}
                error={locationErrors.organizationId}
                onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                options={organizations.map((o) => ({
                  value: o.id || o._id,
                  label: o.name,
                }))}
              />
              {organizationsLoading && <p className={styles.help}>Loading organizations...</p>}
              {organizationsError && <div role="alert" className={styles.help}>Organizations could not be loaded.<Button type="button" size="sm" variant="outline" onClick={() => setOrganizationsRetry((value) => value + 1)}>Try again</Button></div>}

            </div>
          )}


            <Select label="Location type" value={formData.facilityType || ""} options={[{ value: "", label: "Unclassified healthcare facility" }, ...facilityTypeOptions]} onChange={(event) => handleFieldChange("facilityType", event.target.value)} required={!editingId} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <Input
                label="Location Name *"
                value={formData.name || ""}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                onBlur={() => validateLocationField("name", formData.name || "")}
                placeholder="e.g. Ekavyu Central Clinic"
                error={locationErrors.name}
                required
              />
              <Input
                label="City *"
                value={formData.city || ""}
                onChange={(e) => handleFieldChange("city", e.target.value)}
                onBlur={() => validateLocationField("city", formData.city || "")}
                placeholder="e.g. San Francisco"
                error={locationErrors.city}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Phone Number"
                value={formData.phone || ""}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                placeholder="e.g. +1 415 555 0199" type="tel" inputMode="tel"
              />
              <Input
                label="Email Address"
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                onBlur={() => validateLocationField("email", formData.email || "")}
                placeholder="e.g. contact@clinic.com"
                error={locationErrors.email}
              />
            </div>

            <Input
              label="Address"
              value={formData.address || ""}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              placeholder="e.g. 742 Evergreen Terrace, Suite 100"
            />
            <Input
              label="Map coordinates (optional)"
              value={formData.mapCoordinates || ""}
              onChange={(event) => handleFieldChange("mapCoordinates", event.target.value)}
              placeholder="20.5992, 72.9342"
              hint="Copy latitude, longitude from this location's pin in Google Maps to help nearby patients find you."
              error={locationErrors.mapCoordinates}
            />

          </section>
          <section hidden={formTab !== "hours"} data-location-section="hours" aria-label="Location hours" className={styles.formSection}>
            <ScheduleEditor key={editingId || "new"} label="Operating hours" value={formData.timings || ""} onChange={(value) => setFormData((previous: any) => ({ ...previous, timings: value }))} />
            <Input
              label="Branch timezone (optional)"
              value={formData.timezone || ""}
              onChange={(e) => handleFieldChange("timezone", e.target.value)}
              placeholder="e.g. America/Toronto; blank uses organization timezone"
              hint="Use an IANA timezone for branches in another time zone."
            />


            <div className="space-y-2">
              <label className="text-xs font-semibold text-text block">Amenities and services</label>
              <div className="flex flex-wrap gap-4 p-3.5 bg-surface-alt border border-border/80 rounded-2xl">
                {["Pharmacy", "Laboratory", "Parking", "Emergency Care", "Vaccination Center"].map((fac) => (
                  <Checkbox
                    key={fac}
                    label={fac}
                    checked={formData.amenities?.includes(fac) || false}
                    onChange={(e) => handleAmenityChange(fac, e.target.checked)}
                  />
                ))}
              </div>
            </div>


          </section>
          <section hidden={formTab !== "payments"} data-location-section="payments" aria-label="Location payments" className={styles.formSection}>
            <p className={styles.help}>UPI payments use this location's payment address and merchant name. Check both before sharing a payment QR.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="UPI address"
                value={formData.upiVpa || ""}
                onChange={(e) => handleFieldChange("upiVpa", e.target.value)}
                placeholder="e.g. apollo.southmumbai@icici"
              />
              <Input
                label="Merchant name"
                value={formData.merchantName || ""}
                onChange={(e) => handleFieldChange("merchantName", e.target.value)}
                placeholder="e.g. Apollo South Mumbai Clinic Ltd"
              />
            </div>

          </section>
          <section hidden={formTab !== "public"} data-location-section="public" aria-label="Location public page" className={styles.formSection}>
              <div className="rounded-xl border border-border bg-surface-alt p-4">
                <Checkbox label="Publish location on Ekavyu" checked={formData.isPublished !== false} onChange={(event) => setFormData({ ...formData, isPublished: event.target.checked })} />
                <p className="mt-2 text-xs text-text-secondary">Published locations appear in the directory and can be shared. Unpublishing hides the public page, doctor links at this location and patient booking. Staff workflows and existing appointments remain available. Remove external appointment links when unpublishing.</p>
              </div>

            {/* Top Logo / Photo Uploader */}
            <div className="bg-surface-alt p-3.5 border border-border/80 rounded-2xl">
              <ImageUpload
                label="Photo or logo"
                value={formData.image_url || null}
                onChange={(val) => setFormData({ ...formData, image_url: val })}
              />
            </div>


            <Input
              label="Description"
              placeholder="Brief summary of clinical specialties and services..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <Select label="Booking page accent" value={formData.brandColor || "#0F6F66"} onChange={(event) => setFormData({ ...formData, brandColor: event.target.value })} size="sm" options={[
              { value: "#0F6F66", label: "Teal" }, { value: "#1D4ED8", label: "Blue" },
              { value: "#6D28D9", label: "Violet" }, { value: "#9A3412", label: "Terracotta" },
            ]} />

          </section>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. DEACTIVATE CONFIRM DIALOG
         ────────────────────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Deactivate Location?"
        description="This location will move to Archived. Existing patient records and appointments are preserved. Reactivation depends on your plan limits."
        loading={deactivating}
        variant="danger"
        confirmLabel="Deactivate"
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          6. LOCATION QR POSTER MODAL (A4 STANDEE & DIRECT JOIN FLOW)
         ────────────────────────────────────────────────────────────────────────── */}
      <LocationQrPosterModal
        open={!!qrLocation}
        onClose={() => setQrLocation(null)}
        location={qrLocation}
      />
      <Modal open={!!websiteLocation} busy={publicationSaving} onClose={() => setWebsiteLocation(null)} title="Website booking" description={websiteLocation?.name} size="lg" bodyClassName={styles.dialogBody} footer={<Button size="sm" variant="outline" disabled={publicationSaving} onClick={() => setWebsiteLocation(null)}>Done</Button>}>
        <div className="space-y-4 text-sm">
          <p className="text-text-secondary">Share this location with patients or add the link to your website.</p>
          <div><label htmlFor="location-booking-url" className="mb-1 block text-xs font-semibold text-text">Booking link</label><div className="flex gap-2"><Input id="location-booking-url" readOnly value={websiteUrl} containerClassName="min-w-0 flex-1" size="sm" variant="filled" /><Button size="sm" disabled={!websiteUrl} onClick={() => copyWebsiteText(websiteUrl, "Link copied")}>Copy link</Button></div></div>
          <div className="rounded-xl border border-border p-3"><p className="font-semibold">{websiteLocation?.isPublished === false ? "Public page unpublished" : "Public page published"}</p><p className="mt-1 text-xs text-text-secondary">Publishing controls the public page. Existing appointments and staff access stay available.</p>{canManageLocations && <Button className="mt-3" size="sm" variant="outline" loading={publicationSaving} onClick={changePublication}>{websiteLocation?.isPublished === false ? "Publish page" : "Unpublish page"}</Button>}</div>
          <details className={styles.readiness} open={websiteDetailError || undefined}><summary>Booking readiness <span>{websiteDetailLoading ? "Checking..." : websiteDetailError ? "Check failed" : publicBookingStatus === "check_availability" ? "Ready for booking" : "Review setup"}</span></summary><div aria-live="polite">
            {websiteDetailLoading && <p className="mt-2 text-xs text-text-secondary">Checking the public page…</p>}
            {websiteDetailError && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary"><span>Could not check the public page right now.</span><Button size="sm" variant="outline" onClick={retryWebsiteDetail}>Try again</Button></div>}
            {websitePublicDetail && <>
              <p className="mt-1 text-xs text-text-secondary">{publicBookingStatus === "check_availability" ? "Patients can check appointment times." : publicBookingStatus === "contact_location" ? "Patients can view the page and contact your care team; online booking is paused." : "Patients can view the page, but no doctors are listed yet."}</p>
              <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">{websiteChecklist.map((item) => <li key={item.label} className="flex items-start gap-2"><span aria-hidden="true" className={item.complete ? "text-success-text" : "text-warning-text"}>{item.complete ? "✓" : "○"}</span><span>{item.label}</span></li>)}</ul>
              {websiteChecklist.some((item) => !item.complete) && <div className="mt-3 flex flex-wrap gap-3"><Button size="sm" variant="outline" onClick={() => { if (websiteLocation) { openEditModal(websiteLocation); setWebsiteLocation(null); } }}>Edit location details</Button><Link href={organizationId ? organizationWorkspaceUrl(organizationId, "members") : "/dashboard/staff"} className="inline-flex min-h-9 items-center text-xs font-semibold text-accent hover:underline">Manage doctors</Link></div>}
            </>}
          </div></details>

          <details className={styles.embedCode}><summary>Website button code</summary><div><Textarea id="location-booking-html" readOnly value={buttonSnippet} rows={4} label="Paste-in HTML button" className="font-mono" /><Button size="sm" variant="outline" disabled={!buttonSnippet} onClick={() => copyWebsiteText(buttonSnippet, "Button code copied")}>Copy button code</Button></div></details>
          <details className={styles.embedCode}><summary>Google Search &amp; Maps setup</summary><div><GoogleBookingLinks locationUrl={websiteUrl} available={publicBookingStatus === "check_availability"} doctors={websitePublicDetail?.doctors.map((doctor) => ({ id: doctor.id, name: doctor.name, url: `${window.location.origin}${doctorPath(doctor, websitePublicDetail)}` })) || []} onCopy={copyWebsiteText} /></div></details>
          <p className="text-xs text-text-muted">The public page stays available while the location is active and published. If online appointments are paused, patients see contact options. No script, iframe, or website rebuild is required.</p>
        </div>
      </Modal>
    </div>;
}
