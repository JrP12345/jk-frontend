"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
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
  Activity,
  Phone,
  Mail,
  Clock,
  QrCode,
  MoreHorizontal,
  Edit3,
  Trash2,
  Printer,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

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
    } else if (field === "city" && !value.trim()) {
      error = "City is required";
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

  const reloadClinics = async () => {
    try {
      setIsRefreshing(true);
      await fetchClinics(true);
    } catch {
      toast({ title: "Error", description: "Failed to load clinics list", variant: "error" });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    reloadClinics();
  }, [fetchClinics]);

  const openModal = () => {
    setEditingId(null);
    const defaultOrgId = organizations.length > 0 ? organizations[0].id || organizations[0]._id : "";
    setFormData({ facilities: [], organizationId: defaultOrgId });
    setClinicErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (row: Clinic) => {
    setEditingId(row.id);
    setFormData({ ...row, facilities: row.facilities || [] });
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
      await fetchClinics(true);
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
      toast({ title: "Success", description: "Clinic deactivated successfully!", variant: "success" });
      await fetchClinics(true);
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
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Clinics Management
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Facility Operations
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Configure physical clinic locations, operating schedules, medical facilities, and reception QR portals.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={reloadClinics}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {canManageClinics && (
              <Button
                variant="primary"
                size="sm"
                onClick={openModal}
                className="font-semibold rounded-xl shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Clinic
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. FACILITY KPI STATS CARDS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Active Clinics"
          value={clinics.length.toString()}
          description="Registered healthcare facilities"
          icon={<Building2 className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Cities Covered"
          value={uniqueCities.length.toString()}
          description="Distinct geographic territories"
          icon={<MapPin className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Specialty Services"
          value={totalFacilities.length.toString()}
          description="Active clinical departments & labs"
          icon={<Activity className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. CLINICS ROSTER TABLE
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table
            searchable
            searchPlaceholder="Search clinics by name, city, or address..."
            loading={loading || clinicsLoading}
            columns={[
              {
                key: "name",
                header: "Facility Name",
                sortable: true,
                render: (row: Clinic) => (
                  <div className="space-y-0.5 min-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                      <span className="font-bold text-text text-xs sm:text-sm">{row.name}</span>
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
                header: "City / Region",
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
                key: "email",
                header: "Email",
                render: (row: Clinic) => (
                  <div className="flex items-center gap-1 text-xs text-text-secondary">
                    <Mail className="w-3 h-3 text-text-muted shrink-0" />
                    <span className="truncate max-w-[140px]" title={row.email}>
                      {row.email || "—"}
                    </span>
                  </div>
                ),
              },
              {
                key: "timings",
                header: "Operating Hours",
                render: (row: Clinic) => (
                  <div className="flex items-center gap-1 text-xs text-text-secondary">
                    <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{formatTimings(row.timings)}</span>
                  </div>
                ),
              },
              {
                key: "facilities",
                header: "Facilities",
                render: (row: Clinic) => (
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {row.facilities && row.facilities.length > 0 ? (
                      row.facilities.map((fac, idx) => (
                        <Badge key={idx} variant="primary" size="sm" className="text-[9px] font-semibold">
                          {fac}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
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
                      className="rounded-lg font-semibold text-xs"
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
                            className="h-7 w-7 p-0 flex items-center justify-center rounded-lg text-text-secondary hover:text-text"
                            title="Row Actions"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        }
                        items={[
                          {
                            label: "Reception QR Code",
                            icon: <QrCode className="w-4 h-4 text-primary-500" />,
                            onClick: () => setQrClinic(row),
                          },
                          {
                            label: "Edit Configuration",
                            icon: <Edit3 className="w-4 h-4 text-text-muted" />,
                            onClick: () => openEditModal(row),
                          },
                          { divider: true, label: "" },
                          {
                            label: "Deactivate Clinic",
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
            emptyMessage="No clinics configured yet. Click 'Add Clinic' to register your first branch."
          />
        </CardContent>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. ADD / EDIT CLINIC MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? "Update Clinic Configuration" : "Add New Clinic Location"}`}
        description="Configure facility details, operating hours, available medical services, and address."
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

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submitting} className="font-semibold rounded-xl shadow-xs">
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
        description="Are you sure you want to deactivate this clinic location? Staff linked to this clinic will remain registered, but their location link will need to be updated."
        variant="danger"
        confirmLabel="Deactivate"
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          6. RECEPTION QR CODE MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!qrClinic}
        onClose={() => setQrClinic(null)}
        title="Clinic Reception QR Code"
        description="Display this QR card at your reception desk so patients can scan to book online."
        size="md"
      >
        {qrClinic && (
          <div className="space-y-4 text-center pt-1">
            {/* Printable QR Card Frame */}
            <div
              id="printable-qr-card"
              className="border border-border rounded-2xl p-6 bg-white max-w-sm mx-auto shadow-md text-slate-800 animate-fade-in"
            >
              <div className="text-center space-y-1 mb-3">
                <span className="text-[10px] font-bold tracking-widest text-primary-600 uppercase">
                  Healthcare Portal
                </span>
                <h3 className="text-lg font-bold text-slate-900">{qrClinic.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{qrClinic.city}</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 flex justify-center items-center my-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    `${typeof window !== "undefined" ? window.location.origin : ""}/browse/${qrClinic.id}`
                  )}`}
                  alt={`${qrClinic.name} Booking QR`}
                  className="w-44 h-44 bg-white border border-slate-200 p-2 shadow-xs rounded-lg"
                />
              </div>

              <div className="text-center space-y-0.5 mt-3">
                <p className="text-xs font-bold text-slate-900">SCAN TO BOOK</p>
                <p className="text-[10px] text-slate-500 font-semibold">Check live queues & book appointments</p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button variant="outline" size="sm" type="button" onClick={() => setQrClinic(null)}>
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="font-semibold rounded-xl shadow-xs"
                onClick={() => {
                  const printContent = document.getElementById("printable-qr-card")?.innerHTML;
                  if (printContent) {
                    const printWindow = window.open("", "_blank");
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Print QR Card - ${qrClinic.name}</title>
                            <style>
                              body { margin: 0; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: white; }
                              .card { border: 2px solid #e2e8f0; border-radius: 1rem; padding: 2rem; max-width: 320px; text-align: center; }
                            </style>
                          </head>
                          <body>
                            <div class="card">${printContent}</div>
                            <script>
                              window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }
                }}
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print QR Card
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
