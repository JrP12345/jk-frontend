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
  ShieldCheck,
  Activity,
  AlertTriangle,
  FileCheck,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  Radiation,
  Syringe,
  User,
  Stethoscope,
} from "lucide-react";

interface OccupationalHealthRecord {
  id: string;
  employeeId: string;
  staffName: string;
  department: string;
  recordType: "annual_health_exam" | "needle_stick_incident" | "radiation_dosimetry" | "immunization_compliance" | "fitness_for_duty";
  immunizationStatus: "fully_compliant" | "booster_due" | "non_compliant";
  radiationDosimetryMSv: number;
  needleStickStatus: "none" | "post_exposure_prophylaxis" | "cleared";
  fitnessClearanceStatus: "fit_for_unrestricted_duty" | "conditional_duty" | "temporarily_unfit";
  examiningPhysician: string;
  notes?: string;
  updatedAt?: string;
}

interface Metrics {
  totalRecords: number;
  fullyCompliantCount: number;
  complianceRate: number;
  radiationMonitoredCount: number;
  pepIncidentCount: number;
}

export default function OccupationalHealthPage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<OccupationalHealthRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalRecords: 0,
    fullyCompliantCount: 0,
    complianceRate: 100,
    radiationMonitoredCount: 0,
    pepIncidentCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecordType, setSelectedRecordType] = useState("ALL");
  const [selectedCompliance, setSelectedCompliance] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeCertModal, setActiveCertModal] = useState<OccupationalHealthRecord | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: `EMP-${Date.now().toString().slice(-4)}`,
    staffName: "",
    department: "Nursing Services",
    recordType: "annual_health_exam",
    immunizationStatus: "fully_compliant",
    radiationDosimetryMSv: 0.2,
    needleStickStatus: "none",
    fitnessClearanceStatus: "fit_for_unrestricted_duty",
    examiningPhysician: "",
    notes: "",
  });

  useEffect(() => {
    fetchRecords();
  }, [selectedRecordType, selectedCompliance]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedRecordType !== "ALL") queryParams.append("recordType", selectedRecordType);
      if (selectedCompliance !== "ALL") queryParams.append("immunizationStatus", selectedCompliance);

      const res = await api.get(`/occupational-health?${queryParams.toString()}`);
      if (res.data && res.data.success) {
        setRecords(res.data.data.records || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching occupational health records:", err);
      toast({
        title: "Error Loading Records",
        description: err.response?.data?.message || "Failed to fetch staff health records",
        variant: "error",
      });
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/occupational-health", formData);
      if (res.data && res.data.success) {
        toast({
          title: "Record Logged",
          description: `Logged staff health exam for ${formData.staffName}`,
          variant: "success",
        });
        setIsLogModalOpen(false);
        fetchRecords();
      }
    } catch (err: any) {
      toast({
        title: "Logging Failed",
        description: err.response?.data?.message || "Failed to log health exam",
        variant: "error",
      });
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      r.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.examiningPhysician.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFitnessBadge = (status: string) => {
    switch (status) {
      case "fit_for_unrestricted_duty":
        return <Badge variant="success" dot pulse>Fit for Duty</Badge>;
      case "conditional_duty":
        return <Badge variant="warning">Conditional Duty</Badge>;
      default:
        return <Badge variant="danger">Temporarily Unfit</Badge>;
    }
  };

  const getComplianceBadge = (status: string) => {
    switch (status) {
      case "fully_compliant":
        return <Badge variant="success">Fully Compliant</Badge>;
      case "booster_due":
        return <Badge variant="warning">Booster Due</Badge>;
      default:
        return <Badge variant="danger">Non-Compliant</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Occupational Health & Staff Wellness Portal
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Employee health exams, radiation dosimetry (mSv), immunization compliance & needle-stick PEP surveillance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchRecords} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsLogModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Log Staff Health Exam
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Staff Compliance Rate"
          value={`${metrics.complianceRate}%`}
          icon={<ShieldCheck className="w-5 h-5 text-success-500" />}
          description="Immunization & Exams"
        />
        <StatCard
          title="Fully Compliant Staff"
          value={metrics.fullyCompliantCount}
          icon={<CheckCircle2 className="w-5 h-5 text-primary-500" />}
          description="Unrestricted Fitness"
        />
        <StatCard
          title="Radiation Monitored"
          value={metrics.radiationMonitoredCount}
          icon={<Radiation className="w-5 h-5 text-warning-500" />}
          description="Dosimetry Badge Active"
        />
        <StatCard
          title="Needle-Stick PEP Cases"
          value={metrics.pepIncidentCount}
          icon={<Syringe className="w-5 h-5 text-danger-500" />}
          description="Post-Exposure Protocol"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search staff name, EMP ID, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedRecordType}
              onChange={(e) => setSelectedRecordType(e.target.value)}
              options={[
                { label: "All Record Types", value: "ALL" },
                { label: "Annual Health Exam", value: "annual_health_exam" },
                { label: "Radiation Dosimetry", value: "radiation_dosimetry" },
                { label: "Needle Stick Incident", value: "needle_stick_incident" },
                { label: "Immunization Compliance", value: "immunization_compliance" },
                { label: "Fitness for Duty", value: "fitness_for_duty" },
              ]}
            />

            <Select
              value={selectedCompliance}
              onChange={(e) => setSelectedCompliance(e.target.value)}
              options={[
                { label: "All Immunization Statuses", value: "ALL" },
                { label: "Fully Compliant", value: "fully_compliant" },
                { label: "Booster Due", value: "booster_due" },
                { label: "Non-Compliant", value: "non_compliant" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Records Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Employee ID & Staff Name</th>
                <th className="px-6 py-4">Department & Record Type</th>
                <th className="px-6 py-4">Immunization & Dosimetry (mSv)</th>
                <th className="px-6 py-4">Fitness Clearance Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading staff health records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    No staff health records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold">{r.staffName}</div>
                      <div className="text-xs text-text-muted font-mono">{r.employeeId}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-text font-medium">{r.department}</div>
                      <Badge variant="neutral" size="sm" className="mt-0.5">{r.recordType.replace(/_/g, " ")}</Badge>
                    </td>

                    <td className="px-6 py-4 space-y-1">
                      <div>{getComplianceBadge(r.immunizationStatus)}</div>
                      <div className="text-xs font-mono text-text-muted">Dosimetry: <strong className="text-text">{r.radiationDosimetryMSv} mSv</strong></div>
                    </td>

                    <td className="px-6 py-4">
                      <div>{getFitnessBadge(r.fitnessClearanceStatus)}</div>
                      <div className="text-xs text-text-muted mt-1">{r.examiningPhysician}</div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveCertModal(r)}
                      >
                        View Certificate
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Medical Certificate Modal */}
      <Modal
        isOpen={!!activeCertModal}
        onClose={() => setActiveCertModal(null)}
        title="Occupational Medical Certificate"
        description={`${activeCertModal?.employeeId} • ${activeCertModal?.staffName}`}
        size="md"
      >
        {activeCertModal && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-alt border border-border rounded-xl space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Department:</span>
                <span className="font-semibold text-text">{activeCertModal.department}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Fitness Status:</span>
                <span>{getFitnessBadge(activeCertModal.fitnessClearanceStatus)}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Radiation Exposure:</span>
                <span className="font-mono font-semibold text-text">{activeCertModal.radiationDosimetryMSv} mSv</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-1.5">
                <span className="text-text-secondary">Examining Physician:</span>
                <span className="font-semibold text-primary-500">{activeCertModal.examiningPhysician}</span>
              </div>
            </div>

            {activeCertModal.notes && (
              <div className="p-3 bg-primary-500/10 border border-primary-500/20 rounded-xl">
                <span className="text-xs font-bold uppercase text-primary-600 dark:text-primary-400">Clinical Exam Notes:</span>
                <p className="text-xs text-text mt-1">{activeCertModal.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setActiveCertModal(null)}>
                Close Certificate
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Log Health Exam Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Log Staff Health Exam"
        description="Record occupational health, dosimetry & immunization clearance"
        size="lg"
      >
        <form onSubmit={handleCreateRecord} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Staff Full Name *</label>
            <Input
              required
              placeholder="e.g. Sr. Nurse Clara Oswald"
              value={formData.staffName}
              onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Employee ID *</label>
              <Input
                required
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Department *</label>
              <Select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                options={[
                  { label: "Nursing Services", value: "Nursing Services" },
                  { label: "Emergency Dept", value: "Emergency Dept" },
                  { label: "Diagnostic Radiology", value: "Diagnostic Radiology" },
                  { label: "Surgical Suite", value: "Surgical Suite" },
                  { label: "Pharmacy Services", value: "Pharmacy Services" },
                ]}
              />
            </div>
          </div>

          <Input
            label="Examining Physician *"
            required
            value={formData.examiningPhysician}
            onChange={(e) => setFormData({ ...formData, examiningPhysician: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Record Type</label>
              <Select
                value={formData.recordType}
                onChange={(e) => setFormData({ ...formData, recordType: e.target.value as any })}
                options={[
                  { label: "Annual Health Exam", value: "annual_health_exam" },
                  { label: "Radiation Dosimetry", value: "radiation_dosimetry" },
                  { label: "Needle Stick Incident", value: "needle_stick_incident" },
                  { label: "Immunization Compliance", value: "immunization_compliance" },
                  { label: "Fitness for Duty", value: "fitness_for_duty" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Immunization Status</label>
              <Select
                value={formData.immunizationStatus}
                onChange={(e) => setFormData({ ...formData, immunizationStatus: e.target.value as any })}
                options={[
                  { label: "Fully Compliant", value: "fully_compliant" },
                  { label: "Booster Due", value: "booster_due" },
                  { label: "Non-Compliant", value: "non_compliant" },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsLogModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Log Health Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
