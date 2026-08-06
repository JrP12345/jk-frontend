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
  HeartHandshake,
  Activity,
  UserCheck,
  Clock,
  Plus,
  Search,
  RefreshCw,
  Flame,
  ShieldCheck,
  Dna,
  Calculator,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface TransplantCase {
  id: string;
  caseNumber: string;
  patientName: string;
  organType: "kidney" | "liver" | "heart" | "lung" | "pancreas" | "cornea";
  caseRole: "recipient_waitlist" | "donor_registered";
  bloodGroup: string;
  hlaTyping: string;
  urgencyScore: number;
  matchStatus: "seeking_match" | "potential_match_found" | "crossmatch_verified" | "transplant_scheduled" | "completed";
  donorHospital: string;
  preservationTimeHours: number;
  leadSurgeon: string;
  notes?: string;
}

interface Metrics {
  totalCases: number;
  recipientCount: number;
  donorCount: number;
  activeMatchesCount: number;
  criticalUrgencyCount: number;
}

export default function OrganTransplantPage() {
  const { toast } = useToast();
  const [cases, setCases] = useState<TransplantCase[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalCases: 0,
    recipientCount: 0,
    donorCount: 0,
    activeMatchesCount: 0,
    criticalUrgencyCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrgan, setSelectedOrgan] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Calculator State
  const [calcRecipientHla, setCalcRecipientHla] = useState("");
  const [calcDonorHla, setCalcDonorHla] = useState("");
  const [calcRecipientBlood, setCalcRecipientBlood] = useState("");
  const [calcDonorBlood, setCalcDonorBlood] = useState("");
  const [calcResult, setCalcResult] = useState<any>(null);

  const [formData, setFormData] = useState({
    caseNumber: "",
    patientName: "",
    organType: "kidney",
    caseRole: "recipient_waitlist",
    bloodGroup: "",
    hlaTyping: "",
    urgencyScore: 0,
    matchStatus: "seeking_match",
    donorHospital: "",
    preservationTimeHours: 0,
    leadSurgeon: "",
    notes: "",
  });

  useEffect(() => {
    fetchCases();
  }, [selectedOrgan, selectedRole, selectedStatus]);

  const fetchCases = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedOrgan !== "ALL") queryParams.append("organType", selectedOrgan);
      if (selectedRole !== "ALL") queryParams.append("caseRole", selectedRole);
      if (selectedStatus !== "ALL") queryParams.append("matchStatus", selectedStatus);

      const res = await api.get(`/transplant?${queryParams.toString()}`);

      if (res.data && res.data.success) {
        setCases(res.data.data.cases || []);
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err: any) {
      console.error("Error fetching transplant cases:", err);
      toast({
        title: "Error Loading Cases",
        description: err.response?.data?.message || "Failed to fetch organ transplant waitlist & donor records",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/transplant", formData);

      if (res.data && res.data.success) {
        toast({
          title: "Transplant Case Registered",
          description: `Registered case ${formData.caseNumber || 'Auto-Case'} for ${formData.patientName}`,
          variant: "success",
        });
        setIsRegisterModalOpen(false);
        setFormData({
          caseNumber: "",
          patientName: "",
          organType: "kidney",
          caseRole: "recipient_waitlist",
          bloodGroup: "",
          hlaTyping: "",
          urgencyScore: 0,
          matchStatus: "seeking_match",
          donorHospital: "",
          preservationTimeHours: 0,
          leadSurgeon: "",
          notes: "",
        });
        fetchCases();
      }
    } catch (err: any) {
      console.error("Error registering transplant case:", err);
      toast({
        title: "Registration Failed",
        description: err.response?.data?.message || "Failed to register transplant case",
        variant: "error",
      });
    }
  };

  const handleRunCalculator = async () => {
    try {
      const res = await api.post("/transplant/match-calculator", {
        recipientHla: calcRecipientHla,
        donorHla: calcDonorHla,
        recipientBlood: calcRecipientBlood,
        donorBlood: calcDonorBlood,
      });
      if (res.data && res.data.success) {
        setCalcResult(res.data.data);
        toast({
          title: "HLA Crossmatch Computed",
          description: `Calculated match score: ${res.data.data.matchPercentage}% (${res.data.data.compatibilityRating})`,
          variant: "default",
        });
      }
    } catch (err: any) {
      console.error("Error running HLA match calculator:", err);
      toast({
        title: "Calculation Error",
        description: err.response?.data?.message || "Failed to calculate HLA crossmatch",
        variant: "error",
      });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.patch(`/transplant/${id}/status`, { matchStatus: newStatus });
      if (res.data && res.data.success) {
        toast({
          title: "Status Updated",
          description: `Transplant match status changed to ${newStatus}`,
          variant: "success",
        });
        fetchCases();
      }
    } catch (err: any) {
      console.error("Error updating match status:", err);
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update match status",
        variant: "error",
      });
    }
  };

  const filteredCases = cases.filter(
    (c) =>
      c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.bloodGroup.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" dot><CheckCircle2 className="w-3 h-3 mr-1 inline" /> Completed</Badge>;
      case "transplant_scheduled":
        return <Badge variant="primary"><Clock className="w-3 h-3 mr-1 inline" /> OR Scheduled</Badge>;
      case "crossmatch_verified":
        return <Badge variant="info"><ShieldCheck className="w-3 h-3 mr-1 inline" /> Crossmatch Verified</Badge>;
      case "potential_match_found":
        return <Badge variant="warning"><Sparkles className="w-3 h-3 mr-1 inline" /> Potential Match</Badge>;
      default:
        return <Badge variant="neutral">Seeking Match</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Organ Transplant & HLA Crossmatch Management
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            UNOS/OPTN waitlist registry, organ procurement tracking, HLA donor crossmatching & cold ischemia surveillance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setIsCalculatorOpen(true)} size="sm">
            <Calculator className="w-4 h-4 mr-2" /> HLA Match Calculator
          </Button>
          <Button variant="outline" onClick={fetchCases} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="primary" onClick={() => setIsRegisterModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Register Transplant Case
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Active Registry"
          value={metrics.totalCases}
          icon={<HeartHandshake className="w-5 h-5 text-primary-500" />}
          description="Recipients & Donors Logged"
        />
        <StatCard
          title="Waitlist Recipients"
          value={metrics.recipientCount}
          icon={<UserCheck className="w-5 h-5 text-info-500" />}
          description="Awaiting Organ Match"
        />
        <StatCard
          title="Active Donor Matches"
          value={metrics.activeMatchesCount}
          icon={<Sparkles className="w-5 h-5 text-warning-500" />}
          description="Crossmatch In Verification"
        />
        <StatCard
          title="Critical Urgency Score"
          value={metrics.criticalUrgencyCount}
          icon={<Flame className="w-5 h-5 text-danger-500" />}
          description="MELD/PELD Priority Cases"
        />
      </div>

      {/* Filters Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search patient name, case #, blood group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-text-muted" />}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select
              value={selectedOrgan}
              onChange={(e) => setSelectedOrgan(e.target.value)}
              options={[
                { label: "All Organ Types", value: "ALL" },
                { label: "Kidney", value: "kidney" },
                { label: "Liver", value: "liver" },
                { label: "Heart", value: "heart" },
                { label: "Lung", value: "lung" },
                { label: "Pancreas", value: "pancreas" },
                { label: "Cornea", value: "cornea" },
              ]}
            />

            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              options={[
                { label: "All Case Roles", value: "ALL" },
                { label: "Recipient (Waitlist)", value: "recipient_waitlist" },
                { label: "Donor (Registered)", value: "donor_registered" },
              ]}
            />

            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { label: "All Match Statuses", value: "ALL" },
                { label: "Seeking Match", value: "seeking_match" },
                { label: "Potential Match", value: "potential_match_found" },
                { label: "Crossmatch Verified", value: "crossmatch_verified" },
                { label: "OR Scheduled", value: "transplant_scheduled" },
                { label: "Completed", value: "completed" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Cases Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4">Case # & Patient</th>
                <th className="px-6 py-4">Role & Organ</th>
                <th className="px-6 py-4">ABO / HLA Typing</th>
                <th className="px-6 py-4">Urgency Score</th>
                <th className="px-6 py-4">Match Status</th>
                <th className="px-6 py-4">Hospital & Cold Ischemia</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                    Loading organ transplant waitlist...
                  </td>
                </tr>
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={<HeartHandshake className="w-8 h-8 text-text-muted" />}
                      title="No Transplant Cases Found"
                      description="No active transplant registry records match your selected filters."
                      action={
                        <Button variant="primary" size="sm" onClick={() => setIsRegisterModalOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" /> Register Transplant Case
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium text-text">
                      <div className="font-semibold">{c.patientName}</div>
                      <div className="text-xs font-mono text-primary-600 dark:text-primary-400">{c.caseNumber}</div>
                    </td>

                    <td className="px-6 py-4">
                      <Badge variant={c.caseRole === "recipient_waitlist" ? "info" : "success"} size="sm">
                        {c.caseRole === "recipient_waitlist" ? "Recipient" : "Donor"}
                      </Badge>
                      <div className="text-xs text-text-secondary capitalize mt-1 font-semibold">{c.organType}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-mono text-text font-bold">ABO: {c.bloodGroup}</div>
                      <div className="text-xs text-text-muted font-mono truncate max-w-xs">{c.hlaTyping}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-text flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-danger-500" /> Score {c.urgencyScore}
                      </div>
                    </td>

                    <td className="px-6 py-4">{getStatusBadge(c.matchStatus)}</td>

                    <td className="px-6 py-4">
                      <div className="text-text font-medium">{c.donorHospital}</div>
                      <div className="text-xs text-text-muted font-mono">{c.preservationTimeHours}h Cold Ischemia Window</div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.matchStatus === "seeking_match" && (
                          <Button variant="warning" size="sm" onClick={() => handleUpdateStatus(c.id, "potential_match_found")}>
                            Flag Potential Match
                          </Button>
                        )}
                        {c.matchStatus === "potential_match_found" && (
                          <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(c.id, "crossmatch_verified")}>
                            Verify Crossmatch
                          </Button>
                        )}
                        {c.matchStatus === "crossmatch_verified" && (
                          <Button variant="primary" size="sm" onClick={() => handleUpdateStatus(c.id, "transplant_scheduled")}>
                            Schedule Surgery
                          </Button>
                        )}
                        {c.matchStatus === "transplant_scheduled" && (
                          <Button variant="success" size="sm" onClick={() => handleUpdateStatus(c.id, "completed")}>
                            Mark Completed
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

      {/* Register Case Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Organ Transplant Case"
        description="Add donor or recipient to national organ allocation & HLA crossmatch registry"
        size="lg"
      >
        <form onSubmit={handleRegisterCase} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Patient / Donor Name *</label>
            <Input
              required
              placeholder="e.g. Robert Vance"
              value={formData.patientName}
              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Case # (Optional)</label>
              <Input
                placeholder="TXP-RECP-901"
                value={formData.caseNumber}
                onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Organ Type *</label>
              <Select
                value={formData.organType}
                onChange={(e) => setFormData({ ...formData, organType: e.target.value as any })}
                options={[
                  { label: "Kidney", value: "kidney" },
                  { label: "Liver", value: "liver" },
                  { label: "Heart", value: "heart" },
                  { label: "Lung", value: "lung" },
                  { label: "Pancreas", value: "pancreas" },
                  { label: "Cornea", value: "cornea" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Donor Hospital / Source *"
              required
              value={formData.donorHospital}
              onChange={(e) => setFormData({ ...formData, donorHospital: e.target.value })}
            />
            <Input
              label="Lead Surgeon *"
              required
              value={formData.leadSurgeon}
              onChange={(e) => setFormData({ ...formData, leadSurgeon: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Case Role</label>
              <Select
                value={formData.caseRole}
                onChange={(e) => setFormData({ ...formData, caseRole: e.target.value as any })}
                options={[
                  { label: "Recipient (Waitlist)", value: "recipient_waitlist" },
                  { label: "Donor (Registered)", value: "donor_registered" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">ABO Blood Group *</label>
              <Select
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                options={[
                  { label: "O+", value: "O+" },
                  { label: "O-", value: "O-" },
                  { label: "A+", value: "A+" },
                  { label: "A-", value: "A-" },
                  { label: "B+", value: "B+" },
                  { label: "B-", value: "B-" },
                  { label: "AB+", value: "AB+" },
                  { label: "AB-", value: "AB-" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">HLA Allele Typing *</label>
            <Input
              required
              placeholder="e.g. HLA-A*02, HLA-B*27, HLA-DR*04"
              value={formData.hlaTyping}
              onChange={(e) => setFormData({ ...formData, hlaTyping: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">MELD / PELD Urgency Score</label>
              <Input
                type="number"
                value={formData.urgencyScore}
                onChange={(e) => setFormData({ ...formData, urgencyScore: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Max Cold Ischemia (Hours)</label>
              <Input
                type="number"
                value={formData.preservationTimeHours}
                onChange={(e) => setFormData({ ...formData, preservationTimeHours: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" type="button" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Register Case
            </Button>
          </div>
        </form>
      </Modal>

      {/* HLA Calculator Modal */}
      <Modal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        title="HLA Virtual Crossmatch Calculator"
        description="Compute HLA allele compatibility % and ABO blood group suitability between donor and recipient"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Recipient HLA Alleles</label>
              <Input
                value={calcRecipientHla}
                onChange={(e) => setCalcRecipientHla(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Donor HLA Alleles</label>
              <Input
                value={calcDonorHla}
                onChange={(e) => setCalcDonorHla(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Recipient ABO Blood</label>
              <Select
                value={calcRecipientBlood}
                onChange={(e) => setCalcRecipientBlood(e.target.value)}
                options={[
                  { label: "O+", value: "O+" },
                  { label: "O-", value: "O-" },
                  { label: "A+", value: "A+" },
                  { label: "A-", value: "A-" },
                  { label: "B+", value: "B+" },
                  { label: "B-", value: "B-" },
                  { label: "AB+", value: "AB+" },
                  { label: "AB-", value: "AB-" },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Donor ABO Blood</label>
              <Select
                value={calcDonorBlood}
                onChange={(e) => setCalcDonorBlood(e.target.value)}
                options={[
                  { label: "O+", value: "O+" },
                  { label: "O-", value: "O-" },
                  { label: "A+", value: "A+" },
                  { label: "A-", value: "A-" },
                  { label: "B+", value: "B+" },
                  { label: "B-", value: "B-" },
                  { label: "AB+", value: "AB+" },
                  { label: "AB-", value: "AB-" },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="primary" onClick={handleRunCalculator}>
              Compute Compatibility
            </Button>
          </div>

          {calcResult && (
            <Card padding="sm" className="bg-surface-alt mt-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-text">Overall Match Percentage:</span>
                  <Badge variant={calcResult.matchPercentage >= 70 ? "success" : "warning"} size="lg">
                    {calcResult.matchPercentage}%
                  </Badge>
                </div>
                <div className="text-xs text-text-secondary">
                  <strong>Compatibility Rating:</strong> {calcResult.compatibilityRating}
                </div>
                <div className="text-xs text-text-secondary">
                  <strong>ABO Status:</strong> {calcResult.aboCompatible ? "Compatible ✅" : "Incompatible ❌"}
                </div>
              </div>
            </Card>
          )}
        </div>
      </Modal>
    </div>
  );
}
