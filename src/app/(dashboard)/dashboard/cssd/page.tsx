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
  ShieldCheck,
  Flame,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  RefreshCw,
  Box,
  Truck,
  RotateCcw,
} from "lucide-react";

interface SterileTrayLog {
  id: string;
  trayBarcode: string;
  trayName: string;
  autoclaveUnitId: string;
  sterilizationCycleNo: string;
  sterilizationMethod: "steam_autoclave" | "ethylene_oxide" | "hydrogen_peroxide_plasma" | "dry_heat";
  biologicalIndicatorStatus: "passed" | "failed" | "incubation_pending";
  chemicalIndicatorColor: "black_pass" | "brown_fail" | "unprocessed";
  sterilizationDate: string;
  expirationDate: string;
  status: "decontamination" | "packing" | "sterilizing" | "sterile_storage" | "issued_to_or" | "expired";
  targetDepartment: string;
  technicianName: string;
  notes?: string;
}

interface Metrics {
  totalPacks: number;
  activeAutoclaveRuns: number;
  indicatorPassRateRate: number;
  issuedToOr: number;
}

export default function CssdOperationsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SterileTrayLog[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalPacks: 0,
    activeAutoclaveRuns: 0,
    indicatorPassRateRate: 100,
    issuedToOr: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedIndicator, setSelectedIndicator] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    trayBarcode: "",
    trayName: "",
    autoclaveUnitId: "",
    sterilizationCycleNo: "",
    sterilizationMethod: "steam_autoclave",
    biologicalIndicatorStatus: "passed",
    chemicalIndicatorColor: "black_pass",
    expirationDays: 30,
    status: "sterile_storage",
    targetDepartment: "",
    technicianName: "",
    notes: "",
  });

  useEffect(() => {
    fetchLogs();
  }, [selectedStatus, selectedIndicator]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedStatus !== "ALL") queryParams.append("status", selectedStatus);
      if (selectedIndicator !== "ALL") queryParams.append("biologicalIndicatorStatus", selectedIndicator);

      const res = await api.get(`/cssd?${queryParams.toString()}`);

      if (res.data && res.data.success) {
        setLogs(res.data.data.logs || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching CSSD logs:", err);
      toast({
        title: "Error Loading CSSD Logs",
        description: err.response?.data?.message || "Failed to fetch CSSD sterile tray logs",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/cssd", formData);

      if (res.data && res.data.success) {
        toast({
          title: "Sterile Batch Logged",
          description: `Logged sterile pack ${formData.trayName} (${formData.trayBarcode || 'Auto-Barcode'})`,
          variant: "success",
        });
        setIsLogModalOpen(false);
        setFormData({
          trayBarcode: "",
          trayName: "",
          autoclaveUnitId: "",
          sterilizationCycleNo: "",
          sterilizationMethod: "steam_autoclave",
          biologicalIndicatorStatus: "passed",
          chemicalIndicatorColor: "black_pass",
          expirationDays: 30,
          status: "sterile_storage",
          targetDepartment: "",
          technicianName: "",
          notes: "",
        });
        fetchLogs();
      }
    } catch (err: any) {
      console.error("Error creating CSSD log:", err);
      toast({
        title: "Logging Failed",
        description: err.response?.data?.message || "Failed to log sterile tray batch",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, updates: Partial<SterileTrayLog>) => {
    try {
      const res = await api.patch(`/cssd/${id}/status`, updates);
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: "CSSD tray sterilization status updated successfully.",
          variant: "success",
        });
        fetchLogs();
      }
    } catch (err: any) {
      console.error("Error updating CSSD tray status:", err);
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update tray status",
        variant: "error",
      });
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.trayBarcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.trayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.sterilizationCycleNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.technicianName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.targetDepartment.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "issued_to_or":
        return <Badge variant="success" dot><Truck className="w-3 h-3 mr-1 inline" /> Issued to OR</Badge>;
      case "sterile_storage":
        return <Badge variant="info"><Box className="w-3 h-3 mr-1 inline" /> Sterile Storage</Badge>;
      case "sterilizing":
        return <Badge variant="warning"><Flame className="w-3 h-3 mr-1 inline" /> Autoclaving Run</Badge>;
      case "decontamination":
        return <Badge variant="primary"><RotateCcw className="w-3 h-3 mr-1 inline" /> Decontamination</Badge>;
      default:
        return <Badge variant="neutral">Packing & Prep</Badge>;
    }
  };

  const getBiologicalBadge = (bioStatus: string) => {
    switch (bioStatus) {
      case "passed":
        return <Badge variant="success" size="sm">Bio Pass</Badge>;
      case "failed":
        return <Badge variant="danger" size="sm">Bio Fail</Badge>;
      default:
        return <Badge variant="warning" size="sm">Incubation Pending</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Central Sterile Services Department (CSSD) & Autoclave Ops
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Surgical tray sterilization logs, autoclave biological indicator tests & sterile pack OR distribution
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchLogs} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsLogModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Log Autoclave Batch
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Processed Packs"
          value={metrics.totalPacks}
          icon={<Box className="w-5 h-5 text-primary-500" />}
          description="Trays In System"
        />
        <StatCard
          title="Active Autoclave Runs"
          value={metrics.activeAutoclaveRuns}
          icon={<Flame className="w-5 h-5 text-warning-500" />}
          description="Cycles In Progress"
        />
        <StatCard
          title="Bio Indicator Pass Rate"
          value={`${metrics.indicatorPassRateRate}%`}
          icon={<CheckCircle2 className="w-5 h-5 text-success-500" />}
          description="Geobacillus Spore Tests"
        />
        <StatCard
          title="Issued to OR Suites"
          value={metrics.issuedToOr}
          icon={<Truck className="w-5 h-5 text-info-500" />}
          description="Active Surgical Cases"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search barcode, tray name, cycle #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { label: "All Tray Statuses", value: "ALL" },
                { label: "Decontamination", value: "decontamination" },
                { label: "Packing & Prep", value: "packing" },
                { label: "Autoclaving Run", value: "sterilizing" },
                { label: "Sterile Storage", value: "sterile_storage" },
                { label: "Issued to OR", value: "issued_to_or" },
                { label: "Expired", value: "expired" },
              ]}
            />

            <Select
              value={selectedIndicator}
              onChange={(e) => setSelectedIndicator(e.target.value)}
              options={[
                { label: "All Biological Indicators", value: "ALL" },
                { label: "Passed", value: "passed" },
                { label: "Failed", value: "failed" },
                { label: "Incubation Pending", value: "incubation_pending" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* CSSD Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Barcode & Tray Name</th>
                <th className="px-6 py-4">Autoclave Bay & Cycle</th>
                <th className="px-6 py-4">Method & Indicators</th>
                <th className="px-6 py-4">Target Department</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading CSSD tray logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    <EmptyState
                      icon={<ShieldCheck className="w-8 h-8 text-text-muted" />}
                      title="No CSSD Trays Found"
                      description="No sterile tray sterilization records match your selected filters."
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsLogModalOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" /> Log Autoclave Batch
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold">{l.trayName}</div>
                      <div className="text-xs font-mono text-primary-600 dark:text-primary-400">{l.trayBarcode}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-text">{l.autoclaveUnitId}</div>
                      <div className="text-xs text-text-muted font-mono">{l.sterilizationCycleNo}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="capitalize text-text font-medium">{l.sterilizationMethod.replace('_', ' ')}</div>
                      <div className="mt-1">{getBiologicalBadge(l.biologicalIndicatorStatus)}</div>
                    </td>

                    <td className="px-6 py-4 text-text font-medium">{l.targetDepartment}</td>

                    <td className="px-6 py-4">{getStatusBadge(l.status)}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {l.status === "sterile_storage" && (
                          <Button variant="success" size="sm" onClick={() => handleUpdateStatus(l.id, { status: "issued_to_or" })}>
                            Dispatch to OR
                          </Button>
                        )}
                        {l.status === "decontamination" && (
                          <Button variant="warning" size="sm" onClick={() => handleUpdateStatus(l.id, { status: "sterilizing" })}>
                            Run Sterilizer
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

      {/* Log Batch Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Log Autoclave Sterilization Batch"
        description="Record tray barcode, autoclave unit cycle, indicator results and expiration date"
        size="lg"
      >
        <form onSubmit={handleCreateBatch} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tray / Pack Name *</label>
            <Input
              required
              placeholder="e.g. Major Orthopedic Joint Replacement Set #4"
              value={formData.trayName}
              onChange={(e) => setFormData({ ...formData, trayName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tray Barcode (Optional)</label>
              <Input
                placeholder="TRAY-SURG-9001"
                value={formData.trayBarcode}
                onChange={(e) => setFormData({ ...formData, trayBarcode: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Autoclave Unit ID</label>
              <Input
                value={formData.autoclaveUnitId}
                onChange={(e) => setFormData({ ...formData, autoclaveUnitId: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Sterilization Method</label>
              <Select
                value={formData.sterilizationMethod}
                onChange={(e) => setFormData({ ...formData, sterilizationMethod: e.target.value as any })}
                options={[
                  { label: "Steam Autoclave (134°C)", value: "steam_autoclave" },
                  { label: "Ethylene Oxide (EtO)", value: "ethylene_oxide" },
                  { label: "Hydrogen Peroxide Plasma", value: "hydrogen_peroxide_plasma" },
                  { label: "Dry Heat Sterilization", value: "dry_heat" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Target Department / OR</label>
              <Input
                value={formData.targetDepartment}
                onChange={(e) => setFormData({ ...formData, targetDepartment: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Biological Indicator Status</label>
              <Select
                value={formData.biologicalIndicatorStatus}
                onChange={(e) => setFormData({ ...formData, biologicalIndicatorStatus: e.target.value as any })}
                options={[
                  { label: "Passed (No Spore Growth)", value: "passed" },
                  { label: "Failed (Spore Growth)", value: "failed" },
                  { label: "24h Incubation Pending", value: "incubation_pending" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Technician Name</label>
              <Input
                value={formData.technicianName}
                onChange={(e) => setFormData({ ...formData, technicianName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsLogModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Log Batch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
