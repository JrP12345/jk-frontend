"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  useToast,
  EmptyState,
} from "@/components/ui";
import {
  UserX,
  ThermometerSnowflake,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  RefreshCw,
  FileCheck,
  Building,
} from "lucide-react";

interface MortuaryEntry {
  id: string;
  tagNumber: string;
  deceasedName: string;
  age: number;
  gender: "male" | "female" | "other";
  dateOfDeath: string;
  causeOfDeath: string;
  deathCertificateNumber?: string;
  mortuaryCompartment: string;
  temperatureCelsius: number;
  autopsyRequired: boolean;
  autopsyStatus: "not_required" | "scheduled" | "in_progress" | "completed";
  releaseStatus: "admitted" | "pending_autopsy" | "pending_clearance" | "released_to_kin" | "transferred_to_coroner";
  nextOfKinName?: string;
  nextOfKinContact?: string;
  releasedDate?: string;
  notes?: string;
}

interface Metrics {
  totalEntries: number;
  currentOccupancy: number;
  autopsiesPending: number;
  certificatesIssued: number;
  releasedCount: number;
}

export default function MortuaryManagementPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<MortuaryEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalEntries: 0,
    currentOccupancy: 0,
    autopsiesPending: 0,
    certificatesIssued: 0,
    releasedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReleaseStatus, setSelectedReleaseStatus] = useState("ALL");
  const [selectedAutopsyStatus, setSelectedAutopsyStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tagNumber: "",
    deceasedName: "",
    age: 58,
    gender: "male",
    dateOfDeath: new Date().toISOString().split("T")[0],
    causeOfDeath: "Acute Cardiorespiratory Arrest",
    deathCertificateNumber: "",
    mortuaryCompartment: "Cold Bay B-04",
    temperatureCelsius: -4.0,
    autopsyRequired: false,
    autopsyStatus: "not_required",
    releaseStatus: "admitted",
    nextOfKinName: "",
    nextOfKinContact: "",
    notes: "",
  });

  useEffect(() => {
    fetchEntries();
  }, [selectedReleaseStatus, selectedAutopsyStatus]);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedReleaseStatus !== "ALL") queryParams.append("releaseStatus", selectedReleaseStatus);
      if (selectedAutopsyStatus !== "ALL") queryParams.append("autopsyStatus", selectedAutopsyStatus);

      const res = await api.get(`/mortuary?${queryParams.toString()}`);

      if (res.data && res.data.success) {
        setEntries(res.data.data.entries || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching mortuary entries:", err);
      toast({
        title: "Error Loading Mortuary Logs",
        description: err.response?.data?.message || "Failed to fetch mortuary & deceased records",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdmitDeceased = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/mortuary", formData);

      if (res.data && res.data.success) {
        toast({
          title: "Deceased Record Logged",
          description: `Admitted ${formData.deceasedName} to mortuary compartment ${formData.mortuaryCompartment}`,
          variant: "success",
        });
        setIsAdmitModalOpen(false);
        setFormData({
          tagNumber: "",
          deceasedName: "",
          age: 58,
          gender: "male",
          dateOfDeath: new Date().toISOString().split("T")[0],
          causeOfDeath: "Acute Cardiorespiratory Arrest",
          deathCertificateNumber: "",
          mortuaryCompartment: "Cold Bay B-04",
          temperatureCelsius: -4.0,
          autopsyRequired: false,
          autopsyStatus: "not_required",
          releaseStatus: "admitted",
          nextOfKinName: "",
          nextOfKinContact: "",
          notes: "",
        });
        fetchEntries();
      }
    } catch (err: any) {
      console.error("Error admitting deceased:", err);
      toast({
        title: "Admission Failed",
        description: err.response?.data?.message || "Failed to admit deceased record",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, updates: Partial<MortuaryEntry>) => {
    try {
      const res = await api.patch(`/mortuary/${id}/status`, updates);
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: "Mortuary record release status updated successfully.",
          variant: "success",
        });
        fetchEntries();
      }
    } catch (err: any) {
      console.error("Error updating mortuary status:", err);
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update mortuary status",
        variant: "error",
      });
    }
  };

  const filteredEntries = entries.filter(
    (e) =>
      e.deceasedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.mortuaryCompartment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.causeOfDeath.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getReleaseBadge = (status: string) => {
    switch (status) {
      case "released_to_kin":
        return <Badge variant="success" dot><CheckCircle2 className="w-3 h-3 mr-1 inline" /> Released to Kin</Badge>;
      case "pending_autopsy":
        return <Badge variant="warning"><Clock className="w-3 h-3 mr-1 inline" /> Pending Autopsy</Badge>;
      case "transferred_to_coroner":
        return <Badge variant="danger"><ShieldAlert className="w-3 h-3 mr-1 inline" /> Coroner Transfer</Badge>;
      default:
        return <Badge variant="info"><Building className="w-3 h-3 mr-1 inline" /> In Mortuary</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Mortuary & Deceased Patient Management Desk
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Deceased patient admissions, cold compartment bay tracking, autopsy clearance & death certificate release
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchEntries} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsAdmitModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Admit Deceased Record
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Mortuary Occupancy"
          value={metrics.currentOccupancy}
          icon={<ThermometerSnowflake className="w-5 h-5 text-primary-500" />}
          description="Bays Occupied Currently"
        />
        <StatCard
          title="Autopsies Pending"
          value={metrics.autopsiesPending}
          icon={<ShieldAlert className="w-5 h-5 text-warning-500" />}
          description="Forensic Pathology Queue"
        />
        <StatCard
          title="Death Certificates Issued"
          value={metrics.certificatesIssued}
          icon={<FileCheck className="w-5 h-5 text-info-500" />}
          description="Legal Clearance Completed"
        />
        <StatCard
          title="Released to Kin"
          value={metrics.releasedCount}
          icon={<CheckCircle2 className="w-5 h-5 text-success-500" />}
          description="Transferred to Next of Kin"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search deceased name, tag #, compartment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedReleaseStatus}
              onChange={(e) => setSelectedReleaseStatus(e.target.value)}
              options={[
                { label: "All Release Statuses", value: "ALL" },
                { label: "Admitted In Bay", value: "admitted" },
                { label: "Pending Autopsy", value: "pending_autopsy" },
                { label: "Pending Police Clearance", value: "pending_clearance" },
                { label: "Released to Kin", value: "released_to_kin" },
                { label: "Transferred to Coroner", value: "transferred_to_coroner" },
              ]}
            />

            <Select
              value={selectedAutopsyStatus}
              onChange={(e) => setSelectedAutopsyStatus(e.target.value)}
              options={[
                { label: "All Autopsy Requirements", value: "ALL" },
                { label: "Not Required", value: "not_required" },
                { label: "Scheduled", value: "scheduled" },
                { label: "In Progress", value: "in_progress" },
                { label: "Completed", value: "completed" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Mortuary Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Tag # & Deceased Name</th>
                <th className="px-6 py-4">Age / Gender</th>
                <th className="px-6 py-4">Date & Cause of Death</th>
                <th className="px-6 py-4">Compartment & Temp</th>
                <th className="px-6 py-4">Autopsy Status</th>
                <th className="px-6 py-4">Release Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading mortuary records...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={<UserX className="w-8 h-8 text-text-muted" />}
                      title="No Mortuary Records Found"
                      description="No deceased patient records match your selected filters."
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsAdmitModalOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" /> Admit Deceased Record
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold">{e.deceasedName}</div>
                      <div className="text-xs font-mono text-primary-600 dark:text-primary-400">{e.tagNumber}</div>
                    </td>

                    <td className="px-6 py-4 text-text font-medium">
                      {e.age} Yrs • <span className="capitalize">{e.gender}</span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-text">{e.causeOfDeath}</div>
                      <div className="text-xs text-text-muted font-mono">
                        {new Date(e.dateOfDeath).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-medium text-text">{e.mortuaryCompartment}</div>
                      <div className="text-xs font-mono text-info-500">{e.temperatureCelsius}°C</div>
                    </td>

                    <td className="px-6 py-4">
                      <Badge variant={e.autopsyStatus === "completed" ? "success" : e.autopsyStatus === "scheduled" ? "warning" : "neutral"} size="sm">
                        <span className="capitalize">{e.autopsyStatus.replace('_', ' ')}</span>
                      </Badge>
                    </td>

                    <td className="px-6 py-4">{getReleaseBadge(e.releaseStatus)}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {e.releaseStatus !== "released_to_kin" && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleUpdateStatus(e.id, { releaseStatus: "released_to_kin", releasedDate: new Date().toISOString() })}
                          >
                            Release to Kin
                          </Button>
                        )}
                        {e.releaseStatus === "admitted" && (
                          <Button
                            variant="warning"
                            size="sm"
                            onClick={() => handleUpdateStatus(e.id, { releaseStatus: "pending_autopsy" })}
                          >
                            Flag Autopsy
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

      {/* Admit Deceased Modal */}
      <Modal
        isOpen={isAdmitModalOpen}
        onClose={() => setIsAdmitModalOpen(false)}
        title="Admit Deceased Patient Record"
        description="Record mortuary admission, compartment bay assignment, cause of death and autopsy requirement"
        size="lg"
      >
        <form onSubmit={handleAdmitDeceased} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Deceased Full Name *</label>
            <Input
              required
              placeholder="e.g. Jonathan Miller"
              value={formData.deceasedName}
              onChange={(e) => setFormData({ ...formData, deceasedName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tag # (Optional)</label>
              <Input
                placeholder="MORT-TAG-901"
                value={formData.tagNumber}
                onChange={(e) => setFormData({ ...formData, tagNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Age *</label>
              <Input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Gender</label>
              <Select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                options={[
                  { label: "Male", value: "male" },
                  { label: "Female", value: "female" },
                  { label: "Other", value: "other" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Primary Cause of Death *</label>
            <Input
              required
              placeholder="e.g. Acute Myocardial Infarction"
              value={formData.causeOfDeath}
              onChange={(e) => setFormData({ ...formData, causeOfDeath: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Mortuary Bay Compartment</label>
              <Select
                value={formData.mortuaryCompartment}
                onChange={(e) => setFormData({ ...formData, mortuaryCompartment: e.target.value })}
                options={[
                  { label: "Cold Bay A-01", value: "Cold Bay A-01" },
                  { label: "Cold Bay A-02", value: "Cold Bay A-02" },
                  { label: "Cold Bay B-04", value: "Cold Bay B-04" },
                  { label: "Cold Bay C-10", value: "Cold Bay C-10" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Bay Temp (°C)</label>
              <Input
                type="number"
                step="0.1"
                value={formData.temperatureCelsius}
                onChange={(e) => setFormData({ ...formData, temperatureCelsius: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Next of Kin Name</label>
              <Input
                placeholder="e.g. Patricia Miller"
                value={formData.nextOfKinName}
                onChange={(e) => setFormData({ ...formData, nextOfKinName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Next of Kin Contact</label>
              <Input
                placeholder="e.g. 9876543210"
                value={formData.nextOfKinContact}
                onChange={(e) => setFormData({ ...formData, nextOfKinContact: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsAdmitModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Admit Deceased
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
