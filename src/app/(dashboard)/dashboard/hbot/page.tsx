"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card,
  StatCard,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  useToast,
} from "@/components/ui";
import {
  Gauge,
  Wind,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  Activity,
  User,
  Stethoscope,
  Layers,
  ArrowUpRight,
} from "lucide-react";

interface HBOTSession {
  id: string;
  chamberId: string;
  patientName: string;
  indication: "diabetic_foot_ulcer" | "decompression_sickness" | "radiation_tissue_necrosis" | "carbon_monoxide_poisoning" | "chronic_osteomyelitis";
  pressureATA: number;
  sessionDurationMinutes: number;
  barotraumaSafetyCleared: boolean;
  sessionStatus: "scheduled" | "compressing" | "at_depth_treatment" | "decompressing" | "completed" | "aborted";
  supervisingPhysician: string;
  chamberOperator: string;
  notes?: string;
  updatedAt?: string;
}

interface Metrics {
  totalSessions: number;
  activeSessions: number;
  barotraumaClearedRate: number;
  completedHBOTHours: number;
}

export default function HBOTPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<HBOTSession[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalSessions: 0,
    activeSessions: 0,
    barotraumaClearedRate: 100,
    completedHBOTHours: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndication, setSelectedIndication] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeLogModal, setActiveLogModal] = useState<HBOTSession | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    chamberId: "HBOT-CHAMBER-BAY-01",
    patientName: "",
    indication: "diabetic_foot_ulcer",
    pressureATA: 2.4,
    sessionDurationMinutes: 90,
    barotraumaSafetyCleared: true,
    supervisingPhysician: "",
    chamberOperator: "",
    notes: "",
  });

  useEffect(() => {
    fetchSessions();
  }, [selectedIndication, selectedStatus]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedIndication !== "ALL") queryParams.append("indication", selectedIndication);
      if (selectedStatus !== "ALL") queryParams.append("sessionStatus", selectedStatus);

      const res = await api.get(`/hbot?${queryParams.toString()}`);
      if (res.data && res.data.success) {
        setSessions(res.data.data.sessions || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching HBOT sessions:", err);
      toast({
        title: "Error Loading HBOT Data",
        description: err.response?.data?.message || "Failed to fetch hyperbaric oxygen sessions",
        variant: "error",
      });
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/hbot", formData);
      if (res.data && res.data.success) {
        toast({
          title: "Session Scheduled",
          description: `Scheduled HBOT compression session for ${formData.patientName}`,
          variant: "success",
        });
        setIsScheduleModalOpen(false);
        fetchSessions();
      }
    } catch (err: any) {
      toast({
        title: "Scheduling Failed",
        description: err.response?.data?.message || "Failed to schedule HBOT session",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(`/hbot/${id}/status`, { sessionStatus: newStatus });
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: `Chamber protocol status changed to ${newStatus}`,
          variant: "success",
        });
        fetchSessions();
      }
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update session status",
        variant: "error",
      });
    }
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.chamberId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.supervisingPhysician.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "at_depth_treatment":
        return <Badge variant="primary" dot pulse>At Depth (Treatment)</Badge>;
      case "compressing":
        return <Badge variant="warning">Compressing</Badge>;
      case "decompressing":
        return <Badge variant="info">Decompressing</Badge>;
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "aborted":
        return <Badge variant="danger">Aborted</Badge>;
      default:
        return <Badge variant="neutral">Scheduled</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Hyperbaric Oxygen Therapy (HBOT) Operations Workspace
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Multiplace chamber compression schedules, ATA pressure protocols, barotrauma safety & oxygen dive logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchSessions} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsScheduleModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Schedule HBOT Session
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Chamber Sessions"
          value={metrics.activeSessions}
          icon={<Gauge className="w-5 h-5 text-primary-500" />}
          description="Under Compression"
        />
        <StatCard
          title="Barotrauma Clearance Rate"
          value={`${metrics.barotraumaClearedRate}%`}
          icon={<ShieldCheck className="w-5 h-5 text-success-500" />}
          description="Eardrum & Sinus Clearance"
        />
        <StatCard
          title="Completed HBOT Hours"
          value={metrics.completedHBOTHours}
          icon={<Clock className="w-5 h-5 text-info-500" />}
          description="Treatment Hours Logged"
        />
        <StatCard
          title="Total Scheduled Sessions"
          value={metrics.totalSessions}
          icon={<Layers className="w-5 h-5 text-warning-500" />}
          description="Chamber Bookings"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search patient name, chamber ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedIndication}
              onChange={(e) => setSelectedIndication(e.target.value)}
              options={[
                { label: "All Clinical Indications", value: "ALL" },
                { label: "Diabetic Foot Ulcer", value: "diabetic_foot_ulcer" },
                { label: "Decompression Sickness", value: "decompression_sickness" },
                { label: "Radiation Tissue Necrosis", value: "radiation_tissue_necrosis" },
                { label: "Carbon Monoxide Poisoning", value: "carbon_monoxide_poisoning" },
              ]}
            />

            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { label: "All Chamber Statuses", value: "ALL" },
                { label: "Scheduled", value: "scheduled" },
                { label: "Compressing", value: "compressing" },
                { label: "At Depth Treatment", value: "at_depth_treatment" },
                { label: "Decompressing", value: "decompressing" },
                { label: "Completed", value: "completed" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Patient Name & Indication</th>
                <th className="px-6 py-4">Chamber Unit & Pressure (ATA)</th>
                <th className="px-6 py-4">Duration & Barotrauma Clearance</th>
                <th className="px-6 py-4">Session Status & Physician</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading hyperbaric sessions...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    No hyperbaric sessions found.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold">{s.patientName}</div>
                      <Badge variant="neutral" size="sm" className="mt-0.5">{s.indication.replace(/_/g, " ")}</Badge>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-text font-medium">{s.chamberId}</div>
                      <div className="text-xs font-mono text-primary-500 font-bold mt-0.5">{s.pressureATA} ATA</div>
                    </td>

                    <td className="px-6 py-4 space-y-1">
                      <div className="text-xs font-mono text-text">{s.sessionDurationMinutes} min Oxygen Protocol</div>
                      <div>
                        {s.barotraumaSafetyCleared ? (
                          <Badge variant="success">Barotrauma Cleared</Badge>
                        ) : (
                          <Badge variant="danger">Ear Equalization Alert</Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div>{getStatusBadge(s.sessionStatus)}</div>
                      <div className="text-xs text-text-muted mt-1">{s.supervisingPhysician}</div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setActiveLogModal(s)}>
                          Dive Log
                        </Button>
                        {s.sessionStatus === "scheduled" && (
                          <Button variant="primary" size="sm" onClick={() => handleUpdateStatus(s.id, "compressing")}>
                            Compress
                          </Button>
                        )}
                        {s.sessionStatus === "compressing" && (
                          <Button variant="primary" size="sm" onClick={() => handleUpdateStatus(s.id, "at_depth_treatment")}>
                            At Depth
                          </Button>
                        )}
                        {s.sessionStatus === "at_depth_treatment" && (
                          <Button variant="secondary" size="sm" onClick={() => handleUpdateStatus(s.id, "decompressing")}>
                            Decompress
                          </Button>
                        )}
                        {s.sessionStatus === "decompressing" && (
                          <Button variant="secondary" size="sm" onClick={() => handleUpdateStatus(s.id, "completed")}>
                            Complete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dive Log Modal */}
      <Modal
        isOpen={!!activeLogModal}
        onClose={() => setActiveLogModal(null)}
        title="HBOT Dive Record & Clinical Protocol"
        description={`${activeLogModal?.chamberId} • ${activeLogModal?.patientName}`}
        size="md"
      >
        {activeLogModal && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-alt border border-border rounded-xl space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Clinical Indication:</span>
                <span className="font-semibold text-text">{activeLogModal.indication.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Chamber Pressure:</span>
                <span className="font-mono font-bold text-primary-500">{activeLogModal.pressureATA} ATA</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Oxygen Breathing Duration:</span>
                <span className="font-semibold text-text">{activeLogModal.sessionDurationMinutes} Minutes</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Supervising Physician:</span>
                <span className="font-semibold text-primary-500">{activeLogModal.supervisingPhysician}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setActiveLogModal(null)}>
                Close Log
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule HBOT Session Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule HBOT Hyperbaric Session"
        description="Book chamber bay compression & pressure protocol"
        size="lg"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Patient Full Name *</label>
            <Input
              required
              placeholder="e.g. Arthur Pendelton"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Chamber Unit ID *</label>
              <Input
                required
                value={formData.chamberId}
                onChange={(e) => setFormData({ ...formData, chamberId: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Clinical Indication</label>
              <Select
                value={formData.indication}
                onChange={(e) => setFormData({ ...formData, indication: e.target.value as any })}
                options={[
                  { label: "Diabetic Foot Ulcer", value: "diabetic_foot_ulcer" },
                  { label: "Decompression Sickness", value: "decompression_sickness" },
                  { label: "Radiation Tissue Necrosis", value: "radiation_tissue_necrosis" },
                  { label: "Carbon Monoxide Poisoning", value: "carbon_monoxide_poisoning" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Supervising Physician *"
              required
              value={formData.supervisingPhysician}
              onChange={(e) => setFormData({ ...formData, supervisingPhysician: e.target.value })}
            />
            <Input
              label="Chamber Operator *"
              required
              value={formData.chamberOperator}
              onChange={(e) => setFormData({ ...formData, chamberOperator: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Target Pressure (ATA)</label>
              <Input
                type="number"
                step="0.1"
                required
                value={formData.pressureATA}
                onChange={(e) => setFormData({ ...formData, pressureATA: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Duration (Minutes)</label>
              <Input
                type="number"
                required
                value={formData.sessionDurationMinutes}
                onChange={(e) => setFormData({ ...formData, sessionDurationMinutes: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Schedule Chamber Session
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
