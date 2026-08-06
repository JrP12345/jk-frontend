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
  Biohazard,
  Flame,
  ShieldCheck,
  Truck,
  Scale,
  Plus,
  Search,
  RefreshCw,
  Clock,
} from "lucide-react";

interface BiohazardLog {
  id: string;
  manifestNumber: string;
  wasteCategory: "yellow_pathological" | "red_soiled_plastics" | "white_sharps" | "blue_glassware" | "cytotoxic";
  weightKg: number;
  originDepartment: string;
  disposalMethod: "autoclaving" | "incineration" | "chemical_disinfection" | "secure_landfill" | "recycling_vendor";
  status: "collected" | "stored_in_holding" | "transported" | "processed_disposed";
  disposalVendor: string;
  loggedBy: string;
  disposedDate?: string;
  createdAt?: string;
  notes?: string;
}

interface Metrics {
  totalLogs: number;
  totalMassKg: number;
  holdingMassKg: number;
  incinerationMassKg: number;
  completedDisposalsCount: number;
}

export default function BiohazardManagementPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<BiohazardLog[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalLogs: 0,
    totalMassKg: 0,
    holdingMassKg: 0,
    incinerationMassKg: 0,
    completedDisposalsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    manifestNumber: "",
    wasteCategory: "yellow_pathological",
    weightKg: 28.4,
    originDepartment: "Central Surgical Suite",
    disposalMethod: "incineration",
    status: "collected",
    disposalVendor: "",
    loggedBy: "Officer Marcus Vance",
    notes: "",
  });

  useEffect(() => {
    fetchLogs();
  }, [selectedCategory, selectedStatus]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedCategory !== "ALL") queryParams.append("wasteCategory", selectedCategory);
      if (selectedStatus !== "ALL") queryParams.append("status", selectedStatus);

      const res = await api.get(`/biohazard?${queryParams.toString()}`);

      if (res.data && res.data.success) {
        setLogs(res.data.data.logs || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching biohazard waste logs:", err);
      toast({
        title: "Error Loading Manifests",
        description: err.response?.data?.message || "Failed to fetch biohazard waste manifests",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/biohazard", formData);

      if (res.data && res.data.success) {
        toast({
          title: "Biohazard Manifest Logged",
          description: `Logged manifest ${formData.manifestNumber || 'Auto-Manifest'} (${formData.weightKg} kg)`,
          variant: "success",
        });
        setIsLogModalOpen(false);
        setFormData({
          manifestNumber: "",
          wasteCategory: "yellow_pathological",
          weightKg: 28.4,
          originDepartment: "Central Surgical Suite",
          disposalMethod: "incineration",
          status: "collected",
          disposalVendor: "",
          loggedBy: "Officer Marcus Vance",
          notes: "",
        });
        fetchLogs();
      }
    } catch (err: any) {
      console.error("Error logging waste manifest:", err);
      toast({
        title: "Logging Failed",
        description: err.response?.data?.message || "Failed to log biohazard waste manifest",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(`/biohazard/${id}/status`, { status: newStatus });
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: `Biohazard manifest status changed to ${newStatus}`,
          variant: "success",
        });
        fetchLogs();
      }
    } catch (err: any) {
      console.error("Error updating biohazard status:", err);
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update manifest status",
        variant: "error",
      });
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.manifestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.originDepartment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.disposalVendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.loggedBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "yellow_pathological":
        return <Badge variant="warning">Yellow Pathological</Badge>;
      case "red_soiled_plastics":
        return <Badge variant="danger">Red Soiled Plastics</Badge>;
      case "white_sharps":
        return <Badge variant="neutral">White Sharps</Badge>;
      case "blue_glassware":
        return <Badge variant="info">Blue Glassware</Badge>;
      case "cytotoxic":
        return <Badge variant="primary">Purple Cytotoxic</Badge>;
      default:
        return <Badge variant="neutral">Biohazard</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed_disposed":
        return <Badge variant="success" dot><ShieldCheck className="w-3 h-3 mr-1 inline" /> Disposed</Badge>;
      case "transported":
        return <Badge variant="info"><Truck className="w-3 h-3 mr-1 inline" /> In Transit</Badge>;
      case "stored_in_holding":
        return <Badge variant="warning"><Clock className="w-3 h-3 mr-1 inline" /> In Holding Bay</Badge>;
      default:
        return <Badge variant="neutral"><Biohazard className="w-3 h-3 mr-1 inline" /> Collected</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Environmental Health & Biohazard Waste Desk
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Hazardous medical waste manifests, sharps container recycling, incinerator logging & EPA compliance tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchLogs} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsLogModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Log Waste Collection Manifest
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Mass Logged"
          value={`${metrics.totalMassKg} kg`}
          icon={<Scale className="w-5 h-5 text-warning-500" />}
          description="Cumulative Waste Collected"
        />
        <StatCard
          title="Mass in Holding Bay"
          value={`${metrics.holdingMassKg} kg`}
          icon={<Clock className="w-5 h-5 text-primary-500" />}
          description="Pending Vendor Transport"
        />
        <StatCard
          title="Incineration Volume"
          value={`${metrics.incinerationMassKg} kg`}
          icon={<Flame className="w-5 h-5 text-danger-500" />}
          description="High-Temp Destruction"
        />
        <StatCard
          title="Completed Disposals"
          value={metrics.completedDisposalsCount}
          icon={<ShieldCheck className="w-5 h-5 text-success-500" />}
          description="EPA Compliant Manifests"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search manifest #, origin, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { label: "All Waste Categories", value: "ALL" },
                { label: "Yellow Pathological", value: "yellow_pathological" },
                { label: "Red Soiled Plastics", value: "red_soiled_plastics" },
                { label: "White Sharps Container", value: "white_sharps" },
                { label: "Blue Glassware", value: "blue_glassware" },
                { label: "Purple Cytotoxic", value: "cytotoxic" },
              ]}
            />

            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { label: "All Manifest Statuses", value: "ALL" },
                { label: "Collected", value: "collected" },
                { label: "Stored in Holding", value: "stored_in_holding" },
                { label: "Transported", value: "transported" },
                { label: "Processed & Disposed", value: "processed_disposed" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Biohazard Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Manifest # & Category</th>
                <th className="px-6 py-4">Weight (kg)</th>
                <th className="px-6 py-4">Origin Department</th>
                <th className="px-6 py-4">Disposal Method</th>
                <th className="px-6 py-4">Vendor & Officer</th>
                <th className="px-6 py-4">Manifest Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading biohazard waste manifests...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={<Biohazard className="w-8 h-8 text-text-muted" />}
                      title="No Manifests Found"
                      description="No biohazard waste collection manifests match your selected filters."
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsLogModalOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" /> Log Collection Manifest
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold text-primary-600 dark:text-primary-400 font-mono">{l.manifestNumber}</div>
                      <div className="mt-1">{getCategoryBadge(l.wasteCategory)}</div>
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-text">
                      {l.weightKg} kg
                    </td>

                    <td className="px-6 py-4 text-text font-medium">{l.originDepartment}</td>

                    <td className="px-6 py-4 capitalize text-text font-medium">{l.disposalMethod.replace('_', ' ')}</td>

                    <td className="px-6 py-4">
                      <div className="text-text font-medium">{l.disposalVendor}</div>
                      <div className="text-xs text-text-muted">{l.loggedBy}</div>
                    </td>

                    <td className="px-6 py-4">{getStatusBadge(l.status)}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {l.status === "collected" && (
                          <Button variant="warning" size="sm" onClick={() => handleUpdateStatus(l.id, "stored_in_holding")}>
                            Move to Holding
                          </Button>
                        )}
                        {l.status === "stored_in_holding" && (
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(l.id, "transported")}>
                            Dispatch Transport
                          </Button>
                        )}
                        {l.status === "transported" && (
                          <Button variant="success" size="sm" onClick={() => handleUpdateStatus(l.id, "processed_disposed")}>
                            Confirm Disposed
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

      {/* Log Manifest Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Log Biohazard Waste Manifest"
        description="Record biohazard waste collection weight, category, origin department and disposal method"
        size="lg"
      >
        <form onSubmit={handleCreateLog} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Origin Department *</label>
            <Input
              required
              placeholder="e.g. Central Surgical Suite"
              value={formData.originDepartment}
              onChange={(e) => setFormData({ ...formData, originDepartment: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Manifest # *</label>
                <Input
                required
                placeholder="HAZ-2026-8801"
                value={formData.manifestNumber}
                onChange={(e) => setFormData({ ...formData, manifestNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Weight (kg) *</label>
              <Input
                type="number"
                step="0.1"
                required
                value={formData.weightKg}
                onChange={(e) => setFormData({ ...formData, weightKg: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Waste Category</label>
              <Select
                value={formData.wasteCategory}
                onChange={(e) => setFormData({ ...formData, wasteCategory: e.target.value as any })}
                options={[
                  { label: "Yellow Pathological", value: "yellow_pathological" },
                  { label: "Red Soiled Plastics", value: "red_soiled_plastics" },
                  { label: "White Sharps Container", value: "white_sharps" },
                  { label: "Blue Glassware", value: "blue_glassware" },
                  { label: "Purple Cytotoxic", value: "cytotoxic" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Disposal Method</label>
              <Select
                value={formData.disposalMethod}
                onChange={(e) => setFormData({ ...formData, disposalMethod: e.target.value as any })}
                options={[
                  { label: "Incineration", value: "incineration" },
                  { label: "Autoclaving", value: "autoclaving" },
                  { label: "Chemical Disinfection", value: "chemical_disinfection" },
                  { label: "Secure Landfill", value: "secure_landfill" },
                  { label: "Recycling Vendor", value: "recycling_vendor" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Disposal Vendor</label>
              <Input
                value={formData.disposalVendor}
                onChange={(e) => setFormData({ ...formData, disposalVendor: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Logging Officer</label>
              <Input
                value={formData.loggedBy}
                onChange={(e) => setFormData({ ...formData, loggedBy: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsLogModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Log Manifest
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
