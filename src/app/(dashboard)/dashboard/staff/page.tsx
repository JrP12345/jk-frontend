"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Tabs, Button, Modal, Input, useToast, Spinner, ImageUpload, ConfirmDialog, ScheduleEditor, Select, SkeletonTable, Dropdown, cn
} from "@/components/ui";
import { useR2Upload } from "@/lib/useR2Upload";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";

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
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"doctor" | "receptionist">("doctor");
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { uploadFile } = useR2Upload();

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
      setDoctors(res.data.data.doctors || []);
      setReceptionists(res.data.data.receptionists || []);
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

  const openModal = (type: "doctor" | "receptionist") => {
    setEditingId(null);
    setModalType(type);
    setFormData({});
    setStaffErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (type: "doctor" | "receptionist", row: any) => {
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
        toast({ title: "Success", description: `${modalType === "doctor" ? "Doctor" : "Receptionist"} updated successfully!`, variant: "success", duration: 3000 });
      } else {
        await api.post(`/onboarding/${modalType}`, finalData);
        toast({ title: "Success", description: `${modalType === "doctor" ? "Doctor" : "Receptionist"} added successfully!`, variant: "success", duration: 3000 });
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text">Staff Management</h2>
          <p className="text-xs sm:text-sm text-text-secondary">Manage doctors, receptionists, and organizational roles.</p>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            id: "doctors",
            label: `Doctors (${doctors.length})`,
            content: (
              <Table
                onAddClick={() => openModal("doctor")}
                actionLabel="Add Doctor"
                    searchable
                    searchPlaceholder="Search doctors by name, email, or specialty..."
                    columns={[
                      { key: "name", header: "Name", sortable: true },
                      { key: "email", header: "Email", sortable: true },
                      { key: "specialization", header: "Specialty", sortable: true },
                      { key: "qualification", header: "Qualification", sortable: true },
                      { key: "experience_years", header: "Experience", sortable: true },
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
                              { label: "Manage Clinic Assignments", onClick: () => openAssignmentsModal(row) },
                              { label: "Edit Doctor", onClick: () => openEditModal("doctor", row) },
                              { label: "Delete Doctor", danger: true, onClick: () => setDeletingId(row.id) },
                            ]}
                          />
                        )
                      }
                    ]}
                    data={doctors}
                    emptyMessage="No doctors added yet."
                  />
                )
              },
              {
                id: "receptionists",
                label: `Receptionists (${receptionists.length})`,
                content: (
                  <Table
                    onAddClick={() => openModal("receptionist")}
                    actionLabel="Add Receptionist"
                    searchable
                    searchPlaceholder="Search receptionists by name, email, or shift..."
                    columns={[
                      { key: "name", header: "Name", sortable: true },
                      { key: "email", header: "Email", sortable: true },
                      { key: "clinicName", header: "Assigned Clinic", sortable: true, render: (row: Receptionist) => <span>{row.clinicName || <span className="text-text-muted italic">Unassigned</span>}</span> },
                      { key: "shift", header: "Shift", sortable: true },
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
                              { label: "Edit Receptionist", onClick: () => openEditModal("receptionist", row) },
                              { label: "Delete Receptionist", danger: true, onClick: () => setDeletingId(row.id) },
                            ]}
                          />
                        )
                      }
                    ]}
                    data={receptionists}
                    emptyMessage="No receptionists added yet."
                  />
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
              }
            ]}
          />

      {/* Staff Add/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? "Edit" : "Add New"} ${modalType === "doctor" ? "Doctor" : "Receptionist"}`}
        size={modalType === "doctor" ? "lg" : "md"}
      >
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          {!editingId && (
            <div className="flex bg-surface-alt/70 p-1 rounded-xl border border-border gap-1 mb-2">
              <button
                type="button"
                onClick={() => { setModalType("doctor"); setStaffErrors({}); }}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  modalType === "doctor" ? "bg-primary-600 text-white shadow-xs" : "text-text-muted hover:text-text"
                )}
              >
                <span>Doctor Account</span>
              </button>
              <button
                type="button"
                onClick={() => { setModalType("receptionist"); setStaffErrors({}); }}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  modalType === "receptionist" ? "bg-primary-600 text-white shadow-xs" : "text-text-muted hover:text-text"
                )}
              >
                <span>Receptionist Account</span>
              </button>
            </div>
          )}
          <Input 
            label="Full Name *" 
            value={formData.name || ""} 
            onChange={(e) => handleFieldChange("name", e.target.value)} 
            onBlur={() => validateStaffField("name", formData.name || "")}
            error={staffErrors.name}
            required 
          />
          <Input 
            label="Email *" 
            type="email" 
            value={formData.email || ""} 
            onChange={(e) => handleFieldChange("email", e.target.value)} 
            onBlur={() => validateStaffField("email", formData.email || "")}
            disabled={!!editingId} 
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
          )}
          <Input label="Phone Number" value={formData.phone || ""} onChange={(e) => handleFieldChange("phone", e.target.value)} />
          
          {modalType === "doctor" && (
            <>
              <div className="grid grid-cols-2 gap-4">
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
              <Input label="Short Biography/Description" placeholder="About the doctor..." value={formData.description || ""} onChange={(e) => handleFieldChange("description", e.target.value)} />
            </>
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
