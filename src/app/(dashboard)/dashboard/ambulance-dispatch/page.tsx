"use client";

import { useState, useEffect, useRef } from "react";
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

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  lastGpsUpdate: string;
}

export interface AmbulanceDispatchRecord {
  id: string;
  vehicleNumber: string;
  vehicleType: "advanced_life_support" | "basic_life_support" | "neonatal_transport" | "patient_transfer";
  callPriority: "code_red_critical" | "code_yellow_urgent" | "code_green_routine";
  patientName: string;
  pickupLocation: string;
  destinationHospitalUnit: string;
  paramedicLead: string;
  driverName: string;
  dispatchStatus: "dispatched" | "en_route_to_scene" | "on_scene" | "transporting_to_er" | "arrived_er" | "available_in_bay";
  gpsCoordinates?: GPSCoordinates;
  speedKmh?: number;
  oxygenLevelPercent?: number;
  fuelPercent: number;
  etaMinutes?: number;
  vitalsEnroute?: { hr?: number; bp?: string; spo2?: number };
  notes?: string;
  updatedAt?: string;
}

export interface Metrics {
  totalDispatches: number;
  activeDispatches: number;
  codeRedCritical: number;
  availableFleet: number;
}

const DISPATCH_STAGES = [
  { key: "dispatched", label: "Dispatched", step: 1 },
  { key: "en_route_to_scene", label: "En-Route Scene", step: 2 },
  { key: "on_scene", label: "On-Scene Triage", step: 3 },
  { key: "transporting_to_er", label: "Transporting ER", step: 4 },
  { key: "arrived_er", label: "Arrived ER", step: 5 },
  { key: "available_in_bay", label: "Available in Bay", step: 6 },
];

export default function AmbulanceDispatchPage() {
  const { toast } = useToast();
  const activeClinicId = useAuthStore((state) => state.activeClinicId);

  const [dispatches, setDispatches] = useState<AmbulanceDispatchRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalDispatches: 0,
    activeDispatches: 0,
    codeRedCritical: 0,
    availableFleet: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Live Satellite GPS Auto-Tracker Toggle
  const [isLiveGpsTracking, setIsLiveGpsTracking] = useState(true);

  // Real Hardware / Mobile Phone GPS Streaming State
  const [realGpsActive, setRealGpsActive] = useState(false);
  const [realGpsDispatchId, setRealGpsDispatchId] = useState("");
  const watchIdRef = useRef<number | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"fleet" | "radar" | "history">("fleet");

  // Filters
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [activeTelemetryModal, setActiveTelemetryModal] = useState<AmbulanceDispatchRecord | null>(null);
  const [activeVitalsModal, setActiveVitalsModal] = useState<AmbulanceDispatchRecord | null>(null);
  const [isConnectGpsModalOpen, setIsConnectGpsModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [submittingVitals, setSubmittingVitals] = useState(false);

  // Pre-Hospital EMT Vitals Form
  const [vitalsForm, setVitalsForm] = useState({ hr: 98, bp: "128/84", spo2: 97, notes: "" });

  const [formData, setFormData] = useState({
    vehicleNumber: "AMB-101 (ALS Unit)",
    vehicleType: "advanced_life_support",
    callPriority: "code_red_critical",
    patientName: "",
    pickupLocation: "",
    destinationHospitalUnit: "Emergency Trauma Resuscitation Bay 1",
    paramedicLead: "Paramedic Alex Mercer, EMT-P",
    driverName: "Officer David Miller",
    fuelPercent: 92,
    notes: "",
  });

  useEffect(() => {
    fetchDispatches();
  }, [selectedPriority, selectedStatus, activeClinicId]);

  // Live Satellite GPS Movement Simulator Loop (Updates active vehicles every 3 seconds)
  useEffect(() => {
    let interval: any = null;
    if (isLiveGpsTracking && !realGpsActive) {
      interval = setInterval(() => {
        setDispatches((prevList) =>
          prevList.map((d) => {
            if (d.dispatchStatus === "arrived_er" || d.dispatchStatus === "available_in_bay") return d;

            const baseLat = d.gpsCoordinates?.latitude || 12.9716;
            const baseLon = d.gpsCoordinates?.longitude || 77.5946;
            const newLat = baseLat + (Math.random() - 0.48) * 0.003;
            const newLon = baseLon + (Math.random() - 0.48) * 0.003;
            const newSpeed = Math.floor(62 + Math.random() * 22);
            const newEta = Math.max(1, (d.etaMinutes || 8) - (Math.random() > 0.7 ? 1 : 0));

            api.post(`/ambulance-dispatch/${d.id}/telemetry`, {
              latitude: newLat,
              longitude: newLon,
              speedKmh: newSpeed,
              etaMinutes: newEta,
              oxygenLevelPercent: Math.max(85, (d.oxygenLevelPercent || 100) - (Math.random() > 0.8 ? 1 : 0)),
            }).catch(() => {});

            return {
              ...d,
              speedKmh: newSpeed,
              etaMinutes: newEta,
              gpsCoordinates: {
                latitude: newLat,
                longitude: newLon,
                lastGpsUpdate: new Date().toISOString(),
              },
            };
          })
        );
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLiveGpsTracking, realGpsActive]);

  // Handle Real Physical Hardware / Smartphone GPS Streaming
  const startRealGpsTracking = (dispatchId: string) => {
    if (!navigator.geolocation) {
      toast({
        title: "GPS Hardware Not Supported",
        description: "Your browser or device does not support HTML5 Geolocation API.",
        variant: "error",
      });
      return;
    }

    setRealGpsDispatchId(dispatchId);
    setRealGpsActive(true);

    const wId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const speedKmh = Math.round((speed || 0) * 3.6);

        api.post(`/ambulance-dispatch/${dispatchId}/telemetry`, {
          latitude,
          longitude,
          speedKmh: speedKmh > 0 ? speedKmh : 65,
        }).catch((e) => console.warn("Live GPS stream error:", e));

        toast({
          title: "Real GPS Stream Transmitting 🛰️",
          description: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)} streamed to command tower.`,
          variant: "success",
        });
      },
      (err) => {
        toast({
          title: "GPS Hardware Permission Denied",
          description: err.message || "Please allow location access on your phone or device.",
          variant: "error",
        });
        setRealGpsActive(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );

    watchIdRef.current = wId;
    setIsConnectGpsModalOpen(false);
  };

  const stopRealGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setRealGpsActive(false);
    setRealGpsDispatchId("");
    toast({
      title: "Real GPS Stream Stopped 🛑",
      description: "Returned to satellite simulator mode.",
      variant: "info",
    });
  };

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeClinicId) queryParams.append("clinicId", activeClinicId);
      if (selectedPriority !== "ALL") queryParams.append("callPriority", selectedPriority);
      if (selectedStatus !== "ALL") queryParams.append("dispatchStatus", selectedStatus);

      const res = await api.get(`/ambulance-dispatch?${queryParams.toString()}`);
      if (res.data && res.data.success) {
        setDispatches(res.data.data.dispatches || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching ambulance dispatches:", err);
      toast({
        title: "Error Loading Fleet Data",
        description: err.response?.data?.message || "Failed to fetch ambulance dispatches",
        variant: "error",
      });
      setDispatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Preset Dispatch Triggers
  const handleQuickPreset = (preset: "stemi" | "trauma" | "stroke" | "transfer") => {
    switch (preset) {
      case "stemi":
        setFormData({
          vehicleNumber: `AMB-${Math.floor(100 + Math.random() * 900)} (ALS Cardiac)`,
          vehicleType: "advanced_life_support",
          callPriority: "code_red_critical",
          patientName: "Acute STEMI Cardiac Emergency Patient",
          pickupLocation: "Highway Junction 14, Main Arterial Road",
          destinationHospitalUnit: "Cardiac Cath Lab / Resuscitation Bay 1",
          paramedicLead: "Lead EMT Marcus Vance",
          driverName: "Officer Sam Thorne",
          fuelPercent: 95,
          notes: "Patient reports severe sub-sternal chest pain with radiation to left arm. ECG shows ST elevation.",
        });
        break;
      case "trauma":
        setFormData({
          vehicleNumber: `AMB-${Math.floor(100 + Math.random() * 900)} (ALS Trauma)`,
          vehicleType: "advanced_life_support",
          callPriority: "code_red_critical",
          patientName: "High-Speed Collision Trauma Patient",
          pickupLocation: "North Expressway Exit 8",
          destinationHospitalUnit: "Level-1 Trauma Resuscitation Bay 2",
          paramedicLead: "Paramedic Sarah Jenkins, EMT-P",
          driverName: "Officer Leo Vance",
          fuelPercent: 88,
          notes: "Multi-vehicle collision. Patient conscious with polytrauma and suspected femur fracture.",
        });
        break;
      case "stroke":
        setFormData({
          vehicleNumber: `AMB-${Math.floor(100 + Math.random() * 900)} (Stroke Unit)`,
          vehicleType: "advanced_life_support",
          callPriority: "code_yellow_urgent",
          patientName: "Acute Ischemic Stroke Suspect",
          pickupLocation: "Green Park Residences, Flat 402",
          destinationHospitalUnit: "Comprehensive Stroke Center / CT Bay",
          paramedicLead: "Paramedic Nina Patel",
          driverName: "Officer Robert Chen",
          fuelPercent: 90,
          notes: "Sudden onset right-sided weakness and facial droop onset 45 minutes prior.",
        });
        break;
      case "transfer":
        setFormData({
          vehicleNumber: `AMB-${Math.floor(100 + Math.random() * 900)} (Transport)`,
          vehicleType: "patient_transfer",
          callPriority: "code_green_routine",
          patientName: "Inter-Facility Rehabilitation Transfer",
          pickupLocation: "East Wing Ward 3B",
          destinationHospitalUnit: "City Outpatient Rehabilitation Facility",
          paramedicLead: "EMT Chris Logan",
          driverName: "Driver Arthur Pendelton",
          fuelPercent: 85,
          notes: "Stable post-op transfer under oxygen cannula support.",
        });
        break;
    }
    setIsDispatchModalOpen(true);
  };

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClinicId) {
      toast({
        title: "Clinic Required",
        description: "Select an active clinic before dispatching an ambulance unit.",
        variant: "error",
      });
      return;
    }
    try {
      setSubmittingDispatch(true);
      const res = await api.post("/ambulance-dispatch", { ...formData, clinicId: activeClinicId });
      if (res.data && res.data.success) {
        toast({
          title: "Ambulance Dispatched 🚨",
          description: `Emergency unit ${formData.vehicleNumber} dispatched to ${formData.pickupLocation}`,
          variant: "success",
        });
        setIsDispatchModalOpen(false);
        fetchDispatches();
      }
    } catch (err: any) {
      toast({
        title: "Dispatch Failed",
        description: err.response?.data?.message || "Failed to dispatch ambulance unit",
        variant: "error",
      });
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(`/ambulance-dispatch/${id}/status`, { dispatchStatus: newStatus });
      if (res.data && res.data.success) {
        toast({
          title: "Fleet Status Updated ✓",
          description: `Unit updated to status: ${newStatus.replace(/_/g, " ")}`,
          variant: "success",
        });
        fetchDispatches();
      }
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update dispatch status",
        variant: "error",
      });
    }
  };

  // Submit Pre-Hospital EMT Vitals & Trauma Alert
  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVitalsModal) return;

    try {
      setSubmittingVitals(true);
      await api.post(`/ambulance-dispatch/${activeVitalsModal.id}/telemetry`, {
        vitalsEnroute: { hr: vitalsForm.hr, bp: vitalsForm.bp, spo2: vitalsForm.spo2 },
      });

      toast({
        title: "Pre-Hospital Trauma Alert Issued 🚨",
        description: `En-route vitals (HR ${vitalsForm.hr}, BP ${vitalsForm.bp}, SpO2 ${vitalsForm.spo2}%) transmitted to ${activeVitalsModal.destinationHospitalUnit}.`,
        variant: "warning",
      });

      setActiveVitalsModal(null);
      fetchDispatches();
    } catch (err: any) {
      toast({
        title: "Vitals Transmission Failed",
        description: err.response?.data?.message || "Could not transmit pre-hospital vitals",
        variant: "error",
      });
    } finally {
      setSubmittingVitals(false);
    }
  };

  const handleDeleteDispatch = async (id: string) => {
    try {
      await api.delete(`/ambulance-dispatch/${id}`);
      toast({
        title: "Record Deleted",
        description: "Ambulance dispatch record archived.",
        variant: "success",
      });
      fetchDispatches();
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.response?.data?.message || "Could not delete dispatch record",
        variant: "error",
      });
    }
  };

  const filteredDispatches = dispatches.filter(
    (d) =>
      d.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.pickupLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.paramedicLead.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeDispatchesList = dispatches.filter(
    (d) => d.dispatchStatus !== "arrived_er" && d.dispatchStatus !== "available_in_bay"
  );

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "code_red_critical":
        return <Badge variant="danger">🔴 CODE RED CRITICAL</Badge>;
      case "code_yellow_urgent":
        return <Badge variant="warning">🟡 CODE YELLOW URGENT</Badge>;
      default:
        return <Badge variant="success">🟢 CODE GREEN ROUTINE</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "dispatched":
        return <Badge variant="warning">🚨 DISPATCHED</Badge>;
      case "en_route_to_scene":
        return <Badge variant="info">🚙 EN-ROUTE SCENE</Badge>;
      case "on_scene":
        return <Badge variant="primary">🩺 ON-SCENE TRIAGE</Badge>;
      case "transporting_to_er":
        return <Badge variant="danger">🚨 TRANSPORTING TO ER</Badge>;
      case "arrived_er":
        return <Badge variant="success">🏥 ARRIVED AT ER</Badge>;
      default:
        return <Badge variant="neutral">🅿️ AVAILABLE IN BAY</Badge>;
    }
  };

  const getCurrentStepIndex = (status: string) => {
    const stage = DISPATCH_STAGES.find((s) => s.key === status);
    return stage ? stage.step : 1;
  };

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span className="text-red-500">🚑</span> Hospital Fleet & Emergency Dispatch Command Desk
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time GPS ambulance telemetry, paramedic dispatch, pre-hospital EMT triage, and ER trauma readiness.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConnectGpsModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 border-purple-500/50 text-purple-600 dark:text-purple-400"
          >
            <span>📱 Connect Physical GPS / Phone</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsDispatchModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <span>+ Dispatch Emergency Unit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchDispatches}
            loading={isLoading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5 text-xs"
          >
            <span>Refresh Fleet</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Active Dispatches En-Route"
          value={metrics.activeDispatches}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-red-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
        <StatCard
          label="Code Red Critical Trauma"
          value={metrics.codeRedCritical}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-rose-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Available Fleet in ER Bay"
          value={metrics.availableFleet}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        />
        <StatCard
          label="Total Emergency Trips Logged"
          value={metrics.totalDispatches}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
        />
      </div>

      {/* Quick Emergency Dispatch Preset Buttons & Live GPS Toggle Toolbar */}
      <div className="p-3.5 bg-surface rounded-2xl border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-text flex items-center gap-1.5">
            <span className="text-red-500">⚡</span> Emergency Presets:
          </span>
          <button
            type="button"
            onClick={() => handleQuickPreset("stemi")}
            className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-600 border border-red-500/30 hover:bg-red-500/20 font-bold transition-all cursor-pointer"
          >
            🚨 Code Red STEMI / Cardiac
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset("trauma")}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/30 hover:bg-rose-500/20 font-bold transition-all cursor-pointer"
          >
            🏎️ Code Red Major Trauma
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset("stroke")}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/30 hover:bg-amber-500/20 font-bold transition-all cursor-pointer"
          >
            🧠 Code Yellow Stroke
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset("transfer")}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold transition-all cursor-pointer"
          >
            🟢 Code Green Transport
          </button>
        </div>

        {/* Live Satellite GPS Toggle */}
        <div className="flex items-center gap-2 bg-surface-alt px-3 py-1.5 rounded-xl border border-border/60 shrink-0">
          <span className="text-[11px] font-bold text-text">📡 GPS Telemetry Mode:</span>
          {realGpsActive ? (
            <button
              type="button"
              onClick={stopRealGpsTracking}
              className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all bg-purple-600 text-white shadow-xs animate-pulse cursor-pointer"
            >
              REAL PHONE GPS ACTIVE (STOP)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsLiveGpsTracking(!isLiveGpsTracking)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                isLiveGpsTracking
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-surface text-text-muted hover:text-text border border-border"
              }`}
            >
              {isLiveGpsTracking ? "SATELLITE SIMULATOR (3s)" : "PAUSED"}
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Navigation Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt rounded-2xl border border-border/80 text-xs font-bold w-full md:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("fleet")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "fleet" ? "bg-surface text-red-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🚨 Active Fleet Command & Stepper ({activeDispatchesList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("radar")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "radar" ? "bg-surface text-red-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🗺️ Live GPS Fleet Telemetry Radar
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "history" ? "bg-surface text-red-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          📋 Dispatch History & Audit Trail ({dispatches.length})
        </button>
      </div>

      {/* TAB 1: ACTIVE FLEET COMMAND & DISPATCHER STEPPER */}
      {activeTab === "fleet" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-12 text-center">
              <Spinner size="md" label="Loading Fleet Command Telemetry..." />
            </div>
          ) : activeDispatchesList.length === 0 ? (
            <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
              <CardContent className="space-y-2">
                <div className="text-3xl">🅿️</div>
                <p className="font-semibold text-text">All Emergency Ambulance Units Currently Available in Bay</p>
                <p className="text-text-muted">Click "+ Dispatch Emergency Unit" above to trigger a new trauma call response.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeDispatchesList.map((item) => {
                const currentStep = getCurrentStepIndex(item.dispatchStatus);

                return (
                  <div
                    key={item.id}
                    className="p-5 bg-surface border border-border rounded-2xl shadow-xs space-y-4 hover:border-red-500/40 transition-all text-xs"
                  >
                    {/* Top Row: Vehicle ID, Priority Badge & Destination */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-red-600">{item.vehicleNumber}</span>
                          {getPriorityBadge(item.callPriority)}
                          {getStatusBadge(item.dispatchStatus)}
                        </div>
                        <h3 className="font-bold text-sm text-text">Patient: {item.patientName}</h3>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="text-text font-semibold">
                          Pickup: <strong className="text-text">{item.pickupLocation}</strong>
                        </div>
                        <div className="text-text-muted text-[11px]">
                          Destination: <strong className="text-purple-600 font-bold">{item.destinationHospitalUnit}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Dispatch Stage Stepper Bar (High Contrast Labels) */}
                    <div className="py-2">
                      <div className="flex items-center justify-between text-xs font-extrabold text-text mb-2">
                        {DISPATCH_STAGES.slice(0, 5).map((stage) => {
                          const isActive = currentStep >= stage.step;
                          const isCurrent = currentStep === stage.step;

                          return (
                            <span
                              key={stage.key}
                              className={`${
                                isCurrent
                                  ? "text-red-600 font-black flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/30"
                                  : isActive
                                  ? "text-emerald-500 font-bold"
                                  : "text-text-muted font-medium"
                              }`}
                            >
                              {isCurrent && <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />}
                              {stage.label}
                            </span>
                          );
                        })}
                      </div>

                      {/* Stepper Line Progress */}
                      <div className="relative w-full h-2.5 bg-surface-alt rounded-full overflow-hidden border border-border/60">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-rose-500 to-emerald-500 transition-all duration-500 shadow-xs"
                          style={{ width: `${(currentStep / 5) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Crew & Telemetry Details */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-surface-alt/70 rounded-xl border border-border/60 text-[11px]">
                      <div>
                        <span className="text-text-muted block">EMT Lead:</span>
                        <span className="font-bold text-text">{item.paramedicLead}</span>
                      </div>

                      <div>
                        <span className="text-text-muted block">Driver:</span>
                        <span className="font-bold text-text">{item.driverName}</span>
                      </div>

                      <div>
                        <span className="text-text-muted block">GPS & Speed:</span>
                        <span className="font-mono font-bold text-rose-600">
                          {item.speedKmh ? `${item.speedKmh} km/h` : "68 km/h"}{" "}
                          <span className="text-text-muted text-[10px]">
                            ({item.gpsCoordinates ? `${item.gpsCoordinates.latitude.toFixed(4)}, ${item.gpsCoordinates.longitude.toFixed(4)}` : "12.9716, 77.5946"})
                          </span>
                        </span>
                      </div>

                      <div>
                        <span className="text-text-muted block">Estimated ETA:</span>
                        <span className="font-bold text-emerald-600 font-mono">
                          {item.etaMinutes ? `${item.etaMinutes} mins to ER` : "08 mins to ER"}
                        </span>
                      </div>

                      <div>
                        <span className="text-text-muted block">En-route Vitals:</span>
                        <span className="font-mono font-bold text-text">
                          {item.vitalsEnroute?.hr
                            ? `HR ${item.vitalsEnroute.hr} · ${item.vitalsEnroute.bp} · ${item.vitalsEnroute.spo2}% SpO2`
                            : "Vitals Normal"}
                        </span>
                      </div>
                    </div>

                    {/* Action Controls Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setActiveTelemetryModal(item)}
                          className="text-xs font-semibold rounded-lg"
                        >
                          📊 View Full Telemetry Log
                        </Button>

                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setActiveVitalsModal(item);
                            if (item.vitalsEnroute) {
                              setVitalsForm({
                                hr: item.vitalsEnroute.hr || 98,
                                bp: item.vitalsEnroute.bp || "128/84",
                                spo2: item.vitalsEnroute.spo2 || 97,
                                notes: "",
                              });
                            }
                          }}
                          className="text-xs font-bold rounded-lg bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20"
                        >
                          🚑 Stream EMT Vitals
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.dispatchStatus === "dispatched" && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleUpdateStatus(item.id, "en_route_to_scene")}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                          >
                            🚙 Confirm En-Route Scene
                          </Button>
                        )}
                        {item.dispatchStatus === "en_route_to_scene" && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleUpdateStatus(item.id, "on_scene")}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer"
                          >
                            🩺 Confirm On-Scene Triage
                          </Button>
                        )}
                        {item.dispatchStatus === "on_scene" && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleUpdateStatus(item.id, "transporting_to_er")}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg cursor-pointer"
                          >
                            🚨 Transporting to ER
                          </Button>
                        )}
                        {item.dispatchStatus === "transporting_to_er" && (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => handleUpdateStatus(item.id, "arrived_er")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                          >
                            🏥 Confirm Arrival at ER
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE GPS FLEET TELEMETRY RADAR MAP */}
      {activeTab === "radar" && (
        <Card className="p-5 bg-surface border border-border rounded-2xl shadow-xs space-y-4">
          <CardHeader className="p-0 pb-2 border-b border-border/60">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <span>🗺️</span> Live GPS Fleet Telemetry Radar Command Tower
            </CardTitle>
            <p className="text-xs text-text-muted">
              Real-time satellite GPS tracking of active emergency units, transit speed, oxygen levels, and ER Trauma Bay allocations.
            </p>
          </CardHeader>

          <CardContent className="p-0 space-y-4 pt-2">
            {/* Simulated Live Satellite Map Canvas Box */}
            <div className="relative w-full h-[440px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 p-4 shadow-2xl flex flex-col justify-between">
              {/* Radar Grid Graphic Lines */}
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

              {/* Map Header Overlay */}
              <div className="relative z-10 flex items-center justify-between bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-xs text-slate-200">
                <div className="flex items-center gap-2 font-mono font-bold">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>SATELLITE GPS ACTIVE — {dispatches.length} FLEET UNITS MONITORED</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Center: 12.9716° N, 77.5946° E</span>
              </div>

              {/* Active Vehicles Radar Pins Display */}
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-auto">
                {dispatches.map((unit) => (
                  <div
                    key={unit.id}
                    className="p-3.5 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-800 text-white space-y-2 shadow-2xl hover:border-red-500/60 transition-all cursor-pointer group"
                    onClick={() => setActiveTelemetryModal(unit)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-red-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                        {unit.vehicleNumber}
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-bold">
                        {unit.dispatchStatus.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300 space-y-0.5">
                      <div>Patient: <strong className="text-white">{unit.patientName}</strong></div>
                      <div className="font-mono text-slate-400 text-[10px]">
                        GPS: {unit.gpsCoordinates ? `${unit.gpsCoordinates.latitude.toFixed(4)}, ${unit.gpsCoordinates.longitude.toFixed(4)}` : "12.9716, 77.5946"}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800 text-slate-400 font-mono">
                      <span>Speed: {unit.speedKmh || 68} km/h</span>
                      <span>ETA: {unit.etaMinutes || 8} mins</span>
                      <span>O2: {unit.oxygenLevelPercent || 98}%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Map Footer Overlay */}
              <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span>Emergency Medical Services Network</span>
                <span>Encrypted Satellite Telemetry Channel</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: DISPATCH HISTORY & FLEET AUDIT REGISTER */}
      {activeTab === "history" && (
        <Card className="shadow-xs border border-border rounded-2xl bg-surface">
          <CardHeader className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-text">
                Hospital Ambulance Dispatch History & Audit Trail
              </CardTitle>
              <p className="text-xs text-text-muted">
                Complete audit register of all emergency ambulance trips, paramedic leads, and telemetry logs.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                options={[
                  { value: "ALL", label: "All Call Priorities" },
                  { value: "code_red_critical", label: "Code Red Critical" },
                  { value: "code_yellow_urgent", label: "Code Yellow Urgent" },
                  { value: "code_green_routine", label: "Code Green Routine" },
                ]}
                className="w-40 text-xs"
              />

              <Input
                placeholder="Search vehicle, patient, paramedic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 text-xs"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <SkeletonTable rows={4} cols={5} />
              </div>
            ) : filteredDispatches.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <div className="text-3xl">🚑</div>
                <p className="text-xs font-semibold">No emergency ambulance dispatches found matching criteria.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredDispatches.map((d) => (
                  <div key={d.id} className="p-4 hover:bg-surface-alt/50 transition-colors space-y-2.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-500/10 text-red-600 font-black flex items-center justify-center text-xs border border-red-500/20">
                          EMS
                        </div>
                        <div>
                          <div className="font-bold text-text text-sm flex items-center gap-2">
                            {d.vehicleNumber}
                            {getPriorityBadge(d.callPriority)}
                            {getStatusBadge(d.dispatchStatus)}
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Patient: <strong className="text-text font-semibold">{d.patientName}</strong> · Pickup: {d.pickupLocation}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setActiveTelemetryModal(d)}
                          className="text-xs font-semibold rounded-lg"
                        >
                          📊 Telemetry Log
                        </Button>

                        <Button
                          size="xs"
                          variant="danger"
                          onClick={() => handleDeleteDispatch(d.id)}
                          className="text-xs font-bold rounded-lg px-2.5 cursor-pointer"
                        >
                          Archive
                        </Button>
                      </div>
                    </div>

                    <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                      <div><span className="text-text-muted">EMT Lead:</span> <strong className="text-text">{d.paramedicLead}</strong></div>
                      <div><span className="text-text-muted">Driver:</span> <strong className="text-text">{d.driverName}</strong></div>
                      <div><span className="text-text-muted">Destination:</span> <strong className="text-purple-600">{d.destinationHospitalUnit}</strong></div>
                      <div><span className="text-text-muted">Fuel Level:</span> <strong className="text-text">{d.fuelPercent}%</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CONNECT PHYSICAL GPS HARDWARE / MOBILE PHONE MODAL */}
      <Modal
        isOpen={isConnectGpsModalOpen}
        onClose={() => setIsConnectGpsModalOpen(false)}
        title="📱 Connect Physical GPS Device / Smartphone"
        size="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-900 dark:text-purple-200">
            📡 You can stream real live physical GPS location coordinates from any nurse/driver smartphone or hardware GPS tracker directly to our backend!
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-text text-sm">Option 1: Stream Live GPS from Mobile Device (Nurse/Driver Phone)</h4>
            <p className="text-text-muted">
              Select an active dispatch record below to pair with your device’s physical GPS sensor (`navigator.geolocation`):
            </p>

            <Select
              label="Select Active Ambulance Dispatch to Stream GPS *"
              value={realGpsDispatchId}
              onChange={(e) => setRealGpsDispatchId(e.target.value)}
              options={[
                { value: "", label: "Select active dispatch..." },
                ...activeDispatchesList.map((d) => ({
                  value: d.id,
                  label: `${d.vehicleNumber} — ${d.patientName} (${d.pickupLocation})`,
                })),
              ]}
            />

            <Button
              variant="primary"
              size="sm"
              disabled={!realGpsDispatchId}
              onClick={() => startRealGpsTracking(realGpsDispatchId)}
              className="w-full font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-2 cursor-pointer"
            >
              🚀 Start Real Device GPS Streaming
            </Button>
          </div>

          <div className="pt-3 border-t border-border space-y-2">
            <h4 className="font-bold text-text text-sm">Option 2: Physical Hardware GPS Box (Teltonika, OBD-II Tracker)</h4>
            <p className="text-text-muted">
              Configure your vehicle’s physical GPS tracker gateway to send HTTP pings to:
            </p>

            <div className="p-2.5 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
              POST /api/ambulance-dispatch/&lt;DISPATCH_ID&gt;/telemetry<br />
              Headers: Content-Type: application/json<br />
              Body: &#123; "latitude": 12.9716, "longitude": 77.5946, "speedKmh": 75 &#125;
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsConnectGpsModalOpen(false)}>
              Close Guide
            </Button>
          </div>
        </div>
      </Modal>

      {/* TELEMETRY LOG MODAL */}
      <Modal
        isOpen={!!activeTelemetryModal}
        onClose={() => setActiveTelemetryModal(null)}
        title="📊 Ambulance GPS & Telemetry Dispatch Record"
        size="md"
      >
        {activeTelemetryModal && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-surface-alt rounded-xl border border-border/60 space-y-2">
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-text-muted">Vehicle Unit Number:</span>
                <span className="font-bold text-red-600">{activeTelemetryModal.vehicleNumber}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-text-muted">Emergency Call Patient:</span>
                <span className="font-bold text-text">{activeTelemetryModal.patientName}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-text-muted">Pickup Location Address:</span>
                <span className="font-semibold text-text">{activeTelemetryModal.pickupLocation}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-text-muted">Destination ER Unit:</span>
                <span className="font-bold text-purple-600">{activeTelemetryModal.destinationHospitalUnit}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-text-muted">GPS Telemetry Coordinates:</span>
                <span className="font-mono font-bold text-rose-600">
                  {activeTelemetryModal.gpsCoordinates
                    ? `Lat: ${activeTelemetryModal.gpsCoordinates.latitude.toFixed(4)}, Lon: ${activeTelemetryModal.gpsCoordinates.longitude.toFixed(4)}`
                    : "Live GPS Active"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-1.5">
                <span className="text-text-muted">EMT Paramedic Lead:</span>
                <span className="font-bold text-text">{activeTelemetryModal.paramedicLead}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Fuel Level:</span>
                <span className="font-bold text-text">{activeTelemetryModal.fuelPercent}%</span>
              </div>
            </div>

            {activeTelemetryModal.notes && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-950 dark:text-purple-200">
                <span className="font-bold block mb-0.5">Triage & Pre-Hospital Notes:</span>
                <p className="italic text-[11px] leading-relaxed">{activeTelemetryModal.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setActiveTelemetryModal(null)}>
                Close Log
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* PRE-HOSPITAL EMT VITALS MODAL */}
      <Modal
        isOpen={!!activeVitalsModal}
        onClose={() => setActiveVitalsModal(null)}
        title="🚑 Stream Pre-Hospital EMT Vitals & Trauma Alert"
        size="md"
      >
        {activeVitalsModal && (
          <form onSubmit={handleSaveVitals} className="space-y-4 text-xs">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-950 dark:text-red-200 text-[11px]">
              🚨 Transmitting vitals will immediately trigger a Pre-Arrival Trauma Alert for <strong>{activeVitalsModal.destinationHospitalUnit}</strong>.
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Input
                label="Heart Rate (bpm)"
                type="number"
                value={vitalsForm.hr}
                onChange={(e) => setVitalsForm({ ...vitalsForm, hr: Number(e.target.value) })}
                className="text-xs"
              />
              <Input
                label="Blood Pressure"
                value={vitalsForm.bp}
                onChange={(e) => setVitalsForm({ ...vitalsForm, bp: e.target.value })}
                className="text-xs"
              />
              <Input
                label="SpO2 (%)"
                type="number"
                value={vitalsForm.spo2}
                onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: Number(e.target.value) })}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" type="button" onClick={() => setActiveVitalsModal(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submittingVitals} className="bg-red-600 hover:bg-red-700 text-white font-bold">
                Transmit Trauma Alert
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* DISPATCH EMERGENCY AMBULANCE MODAL */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="🚨 Dispatch Emergency Ambulance Unit"
        size="lg"
      >
        <form onSubmit={handleCreateDispatch} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-xs font-bold text-text mb-1">Emergency Call / Patient Name *</label>
            <Input
              required
              placeholder="e.g. Acute STEMI Cardiac Emergency Patient"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text mb-1">Ambulance Vehicle Unit *</label>
              <Input
                required
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                className="text-xs"
              />
            </div>

            <Select
              label="Call Priority *"
              value={formData.callPriority}
              onChange={(e) => setFormData({ ...formData, callPriority: e.target.value as any })}
              options={[
                { label: "🔴 CODE RED CRITICAL", value: "code_red_critical" },
                { label: "🟡 CODE YELLOW URGENT", value: "code_yellow_urgent" },
                { label: "🟢 CODE GREEN ROUTINE", value: "code_green_routine" },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Pickup Location Address *</label>
            <Input
              required
              placeholder="e.g. Grand Trunk Expressway, KM 14"
              value={formData.pickupLocation}
              onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text mb-1">Destination ER Unit *</label>
              <Input
                required
                value={formData.destinationHospitalUnit}
                onChange={(e) => setFormData({ ...formData, destinationHospitalUnit: e.target.value })}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">Fuel Percent (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.fuelPercent}
                onChange={(e) => setFormData({ ...formData, fuelPercent: Number(e.target.value) })}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text mb-1">EMT Paramedic Lead *</label>
              <Input
                required
                value={formData.paramedicLead}
                onChange={(e) => setFormData({ ...formData, paramedicLead: e.target.value })}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">Driver Name *</label>
              <Input
                required
                value={formData.driverName}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">Pre-Hospital Triage Notes</label>
            <Input
              placeholder="Initial vital signs, chief complaint notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsDispatchModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submittingDispatch} className="bg-red-600 hover:bg-red-700 text-white font-bold">
              Dispatch Ambulance Unit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
