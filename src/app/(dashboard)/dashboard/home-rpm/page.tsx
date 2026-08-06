"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatCard,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  useToast,
  Spinner,
  SkeletonTable,
} from "@/components/ui";

export interface HomeRPMRecord {
  id: string;
  patientId: string;
  patientName: string;
  address: string;
  assignedNurse: string;
  carePlanType: "hypertension_management" | "diabetes_rpm" | "post_op_wound_care" | "copd_oxygen_monitoring" | "heart_failure_vitals";
  deviceSerialNumber: string;
  latestVitals?: {
    systolicBP?: number;
    diastolicBP?: number;
    spO2Percent?: number;
    bloodGlucoseMgDl?: number;
    heartRateBpm?: number;
    lastSyncTimestamp?: string;
  };
  vitalAlertSeverity: "normal" | "borderline" | "critical_alert";
  nurseVisitStatus: "scheduled" | "in_transit" | "completed" | "cancelled";
  notes?: string;
  updatedAt?: string;
}

export interface Metrics {
  totalPatients: number;
  activeNurseVisits: number;
  criticalVitalAlerts: number;
  activeRPMDevices: number;
}

export interface PatientOption {
  id: string;
  name: string;
}

export default function HomeRPMPage() {
  const { toast } = useToast();
  const activeClinicId = useAuthStore((state) => state.activeClinicId);

  const [records, setRecords] = useState<HomeRPMRecord[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalPatients: 0,
    activeNurseVisits: 0,
    criticalVitalAlerts: 0,
    activeRPMDevices: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"stream" | "nurse" | "inventory">("stream");

  // Filters
  const [selectedPlan, setSelectedPlan] = useState("ALL");
  const [selectedAlert, setSelectedAlert] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [activeVitalsModal, setActiveVitalsModal] = useState<HomeRPMRecord | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [submittingEnroll, setSubmittingEnroll] = useState(false);
  const [submittingVitals, setSubmittingVitals] = useState(false);

  // Log Vitals Form State
  const [vitalsForm, setVitalsForm] = useState({
    systolicBP: 124,
    diastolicBP: 82,
    spO2Percent: 98,
    bloodGlucoseMgDl: 110,
    heartRateBpm: 72,
    notes: "",
  });

  // Enroll Form State
  const [formData, setFormData] = useState({
    patientId: "",
    patientName: "",
    homeAddress: "",
    carePlanType: "hypertension_management",
    deviceSerialNumber: "CELL-RPM-9092",
    assignedNurse: "Nurse Specialist Clara Oswald, RN",
    notes: "",
  });

  useEffect(() => {
    fetchRecords();
    fetchPatients();
  }, [selectedPlan, selectedAlert, activeClinicId]);

  const fetchPatients = async () => {
    try {
      const res = await api.get(`/patients${activeClinicId ? `?clinicId=${activeClinicId}` : ""}`);
      const list = Array.isArray(res.data?.data)
        ? res.data.data.map((patient: any) => ({
            id: patient.id || patient._id,
            name: patient.userId?.name || patient.name || "Patient Profile",
          }))
        : [];
      setPatients(list);
    } catch {
      setPatients([]);
    }
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeClinicId) queryParams.append("clinicId", activeClinicId);
      if (selectedPlan !== "ALL") queryParams.append("carePlanType", selectedPlan);
      if (selectedAlert !== "ALL") queryParams.append("vitalAlertSeverity", selectedAlert);

      const res = await api.get(`/home-rpm?${queryParams.toString()}`);
      if (res.data && res.data.success) {
        setRecords(res.data.data.records || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching home RPM records:", err);
      toast({
        title: "Error Loading RPM Data",
        description: err.response?.data?.message || "Failed to fetch remote monitoring patients",
        variant: "error",
      });
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClinicId) {
      toast({ title: "Clinic Required", description: "Select an active clinic before enrolling an RPM patient.", variant: "error" });
      return;
    }
    try {
      setSubmittingEnroll(true);
      const res = await api.post("/home-rpm", {
        clinicId: activeClinicId,
        patientId: formData.patientId || undefined,
        patientName: formData.patientName,
        carePlanType: formData.carePlanType,
        assignedNurse: formData.assignedNurse,
        deviceSerialNumber: formData.deviceSerialNumber,
        address: formData.homeAddress,
        notes: formData.notes,
      });
      if (res.data && res.data.success) {
        toast({
          title: "Patient Enrolled in RPM ✓",
          description: `Enrolled ${formData.patientName} into Remote Patient Monitoring.`,
          variant: "success",
        });
        setIsEnrollModalOpen(false);
        fetchRecords();
      }
    } catch (err: any) {
      toast({
        title: "Enrollment Failed",
        description: err.response?.data?.message || "Failed to enroll patient into RPM",
        variant: "error",
      });
    } finally {
      setSubmittingEnroll(false);
    }
  };

  const handleLogVitalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVitalsModal) return;

    try {
      setSubmittingVitals(true);
      const res = await api.patch(`/home-rpm/${activeVitalsModal.id}/vitals`, vitalsForm);
      if (res.data && res.data.success) {
        toast({
          title: "Device Telemetry Logged ✓",
          description: `Logged vitals for ${activeVitalsModal.patientName}. Alert status: ${res.data.data.vitalAlertSeverity.replace(/_/g, " ")}.`,
          variant: res.data.data.vitalAlertSeverity === "critical_alert" ? "error" : "success",
        });
        setActiveVitalsModal(null);
        fetchRecords();
      }
    } catch (err: any) {
      toast({
        title: "Vitals Logging Failed",
        description: err.response?.data?.message || "Could not log vital readings",
        variant: "error",
      });
    } finally {
      setSubmittingVitals(false);
    }
  };

  const handleUpdateNurseVisitStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/home-rpm/${id}/vitals`, { nurseVisitStatus: newStatus });
      toast({
        title: "Nurse Dispatch Status Updated",
        description: `Visit updated to ${newStatus.replace(/_/g, " ")}`,
        variant: "success",
      });
      fetchRecords();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Could not update nurse visit status",
        variant: "error",
      });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await api.delete(`/home-rpm/${id}`);
      toast({
        title: "Record Archived",
        description: "Patient RPM record removed from active directory.",
        variant: "success",
      });
      fetchRecords();
    } catch (err: any) {
      toast({
        title: "Archive Failed",
        description: err.response?.data?.message || "Could not archive RPM record",
        variant: "error",
      });
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.deviceSerialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.assignedNurse.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAlertBadge = (severity: string) => {
    switch (severity) {
      case "critical_alert":
        return <Badge variant="danger">🔴 CRITICAL VITAL ALERT</Badge>;
      case "borderline":
        return <Badge variant="warning">🟡 Borderline Telemetry</Badge>;
      default:
        return <Badge variant="success">🟢 Normal Vitals</Badge>;
    }
  };

  const getCarePlanLabel = (plan: string) => {
    switch (plan) {
      case "hypertension_management":
        return "Hypertension Care Plan";
      case "diabetes_rpm":
        return "Diabetes Glucose RPM";
      case "copd_oxygen_monitoring":
        return "COPD Oxygen Telemetry";
      case "heart_failure_vitals":
        return "Heart Failure Vitals";
      default:
        return "Post-Op Wound Care";
    }
  };

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span className="text-blue-500">📡</span> Home Healthcare & Remote Patient Monitoring (RPM)
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Cellular medical device telemetry sync, outpatient vital threshold alerts, and home care nurse visit dispatching.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsEnrollModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <span>+ Enroll RPM Patient</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchRecords}
            loading={isLoading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5 text-xs"
          >
            <span>Refresh Desk</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Total Enrolled RPM Patients"
          value={metrics.totalPatients}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
        <StatCard
          label="Critical Vital Alerts"
          value={metrics.criticalVitalAlerts}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-red-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Active Nurse Visits En-Route"
          value={metrics.activeNurseVisits}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        />
        <StatCard
          label="Active Cellular RPM Devices"
          value={metrics.activeRPMDevices}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        />
      </div>

      {/* Main Workspace Navigation Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt rounded-2xl border border-border/80 text-xs font-bold w-full md:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("stream")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "stream" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          📡 Active Patient Telemetry Stream ({filteredRecords.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("nurse")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "nurse" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🏥 Home Nurse Visit Dispatcher
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "inventory" ? "bg-surface text-blue-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          📋 RPM Enrollment Directory & Devices
        </button>
      </div>

      {/* TAB 1: ACTIVE PATIENT TELEMETRY STREAM */}
      {activeTab === "stream" && (
        <div className="space-y-4">
          <div className="p-4 bg-surface rounded-2xl border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                options={[
                  { value: "ALL", label: "All Care Plans" },
                  { value: "hypertension_management", label: "Hypertension Management" },
                  { value: "diabetes_rpm", label: "Diabetes Glucose RPM" },
                  { value: "copd_oxygen_monitoring", label: "COPD Oxygen Telemetry" },
                  { value: "heart_failure_vitals", label: "Heart Failure Vitals" },
                ]}
                className="w-48 text-xs"
              />

              <Select
                value={selectedAlert}
                onChange={(e) => setSelectedAlert(e.target.value)}
                options={[
                  { value: "ALL", label: "All Alert Severities" },
                  { value: "critical_alert", label: "Critical Vital Alert" },
                  { value: "borderline", label: "Borderline Telemetry" },
                  { value: "normal", label: "Normal Vitals" },
                ]}
                className="w-44 text-xs"
              />
            </div>

            <Input
              placeholder="Search patient, address, device SN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 text-xs"
            />
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <Spinner size="md" label="Loading Cellular Telemetry Streams..." />
            </div>
          ) : filteredRecords.length === 0 ? (
            <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
              <CardContent className="space-y-2">
                <div className="text-3xl">📡</div>
                <p className="font-semibold text-text">No RPM patient telemetry streams matching selected filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecords.map((item) => {
                const vitals = item.latestVitals;
                const isCritical = item.vitalAlertSeverity === "critical_alert";

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between text-xs shadow-xs ${
                      isCritical
                        ? "bg-red-500/10 border-red-500/50 hover:border-red-500"
                        : item.vitalAlertSeverity === "borderline"
                        ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500"
                        : "bg-surface border-border hover:border-blue-500"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs text-blue-600 bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                          {item.deviceSerialNumber || "CELL-RPM"}
                        </span>
                        {getAlertBadge(item.vitalAlertSeverity)}
                      </div>

                      <h3 className="font-bold text-base text-text">{item.patientName}</h3>
                      <p className="text-[11px] text-text-muted">Home: {item.address}</p>

                      <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Care Plan:</span>
                          <span className="font-bold text-text">{getCarePlanLabel(item.carePlanType)}</span>
                        </div>

                        {/* Live Vitals Reading Box */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-border/40 font-mono">
                          <div>
                            <span className="text-text-muted text-[10px] block">Blood Pressure:</span>
                            <span className="font-bold text-text">
                              {vitals?.systolicBP ? `${vitals.systolicBP}/${vitals.diastolicBP} mmHg` : "Not recorded"}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px] block">SpO2 Oxygen:</span>
                            <span className="font-bold text-emerald-600">
                              {vitals?.spO2Percent ? `${vitals.spO2Percent}%` : "98%"}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px] block">Blood Glucose:</span>
                            <span className="font-bold text-text">
                              {vitals?.bloodGlucoseMgDl ? `${vitals.bloodGlucoseMgDl} mg/dL` : "110 mg/dL"}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px] block">Heart Rate:</span>
                            <span className="font-bold text-text">
                              {vitals?.heartRateBpm ? `${vitals.heartRateBpm} bpm` : "74 bpm"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => {
                          setActiveVitalsModal(item);
                          if (item.latestVitals) {
                            setVitalsForm({
                              systolicBP: item.latestVitals.systolicBP || 124,
                              diastolicBP: item.latestVitals.diastolicBP || 82,
                              spO2Percent: item.latestVitals.spO2Percent || 98,
                              bloodGlucoseMgDl: item.latestVitals.bloodGlucoseMgDl || 110,
                              heartRateBpm: item.latestVitals.heartRateBpm || 72,
                              notes: "",
                            });
                          }
                        }}
                        className="font-bold text-[11px] rounded-lg w-full gap-1 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                      >
                        <span>🩺 Log Device Reading</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HOME NURSE VISIT DISPATCHER */}
      {activeTab === "nurse" && (
        <Card className="shadow-xs border border-border rounded-2xl bg-surface">
          <CardHeader className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-text">
                Home Care Nurse Visit Dispatcher
              </CardTitle>
              <p className="text-xs text-text-muted">
                Schedule, track, and dispatch home care nurses to high-risk chronic care RPM patients.
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <SkeletonTable rows={4} cols={5} />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <div className="text-3xl">🏥</div>
                <p className="text-xs font-semibold">No RPM home nurse visits scheduled.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredRecords.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-surface-alt/50 transition-colors space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-600 font-black flex items-center justify-center text-xs border border-blue-500/20">
                          RN
                        </div>
                        <div>
                          <div className="font-bold text-text text-sm flex items-center gap-2">
                            Patient: {item.patientName}
                            {getAlertBadge(item.vitalAlertSeverity)}
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Home Address: <strong className="text-text font-semibold">{item.address}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.nurseVisitStatus === "scheduled" && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleUpdateNurseVisitStatus(item.id, "in_transit")}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer text-[11px]"
                          >
                            🚙 Dispatch Nurse In-Transit
                          </Button>
                        )}
                        {item.nurseVisitStatus === "in_transit" && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleUpdateNurseVisitStatus(item.id, "completed")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer text-[11px]"
                          >
                            ✅ Mark Visit Completed
                          </Button>
                        )}
                        {item.nurseVisitStatus === "completed" && (
                          <Badge variant="success" className="font-bold">
                            ✅ VISIT COMPLETED
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                      <div><span className="text-text-muted">Assigned Nurse:</span> <strong className="text-text">{item.assignedNurse}</strong></div>
                      <div><span className="text-text-muted">Care Plan:</span> <strong className="text-blue-600">{getCarePlanLabel(item.carePlanType)}</strong></div>
                      <div><span className="text-text-muted">Device Serial:</span> <strong className="font-mono text-text">{item.deviceSerialNumber}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: RPM ENROLLMENT REGISTER & DEVICE INVENTORY */}
      {activeTab === "inventory" && (
        <Card className="shadow-xs border border-border rounded-2xl bg-surface">
          <CardHeader className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-text">
                RPM Patient Directory & Device Register
              </CardTitle>
              <p className="text-xs text-text-muted">
                Directory of enrolled remote monitoring patients and registered cellular IoT device serial numbers.
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <SkeletonTable rows={4} cols={5} />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <div className="text-3xl">📋</div>
                <p className="text-xs font-semibold">No RPM enrollment records found.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredRecords.map((r) => (
                  <div key={r.id} className="p-4 hover:bg-surface-alt/50 transition-colors space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-text">{r.patientName}</h4>
                        <p className="text-text-muted text-[11px]">{r.address}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" className="font-mono">
                          SN: {r.deviceSerialNumber}
                        </Badge>
                        <Button
                          size="xs"
                          variant="danger"
                          onClick={() => handleDeleteRecord(r.id)}
                          className="font-bold text-[11px] rounded-lg px-2.5 cursor-pointer"
                        >
                          Archive
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* LOG VITALS TELEMETRY MODAL */}
      <Modal
        isOpen={!!activeVitalsModal}
        onClose={() => setActiveVitalsModal(null)}
        title="🩺 Log Real-Time Medical Device Telemetry"
        size="md"
      >
        {activeVitalsModal && (
          <form onSubmit={handleLogVitalsSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-950 dark:text-blue-200 text-[11px]">
              📡 Log cellular device reading for <strong>{activeVitalsModal.patientName}</strong> ({getCarePlanLabel(activeVitalsModal.carePlanType)}).
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Systolic BP (mmHg)"
                type="number"
                value={vitalsForm.systolicBP}
                onChange={(e) => setVitalsForm({ ...vitalsForm, systolicBP: Number(e.target.value) })}
                className="text-xs"
              />
              <Input
                label="Diastolic BP (mmHg)"
                type="number"
                value={vitalsForm.diastolicBP}
                onChange={(e) => setVitalsForm({ ...vitalsForm, diastolicBP: Number(e.target.value) })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Input
                label="SpO2 (%)"
                type="number"
                value={vitalsForm.spO2Percent}
                onChange={(e) => setVitalsForm({ ...vitalsForm, spO2Percent: Number(e.target.value) })}
                className="text-xs"
              />
              <Input
                label="Glucose (mg/dL)"
                type="number"
                value={vitalsForm.bloodGlucoseMgDl}
                onChange={(e) => setVitalsForm({ ...vitalsForm, bloodGlucoseMgDl: Number(e.target.value) })}
                className="text-xs"
              />
              <Input
                label="Heart Rate (bpm)"
                type="number"
                value={vitalsForm.heartRateBpm}
                onChange={(e) => setVitalsForm({ ...vitalsForm, heartRateBpm: Number(e.target.value) })}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" type="button" onClick={() => setActiveVitalsModal(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submittingVitals} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                Log Telemetry Reading
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ENROLL RPM PATIENT MODAL */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title="📡 Enroll Patient into Remote Patient Monitoring (RPM)"
        size="lg"
      >
        <form onSubmit={handleCreateRecord} className="space-y-3.5 text-xs">
          {patients.length > 0 && (
            <Select
              label="Select Patient Profile (Optional)"
              value={formData.patientId}
              onChange={(e) => {
                const pid = e.target.value;
                const p = patients.find((item) => item.id === pid);
                setFormData({
                  ...formData,
                  patientId: pid,
                  patientName: p ? p.name : formData.patientName,
                });
              }}
              options={[
                { value: "", label: "Select patient from database..." },
                ...patients.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          )}

          <div>
            <label className="block text-xs font-bold text-text mb-1">Patient Full Name *</label>
            <Input
              required
              placeholder="e.g. Eleanor Vance"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
              className="text-xs"
            />
          </div>

          <Select
            label="Care Plan Type *"
            value={formData.carePlanType}
            onChange={(e) => setFormData({ ...formData, carePlanType: e.target.value as any })}
            options={[
              { value: "hypertension_management", label: "Hypertension Management" },
              { value: "diabetes_rpm", label: "Diabetes Glucose RPM" },
              { value: "copd_oxygen_monitoring", label: "COPD Oxygen Telemetry" },
              { value: "heart_failure_vitals", label: "Heart Failure Vitals" },
              { value: "post_op_wound_care", label: "Post-Op Wound Care" },
            ]}
          />

          <div>
            <label className="block text-xs font-bold text-text mb-1">Home Residence Address *</label>
            <Input
              required
              placeholder="e.g. 77 Sunset Avenue, Apartment 2B"
              value={formData.homeAddress}
              onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text mb-1">Cellular Device Serial Number *</label>
              <Input
                required
                value={formData.deviceSerialNumber}
                onChange={(e) => setFormData({ ...formData, deviceSerialNumber: e.target.value })}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">Assigned Home Care Nurse *</label>
              <Input
                required
                value={formData.assignedNurse}
                onChange={(e) => setFormData({ ...formData, assignedNurse: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEnrollModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submittingEnroll} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              Enroll RPM Patient
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
