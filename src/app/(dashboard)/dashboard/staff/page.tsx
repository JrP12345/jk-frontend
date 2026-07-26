"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Tabs, Button, Modal, Input, useToast, Spinner, ImageUpload, ConfirmDialog, ScheduleEditor, Select, SkeletonTable, Dropdown, cn
} from "@/components/ui";
import { useR2Upload } from "@/hooks/useR2Upload";
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

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [labTechs, setLabTechs] = useState<any[]>([]);
  const [pharmacists, setPharmacists] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"doctor" | "receptionist" | "nurse" | "lab_tech" | "pharmacist" | "cashier">("doctor");
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  const allStaffMembers = useMemo(() => {
    const list: any[] = [];
    doctors.forEach(d => list.push({ ...d, roleType: "doctor", roleLabel: "Doctor", details: d.specialization ? `${d.specialization} (${d.qualification || "MD"})` : (d.qualification || "-") }));
    receptionists.forEach(r => list.push({ ...r, roleType: "receptionist", roleLabel: "Receptionist", details: r.clinicName ? `Clinic: ${r.clinicName}` : (r.shift || "-") }));
    nurses.forEach(n => list.push({ ...n, roleType: "nurse", roleLabel: "Nurse", details: n.phone || "-" }));
    labTechs.forEach(l => list.push({ ...l, roleType: "lab_tech", roleLabel: "Lab Tech", details: l.phone || "-" }));
    pharmacists.forEach(p => list.push({ ...p, roleType: "pharmacist", roleLabel: "Pharmacist", details: p.phone || "-" }));
    cashiers.forEach(c => list.push({ ...c, roleType: "cashier", roleLabel: "Cashier", details: c.phone || "-" }));
    return list;
  }, [doctors, receptionists, nurses, labTechs, pharmacists, cashiers]);

  const filteredStaff = useMemo(() => {
    if (selectedRoleFilter === "all") return allStaffMembers;
    return allStaffMembers.filter(s => s.roleType === selectedRoleFilter);
  }, [allStaffMembers, selectedRoleFilter]);

  // Dynamic Validation State
  const [staffErrors, setStaffErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Doctor Assignments State
  const [selectedDoctorForAssignments, setSelectedDoctorForAssignments] = useState<Doctor | null>(null);
  const [isAssignmentsModalOpen, setIsAssignmentsModalOpen] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [newAssignment, setNewAssignment] = useState<any>({ clinicId: "", fees: 100, appointmentDuration: 15, workingHours: "" });
  const [savingAssignment, setSavingAssignment] = useState(false);

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
      const res = await api.get("/onboarding/staff");
      const data = res.data.data || {};
      setDoctors(data.doctors || []);
      setReceptionists(data.receptionists || []);
      setNurses(data.nurses || []);
      setLabTechs(data.labTechs || []);
      setPharmacists(data.pharmacists || []);
      setCashiers(data.cashiers || []);
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

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchStaff(), fetchClinics()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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
        await api.put(`/onboarding/${modalType}/${editingId}`, finalData);
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
    setNewAssignment({ clinicId: "", fees: 100, appointmentDuration: 15, workingHours: "" });
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.clinicId || !newAssignment.workingHours || newAssignment.fees === undefined) {
      toast({ title: "Error", description: "Please configure clinic, timings, and fees", variant: "error" });
      return;
    }
    setSavingAssignment(true);
    try {
      await api.post("/onboarding/doctors/assignments", {
        doctorId: selectedDoctorForAssignments?.id,
        clinicId: newAssignment.clinicId,
        fees: Number(newAssignment.fees),
        appointmentDuration: Number(newAssignment.appointmentDuration),
        workingHours: newAssignment.workingHours
      });
      toast({ title: "Success", description: "Doctor assigned to clinic successfully", variant: "success" });
      // Refresh assignments
      const res = await api.get(`/onboarding/doctors/assignments?doctorId=${selectedDoctorForAssignments?.id}`);
      setAssignments(res.data.data || []);
      setNewAssignment({ clinicId: "", fees: 100, appointmentDuration: 15, workingHours: "" });
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

        <div className="flex items-center gap-2 shrink-0">
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
                  {[
                    { key: "all", label: "All Staff", count: allStaffMembers.length },
                    { key: "doctor", label: "Doctors", count: doctors.length },
                    { key: "receptionist", label: "Receptionists", count: receptionists.length },
                    { key: "nurse", label: "Nurses", count: nurses.length },
                    { key: "lab_tech", label: "Lab Techs", count: labTechs.length },
                    { key: "pharmacist", label: "Pharmacists", count: pharmacists.length },
                    { key: "cashier", label: "Cashiers", count: cashiers.length },
                  ].map((filter) => {
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
                      width: "56px",
                      render: (row) => (
                        <Dropdown
                          align="right"
                          trigger={
                            <Button size="xs" variant="outline" className="h-7 w-7 p-0 flex items-center justify-center rounded-lg cursor-pointer" title="Row Actions">
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
                    users={[
                      ...doctors.map((d) => ({
                        id: d.id,
                        name: d.name,
                        email: d.email,
                        role: "doctor",
                        permissions: ["VIEW_EHR", "MANAGE_CLINICAL_NOTES", "ADMINISTER_MEDICATION", "MANAGE_ORDERS", "MANAGE_DISCHARGE_SUMMARY"],
                      })),
                      ...receptionists.map((r) => ({
                        id: r.id,
                        name: r.name,
                        email: r.email,
                        role: "receptionist",
                        permissions: ["MANAGE_STAFF", "MANAGE_CLINICS", "MANAGE_APPOINTMENTS", "MANAGE_QUEUE", "MANAGE_BILLING"],
                      })),
                    ]}
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
                options={[
                  { value: "doctor", label: "Doctor / Clinical Practitioner" },
                  { value: "receptionist", label: "Receptionist / Front Desk" },
                  { value: "nurse", label: "Nurse / Clinical Support" },
                  { value: "lab_tech", label: "Laboratory Technician" },
                  { value: "pharmacist", label: "Pharmacist / Dispenser" },
                  { value: "cashier", label: "Cashier / Accounts Desk" }
                ]}
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
              disabled={!!editingId} 
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
        title={`Manage Clinic Assignments - Dr. ${selectedDoctorForAssignments?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Current Assignments */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Active Assignments</h3>
            {assignmentLoading ? (
              <div className="flex justify-center p-6"><Spinner size="sm" /></div>
            ) : assignments.length === 0 ? (
              <div className="text-sm text-text-muted text-center py-6 border border-dashed border-border rounded-lg bg-surface-alt">
                No clinics assigned to this doctor yet. Use the form below to assign a clinic.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-surface-alt border-b border-border">
                      <th className="p-3 font-semibold text-text">Clinic</th>
                      <th className="p-3 font-semibold text-text">Fees</th>
                      <th className="p-3 font-semibold text-text">Duration</th>
                      <th className="p-3 font-semibold text-text">Working Hours</th>
                      <th className="p-3 font-semibold text-text w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((asg) => (
                      <tr key={asg.id} className="border-b border-border hover:bg-surface-hover/30 transition-colors">
                        <td className="p-3 text-text font-medium">{asg.clinicId?.name}</td>
                        <td className="p-3 text-success-600 font-bold">₹{asg.fees}</td>
                        <td className="p-3 text-text-secondary">{asg.appointmentDuration} mins</td>
                        <td className="p-3 text-text-secondary whitespace-pre-wrap">{formatTimings(asg.workingHours)}</td>
                        <td className="p-3">
                          <Button variant="danger" size="xs" onClick={() => handleRemoveAssignment(asg.id)}>Remove</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add New Assignment Form */}
          {availableClinics.length > 0 ? (
            <form onSubmit={handleAddAssignment} className="border-t border-border pt-5 space-y-4">
              <h3 className="text-sm font-semibold text-text">Assign New Clinic Location</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select 
                  label="Select Clinic *"
                  value={newAssignment.clinicId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, clinicId: e.target.value })}
                  options={[
                    { value: "", label: "Choose a clinic..." },
                    ...availableClinics.map(c => ({ value: c.id, label: c.name }))
                  ]}
                  required
                />
                <Input 
                  label="Consultation Fee (₹) *"
                  type="number"
                  value={newAssignment.fees}
                  onChange={(e) => setNewAssignment({ ...newAssignment, fees: Number(e.target.value) })}
                  required
                />
                <Input 
                  label="Slot Duration (Minutes) *"
                  type="number"
                  value={newAssignment.appointmentDuration}
                  onChange={(e) => setNewAssignment({ ...newAssignment, appointmentDuration: Number(e.target.value) })}
                  required
                />
              </div>

              <ScheduleEditor 
                label="Working Days & Operating timings *"
                value={newAssignment.workingHours}
                onChange={(val) => setNewAssignment({ ...newAssignment, workingHours: val })}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="submit" loading={savingAssignment}>Assign Clinic</Button>
              </div>
            </form>
          ) : (
            <div className="text-sm text-text-muted text-center py-4 border border-border bg-surface-alt rounded-lg">
              Doctor is already assigned to all available clinic locations.
            </div>
          )}
        </div>
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
