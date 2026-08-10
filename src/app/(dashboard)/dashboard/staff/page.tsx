"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Tabs, Button, Modal, Input, useToast, Spinner, ImageUpload, ConfirmDialog, ScheduleEditor, Select, SkeletonTable, Dropdown, Badge, cn
} from "@/components/ui";
import { useR2Upload } from "@/hooks/useR2Upload";
import { useAuthStore } from "@/store/authStore";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";
import { ExecutiveAnalytics } from "@/components/analytics/ExecutiveAnalytics";

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
  const { activeClinicId } = useAuthStore();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [labTechs, setLabTechs] = useState<any[]>([]);
  const [pharmacists, setPharmacists] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [customStaff, setCustomStaff] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
        const formattedLabel = `⚙️ ${r.name.replace(/_/g, " ").toUpperCase()} (Custom Role)`;
        options.push({ value: r.name, label: formattedLabel });
      }
    });

    return options;
  }, [roles]);

  const allStaffMembers = useMemo(() => {
    const list: any[] = [];
    doctors.forEach(d => list.push({ ...d, roleType: "doctor", roleLabel: "Doctor", details: d.specialization ? `${d.specialization} (${d.qualification || "MD"})` : (d.qualification || "-") }));
    receptionists.forEach(r => list.push({ ...r, roleType: "receptionist", roleLabel: "Receptionist", details: r.clinicName ? `Clinic: ${r.clinicName}` : (r.shift || "-") }));
    nurses.forEach(n => list.push({ ...n, roleType: "nurse", roleLabel: "Nurse", details: n.clinicName ? `Clinic: ${n.clinicName}` : (n.organizationName ? `Org: ${n.organizationName}` : "Nurse Staff") }));
    labTechs.forEach(l => list.push({ ...l, roleType: "lab_tech", roleLabel: "Lab Tech", details: l.clinicName ? `Clinic: ${l.clinicName}` : (l.organizationName ? `Org: ${l.organizationName}` : "Lab Technician") }));
    pharmacists.forEach(p => list.push({ ...p, roleType: "pharmacist", roleLabel: "Pharmacist", details: p.clinicName ? `Clinic: ${p.clinicName}` : (p.organizationName ? `Org: ${p.organizationName}` : "Pharmacist") }));
    cashiers.forEach(c => list.push({ ...c, roleType: "cashier", roleLabel: "Cashier", details: c.clinicName ? `Clinic: ${c.clinicName}` : (c.organizationName ? `Org: ${c.organizationName}` : "Billing Cashier") }));
    customStaff.forEach(s => list.push({ ...s, roleType: s.role, roleLabel: s.role.replace(/_/g, " ").toUpperCase(), details: s.clinicName ? `Clinic: ${s.clinicName}` : (s.organizationName ? `Org: ${s.organizationName}` : (s.department || s.specialization || "Staff Member")) }));
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
        label: `⚙️ ${roleName.replace(/_/g, " ").toUpperCase()}`,
        count: customCounts[roleName],
      });
    });

    return tabs;
  }, [allStaffMembers, doctors, receptionists, nurses, labTechs, pharmacists, cashiers, customStaff]);

  // Dynamic Validation State
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
  const [newAssignment, setNewAssignment] = useState<any>({ clinicId: "", fees: 100, appointmentDuration: 15, workingHours: "" });
  const [savingAssignment, setSavingAssignment] = useState(false);

  const filteredStaff = useMemo(() => {
    if (selectedRoleFilter === "all") return allStaffMembers;
    return allStaffMembers.filter(s => s.roleType === selectedRoleFilter);
  }, [allStaffMembers, selectedRoleFilter]);

  const handleEnableAdminDoctorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminDoctorData.specialization) {
      toast({ title: "Validation Error", description: "Specialization is required", variant: "error" });
      return;
    }
    setSavingAdminDoctor(true);
    try {
      await api.post("/onboarding/admin/enable-doctor-profile", adminDoctorData);
      toast({ title: "Success! 🩺", description: "Clinical Doctor Profile linked to your Admin account successfully!", variant: "success" });
      setIsAdminDoctorModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to link Doctor profile", variant: "error" });
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
    } catch (err) {
      toast({ title: "Error", description: "Failed to load staff list", variant: "error", duration: 3000 });
    }
  };

  const fetchClinics = async () => {
    try {
      const res = await api.get("/onboarding/clinics");
      setClinics(res.data.data || []);
    } catch (err) {
      console.error("Failed to load clinics list");
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get("/roles");
      setRoles(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load custom roles list");
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchStaff(), fetchClinics(), fetchRoles()]);
    setLoading(false);
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

  const openEditModal = (type: "doctor" | "receptionist" | "nurse" | "lab_tech" | "pharmacist" | "cashier", row: any) => {
    setEditingId(row.id);
    setModalType(type);
    setFormData({ ...row }); // Populate existing data
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
        const updateEndpoint = (modalType === "doctor" || modalType === "receptionist") ? `/onboarding/${modalType}/${editingId}` : `/onboarding/staff/${editingId}`;
        await api.put(updateEndpoint, finalData);
        toast({ title: "Success", description: "Staff member updated successfully!", variant: "success", duration: 3000 });
      } else if (modalType === "doctor" || modalType === "receptionist") {
        await api.post(`/onboarding/${modalType}`, finalData);
        toast({ title: "Success", description: "Staff member added successfully!", variant: "success", duration: 3000 });
      } else {
        await api.post(`/onboarding/staff`, { ...finalData, role: modalType });
        toast({ title: "Success", description: `${modalType.replace("_", " ").toUpperCase()} added successfully!`, variant: "success", duration: 3000 });
      }
      setIsModalOpen(false);
      fetchStaff(); // Refresh the lists
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to save staff member", variant: "error", duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/onboarding/staff/${deletingId}`);
      toast({ title: "Success", description: "Staff deactivated successfully!", variant: "success", duration: 3000 });
      fetchStaff();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to delete staff member", variant: "error", duration: 4000 });
    } finally {
      setDeletingId(null);
    }
  };

  // Assignments Handlers
  const openAssignmentsModal = async (doctor: Doctor) => {
    setSelectedDoctorForAssignments(doctor);
    setIsAssignmentsModalOpen(true);
    setAssignmentLoading(true);
    try {
      const res = await api.get(`/onboarding/doctors/assignments?doctorId=${doctor.id}`);
      setAssignments(res.data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load clinic assignments", variant: "error" });
    } finally {
      setAssignmentLoading(false);
    }
    setNewAssignment({ clinicId: "", fees: 100, appointmentDuration: 15, workingHours: "", bookingMode: "sequential_queue", maxDailyTokens: "" });
  };

const DEFAULT_WORKING_HOURS = JSON.stringify({
  Monday: [{ start: "09:00", end: "17:00" }],
  Tuesday: [{ start: "09:00", end: "17:00" }],
  Wednesday: [{ start: "09:00", end: "17:00" }],
  Thursday: [{ start: "09:00", end: "17:00" }],
  Friday: [{ start: "09:00", end: "17:00" }],
});

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.clinicId || newAssignment.fees === undefined) {
      toast({ title: "Validation Error", description: "Please select a clinic location and set consultation fees", variant: "error" });
      return;
    }
    const finalHours = newAssignment.workingHours && newAssignment.workingHours !== "{}" ? newAssignment.workingHours : DEFAULT_WORKING_HOURS;
    setSavingAssignment(true);
    try {
      await api.post("/onboarding/doctors/assignments", {
        doctorId: selectedDoctorForAssignments?.id,
        clinicId: newAssignment.clinicId,
        fees: Number(newAssignment.fees),
        appointmentDuration: Number(newAssignment.appointmentDuration),
        workingHours: finalHours,
        bookingMode: (newAssignment as any).bookingMode || "sequential_queue",
        maxDailyTokens: (newAssignment as any).maxDailyTokens ? Number((newAssignment as any).maxDailyTokens) : null,
      });
      toast({ title: "Success! 🏥", description: "Doctor assigned to clinic branch successfully!", variant: "success" });
      // Refresh assignments
      const res = await api.get(`/onboarding/doctors/assignments?doctorId=${selectedDoctorForAssignments?.id}`);
      setAssignments(res.data.data || []);
      setNewAssignment({ clinicId: "", fees: 100, appointmentDuration: 15, workingHours: DEFAULT_WORKING_HOURS, bookingMode: "sequential_queue", maxDailyTokens: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to assign doctor", variant: "error" });
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await api.delete(`/onboarding/doctors/assignments/${assignmentId}`);
      toast({ title: "Success", description: "Doctor assignment removed successfully", variant: "success" });
      // Refresh assignments
      const res = await api.get(`/onboarding/doctors/assignments?doctorId=${selectedDoctorForAssignments?.id}`);
      setAssignments(res.data.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to remove assignment", variant: "error" });
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
    } catch (e) {
      return timingsStr;
    }
  };

  // Filter out clinics already assigned
  const availableClinics = clinics.filter(
    c => !assignments.some(a => (a.clinicId?.id || a.clinicId) === c.id)
  );

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
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight">Staff & Practitioner Management</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage clinical practitioners, receptionists, access privileges, and RBAC governance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdminDoctorModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 border-primary-500/40 text-primary-400 hover:bg-primary-500/10"
          >
            <span>🩺 Link Doctor Profile to Admin</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openModal("doctor")}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Staff Member</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            id: "directory",
            label: `Staff Directory (${allStaffMembers.length})`,
            content: (
              <div className="space-y-4">
                {/* Role Filter Bar */}
                <div className="flex items-center gap-1.5 flex-wrap p-1.5 bg-surface border border-border rounded-2xl shadow-2xs">
                  <span className="text-xs font-bold text-text-muted px-2">Filter Role:</span>
                  {roleFilterTabs.map((filter) => {
                    const isSelected = selectedRoleFilter === filter.key;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setSelectedRoleFilter(filter.key)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
                          isSelected
                            ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                            : "bg-surface-alt/60 text-text-muted border-border/80 hover:bg-surface-hover hover:text-text"
                        )}
                      >
                        <span>{filter.label}</span>
                        <span className={cn(
                          "px-1.5 py-0.2 text-[10px] rounded-full font-black",
                          isSelected ? "bg-white/20 text-white" : "bg-surface-alt text-text-muted"
                        )}>
                          {filter.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <Table
                  searchable
                  searchPlaceholder="Search staff members by name, email, role, or specialty..."
                  columns={[
                    { 
                      key: "name", 
                      header: "Name", 
                      sortable: true,
                      render: (row) => <span className="font-bold text-text">{row.name}</span>
                    },
                    { 
                      key: "roleLabel", 
                      header: "Role Designation", 
                      sortable: true,
                      render: (row) => (
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold inline-block border",
                          row.roleType === "doctor" && "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950/40 dark:border-primary-800",
                          row.roleType === "receptionist" && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800",
                          row.roleType === "nurse" && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800",
                          row.roleType === "lab_tech" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800",
                          row.roleType === "pharmacist" && "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-800",
                          row.roleType === "cashier" && "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800"
                        )}>
                          {row.roleLabel}
                        </span>
                      )
                    },
                    { key: "email", header: "Email Address", sortable: true },
                    { key: "phone", header: "Phone Number", sortable: true, render: (row) => <span>{row.phone || "-"}</span> },
                    { key: "details", header: "Details / Branch", sortable: true },
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
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 flex items-center justify-center rounded-lg cursor-pointer shrink-0" title="Row Actions">
                                <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
                              </Button>
                            }
                            items={[
                              ...(row.roleType === "doctor" ? [{ label: "Manage Clinic Assignments", onClick: () => openAssignmentsModal(row) }] : []),
                              { label: `Edit ${row.roleLabel}`, onClick: () => openEditModal(row.roleType, row) },
                              { label: `Delete ${row.roleLabel}`, danger: true, onClick: () => setDeletingId(row.id) }
                            ]}
                          />
                        </div>
                      )
                    }
                  ]}
                  data={filteredStaff}
                  emptyMessage="No staff members match the selected filter."
                />
              </div>
            )
          },
              {
                id: "rbac",
                label: "RBAC Governance & Permissions",
                content: (
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
                )
              },
              {
                id: "analytics",
                label: "Executive BI & Analytics 📈",
                content: <ExecutiveAnalytics />
              }
            ]}
          />

      {/* Staff Add/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? "Update" : "Add New"} ${modalType.replace("_", " ").toUpperCase()} Profile`}
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          {!editingId && (
            <div>
              <Select
                label="Staff Account Role & Designation *"
                value={modalType}
                onChange={(e) => {
                  setModalType(e.target.value as any);
                  setStaffErrors({});
                }}
                options={allRoleOptions}
              />
            </div>
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
            {!editingId ? (
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
                    className="p-1 text-text-muted hover:text-text rounded-md hover:bg-surface-hover/50 transition-all active:scale-75 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                }
              />
            ) : <div />}
          </div>
          
          {modalType === "doctor" && (
            <div className="space-y-3.5 border-t border-border pt-3">
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
                <Input label="Qualification" placeholder="e.g. MBBS, MD" value={formData.qualification || ""} onChange={(e) => handleFieldChange("qualification", e.target.value)} />
                <Input label="Experience (Years)" type="number" value={formData.experience_years || ""} onChange={(e) => handleFieldChange("experience_years", parseInt(e.target.value) || 0)} />
              </div>
              <ImageUpload 
                label="Profile Image" 
                value={formData.image_url || null} 
                onChange={(val) => handleFieldChange("image_url", val)} 
              />
              <Input label="Short Biography / Overview" placeholder="About practitioner's background and achievements..." value={formData.description || ""} onChange={(e) => handleFieldChange("description", e.target.value)} />
            </div>
          )}

          {modalType === "receptionist" && (
            <>
              <Select 
                label="Assign Clinic *" 
                value={formData.clinicId || ""} 
                onChange={(e) => handleFieldChange("clinicId", e.target.value)}
                error={staffErrors.clinicId}
                placeholder="Choose a clinic branch..."
                options={clinics.map(c => ({ value: c.id, label: c.name }))}
              />
              <Input label="Shift" placeholder="e.g. Morning, Night" value={formData.shift || ""} onChange={(e) => handleFieldChange("shift", e.target.value)} />
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Doctor Assignments Modal */}
      <Modal
        open={isAssignmentsModalOpen}
        onClose={() => setIsAssignmentsModalOpen(false)}
        title={`Manage Clinic Assignments — Dr. ${selectedDoctorForAssignments?.name || ""}`}
        size="xl"
      >
        <div className="space-y-6 font-sans">
          {/* Informational Subtext */}
          <div className="p-3.5 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-start gap-3 text-xs text-text-secondary">
            <span className="text-base shrink-0">🏥</span>
            <div>
              <p className="font-bold text-text">What are Active Assignments?</p>
              <p className="mt-0.5 text-text-muted">
                Active Assignments link this practitioner to specific clinic locations within your organization. Each clinic location can have custom consultation fees, slot durations (e.g. 15 mins), and operating day shifts for online appointment booking and OPD desk routing.
              </p>
            </div>
          </div>

          {/* Current Active Assignments Card */}
          <div className="bg-surface-alt/40 border border-border/80 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text tracking-tight flex items-center gap-2">
                <span>📍 Active Clinic Assignments</span>
                <Badge variant="primary" size="sm">{assignments.length}</Badge>
              </h3>
            </div>

            {assignmentLoading ? (
              <div className="flex justify-center p-8"><Spinner size="md" /></div>
            ) : assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-2xl bg-surface-alt/30 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 text-lg">
                  🏥
                </div>
                <h4 className="text-sm font-bold text-text">No Clinic Locations Assigned Yet</h4>
                <p className="text-xs text-text-muted max-w-md">
                  This practitioner has no active clinic branch assignments. Select an available clinic branch below to set consultation fees, slot durations, and working hours.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border shadow-2xs bg-surface">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      <th className="p-3">Clinic Location</th>
                      <th className="p-3">Consultation Fee</th>
                      <th className="p-3">Slot Duration</th>
                      <th className="p-3">Booking Mode</th>
                      <th className="p-3">Working Shift Hours</th>
                      <th className="p-3 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assignments.map((asg) => (
                      <tr key={asg.id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="p-3 text-text font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>{asg.clinicId?.name}</span>
                        </td>
                        <td className="p-3 text-emerald-400 font-extrabold text-sm">₹{asg.fees}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-surface-alt rounded-lg font-bold text-text-secondary border border-border">
                            {asg.appointmentDuration} mins
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant={asg.bookingMode === "sequential_queue" ? "primary" : "neutral"} className="font-bold text-[10px]">
                            {asg.bookingMode === "sequential_queue" ? "🎟 Token Queue" : "🗓 Time Slots"}
                          </Badge>
                        </td>
                        <td className="p-3 text-text-secondary whitespace-pre-wrap font-medium">{formatTimings(asg.workingHours)}</td>
                        <td className="p-3 text-right">
                          <Button variant="danger" size="xs" onClick={() => handleRemoveAssignment(asg.id)} className="font-bold">
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add New Assignment Form Card */}
          {availableClinics.length > 0 ? (
            <form onSubmit={handleAddAssignment} className="bg-surface-alt/40 border border-border/80 rounded-2xl p-4.5 space-y-4">
              <h3 className="text-sm font-bold text-text tracking-tight flex items-center gap-2">
                <span>➕ Assign New Clinic Location & Schedule</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <Select
                  label="Patient Booking Mode *"
                  value={(newAssignment as any).bookingMode || "sequential_queue"}
                  onChange={(e) => setNewAssignment({ ...newAssignment, bookingMode: e.target.value } as any)}
                  options={[
                    { value: "sequential_queue", label: "🎟 Sequential Queue Mode (Live Token Queue) - DEFAULT" },
                    { value: "time_slot", label: "🗓 Time-Slot Mode (Fixed Time Slots)" },
                  ]}
                  required
                />
                <Select 
                  label="Select Clinic Location *"
                  value={newAssignment.clinicId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, clinicId: e.target.value })}
                  options={[
                    { value: "", label: "Choose a clinic branch..." },
                    ...availableClinics.map(c => ({ value: c.id, label: c.name }))
                  ]}
                  required
                />
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
                  label={(newAssignment as any).bookingMode === "time_slot" ? "Slot Duration (Minutes) *" : "Avg Time / Patient (Mins) *"}
                  type="number"
                  value={newAssignment.appointmentDuration}
                  onChange={(e) => setNewAssignment({ ...newAssignment, appointmentDuration: Number(e.target.value) })}
                  required
                />
                <Input
                  label="Max Daily Tokens (Optional Cap)"
                  type="number"
                  placeholder="e.g. 40 (blank for unlimited)"
                  value={(newAssignment as any).maxDailyTokens || ""}
                  onChange={(e) => setNewAssignment({ ...newAssignment, maxDailyTokens: e.target.value } as any)}
                />
              </div>

              <ScheduleEditor 
                label="Working Days & Operating Timings *"
                value={newAssignment.workingHours}
                onChange={(val) => setNewAssignment({ ...newAssignment, workingHours: val })}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="submit" loading={savingAssignment} variant="primary" className="font-bold rounded-xl shadow-xs cursor-pointer">
                  Assign Clinic Location & Schedule
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-xs text-text-muted text-center py-4 border border-border bg-surface-alt/50 rounded-2xl font-medium">
              ✅ Dr. {selectedDoctorForAssignments?.name} is already assigned to all active clinic branches in your organization.
            </div>
          )}
        </div>
      </Modal>

      {/* Enable Clinical Doctor Profile for Admin Account Modal */}
      <Modal
        open={isAdminDoctorModalOpen}
        onClose={() => setIsAdminDoctorModalOpen(false)}
        title="Link Clinical Doctor Profile to Admin Account 🩺"
        size="lg"
      >
        <form onSubmit={handleEnableAdminDoctorProfile} className="space-y-4">
          <p className="text-xs text-text-muted">
            Solo practice owners and Doctor-Admins can enable a Clinical Doctor Profile linked directly to their Admin account. This allows you to conduct OPD consultations, issue prescriptions, and manage appointments while maintaining full 100% Admin Governance.
          </p>

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

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsAdminDoctorModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={savingAdminDoctor}>Link Clinical Doctor Profile</Button>
          </div>
        </form>
      </Modal>

      {/* Delete/Deactivate Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Remove Staff Member?"
        description="Are you sure you want to remove this staff member from your organization? They will lose access to the system."
        variant="danger"
        confirmLabel="Remove"
      />
    </div>
  );
}
