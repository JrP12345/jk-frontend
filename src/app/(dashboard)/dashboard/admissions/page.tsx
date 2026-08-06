"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  Button,
  Modal,
  Input,
  Select,
  Textarea,
  useToast,
  Spinner,
  Badge,
  StatCard,
  SkeletonTable,
  ConfirmDialog,
} from "@/components/ui";
import { BedOccupancyMap } from "@/components/clinical/BedOccupancyMap";

interface PatientUser {
  name: string;
  email?: string;
  phone?: string;
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
  const { user, activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"map" | "admissions" | "beds">("map");
  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const [beds, setBeds] = useState<BedType[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionType[]>([]);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bedsRes, admRes, docRes] = await Promise.all([
        api.get(selectedClinicId ? `/beds?clinicId=${selectedClinicId}` : "/beds"),
        api.get(selectedClinicId ? `/admissions?clinicId=${selectedClinicId}` : "/admissions"),
        api.get(selectedClinicId ? `/onboarding/staff?clinicId=${selectedClinicId}` : "/onboarding/staff"),
      ]);

      setBeds(bedsRes.data?.data || []);
      setAdmissions(admRes.data?.data || []);
      setDoctors(docRes.data?.data?.doctors || []);
    } catch (err: any) {
      toast({
        title: "Error Loading Admissions Data",
        description: err.response?.data?.message || "Could not fetch IPD admissions data",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

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

  // Manage Beds Form State
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [wardName, setWardName] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [pricePerDay, setPricePerDay] = useState(0);
  const [editingBedId, setEditingBedId] = useState<string | null>(null);
  const [submittingBed, setSubmittingBed] = useState(false);

  // Discharge Modal State
  const [isDischargeOpen, setIsDischargeOpen] = useState(false);
  const [activeAdmission, setActiveAdmission] = useState<AdmissionType | null>(null);
  const [submittingDischarge, setSubmittingDischarge] = useState(false);

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
  };

  // Admit Submit Handler
  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !selectedBedId || !selectedDoctorId || !reasonForAdmission.trim()) {
      toast({
        title: "Validation Error",
        description: "Patient, bed location, attending doctor, and admission reason are required.",
        variant: "warning",
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
        notes,
      });

      toast({
        title: "Patient Admitted to Ward ✓",
        description: `Admitted ${selectedPatient.userId?.name} to bed.`,
        variant: "success",
      });

      setIsAdmitOpen(false);
      setSelectedPatient(null);
      setPatientSearch("");
      setSelectedBedId("");
      setSelectedDoctorId("");
      setReasonForAdmission("");
      setNotes("");

      fetchData();
    } catch (err: any) {
      toast({
        title: "Admission Failed",
        description: err.response?.data?.message || "Internal server error",
        variant: "error",
      });
    } finally {
      setSubmittingAdmit(false);
    }
  };

  // Add/Edit Bed Submit Handler
  const handleBedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardName.trim() || !bedNumber.trim() || pricePerDay <= 0) {
      toast({
        title: "Validation Error",
        description: "Ward name, bed number, and positive daily rate are required.",
        variant: "warning",
      });
      return;
    }

    try {
      setSubmittingBed(true);
      if (editingBedId) {
        await api.put(`/beds/${editingBedId}`, { wardName, bedNumber, pricePerDay });
        toast({ title: "Bed Updated ✓", description: "Bed configuration saved.", variant: "success" });
      } else {
        await api.post("/beds", { clinicId: selectedClinicId, wardName, bedNumber, pricePerDay });
        toast({ title: "Bed Registered ✓", description: "New bed added to ward inventory.", variant: "success" });
      }

      setIsBedModalOpen(false);
      setEditingBedId(null);
      setWardName("");
      setBedNumber("");
      setPricePerDay(0);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Bed Operation Failed",
        description: err.response?.data?.message || "Internal server error",
        variant: "error",
      });
    } finally {
      setSubmittingBed(false);
    }
  };

  // Delete Bed Handler
  const [deletingBedId, setDeletingBedId] = useState<string | null>(null);

  const handleDeleteBed = async () => {
    if (!deletingBedId) return;
    try {
      await api.delete(`/beds/${deletingBedId}`);
      toast({ title: "Bed Deleted", description: "Bed record removed from ward inventory.", variant: "warning" });
      setDeletingBedId(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Deletion Failed",
        description: err.response?.data?.message || "Inpatient bed is occupied",
        variant: "error",
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
        title: "Patient Discharged 🏥",
        description: "Admission closed, bed freed, and daily stay invoice generated.",
        variant: "success",
      });
      setIsDischargeOpen(false);
      setActiveAdmission(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Discharge Failed",
        description: err.response?.data?.message || "Failed to discharge patient",
        variant: "error",
      });
    } finally {
      setSubmittingDischarge(false);
    }
  };

  // Stats Calculations
  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.status === "occupied").length;
  const availableBeds = beds.filter((b) => b.status === "available").length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Active admissions list
  const activeAdmissions = admissions.filter((a) => a.status === "admitted");

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span className="text-blue-500">🏥</span> In-Patient Operations (IPD) & Bed Management
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage ward admissions, track live bed availability, transfer patient rooms, and coordinate discharge billing.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedBedId("");
              setIsAdmitOpen(true);
            }}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <span>+ Admit Patient</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5 text-xs"
          >
            <span>Refresh Ward</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
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
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
        />
        <StatCard
          label="Ward Occupancy Rate"
          value={`${occupancyRate}%`}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
        />
      </div>

      {/* Main Workspace Navigation Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt rounded-2xl border border-border/80 text-xs font-bold w-full md:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("map")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "map" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🗺️ Visual Ward Floorplan Map
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("admissions")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "admissions" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          📋 Active Inpatient Admissions Log ({activeAdmissions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("beds")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "beds" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🛏️ Hospital Beds Setup & Inventory ({totalBeds})
        </button>
      </div>

      {/* TAB 1: VISUAL WARD FLOORPLAN MAP */}
      {activeTab === "map" && (
        <BedOccupancyMap
          beds={beds}
          admissions={admissions}
          clinicId={selectedClinicId}
          onRefresh={fetchData}
          onQuickAdmit={(bedId) => {
            setSelectedBedId(bedId);
            setIsAdmitOpen(true);
          }}
        />
      )}

      {/* TAB 2: ACTIVE ADMISSIONS LOG & DISCHARGE DESK */}
      {activeTab === "admissions" && (
        <Card className="shadow-xs border border-border rounded-2xl bg-surface">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-base font-bold text-text">
              Active Inpatient Admissions Directory
            </CardTitle>
            <p className="text-xs text-text-muted">
              Current admitted hospital patients, attending doctors, room locations, and discharge billing actions.
            </p>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={4} cols={5} />
              </div>
            ) : activeAdmissions.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <div className="text-3xl">🏥</div>
                <p className="text-xs font-semibold">No active inpatient admissions in clinic wards.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activeAdmissions.map((adm) => (
                  <div key={adm.id} className="p-4 hover:bg-surface-alt/50 transition-colors space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-600 font-black flex items-center justify-center text-xs border border-blue-500/20">
                          IPD
                        </div>
                        <div>
                          <div className="font-bold text-text text-sm flex items-center gap-2">
                            {adm.patientId?.userId?.name || "Patient"}
                            <Badge variant="success" className="text-[10px]">
                              ADMITTED
                            </Badge>
                            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                              {adm.bedId ? `${adm.bedId.wardName} - ${adm.bedId.bedNumber}` : "Ward Bed"}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Reason: <strong className="text-text font-semibold">{adm.reasonForAdmission}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setActiveAdmission(adm);
                            setIsDischargeOpen(true);
                          }}
                          className="font-bold text-[11px] rounded-lg bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                        >
                          🏥 Discharge Patient
                        </Button>
                      </div>
                    </div>

                    <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                      <div><span className="text-text-muted">Doctor in Charge:</span> <strong className="text-text">{adm.doctorInCharge?.name || "Attending MD"}</strong></div>
                      <div><span className="text-text-muted">Admission Date:</span> <strong className="text-text">{adm.admissionDate ? new Date(adm.admissionDate).toLocaleDateString() : "Today"}</strong></div>
                      <div><span className="text-text-muted">Daily Rate:</span> <strong className="text-emerald-600 font-mono">${adm.bedId?.pricePerDay || 150}/day</strong></div>
                      <div><span className="text-text-muted">Stay Duration:</span> <strong className="text-text font-mono">Active Episode</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: HOSPITAL BEDS SETUP & INVENTORY */}
      {activeTab === "beds" && (
        <Card className="shadow-xs border border-border rounded-2xl bg-surface">
          <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-text">
                Hospital Ward Beds Setup & Daily Pricing Inventory
              </CardTitle>
              <p className="text-xs text-text-muted">
                Configure hospital wards, bed numbers, and daily per-diem rates.
              </p>
            </div>

            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setEditingBedId(null);
                setWardName("General Ward");
                setBedNumber(`BED-${Math.floor(100 + Math.random() * 900)}`);
                setPricePerDay(150);
                setIsBedModalOpen(true);
              }}
              className="font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              + Register New Bed
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={4} cols={5} />
              </div>
            ) : beds.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <div className="text-3xl">🛏️</div>
                <p className="text-xs font-semibold">No hospital beds configured in clinic inventory.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {beds.map((b) => (
                  <div key={b.id} className="p-4 hover:bg-surface-alt/50 transition-colors space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-text text-sm">
                          {b.wardName} — Bed {b.bedNumber}
                        </div>
                        <Badge
                          variant={b.status === "occupied" ? "danger" : b.status === "available" ? "success" : "warning"}
                          className="font-mono text-[10px]"
                        >
                          {b.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-600 text-xs">${b.pricePerDay}/day</span>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setEditingBedId(b.id);
                            setWardName(b.wardName);
                            setBedNumber(b.bedNumber);
                            setPricePerDay(b.pricePerDay);
                            setIsBedModalOpen(true);
                          }}
                          className="text-xs font-semibold rounded-lg"
                        >
                          Edit
                        </Button>
                        {b.status !== "occupied" && (
                          <Button
                            size="xs"
                            variant="danger"
                            onClick={() => setDeletingBedId(b.id)}
                            className="text-xs font-bold rounded-lg px-2.5 cursor-pointer"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ADMIT PATIENT MODAL */}
      <Modal isOpen={isAdmitOpen} onClose={() => setIsAdmitOpen(false)} title="🏥 Admit Patient to Hospital Ward" size="lg">
        <form onSubmit={handleAdmitSubmit} className="space-y-4 text-xs">
          {/* Patient Lookup Input */}
          <div className="relative">
            <label className="block text-xs font-bold text-text mb-1">Search Patient Profile *</label>
            <Input
              placeholder="Type patient name to search database..."
              value={patientSearch}
              onChange={(e) => handlePatientSearch(e.target.value)}
              className="text-xs"
              required
            />
            {patientResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-border">
                {patientResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className="p-2.5 hover:bg-surface-alt cursor-pointer text-xs flex justify-between items-center"
                  >
                    <span className="font-bold text-text">{p.userId?.name}</span>
                    <span className="text-text-muted text-[11px]">{p.userId?.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Select Available Ward Bed *"
              value={selectedBedId}
              onChange={(e) => setSelectedBedId(e.target.value)}
              options={[
                { value: "", label: "Select available bed..." },
                ...beds
                  .filter((b) => b.status === "available")
                  .map((b) => ({
                    value: b.id,
                    label: `${b.wardName} - Bed ${b.bedNumber} ($${b.pricePerDay}/day)`,
                  })),
              ]}
              required
            />

            <Select
              label="Attending Doctor in Charge *"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              options={[
                { value: "", label: "Select doctor..." },
                ...doctors.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.specialization || "General Medicine"})`,
                })),
              ]}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Reason for Inpatient Admission *</label>
            <Input
              required
              placeholder="e.g. Acute exacerbation of COPD, post-operative monitoring..."
              value={reasonForAdmission}
              onChange={(e) => setReasonForAdmission(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Clinical Notes & Orders</label>
            <Textarea
              placeholder="Inpatient diet orders, IV medication schedule..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAdmitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingAdmit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Confirm Inpatient Admission
            </Button>
          </div>
        </form>
      </Modal>

      {/* DISCHARGE CONFIRMATION MODAL */}
      <Modal isOpen={isDischargeOpen} onClose={() => setIsDischargeOpen(false)} title="🏥 Patient Discharge & Invoice Generation" size="md">
        {activeAdmission && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-950 dark:text-emerald-200 text-[11px]">
              Discharging <strong>{activeAdmission.patientId?.userId?.name}</strong> will close the active IPD episode, release <strong>{activeAdmission.bedId?.wardName} Bed {activeAdmission.bedId?.bedNumber}</strong> back to available inventory, and generate the final billing invoice.
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsDischargeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDischargeSubmit} size="sm" loading={submittingDischarge} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Confirm Discharge
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* REGISTER / EDIT BED MODAL */}
      <Modal isOpen={isBedModalOpen} onClose={() => setIsBedModalOpen(false)} title={editingBedId ? "Edit Hospital Bed Setup" : "Register New Ward Bed"} size="md">
        <form onSubmit={handleBedSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-xs font-bold text-text mb-1">Ward / Suite Name *</label>
            <Input
              required
              placeholder="e.g. ICU Ward, General Ward 3B, VIP Suite"
              value={wardName}
              onChange={(e) => setWardName(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text mb-1">Bed Number / Code *</label>
              <Input
                required
                placeholder="e.g. BED-101"
                value={bedNumber}
                onChange={(e) => setBedNumber(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">Daily Per-Diem Rate ($) *</label>
              <Input
                type="number"
                required
                value={pricePerDay}
                onChange={(e) => setPricePerDay(Number(e.target.value))}
                className="text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsBedModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingBed} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Save Bed Configuration
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM BED DELETE */}
      {deletingBedId && (
        <ConfirmDialog
          isOpen={!!deletingBedId}
          onClose={() => setDeletingBedId(null)}
          onConfirm={handleDeleteBed}
          title="Delete Ward Bed"
          description="Are you sure you want to delete this bed record from ward inventory?"
        />
      )}
    </div>
  );
}
