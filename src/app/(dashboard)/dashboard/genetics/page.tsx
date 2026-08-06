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
  Dna,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  RefreshCw,
  Microscope,
} from "lucide-react";

interface GeneVariant {
  geneName: string;
  variantHGVSc: string;
  classification: "pathogenic" | "likely_pathogenic" | "variant_uncertain_significance" | "likely_benign" | "benign";
}

interface GeneticTestRecord {
  id: string;
  sampleId: string;
  patientName: string;
  patientAge: number;
  panelType: "hereditary_cancer" | "cardiovascular_genomics" | "rare_disease_exome" | "pharmacogenomics" | "carrier_screening";
  sequencingPlatform: string;
  geneVariants: GeneVariant[];
  actionableInsights?: string;
  geneticCounselingStatus: "pending_sequencing" | "variant_analysis" | "counseling_scheduled" | "completed";
  geneticCounselorName?: string;
  sampleCollectedDate?: string;
  reportDate?: string;
  notes?: string;
}

interface Metrics {
  totalSamples: number;
  pathogenicCount: number;
  counselingPending: number;
  sequencingActive: number;
}

export default function ClinicalGeneticsPage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<GeneticTestRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalSamples: 0,
    pathogenicCount: 0,
    counselingPending: 0,
    sequencingActive: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPanel, setSelectedPanel] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    sampleId: "",
    patientName: "",
    patientAge: 42,
    panelType: "hereditary_cancer",
    sequencingPlatform: "Illumina NovaSeq 6000",
    geneticCounselorName: "Dr. Eleanor Vance, FACMG",
    notes: "",
  });

  useEffect(() => {
    fetchRecords();
  }, [selectedPanel, selectedStatus]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedPanel !== "ALL") queryParams.append("panelType", selectedPanel);
      if (selectedStatus !== "ALL") queryParams.append("geneticCounselingStatus", selectedStatus);

      const res = await api.get(`/genetics?${queryParams.toString()}`);

      if (res.data && res.data.success) {
        setRecords(res.data.data.records || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching genetic test records:", err);
      toast({
        title: "Error Loading Genetics Data",
        description: err.response?.data?.message || "Failed to fetch genetic test records",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/genetics", formData);

      if (res.data && res.data.success) {
        toast({
          title: "Sequencing Panel Ordered",
          description: `Ordered ${formData.panelType} sequencing for ${formData.patientName}`,
          variant: "success",
        });
        setIsOrderModalOpen(false);
        setFormData({
          sampleId: "",
          patientName: "",
          patientAge: 42,
          panelType: "hereditary_cancer",
          sequencingPlatform: "Illumina NovaSeq 6000",
          geneticCounselorName: "Dr. Eleanor Vance, FACMG",
          notes: "",
        });
        fetchRecords();
      }
    } catch (err: any) {
      console.error("Error creating genetic record:", err);
      toast({
        title: "Ordering Failed",
        description: err.response?.data?.message || "Failed to order genetic sequencing panel",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, updates: Partial<GeneticTestRecord>) => {
    try {
      const res = await api.patch(`/genetics/${id}/status`, updates);
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: "Genetic test counseling status updated successfully.",
          variant: "success",
        });
        fetchRecords();
      }
    } catch (err: any) {
      console.error("Error updating genetics status:", err);
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update genetic status",
        variant: "error",
      });
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      r.sampleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.geneticCounselorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.geneVariants.some((v) => v.geneName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getPathogenicityBadge = (classification: string) => {
    switch (classification) {
      case "pathogenic":
        return <Badge variant="danger" size="sm">Pathogenic</Badge>;
      case "likely_pathogenic":
        return <Badge variant="warning" size="sm">Likely Pathogenic</Badge>;
      case "variant_uncertain_significance":
        return <Badge variant="primary" size="sm">VUS</Badge>;
      default:
        return <Badge variant="success" size="sm">Benign</Badge>;
    }
  };

  const getCounselingStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" dot><CheckCircle2 className="w-3 h-3 mr-1 inline" /> Completed</Badge>;
      case "counseling_scheduled":
        return <Badge variant="info"><Clock className="w-3 h-3 mr-1 inline" /> Scheduled</Badge>;
      case "variant_analysis":
        return <Badge variant="warning"><Microscope className="w-3 h-3 mr-1 inline" /> Variant Curation</Badge>;
      default:
        return <Badge variant="primary"><Dna className="w-3 h-3 mr-1 inline" /> Sequencing Active</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Clinical Genetics & Molecular Diagnostics Workspace
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Next-generation DNA sequencing, hereditary risk panels, ACMG variant interpretation & genetic counseling
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchRecords} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsOrderModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Order Sequencing Panel
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Genomic Samples"
          value={metrics.totalSamples}
          icon={<Dna className="w-5 h-5 text-primary-500" />}
          description="NGS Panels Processed"
        />
        <StatCard
          title="Pathogenic Variants"
          value={metrics.pathogenicCount}
          icon={<Microscope className="w-5 h-5 text-danger-500" />}
          description="High Risk ACMG Findings"
        />
        <StatCard
          title="Counseling Pending"
          value={metrics.counselingPending}
          icon={<Clock className="w-5 h-5 text-warning-500" />}
          description="Patient Consultations"
        />
        <StatCard
          title="Sequencing Active"
          value={metrics.sequencingActive}
          icon={<CheckCircle2 className="w-5 h-5 text-success-500" />}
          description="In Sequencing Pipeline"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search sample ID, patient, gene variant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedPanel}
              onChange={(e) => setSelectedPanel(e.target.value)}
              options={[
                { label: "All Panel Types", value: "ALL" },
                { label: "Hereditary Cancer Panel", value: "hereditary_cancer" },
                { label: "Cardiovascular Genomics", value: "cardiovascular_genomics" },
                { label: "Rare Disease Exome", value: "rare_disease_exome" },
                { label: "Pharmacogenomics (PGx)", value: "pharmacogenomics" },
                { label: "Carrier Screening", value: "carrier_screening" },
              ]}
            />

            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { label: "All Counseling Statuses", value: "ALL" },
                { label: "Pending Sequencing", value: "pending_sequencing" },
                { label: "Variant Analysis", value: "variant_analysis" },
                { label: "Counseling Scheduled", value: "counseling_scheduled" },
                { label: "Completed", value: "completed" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Genetics Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Sample ID & Patient</th>
                <th className="px-6 py-4">Panel Type & Platform</th>
                <th className="px-6 py-4">Identified Variants & ACMG Class</th>
                <th className="px-6 py-4">Genetic Counselor</th>
                <th className="px-6 py-4">Counseling Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading genetic test records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12">
                    <EmptyState
                      icon={<Dna className="w-8 h-8 text-text-muted" />}
                      title="No Genetic Records Found"
                      description="No molecular diagnostic records match your selected filters."
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsOrderModalOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" /> Order Sequencing Panel
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold">{r.patientName} ({r.patientAge}y)</div>
                      <div className="text-xs font-mono text-primary-600 dark:text-primary-400">{r.sampleId}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-text capitalize">{r.panelType.replace('_', ' ')}</div>
                      <div className="text-xs text-text-muted">{r.sequencingPlatform}</div>
                    </td>

                    <td className="px-6 py-4">
                      {r.geneVariants && r.geneVariants.length > 0 ? (
                        <div className="space-y-1">
                          {r.geneVariants.map((v, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="font-mono font-bold text-text text-xs">{v.geneName}</span>
                              {getPathogenicityBadge(v.classification)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">No pathogenic variants detected</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-text font-medium">
                      {r.geneticCounselorName || "Unassigned"}
                    </td>

                    <td className="px-6 py-4">{getCounselingStatusBadge(r.geneticCounselingStatus)}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.geneticCounselingStatus !== "completed" && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleUpdateStatus(r.id, { geneticCounselingStatus: "completed" })}
                          >
                            Complete Counseling
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

      {/* Order Panel Modal */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title="Order Genetic Sequencing Panel"
        description="Schedule next-generation DNA sequencing and variant curation for patient"
        size="lg"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Patient Full Name *</label>
            <Input
              required
              placeholder="e.g. Victoria Sterling"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Sample ID (Optional)</label>
              <Input
                placeholder="GEN-SMP-901"
                value={formData.sampleId}
                onChange={(e) => setFormData({ ...formData, sampleId: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Patient Age *</label>
              <Input
                type="number"
                value={formData.patientAge}
                onChange={(e) => setFormData({ ...formData, patientAge: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Sequencing Panel Type</label>
              <Select
                value={formData.panelType}
                onChange={(e) => setFormData({ ...formData, panelType: e.target.value as any })}
                options={[
                  { label: "Hereditary Cancer Panel", value: "hereditary_cancer" },
                  { label: "Cardiovascular Genomics", value: "cardiovascular_genomics" },
                  { label: "Rare Disease Exome", value: "rare_disease_exome" },
                  { label: "Pharmacogenomics (PGx)", value: "pharmacogenomics" },
                  { label: "Carrier Screening", value: "carrier_screening" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Sequencing Platform</label>
              <Input
                value={formData.sequencingPlatform}
                onChange={(e) => setFormData({ ...formData, sequencingPlatform: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Assigned Genetic Counselor</label>
            <Input
              value={formData.geneticCounselorName}
              onChange={(e) => setFormData({ ...formData, geneticCounselorName: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Order Panel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
