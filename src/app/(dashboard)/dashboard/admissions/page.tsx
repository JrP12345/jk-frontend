"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, Select, Textarea, useToast, Spinner, Badge, StatCard
} from "@/components/ui";

interface PatientUser {
  name: string;
  email: string;
  phone: string;
}

interface PatientProfile {
  id: string;
  userId: PatientUser;
}

interface DoctorUser {
  id: string;
  name: string;
  specialization?: string;
}

interface BedType {
  id: string;
  clinicId: string;
  wardName: string;
  bedNumber: string;
  status: "available" | "occupied" | "maintenance" | "reserved";
  pricePerDay: number;
  occupiedBy?: {
    id: string;
    userId: { name: string; phone: string };
  } | null;
}

interface AdmissionType {
  id: string;
  clinicId: string;
  patientId: PatientProfile;
  bedId: {
    id: string;
    bedNumber: string;
    wardName: string;
    pricePerDay: number;
  };
  admissionDate: string;
  dischargeDate?: string | null;
  reasonForAdmission: string;
  doctorInCharge: DoctorUser;
  status: "admitted" | "discharged";
  notes?: string;
}

export default function AdmissionsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"occupancy" | "admissions" | "beds">("occupancy");
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [beds, setBeds] = useState<BedType[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionType[]>([]);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Admit Patient Modal State
  const [isAdmitOpen, setIsAdmitOpen] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [reasonForAdmission, setReasonForAdmission] = useState("");
  const [notes, setNotes] = useState("");
  const [submittingAdmit, setSubmittingAdmit] = useState(false);
  const [intakeErrors, setIntakeErrors] = useState<Record<string, string>>({});

  // Manage Beds Form State
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [wardName, setWardName] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [pricePerDay, setPricePerDay] = useState(0);
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [submittingBed, setSubmittingBed] = useState(false);
  const [bedErrors, setBedErrors] = useState<Record<string, string>>({});

  // Discharge Modal State
  const [isDischargeOpen, setIsDischargeOpen] = useState(false);
  const [activeAdmission, setActiveAdmission] = useState<AdmissionType | null>(null);
  const [submittingDischarge, setSubmittingDischarge] = useState(false);

  const validateBedField = (field: string, value: any) => {
    let error = "";
    if (field === "wardName" && !String(value).trim()) {
      error = "Ward / Suite Name is required";
    } else if (field === "bedNumber" && !String(value).trim()) {
      error = "Bed Identifier is required";
    } else if (field === "pricePerDay" && (isNaN(Number(value)) || Number(value) <= 0)) {
      error = "Price must be a positive number";
    }

    setBedErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateBedForm = () => {
    const newErrors: Record<string, string> = {};
    if (!wardName.trim()) newErrors.wardName = "Ward / Suite Name is required";
    if (!bedNumber.trim()) newErrors.bedNumber = "Bed Identifier is required";
    if (pricePerDay <= 0) newErrors.pricePerDay = "Price must be a positive number";

    setBedErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateIntakeField = (field: string, value: any) => {
    let error = "";
    if (field === "patient" && !value) {
      error = "Please search and select a patient profile";
    } else if (field === "bed" && !value) {
      error = "Assign Bed Location is required";
    } else if (field === "doctor" && !value) {
      error = "Attending Doctor is required";
    } else if (field === "reason" && !String(value).trim()) {
      error = "Reason for Admission is required";
    }

    setIntakeErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateIntakeForm = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedPatient) newErrors.patient = "Please search and select a patient profile";
    if (!selectedBedId) newErrors.bed = "Assign Bed Location is required";
    if (!selectedDoctorId) newErrors.doctor = "Attending Doctor is required";
    if (!reasonForAdmission.trim()) newErrors.reason = "Reason for Admission is required";

    setIntakeErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Fetch Clinics & Doctors
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [clinicsRes, staffRes] = await Promise.all([
          api.get("/onboarding/clinics"),
          api.get("/onboarding/staff")
        ]);
        const clinicsList = clinicsRes.data.data || [];
        setClinics(clinicsList);
        if (clinicsList.length > 0) {
          setSelectedClinicId(clinicsList[0].id);
        }
        setDoctors(staffRes.data.data.doctors || []);
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load clinics or doctors list",
          variant: "error"
        });
      }
    };
    if (user) fetchMetadata();
  }, [user]);

  // Fetch Beds and Admissions when Clinic changes or on tab change
  const fetchData = async () => {
    if (!selectedClinicId) return;
    try {
      setLoading(true);
      const [bedsRes, admissionsRes] = await Promise.all([
        api.get(`/beds?clinicId=${selectedClinicId}`),
        api.get(`/admissions?clinicId=${selectedClinicId}`)
      ]);
      setBeds(bedsRes.data.data || []);
      setAdmissions(admissionsRes.data.data || []);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to fetch bed and admission logs",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Patient Lookup
  const handlePatientSearch = async (val: string) => {
    setPatientSearch(val);
    if (val.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const res = await api.get(`/patients?search=${val}`);
      setPatientResults(res.data.data || []);
    } catch (err) {
      console.error("Patient search error:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.userId.name);
    setPatientResults([]);
    validateIntakeField("patient", patient);
  };

  // Admit Submit Handler
  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIntakeForm()) {
      toast({
        title: "Validation Error",
        description: "Please correct the admission form errors.",
        variant: "warning"
      });
      return;
    }

    try {
      setSubmittingAdmit(true);
      await api.post("/admissions", {
        clinicId: selectedClinicId,
        patientId: selectedPatient.id,
        bedId: selectedBedId,
        reasonForAdmission,
        doctorInCharge: selectedDoctorId,
        notes
      });

      toast({
        title: "Success",
        description: "Patient admitted successfully",
        variant: "success"
      });

      setIsAdmitOpen(false);
      // Reset Form
      setSelectedPatient(null);
      setPatientSearch("");
      setSelectedBedId("");
      setSelectedDoctorId("");
      setReasonForAdmission("");
      setNotes("");
      setIntakeErrors({});

      fetchData();
    } catch (err: any) {
      toast({
        title: "Admission Failed",
        description: err.response?.data?.message || "Internal server error",
        variant: "error"
      });
    } finally {
      setSubmittingAdmit(false);
    }
  };

  // Add/Edit Bed Submit Handler
  const handleBedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBedForm()) {
      toast({
        title: "Validation Error",
        description: "Please correct the bed setup form errors.",
        variant: "warning"
      });
      return;
    }

    try {
      setSubmittingBed(true);
      if (editingBedId) {
        await api.put(`/beds/${editingBedId}`, {
          wardName,
          bedNumber,
          pricePerDay
        });
        toast({ title: "Success", description: "Bed updated successfully", variant: "success" });
      } else {
        await api.post("/beds", {
          clinicId: selectedClinicId,
          wardName,
          bedNumber,
          pricePerDay
        });
        toast({ title: "Success", description: "Bed registered successfully", variant: "success" });
      }

      setIsBedModalOpen(false);
      setEditingBedId(null);
      setWardName("");
      setBedNumber("");
      setPricePerDay(0);
      setBedErrors({});
      fetchData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Internal server error",
        variant: "error"
      });
    } finally {
      setSubmittingBed(false);
    }
  };

  // Delete Bed
  const handleDeleteBed = async (bedId: string) => {
    if (!confirm("Are you sure you want to remove this bed?")) return;
    try {
      await api.delete(`/beds/${bedId}`);
      toast({ title: "Success", description: "Bed deleted successfully", variant: "success" });
      fetchData();
    } catch (err: any) {
      toast({
        title: "Deletion Failed",
        description: err.response?.data?.message || "Inpatient bed is occupied",
        variant: "error"
      });
    }
  };

  // Discharge Submit Handler
  const handleDischargeSubmit = async () => {
    if (!activeAdmission) return;
    try {
      setSubmittingDischarge(true);
      await api.put(`/admissions/${activeAdmission.id}/discharge`);
      toast({
        title: "Patient Discharged",
        description: "Admission closed and bed invoice generated.",
        variant: "success"
      });
      setIsDischargeOpen(false);
      setActiveAdmission(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to discharge patient",
        variant: "error"
      });
    } finally {
      setSubmittingDischarge(false);
    }
  };

  // Helper: Group beds by ward
  const bedsByWard = beds.reduce((acc: Record<string, BedType[]>, bed) => {
    if (!acc[bed.wardName]) acc[bed.wardName] = [];
    acc[bed.wardName].push(bed);
    return acc;
  }, {});

  // Stats Calculations
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.status === "occupied").length;
  const availableBeds = beds.filter(b => b.status === "available").length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Active admissions list
  const activeAdmissions = admissions.filter(a => a.status === "admitted");

  return (
    <div className="space-y-6">
      {/* Top Header & Clinic Select (compact header, no gradient banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text">In-Patient Operations (IPD)</h2>
          <p className="text-text-secondary text-sm">Manage ward admissions, track bed availability, and coordinate discharge billing.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Select
            size="sm"
            value={selectedClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
            options={clinics.map(c => ({ value: c.id, label: `${c.name} (${c.city})` }))}
            className="w-64"
          />
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Bed Capacity"
          value={totalBeds}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" /></svg>}
        />
        <StatCard
          label="Beds Occupied"
          value={occupiedBeds}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-red-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
        />
        <StatCard
          label="Available Beds"
          value={availableBeds}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-green-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
        />
        <StatCard
          label="Ward Occupancy Rate"
          value={`${occupancyRate}%`}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
        />
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab("occupancy")}
          className={`pb-3 text-sm font-semibold transition-colors ${activeTab === "occupancy" ? "border-b-2 border-primary-600 text-primary-600" : "text-text-muted hover:text-text"}`}
        >
          Ward Occupancy Map
        </button>
        <button
          onClick={() => setActiveTab("admissions")}
          className={`pb-3 text-sm font-semibold transition-colors ${activeTab === "admissions" ? "border-b-2 border-primary-600 text-primary-600" : "text-text-muted hover:text-text"}`}
        >
          Active Admissions ({activeAdmissions.length})
        </button>
        <button
          onClick={() => setActiveTab("beds")}
          className={`pb-3 text-sm font-semibold transition-colors ${activeTab === "beds" ? "border-b-2 border-primary-600 text-primary-600" : "text-text-muted hover:text-text"}`}
        >
          Beds Setup
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <Spinner size="lg" label="Loading ward data..." />
        </div>
      ) : (
        <>
          {/* TAB 1: OCCUPANCY MAP */}
          {activeTab === "occupancy" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-text">Real-Time Ward Overview</h3>
                 <Button onClick={() => { setSelectedBedId(""); setIntakeErrors({}); setIsAdmitOpen(true); }}>
                  + Admit Patient
                </Button>
              </div>

              {Object.keys(bedsByWard).length === 0 ? (
                <Card className="p-8 text-center text-text-muted">
                  No beds have been configured for this clinic location. Go to the "Beds Setup" tab to register wards and beds.
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(bedsByWard).map(([wardName, wardBeds]) => (
                    <Card key={wardName} className="overflow-hidden">
                      <CardHeader className="bg-surface-hover/50 border-b border-border py-4 px-5">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base font-bold text-text">{wardName}</CardTitle>
                          <Badge variant="default" className="text-xs">
                            {wardBeds.filter(b => b.status === "occupied").length} / {wardBeds.length} Occupied
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-5">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {wardBeds.map(bed => {
                            let bgClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400";
                            if (bed.status === "occupied") bgClass = "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400";
                            if (bed.status === "maintenance") bgClass = "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400";
                            if (bed.status === "reserved") bgClass = "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400";

                            return (
                              <div
                                key={bed.id}
                                onClick={() => {
                                  if (bed.status === "available") {
                                    setSelectedBedId(bed.id);
                                    setIntakeErrors({});
                                    setIsAdmitOpen(true);
                                  }
                                }}
                                className={`border rounded-xl p-3 flex flex-col items-center justify-between text-center transition-all duration-300 ease-spring ${bed.status === "available" ? "cursor-pointer hover:scale-[1.03] hover:shadow-md hover:border-emerald-500/50" : ""} ${bgClass}`}
                              >
                                <span className="text-xs font-bold uppercase tracking-wider">{bed.bedNumber}</span>
                                <div className="h-6 mt-1 flex items-center justify-center">
                                  {bed.status === "occupied" ? (
                                    <span className="text-[10px] font-semibold truncate max-w-[70px]">
                                      {bed.occupiedBy?.userId?.name || "Occupied"}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] uppercase font-bold tracking-tight opacity-75">{bed.status}</span>
                                  )}
                                </div>
                                <span className="text-[10px] font-semibold opacity-80 mt-2">₹{bed.pricePerDay}/day</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE ADMISSIONS */}
          {activeTab === "admissions" && (
            <Card>
              <CardHeader className="py-4 px-5 border-b border-border flex justify-between items-center">
                <CardTitle className="text-lg font-bold text-text">Currently Admitted In-Patients</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table
                  columns={[
                    { header: "Patient Name", key: "patientName" },
                    { header: "Ward/Bed", key: "bedNumber" },
                    { header: "Admit Date", key: "admitDate" },
                    { header: "Days Spent", key: "days" },
                    { header: "Doctor in Charge", key: "doctor" },
                    { header: "Admission Reason", key: "reason" },
                    { header: "Action", key: "action" }
                  ]}
                  data={activeAdmissions.map(adm => {
                    const days = Math.max(1, Math.ceil((new Date().getTime() - new Date(adm.admissionDate).getTime()) / (1000 * 60 * 60 * 24)));
                    return {
                      id: adm.id,
                      patientName: (
                        <div>
                          <div className="font-semibold text-text">{adm.patientId.userId.name}</div>
                          <div className="text-xs text-text-muted">{adm.patientId.userId.phone}</div>
                        </div>
                      ),
                      bedNumber: (
                        <div className="font-medium text-text">
                          {adm.bedId?.wardName} - <span className="text-primary-600 font-bold">{adm.bedId?.bedNumber}</span>
                        </div>
                      ),
                      admitDate: new Date(adm.admissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
                      days: <Badge variant="default">{days} {days === 1 ? "day" : "days"}</Badge>,
                      doctor: (
                        <div>
                          <div className="font-semibold text-text">{adm.doctorInCharge.name}</div>
                          <div className="text-[10px] text-text-muted">{adm.doctorInCharge.specialization || "Attending Physician"}</div>
                        </div>
                      ),
                      reason: <span className="text-sm text-text truncate max-w-xs block">{adm.reasonForAdmission}</span>,
                      action: (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setActiveAdmission(adm);
                            setIsDischargeOpen(true);
                          }}
                        >
                          Discharge & Invoice
                        </Button>
                      )
                    };
                  })}
                  emptyMessage="No patients are currently admitted in this clinic location."
                />
              </CardContent>
            </Card>
          )}

          {/* TAB 3: BEDS SETUP */}
          {activeTab === "beds" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-text">Ward Beds Inventory</h3>
                <Button onClick={() => { setEditingBedId(null); setWardName(""); setBedNumber(""); setPricePerDay(0); setBedErrors({}); setIsBedModalOpen(true); }}>
                  + Add New Bed
                </Button>
              </div>

              <Card className="overflow-hidden">
                <Table
                  columns={[
                    { header: "Ward Name", key: "ward" },
                    { header: "Bed Number", key: "bedNum" },
                    { header: "Price Per Day", key: "price" },
                    { header: "Current Status", key: "status" },
                    { header: "Occupant", key: "occupant" },
                    { header: "Actions", key: "actions" }
                  ]}
                  data={beds.map(bed => ({
                    id: bed.id,
                    ward: <span className="font-bold text-text">{bed.wardName}</span>,
                    bedNum: <Badge variant="default" className="font-semibold">{bed.bedNumber}</Badge>,
                    price: <span className="text-text font-medium">₹{bed.pricePerDay}</span>,
                    status: (
                      <Badge variant={
                        bed.status === "available" ? "success" :
                        bed.status === "occupied" ? "danger" : "warning"
                      }>
                        {bed.status}
                      </Badge>
                    ),
                    occupant: bed.occupiedBy ? (
                      <span className="text-sm font-medium text-text">{bed.occupiedBy.userId.name}</span>
                    ) : (
                      <span className="text-xs text-text-muted">None</span>
                    ),
                    actions: (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingBedId(bed.id);
                            setWardName(bed.wardName);
                            setBedNumber(bed.bedNumber);
                            setPricePerDay(bed.pricePerDay);
                            setBedErrors({});
                            setIsBedModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteBed(bed.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )
                  }))}
                  emptyMessage="No beds configured yet. Create a bed to get started."
                />
              </Card>
            </div>
          )}
        </>
      )}

      {/* ADMIT PATIENT MODAL */}
      <Modal
        open={isAdmitOpen}
        onClose={() => setIsAdmitOpen(false)}
        title="Inpatient Admission Intake"
      >
        <form onSubmit={handleAdmitSubmit} className="space-y-4">
          {/* Patient Search */}
          <div className="relative">
            <label className="text-xs font-semibold text-text mb-1 block">Search Patient Profile *</label>
            <Input
              value={patientSearch}
              onChange={(e) => {
                handlePatientSearch(e.target.value);
                if (!e.target.value) {
                  setSelectedPatient(null);
                  validateIntakeField("patient", null);
                }
              }}
              placeholder="Type patient name or phone..."
              required
              error={intakeErrors.patient}
            />
            {searchLoading && (
              <div className="absolute right-3 top-8">
                <Spinner size="sm" />
              </div>
            )}
            {patientResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                {patientResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left p-3 hover:bg-surface-hover border-b border-border/50 flex flex-col"
                  >
                    <span className="text-sm font-semibold text-text">{p.userId.name}</span>
                    <span className="text-xs text-text-muted">DOB: {p.dob ? new Date(p.dob).toLocaleDateString() : "N/A"} | Phone: {p.userId.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <div className="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-green-700 dark:text-green-400">{selectedPatient.userId.name}</div>
                  <div className="text-xs text-text-muted">Allergies: {selectedPatient.allergies?.join(", ") || "None"}</div>
                </div>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => { setSelectedPatient(null); validateIntakeField("patient", null); }}>Change</Button>
              </div>
            )}
            {intakeErrors.patient && (
              <p className="text-red-500 text-xs mt-0.5">{intakeErrors.patient}</p>
            )}
          </div>

          {/* Select Bed */}
          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Assign Bed Location *</label>
            <Select
              value={selectedBedId}
              onChange={(e) => {
                setSelectedBedId(e.target.value);
                validateIntakeField("bed", e.target.value);
              }}
              placeholder="-- Choose Available Bed --"
              options={beds
                .filter(b => b.status === "available" || b.id === selectedBedId)
                .map(b => ({ value: b.id, label: `${b.wardName} - Bed ${b.bedNumber} (₹${b.pricePerDay}/day)` }))
              }
              required
              error={intakeErrors.bed}
            />
            {intakeErrors.bed && (
              <p className="text-red-500 text-xs mt-0.5">{intakeErrors.bed}</p>
            )}
          </div>

          {/* Select Doctor in Charge */}
          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Attending Doctor *</label>
            <Select
              value={selectedDoctorId}
              onChange={(e) => {
                setSelectedDoctorId(e.target.value);
                validateIntakeField("doctor", e.target.value);
              }}
              placeholder="-- Choose Attending Doctor --"
              options={doctors.map(doc => ({ value: doc.id, label: `${doc.name} (${doc.specialization || "General Medicine"})` }))}
              required
              error={intakeErrors.doctor}
            />
            {intakeErrors.doctor && (
              <p className="text-red-500 text-xs mt-0.5">{intakeErrors.doctor}</p>
            )}
          </div>

          {/* Reason for Admission */}
          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Reason for Admission *</label>
            <Input
              value={reasonForAdmission}
              onChange={(e) => {
                setReasonForAdmission(e.target.value);
                validateIntakeField("reason", e.target.value);
              }}
              onBlur={(e) => validateIntakeField("reason", e.target.value)}
              placeholder="e.g. Acute Pneumonia with oxygen support needed"
              required
              error={intakeErrors.reason}
            />
            {intakeErrors.reason && (
              <p className="text-red-500 text-xs mt-0.5">{intakeErrors.reason}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Clinical Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter dietary constraints, monitoring logs, or warnings..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsAdmitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingAdmit}>
              {submittingAdmit ? "Admitting..." : "Confirm Admission Intake"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MANAGE BEDS MODAL */}
      <Modal
        open={isBedModalOpen}
        onClose={() => setIsBedModalOpen(false)}
        title={editingBedId ? "Modify Inpatient Bed" : "Register Bed Capacity"}
      >
        <form onSubmit={handleBedSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Ward / Suite Name *</label>
            <Input
              value={wardName}
              onChange={(e) => {
                setWardName(e.target.value);
                validateBedField("wardName", e.target.value);
              }}
              onBlur={(e) => validateBedField("wardName", e.target.value)}
              placeholder="e.g. General Ward A, ICU, Semi-Private 201"
              required
              error={bedErrors.wardName}
            />
            {bedErrors.wardName && <p className="text-red-500 text-xs mt-0.5">{bedErrors.wardName}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Bed Identifier / Number *</label>
            <Input
              value={bedNumber}
              onChange={(e) => {
                setBedNumber(e.target.value);
                validateBedField("bedNumber", e.target.value);
              }}
              onBlur={(e) => validateBedField("bedNumber", e.target.value)}
              placeholder="e.g. G-A12, Bed-3"
              required
              error={bedErrors.bedNumber}
            />
            {bedErrors.bedNumber && <p className="text-red-500 text-xs mt-0.5">{bedErrors.bedNumber}</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Rate Per Day (₹ INR) *</label>
            <Input
              type="number"
              value={pricePerDay === 0 ? "" : pricePerDay}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPricePerDay(val);
                validateBedField("pricePerDay", val);
              }}
              onBlur={(e) => validateBedField("pricePerDay", Number(e.target.value))}
              placeholder="e.g. 150"
              required
              error={bedErrors.pricePerDay}
            />
            {bedErrors.pricePerDay && <p className="text-red-500 text-xs mt-0.5">{bedErrors.pricePerDay}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsBedModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingBed}>
              {submittingBed ? "Saving..." : "Save Bed Configuration"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DISCHARGE SUMMARY MODAL */}
      <Modal
        open={isDischargeOpen}
        onClose={() => setIsDischargeOpen(false)}
        title="In-Patient Discharge Processing"
      >
        {activeAdmission && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-hover rounded-xl border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Patient:</span>
                <span className="text-sm font-bold text-text">{activeAdmission.patientId.userId.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Ward/Bed:</span>
                <span className="text-sm font-semibold text-text">{activeAdmission.bedId?.wardName} - Bed {activeAdmission.bedId?.bedNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Attending Doctor:</span>
                <span className="text-sm font-semibold text-text">{activeAdmission.doctorInCharge.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Admit Date:</span>
                <span className="text-sm text-text">{new Date(activeAdmission.admissionDate).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-bold text-text mb-2">Checkout Invoice Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Stay Duration:</span>
                  <span className="font-semibold">
                    {Math.max(1, Math.ceil((new Date().getTime() - new Date(activeAdmission.admissionDate).getTime()) / (1000 * 60 * 60 * 24)))} Days
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Price Per Day:</span>
                  <span className="font-semibold">${activeAdmission.bedId?.pricePerDay}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-primary-600">
                  <span>Calculated Bed Subtotal:</span>
                  <span>
                    ${Math.max(1, Math.ceil((new Date().getTime() - new Date(activeAdmission.admissionDate).getTime()) / (1000 * 60 * 60 * 24))) * activeAdmission.bedId?.pricePerDay}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsDischargeOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={submittingDischarge} onClick={handleDischargeSubmit}>
                {submittingDischarge ? "Processing..." : "Discharge & Generate Invoice"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
