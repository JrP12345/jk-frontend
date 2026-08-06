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
  Wrench,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  RefreshCw,
  Flame,
  XCircle,
} from "lucide-react";

interface BiomedicalAsset {
  id: string;
  assetTag: string;
  deviceName: string;
  category: "life_support" | "diagnostic_imaging" | "surgical_instrument" | "patient_monitor" | "laboratory_analyzer" | "infusion_pump";
  serialNumber: string;
  manufacturer: string;
  department: string;
  location: string;
  operationalStatus: "operational" | "under_maintenance" | "calibration_due" | "decommissioned" | "out_of_service";
  lastCalibrationDate: string;
  nextCalibrationDueDate: string;
  riskClassification: "low_risk" | "medium_risk" | "high_risk_critical";
  maintenanceContact: string;
  notes?: string;
}

interface Metrics {
  totalAssets: number;
  operationalCount: number;
  maintenanceCount: number;
  calibrationDueCount: number;
  highRiskCount: number;
}

export default function BiomedicalEquipmentPage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<BiomedicalAsset[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalAssets: 0,
    operationalCount: 0,
    maintenanceCount: 0,
    calibrationDueCount: 0,
    highRiskCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    assetTag: "",
    deviceName: "",
    category: "life_support",
    serialNumber: "",
    manufacturer: "",
    department: "",
    location: "",
    operationalStatus: "operational",
    riskClassification: "high_risk_critical",
    nextCalibrationDueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    maintenanceContact: "",
    notes: "",
  });

  useEffect(() => {
    fetchAssets();
  }, [selectedDepartment, selectedCategory, selectedStatus]);

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedDepartment !== "ALL") queryParams.append("department", selectedDepartment);
      if (selectedCategory !== "ALL") queryParams.append("category", selectedCategory);
      if (selectedStatus !== "ALL") queryParams.append("operationalStatus", selectedStatus);

      const res = await api.get(`/biomedical?${queryParams.toString()}`);

      if (res.data && res.data.success) {
        setAssets(res.data.data.assets || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching biomedical assets:", err);
      toast({
        title: "Error Loading Assets",
        description: err.response?.data?.message || "Failed to fetch biomedical equipment inventory",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/biomedical", formData);
      if (res.data && res.data.success) {
        toast({
          title: "Device Registered",
          description: `Registered asset ${formData.deviceName} (${formData.assetTag || 'Auto-Tag'})`,
          variant: "success",
        });
        setIsRegisterModalOpen(false);
        setFormData({
          assetTag: "",
          deviceName: "",
          category: "life_support",
          serialNumber: "",
          manufacturer: "",
          department: "",
          location: "",
          operationalStatus: "operational",
          riskClassification: "high_risk_critical",
          nextCalibrationDueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          maintenanceContact: "",
          notes: "",
        });
        fetchAssets();
      }
    } catch (err: any) {
      console.error("Error registering asset:", err);
      toast({
        title: "Registration Failed",
        description: err.response?.data?.message || "Failed to register biomedical asset",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(`/biomedical/${id}/status`, {
        operationalStatus: newStatus,
        lastCalibrationDate: newStatus === "operational" ? new Date().toISOString() : undefined,
      });
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: `Device operational status changed to ${newStatus}`,
          variant: "success",
        });
        fetchAssets();
      }
    } catch (err: any) {
      console.error("Error updating asset status:", err);
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update asset status",
        variant: "error",
      });
    }
  };

  const filteredAssets = assets.filter(
    (a) =>
      a.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.assetTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge variant="success" dot><CheckCircle2 className="w-3 h-3 mr-1 inline" /> Operational</Badge>;
      case "under_maintenance":
        return <Badge variant="warning"><Wrench className="w-3 h-3 mr-1 inline" /> Maintenance</Badge>;
      case "calibration_due":
        return <Badge variant="danger"><AlertTriangle className="w-3 h-3 mr-1 inline" /> Calibration Due</Badge>;
      case "out_of_service":
        return <Badge variant="danger"><XCircle className="w-3 h-3 mr-1 inline" /> Out of Service</Badge>;
      default:
        return <Badge variant="neutral">Decommissioned</Badge>;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "high_risk_critical":
        return <Badge variant="danger" size="sm"><Flame className="w-3 h-3 mr-1 inline" /> High Risk</Badge>;
      case "medium_risk":
        return <Badge variant="warning" size="sm"><AlertTriangle className="w-3 h-3 mr-1 inline" /> Medium Risk</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Low Risk</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Biomedical Equipment & Asset Desk
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Medical device inventory, calibration schedules, preventive maintenance & downtime surveillance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchAssets} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsRegisterModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Register Device Asset
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered Devices"
          value={metrics.totalAssets}
          icon={<Cpu className="w-5 h-5 text-primary-500" />}
          description="Assets Tracked"
        />
        <StatCard
          title="Operational Rate"
          value={metrics.operationalCount}
          icon={<CheckCircle2 className="w-5 h-5 text-success-500" />}
          description="Ready For Clinical Use"
        />
        <StatCard
          title="Maintenance Queue"
          value={metrics.maintenanceCount}
          icon={<Wrench className="w-5 h-5 text-warning-500" />}
          description="Under Repair / Servicing"
        />
        <StatCard
          title="Calibration Overdue"
          value={metrics.calibrationDueCount}
          icon={<AlertTriangle className="w-5 h-5 text-danger-500" />}
          description="Require Recalibration"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search device name, asset tag, serial..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              options={[
                { label: "All Departments", value: "ALL" },
                { label: "ICU Ward A", value: "ICU Ward A" },
                { label: "Operating Theatre", value: "Operating Theatre" },
                { label: "Emergency Dept", value: "Emergency Dept" },
                { label: "Radiology Suite", value: "Radiology Suite" },
              ]}
            />

            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { label: "All Categories", value: "ALL" },
                { label: "Life Support (Ventilator/Defib)", value: "life_support" },
                { label: "Diagnostic Imaging (CT/MRI/US)", value: "diagnostic_imaging" },
                { label: "Surgical Instruments", value: "surgical_instrument" },
                { label: "Patient Monitors", value: "patient_monitor" },
                { label: "Infusion Pumps", value: "infusion_pump" },
              ]}
            />

            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { label: "All Operational Statuses", value: "ALL" },
                { label: "Operational", value: "operational" },
                { label: "Under Maintenance", value: "under_maintenance" },
                { label: "Calibration Due", value: "calibration_due" },
                { label: "Out of Service", value: "out_of_service" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Biomedical Assets Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Asset Tag & Device</th>
                <th className="px-6 py-4">Serial & Manufacturer</th>
                <th className="px-6 py-4">Location & Ward</th>
                <th className="px-6 py-4">Risk Level</th>
                <th className="px-6 py-4">Operational Status</th>
                <th className="px-6 py-4">Next Calibration</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading biomedical asset inventory...
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={<Cpu className="w-8 h-8 text-text-muted" />}
                      title="No Assets Found"
                      description="No biomedical equipment items match your selected filters."
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsRegisterModalOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" /> Register Device Asset
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredAssets.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text max-w-xs">
                      <div className="font-semibold">{a.deviceName}</div>
                      <div className="text-xs font-mono text-primary-600 dark:text-primary-400">{a.assetTag}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-mono text-text text-xs">{a.serialNumber}</div>
                      <div className="text-xs text-text-muted">{a.manufacturer}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-text">{a.department}</div>
                      <div className="text-xs text-text-muted">{a.location}</div>
                    </td>

                    <td className="px-6 py-4">{getRiskBadge(a.riskClassification)}</td>

                    <td className="px-6 py-4">{getStatusBadge(a.operationalStatus)}</td>

                    <td className="px-6 py-4">
                      <div className="text-xs font-mono text-text">
                        {new Date(a.nextCalibrationDueDate).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {a.operationalStatus !== "operational" && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleUpdateStatus(a.id, "operational")}
                          >
                            Mark Operational
                          </Button>
                        )}
                        {a.operationalStatus === "operational" && (
                          <Button
                            variant="warning"
                            size="sm"
                            onClick={() => handleUpdateStatus(a.id, "under_maintenance")}
                          >
                            Send Maintenance
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

      {/* Register Asset Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Biomedical Equipment Device"
        description="Add medical device inventory record with serial, location and calibration schedule"
        size="lg"
      >
        <form onSubmit={handleRegisterAsset} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Device Name *</label>
            <Input
              required
              placeholder="e.g. Mindray SV300 ICU Ventilator"
              value={formData.deviceName}
              onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Asset Tag (Optional)</label>
              <Input
                placeholder="BMED-VENT-901"
                value={formData.assetTag}
                onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Serial Number *</label>
              <Input
                required
                placeholder="SN-9988776655"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Category</label>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                options={[
                  { label: "Life Support (Ventilator/Defib)", value: "life_support" },
                  { label: "Diagnostic Imaging", value: "diagnostic_imaging" },
                  { label: "Surgical Instrument", value: "surgical_instrument" },
                  { label: "Patient Monitor", value: "patient_monitor" },
                  { label: "Laboratory Analyzer", value: "laboratory_analyzer" },
                  { label: "Infusion Pump", value: "infusion_pump" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Department</label>
              <Select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                options={[
                  { label: "ICU Ward A", value: "ICU Ward A" },
                  { label: "Operating Theatre", value: "Operating Theatre" },
                  { label: "Emergency Dept", value: "Emergency Dept" },
                  { label: "Radiology Suite", value: "Radiology Suite" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Risk Severity</label>
              <Select
                value={formData.riskClassification}
                onChange={(e) => setFormData({ ...formData, riskClassification: e.target.value as any })}
                options={[
                  { label: "High Risk (Critical)", value: "high_risk_critical" },
                  { label: "Medium Risk", value: "medium_risk" },
                  { label: "Low Risk", value: "low_risk" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Next Calibration Due Date</label>
              <Input
                type="date"
                value={formData.nextCalibrationDueDate}
                onChange={(e) => setFormData({ ...formData, nextCalibrationDueDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Maintenance Contact / Vendor Support</label>
            <Input
              placeholder="e.g. Lead Bio-Engineer Desk"
              value={formData.maintenanceContact}
              onChange={(e) => setFormData({ ...formData, maintenanceContact: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Register Device
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
