"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { getPublicBookingStatus } from "@/lib/publicBooking";
import { locationPath } from "@/lib/publicPaths";
import { parseWeeklySchedule } from "@/lib/timing/locationStatus";
import { parseLocationCoordinates } from "@/lib/geo/locationCoordinates";
import { Alert, Card, CardContent, Table, Button, Modal, Input, useToast, Badge, Checkbox, ConfirmDialog, ScheduleEditor, ImageUpload, Select, LoadingState, SkeletonTable, Dropdown, StatCard, cn } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useOrganizationLocations } from "@/hooks/useOrganizationLocations";
import { organizationPath } from "@/services/organization.service";
import { facilityTypeLabel, facilityTypeOptions, type FacilityType } from "@/lib/facility";
import { hasAnyPermission, isRootUser } from "@/lib/permissions";
import { useR2Upload } from "@/hooks/useR2Upload";
import { RotateCw, Plus, Building2, MapPin, Phone, Mail, QrCode, MoreHorizontal, Edit3, Trash2, Archive, RotateCcw, Clock, Link2 } from "lucide-react";
import LocationQrPosterModal from "@/components/dashboard/LocationQrPosterModal";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface Location {
  id: string;
  slug?: string;
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
  timings?: string;
  amenities?: string[];
  upiVpa?: string;
  merchantName?: string;
  [key: string]: unknown;
}

export default function LocationManagement({ organizationId, embedded = false }: { organizationId?: string; embedded?: boolean }) {
  const scopedPath = (path: string) => organizationPath(path, organizationId);
  const { user } = useAuthStore();
  const { locations, fetchLocations, isLoading: locationsLoading, error: locationLoadError } = useOrganizationLocations(organizationId);
  const canManageLocations = hasAnyPermission(user, "MANAGE_LOCATIONS");
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrLocation, setQrLocation] = useState<Location | null>(null);
  const [websiteLocation, setWebsiteLocation] = useState<Location | null>(null);
  const [websitePublicResponse, setWebsitePublicResponse] = useState<{ locationId: string; data: LocationDetail } | null>(null);
  const [websiteDetailLoadingFor, setWebsiteDetailLoadingFor] = useState<string | null>(null);
  const [websiteDetailErrorFor, setWebsiteDetailErrorFor] = useState<string | null>(null);
  const [websiteDetailRetry, setWebsiteDetailRetry] = useState(0);
  const [archivedLocations, setArchivedLocations] = useState<Location[]>([]);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { uploadFile } = useR2Upload();
  const websitePublicDetail = websitePublicResponse && websitePublicResponse.locationId === websiteLocation?.id ? websitePublicResponse.data : null;
  const websiteUrl = websitePublicDetail && typeof window !== "undefined" ? `${window.location.origin}${locationPath(websitePublicDetail)}` : "";
  const websiteDetailLoading = websiteDetailLoadingFor === websiteLocation?.id;
  const websiteDetailError = websiteDetailErrorFor === websiteLocation?.id;
  const publicBookingStatus = websitePublicDetail ? getPublicBookingStatus({ ...websitePublicDetail, doctorCount: websitePublicDetail.doctors.length }) : null;
  const websiteButtonLabel = publicBookingStatus === "check_availability" ? "Check appointments" : publicBookingStatus === "contact_location" ? "Contact reception" : "View location";
  const buttonSnippet = websiteUrl ? `<a href="${websiteUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0F6F66;color:#fff;text-decoration:none;font:600 16px system-ui,sans-serif">${websiteButtonLabel}</a>` : "";
  const websiteChecklist = websitePublicDetail ? [
    { label: "At least one doctor is listed", complete: websitePublicDetail.doctors.length > 0 },
    { label: "Online appointments are enabled", complete: publicBookingStatus === "check_availability" },
    { label: "A contact number is listed", complete: Boolean(websitePublicDetail.phone || websitePublicDetail.organization?.phone) },
    { label: "The location address is listed", complete: Boolean(websitePublicDetail.address || websitePublicDetail.organization?.address) },
    { label: "Opening hours are listed", complete: parseWeeklySchedule(websitePublicDetail.timings).hasExplicitSchedule },
    { label: "Consultation fees are clear", complete: websitePublicDetail.doctors.length > 0 && websitePublicDetail.doctors.every((doctor) => doctor.feeType === "free" || doctor.feeType === "post_consultation" || doctor.fees > 0) },
  ] : [];

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
    api.get(scopedPath(`/public/locations/${encodeURIComponent(websiteLocation.slug || "")}`), { signal: controller.signal })
      .then((response) => { if (!controller.signal.aborted) { if (response.data?.data) setWebsitePublicResponse({ locationId: websiteLocation.id, data: response.data.data }); else setWebsiteDetailErrorFor(websiteLocation.id); } })
      .catch(() => { if (!controller.signal.aborted) setWebsiteDetailErrorFor(websiteLocation.id); })
      .finally(() => { if (!controller.signal.aborted) setWebsiteDetailLoadingFor(null); });
    return () => controller.abort();
  }, [websiteLocation, websiteDetailRetry]);
  const copyWebsiteText = async (value: string, title: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title, description: "Ready to paste into your location website.", variant: "success" });
    } catch {
      toast({ title: "Could not copy", description: "Select and copy the text manually.", variant: "error" });
    }
  };

  // Load organizations list for Root Super-Admin selection
  useEffect(() => {
    if (isRootUser(user) && !organizationId) {
      api
        .get("/organizations")
        .then((res) => {
          const orgList = res.data.data?.organizations || res.data.data || [];
          setOrganizations(orgList);
        })
        .catch(() => {});
    }
  }, [user, organizationId]);

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

  const fetchArchivedLocations = async () => {
    try {
      setArchivedError(null);
      setLoadingArchived(true);
      const res = await api.get(scopedPath("/onboarding/locations?status=inactive"));
      const rawList = res.data.data || [];
      const list = rawList.map((c: any) => ({
        ...c,
        id: c.id || c._id,
      }));
      setArchivedLocations(list);
    } catch {
      setArchivedError("Archived locations could not be loaded. Please try again.");
    } finally {
      setLoadingArchived(false);
    }
  };

  const reloadLocations = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([fetchLocations(true), fetchArchivedLocations()]);
    } catch {
      toast({ title: "Error", description: "Failed to load locations list", variant: "error" });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleReactivate = async (location: Location) => {
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
  }, [fetchLocations]);

  const openModal = () => {
    setEditingId(null);
    const defaultOrgId = organizationId || "";
    setFormData({ facilityType: "clinic", amenities: [], organizationId: defaultOrgId, upiVpa: "", merchantName: "", brandColor: "#0F6F66" });
    setLocationErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (row: Location) => {
    setEditingId(row.id);
    setFormData({
      ...row,
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

    const isNameValid = validateLocationField("name", formData.name || "");
    const isCityValid = validateLocationField("city", formData.city || "");
    const isEmailValid = validateLocationField("email", formData.email || "");
    const isOrganizationValid = !isRootUser(user) || Boolean(organizationId || formData.organizationId);
    if (!isOrganizationValid) setLocationErrors(previous => ({ ...previous, organizationId: "Select an organization" }));
    const coordinates = parseLocationCoordinates(formData.mapCoordinates || "");
    if (!coordinates) setLocationErrors(previous => ({ ...previous, mapCoordinates: "Enter valid latitude, longitude (for example: 20.5992, 72.9342)." }));

    if (!isNameValid || !isCityValid || !isEmailValid || !coordinates || !isOrganizationValid) {
      toast({ title: "Validation Error", description: "Please correct the highlighted errors.", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const finalData = { ...formData, ...coordinates };
      delete finalData.mapCoordinates;
      if (!finalData.facilityType) delete finalData.facilityType; // Leave unclassified locations unclassified during unrelated edits.

      // Handle deferred image upload
      if (finalData.image_url instanceof File) {
        toast({ title: "Uploading...", description: "Uploading logo to Cloudflare R2", variant: "default" });
        const { objectKey } = await uploadFile(finalData.image_url);
        finalData.image_url = objectKey;
      }

      if (editingId) {
        await api.put(scopedPath(`/onboarding/locations/${editingId}`), finalData);
        toast({ title: "Success", description: "Location updated successfully!", variant: "success" });
      } else {
        await api.post(scopedPath("/onboarding/locations"), finalData);
        toast({ title: "Success", description: "Location added successfully!", variant: "success" });
      }
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
    if (!deletingId) return;
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
      setDeletingId(null);
    }
  };

  const formatTimings = (timingsStr: string | null | undefined): string => {
    if (!timingsStr) return "Not specified";
    try {
      const data = JSON.parse(timingsStr);
      const days = Object.keys(data);
      if (days.length === 0) return timingsStr;

      for (const day of days) {
        if (data[day] && data[day].length > 0) {
          const firstSlot = data[day][0];
          return `Open ${firstSlot.start} - ${firstSlot.end} (${days.length} days/wk)`;
        }
      }
      return "Not specified";
    } catch {
      return timingsStr;
    }
  };

  const uniqueCities = Array.from(new Set(locations.map((c) => c.city).filter(Boolean)));
  const availableAmenities = Array.from(
    new Set(locations.flatMap((c) => (c.amenities as string[]) || []).filter(Boolean))
  );

  return (
    <div className={embedded ? "space-y-4 w-full min-w-0" : "space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12"}>
      {(activeTab === "archived" ? archivedError : locationLoadError) && <Alert variant="error" title="Unable to load locations" action={<Button variant="outline" size="sm" onClick={reloadLocations} loading={isRefreshing}>Try again</Button>}>Locations could not be loaded. Check your connection and try again.</Alert>}
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Locations
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                {locations.length === 1 ? "1 Active Location" : `${locations.length} Active Locations`}
              </Badge>
              {archivedLocations.length > 0 && (
                <Badge variant="neutral" size="sm" className="font-semibold">
                  {archivedLocations.length} Archived
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Manage your practice locations, operating schedules, and reception QR portals.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={reloadLocations}
              disabled={isRefreshing}
              className="w-full sm:w-auto min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors justify-center"
             loading={isRefreshing}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              Refresh
            </Button>

            {canManageLocations && (
              <Button
                variant="primary"
                size="sm"
                onClick={openModal}
                className="w-full sm:w-auto min-h-[42px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs justify-center"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Location
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. STATS (only show for multi-location)
         ────────────────────────────────────────────────────────────────────────── */}
      {!embedded && locations.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="Total Locations"
            value={locations.length.toString()}
            description="Active practice locations"
            icon={<Building2 className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Cities Covered"
            value={uniqueCities.length.toString()}
            description="Distinct geographic areas"
            icon={<MapPin className="w-5 h-5 text-text-secondary" />}
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          3. TAB SWITCHER: Active Locations vs. Archived Locations
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="inline-flex p-1 rounded-xl bg-surface-hover/80 border border-border/60 overflow-x-auto [scrollbar-width:none] w-full sm:w-auto">
          <button
            type="button"
            data-testid="tab-active-branches"
            onClick={() => setActiveTab("active")}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[36px]",
              activeTab === "active"
                ? "bg-surface text-accent shadow-xs font-bold"
                : "text-text-muted hover:text-text"
            )}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>Active Branches ({locations.length})</span>
          </button>
          <button
            type="button"
            data-testid="tab-archived-branches"
            onClick={() => setActiveTab("archived")}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[36px]",
              activeTab === "archived"
                ? "bg-surface text-accent shadow-xs font-bold"
                : "text-text-muted hover:text-text"
            )}
          >
            <Archive className="w-3.5 h-3.5 shrink-0" />
            <span>Archived Branches ({archivedLocations.length})</span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. CONTENT: ACTIVE TAB vs ARCHIVED TAB
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "active" ? (
        (loading || locationsLoading) && locations.length === 0 ? (
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <CardContent className="p-0"><LoadingState label="Loading locations"><SkeletonTable /></LoadingState></CardContent>
          </Card>
        ) : locations.length === 1 ? (
        /* ── Smart Single-Location Card View ── */
        <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text text-base sm:text-lg">{locations[0].name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <MapPin className="w-3 h-3" />
                      <span>{locations[0].city}{locations[0].address ? ` — ${locations[0].address}` : ""}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{(locations[0] as Location).phone || "No phone set"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{(locations[0] as Location).email || "No email set"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{formatTimings((locations[0] as Location).timings)}</span>
                  </div>
                </div>

                {(locations[0] as Location).amenities && ((locations[0] as Location).amenities as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {((locations[0] as Location).amenities as string[]).map((fac, idx) => (
                      <Badge key={idx} variant="primary" size="sm" className="text-[10px] font-semibold">{fac}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-col items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-border/60">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-semibold min-h-[44px] sm:min-h-[36px] flex-1 sm:flex-initial justify-center"
                  onClick={() => setQrLocation(locations[0] as Location)}
                >
                  <QrCode className="w-3.5 h-3.5 mr-1 text-accent" />
                  QR Poster
                </Button>
                <Button size="sm" variant="outline" onClick={() => openWebsiteBooking(locations[0] as Location)} className="rounded-xl text-xs font-semibold min-h-[44px] sm:min-h-[36px]">
                  <Link2 className="w-3.5 h-3.5 mr-1" /> Website booking
                </Button>
                {canManageLocations && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs font-semibold min-h-[44px] sm:min-h-[36px] flex-1 sm:flex-initial justify-center"
                    onClick={() => openEditModal(locations[0] as Location)}
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1 text-text-muted" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {canManageLocations && (
              <div className="mt-5 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={openModal}
                  className="text-xs font-semibold text-accent dark:text-accent hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add another location
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ── Multi-Location Table View ── */
        <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <CardContent className="p-0">
            <Table
              searchable
              searchPlaceholder="Search locations by name, city, or address..."
              loading={loading || locationsLoading || isRefreshing}
              mobileCardView
              columns={[
                {
                  key: "name",
                  header: "Location Name",
                  sortable: true,
                  render: (row: Location) => (
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="w-10 h-10 rounded-xl bg-surface-alt border border-border flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                        {row.image_url ? (
                          <LoadingImage src={row.image_url} alt={row.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-accent" />
                        )}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-text text-xs sm:text-sm block truncate">{row.name}</span>
                        <span className="text-xs text-text-secondary">{facilityTypeLabel(row.facilityType)}</span>
                        {row.address && (
                          <p className="text-xs text-text-muted truncate max-w-[200px]" title={row.address}>
                            {row.address}
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "city",
                  header: "City",
                  sortable: true,
                  render: (row: Location) => (
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>{row.city}</span>
                    </div>
                  ),
                },
                {
                  key: "phone",
                  header: "Phone",
                  render: (row: Location) => (
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <Phone className="w-3 h-3 text-text-muted shrink-0" />
                      <span className="whitespace-nowrap">{row.phone || "—"}</span>
                    </div>
                  ),
                },
                {
                  key: "timings",
                  header: "Hours",
                  render: (row: Location) => (
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>{formatTimings(row.timings)}</span>
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  width: "110px",
                  render: (row: Location) => (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        className="rounded-lg font-semibold text-xs min-h-[36px] px-2.5"
                        onClick={() => setQrLocation(row)}
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1 text-accent" />
                        QR
                      </Button>
                      {canManageLocations && (
                        <Dropdown
                          align="right"
                          trigger={
                            <Button
                              size="xs"
                              variant="outline"
                              className="h-9 w-9 p-0 flex items-center justify-center rounded-lg text-text-secondary hover:text-text min-h-[36px] min-w-[36px]"
                              title="Row Actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                          items={[
                            {
                              label: "Reception QR Code",
                              icon: <QrCode className="w-4 h-4 text-accent" />,
                              onClick: () => setQrLocation(row),
                            },
                            { label: "Website booking link", icon: <Link2 className="w-4 h-4 text-accent" />, onClick: () => openWebsiteBooking(row) },
                            {
                              label: "Edit Location",
                              icon: <Edit3 className="w-4 h-4 text-text-muted" />,
                              onClick: () => openEditModal(row),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Deactivate Location",
                              icon: <Trash2 className="w-4 h-4 text-danger" />,
                              variant: "danger" as any,
                              onClick: () => setDeletingId(row.id),
                            },
                          ]}
                        />
                      )}
                    </div>
                  ),
                },
              ]}
              data={locations as Location[]}
              emptyMessage={locationLoadError ? "Locations are unavailable. Please try again." : "No locations configured yet. Click 'Add Location' to register your first branch."}
              renderMobileCard={(row: Location) => (
                <div
                  key={row.id}
                  className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-surface-alt border border-border flex items-center justify-center text-accent font-bold text-sm shrink-0 overflow-hidden shadow-2xs">
                        {row.image_url ? (
                          <LoadingImage src={row.image_url} alt={row.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-accent" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-text text-sm truncate">{row.name}</p>
                        <p className="text-xs text-text-secondary">{facilityTypeLabel(row.facilityType)}</p>
                        <p className="text-xs text-text-muted flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                          <span className="truncate">{row.city}</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      className="rounded-xl font-semibold text-xs min-h-[36px] px-2.5 shrink-0"
                      onClick={() => setQrLocation(row)}
                    >
                      <QrCode className="w-3.5 h-3.5 mr-1 text-accent" />
                      QR
                    </Button>
                  </div>

                  <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1.5 text-xs">
                    {row.address && (
                      <p className="text-text text-xs leading-snug line-clamp-2">
                        {row.address}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                      <span className="text-text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3 text-text-muted" />
                        <span>{formatTimings(row.timings)}</span>
                      </span>
                      {row.phone && (
                        <a
                          href={`tel:${row.phone}`}
                          className="text-text-muted hover:text-accent transition-colors flex items-center gap-1 font-mono"
                        >
                          <Phone className="w-3 h-3 text-text-muted" />
                          <span>{row.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {canManageLocations && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(row)}
                        className="w-full font-semibold text-xs min-h-[42px] rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-text-muted" />
                        <span>Edit Location</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingId(row.id)}
                        className="w-full font-semibold text-xs min-h-[42px] rounded-xl text-danger-text hover:bg-danger/10 border-danger/30 flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Deactivate</span>
                      </Button>
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openWebsiteBooking(row)} className="w-full min-h-[42px] rounded-xl text-xs font-semibold">
                    Website booking link
                  </Button>
                </div>
              )}
            />
          </CardContent>
        </Card>
      )) : (
        /* ── Archived Locations View ── */
        loadingArchived && archivedLocations.length === 0 ? (
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <CardContent className="p-0"><LoadingState label="Loading archived locations"><SkeletonTable /></LoadingState></CardContent>
          </Card>
        ) : archivedLocations.length === 0 ? (
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs p-8 text-center">
            <Archive className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-text text-base mb-1">No Archived Branches</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
              All registered locations are currently operational. When a branch is deactivated (for example, during a plan downgrade), it will be securely archived here with all historical records preserved.
            </p>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <Table
                searchable
                searchPlaceholder="Search archived locations..."
                loading={loadingArchived}
                mobileCardView
                columns={[
                  {
                    key: "name",
                    header: "Location Name",
                    sortable: true,
                    render: (row: Location) => (
                      <div className="space-y-0.5 min-w-[150px]">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span className="font-bold text-text text-xs sm:text-sm">{row.name}</span>
                          <Badge variant="neutral" size="sm" className="text-[10px]">Archived</Badge>
                        </div>
                        {row.address && (
                          <p className="text-xs text-text-muted truncate max-w-[200px]" title={row.address}>
                            {row.address}
                          </p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "city",
                    header: "City",
                    sortable: true,
                    render: (row: Location) => (
                      <div className="flex items-center gap-1 text-xs text-text-secondary">
                        <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span>{row.city}</span>
                      </div>
                    ),
                  },
                  {
                    key: "phone",
                    header: "Phone",
                    render: (row: Location) => (
                      <div className="flex items-center gap-1 text-xs text-text-secondary">
                        <Phone className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="whitespace-nowrap">{row.phone || "—"}</span>
                      </div>
                    ),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    align: "right",
                    width: "180px",
                    render: (row: Location) => (
                      <div className="flex items-center justify-end gap-2">
                        {canManageLocations && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="rounded-xl text-xs font-semibold min-h-[36px] shadow-xs"
                            loading={reactivatingId === row.id}
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            onClick={() => handleReactivate(row)}
                          >
                            Reactivate Branch
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
                data={archivedLocations}
                emptyMessage="No archived branches found."
                renderMobileCard={(row: Location) => (
                  <div
                    key={row.id}
                    className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-surface-alt border border-border flex items-center justify-center text-text-muted font-bold text-sm shrink-0">
                          <Building2 className="w-5 h-5 text-text-muted" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-text text-sm truncate">{row.name}</p>
                          <p className="text-xs text-text-muted flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                            <span className="truncate">{row.city}</span>
                          </p>
                        </div>
                      </div>
                      <Badge variant="neutral" size="sm" className="text-[10px]">Archived</Badge>
                    </div>

                    {row.address && (
                      <p className="text-xs text-text-muted p-2.5 rounded-xl bg-surface-alt/70 border border-border/50 line-clamp-2">
                        {row.address}
                      </p>
                    )}

                    {canManageLocations && (
                      <Button
                        size="sm"
                        variant="primary"
                        className="w-full font-semibold text-xs min-h-[44px] rounded-xl shadow-xs justify-center"
                        loading={reactivatingId === row.id}
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={() => handleReactivate(row)}
                      >
                        Reactivate Branch
                      </Button>
                    )}
                  </div>
                )}
              />
            </CardContent>
          </Card>
        )
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          4. ADD / EDIT LOCATION MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? "Edit Location" : "Add New Location"}`}
        description="Configure location details, operating hours, amenities, and contact information."
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-1">
          {/* Root Admin Target Organization Selector */}
          {isRootUser(user) && !organizationId && organizations.length > 0 && (
            <div className="bg-primary-500/10 border border-primary-500/20 p-3.5 rounded-2xl space-y-1.5">
              <Select
                label="Target Healthcare Organization *"
                value={formData.organizationId || ""}
                required
                error={locationErrors.organizationId}
                onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                options={organizations.map((o) => ({
                  value: o.id || o._id,
                  label: `${o.name} (${o.city || "Main"}) — ${o.plan?.toUpperCase() || "STARTER"} Tier`,
                }))}
              />
              <p className="text-[11px] text-text-muted">
                🛡️ <strong>Root Super-Admin Override</strong>: Select which organization tenant this location belongs to.
              </p>
            </div>
          )}

          {/* Section 1: Location Media & Basic Identity */}
          <div className="space-y-3.5 border-b border-border/60 pb-4">
            <Select label="Location type" value={formData.facilityType || ""} options={[{ value: "", label: "Unclassified healthcare facility" }, ...facilityTypeOptions]} onChange={(event) => handleFieldChange("facilityType", event.target.value)} required={!editingId} />
            <h3 className="text-xs font-bold text-accent uppercase tracking-wider">
              1. Branding & Location Identity
            </h3>

            {/* Top Logo / Photo Uploader */}
            <div className="bg-surface-alt p-3.5 border border-border/80 rounded-2xl">
              <ImageUpload
                label="Location Banner Photo / Logo"
                value={formData.image_url || null}
                onChange={(val) => setFormData({ ...formData, image_url: val })}
              />
            </div>

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
              label="Full Physical Address"
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
            <Input
              label="Branch timezone (optional)"
              value={formData.timezone || ""}
              onChange={(e) => handleFieldChange("timezone", e.target.value)}
              placeholder="e.g. America/Toronto; blank uses organization timezone"
              hint="Use an IANA timezone for branches in another time zone."
            />

            <Input
              label="Location Overview / Description"
              placeholder="Brief summary of clinical specialties and services..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <label className="block text-xs font-semibold text-text">Booking page accent
              <select value={formData.brandColor || "#0F6F66"} onChange={(event) => setFormData({ ...formData, brandColor: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text">
                <option value="#0F6F66">Teal</option>
                <option value="#1D4ED8">Blue</option>
                <option value="#6D28D9">Violet</option>
                <option value="#9A3412">Terracotta</option>
              </select>
            </label>
          </div>

          {/* Section 2: Amenities & Operating Hours */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-accent uppercase tracking-wider">
              2. Amenities & Operating Hours
            </h3>

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

            <div className="pt-1 space-y-2">
              <ScheduleEditor
                label="Operating Schedule & Working Days"
                value={formData.timings || ""}
                onChange={(val) => setFormData({ ...formData, timings: val })}
              />
            </div>
          </div>

          {/* Section 3: Digital Payments & Countertop UPI Soundbox Routing */}
          <div className="space-y-3.5 border-b border-border/60 pb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-success-text dark:text-success-text uppercase tracking-wider">
                3. Digital Payments & Countertop UPI Soundbox Routing
              </h3>
              <Badge variant="success" size="sm" className="text-[10px] font-bold">
                NPCI / Soundbox
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted">
              Configure your location&apos;s direct UPI VPA for countertop dynamic QR generation, mobile 1-tap intent payments, and autonomous soundbox announcements.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Location UPI Virtual Payment Address (VPA)"
                value={formData.upiVpa || ""}
                onChange={(e) => handleFieldChange("upiVpa", e.target.value)}
                placeholder="e.g. apollo.southmumbai@icici"
              />
              <Input
                label="Official Merchant Settlement Name"
                value={formData.merchantName || ""}
                onChange={(e) => handleFieldChange("merchantName", e.target.value)}
                placeholder="e.g. Apollo South Mumbai Clinic Ltd"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submitting} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs">
              {editingId ? "Update Location Configuration" : "Save Location"}
            </Button>
          </div>
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
        description="Are you sure you want to deactivate this location? All patient encounters, appointments, and medical records will remain safely preserved. You can reactivate this branch anytime from the Archived Branches tab as permitted by your subscription plan."
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
      <Modal open={!!websiteLocation} onClose={() => setWebsiteLocation(null)} title="Website booking" description="Connect your existing website to this location's hosted booking page.">
        <div className="space-y-4 text-sm">
          <p className="text-text-secondary">Add this link to your website. Patients can view location information and check appointments when online booking is available.</p>
          <div className="rounded-xl border border-border bg-surface-alt p-3" aria-live="polite">
            <p className="font-semibold text-text">Public page readiness</p>
            {websiteDetailLoading && <p className="mt-2 text-xs text-text-secondary">Checking the public page…</p>}
            {websiteDetailError && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary"><span>Could not check the public page right now.</span><Button size="sm" variant="outline" onClick={retryWebsiteDetail}>Try again</Button></div>}
            {websitePublicDetail && <>
              <p className="mt-1 text-xs text-text-secondary">{publicBookingStatus === "check_availability" ? "Patients can check appointment times." : publicBookingStatus === "contact_location" ? "Patients can view the page and contact your care team; online booking is paused." : "Patients can view the page, but no doctors are listed yet."}</p>
              <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">{websiteChecklist.map((item) => <li key={item.label} className="flex items-start gap-2"><span aria-hidden="true" className={item.complete ? "text-success-text" : "text-warning-text"}>{item.complete ? "✓" : "○"}</span><span>{item.label}</span></li>)}</ul>
              {websiteChecklist.some((item) => !item.complete) && <div className="mt-3 flex flex-wrap gap-3"><Button size="sm" variant="outline" onClick={() => { if (websiteLocation) { openEditModal(websiteLocation); setWebsiteLocation(null); } }}>Edit location details</Button><Link href="/dashboard/staff" className="inline-flex min-h-9 items-center text-xs font-semibold text-accent hover:underline">Manage doctors</Link></div>}
            </>}
          </div>
          <div><label className="mb-1 block text-xs font-semibold text-text">Booking link</label><div className="flex gap-2"><input readOnly value={websiteUrl} className="min-w-0 flex-1 rounded-lg border border-border bg-surface-alt px-3 text-xs text-text" /><Button size="sm" disabled={!websiteUrl} onClick={() => copyWebsiteText(websiteUrl, "Link copied")}>Copy link</Button></div></div>
          <div><label className="mb-1 block text-xs font-semibold text-text">Paste-in HTML button</label><textarea readOnly value={buttonSnippet} rows={4} className="w-full rounded-lg border border-border bg-surface-alt p-3 font-mono text-xs text-text" /><Button size="sm" variant="outline" disabled={!buttonSnippet} onClick={() => copyWebsiteText(buttonSnippet, "Button code copied")}>Copy button code</Button></div>
          <p className="text-xs text-text-muted">The public page stays available while the location is active. If online appointments are paused, patients see contact options. No script, iframe, or website rebuild is required.</p>
        </div>
      </Modal>
    </div>
  );
}
