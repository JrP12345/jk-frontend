"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Modal,
  Input,
  Textarea,
  Select,
  useToast,
  Spinner,
  Badge,
  StatCard,
  SkeletonTable,
} from "@/components/ui";

export interface CDSEvaluationItem {
  id: string;
  patientId: {
    id: string;
    userId?: { name?: string; email?: string };
    allergies?: string[];
  };
  prescriptionIds?: string[];
  findings: Array<{
    findingType?: string;
    severity?: string;
    title?: string;
    description?: string;
    offendingItems?: string[];
    recommendation?: string;
  }>;
  clinicianDecision: "accepted" | "overridden" | "blocked";
  overrideReason?: string;
  evaluatedAt: string;
}

export interface CDSRuleItem {
  ruleId: string;
  name: string;
  category: string;
  version: string;
  status: string;
  evidence: string;
  description: string;
  samplePairs?: string[];
}

export interface PatientOption {
  id: string;
  name: string;
  allergies?: string[];
}

export default function ClinicalDecisionSupportPage() {
  const { activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<CDSEvaluationItem[]>([]);
  const [rules, setRules] = useState<CDSRuleItem[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");

  // Workspace Tabs
  const [activeTab, setActiveTab] = useState<"simulator" | "rulebook" | "audit">("simulator");

  // DDI Calculator Simulator State
  const [calcDrugA, setCalcDrugA] = useState("Warfarin 5mg");
  const [calcDrugB, setCalcDrugB] = useState("Aspirin 75mg");
  const [calcEgfr, setCalcEgfr] = useState<number>(25);
  const [calcDrugTarget, setCalcDrugTarget] = useState("Ciprofloxacin 500mg");
  const [ddiResult, setDdiResult] = useState<{
    severity: "low" | "moderate" | "high" | "critical" | "safe";
    message: string;
    actionableAdvice: string;
    findings?: any[];
  } | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Modal State
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [modalMedList, setModalMedList] = useState("Warfarin, Aspirin, Metformin");
  const [overrideReasonCode, setOverrideReasonCode] = useState("BENEFIT_OUTWEIGHS_RISK");
  const [modalOverrideNote, setModalOverrideNote] = useState("");

  // Audit Filter States
  const [auditDecisionFilter, setAuditDecisionFilter] = useState<string>("all");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  // Rulebook Search State
  const [ruleSearchQuery, setRuleSearchQuery] = useState("");

  useEffect(() => {
    fetchCdsData();
    fetchRules();
    fetchPatients();
  }, [activeClinicId]);

  const fetchPatients = async () => {
    try {
      const res = await api.get(`/patients${activeClinicId ? `?clinicId=${activeClinicId}` : ""}`);
      const list = Array.isArray(res.data?.data)
        ? res.data.data.map((patient: any) => ({
            id: patient.id || patient._id,
            name: patient.userId?.name || patient.name || "Patient Profile",
            allergies: patient.allergies || [],
          }))
        : [];
      setPatients(list);
      setSelectedPatientId((current) => (current && list.some((p: PatientOption) => p.id === current) ? current : list[0]?.id || ""));
    } catch {
      setPatients([]);
      setSelectedPatientId("");
    }
  };

  const fetchRules = async () => {
    try {
      const res = await api.get("/clinical/cds/rules");
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setRules(res.data.data);
      }
    } catch (e) {
      console.warn("Could not load CDS rulebook:", e);
    }
  };

  const fetchCdsData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/clinical/cds/evaluations${activeClinicId ? `?clinicId=${activeClinicId}` : ""}`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setEvaluations(res.data.data);
      } else {
        setEvaluations([]);
      }
    } catch (err: any) {
      console.error("Error fetching CDS evaluations:", err);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const cdsStats = {
    totalEvaluations: evaluations.length,
    criticalInteractionsBlocked: evaluations.filter((evaluation) => evaluation.clinicianDecision === "blocked").length,
    renalAdjustmentsSuggested: evaluations.reduce(
      (count, evaluation) => count + evaluation.findings.filter((finding) => finding.findingType === "dose_limit" || finding.findingType === "renal_dose").length,
      0
    ),
    overrideCompliancePercent:
      evaluations.length === 0
        ? 100
        : Math.round(
            (evaluations.filter((evaluation) => evaluation.clinicianDecision !== "overridden" || Boolean(evaluation.overrideReason?.trim())).length /
              evaluations.length) *
              100
          ),
  };

  const getEvaluationSeverity = (evaluation: CDSEvaluationItem) => {
    const severityOrder = ["critical", "major", "high", "moderate", "minor", "informational"];
    return (
      evaluation.findings
        .map((finding) => finding.severity || "informational")
        .sort((a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b))[0] || "informational"
    );
  };

  const getEvaluationItems = (evaluation: CDSEvaluationItem) =>
    Array.from(new Set(evaluation.findings.flatMap((finding) => finding.offendingItems || [])));

  // Handle DDI Calculation in Simulator
  const handleCalculateDdi = async () => {
    try {
      if (!selectedPatientId) {
        toast({ title: "Patient Required", description: "Select a patient before running a clinical safety evaluation.", variant: "warning" });
        return;
      }
      setCalculating(true);
      const meds = [calcDrugA, calcDrugB, calcDrugTarget].filter(Boolean).map((name) => ({ name }));
      const res = await api.post("/clinical/cds/check", { patientId: selectedPatientId, prescribedMedications: meds });
      const alerts = res.data?.data?.alerts || [];

      if (alerts.length > 0) {
        const topAlert = alerts[0];
        setDdiResult({
          severity: topAlert.severity || "high",
          message: topAlert.title || "DRUG INTERACTION DETECTED",
          actionableAdvice: topAlert.recommendation || topAlert.description || "Review prescription safety recommendations.",
          findings: alerts,
        });
      } else {
        setDdiResult({
          severity: "safe",
          message: "NO SEVERE DRUG-DRUG INTERACTIONS DETECTED",
          actionableAdvice: "Combination appears safe based on active clinical database rules. Proceed with standard dosage monitoring.",
          findings: [],
        });
      }
    } catch (err: any) {
      toast({
        title: "CDS Check Failed",
        description: err.response?.data?.message || "Failed to execute CDS interaction check",
        variant: "error",
      });
    } finally {
      setCalculating(false);
    }
  };

  // Run Safety Check from Modal
  const handleRunSafetyCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedPatientId) {
        toast({ title: "Patient Required", description: "Select a patient before running a clinical safety check.", variant: "warning" });
        return;
      }
      setEvaluating(true);
      const proposedPrescriptions = modalMedList
        .split(",")
        .map((medicineName) => ({ medicineName: medicineName.trim() }))
        .filter((medication) => medication.medicineName);
      const res = await api.post("/prescriptions/evaluate-safety", { patientId: selectedPatientId, proposedPrescriptions });

      if (res.data?.success) {
        const evaluation = res.data.data;
        const findings = Array.isArray(evaluation?.findings) ? evaluation.findings : [];
        const alertsCount = findings.length;

        const formattedOverrideNote = `[${overrideReasonCode.replace(/_/g, " ")}] ${modalOverrideNote.trim()}`;

        const clinicianDecision =
          evaluation?.hasHardStop || evaluation?.hasOverrideRequired
            ? modalOverrideNote.trim()
              ? "overridden"
              : "blocked"
            : "accepted";

        if (!activeClinicId) {
          throw new Error("An active clinic is required to persist the CDS evaluation");
        }

        await api.post("/prescriptions/override-evaluation", {
          clinicId: activeClinicId,
          patientId: selectedPatientId,
          findings,
          clinicianDecision,
          overrideReason: modalOverrideNote.trim() ? formattedOverrideNote : undefined,
        });

        toast({
          title: "CDS Evaluation Completed ✓",
          description: `Safety analysis complete. ${alertsCount} alert(s) generated.`,
          variant: alertsCount > 0 ? "warning" : "success",
        });

        setIsCheckModalOpen(false);
        setModalOverrideNote("");
        fetchCdsData();
      }
    } catch (err: any) {
      toast({
        title: "Safety Check Failed",
        description: err.response?.data?.message || "Failed to evaluate CDS safety.",
        variant: "error",
      });
    } finally {
      setEvaluating(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="danger">🔴 CRITICAL DDI</Badge>;
      case "high":
      case "major":
        return <Badge variant="danger">🟠 HIGH RISK</Badge>;
      case "moderate":
      case "warning":
        return <Badge variant="warning">🟡 MODERATE</Badge>;
      case "safe":
        return <Badge variant="success">🟢 SAFE</Badge>;
      default:
        return <Badge variant="info">🔵 LOW RISK</Badge>;
    }
  };

  // Filtered Audit Evaluations List
  const filteredEvaluations = evaluations.filter((ev) => {
    const matchesDecision = auditDecisionFilter === "all" || ev.clinicianDecision === auditDecisionFilter;
    const pName = ev.patientId?.userId?.name || "";
    const itemsStr = getEvaluationItems(ev).join(" ");
    const matchesSearch =
      !auditSearchQuery.trim() ||
      pName.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      itemsStr.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      (ev.overrideReason && ev.overrideReason.toLowerCase().includes(auditSearchQuery.toLowerCase()));

    return matchesDecision && matchesSearch;
  });

  // Filtered Rules List
  const filteredRules = rules.filter((r) => {
    const q = ruleSearchQuery.toLowerCase();
    return (
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.ruleId.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span className="text-rose-500">🛡️</span> Clinical Decision Support (CDS) Governance Engine
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Automated drug-drug interaction (DDI) screening, renal dose adjustments, allergy cross-reactivity, and medico-legal override auditing.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCheckModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
          >
            <span>+ Run Clinical Safety Evaluation</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchCdsData}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5 text-xs"
          >
            <span>Refresh Desk</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Total CDS Evaluations"
          value={cdsStats.totalEvaluations}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-rose-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        />
        <StatCard
          label="Critical DDIs Blocked"
          value={cdsStats.criticalInteractionsBlocked}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-red-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
        />
        <StatCard
          label="Renal Dose Adjustments"
          value={cdsStats.renalAdjustmentsSuggested}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.595 15.1a2 2 0 00-1.8 1.4L3.1 19.3a2 2 0 001.8 2.7h14.2a2 2 0 001.8-2.7l-.672-2.872z" /></svg>}
        />
        <StatCard
          label="Override Audit Compliance"
          value={`${cdsStats.overrideCompliancePercent}%`}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Main Workspace Navigation Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt rounded-2xl border border-border/80 text-xs font-bold w-full md:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("simulator")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "simulator" ? "bg-surface text-rose-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          ⚡ Interactive DDI & Dose Simulator
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rulebook")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "rulebook" ? "bg-surface text-rose-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          📖 Active CDS Rulebook ({rules.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === "audit" ? "bg-surface text-rose-600 shadow-xs" : "text-text-muted hover:text-text"
          }`}
        >
          🛡️ Audit Trail & Clinician Overrides ({evaluations.length})
        </button>
      </div>

      {/* TAB 1: INTERACTIVE DRUG INTERACTION & RENAL DOSE SIMULATOR */}
      {activeTab === "simulator" && (
        <Card className="p-5 bg-surface border-border/80 rounded-2xl shadow-xs space-y-4">
          <CardHeader className="p-0 pb-2 border-b border-border/60">
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <span>⚡</span> Interactive Drug-Drug Interaction & Renal Impairment Simulator
            </CardTitle>
            <p className="text-xs text-text-muted">
              Simulate medication combinations against patient allergies, renal eGFR thresholds, and active prescription records.
            </p>
          </CardHeader>

          <CardContent className="p-0 space-y-4 pt-2">
            {/* Patient Selection & Allergy Preview Box */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-8">
                <Select
                  label="Select Patient Context for Evaluation *"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  options={patients.map((patient) => ({
                    value: patient.id,
                    label: `${patient.name} ${patient.allergies && patient.allergies.length > 0 ? `(Allergies: ${patient.allergies.join(", ")})` : ""}`,
                  }))}
                  placeholder={patients.length ? "Select patient..." : "No patients available"}
                  disabled={patients.length === 0}
                />
              </div>

              {selectedPatient && (
                <div className="md:col-span-4 p-2.5 bg-surface-alt rounded-xl border border-border/60 text-xs">
                  <span className="font-bold text-text block text-[11px]">Patient Hypersensitivity Register:</span>
                  {selectedPatient.allergies && selectedPatient.allergies.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {selectedPatient.allergies.map((a, i) => (
                        <Badge key={i} variant="danger" className="text-[10px] font-bold">
                          ⚠️ {a}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-text-muted italic text-[11px]">No documented drug allergies recorded.</span>
                  )}
                </div>
              )}
            </div>

            {/* Medication Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-text mb-1">Primary Medication A</label>
                <Input
                  value={calcDrugA}
                  onChange={(e) => setCalcDrugA(e.target.value)}
                  placeholder="e.g. Warfarin 5mg"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Co-Prescribed Medication B</label>
                <Input
                  value={calcDrugB}
                  onChange={(e) => setCalcDrugB(e.target.value)}
                  placeholder="e.g. Aspirin 75mg"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Patient eGFR (mL/min)</label>
                <Input
                  type="number"
                  value={calcEgfr}
                  onChange={(e) => setCalcEgfr(Number(e.target.value))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Target Antibiotic / Agent</label>
                <Input
                  value={calcDrugTarget}
                  onChange={(e) => setCalcDrugTarget(e.target.value)}
                  placeholder="e.g. Ciprofloxacin"
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                variant="primary"
                onClick={handleCalculateDdi}
                loading={calculating}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2 rounded-xl cursor-pointer"
              >
                <span>⚡ Evaluate Clinical Safety Rules</span>
              </Button>
            </div>

            {/* DDI Results Card Drawer */}
            {ddiResult && (
              <div
                className={`p-4 rounded-2xl border space-y-3 transition-all ${
                  ddiResult.severity === "critical"
                    ? "bg-red-500/10 border-red-500/50 text-red-950 dark:text-red-200"
                    : ddiResult.severity === "high" || (ddiResult.severity as string) === "major"
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-950 dark:text-amber-200"
                    : "bg-emerald-500/10 border-emerald-500/50 text-emerald-950 dark:text-emerald-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-sm">
                  <span className="flex items-center gap-2">{ddiResult.message}</span>
                  {getSeverityBadge(ddiResult.severity)}
                </div>

                <p className="text-xs leading-relaxed opacity-90">{ddiResult.actionableAdvice}</p>

                {ddiResult.findings && ddiResult.findings.length > 1 && (
                  <div className="pt-2 border-t border-border/40 space-y-2">
                    <span className="font-bold text-[11px] uppercase tracking-wider block">Additional Safety Findings Identified:</span>
                    {ddiResult.findings.slice(1).map((f: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-surface/80 rounded-xl border border-border/50 text-xs text-text space-y-0.5">
                        <span className="font-bold text-rose-600 block">{f.title}</span>
                        <p className="text-[11px] text-text-muted">{f.description || f.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: ACTIVE CDS RULEBOOK & EVIDENCE INSPECTOR */}
      {activeTab === "rulebook" && (
        <div className="space-y-4">
          <div className="p-4 bg-surface rounded-2xl border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="font-bold text-sm text-text">Active Clinical Decision Support Rules</h3>
              <p className="text-xs text-text-muted">Evidence-based safety rules loaded into the active decision engine.</p>
            </div>

            <Input
              placeholder="Search rule ID, category, medication..."
              value={ruleSearchQuery}
              onChange={(e) => setRuleSearchQuery(e.target.value)}
              className="w-full md:w-72 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map((r) => (
              <div key={r.ruleId} className="p-4 bg-surface rounded-2xl border border-border hover:border-rose-500/50 transition-all space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-rose-600 bg-rose-500/10 px-2.5 py-0.5 rounded-lg border border-rose-500/20">
                    {r.ruleId}
                  </span>
                  <Badge variant="success" className="font-bold text-xs uppercase">
                    {r.status} (v{r.version})
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-text">{r.name}</h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">{r.description}</p>
                </div>

                <div className="p-2.5 bg-surface-alt rounded-xl border border-border/60 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-text-muted font-medium">Evidence Citation:</span>
                    <span className="font-bold text-text">{r.evidence}</span>
                  </div>
                  {r.samplePairs && r.samplePairs.length > 0 && (
                    <div className="pt-1 border-t border-border/40 text-text">
                      <span className="text-text-muted block">Trigger Conditions:</span>
                      <span className="font-mono text-rose-600 font-semibold">{r.samplePairs.join(" · ")}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: IMMUTABLE AUDIT TRAIL & CLINICIAN OVERRIDES */}
      {activeTab === "audit" && (
        <Card className="shadow-xs border border-border rounded-2xl bg-surface">
          <CardHeader className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-text">
                Clinical Decision Support Audit Trail & Overrides
              </CardTitle>
              <p className="text-xs text-text-muted">
                Immutable audit log of all high-risk drug interaction alerts and clinician override justifications.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={auditDecisionFilter}
                onChange={(e) => setAuditDecisionFilter(e.target.value)}
                options={[
                  { value: "all", label: "All Decisions" },
                  { value: "overridden", label: "Overridden" },
                  { value: "blocked", label: "Blocked" },
                  { value: "accepted", label: "Accepted" },
                ]}
                className="w-36 text-xs"
              />

              <Input
                placeholder="Search patient, medication..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                className="w-48 text-xs"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={4} cols={5} />
              </div>
            ) : filteredEvaluations.length === 0 ? (
              <div className="p-12 text-center text-text-muted space-y-2">
                <div className="text-3xl">🛡️</div>
                <p className="text-xs font-semibold">No CDS evaluations recorded matching current filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredEvaluations.map((ev) => (
                  <div key={ev.id} className="p-4 hover:bg-surface-alt/50 transition-colors space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-600 font-black flex items-center justify-center text-xs border border-rose-500/20">
                          CDS
                        </div>
                        <div>
                          <div className="font-bold text-text text-sm flex items-center gap-2">
                            Patient: {ev.patientId?.userId?.name || "Patient Profile"}
                            <span className="text-xs text-text-muted font-normal"> · Decision: <strong className="capitalize">{ev.clinicianDecision}</strong></span>
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Items Analyzed: <strong className="text-text font-semibold">{getEvaluationItems(ev).join(", ") || "Prescription Regimen"}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(getEvaluationSeverity(ev))}
                        {ev.clinicianDecision === "overridden" && <Badge variant="warning" className="font-bold">⚠️ OVERRIDDEN</Badge>}
                      </div>
                    </div>

                    {ev.findings.length > 0 && (
                      <div className="space-y-1.5 bg-surface-alt/70 p-3 rounded-xl border border-border/60">
                        {ev.findings.map((finding, i) => (
                          <div key={i} className="text-xs space-y-0.5">
                            <span className="font-bold text-rose-600">
                              Finding #{i + 1}: {finding.title || finding.findingType || "Clinical safety finding"}
                            </span>
                            <p className="text-text-muted text-[11px]">{finding.description || finding.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {ev.overrideReason && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-amber-600 flex items-center gap-1">
                          📝 Clinician Override Justification Note:
                        </span>
                        <p className="text-amber-950 dark:text-amber-200 italic">{ev.overrideReason}</p>
                      </div>
                    )}

                    <div className="text-right text-[10px] text-text-muted">
                      Evaluated At: {new Date(ev.evaluatedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RUN SAFETY EVALUATION MODAL */}
      <Modal
        isOpen={isCheckModalOpen}
        onClose={() => setIsCheckModalOpen(false)}
        title="🛡️ Run Clinical Decision Support Safety Check"
        size="md"
      >
        <form onSubmit={handleRunSafetyCheck} className="space-y-4 text-xs">
          <Select
            label="Patient Context *"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            options={patients.map((patient) => ({ value: patient.id, label: patient.name }))}
            placeholder={patients.length ? "Select patient..." : "No patients available"}
            disabled={patients.length === 0}
            required
          />

          <div>
            <label className="block text-xs font-bold text-text mb-1">
              Comma-Separated Drug Combination *
            </label>
            <Input
              value={modalMedList}
              onChange={(e) => setModalMedList(e.target.value)}
              placeholder="e.g. Warfarin, Aspirin, Clopidogrel"
              className="text-xs"
              required
            />
            <p className="text-[11px] text-text-muted mt-1">Input medication names to trigger automated rule-based DDI screening.</p>
          </div>

          <Select
            label="Clinician Override Reason Code (If High Risk)"
            value={overrideReasonCode}
            onChange={(e) => setOverrideReasonCode(e.target.value)}
            options={[
              { value: "BENEFIT_OUTWEIGHS_RISK", label: "Clinical Benefit Outweighs Risk" },
              { value: "MONITORING_LABS_ORDERED", label: "Close Laboratory Monitoring Ordered (INR/Potassium)" },
              { value: "PATIENT_TOLERATING_THERAPY", label: "Patient Currently Tolerating Co-therapy" },
              { value: "ALTERNATIVE_UNAVAILABLE", label: "No Non-interacting Alternative Available" },
            ]}
          />

          <div>
            <label className="block text-xs font-bold text-text mb-1">
              Clinical Justification Note
            </label>
            <Textarea
              rows={3}
              value={modalOverrideNote}
              onChange={(e) => setModalOverrideNote(e.target.value)}
              placeholder="State clinical rationale for high-risk drug combination if overriding CDS warning..."
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCheckModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={evaluating} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
              Run CDS Evaluation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
