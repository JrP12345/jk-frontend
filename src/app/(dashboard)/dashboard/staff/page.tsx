"use client";

import { useState, useEffect, useMemo } from "react";
import api from "@/lib/api";
import {
  Card,
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
  ShieldCheck,
  MoreHorizontal,
  Edit3,
  Trash2,
  Building2,
  Mail,
  Phone,
  Eye,
  EyeOff,
  CalendarOff,
  Calendar,
} from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  qualification: string;
  experience_years: number;
}

export interface Receptionist {
  id: string;
  name: string;
  email: string;
  phone: string;
  shift: string;
  clinicId?: string;
  clinicName?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  roleType: string;
  roleLabel: string;
  details?: string;
  specialization?: string;
  qualification?: string;
  experience_years?: number;
  clinicId?: string;
  clinicName?: string;
  organizationName?: string;
  department?: string;
  shift?: string;
  permissions?: string[];
  [key: string]: any;
}

export default function StaffPage() {
  const { toast } = useToast();
  const { uploadFile } = useR2Upload();
  const { user } = useAuthStore();
  const { clinics, fetchClinics, activeClinicId } = useClinicStore();
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
      doctor: "Doctor",
      receptionist: "Receptionist",
      nurse: "Nurse",
      lab_tech: "Lab Technician",
      pharmacist: "Pharmacist",
      cashier: "Cashier",
    };

    const options = [
      { value: "doctor", label: "Doctor" },
      { value: "receptionist", label: "Receptionist" },
      { value: "nurse", label: "Nurse" },
      { value: "lab_tech", label: "Lab Technician" },
      { value: "pharmacist", label: "Pharmacist" },
      { value: "cashier", label: "Cashier" },
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
    const list: StaffMember[] = [];
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
    feeType: "fixed",
    registrationNumber: "",
  });
  const [savingAdminDoctor, setSavingAdminDoctor] = useState(false);

  // Doctor Assignments State
  const [selectedDoctorForAssignments, setSelectedDoctorForAssignments] = useState<Doctor | StaffMember | null>(null);
  const [isAssignmentsModalOpen, setIsAssignmentsModalOpen] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState<any>({
    clinicId: "",
    fees: 100,
    feeType: "fixed",
    appointmentDuration: 15,
    workingHours: "",
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Doctor Holidays & Leave Overrides State
  const [selectedDoctorForHolidays, setSelectedDoctorForHolidays] = useState<Doctor | StaffMember | null>(null);
  const [isHolidaysModalOpen, setIsHolidaysModalOpen] = useState(false);
  const [doctorHolidays, setDoctorHolidays] = useState<any[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    clinicId: "all",
    date: "",
    reason: "Public Holiday",
  });

  const openHolidaysModal = async (doctor: any) => {
    setSelectedDoctorForHolidays(doctor);
    setIsHolidaysModalOpen(true);
    setLoadingHolidays(true);
    setNewHoliday({
      clinicId: "all",
      date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      reason: "Public Holiday",
    });
    try {
      const res = await api.get(`/doctor-overrides?doctorId=${doctor.id}`);
      setDoctorHolidays(res.data?.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load doctor holiday schedule", variant: "error" });
    } finally {
      setLoadingHolidays(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoliday.date || !newHoliday.reason.trim()) {
      toast({ title: "Validation Error", description: "Please select a date and specify holiday reason", variant: "error" });
      return;
    }
    setSavingHoliday(true);
    try {
      await api.post("/doctor-overrides", {
        doctorId: selectedDoctorForHolidays?.id,
        clinicId: newHoliday.clinicId,
        date: newHoliday.date,
        status: "unavailable",
        reason: newHoliday.reason.trim(),
      });
      toast({ title: "Holiday Declared", description: "Doctor holiday/leave scheduled successfully. Appointments are blocked for this date.", variant: "success" });
      const res = await api.get(`/doctor-overrides?doctorId=${selectedDoctorForHolidays?.id}`);
      setDoctorHolidays(res.data?.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to declare holiday", variant: "error" });
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (overrideId: string) => {
    try {
      await api.delete(`/doctor-overrides/${overrideId}`);
      toast({ title: "Holiday Cancelled", description: "Doctor holiday removed. Normal availability restored.", variant: "success" });
      setDoctorHolidays((prev) => prev.filter((h) => (h.id || h._id) !== overrideId));
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to delete holiday", variant: "error" });
    }
  };

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

  const openModal = (type: "doctor" | "receptionist" | "nurse" | "lab_tech" | "pharmacist" | "cashier" = "doctor") => {
    setEditingId(null);
    setModalType(type);
    setFormData({
      clinicId: clinics.length === 1 ? clinics[0].id : "",
      fees: 500,
      appointmentDuration: 15,
    });
    setStaffErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (
    type: string,
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
        toast({ title: "Success", description: "Team member updated successfully!", variant: "success" });
      } else if (modalType === "doctor" || modalType === "receptionist") {
        const res = await api.post(`/onboarding/${modalType}`, finalData);
        if (modalType === "doctor" && finalData.clinicId && res.data?.data?.id) {
          try {
            const docFeeType = finalData.feeType || "fixed";
            const docFees = docFeeType === "post_consultation" || docFeeType === "free" ? 0 : (Number(finalData.fees) || 500);
            await api.post("/onboarding/doctors/assignments", {
              doctorId: res.data.data.id,
              clinicId: finalData.clinicId,
              fees: docFees,
              feeType: docFeeType,
              appointmentDuration: Number(finalData.appointmentDuration) || 15,
              workingHours: DEFAULT_WORKING_HOURS,
              bookingMode: "sequential_queue",
            });
          } catch (assignErr) {
            console.warn("Auto-assignment failed or skipped:", assignErr);
          }
        }
        toast({ title: "Success", description: `${modalType === "doctor" ? "Doctor" : "Receptionist"} registered successfully!`, variant: "success" });
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
  const openAssignmentsModal = async (doctor: Doctor | StaffMember) => {
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
      feeType: asg.feeType || "fixed",
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
      feeType: "fixed",
      appointmentDuration: 15,
      workingHours: DEFAULT_WORKING_HOURS,
      bookingMode: "sequential_queue",
      maxDailyTokens: "",
    });
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const asgFeeType = (newAssignment as any).feeType || "fixed";
    if (!newAssignment.clinicId || (asgFeeType === "fixed" && newAssignment.fees === undefined)) {
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
    const asgFees = asgFeeType === "post_consultation" || asgFeeType === "free" ? 0 : Number(newAssignment.fees || 0);
    try {
      if (editingAssignmentId) {
        await api.put(`/onboarding/doctors/assignments/${editingAssignmentId}`, {
          fees: asgFees,
          feeType: asgFeeType,
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
          fees: asgFees,
          feeType: asgFeeType,
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
        feeType: "fixed",
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
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Team
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                {allStaffMembers.length} Members
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Manage doctors, receptionists, nurses, and other team members across your practice.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
            {canManageStaff && (
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdminDoctorModalOpen(true)}
                  className="w-full sm:w-auto min-h-[42px] sm:min-h-[36px] rounded-xl text-xs font-semibold hover:bg-surface-hover justify-center"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                  Link Admin
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openModal("doctor")}
                  className="w-full sm:w-auto min-h-[42px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs justify-center"
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  Add Member
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isRefreshing}
              className="w-full sm:w-auto min-h-[40px] sm:min-h-[36px] rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors justify-center order-2 sm:order-1"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total Team Members"
          value={allStaffMembers.length.toString()}
          description="Active members in your practice"
          icon={<Users className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Active Roles"
          value={roleFilterTabs.filter(r => r.key !== "all" && r.count > 0).length.toString()}
          description="Distinct team roles configured"
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
                <div className="flex items-center gap-1.5 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto [scrollbar-width:none] touch-pan-x w-full sm:w-fit max-w-full">
                  <span className="text-[11px] font-bold text-text-muted px-2.5 shrink-0">Filter:</span>
                  {roleFilterTabs.map((filter) => {
                    const isSelected = selectedRoleFilter === filter.key;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setSelectedRoleFilter(filter.key)}
                        className={cn(
                          "px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 min-h-[40px] sm:min-h-[34px] touch-manipulation",
                          isSelected
                            ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                            : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
                        )}
                      >
                        <span>{filter.label}</span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
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
                      mobileCardView
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
                                    className="h-9 w-9 p-0 flex items-center justify-center rounded-lg text-text-secondary hover:text-text min-h-[36px] min-w-[36px]"
                                    title="Row Actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
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
                                        {
                                          label: "Holidays & Leave Schedule",
                                          icon: <CalendarOff className="w-4 h-4 text-amber-500" />,
                                          onClick: () => openHolidaysModal(row),
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
                      renderMobileCard={(row: StaffMember) => (
                        <div
                          key={row.id}
                          className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-600 font-bold text-sm shrink-0">
                                {(row.name || "S").charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-text text-sm truncate">{row.name}</p>
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
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
                                </div>
                              </div>
                            </div>

                            {canManageStaff && (
                              <Dropdown
                                align="right"
                                trigger={
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    className="h-9 w-9 p-0 flex items-center justify-center rounded-xl text-text-secondary hover:text-text min-h-[36px] min-w-[36px]"
                                    title="Actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
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
                                        {
                                          label: "Holidays & Leave Schedule",
                                          icon: <CalendarOff className="w-4 h-4 text-amber-500" />,
                                          onClick: () => openHolidaysModal(row),
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
                            )}
                          </div>

                          <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5 text-text-secondary">
                              <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              <a href={`mailto:${row.email}`} className="truncate hover:text-primary-600 transition-colors">
                                {row.email}
                              </a>
                            </div>
                            {row.phone && (
                              <div className="flex items-center gap-1.5 text-text-secondary">
                                <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                <a href={`tel:${row.phone}`} className="hover:text-primary-600 transition-colors">
                                  {row.phone}
                                </a>
                              </div>
                            )}
                            {row.details && (
                              <div className="flex items-center gap-1.5 text-text-muted pt-1 border-t border-border/40 text-[11px]">
                                <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                                <span className="truncate">{row.details}</span>
                              </div>
                            )}
                          </div>

                          {row.roleType === "doctor" && canManageStaff && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAssignmentsModal(row)}
                                className="w-full font-semibold text-xs min-h-[40px] rounded-xl flex items-center justify-center gap-1"
                              >
                                <Stethoscope className="w-3.5 h-3.5 text-primary-500" />
                                <span>Assignments</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openHolidaysModal(row)}
                                className="w-full font-semibold text-xs min-h-[40px] rounded-xl flex items-center justify-center gap-1 text-amber-600 hover:bg-amber-500/10 border-amber-500/30"
                              >
                                <CalendarOff className="w-3.5 h-3.5" />
                                <span>Leave</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
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
        title={editingId ? `Update ${modalType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}` : "Add Team Member"}
        description={editingId ? "Update credentials and details for this team member." : "Add a doctor, receptionist, nurse, or other staff member to your practice."}
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1" noValidate>
          {!editingId && (
            <Select
              label="Role & Designation *"
              value={modalType}
              onChange={(e) => {
                const newRole = e.target.value as any;
                setModalType(newRole);
                setStaffErrors({});
                if (newRole === "doctor" && !formData.fees) {
                  setFormData((prev: any) => ({
                    ...prev,
                    clinicId: prev.clinicId || (clinics.length === 1 ? clinics[0].id : ""),
                    fees: 500,
                  }));
                }
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

              {/* Inline Location & Fee Assignment for New Doctors */}
              {!editingId && clinics.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 bg-surface-alt/60 border border-border/70 rounded-2xl">
                  <div>
                    <Select
                      label="Primary Practice Location"
                      value={formData.clinicId || (clinics.length === 1 ? clinics[0].id : "")}
                      onChange={(e) => handleFieldChange("clinicId", e.target.value)}
                      placeholder="Choose primary location..."
                      options={clinics.map((c) => ({ value: c.id, label: c.name }))}
                    />
                    <p className="text-[11px] text-text-muted mt-1">Scheduled and bookable at this branch</p>
                  </div>
                  <div>
                    <Select
                      label="Fee Model"
                      value={formData.feeType || "fixed"}
                      onChange={(e) => {
                        const ft = e.target.value;
                        handleFieldChange("feeType", ft);
                        if (ft !== "fixed") handleFieldChange("fees", 0);
                      }}
                      options={[
                        { value: "fixed", label: "Fixed Fee Upfront (₹)" },
                        { value: "post_consultation", label: "Post-Consultation (Decided after visit)" },
                        { value: "free", label: "Free / Pro Bono (₹0)" },
                      ]}
                    />
                    <p className="text-[11px] text-text-muted mt-1">Consultation billing mode</p>
                  </div>
                  <div>
                    <Input
                      label="Consultation Fee (₹)"
                      type="number"
                      value={formData.fees ?? 500}
                      onChange={(e) => handleFieldChange("fees", e.target.value)}
                      placeholder="e.g. 500"
                      disabled={formData.feeType === "post_consultation" || formData.feeType === "free"}
                    />
                    <p className="text-[11px] text-text-muted mt-1">
                      {formData.feeType === "post_consultation" ? "Decided after consultation" : formData.feeType === "free" ? "No fee charged" : "Standard OPD consultation charge"}
                    </p>
                  </div>
                </div>
              )}

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
                label="Assign Location *"
                value={formData.clinicId || (clinics.length === 1 ? clinics[0].id : "")}
                onChange={(e) => handleFieldChange("clinicId", e.target.value)}
                error={staffErrors.clinicId}
                placeholder="Choose a practice location..."
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

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/60 mt-4">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submitting} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs">
              {editingId ? "Update Profile" : "Add Team Member"}
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
              <Button
                size="xs"
                variant="outline"
                type="button"
                onClick={() => {
                  setIsAssignmentsModalOpen(false);
                  openHolidaysModal(selectedDoctorForAssignments);
                }}
                className="rounded-xl text-xs font-semibold hover:bg-surface-hover gap-1.5"
              >
                <CalendarOff className="w-3.5 h-3.5 text-amber-500" />
                Holidays & Leaves
              </Button>
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
              <>
                {/* Mobile Cards View (< sm) */}
                <div className="block sm:hidden space-y-3">
                  {assignments.map((asg) => (
                    <div
                      key={asg.id || asg._id}
                      className="p-3.5 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-text">
                          <Building2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                          <span>{asg.clinicId?.name || "Clinic Branch"}</span>
                        </div>
                        <Badge
                          variant={asg.bookingMode === "sequential_queue" ? "primary" : "neutral"}
                          size="sm"
                          className="font-semibold text-[10px]"
                        >
                          {asg.bookingMode === "sequential_queue" ? "Token Queue" : "Time Slots"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-surface-alt rounded-xl">
                          <span className="text-[10px] text-text-muted block">Fee</span>
                          <span className="font-bold">
                            {asg.feeType === "post_consultation" ? (
                              <span className="text-amber-500 text-[11px]">Post-Visit</span>
                            ) : asg.feeType === "free" ? (
                              <span className="text-emerald-500 text-[11px]">Free</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">₹{asg.fees}</span>
                            )}
                          </span>
                        </div>

                        <div className="p-2 bg-surface-alt rounded-xl">
                          <span className="text-[10px] text-text-muted block">Duration</span>
                          <span className="font-semibold text-text">{asg.appointmentDuration} mins</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-text-muted bg-surface-alt/50 p-2 rounded-xl">
                        <span className="font-medium text-text-secondary block mb-0.5">Shift Hours:</span>
                        {formatTimings(asg.workingHours)}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleStartEditAssignment(asg)}
                          className="flex-1 font-semibold text-xs min-h-[38px] rounded-xl justify-center"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => handleRemoveAssignment(asg.id || asg._id)}
                          className="flex-1 font-semibold text-xs min-h-[38px] rounded-xl justify-center"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= sm) */}
                <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border/80 bg-surface shadow-xs">
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
                          <td className="p-3 font-bold whitespace-nowrap">
                            {asg.feeType === "post_consultation" ? (
                              <Badge variant="warning" size="sm" className="font-semibold text-[10px]">
                                Post-Consultation
                              </Badge>
                            ) : asg.feeType === "free" ? (
                              <Badge variant="success" size="sm" className="font-semibold text-[10px]">
                                Free / ₹0
                              </Badge>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">₹{asg.fees}</span>
                            )}
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
              </>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <Select
                  label="Fee Model *"
                  value={(newAssignment as any).feeType || "fixed"}
                  onChange={(e) => {
                    const ft = e.target.value;
                    setNewAssignment({
                      ...newAssignment,
                      feeType: ft,
                      fees: ft === "fixed" ? (newAssignment.fees || 500) : 0,
                    } as any);
                  }}
                  options={[
                    { value: "fixed", label: "Fixed Fee (₹)" },
                    { value: "post_consultation", label: "Post-Consultation (After visit)" },
                    { value: "free", label: "Free / Pro Bono (₹0)" },
                  ]}
                  required
                />
                {((newAssignment as any).feeType || "fixed") === "fixed" ? (
                  <Input
                    label="Consultation Fee (₹) *"
                    type="number"
                    value={newAssignment.fees}
                    onChange={(e) => setNewAssignment({ ...newAssignment, fees: Number(e.target.value) })}
                    required
                  />
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text block">Consultation Fee</label>
                    <div className="p-2.5 bg-surface-alt border border-border/80 rounded-xl text-xs font-medium text-text-muted truncate">
                      {((newAssignment as any).feeType) === "free" ? "₹0 (Free)" : "Decided post-visit"}
                    </div>
                  </div>
                )}
                <Input
                  label={
                    (newAssignment as any).bookingMode === "time_slot"
                      ? "Slot Duration (Mins) *"
                      : "Avg Time / Patient *"
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
                  placeholder="Unlimited"
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

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2 border-t border-border/60">
                <Button
                  type="submit"
                  loading={savingAssignment}
                  size="sm"
                  variant="primary"
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Select
              label="Fee Model *"
              value={adminDoctorData.feeType || "fixed"}
              onChange={(e) => {
                const ft = e.target.value;
                setAdminDoctorData({
                  ...adminDoctorData,
                  feeType: ft,
                  fees: ft === "fixed" ? (adminDoctorData.fees || 500) : 0,
                });
              }}
              options={[
                { value: "fixed", label: "Fixed Fee (₹)" },
                { value: "post_consultation", label: "Post-Consultation (After visit)" },
                { value: "free", label: "Free / Pro Bono (₹0)" },
              ]}
              required
            />
            <Input
              label="Consultation Fee (₹) *"
              type="number"
              value={adminDoctorData.fees}
              onChange={(e) => setAdminDoctorData({ ...adminDoctorData, fees: Number(e.target.value) })}
              disabled={adminDoctorData.feeType === "post_consultation" || adminDoctorData.feeType === "free"}
              required
            />
            <Input
              label="Medical Registration / License No."
              value={adminDoctorData.registrationNumber}
              onChange={(e) => setAdminDoctorData({ ...adminDoctorData, registrationNumber: e.target.value })}
              placeholder="e.g. MCI-2024-8849"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAdminDoctorModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={savingAdminDoctor}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold rounded-xl shadow-xs"
            >
              Link Clinical Doctor Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. DOCTOR HOLIDAYS & LEAVES MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isHolidaysModalOpen}
        onClose={() => setIsHolidaysModalOpen(false)}
        title={`Doctor Holidays & Leave Overrides — Dr. ${selectedDoctorForHolidays?.name || ""}`}
        description="Schedule holidays, vacations, or day-offs over regular working schedules. Patient bookings are automatically blocked on declared dates."
        size="2xl"
      >
        <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1">
          {/* Add Holiday Form */}
          <form onSubmit={handleAddHoliday} className="p-4 rounded-2xl border border-border/80 bg-surface-alt/40 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
              <CalendarOff className="w-4 h-4 text-amber-500" />
              <span>Declare Upcoming Holiday / Day Off</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Select
                  label="Applies To Branch"
                  value={newHoliday.clinicId}
                  onChange={(e) => setNewHoliday({ ...newHoliday, clinicId: e.target.value })}
                  options={[
                    { value: "all", label: "All Clinic Locations" },
                    ...clinics.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <p className="text-[10px] text-text-muted mt-1">Select specific branch or all clinics</p>
              </div>

              <div>
                <Input
                  label="Holiday / Leave Date *"
                  type="date"
                  value={newHoliday.date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  required
                />
                <p className="text-[10px] text-text-muted mt-1">Bookings will be blocked for this day</p>
              </div>

              <div>
                <Input
                  label="Reason / Description *"
                  placeholder="e.g. Festival, Annual Leave"
                  value={newHoliday.reason}
                  onChange={(e) => setNewHoliday({ ...newHoliday, reason: e.target.value })}
                  required
                />
                <div className="flex gap-1 flex-wrap mt-1">
                  {["Diwali / Festival", "Vacation", "Medical Leave", "Conference"].map((badge) => (
                    <button
                      key={badge}
                      type="button"
                      onClick={() => setNewHoliday({ ...newHoliday, reason: badge })}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-surface hover:bg-surface-hover border border-border/60 text-text-muted hover:text-text cursor-pointer transition-colors"
                    >
                      {badge}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                loading={savingHoliday}
                className="font-bold rounded-xl text-xs gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Declare Holiday Override
              </Button>
            </div>
          </form>

          {/* Active Holidays List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-text-muted" />
                <span>Scheduled Holidays & Overrides</span>
                <Badge variant="neutral" size="sm" className="font-semibold text-[10px]">
                  {doctorHolidays.length}
                </Badge>
              </h4>
            </div>

            {loadingHolidays ? (
              <div className="flex justify-center p-8">
                <Spinner size="md" />
              </div>
            ) : doctorHolidays.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/80 rounded-2xl bg-surface space-y-1.5">
                <div className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center text-text-muted">
                  <Calendar className="w-5 h-5" />
                </div>
                <h5 className="text-xs font-bold text-text">No Scheduled Holidays</h5>
                <p className="text-xs text-text-muted max-w-sm">
                  This doctor is available per standard recurring weekly shifts. Use the form above to declare upcoming holidays.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View (< sm) */}
                <div className="block sm:hidden space-y-2.5">
                  {doctorHolidays.map((h) => (
                    <div
                      key={h.id || h._id}
                      className="p-3.5 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-text">{h.date}</span>
                        <Badge variant="warning" size="sm" className="font-semibold text-[10px]">
                          On Holiday / Leave
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Building2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                        <span>{h.clinicId?.name || "All Assigned Clinics"}</span>
                      </div>

                      <p className="text-xs text-text font-medium bg-surface-alt/60 p-2 rounded-xl">
                        {h.reason || "Doctor Away"}
                      </p>

                      <div className="pt-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => handleDeleteHoliday(h.id || h._id)}
                          className="w-full text-danger-500 hover:text-danger-600 hover:bg-danger-500/10 rounded-xl text-xs font-semibold min-h-[38px] justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Cancel Holiday
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= sm) */}
                <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border/80 bg-surface shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[10px] font-bold text-text-muted uppercase tracking-wider bg-surface-alt">
                        <th className="p-3">Date</th>
                        <th className="p-3">Branch Location</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Declared Reason</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {doctorHolidays.map((h) => (
                        <tr key={h.id || h._id} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="p-3 font-bold text-text whitespace-nowrap">
                            {h.date}
                          </td>
                          <td className="p-3 text-text-secondary whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                              <span>{h.clinicId?.name || "All Assigned Clinics"}</span>
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <Badge variant="warning" size="sm" className="font-semibold text-[10px]">
                              On Holiday / Leave
                            </Badge>
                          </td>
                          <td className="p-3 text-text font-medium">
                            {h.reason || "Doctor Away"}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => handleDeleteHoliday(h.id || h._id)}
                              className="text-danger-500 hover:text-danger-600 hover:bg-danger-500/10 rounded-lg text-[11px] font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Cancel Holiday
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
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
