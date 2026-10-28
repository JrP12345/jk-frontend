"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Alert, Table, Tabs, Button, Input, useToast, Spinner, ImageUpload, ConfirmDialog, ScheduleEditor, Select, Dropdown, Avatar, DatePicker } from "@/components/ui";
import Modal from "@/components/queue/QueueDialog";
import styles from "./TeamManagement.module.css";
import { useR2Upload } from "@/hooks/useR2Upload";
import { canViewAnalytics, hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { useOrganizationLocations } from "@/hooks/useOrganizationLocations";
import { organizationPath, organizationWorkspaceUrl } from "@/services/organization.service";
import { recordId, validSingleChoice } from "@/lib/locationWorkflow";
import { authScopeKey } from "@/lib/authScope";
import { isPharmacyWorkspace } from "@/lib/workspaceProfile";
import { useLatestRead } from "@/hooks/useLatestRead";
import { InviteOrganizationMember } from "./InviteOrganizationMember";
import { RBACPermissionMatrix } from "@/components/clinical/RBACPermissionMatrix";
import { ExecutiveAnalytics } from "@/components/analytics/ExecutiveAnalytics";
import { RotateCw, UserPlus, UserCheck, MoreHorizontal, Edit3, Trash2, Building2, Mail, Phone, Eye, EyeOff, CalendarOff, Search } from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  fees?: number;
  feeType?: "fixed" | "post_consultation" | "free";
}

export interface Receptionist {
  id: string;
  name: string;
  email: string;
  phone: string;
  shift: string;
  locationId?: string;
  locationName?: string;
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
  locationId?: string;
  locationName?: string;
  organizationName?: string;
  department?: string;
  shift?: string;
  permissions?: string[];
  [key: string]: any;
}

export default function TeamManagement({ organizationId, embedded = false }: { organizationId?: string; embedded?: boolean }) {
  const user = useAuthStore((state) => state.user);
  return <TeamWorkspace key={`${organizationId || ""}:${authScopeKey(user)}`} organizationId={organizationId} embedded={embedded} />;
}

function TeamWorkspace({ organizationId, embedded }: { organizationId?: string; embedded: boolean }) {
  const scopedPath = (path: string) => organizationPath(path, organizationId);
  const { toast, dismiss } = useToast();
  const { uploadFile } = useR2Upload();
  const { user } = useAuthStore();
  const pharmacyOnly = !organizationId || organizationId === user?.organization_id ? isPharmacyWorkspace(user) : false;
  const { locations: organizationLocations, fetchLocations, activeLocationId } = useOrganizationLocations(organizationId);
  const locations = useMemo(() => organizationLocations.filter(location => location.isActive !== false), [organizationLocations]);
  const canManageStaff = hasAnyPermission(user, "MANAGE_STAFF");
  const targetOrganizationId = organizationId || user?.organization_id;
  const context = `${organizationId || ""}:${authScopeKey(user)}`;
  const scope = authScopeKey(user);
  const currentContext = useRef(context);
  useEffect(() => { currentContext.current = context; return () => { currentContext.current = ""; }; }, [context]);
  const beginAssignmentRead = useLatestRead();
  const beginSetupRead = useLatestRead();
  const beginStaffRead = useLatestRead();
  const beginHolidayRead = useLatestRead();
  const staffReadScope = `${context}:${activeLocationId || "all"}`;
  const [loadedStaffScope, setLoadedStaffScope] = useState("");
  const [search, setSearch] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState("directory");
  const [profileTab, setProfileTab] = useState("account");
  const [assignmentTab, setAssignmentTab] = useState("list");
  const [deactivating, setDeactivating] = useState(false);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const [removingHolidayId, setRemovingHolidayId] = useState<string | null>(null);
  const [holidayError, setHolidayError] = useState(false);
  const [memberChoiceOpen, setMemberChoiceOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [setupAssignments, setSetupAssignments] = useState<any[] | null>(null);
  const [setupError, setSetupError] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [receptionists, setReceptionists] = useState<Receptionist[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [labTechs, setLabTechs] = useState<any[]>([]);
  const [pharmacists, setPharmacists] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [customStaff, setCustomStaff] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAssignment, setPendingAssignment] = useState<any>(null);
  const [retryingAssignment, setRetryingAssignment] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>(pharmacyOnly ? "pharmacist" : "doctor");
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

    return pharmacyOnly ? options.filter(option => !["doctor", "receptionist", "nurse", "lab_tech"].includes(option.value)) : options;
  }, [roles, pharmacyOnly]);

  const allStaffMembers = useMemo(() => {
    if (loadedStaffScope !== staffReadScope) return [];
    const list: StaffMember[] = [];
    doctors.forEach((d) =>
      list.push({
        ...d,
        roleType: "doctor",
        roleLabel: "Doctor",
        details: d.specialization
          ? [d.specialization, d.qualification].filter(Boolean).join(" · ")
          : d.qualification || "—",
      })
    );
    receptionists.forEach((r) =>
      list.push({
        ...r,
        roleType: "receptionist",
        roleLabel: "Receptionist",
        details: r.locationName ? `Location: ${r.locationName}` : r.shift || "—",
      })
    );
    nurses.forEach((n) =>
      list.push({
        ...n,
        roleType: "nurse",
        roleLabel: "Nurse",
        details: n.locationName ? `Location: ${n.locationName}` : n.organizationName ? `Org: ${n.organizationName}` : "Nurse Staff",
      })
    );
    labTechs.forEach((l) =>
      list.push({
        ...l,
        roleType: "lab_tech",
        roleLabel: "Lab Tech",
        details: l.locationName ? `Location: ${l.locationName}` : l.organizationName ? `Org: ${l.organizationName}` : "Lab Technician",
      })
    );
    pharmacists.forEach((p) =>
      list.push({
        ...p,
        roleType: "pharmacist",
        roleLabel: "Pharmacist",
        details: p.locationName ? `Location: ${p.locationName}` : p.organizationName ? `Org: ${p.organizationName}` : "Pharmacist",
      })
    );
    cashiers.forEach((c) =>
      list.push({
        ...c,
        roleType: "cashier",
        roleLabel: "Cashier",
        details: c.locationName ? `Location: ${c.locationName}` : c.organizationName ? `Org: ${c.organizationName}` : "Billing Cashier",
      })
    );
    customStaff.forEach((s) =>
      list.push({
        ...s,
        roleType: s.role,
        roleLabel: (s.role || "").replace(/_/g, " ").toUpperCase(),
        details: s.locationName
          ? `Location: ${s.locationName}`
          : s.organizationName
          ? `Org: ${s.organizationName}`
          : s.department || s.specialization || "Staff Member",
      })
    );
    return list;
  }, [doctors, receptionists, nurses, labTechs, pharmacists, cashiers, customStaff, loadedStaffScope, staffReadScope]);

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
  const [assignmentError, setAssignmentError] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState<any>({
    locationId: "",
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
    locationId: "all",
    date: "",
    reason: "Public Holiday",
  });

  const [holidayTab, setHolidayTab] = useState("form");
  const readHolidays = async (doctorId: string) => {
    const request = beginHolidayRead();
    setLoadingHolidays(true); setHolidayError(false);
    try {
      const response = await api.get(scopedPath("/doctor-overrides?doctorId=" + doctorId), { signal: request.signal });
      if (request.isCurrent()) setDoctorHolidays(response.data?.data || []);
    } catch { if (request.isCurrent()) setHolidayError(true); }
    finally { if (request.isCurrent()) setLoadingHolidays(false); }
  };
  const openHolidaysModal = async (doctor: Doctor | StaffMember) => {
    setSelectedDoctorForHolidays(doctor);
    setDoctorHolidays([]); setHolidayTab("form");
    setIsHolidaysModalOpen(true);
    setNewHoliday({ locationId: "all", date: new Date(new Date().getTime() + 86400000).toISOString().slice(0, 10), reason: "Public Holiday" });
    await readHolidays(doctor.id);
  };
  const handleAddHoliday = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageStaff || savingHoliday || loadingHolidays || holidayError || !selectedDoctorForHolidays || !newHoliday.date || !newHoliday.reason.trim()) return;
    const submittedContext = context;
    const doctorId = selectedDoctorForHolidays.id;
    setSavingHoliday(true);
    try {
      await api.post(scopedPath("/doctor-overrides"), { doctorId, locationId: newHoliday.locationId, date: newHoliday.date, status: "unavailable", reason: newHoliday.reason.trim() });
      if (currentContext.current !== submittedContext) return;
      toast({ title: "Leave saved", description: "Bookings are blocked for the selected date.", variant: "success" });
      setHolidayTab("list");
      await readHolidays(doctorId);
    } catch (error: any) { if (currentContext.current === submittedContext) toast({ title: "Could not save leave", description: error.response?.data?.message || "Try again.", variant: "error" }); }
    finally { if (currentContext.current === submittedContext) setSavingHoliday(false); }
  };
  const handleDeleteHoliday = async (overrideId: string) => {
    if (!canManageStaff || removingHolidayId) return;
    const submittedContext = context;
    setRemovingHolidayId(overrideId);
    try {
      await api.delete(scopedPath("/doctor-overrides/" + overrideId));
      if (currentContext.current !== submittedContext) return;
      setDoctorHolidays(previous => previous.filter(holiday => (holiday.id || holiday._id) !== overrideId));
      toast({ title: "Leave cancelled", description: "The regular schedule applies again.", variant: "success" });
    } catch (error: any) { if (currentContext.current === submittedContext) toast({ title: "Could not cancel leave", description: error.response?.data?.message || "Try again.", variant: "error" }); }
    finally { if (currentContext.current === submittedContext) setRemovingHolidayId(null); }
  };

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allStaffMembers.filter((member) => (selectedRoleFilter === "all" || member.roleType === selectedRoleFilter) && [member.name, member.email, member.phone || "", member.roleLabel, member.details || ""].some(value => value.toLowerCase().includes(query)));
  }, [allStaffMembers, selectedRoleFilter, search]);

  const handleEnableAdminDoctorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAdminDoctor || !canManageStaff) return;
    if (!adminDoctorData.specialization) {
      toast({ title: "Validation Required", description: "Please enter your clinical specialization.", variant: "error" });
      return;
    }
    setSavingAdminDoctor(true);
    const submittedContext = context;
    try {
      const response = await api.post(scopedPath("/onboarding/admin/enable-doctor-profile"), adminDoctorData);
      if (currentContext.current !== submittedContext || authScopeKey(useAuthStore.getState().user) !== authScopeKey(user)) return;
      toast({
        title: "Doctor Profile Linked",
        description: "Next, review your location, consultation hours and fees. A location assignment is required for public listing.",
        variant: "success",
      });
      setIsAdminDoctorModalOpen(false);
      void fetchStaff();
      await openAssignmentsModal({ ...adminDoctorData, ...response.data?.data, id: user!.id, name: user!.name, email: user!.email, phone: "" });
    } catch (err: any) {
      if (currentContext.current !== submittedContext) return;
      toast({
        title: "Unable to Link Profile",
        description: err.response?.data?.message || "Failed to link doctor profile. Please try again.",
        variant: "error",
      });
    } finally {
      if (currentContext.current === submittedContext) setSavingAdminDoctor(false);
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
    } else if (field === "locationId" && modalType === "receptionist" && !val) {
      error = "Location assignment is required";
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
    const request = beginStaffRead();
    try {
      setLoadError(null);
      const url = activeLocationId ? `/onboarding/staff?locationId=${activeLocationId}` : "/onboarding/staff";
      const res = await api.get(scopedPath(url), { signal: request.signal });
      if (!request.isCurrent()) return;
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
      setLoadedStaffScope(staffReadScope);
    } catch {
      if (!request.isCurrent()) return;
      setLoadError("Team members could not be loaded. Check your connection and try again.");
      toast({ title: "Error", description: "Failed to load staff list", variant: "error" });
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get(scopedPath("/roles"));
      setRoles(res.data?.data || []);
    } catch {
      console.error("Failed to load custom roles list");
    }
  };

  const fetchSetupAssignments = async () => {
    if (pharmacyOnly || !targetOrganizationId || !hasAnyPermission(user, "VIEW_LOCATIONS", "MANAGE_LOCATIONS")) return;
    const request = beginSetupRead();
    const readContext = context;
    setSetupError(false);
    try {
      const response = await api.get(scopedPath("/onboarding/doctors/assignments"), { signal: request.signal });
      if (!Array.isArray(response.data?.data)) throw new Error("Incomplete assignment response");
      if (request.isCurrent() && currentContext.current === readContext) setSetupAssignments(response.data?.data || []);
    } catch { if (request.isCurrent() && currentContext.current === readContext) { setSetupAssignments(null); setSetupError(true); } }
  };

  const loadData = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([fetchStaff(), fetchLocations(), fetchRoles(), fetchSetupAssignments()]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setSetupAssignments(null);
    setIsAssignmentsModalOpen(false);
    setIsAdminDoctorModalOpen(false);
    setInviteOpen(false);
    setMemberChoiceOpen(false);
    setSavingAdminDoctor(false);
    setSavingAssignment(false);
    loadData();
  }, [activeLocationId, organizationId, scope]);

  const openModal = (type: "doctor" | "receptionist" | "nurse" | "lab_tech" | "pharmacist" | "cashier" = "doctor") => {
    setProfileTab("account");
    setEditingId(null);
    setModalType(type);
    setFormData({
      locationId: locations.length === 1 ? locations[0].id : "",
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
    setProfileTab("account");
    setEditingId(row.id);
    setModalType(type);
    setFormData({ ...row });
    setStaffErrors({});
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canManageStaff) return;
    const submittedContext = context;

    const isNameValid = validateStaffField("name", formData.name || "");
    const isEmailValid = validateStaffField("email", formData.email || "");
    const isPassValid = editingId ? true : validateStaffField("password", formData.password || "");
    const isSpecValid = modalType === "doctor" ? validateStaffField("specialization", formData.specialization || "") : true;
    const isLocationValid = modalType === "receptionist" ? validateStaffField("locationId", formData.locationId || "") : true;

    if (!isNameValid || !isEmailValid || !isPassValid || !isSpecValid || !isLocationValid) {
      setProfileTab(!isNameValid || !isEmailValid || !isPassValid ? "account" : "profile");
      toast({ title: "Validation Error", description: "Please correct the highlighted errors.", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const finalData = { ...formData };

      // Handle deferred image upload
      if (finalData.image_url instanceof File) {
        const uploadNotice = crypto.randomUUID();
        toast({ id: uploadNotice, title: "Uploading photo", description: "Please wait while the profile photo is saved.", variant: "default" });
        try {
          const { objectKey } = await uploadFile(finalData.image_url, { organizationId: targetOrganizationId, contentClass: "avatar" });
          if (currentContext.current !== submittedContext) return;
          finalData.image_url = objectKey;
        } finally { dismiss(uploadNotice); }
      }

      if (editingId) {
        const updateEndpoint =
          modalType === "doctor" || modalType === "receptionist"
            ? `/onboarding/${modalType}/${editingId}`
            : `/onboarding/staff/${editingId}`;
        await api.put(scopedPath(updateEndpoint), finalData);
        toast({ title: "Success", description: "Team member updated successfully!", variant: "success" });
      } else if (modalType === "doctor" || modalType === "receptionist") {
        const res = await api.post(scopedPath(`/onboarding/${modalType}`), finalData);
        if (currentContext.current !== submittedContext) return;
        if (modalType === "doctor" && finalData.locationId && res.data?.data?.id) {
          try {
            const docFeeType = finalData.feeType || "fixed";
            const docFees = docFeeType === "free" ? 0 : (Number(finalData.fees) || (docFeeType === "post_consultation" ? 0 : 500));
            const assignment = {
              doctorId: res.data.data.id,
              locationId: finalData.locationId,
              fees: docFees,
              feeType: docFeeType,
              appointmentDuration: Number(finalData.appointmentDuration) || 15,
              workingHours: DEFAULT_WORKING_HOURS,
              bookingMode: "sequential_queue",
            };
            setPendingAssignment(assignment);
            await api.post(scopedPath("/onboarding/doctors/assignments"), assignment);
            setPendingAssignment(null);
          } catch {
            toast({ title: "Doctor account created; location assignment failed", description: "Retry the location assignment below. Do not register the doctor again.", variant: "error" });
            setIsModalOpen(false);
            void fetchStaff();
            return;
          }
        }
        toast({ title: "Success", description: `${modalType === "doctor" ? "Doctor" : "Receptionist"} registered successfully!`, variant: "success" });
      } else {
        await api.post(scopedPath(`/onboarding/staff`), { ...finalData, role: modalType });
        toast({
          title: "Success",
          description: `${modalType.replace("_", " ").toUpperCase()} registered successfully!`,
          variant: "success",
        });
      }
      setIsModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      if (currentContext.current !== submittedContext) return;
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
    if (!deletingId || deactivating || !canManageStaff) return;
    setDeactivating(true);
    try {
      await api.delete(scopedPath(`/onboarding/staff/${deletingId}`));
      toast({ title: "Success", description: "Staff deactivated successfully!", variant: "success" });
      setDeletingId(null);
      fetchStaff();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Staff could not be deactivated. Please retry.",
        variant: "error",
      });
    } finally {
      setDeactivating(false);
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
  const assignmentDefaults = (doctor: Doctor | StaffMember | null, currentAssignments: any[] = []) => {
    const choices = locations.filter(location => location.isActive !== false && !currentAssignments.some(assignment => recordId(assignment.locationId) === location.id));
    const feeType = doctor?.feeType || "fixed";
    return { locationId: validSingleChoice(choices, location => location.id), fees: feeType === "free" ? 0 : doctor?.fees ?? 100, feeType, appointmentDuration: 15, workingHours: DEFAULT_WORKING_HOURS, bookingMode: "sequential_queue", maxDailyTokens: "" };
  };

  const openAssignmentsModal = async (doctor: Doctor | StaffMember) => {
    const request = beginAssignmentRead();
    const readContext = context;
    setSelectedDoctorForAssignments(doctor);
    setAssignmentTab("list");
    setAssignments([]);
    setNewAssignment(assignmentDefaults(doctor));
    setIsAssignmentsModalOpen(true);
    setAssignmentLoading(true);
    setAssignmentError(false);
    setEditingAssignmentId(null);
    try {
      const res = await api.get(scopedPath(`/onboarding/doctors/assignments?doctorId=${doctor.id}`), { signal: request.signal });
      if (!request.isCurrent() || currentContext.current !== readContext) return;
      if (!Array.isArray(res.data?.data)) throw new Error("Incomplete assignment response");
      const currentAssignments = res.data.data || [];
      setAssignments(currentAssignments);
      setNewAssignment(assignmentDefaults(doctor, currentAssignments));
      if (!currentAssignments.length) setAssignmentTab("form");
    } catch {
      if (request.isCurrent() && currentContext.current === readContext) setAssignmentError(true);
    } finally {
      if (request.isCurrent() && currentContext.current === readContext) setAssignmentLoading(false);
    }
  };

  const handleStartEditAssignment = (asg: any) => {
    setAssignmentTab("form");
    setEditingAssignmentId(asg.id || asg._id);
    setNewAssignment({
      locationId: asg.locationId?.id || asg.locationId?._id || asg.locationId,
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
    setNewAssignment(assignmentDefaults(selectedDoctorForAssignments, assignments));
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAssignment || !canManageStaff || !selectedDoctorForAssignments || assignmentLoading || assignmentError) return;
    const submittedContext = context;
    const doctorId = selectedDoctorForAssignments.id;
    const asgFeeType = (newAssignment as any).feeType || "fixed";
    if (!newAssignment.locationId || (asgFeeType === "fixed" && newAssignment.fees === undefined)) {
      toast({
        title: "Validation Error",
        description: "Please select a location and set consultation fees.",
        variant: "error",
      });
      return;
    }
    const finalHours =
      newAssignment.workingHours && newAssignment.workingHours !== "{}"
        ? newAssignment.workingHours
        : DEFAULT_WORKING_HOURS;
    setSavingAssignment(true);
    const asgFees = asgFeeType === "free" ? 0 : Number(newAssignment.fees || 0);
    try {
      if (editingAssignmentId) {
        await api.put(scopedPath(`/onboarding/doctors/assignments/${editingAssignmentId}`), {
          fees: asgFees,
          feeType: asgFeeType,
          appointmentDuration: Number(newAssignment.appointmentDuration),
          workingHours: finalHours,
          bookingMode: (newAssignment as any).bookingMode || "sequential_queue",
          maxDailyTokens: (newAssignment as any).maxDailyTokens ? Number((newAssignment as any).maxDailyTokens) : null,
        });
        toast({ title: "Updated", description: "Doctor location assignment updated successfully.", variant: "success" });
      } else {
        await api.post(scopedPath("/onboarding/doctors/assignments"), {
          doctorId,
          locationId: newAssignment.locationId,
          fees: asgFees,
          feeType: asgFeeType,
          appointmentDuration: Number(newAssignment.appointmentDuration),
          workingHours: finalHours,
          bookingMode: (newAssignment as any).bookingMode || "sequential_queue",
          maxDailyTokens: (newAssignment as any).maxDailyTokens ? Number((newAssignment as any).maxDailyTokens) : null,
        });
        toast({ title: "Assigned", description: "Doctor assigned to location successfully.", variant: "success" });
      }
      if (currentContext.current !== submittedContext || authScopeKey(useAuthStore.getState().user) !== scope) return;
      const res = await api.get(scopedPath(`/onboarding/doctors/assignments?doctorId=${doctorId}`));
      if (currentContext.current !== submittedContext || authScopeKey(useAuthStore.getState().user) !== scope) return;
      setAssignments(res.data.data || []);
      setAssignmentTab("list");
      setEditingAssignmentId(null);
      setNewAssignment(assignmentDefaults(selectedDoctorForAssignments, res.data.data || []));
      void fetchSetupAssignments();
    } catch (err: any) {
      if (currentContext.current !== submittedContext) return;
      toast({ title: "Error", description: err.response?.data?.message || "Failed to save assignment", variant: "error" });
    } finally {
      if (currentContext.current === submittedContext) setSavingAssignment(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!canManageStaff || removingAssignmentId || savingAssignment) return;
    const submittedContext = context;
    setRemovingAssignmentId(assignmentId);
    try {
      await api.delete(scopedPath(`/onboarding/doctors/assignments/${assignmentId}`));
      if (currentContext.current !== submittedContext) return;
      toast({ title: "Removed", description: "Doctor assignment removed successfully.", variant: "success" });
      if (editingAssignmentId === assignmentId) {
        setEditingAssignmentId(null);
      }
      const res = await api.get(scopedPath(`/onboarding/doctors/assignments?doctorId=${selectedDoctorForAssignments?.id}`));
      if (currentContext.current !== submittedContext) return;
      setAssignments(res.data.data || []);
      setNewAssignment(assignmentDefaults(selectedDoctorForAssignments, res.data.data || []));
      void fetchSetupAssignments();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to remove assignment",
        variant: "error",
      });
    } finally {
      if (currentContext.current === submittedContext) setRemovingAssignmentId(null);
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

  const availableLocations = locations.filter(
    (c) => c.isActive !== false && !assignments.some((a) => recordId(a.locationId) === c.id)
  );
  const ownDoctor = doctors.find(doctor => doctor.id === user?.id);
  const unassignedDoctors = setupAssignments === null ? [] : doctors.filter(doctor => !setupAssignments.some(assignment => assignment.isActive !== false && recordId(assignment.doctorId) === doctor.id));

  const readingStaff = loading || (loadedStaffScope !== staffReadScope && !loadError);
  const Heading = embedded ? "h2" : "h1";
  const staffActions = (member: StaffMember) => <div className={styles.rowActions}>
    {canManageStaff && member.roleType === "doctor" && <Button size="sm" variant="outline" aria-label={unassignedDoctors.some(doctor => doctor.id === member.id) ? "Finish setup for " + member.name : "Assignments for " + member.name} onClick={() => openAssignmentsModal(member)}>{unassignedDoctors.some(doctor => doctor.id === member.id) ? "Finish setup" : "Assignments"}</Button>}
    {canManageStaff && <Dropdown align="right" width="w-56" trigger={<Button size="sm" variant="ghost" className={styles.iconAction} title="Row Actions" aria-label={"Actions for " + member.name}><MoreHorizontal size={18} /></Button>} items={[
      { label: member.roleType === "doctor" ? "Edit Doctor" : "Edit profile", icon: <Edit3 size={16} />, onClick: () => openEditModal(member.roleType, member) },
      ...(member.roleType === "doctor" ? [{ label: "Leave & holidays", icon: <CalendarOff size={16} />, onClick: () => openHolidaysModal(member) }] : []),
      { label: "Deactivate account", icon: <Trash2 size={16} />, variant: "danger" as const, onClick: () => setDeletingId(member.id) },
    ]} />}
  </div>;
  const staffIdentity = (member: StaffMember) => <div className={styles.identity}><Avatar name={member.name} src={member.image_url} size="sm" /><div><strong>{member.name}</strong><span>{member.roleLabel}</span>{member.details && <small>{member.details}</small>}</div></div>;
  const directory = <section className={styles.directory} aria-label="Staff directory">
    <div className={styles.toolbar}>
      <Input type="search" icon={<Search size={16} />} aria-label="Search staff" placeholder="Search staff" value={search} onChange={event => setSearch(event.target.value)} />
      <Select aria-label="Filter by role" value={selectedRoleFilter} onChange={event => setSelectedRoleFilter(event.target.value)} options={roleFilterTabs.filter(role => role.key === "all" || role.count > 0 || selectedRoleFilter === role.key).map(role => ({ value: role.key, label: role.label + (readingStaff ? "" : " (" + role.count + ")") }))} />
    </div>
    <Table variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} pagination={filteredStaff.length > 10} loading={readingStaff} error={loadError} onRetry={fetchStaff} data={filteredStaff}
      columns={[
        { key: "name", header: "Team member", render: staffIdentity },
        { key: "contact", header: "Contact", render: (member: StaffMember) => <div className={styles.contact}>{member.email && <a href={"mailto:" + member.email}><Mail size={13} /><span>{member.email}</span></a>}{member.phone && <a href={"tel:" + member.phone}><Phone size={13} /><span>{member.phone}</span></a>}</div> },
        { key: "locationName", header: "Location / shift", render: (member: StaffMember) => <div className={styles.contact}><span>{member.locationName || "Not listed"}</span>{member.shift && <span>{member.shift}</span>}</div> },
        { key: "actions", header: "", align: "right", render: staffActions },
      ]} mobileCardView renderMobileCard={(member: StaffMember) => <article className={styles.staffCard} key={member.id}>
        {staffIdentity(member)}<div className={styles.contact}>{member.email && <a href={"mailto:" + member.email}><Mail size={13} /><span>{member.email}</span></a>}{member.phone && <a href={"tel:" + member.phone}><Phone size={13} /><span>{member.phone}</span></a>}{member.locationName && <span>{member.locationName}{member.shift ? " · " + member.shift : ""}</span>}</div>{staffActions(member)}
      </article>} emptyMessage={loadError ? "Staff are unavailable. Try again." : search || selectedRoleFilter !== "all" ? "No team members match your filters." : "No team members yet. Add a member to get started."} />
    {!readingStaff && !loadError && <footer className={styles.resultCount}>{filteredStaff.length} of {allStaffMembers.length} team members</footer>}
  </section>;

  return (
    <div className={styles.workspace}>
      {pendingAssignment && <Alert variant="error" title="Doctor needs location assignment" action={<Button variant="outline" size="sm" loading={retryingAssignment} onClick={async () => {
        setRetryingAssignment(true);
        try { await api.post(scopedPath("/onboarding/doctors/assignments"), pendingAssignment); setPendingAssignment(null); toast({ title: "Doctor assigned", description: "The existing doctor account is now assigned to the location.", variant: "success" }); void fetchStaff(); }
        catch (err: any) { toast({ title: "Assignment failed", description: err.response?.data?.message || "Please retry the location assignment.", variant: "error" }); }
        finally { setRetryingAssignment(false); }
      }}>Retry assignment</Button>}>The account exists, but booking setup is incomplete. Fee: {pendingAssignment.fees}; duration: {pendingAssignment.appointmentDuration} minutes; mode: sequential queue.</Alert>}
      {canManageStaff && setupError && <Alert variant="warning" title="Booking setup could not be checked" action={<Button variant="outline" size="sm" onClick={fetchSetupAssignments}>Retry setup check</Button>}>Your team remains available. Retry to check which doctors need location assignments.</Alert>}

      <header className={styles.header}><div><Heading>Staff</Heading><p>Profiles, location assignments and availability</p></div><div className={styles.headerActions}><Button variant="ghost" size="sm" className={styles.iconAction} aria-label="Refresh staff" disabled={isRefreshing} onClick={loadData}><RotateCw size={17} className={isRefreshing ? "animate-spin" : ""} /></Button>{canManageStaff && <Button size="sm" onClick={() => setMemberChoiceOpen(true)}><UserPlus size={16} /> Add Member</Button>}</div></header>
      {canManageStaff && !pharmacyOnly && <div className={styles.selfSetup}><Button variant="ghost" size="sm" disabled={readingStaff || user?.role === "root" || (!!organizationId && organizationId !== user?.organization_id)} onClick={() => ownDoctor ? openAssignmentsModal(ownDoctor) : setIsAdminDoctorModalOpen(true)}><UserCheck size={15} />{ownDoctor ? "My doctor setup" : "Set up myself as a doctor"}</Button>{user?.role === "root" && <p>To link an administrator's doctor profile, use their organization session.</p>}</div>}

      <Modal open={memberChoiceOpen} onClose={() => setMemberChoiceOpen(false)} title="Add a team member" description="Choose how this person joins your organization." size="sm" bodyClassName={styles.dialogBody} footer={<Button variant="outline" size="sm" onClick={() => setMemberChoiceOpen(false)}>Cancel</Button>}>
        <div className="space-y-4">
          <div><Button disabled={!targetOrganizationId} onClick={() => { setMemberChoiceOpen(false); setInviteOpen(true); }}>Use an existing account</Button><p className="mt-2 text-sm text-text-muted">Invite them by email. Their existing account and other organization memberships are retained.</p></div>
          <div><Button variant="outline" onClick={() => { setMemberChoiceOpen(false); openModal(pharmacyOnly ? "pharmacist" : "doctor"); }}>Create a new account</Button><p className="mt-2 text-sm text-text-muted">{pharmacyOnly ? "Create a pharmacy staff account and assign its branch permissions." : "Register a new team member and configure their clinical profile."}</p></div>
        </div>
      </Modal>
      {inviteOpen && targetOrganizationId && <InviteOrganizationMember key={targetOrganizationId} organizationId={targetOrganizationId} onClose={() => setInviteOpen(false)} />}

      {embedded ? directory : <Tabs className={styles.workspaceTabs} variant="pills" activeTab={workspaceTab} onChange={setWorkspaceTab} scrollActiveIntoView={false} tabs={[
        { id: "directory", label: "Staff", badge: readingStaff ? undefined : allStaffMembers.length, content: directory },
        ...(canManageStaff ? [{ id: "rbac", label: "Permissions", content: <RBACPermissionMatrix organizationId={organizationId} users={allStaffMembers.map(member => ({ id: member.id, name: member.name, email: member.email, role: member.roleType, permissions: member.permissions || [] }))} onRefresh={loadData} /> }] : []),
        ...(!pharmacyOnly && canViewAnalytics(user) ? [{ id: "analytics", label: "Insights", content: <ExecutiveAnalytics /> }] : []),
      ]} />}

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? `Update ${modalType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}` : "Add Team Member"}
        description={editingId ? "Update credentials and details for this team member." : "Add a doctor, receptionist, nurse, or other staff member to your practice."}
        size="lg"
        busy={submitting}
        bodyClassName={styles.dialogBody}
        headerClassName={styles.profileHeader}
        header={<><h2>{editingId ? "Edit profile" : "New team member"}</h2><p>{editingId ? formData.name : "Choose a role and add their account details."}</p><Tabs variant="pills" activeTab={profileTab} onChange={setProfileTab} scrollActiveIntoView={false} tabs={[{ id: "account", label: "Account" }, { id: "profile", label: "Profile & practice" }]} /></>}
        footer={
          <>
            <Button disabled={submitting} variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button form="staff-form" type="submit" size="sm" variant="primary" loading={submitting} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold">
              {editingId ? "Update Profile" : "Add Team Member"}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleSave} className="space-y-4 pt-1 pr-1" noValidate>
          <section hidden={profileTab !== "account"} className={styles.formSection}>
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
                    locationId: prev.locationId || (locations.length === 1 ? locations[0].id : ""),
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
              placeholder="e.g. +1 415 555 0199" type="tel" inputMode="tel"
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

          </section>
          <section hidden={profileTab !== "profile"} className={styles.formSection}>
          {/* Staff Profile Photo Upload */}
          <div className="space-y-2">
            <ImageUpload
              value={formData.image_url || null}
              onChange={(value) => handleFieldChange("image_url", value)}
              label="Profile photo"
              helperText="PNG, JPEG or WebP (max. 2 MB)"
              disabled={submitting}
            />
            <p className="text-xs text-text-muted">
              Upload a professional staff photo. Displayed on patient portals, appointments, and staff directories.
            </p>
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
              {!editingId && locations.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 bg-surface-alt/60 border border-border/70 rounded-2xl">
                  <div>
                    <Select
                      label="Primary Practice Location"
                      value={formData.locationId || (locations.length === 1 ? locations[0].id : "")}
                      onChange={(e) => handleFieldChange("locationId", e.target.value)}
                      placeholder="Choose primary location..."
                      options={locations.map((c) => ({ value: c.id, label: c.name }))}
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
                        if (ft === "free") handleFieldChange("fees", 0);
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
                      label={formData.feeType === "post_consultation" ? "Min. Visit Charge (₹) — optional" : "Consultation Fee (₹)"}
                      type="number"
                      value={formData.fees ?? (formData.feeType === "free" ? 0 : 500)}
                      onChange={(e) => handleFieldChange("fees", e.target.value)}
                      placeholder={formData.feeType === "post_consultation" ? "e.g. 200 (or 0 for no minimum)" : "e.g. 500"}
                      disabled={formData.feeType === "free"}
                    />
                    <p className="text-[11px] text-text-muted mt-1">
                      {formData.feeType === "post_consultation" ? "Base visit fee charged at location + consultation decided after visit" : formData.feeType === "free" ? "No fee charged" : "Standard OPD consultation charge"}
                    </p>
                  </div>
                </div>
              )}

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
                value={formData.locationId || (locations.length === 1 ? locations[0].id : "")}
                onChange={(e) => handleFieldChange("locationId", e.target.value)}
                error={staffErrors.locationId}
                placeholder="Choose a practice location..."
                options={locations.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Input
                label="Shift Schedule"
                placeholder="e.g. Morning (08:00 - 16:00)"
                value={formData.shift || ""}
                onChange={(e) => handleFieldChange("shift", e.target.value)}
              />
            </div>
          )}

          </section>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. DOCTOR LOCATION ASSIGNMENTS MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isAssignmentsModalOpen}
        onClose={() => { if (!savingAssignment) setIsAssignmentsModalOpen(false); }}
        busy={savingAssignment || Boolean(removingAssignmentId)}
        title="Location Assignments"
        description={selectedDoctorForAssignments?.name}
        size="lg"
        bodyClassName={styles.dialogBody}
        footer={<><Button size="sm" variant="outline" disabled={savingAssignment || Boolean(removingAssignmentId)} onClick={() => setIsAssignmentsModalOpen(false)}>Done</Button>{assignmentTab === "form" && !assignmentLoading && !assignmentError && (availableLocations.length > 0 || editingAssignmentId) && <Button size="sm" type="submit" form="doctor-assignment" loading={savingAssignment}>{editingAssignmentId ? "Update Branch Assignment" : "Assign Location"}</Button>}</>}
      >
        <div className="space-y-4 pt-1">
          <ol aria-label="Doctor setup steps" className={styles.setupSteps}><li>1. Profile</li><li aria-current="step">2. Location</li><li>3. Preview</li></ol>
          {assignmentError && <Alert variant="error" title="Location assignments could not be loaded" action={<Button variant="outline" onClick={() => selectedDoctorForAssignments && openAssignmentsModal(selectedDoctorForAssignments)}>Retry assignments</Button>}>Retry before creating an assignment.</Alert>}
          {!assignmentLoading && !assignmentError && !locations.length && <Alert variant="warning" title="Create a location first">A doctor needs an active location before public booking can be configured. <Link className="text-accent hover:underline" href={organizationWorkspaceUrl(targetOrganizationId, "locations")}>Open location setup</Link></Alert>}
          {!assignmentLoading && !assignmentError && assignments.length > 0 && <p className={styles.bookingReview}><Link href={organizationWorkspaceUrl(targetOrganizationId)}>Review public booking setup &rarr;</Link></p>}

          <Tabs variant="pills" activeTab={assignmentTab} onChange={setAssignmentTab} scrollActiveIntoView={false} tabs={[{id:"list",label:"Locations",badge:assignmentLoading?undefined:assignments.length},...(!assignmentError && !assignmentLoading && (availableLocations.length>0 || editingAssignmentId) ? [{id:"form",label:editingAssignmentId?"Edit assignment":"Add assignment"}] : [])]} />
          <section hidden={assignmentTab !== "list"} className={styles.assignmentList} aria-label="Assigned locations">
            {assignmentLoading ? <div role="status" className={styles.empty}><Spinner size="sm" />Loading assignments...</div> : assignmentError ? null : assignments.length === 0 ? <p className={styles.empty}>No locations assigned yet. Add an assignment to set hours and fees.</p> : assignments.map(assignment => <article key={assignment.id || assignment._id} className={styles.assignmentCard}>
              <div><strong>{assignment.locationId?.name || "Location"}</strong><p>{assignment.feeType === "free" ? "Free consultation" : assignment.feeType === "post_consultation" ? "Fee after consultation" : "Consultation: \u20b9" + assignment.fees} &middot; {assignment.appointmentDuration} min</p><p>{assignment.bookingMode === "time_slot" ? "Time slots" : "Token queue"} &middot; {formatTimings(assignment.workingHours)}</p></div>
              <div className={styles.rowActions}><Button size="sm" variant="outline" disabled={savingAssignment || Boolean(removingAssignmentId)} onClick={() => handleStartEditAssignment(assignment)}>Edit</Button><Button size="sm" variant="ghost" loading={removingAssignmentId === (assignment.id || assignment._id)} disabled={savingAssignment || Boolean(removingAssignmentId && removingAssignmentId !== (assignment.id || assignment._id))} onClick={() => handleRemoveAssignment(assignment.id || assignment._id)}>Remove</Button></div>
            </article>)}
          </section>
          <section hidden={assignmentTab !== "form"}>
          {!assignmentLoading && !assignmentError && (availableLocations.length > 0 || editingAssignmentId) ? (
            <form id="doctor-assignment"
              onSubmit={handleAddAssignment}
              className="border border-border/80 rounded-2xl p-4 space-y-3.5 bg-surface shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                  {editingAssignmentId ? "Hours & fees" : "New assignment"}
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
                    { value: "sequential_queue", label: "Token queue" },
                    { value: "time_slot", label: "Time slots" },
                  ]}
                  required
                />

                {editingAssignmentId ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text block">Location</label>
                    <div className="p-2.5 bg-surface-alt border border-border/80 rounded-xl text-xs font-bold text-text flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-accent" />
                      <span>
                        {assignments.find((a) => (a.id || a._id) === editingAssignmentId)?.locationId?.name ||
                          "Selected Branch"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <Select
                    label="Select Location *"
                    value={newAssignment.locationId}
                    onChange={(e) => setNewAssignment({ ...newAssignment, locationId: e.target.value })}
                    options={[
                      { value: "", label: "Choose a location..." },
                      ...availableLocations.map((c) => ({ value: c.id, label: c.name })),
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
                      fees: ft === "free" ? 0 : (newAssignment.fees || (ft === "fixed" ? 500 : 0)),
                    } as any);
                  }}
                  options={[
                    { value: "fixed", label: "Fixed Fee (₹)" },
                    { value: "post_consultation", label: "Post-Consultation (After visit)" },
                    { value: "free", label: "Free / Pro Bono (₹0)" },
                  ]}
                  required
                />
                {((newAssignment as any).feeType || "fixed") === "free" ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text block">Consultation Fee</label>
                    <div className="p-2.5 bg-surface-alt border border-border/80 rounded-xl text-xs font-medium text-text-muted truncate">
                      ₹0 (Free)
                    </div>
                  </div>
                ) : (
                  <Input
                    label={((newAssignment as any).feeType || "fixed") === "post_consultation" ? "Min. Visit Charge (₹)" : "Consultation Fee (₹) *"}
                    type="number"
                    value={newAssignment.fees}
                    onChange={(e) => setNewAssignment({ ...newAssignment, fees: Number(e.target.value) })}
                    placeholder={((newAssignment as any).feeType || "fixed") === "post_consultation" ? "e.g. 200 (or 0)" : "e.g. 500"}
                    required={((newAssignment as any).feeType || "fixed") === "fixed"}
                  />
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
                key={editingAssignmentId || "new"}
                onChange={(val) => setNewAssignment((previous: any) => ({ ...previous, workingHours: val }))}
              />

            </form>
          ) : !assignmentLoading && !assignmentError && locations.length > 0 ? (
            <div className="text-xs text-text-muted text-center py-4 border border-border/80 bg-surface-alt rounded-2xl font-medium">
              Dr. {selectedDoctorForAssignments?.name} is already assigned to all active locations.
            </div>
          ) : null}
          </section>
        </div>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. LINK DOCTOR PROFILE TO ADMIN MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isAdminDoctorModalOpen}
        onClose={() => setIsAdminDoctorModalOpen(false)}
        title="Set up myself as a doctor"
        description="Step 1 of 3: confirm your clinical profile. Next, choose a location and review consultation hours and fees before previewing the public page."
        busy={savingAdminDoctor}
        size="md"
        bodyClassName={styles.dialogBody}
        footer={<div className={styles.footerActions}>
            <Button variant="outline" size="sm" type="button" disabled={savingAdminDoctor} onClick={() => setIsAdminDoctorModalOpen(false)} className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px]">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit" form="owner-doctor-profile"
              loading={savingAdminDoctor}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[36px] font-semibold"
            >
              Save profile & continue
            </Button>
          </div>}
      >
        <form id="owner-doctor-profile" onSubmit={handleEnableAdminDoctorProfile} className="space-y-4 pt-1">
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
                  fees: ft === "free" ? 0 : (adminDoctorData.fees || (ft === "fixed" ? 500 : 0)),
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
              label={adminDoctorData.feeType === "post_consultation" ? "Min. Visit Charge (₹)" : "Consultation Fee (₹) *"}
              type="number"
              value={adminDoctorData.fees}
              onChange={(e) => setAdminDoctorData({ ...adminDoctorData, fees: Number(e.target.value) })}
              placeholder={adminDoctorData.feeType === "post_consultation" ? "e.g. 200 (or 0)" : "e.g. 500"}
              disabled={adminDoctorData.feeType === "free"}
              required={adminDoctorData.feeType === "fixed"}
            />
            <Input
              label="Medical Registration / License No."
              value={adminDoctorData.registrationNumber}
              onChange={(e) => setAdminDoctorData({ ...adminDoctorData, registrationNumber: e.target.value })}
              placeholder="e.g. MCI-2024-8849"
            />
          </div>

        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. DOCTOR HOLIDAYS & LEAVES MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal open={isHolidaysModalOpen} onClose={() => setIsHolidaysModalOpen(false)} title="Leave & holidays" description={selectedDoctorForHolidays?.name} size="md" busy={savingHoliday || Boolean(removingHolidayId)} bodyClassName={styles.dialogBody}
        footer={<><Button size="sm" variant="outline" disabled={savingHoliday || Boolean(removingHolidayId)} onClick={() => setIsHolidaysModalOpen(false)}>Done</Button>{holidayTab === "form" && <Button size="sm" type="submit" form="doctor-leave" loading={savingHoliday} disabled={loadingHolidays || holidayError}>Save leave</Button>}</>}>
        <Tabs variant="pills" activeTab={holidayTab} onChange={setHolidayTab} scrollActiveIntoView={false} tabs={[{id:"form",label:"Add leave"},{id:"list",label:"Scheduled",badge:loadingHolidays?undefined:doctorHolidays.length}]} />
        {holidayError && <Alert variant="error" title="Leave could not be loaded" action={<Button variant="outline" size="sm" onClick={() => selectedDoctorForHolidays && readHolidays(selectedDoctorForHolidays.id)}>Try again</Button>}>Retry before changing this doctor's availability.</Alert>}
        <form id="doctor-leave" hidden={holidayTab !== "form"} onSubmit={handleAddHoliday} className={styles.formSection}>
          <p className={styles.help}>Bookings are blocked on this date for the selected location. Review existing appointments separately.</p>
          <Select label="Location" value={newHoliday.locationId} onChange={event => setNewHoliday({...newHoliday,locationId:event.target.value})} options={[{value:"all",label:"All locations"},...locations.map(location=>({value:location.id,label:location.name}))]} />
          <DatePicker label="Leave date *"  minDate={new Date().toISOString().slice(0,10)} value={newHoliday.date} onChange={value=>setNewHoliday({...newHoliday,date:value})} required />
          <Input label="Reason *" value={newHoliday.reason} onChange={event=>setNewHoliday({...newHoliday,reason:event.target.value})} required />
        </form>
        <section hidden={holidayTab !== "list"} className={styles.assignmentList} aria-label="Scheduled leave">
          {loadingHolidays ? <div role="status" className={styles.empty}><Spinner size="sm" />Loading leave...</div> : holidayError ? null : doctorHolidays.length === 0 ? <p className={styles.empty}>No scheduled leave. The regular schedule applies.</p> : doctorHolidays.map(holiday=><article key={holiday.id||holiday._id} className={styles.assignmentCard}><div><strong>{holiday.date}</strong><p>{holiday.reason}</p><p>{holiday.locationId?.name || "All locations"}</p></div><Button size="sm" variant="outline" loading={removingHolidayId === (holiday.id || holiday._id)} disabled={Boolean(removingHolidayId && removingHolidayId !== (holiday.id||holiday._id))} onClick={()=>handleDeleteHoliday(holiday.id||holiday._id)}>Cancel leave</Button></article>)}
        </section>
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
        loading={deactivating}
      />
    </div>
  );
}
