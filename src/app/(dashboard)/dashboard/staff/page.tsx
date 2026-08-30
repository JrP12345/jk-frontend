"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  Tabs,
  Button,
  Modal,
  Input,
  useToast,
  Spinner,
  ImageUpload,
  ConfirmDialog,
  ScheduleEditor,
  Select,
  SkeletonTable,
  Dropdown,
  Badge,
  StatCard,
  cn,
} from "@/components/ui";
import { useR2Upload } from "@/hooks/useR2Upload";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";
import { ExecutiveAnalytics } from "@/components/analytics/ExecutiveAnalytics";
import {
  RotateCw,
  Plus,
  UserPlus,
  UserCheck,
  Users,
  Stethoscope,
  User,
  ShieldCheck,
  MoreHorizontal,
  Edit3,
  Trash2,
  Building2,
  Mail,
  Phone,
  Clock,
  Activity,
  Eye,
  EyeOff,
  Ticket,
  CheckCircle2,
} from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  qualification: string;
  experience_years: number;
}

interface Receptionist {
  id: string;
  name: string;
  email: string;
  phone: string;
  shift: string;
  clinicId?: string;
  clinicName?: string;
}

export default function StaffPage() {
  const { toast } = useToast();
  const { uploadFile } = useR2Upload();
  const { activeClinicId, user } = useAuthStore();
  const { clinics, fetchClinics } = useClinicStore();
  const canManageStaff = hasAnyPermission(user, "MANAGE_STAFF");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [labTechs, setLabTechs] = useState<any[]>([]);
  const [pharmacists, setPharmacists] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [customStaff, setCustomStaff] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>("doctor");
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  const allRoleOptions = useMemo(() => {
    const builtInMap: Record<string, string> = {
      doctor: "Doctor / Clinical Practitioner",
      receptionist: "Receptionist / Front Desk",
      nurse: "Nurse / Clinical Support",
      lab_tech: "Laboratory Technician",
      pharmacist: "Pharmacist / Dispenser",
      cashier: "Cashier / Accounts Desk",
    };

    const options = [
      { value: "doctor", label: "Doctor / Clinical Practitioner" },
      { value: "receptionist", label: "Receptionist / Front Desk" },
      { value: "nurse", label: "Nurse / Clinical Support" },
      { value: "lab_tech", label: "Laboratory Technician" },
      { value: "pharmacist", label: "Pharmacist / Dispenser" },
      { value: "cashier", label: "Cashier / Accounts Desk" },
    ];

    roles.forEach((r) => {
      if (!builtInMap[r.name] && r.name !== "admin" && r.name !== "root" && r.name !== "patient") {
        const formattedLabel = `${r.name.replace(/_/g, " ").toUpperCase()} (Custom Role)`;
        options.push({ value: r.name, label: formattedLabel });
      }
    });

    return options;
  }, [roles]);

  const allStaffMembers = useMemo(() => {
    const list: any[] = [];
    doctors.forEach((d) =>
      list.push({
        ...d,
        roleType: "doctor",
        roleLabel: "Doctor",
        details: d.specialization
          ? `${d.specialization} (${d.qualification || "MD"})`
          : d.qualification || "—",
      })
    );
    receptionists.forEach((r) =>
      list.push({
        ...r,
        roleType: "receptionist",
        roleLabel: "Receptionist",
        details: r.clinicName ? `Clinic: ${r.clinicName}` : r.shift || "—",
      })
    );
    nurses.forEach((n) =>
      list.push({
        ...n,
        roleType: "nurse",
        roleLabel: "Nurse",
        details: n.clinicName ? `Clinic: ${n.clinicName}` : n.organizationName ? `Org: ${n.organizationName}` : "Nurse Staff",
      })
    );
    labTechs.forEach((l) =>
      list.push({
        ...l,
        roleType: "lab_tech",
        roleLabel: "Lab Tech",
        details: l.clinicName ? `Clinic: ${l.clinicName}` : l.organizationName ? `Org: ${l.organizationName}` : "Lab Technician",
      })
    );
    pharmacists.forEach((p) =>
      list.push({
        ...p,
        roleType: "pharmacist",
        roleLabel: "Pharmacist",
        details: p.clinicName ? `Clinic: ${p.clinicName}` : p.organizationName ? `Org: ${p.organizationName}` : "Pharmacist",
      })
    );
    cashiers.forEach((c) =>
      list.push({
        ...c,
        roleType: "cashier",
        roleLabel: "Cashier",
        details: c.clinicName ? `Clinic: ${c.clinicName}` : c.organizationName ? `Org: ${c.organizationName}` : "Billing Cashier",
      })
    );
    customStaff.forEach((s) =>
      list.push({
        ...s,
        roleType: s.role,
        roleLabel: (s.role || "").replace(/_/g, " ").toUpperCase(),
        details: s.clinicName
          ? `Clinic: ${s.clinicName}`
          : s.organizationName
          ? `Org: ${s.organizationName}`
          : s.department || s.specialization || "Staff Member",
      })
    );
    return list;
  }, [doctors, receptionists, nurses, labTechs, pharmacists, cashiers, customStaff]);

  const roleFilterTabs = useMemo(() => {
    const tabs = [
      { key: "all", label: "All Staff", count: allStaffMembers.length },
      { key: "doctor", label: "Doctors", count: doctors.length },
      { key: "receptionist", label: "Receptionists", count: receptionists.length },
      { key: "nurse", label: "Nurses", count: nurses.length },
      { key: "lab_tech", label: "Lab Techs", count: labTechs.length },
      { key: "pharmacist", label: "Pharmacists", count: pharmacists.length },
      { key: "cashier", label: "Cashiers", count: cashiers.length },
    ];

    const customCounts: Record<string, number> = {};
    customStaff.forEach((s) => {
      if (s.role) customCounts[s.role] = (customCounts[s.role] || 0) + 1;
    });

    Object.keys(customCounts).forEach((roleName) => {
      tabs.push({
        key: roleName,
        label: roleName.replace(/_/g, " ").toUpperCase(),
        count: customCounts[roleName],
      });
    });

    return tabs;
  }, [allStaffMembers, doctors, receptionists, nurses, labTechs, pharmacists, cashiers, customStaff]);

  const [staffErrors, setStaffErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Admin Doctor Profile State
  const [isAdminDoctorModalOpen, setIsAdminDoctorModalOpen] = useState(false);
  const [adminDoctorData, setAdminDoctorData] = useState<any>({
    specialization: "General Physician / Consultant",
    qualification: "MBBS, MD",
    fees: 500,
    registrationNumber: "",
  });
  const [savingAdminDoctor, setSavingAdminDoctor] = useState(false);

  // Doctor Assignments State
  const [selectedDoctorForAssignments, setSelectedDoctorForAssignments] = useState<Doctor | null>(null);
  const [isAssignmentsModalOpen, setIsAssignmentsModalOpen] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState<any>({
    clinicId: "",
    fees: 100,
    appointmentDuration: 15,
    workingHours: "",
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  const filteredStaff = useMemo(() => {
    if (selectedRoleFilter === "all") return allStaffMembers;
    return allStaffMembers.filter((s) => s.roleType === selectedRoleFilter);
  }, [allStaffMembers, selectedRoleFilter]);

  const handleEnableAdminDoctorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminDoctorData.specialization) {
      toast({ title: "Validation Required", description: "Please enter your clinical specialization.", variant: "error" });
      return;
    }
    setSavingAdminDoctor(true);
    try {
      await api.post("/onboarding/admin/enable-doctor-profile", adminDoctorData);
      toast({
        title: "Doctor Profile Linked",
        description: "Clinical doctor profile has been linked to your admin account.",
        variant: "success",
      });
      setIsAdminDoctorModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      toast({
        title: "Unable to Link Profile",
        description: err.response?.data?.message || "Failed to link doctor profile. Please try again.",
        variant: "error",
      });
    } finally {
      setSavingAdminDoctor(false);
    }
  };

  const validateStaffField = (field: string, value: any) => {
    let error = "";
    const val = typeof value === "string" ? value.trim() : value;

    if (field === "name" && !val) {
      error = "Full Name is required";
    } else if (field === "email") {
      if (!val) {
        error = "Email is required";
      } else if (!EMAIL_REGEX.test(val)) {
        error = "Please enter a valid email address";
      }
    } else if (field === "password" && !editingId) {
      if (!val) {
        error = "Password is required";
      } else if (val.length < 6) {
        error = "Password must be at least 6 characters";
      }
    } else if (field === "specialization" && modalType === "doctor" && !val) {
      error = "Specialization is required";
    } else if (field === "clinicId" && modalType === "receptionist" && !val) {
      error = "Clinic assignment is required";
    }

    setStaffErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return !error;
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    if (staffErrors[field]) {
      setStaffErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const fetchStaff = async () => {
    try {
      const url = activeClinicId ? `/onboarding/staff?clinicId=${activeClinicId}` : "/onboarding/staff";
      const res = await api.get(url);
      const data = res.data.data || {};
      setDoctors(data.doctors || []);
      setReceptionists(data.receptionists || []);
      setNurses(data.nurses || []);
      setLabTechs(data.labTechs || []);
      setPharmacists(data.pharmacists || []);
      setCashiers(data.cashiers || []);

      const allStaff = data.allStaff || [];
      const builtInRoles = new Set(["doctor", "receptionist", "nurse", "lab_tech", "pharmacist", "cashier"]);
      setCustomStaff(allStaff.filter((s: any) => !builtInRoles.has(s.role)));
    } catch {
      toast({ title: "Error", description: "Failed to load staff list", variant: "error" });
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get("/roles");
      setRoles(res.data?.data || []);
    } catch {
      console.error("Failed to load custom roles list");
    }
  };

  const loadData = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([fetchStaff(), fetchClinics(), fetchRoles()]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeClinicId]);

  const openModal = (type: "doctor" | "receptionist" | "nurse" | "lab_tech" | "pharmacist" | "cashier") => {
    setEditingId(null);
    setModalType(type);
    setFormData({});
    setStaffErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (
    type: "doctor" | "receptionist" | "nurse" | "lab_tech" | "pharmacist" | "cashier",
    row: any
  ) => {
    setEditingId(row.id);
    setModalType(type);
    setFormData({ ...row });
    setStaffErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNameValid = validateStaffField("name", formData.name || "");
    const isEmailValid = validateStaffField("email", formData.email || "");
    const isPassValid = editingId ? true : validateStaffField("password", formData.password || "");
    const isSpecValid = modalType === "doctor" ? validateStaffField("specialization", formData.specialization || "") : true;
    const isClinicValid = modalType === "receptionist" ? validateStaffField("clinicId", formData.clinicId || "") : true;

    if (!isNameValid || !isEmailValid || !isPassValid || !isSpecValid || !isClinicValid) {
      toast({ title: "Validation Error", description: "Please correct the highlighted errors.", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      let finalData = { ...formData };

      // Handle deferred image upload
      if (finalData.image_url instanceof File) {
        toast({ title: "Uploading...", description: "Uploading profile image to Cloudflare R2", variant: "default" });
        const { publicUrl } = await uploadFile(finalData.image_url);
        finalData.image_url = publicUrl;
      }

      if (editingId) {
        const updateEndpoint =
          modalType === "doctor" || modalType === "receptionist"
            ? `/onboarding/${modalType}/${editingId}`
            : `/onboarding/staff/${editingId}`;
        await api.put(updateEndpoint, finalData);
        toast({ title: "Success", description: "Staff member updated successfully!", variant: "success" });
      } else if (modalType === "doctor" || modalType === "receptionist") {
        await api.post(`/onboarding/${modalType}`, finalData);
        toast({ title: "Success", description: "Staff member registered successfully!", variant: "success" });
      } else {
        await api.post(`/onboarding/staff`, { ...finalData, role: modalType });
        toast({
          title: "Success",
          description: `${modalType.replace("_", " ").toUpperCase()} registered successfully!`,
          variant: "success",
        });
      }
      setIsModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to save staff member",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/onboarding/staff/${deletingId}`);
      toast({ title: "Success", description: "Staff deactivated successfully!", variant: "success" });
      fetchStaff();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to delete staff member",
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const DEFAULT_WORKING_HOURS = JSON.stringify({
    Monday: [{ start: "09:00", end: "17:00" }],
    Tuesday: [{ start: "09:00", end: "17:00" }],
    Wednesday: [{ start: "09:00", end: "17:00" }],
    Thursday: [{ start: "09:00", end: "17:00" }],
    Friday: [{ start: "09:00", end: "17:00" }],
  });

  // Assignments Handlers
  const openAssignmentsModal = async (doctor: Doctor) => {
    setSelectedDoctorForAssignments(doctor);
    setIsAssignmentsModalOpen(true);
    setAssignmentLoading(true);
    setEditingAssignmentId(null);
    try {
      const res = await api.get(`/onboarding/doctors/assignments?doctorId=${doctor.id}`);
      setAssignments(res.data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load clinic assignments", variant: "error" });
    } finally {
      setAssignmentLoading(false);
    }
    setNewAssignment({
      clinicId: "",
      fees: 100,
      appointmentDuration: 15,
      workingHours: DEFAULT_WORKING_HOURS,
      bookingMode: "sequential_queue",
      maxDailyTokens: "",
    });
  };

  const handleStartEditAssignment = (asg: any) => {
    setEditingAssignmentId(asg.id || asg._id);
    setNewAssignment({
      clinicId: asg.clinicId?.id || asg.clinicId?._id || asg.clinicId,
      fees: asg.fees ?? 100,
      appointmentDuration: asg.appointmentDuration ?? 15,
      workingHours: asg.workingHours || DEFAULT_WORKING_HOURS,
      bookingMode: asg.bookingMode || "sequential_queue",
      maxDailyTokens: asg.maxDailyTokens ? String(asg.maxDailyTokens) : "",
    });
  };

  const handleCancelEditAssignment = () => {
    setEditingAssignmentId(null);
    setNewAssignment({
      clinicId: "",
      fees: 100,
      appointmentDuration: 15,
      workingHours: DEFAULT_WORKING_HOURS,
      bookingMode: "sequential_queue",
      maxDailyTokens: "",
    });
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.clinicId || newAssignment.fees === undefined) {
      toast({
        title: "Validation Error",
        description: "Please select a clinic location and set consultation fees.",
        variant: "error",
      });
      return;
    }
    const finalHours =
      newAssignment.workingHours && newAssignment.workingHours !== "{}"
        ? newAssignment.workingHours
        : DEFAULT_WORKING_HOURS;
    setSavingAssignment(true);
    try {
      if (editingAssignmentId) {
        await api.put(`/onboarding/doctors/assignments/${editingAssignmentId}`, {
          fees: Number(newAssignment.fees),
          appointmentDuration: Number(newAssignment.appointmentDuration),
          workingHours: finalHours,
          bookingMode: (newAssignment as any).bookingMode || "sequential_queue",
          maxDailyTokens: (newAssignment as any).maxDailyTokens ? Number((newAssignment as any).maxDailyTokens) : null,
        });
        toast({ title: "Updated", description: "Doctor clinic assignment updated successfully.", variant: "success" });
      } else {
        await api.post("/onboarding/doctors/assignments", {
          doctorId: selectedDoctorForAssignments?.id,
          clinicId: newAssignment.clinicId,
          fees: Number(newAssignment.fees),
          appointmentDuration: Number(newAssignment.appointmentDuration),
          workingHours: finalHours,
          bookingMode: (newAssignment as any).bookingMode || "sequential_queue",
          maxDailyTokens: (newAssignment as any).maxDailyTokens ? Number((newAssignment as any).maxDailyTokens) : null,
        });
        toast({ title: "Assigned", description: "Doctor assigned to clinic branch successfully.", variant: "success" });
      }
      const res = await api.get(`/onboarding/doctors/assignments?doctorId=${selectedDoctorForAssignments?.id}`);
      setAssignments(res.data.data || []);
      setEditingAssignmentId(null);
      setNewAssignment({
        clinicId: "",
        fees: 100,
        appointmentDuration: 15,
        workingHours: DEFAULT_WORKING_HOURS,
        bookingMode: "sequential_queue",
        maxDailyTokens: "",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to save assignment", variant: "error" });
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await api.delete(`/onboarding/doctors/assignments/${assignmentId}`);
      toast({ title: "Removed", description: "Doctor assignment removed successfully.", variant: "success" });
      if (editingAssignmentId === assignmentId) {
        setEditingAssignmentId(null);
        setNewAssignment({
          clinicId: "",
          fees: 100,
          appointmentDuration: 15,
          workingHours: DEFAULT_WORKING_HOURS,
          bookingMode: "sequential_queue",
          maxDailyTokens: "",
        });
      }
      const res = await api.get(`/onboarding/doctors/assignments?doctorId=${selectedDoctorForAssignments?.id}`);
      setAssignments(res.data.data || []);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to remove assignment",
        variant: "error",
      });
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
          return `${firstSlot.start} - ${firstSlot.end} (${days.length} days)`;
        }
      }
      return "Not specified";
    } catch {
      return timingsStr;
    }
  };

  const availableClinics = clinics.filter(
    (c) => !assignments.some((a) => (a.clinicId?.id || a.clinicId) === c.id)
  );

  const totalPhysicians = doctors.length;
  const totalFrontDesk = receptionists.length;
  const totalAllied = nurses.length + labTechs.length + pharmacists.length + cashiers.length + customStaff.length;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-surface-alt rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-surface-alt rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-32 bg-surface-alt rounded-lg animate-pulse" />
            <div className="h-9 w-28 bg-surface-alt rounded-lg animate-pulse" />
          </div>
        </div>
        <SkeletonTable rows={6} cols={5} />
      </div>
    );
  }

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
                Staff & Practitioner Management
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                HR & Workforce
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Manage clinical practitioners, receptionists, clinic branch assignments, and RBAC governance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canManageStaff && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdminDoctorModalOpen(true)}
                  className="rounded-xl text-xs font-semibold hover:bg-surface-hover"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                  Link Doctor to Admin
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openModal("doctor")}
                  className="font-semibold rounded-xl shadow-xs"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  Add Staff Member
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. WORKFORCE KPI STATS CARDS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Staff Workforce"
          value={allStaffMembers.length.toString()}
          description="Active accounts in organization"
          icon={<Users className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Clinical Physicians"
          value={totalPhysicians.toString()}
          description="Assigned OPD specialists"
          icon={<Stethoscope className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Front Desk Reception"
          value={totalFrontDesk.toString()}
          description="Desk coordinators & intake"
          icon={<User className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Allied Specialists"
          value={totalAllied.toString()}
          description="Nurses, lab techs & pharmacy"
          icon={<ShieldCheck className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. TABS NAVIGATION (DIRECTORY, RBAC, ANALYTICS)
         ────────────────────────────────────────────────────────────────────────── */}
      <Tabs
        variant="pills"
        tabs={[
          {
            id: "directory",
            label: `Staff Directory (${allStaffMembers.length})`,
            icon: <Users className="w-4 h-4" />,
            content: (
              <div className="space-y-4 pt-1">
                {/* Role Filter Bar */}
                <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
                  <span className="text-[11px] font-bold text-text-muted px-2.5 shrink-0">Filter:</span>
                  {roleFilterTabs.map((filter) => {
                    const isSelected = selectedRoleFilter === filter.key;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setSelectedRoleFilter(filter.key)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0",
                          isSelected
                            ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                            : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
                        )}
                      >
                        <span>{filter.label}</span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                            isSelected
                              ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                              : "bg-surface-alt text-text-muted"
                          )}
                        >
                          {filter.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
                  <CardContent className="p-0">
                    <Table
                      searchable
                      searchPlaceholder="Search staff members by name, email, role, or specialty..."
                      columns={[
                        {
                          key: "name",
                          header: "Staff Member",
                          sortable: true,
                          render: (row) => (
                            <div className="space-y-0.5 min-w-[140px]">
                              <span className="font-bold text-text text-xs sm:text-sm">{row.name}</span>
                            </div>
                          ),
                        },
                        {
                          key: "roleLabel",
                          header: "Designation",
                          sortable: true,
                          render: (row) => (
                            <Badge
                              variant={
                                row.roleType === "doctor"
                                  ? "primary"
                                  : row.roleType === "receptionist"
                                  ? "success"
                                  : row.roleType === "nurse"
                                  ? "warning"
                                  : "neutral"
                              }
                              size="sm"
                              className="font-semibold text-[10px] capitalize"
                            >
                              {row.roleLabel}
                            </Badge>
                          ),
                        },
                        {
                          key: "email",
                          header: "Email Address",
                          sortable: true,
                          render: (row) => (
                            <div className="flex items-center gap-1 text-xs text-text-secondary">
                              <Mail className="w-3 h-3 text-text-muted shrink-0" />
                              <span className="truncate max-w-[150px]">{row.email}</span>
                            </div>
                          ),
                        },
                        {
                          key: "phone",
                          header: "Phone Number",
                          sortable: true,
                          render: (row) => (
                            <div className="flex items-center gap-1 text-xs text-text-secondary">
                              <Phone className="w-3 h-3 text-text-muted shrink-0" />
                              <span>{row.phone || "—"}</span>
                            </div>
                          ),
                        },
                        {
                          key: "details",
                          header: "Details / Branch",
                          sortable: true,
                          render: (row) => (
                            <div className="flex items-center gap-1 text-xs text-text-muted">
                              <Building2 className="w-3 h-3 text-text-muted shrink-0" />
                              <span className="truncate max-w-[160px]">{row.details}</span>
                            </div>
                          ),
                        },
                        {
                          key: "actions",
                          header: "Actions",
                          align: "right",
                          width: "56px",
                          render: (row) => (
                            <div className="flex items-center justify-end">
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
                                  ...(row.roleType === "doctor"
                                    ? [
                                        {
                                          label: "Manage Clinic Assignments",
                                          icon: <Stethoscope className="w-4 h-4 text-primary-500" />,
                                          onClick: () => openAssignmentsModal(row),
                                        },
                                      ]
                                    : []),
                                  {
                                    label: `Edit ${row.roleLabel}`,
                                    icon: <Edit3 className="w-4 h-4 text-text-muted" />,
                                    onClick: () => openEditModal(row.roleType, row),
                                  },
                                  { divider: true, label: "" },
                                  {
                                    label: `Deactivate ${row.roleLabel}`,
                                    icon: <Trash2 className="w-4 h-4 text-danger" />,
                                    variant: "danger" as any,
                                    onClick: () => setDeletingId(row.id),
                                  },
                                ]}
                              />
                            </div>
                          ),
                        },
                      ]}
                      data={filteredStaff}
                      loading={loading}
                      emptyMessage="No staff members match the selected filter."
                    />
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: "rbac",
            label: "RBAC Governance & Permissions",
            content: (
              <div className="pt-2">
                <RBACPermissionMatrix
                  users={allStaffMembers.map((s) => ({
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    role: s.roleType,
                    permissions: s.permissions || [],
                  }))}
                  onRefresh={loadData}
                />
              </div>
            ),
          },
          {
            id: "analytics",
            label: "Executive BI & Analytics",
            content: (
              <div className="pt-2">
                <ExecutiveAnalytics />
              </div>
            ),
          },
        ]}
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          4. STAFF ADD/EDIT MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? "Update" : "Register"} ${modalType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Profile`}
        description="Set staff credentials, contact details, clinic branch assignment, and professional credentials."
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1" noValidate>
          {!editingId && (
            <Select
              label="Staff Account Role & Designation *"
              value={modalType}
              onChange={(e) => {
                setModalType(e.target.value as any);
                setStaffErrors({});
              }}
              options={allRoleOptions}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Full Name *"
              value={formData.name || ""}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              onBlur={() => validateStaffField("name", formData.name || "")}
              placeholder="e.g. Dr. Sarah Jenkins, MD"
              error={staffErrors.name}
              required
            />
            <Input
              label="Phone Number"
              value={formData.phone || ""}
              onChange={(e) => handleFieldChange("phone", e.target.value)}
              placeholder="e.g. +1 415 555 0199"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Email Address *"
              type="email"
              value={formData.email || ""}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              onBlur={() => validateStaffField("email", formData.email || "")}
              placeholder="e.g. sarah.jenkins@clinic.com"
              error={staffErrors.email}
              required
            />
            {!editingId && (
              <Input
                label="Password *"
                type={showPassword ? "text" : "password"}
                value={formData.password || ""}
                onChange={(e) => handleFieldChange("password", e.target.value)}
                onBlur={() => validateStaffField("password", formData.password || "")}
                placeholder="Min 6 characters"
                error={staffErrors.password}
                required
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-text-muted hover:text-text rounded-md hover:bg-surface-hover/50 transition-all cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            )}
          </div>

          {modalType === "doctor" && (
            <div className="space-y-3.5 border-t border-border/60 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <Input
                  label="Specialization *"
                  placeholder="e.g. Cardiologist"
                  value={formData.specialization || ""}
                  onChange={(e) => handleFieldChange("specialization", e.target.value)}
                  onBlur={() => validateStaffField("specialization", formData.specialization || "")}
                  error={staffErrors.specialization}
                  required
                />
                <Input
                  label="Qualification"
                  placeholder="e.g. MBBS, MD"
                  value={formData.qualification || ""}
                  onChange={(e) => handleFieldChange("qualification", e.target.value)}
                />
                <Input
                  label="Experience (Years)"
                  type="number"
                  value={formData.experience_years || ""}
                  onChange={(e) => handleFieldChange("experience_years", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="bg-surface-alt p-3.5 border border-border/80 rounded-2xl">
                <ImageUpload
                  label="Practitioner Profile Photo"
                  value={formData.image_url || null}
                  onChange={(val) => handleFieldChange("image_url", val)}
                />
              </div>
              <Input
                label="Short Biography / Overview"
                placeholder="About practitioner's background and achievements..."
                value={formData.description || ""}
                onChange={(e) => handleFieldChange("description", e.target.value)}
              />
            </div>
          )}

          {modalType === "receptionist" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-border/60 pt-3">
              <Select
                label="Assign Clinic *"
                value={formData.clinicId || ""}
                onChange={(e) => handleFieldChange("clinicId", e.target.value)}
                error={staffErrors.clinicId}
                placeholder="Choose a clinic branch..."
                options={clinics.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Input
                label="Shift Schedule"
                placeholder="e.g. Morning (08:00 - 16:00)"
                value={formData.shift || ""}
                onChange={(e) => handleFieldChange("shift", e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60 mt-4">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submitting} className="font-semibold rounded-xl shadow-xs">
              {editingId ? "Update Staff Profile" : "Register Staff Member"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. DOCTOR CLINIC ASSIGNMENTS MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isAssignmentsModalOpen}
        onClose={() => setIsAssignmentsModalOpen(false)}
        title={`Clinic Branch Assignments — Dr. ${selectedDoctorForAssignments?.name || ""}`}
        description="Link this practitioner to branch locations with custom consultation fees, slot durations, and working hours."
        size="2xl"
      >
        <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
          {/* Active Assignments Card */}
          <div className="border border-border/80 rounded-2xl p-4 space-y-3 bg-surface-alt/30">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
                <span>Active Branch Assignments</span>
                <Badge variant="primary" size="sm" className="font-semibold">
                  {assignments.length}
                </Badge>
              </h3>
            </div>

            {assignmentLoading ? (
              <div className="flex justify-center p-8">
                <Spinner size="md" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/80 rounded-2xl bg-surface space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-500">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-text">No Clinic Branches Assigned Yet</h4>
                <p className="text-xs text-text-muted max-w-sm">
                  Assign this practitioner to a clinic branch below to configure fees and consultation schedules.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border/80 bg-surface shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-[10px] font-bold text-text-muted uppercase tracking-wider bg-surface-alt">
                      <th className="p-3">Clinic Branch</th>
                      <th className="p-3">Fee</th>
                      <th className="p-3">Slot Duration</th>
                      <th className="p-3">Booking Mode</th>
                      <th className="p-3">Working Shift</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {assignments.map((asg) => (
                      <tr key={asg.id || asg._id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="p-3 text-text font-bold whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                            <span>{asg.clinicId?.name || "Clinic Branch"}</span>
                          </div>
                        </td>
                        <td className="p-3 text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                          ₹{asg.fees}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-surface-alt rounded-lg font-semibold text-text-secondary border border-border/60">
                            {asg.appointmentDuration} mins
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant={asg.bookingMode === "sequential_queue" ? "primary" : "neutral"}
                            size="sm"
                            className="font-semibold text-[10px]"
                          >
                            {asg.bookingMode === "sequential_queue" ? "Token Queue" : "Time Slots"}
                          </Badge>
                        </td>
                        <td className="p-3 text-text-muted whitespace-normal text-xs">
                          {formatTimings(asg.workingHours)}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleStartEditAssignment(asg)}
                              className="font-semibold text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleRemoveAssignment(asg.id || asg._id)}
                              className="font-semibold text-xs"
                            >
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add / Edit Assignment Form Card */}
          {availableClinics.length > 0 || editingAssignmentId ? (
            <form
              onSubmit={handleAddAssignment}
              className="border border-border/80 rounded-2xl p-4 space-y-3.5 bg-surface shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                  {editingAssignmentId ? "Edit Branch Assignment & Schedule" : "Assign to New Clinic Branch"}
                </h3>
                {editingAssignmentId && (
                  <Button type="button" variant="outline" size="xs" onClick={handleCancelEditAssignment}>
                    Cancel Edit
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <Select
                  label="Patient Booking Mode *"
                  value={(newAssignment as any).bookingMode || "sequential_queue"}
                  onChange={(e) => setNewAssignment({ ...newAssignment, bookingMode: e.target.value } as any)}
                  options={[
                    { value: "sequential_queue", label: "Sequential Queue Mode (Live Token Stream)" },
                    { value: "time_slot", label: "Time-Slot Mode (Fixed Calendar Slots)" },
                  ]}
                  required
                />

                {editingAssignmentId ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text block">Clinic Branch</label>
                    <div className="p-2.5 bg-surface-alt border border-border/80 rounded-xl text-xs font-bold text-text flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-primary-500" />
                      <span>
                        {assignments.find((a) => (a.id || a._id) === editingAssignmentId)?.clinicId?.name ||
                          "Selected Branch"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <Select
                    label="Select Clinic Branch *"
                    value={newAssignment.clinicId}
                    onChange={(e) => setNewAssignment({ ...newAssignment, clinicId: e.target.value })}
                    options={[
                      { value: "", label: "Choose a clinic branch..." },
                      ...availableClinics.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                    required
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <Input
                  label="Consultation Fee (₹) *"
                  type="number"
                  value={newAssignment.fees}
                  onChange={(e) => setNewAssignment({ ...newAssignment, fees: Number(e.target.value) })}
                  required
                />
                <Input
                  label={
                    (newAssignment as any).bookingMode === "time_slot"
                      ? "Slot Duration (Minutes) *"
                      : "Avg Time / Patient (Mins) *"
                  }
                  type="number"
                  value={newAssignment.appointmentDuration}
                  onChange={(e) =>
                    setNewAssignment({ ...newAssignment, appointmentDuration: Number(e.target.value) })
                  }
                  required
                />
                <Input
                  label="Max Daily Tokens (Optional)"
                  type="number"
                  placeholder="e.g. 40 (blank for unlimited)"
                  value={(newAssignment as any).maxDailyTokens || ""}
                  onChange={(e) =>
                    setNewAssignment({ ...newAssignment, maxDailyTokens: e.target.value } as any)
                  }
                />
              </div>

              <ScheduleEditor
                label="Working Days & Operating Hours *"
                value={newAssignment.workingHours}
                onChange={(val) => setNewAssignment({ ...newAssignment, workingHours: val })}
              />

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border/60">
                <Button
                  type="submit"
                  loading={savingAssignment}
                  size="sm"
                  variant="primary"
                  className="font-semibold rounded-xl shadow-xs"
                >
                  {editingAssignmentId ? "Update Branch Assignment" : "Assign Clinic Branch"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-xs text-text-muted text-center py-4 border border-border/80 bg-surface-alt rounded-2xl font-medium">
              Dr. {selectedDoctorForAssignments?.name} is already assigned to all active clinic branches.
            </div>
          )}
        </div>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. LINK DOCTOR PROFILE TO ADMIN MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isAdminDoctorModalOpen}
        onClose={() => setIsAdminDoctorModalOpen(false)}
        title="Link Clinical Doctor Profile to Admin Account"
        description="Enable a Clinical Doctor Profile on your Admin account to conduct OPD consultations and issue prescriptions."
        size="lg"
      >
        <form onSubmit={handleEnableAdminDoctorProfile} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Medical Specialization *"
              value={adminDoctorData.specialization}
              onChange={(e) => setAdminDoctorData({ ...adminDoctorData, specialization: e.target.value })}
              placeholder="e.g. General Physician, Consultant Cardiologist"
              required
            />
            <Input
              label="Qualifications *"
              value={adminDoctorData.qualification}
              onChange={(e) => setAdminDoctorData({ ...adminDoctorData, qualification: e.target.value })}
              placeholder="e.g. MBBS, MD (Internal Medicine)"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Consultation Fee (₹) *"
              type="number"
              value={adminDoctorData.fees}
              onChange={(e) => setAdminDoctorData({ ...adminDoctorData, fees: Number(e.target.value) })}
              required
            />
            <Input
              label="Medical Registration / License No."
              value={adminDoctorData.registrationNumber}
              onChange={(e) => setAdminDoctorData({ ...adminDoctorData, registrationNumber: e.target.value })}
              placeholder="e.g. MCI-2024-8849"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAdminDoctorModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={savingAdminDoctor}
              className="font-semibold rounded-xl shadow-xs"
            >
              Link Clinical Doctor Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          7. DEACTIVATE STAFF CONFIRM DIALOG
         ────────────────────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Deactivate Staff Account?"
        description="Are you sure you want to deactivate this staff member from your organization? They will lose access to the system."
        variant="danger"
        confirmLabel="Deactivate Account"
      />
    </div>
  );
}
