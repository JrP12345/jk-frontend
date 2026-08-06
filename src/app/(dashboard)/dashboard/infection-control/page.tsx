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
  ShieldAlert,
  Biohazard,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  Flame,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

interface InfectionIncident {
  id: string;
  patientName: string;
  ward: string;
  pathogenName: string;
  infectionType: "HAI_CLABSI" | "HAI_CAUTI" | "HAI_VAP" | "HAI_SSI" | "COMMUNITY_ACQUIRED" | "OUTBREAK_CLUSTER";
  isolationStatus: "none" | "contact_isolation" | "droplet_isolation" | "airborne_isolation" | "strict_quarantine";
  riskLevel: "low" | "moderate" | "high" | "critical";
  detectionDate: string;
  status: "suspected" | "confirmed_active" | "cleared" | "quarantined";
  antimicrobialRegimen?: string;
  environmentalSanitizationDone: boolean;
  notes?: string;
}

interface Metrics {
  totalIncidents: number;
  totalActive: number;
  activeIsolationCount: number;
  criticalRiskCount: number;
  sanitizationCompleted: number;
  haiCount: number;
  haiRatePercentage: string;
}

export default function InfectionControlPage() {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<InfectionIncident[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalIncidents: 0,
    totalActive: 0,
    activeIsolationCount: 0,
    criticalRiskCount: 0,
    sanitizationCompleted: 0,
    haiCount: 0,
    haiRatePercentage: "0.0%",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWard, setSelectedWard] = useState("ALL");
  const [selectedInfectionType, setSelectedInfectionType] = useState("ALL");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeDetailModal, setActiveDetailModal] = useState<InfectionIncident | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    patientName: "",
    ward: "ICU Ward A",
    pathogenName: "",
    infectionType: "HAI_CLABSI",
    isolationStatus: "contact_isolation",
    riskLevel: "high",
    antimicrobialRegimen: "",
    notes: "",
  });

  useEffect(() => {
    fetchIncidents();
  }, [selectedWard, selectedInfectionType, selectedRiskLevel]);

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedWard !== "ALL") queryParams.append("ward", selectedWard);
      if (selectedInfectionType !== "ALL") queryParams.append("infectionType", selectedInfectionType);
      if (selectedRiskLevel !== "ALL") queryParams.append("riskLevel", selectedRiskLevel);

      const res = await api.get(`/infection-control?${queryParams.toString()}`);
      if (res.data && res.data.success) {
        setIncidents(res.data.data.incidents || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching infection control incidents:", err);
      toast({
        title: "Error Loading Surveillance Data",
        description: err.response?.data?.message || "Failed to fetch infection incidents",
        variant: "error",
      });
      setIncidents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/infection-control", formData);
      if (res.data && res.data.success) {
        toast({
          title: "Incident Logged",
          description: `Logged infection surveillance case for ${formData.patientName}`,
          variant: "success",
        });
        setIsLogModalOpen(false);
        fetchIncidents();
      }
    } catch (err: any) {
      toast({
        title: "Logging Failed",
        description: err.response?.data?.message || "Failed to log infection incident",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(`/infection-control/${id}/status`, { status: newStatus });
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: `Infection incident status changed to ${newStatus}`,
          variant: "success",
        });
        fetchIncidents();
      }
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update incident status",
        variant: "error",
      });
    }
  };

  const filteredIncidents = incidents.filter(
    (i) =>
      i.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.pathogenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.ward.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "critical":
        return <Badge variant="danger" dot pulse>CRITICAL RISK</Badge>;
      case "high":
        return <Badge variant="danger">High Risk</Badge>;
      case "moderate":
        return <Badge variant="warning">Moderate Risk</Badge>;
      default:
        return <Badge variant="success">Low Risk</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed_active":
        return <Badge variant="danger" dot pulse>Confirmed Active</Badge>;
      case "quarantined":
        return <Badge variant="warning">Quarantined</Badge>;
      case "cleared":
        return <Badge variant="success">Cleared</Badge>;
      default:
        return <Badge variant="neutral">Suspected</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Infection Control & Outbreak Surveillance Desk
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            HAI surveillance (CLABSI/CAUTI/VAP/SSI), pathogen isolation, risk stratification & environmental sanitization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchIncidents} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="danger" onClick={() => setIsLogModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Log Infection Case
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Infection Cases"
          value={metrics.totalActive}
          icon={<Biohazard className="w-5 h-5 text-danger-500" />}
          description="Confirmed Active Cases"
        />
        <StatCard
          title="Patients in Isolation"
          value={metrics.activeIsolationCount}
          icon={<ShieldAlert className="w-5 h-5 text-warning-500" />}
          description="Contact / Airborne Isolation"
        />
        <StatCard
          title="Critical Risk Outbreaks"
          value={metrics.criticalRiskCount}
          icon={<Flame className="w-5 h-5 text-danger-500" />}
          description="Requires Outbreak Protocol"
        />
        <StatCard
          title="Sanitization Completed"
          value={metrics.sanitizationCompleted}
          icon={<ShieldCheck className="w-5 h-5 text-success-500" />}
          description="Terminal UV Disinfected"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search patient, pathogen, ward..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              options={[
                { label: "All Wards", value: "ALL" },
                { label: "ICU Ward A", value: "ICU Ward A" },
                { label: "General Ward B", value: "General Ward B" },
                { label: "Pediatrics Ward C", value: "Pediatrics Ward C" },
                { label: "Surgical Recovery", value: "Surgical Recovery" },
              ]}
            />

            <Select
              value={selectedInfectionType}
              onChange={(e) => setSelectedInfectionType(e.target.value)}
              options={[
                { label: "All Infection Types", value: "ALL" },
                { label: "HAI - CLABSI", value: "HAI_CLABSI" },
                { label: "HAI - CAUTI", value: "HAI_CAUTI" },
                { label: "HAI - VAP", value: "HAI_VAP" },
                { label: "HAI - SSI", value: "HAI_SSI" },
                { label: "Community Acquired", value: "COMMUNITY_ACQUIRED" },
                { label: "Outbreak Cluster", value: "OUTBREAK_CLUSTER" },
              ]}
            />

            <Select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              options={[
                { label: "All Risk Levels", value: "ALL" },
                { label: "Critical", value: "critical" },
                { label: "High", value: "high" },
                { label: "Moderate", value: "moderate" },
                { label: "Low", value: "low" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Incidents Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Patient Name & Ward</th>
                <th className="px-6 py-4">Pathogen & Infection Type</th>
                <th className="px-6 py-4">Isolation & Risk Level</th>
                <th className="px-6 py-4">Status & Regimen</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading infection control incidents...
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    No infection control incidents found.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((i) => (
                  <tr key={i.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold">{i.patientName}</div>
                      <div className="text-xs text-text-muted">{i.ward}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-text font-semibold">{i.pathogenName}</div>
                      <Badge variant="neutral" size="sm" className="mt-0.5">{i.infectionType.replace(/_/g, " ")}</Badge>
                    </td>

                    <td className="px-6 py-4 space-y-1">
                      <div>{getRiskBadge(i.riskLevel)}</div>
                      <div className="text-xs text-text-muted font-mono">{i.isolationStatus.replace(/_/g, " ")}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div>{getStatusBadge(i.status)}</div>
                      {i.antimicrobialRegimen && (
                        <div className="text-xs text-text-muted mt-1 truncate max-w-xs" title={i.antimicrobialRegimen}>
                          💊 {i.antimicrobialRegimen}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setActiveDetailModal(i)}>
                          Details
                        </Button>
                        {i.status === "confirmed_active" && (
                          <Button variant="success" size="sm" onClick={() => handleUpdateStatus(i.id, "cleared")}>
                            Mark Cleared
                          </Button>
                        )}
                        {i.status === "suspected" && (
                          <Button variant="danger" size="sm" onClick={() => handleUpdateStatus(i.id, "confirmed_active")}>
                            Confirm Active
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

      {/* Incident Detail Modal */}
      <Modal
        isOpen={!!activeDetailModal}
        onClose={() => setActiveDetailModal(null)}
        title="Infection Surveillance Case Details"
        description={`${activeDetailModal?.ward} • ${activeDetailModal?.patientName}`}
        size="md"
      >
        {activeDetailModal && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-alt border border-border rounded-xl space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Pathogen Organism:</span>
                <span className="font-semibold text-danger-500">{activeDetailModal.pathogenName}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Infection Classification:</span>
                <span className="font-semibold text-text">{activeDetailModal.infectionType.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Isolation Protocol:</span>
                <span className="font-semibold text-warning-500">{activeDetailModal.isolationStatus.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Antimicrobial Regimen:</span>
                <span className="font-mono text-text">{activeDetailModal.antimicrobialRegimen || "None Specified"}</span>
              </div>
            </div>

            {activeDetailModal.notes && (
              <div className="p-3 bg-primary-500/10 border border-primary-500/20 rounded-xl">
                <span className="text-xs font-bold uppercase text-primary-600 dark:text-primary-400">Epidemiologist Surveillance Notes:</span>
                <p className="text-xs text-text mt-1">{activeDetailModal.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setActiveDetailModal(null)}>
                Close Details
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Log Infection Incident Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Log Infection Control Incident"
        description="Record HAI surveillance case, pathogen & isolation protocol"
        size="lg"
      >
        <form onSubmit={handleCreateIncident} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Patient Name / Bed *</label>
            <Input
              required
              placeholder="e.g. Patient John Doe (Bed 12)"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Ward Location *</label>
              <Select
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                options={[
                  { label: "ICU Ward A", value: "ICU Ward A" },
                  { label: "General Ward B", value: "General Ward B" },
                  { label: "Pediatrics Ward C", value: "Pediatrics Ward C" },
                  { label: "Surgical Recovery", value: "Surgical Recovery" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Pathogen Organism *</label>
              <Input
                required
                placeholder="e.g. MRSA / C. difficile / Pseudomonas"
                value={formData.pathogenName}
                onChange={(e) => setFormData({ ...formData, pathogenName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Infection Type</label>
              <Select
                value={formData.infectionType}
                onChange={(e) => setFormData({ ...formData, infectionType: e.target.value as any })}
                options={[
                  { label: "HAI - CLABSI", value: "HAI_CLABSI" },
                  { label: "HAI - CAUTI", value: "HAI_CAUTI" },
                  { label: "HAI - VAP", value: "HAI_VAP" },
                  { label: "HAI - SSI", value: "HAI_SSI" },
                  { label: "Community Acquired", value: "COMMUNITY_ACQUIRED" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Isolation Status</label>
              <Select
                value={formData.isolationStatus}
                onChange={(e) => setFormData({ ...formData, isolationStatus: e.target.value as any })}
                options={[
                  { label: "Contact Isolation", value: "contact_isolation" },
                  { label: "Droplet Isolation", value: "droplet_isolation" },
                  { label: "Airborne Isolation", value: "airborne_isolation" },
                  { label: "Strict Quarantine", value: "strict_quarantine" },
                  { label: "None Required", value: "none" },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsLogModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit">
              Log Infection Case
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
