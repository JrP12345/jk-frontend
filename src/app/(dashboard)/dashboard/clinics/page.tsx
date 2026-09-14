"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card,
  CardContent,
  Table,
  Button,
  Modal,
  Input,
  useToast,
  Spinner,
  Badge,
  Checkbox,
  ConfirmDialog,
  ScheduleEditor,
  ImageUpload,
  Select,
  SkeletonTable,
  Dropdown,
  StatCard,
  cn,
} from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import { hasAnyPermission, isRootUser } from "@/lib/permissions";
import { useR2Upload } from "@/hooks/useR2Upload";
import {
  RotateCw,
  Plus,
  Building2,
  MapPin,
  Phone,
  Mail,
  QrCode,
  MoreHorizontal,
  Edit3,
  Trash2,
  ShieldCheck,
  Archive,
  RotateCcw,
  Clock,
} from "lucide-react";
import ClinicQrPosterModal from "@/components/dashboard/ClinicQrPosterModal";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface Clinic {
  id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  image_url?: string;
  timings?: string;
  facilities?: string[];
  upiVpa?: string;
  merchantName?: string;
  [key: string]: unknown;
}

export default function ClinicsPage() {
  const { user } = useAuthStore();
  const { clinics, fetchClinics, isLoading: clinicsLoading } = useClinicStore();
  const canManageClinics = hasAnyPermission(user, "MANAGE_CLINICS");
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [qrClinic, setQrClinic] = useState<Clinic | null>(null);
  const [archivedClinics, setArchivedClinics] = useState<Clinic[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { uploadFile } = useR2Upload();

  // Load organizations list for Root Super-Admin selection
  useEffect(() => {
    if (isRootUser(user)) {
      api
        .get("/onboarding/organizations")
        .then((res) => {
          const orgList = res.data.data?.organizations || res.data.data || [];
          setOrganizations(orgList);
        })
        .catch(() => {});
    }
  }, [user]);

  // Clinic Form Validation State
  const [clinicErrors, setClinicErrors] = useState<Record<string, string>>({});

  const validateClinicField = (field: string, value: string) => {
    let error = "";
    if (field === "name" && !value.trim()) {
      error = "Clinic Name is required";
    } else if (field === "city") {
      if (!value.trim()) {
        error = "City is required";
      } else if (/^[0-9+\s-]{6,}$/.test(value.trim())) {
        error = "City appears to be a phone number. Please enter a valid city name.";
      }
    } else if (field === "email" && value.trim() && !EMAIL_REGEX.test(value)) {
      error = "Please enter a valid email address";
    }

    setClinicErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return !error;
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (clinicErrors[field]) {
      setClinicErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const fetchArchivedClinics = async () => {
    try {
      setLoadingArchived(true);
      const res = await api.get("/onboarding/clinics?status=inactive");
      const rawList = res.data.data || [];
      const list = rawList.map((c: any) => ({
        ...c,
        id: c.id || c._id,
      }));
      setArchivedClinics(list);
    } catch {
      // Fallback cleanly
    } finally {
      setLoadingArchived(false);
    }
  };

  const reloadClinics = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([fetchClinics(true), fetchArchivedClinics()]);
    } catch {
      toast({ title: "Error", description: "Failed to load clinics list", variant: "error" });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleReactivate = async (clinic: Clinic) => {
    setReactivatingId(clinic.id);
    try {
      await api.post(`/onboarding/clinics/${clinic.id}/reactivate`);
      toast({
        title: "Branch Reactivated",
        description: `${clinic.name} is now active and ready for appointments.`,
        variant: "success",
      });
      await reloadClinics();
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
    reloadClinics();
  }, [fetchClinics]);

  const openModal = () => {
    setEditingId(null);
    const defaultOrgId = organizations.length > 0 ? organizations[0].id || organizations[0]._id : "";
    setFormData({ facilities: [], organizationId: defaultOrgId, upiVpa: "", merchantName: "" });
    setClinicErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (row: Clinic) => {
    setEditingId(row.id);
    setFormData({
      ...row,
      facilities: row.facilities || [],
      upiVpa: row.upiVpa || "",
      merchantName: row.merchantName || "",
    });
    setClinicErrors({});
    setIsModalOpen(true);
  };

  const handleFacilityChange = (facility: string, checked: boolean) => {
    const currentFacilities = formData.facilities || [];
    if (checked) {
      setFormData({ ...formData, facilities: [...currentFacilities, facility] });
    } else {
      setFormData({ ...formData, facilities: currentFacilities.filter((f: string) => f !== facility) });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNameValid = validateClinicField("name", formData.name || "");
    const isCityValid = validateClinicField("city", formData.city || "");
    const isEmailValid = validateClinicField("email", formData.email || "");

    if (!isNameValid || !isCityValid || !isEmailValid) {
      toast({ title: "Validation Error", description: "Please correct the highlighted errors.", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      let finalData = { ...formData };

      // Handle deferred image upload
      if (finalData.image_url instanceof File) {
        toast({ title: "Uploading...", description: "Uploading logo to Cloudflare R2", variant: "default" });
        const { publicUrl } = await uploadFile(finalData.image_url);
        finalData.image_url = publicUrl;
      }

      if (editingId) {
        await api.put(`/onboarding/clinics/${editingId}`, finalData);
        toast({ title: "Success", description: "Clinic updated successfully!", variant: "success" });
      } else {
        await api.post("/onboarding/clinics", finalData);
        toast({ title: "Success", description: "Clinic added successfully!", variant: "success" });
      }
      setIsModalOpen(false);
      await reloadClinics();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to save clinic",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/onboarding/clinics/${deletingId}`);
      toast({ title: "Success", description: "Clinic branch deactivated and archived safely.", variant: "success" });
      await reloadClinics();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to delete clinic",
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

  const uniqueCities = Array.from(new Set(clinics.map((c) => c.city).filter(Boolean)));
  const totalFacilities = Array.from(
    new Set(clinics.flatMap((c) => (c.facilities as string[]) || []).filter(Boolean))
  );

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Locations
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                {clinics.length === 1 ? "1 Active Location" : `${clinics.length} Active Locations`}
              </Badge>
              {archivedClinics.length > 0 && (
                <Badge variant="neutral" size="sm" className="font-semibold">
                  {archivedClinics.length} Archived
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
              onClick={reloadClinics}
              disabled={isRefreshing}
              className="w-full sm:w-auto min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors justify-center"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {canManageClinics && (
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
      {clinics.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="Total Locations"
            value={clinics.length.toString()}
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
                ? "bg-surface text-primary shadow-xs font-bold"
                : "text-text-muted hover:text-text"
            )}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>Active Branches ({clinics.length})</span>
          </button>
          <button
            type="button"
            data-testid="tab-archived-branches"
            onClick={() => setActiveTab("archived")}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[44px] sm:min-h-[36px]",
              activeTab === "archived"
                ? "bg-surface text-primary shadow-xs font-bold"
                : "text-text-muted hover:text-text"
            )}
          >
            <Archive className="w-3.5 h-3.5 shrink-0" />
            <span>Archived Branches ({archivedClinics.length})</span>
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. CONTENT: ACTIVE TAB vs ARCHIVED TAB
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "active" ? (
        (loading || clinicsLoading) ? (
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <CardContent className="p-0"><SkeletonTable /></CardContent>
          </Card>
        ) : clinics.length === 1 ? (
        /* ── Smart Single-Location Card View ── */
        <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text text-base sm:text-lg">{clinics[0].name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <MapPin className="w-3 h-3" />
                      <span>{clinics[0].city}{clinics[0].address ? ` — ${clinics[0].address}` : ""}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{(clinics[0] as Clinic).phone || "No phone set"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{(clinics[0] as Clinic).email || "No email set"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{formatTimings((clinics[0] as Clinic).timings)}</span>
                  </div>
                </div>

                {(clinics[0] as Clinic).facilities && ((clinics[0] as Clinic).facilities as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {((clinics[0] as Clinic).facilities as string[]).map((fac, idx) => (
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
                  onClick={() => setQrClinic(clinics[0] as Clinic)}
                >
                  <QrCode className="w-3.5 h-3.5 mr-1 text-primary-500" />
                  QR Poster
                </Button>
                {canManageClinics && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs font-semibold min-h-[44px] sm:min-h-[36px] flex-1 sm:flex-initial justify-center"
                    onClick={() => openEditModal(clinics[0] as Clinic)}
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1 text-text-muted" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {canManageClinics && (
              <div className="mt-5 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={openModal}
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer flex items-center gap-1"
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
              loading={false}
              mobileCardView
              columns={[
                {
                  key: "name",
                  header: "Location Name",
                  sortable: true,
                  render: (row: Clinic) => (
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="w-10 h-10 rounded-xl bg-surface-alt border border-border flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                        {row.image_url ? (
                          <img src={row.image_url} alt={row.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-primary-500" />
                        )}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-text text-xs sm:text-sm block truncate">{row.name}</span>
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
                  render: (row: Clinic) => (
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>{row.city}</span>
                    </div>
                  ),
                },
                {
                  key: "phone",
                  header: "Phone",
                  render: (row: Clinic) => (
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <Phone className="w-3 h-3 text-text-muted shrink-0" />
                      <span className="whitespace-nowrap">{row.phone || "—"}</span>
                    </div>
                  ),
                },
                {
                  key: "timings",
                  header: "Hours",
                  render: (row: Clinic) => (
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
                  render: (row: Clinic) => (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        className="rounded-lg font-semibold text-xs min-h-[36px] px-2.5"
                        onClick={() => setQrClinic(row)}
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1 text-primary-500" />
                        QR
                      </Button>
                      {canManageClinics && (
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
                              icon: <QrCode className="w-4 h-4 text-primary-500" />,
                              onClick: () => setQrClinic(row),
                            },
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
              data={clinics as Clinic[]}
              emptyMessage="No locations configured yet. Click 'Add Location' to register your first branch."
              renderMobileCard={(row: Clinic) => (
                <div
                  key={row.id}
                  className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-surface-alt border border-border flex items-center justify-center text-primary-600 font-bold text-sm shrink-0 overflow-hidden shadow-2xs">
                        {row.image_url ? (
                          <img src={row.image_url} alt={row.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-primary-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-text text-sm truncate">{row.name}</p>
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
                      onClick={() => setQrClinic(row)}
                    >
                      <QrCode className="w-3.5 h-3.5 mr-1 text-primary-500" />
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
                          className="text-text-muted hover:text-primary-600 transition-colors flex items-center gap-1 font-mono"
                        >
                          <Phone className="w-3 h-3 text-text-muted" />
                          <span>{row.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {canManageClinics && (
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
                        className="w-full font-semibold text-xs min-h-[42px] rounded-xl text-rose-500 hover:bg-rose-500/10 border-rose-500/30 flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Deactivate</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            />
          </CardContent>
        </Card>
      )) : (
        /* ── Archived Locations View ── */
        loadingArchived ? (
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <CardContent className="p-0"><SkeletonTable /></CardContent>
          </Card>
        ) : archivedClinics.length === 0 ? (
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs p-8 text-center">
            <Archive className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-text text-base mb-1">No Archived Branches</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
              All registered clinic branches are currently operational. When a branch is deactivated (for example, during a plan downgrade), it will be securely archived here with all historical records preserved.
            </p>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <Table
                searchable
                searchPlaceholder="Search archived locations..."
                loading={false}
                mobileCardView
                columns={[
                  {
                    key: "name",
                    header: "Location Name",
                    sortable: true,
                    render: (row: Clinic) => (
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
                    render: (row: Clinic) => (
                      <div className="flex items-center gap-1 text-xs text-text-secondary">
                        <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span>{row.city}</span>
                      </div>
                    ),
                  },
                  {
                    key: "phone",
                    header: "Phone",
                    render: (row: Clinic) => (
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
                    render: (row: Clinic) => (
                      <div className="flex items-center justify-end gap-2">
                        {canManageClinics && (
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
                data={archivedClinics}
                emptyMessage="No archived branches found."
                renderMobileCard={(row: Clinic) => (
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

                    {canManageClinics && (
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
          4. ADD / EDIT CLINIC MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? "Edit Location" : "Add New Location"}`}
        description="Configure location details, operating hours, facilities, and contact information."
        size="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
          {/* Root Admin Target Organization Selector */}
          {isRootUser(user) && organizations.length > 0 && (
            <div className="bg-primary-500/10 border border-primary-500/20 p-3.5 rounded-2xl space-y-1.5">
              <Select
                label="Target Healthcare Organization *"
                value={formData.organizationId || organizations[0]?.id || organizations[0]?._id}
                onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                options={organizations.map((o) => ({
                  value: o.id || o._id,
                  label: `${o.name} (${o.city || "Main"}) — ${o.plan?.toUpperCase() || "STARTER"} Tier`,
                }))}
              />
              <p className="text-[11px] text-text-muted">
                🛡️ <strong>Root Super-Admin Override</strong>: Select which organization tenant this clinic branch belongs to.
              </p>
            </div>
          )}

          {/* Section 1: Clinic Media & Basic Identity */}
          <div className="space-y-3.5 border-b border-border/60 pb-4">
            <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider">
              1. Branding & Clinic Identity
            </h3>

            {/* Top Logo / Photo Uploader */}
            <div className="bg-surface-alt p-3.5 border border-border/80 rounded-2xl">
              <ImageUpload
                label="Clinic Banner Photo / Logo"
                value={formData.image_url || null}
                onChange={(val) => setFormData({ ...formData, image_url: val })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <Input
                label="Clinic Name *"
                value={formData.name || ""}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                onBlur={() => validateClinicField("name", formData.name || "")}
                placeholder="e.g. HealthOS Central Clinic"
                error={clinicErrors.name}
                required
              />
              <Input
                label="City *"
                value={formData.city || ""}
                onChange={(e) => handleFieldChange("city", e.target.value)}
                onBlur={() => validateClinicField("city", formData.city || "")}
                placeholder="e.g. San Francisco"
                error={clinicErrors.city}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Phone Number"
                value={formData.phone || ""}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                placeholder="e.g. +1 415 555 0199"
              />
              <Input
                label="Email Address"
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                onBlur={() => validateClinicField("email", formData.email || "")}
                placeholder="e.g. contact@clinic.com"
                error={clinicErrors.email}
              />
            </div>

            <Input
              label="Full Physical Address"
              value={formData.address || ""}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              placeholder="e.g. 742 Evergreen Terrace, Suite 100"
            />

            <Input
              label="Clinic Overview / Description"
              placeholder="Brief summary of clinical specialties and services..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Section 2: Facilities & Operating Hours */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-primary-600 uppercase tracking-wider">
              2. Facilities & Operating Hours
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text block">Available Medical Facilities</label>
              <div className="flex flex-wrap gap-4 p-3.5 bg-surface-alt border border-border/80 rounded-2xl">
                {["Pharmacy", "Laboratory", "Parking", "Emergency Care", "Vaccination Center"].map((fac) => (
                  <Checkbox
                    key={fac}
                    label={fac}
                    checked={formData.facilities?.includes(fac) || false}
                    onChange={(e) => handleFacilityChange(fac, e.target.checked)}
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
              <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                3. Digital Payments & Countertop UPI Soundbox Routing
              </h3>
              <Badge variant="success" size="sm" className="text-[10px] font-bold">
                NPCI / Soundbox
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted">
              Configure your clinic branch&apos;s direct UPI VPA for countertop dynamic QR generation, mobile 1-tap intent payments, and autonomous soundbox announcements.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Input
                label="Clinic UPI Virtual Payment Address (VPA)"
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
              {editingId ? "Update Clinic Configuration" : "Save Clinic Location"}
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
        title="Deactivate Clinic Location?"
        description="Are you sure you want to deactivate this clinic location? All patient encounters, appointments, and medical records will remain safely preserved. You can reactivate this branch anytime from the Archived Branches tab as permitted by your subscription plan."
        variant="danger"
        confirmLabel="Deactivate"
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          6. CLINIC QR POSTER MODAL (A4 STANDEE & DIRECT JOIN FLOW)
         ────────────────────────────────────────────────────────────────────────── */}
      <ClinicQrPosterModal
        open={!!qrClinic}
        onClose={() => setQrClinic(null)}
        clinic={qrClinic}
      />
    </div>
  );
}
