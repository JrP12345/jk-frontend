"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  Button,
  Modal,
  Input,
  Select,
  Textarea,
  useToast,
  Badge,
  StatCard,
  Spinner,
} from "@/components/ui";

interface PatientUser {
  name: string;
  email?: string;
  phone?: string;
}

interface PatientProfile {
  id: string;
  userId: PatientUser;
}

interface DoctorUser {
  id: string;
  name: string;
  specialization?: string;
}

export interface PreAuthItem {
  id: string;
  preAuthNumber: string;
  clinicId?: { id: string; name: string };
  patientId: {
    id: string;
    userId?: { name: string; email?: string; phone?: string };
  };
  doctorId: { id: string; name: string; specialization?: string };
  tpaName: string;
  policyNumber: string;
  diagnosisCode: string;
  proposedTreatment: string;
  requestedAmount: number;
  approvedAmount?: number;
  approvalCode?: string;
  queryNotes?: string;
  denialReason?: string;
  validUntil?: string;
  status: "draft" | "submitted" | "under_query" | "approved" | "rejected" | "cancelled";
  createdAt?: string;
}

export default function InsurancePage() {
  const { user, activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");
  const [preAuths, setPreAuths] = useState<PreAuthItem[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTpaFilter, setSelectedTpaFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Submit Pre-Auth Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [tpaName, setTpaName] = useState("Medi Assist TPA");
  const [policyNumber, setPolicyNumber] = useState("");
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [proposedTreatment, setProposedTreatment] = useState("");
  const [requestedAmount, setRequestedAmount] = useState<number | "">(50000);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Update Status Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [activePreAuth, setActivePreAuth] = useState<PreAuthItem | null>(null);
  const [updateStatus, setUpdateStatus] = useState<any>("approved");
  const [approvedAmount, setApprovedAmount] = useState<number | "">(0);
  const [approvalCode, setApprovalCode] = useState("");
  const [queryNotes, setQueryNotes] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [preAuthRes, patientsRes, staffRes] = await Promise.all([
        api.get(selectedClinicId ? `/pre-auth?clinicId=${selectedClinicId}` : "/pre-auth"),
        api.get("/patients"),
        api.get(selectedClinicId ? `/onboarding/staff?clinicId=${selectedClinicId}` : "/onboarding/staff"),
      ]);

      setPreAuths(preAuthRes.data?.data || []);
      setPatients(patientsRes.data?.data || []);
      setDoctors(staffRes.data?.data?.doctors || []);
    } catch (err: any) {
      toast({
        title: "Failed to Fetch Pre-Auth Records",
        description: err.response?.data?.message || "Could not retrieve TPA claims data",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Handle Pre-Auth Submission
  const handlePreAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId || !tpaName || !policyNumber.trim() || !diagnosisCode.trim() || !proposedTreatment.trim() || requestedAmount === "") {
      toast({ title: "Validation Error", description: "All fields are required", variant: "error" });
      return;
    }

    try {
      setSubmittingRequest(true);
      await api.post("/pre-auth", {
        clinicId: selectedClinicId,
        patientId,
        doctorId,
        tpaName: tpaName.trim(),
        policyNumber: policyNumber.trim(),
        diagnosisCode: diagnosisCode.trim(),
        proposedTreatment: proposedTreatment.trim(),
        requestedAmount: Number(requestedAmount),
      });

      toast({
        title: "Pre-Authorization Submitted 💳",
        description: `Cashless pre-auth claim sent to ${tpaName}.`,
        variant: "success",
      });

      setIsSubmitModalOpen(false);
      setPatientId("");
      setPolicyNumber("");
      setDiagnosisCode("");
      setProposedTreatment("");
      fetchData();
    } catch (err: any) {
      toast({
        title: "Submission Failed",
        description: err.response?.data?.message || "Could not submit pre-authorization request",
        variant: "error",
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Handle Status Update Submit
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePreAuth) return;

    try {
      setSubmittingUpdate(true);
      await api.put(`/pre-auth/${activePreAuth.id}`, {
        status: updateStatus,
        approvedAmount: approvedAmount !== "" ? Number(approvedAmount) : undefined,
        approvalCode: approvalCode.trim() || undefined,
        queryNotes: queryNotes.trim() || undefined,
        denialReason: denialReason.trim() || undefined,
      });

      toast({
        title: "TPA Claim Status Updated",
        description: `Claim updated to ${updateStatus.toUpperCase()}`,
        variant: "success",
      });

      setIsUpdateModalOpen(false);
      setActivePreAuth(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Could not update TPA claim status",
        variant: "error",
      });
    } finally {
      setSubmittingUpdate(false);
    }
  };

  // Filter Claims
  const filteredPreAuths = preAuths.filter((item) => {
    const matchesTpa = selectedTpaFilter === "all" || item.tpaName.toLowerCase().includes(selectedTpaFilter.toLowerCase());
    const matchesStatus = selectedStatusFilter === "all" || item.status === selectedStatusFilter;
    const pName = item.patientId?.userId?.name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      item.preAuthNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.policyNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.diagnosisCode.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTpa && matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalClaims = preAuths.length;
  const approvedClaims = preAuths.filter((p) => p.status === "approved");
  const approvedTotalCeiling = approvedClaims.reduce((acc, p) => acc + (p.approvedAmount || 0), 0);
  const pendingCount = preAuths.filter((p) => p.status === "submitted").length;
  const underQueryCount = preAuths.filter((p) => p.status === "under_query").length;

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span>💳</span> Insurance Claims & TPA Pre-Authorization Desk
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Cashless pre-auth requests, TPA query tracking, ICD-10 diagnosis verification, and claim approvals.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSubmitModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5"
          >
            <span>+ Submit Pre-Auth Request</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5"
          >
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Total Pre-Auth Claims"
          value={totalClaims}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        />
        <StatCard
          label="Approved Cashless Ceiling"
          value={`₹${approvedTotalCeiling.toLocaleString("en-IN")}`}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-emerald-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Pending TPA Review"
          value={pendingCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Under Query (Docs Needed)"
          value={underQueryCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* TPA Provider & Status Filter Toolbar */}
      <div className="p-4 bg-surface rounded-2xl border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* TPA Selector Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-text-muted mr-1">TPA Partner:</span>
            {[
              { key: "all", label: "All TPAs" },
              { key: "Medi Assist", label: "Medi Assist TPA" },
              { key: "Star Health", label: "Star Health" },
              { key: "HDFC ERGO", label: "HDFC ERGO" },
              { key: "ICICI Lombard", label: "ICICI Lombard" },
              { key: "Vidal Health", label: "Vidal Health" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelectedTpaFilter(t.key)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  selectedTpaFilter === t.key
                    ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                    : "bg-surface-alt text-text-muted border-border/80 hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Input
            placeholder="Search PA#, Policy#, Patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-60 text-xs"
          />
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60 text-xs">
          <span className="font-bold text-text-muted">Claim Status:</span>
          {[
            { key: "all", label: "All Claims" },
            { key: "submitted", label: "Submitted (Pending)" },
            { key: "approved", label: "Approved Cashless" },
            { key: "under_query", label: "Under Query" },
            { key: "rejected", label: "Rejected" },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelectedStatusFilter(s.key)}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                selectedStatusFilter === s.key
                  ? "bg-primary-500/10 text-primary-600 border-primary-500 font-bold"
                  : "bg-surface-alt/60 text-text-muted border-border/60 hover:text-text"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Insurance Claims Grid */}
      {loading ? (
        <div className="py-12 text-center">
          <Spinner size="md" label="Loading Pre-Authorization Claims..." />
        </div>
      ) : filteredPreAuths.length === 0 ? (
        <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
          <CardContent>No insurance pre-authorization claims found matching current filters.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPreAuths.map((item) => {
            const patientName = item.patientId?.userId?.name || "Patient Profile";
            const patientPhone = item.patientId?.userId?.phone || "";
            const doctorName = item.doctorId?.name || "Attending Physician";

            const isApproved = item.status === "approved";
            const isUnderQuery = item.status === "under_query";
            const isRejected = item.status === "rejected";

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all space-y-3.5 flex flex-col justify-between text-xs shadow-xs ${
                  isApproved
                    ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500"
                    : isUnderQuery
                    ? "bg-purple-500/5 border-purple-500/30 hover:border-purple-500"
                    : isRejected
                    ? "bg-red-500/5 border-red-500/30 hover:border-red-500"
                    : "bg-surface border-border hover:border-primary-500"
                }`}
              >
                {/* Header Badge & PA Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-primary-600 bg-primary-500/10 px-2.5 py-0.5 rounded-lg border border-primary-500/20">
                      {item.preAuthNumber}
                    </span>
                    <Badge
                      variant={isApproved ? "success" : isUnderQuery ? "warning" : isRejected ? "error" : "neutral"}
                      className="capitalize font-bold text-xs"
                    >
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="pt-1.5">
                    <h3 className="font-bold text-base text-text">{item.tpaName}</h3>
                    <p className="text-[11px] text-text-muted font-mono">Policy #: {item.policyNumber}</p>
                  </div>
                </div>

                {/* Patient & Clinical Details */}
                <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Patient Name:</span>
                    <span className="font-bold text-text">{patientName} {patientPhone && `(${patientPhone})`}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Doctor:</span>
                    <span className="text-text font-medium">Dr. {doctorName}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-text-muted">ICD-10 Code:</span>
                    <span className="font-mono text-primary-600 font-bold">{item.diagnosisCode}</span>
                  </div>
                  <div className="text-[10px] text-text-muted italic truncate">
                    Treatment: {item.proposedTreatment}
                  </div>
                </div>

                {/* Financial Overview */}
                <div className="p-2.5 bg-surface/80 rounded-xl border border-border/40 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Requested Amount:</span>
                    <span className="font-mono font-bold text-text">₹{item.requestedAmount.toLocaleString("en-IN")}</span>
                  </div>
                  {isApproved && item.approvedAmount !== undefined && (
                    <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20 text-emerald-600 font-bold">
                      <span>Approved Cashless:</span>
                      <span className="font-mono text-sm">₹{item.approvedAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {item.approvalCode && (
                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                      <span>Auth Code:</span>
                      <span className="font-mono font-bold text-text">{item.approvalCode}</span>
                    </div>
                  )}
                </div>

                {/* Query Notes or Denial Reason if present */}
                {isUnderQuery && item.queryNotes && (
                  <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-[11px] text-purple-700 dark:text-purple-300">
                    <b>TPA Query:</b> {item.queryNotes}
                  </div>
                )}
                {isRejected && item.denialReason && (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-700 dark:text-red-300">
                    <b>Denial Reason:</b> {item.denialReason}
                  </div>
                )}

                {/* Action Footer */}
                <div className="pt-2 border-t border-border/60 flex items-center justify-end">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setActivePreAuth(item);
                      setUpdateStatus(item.status);
                      setApprovedAmount(item.approvedAmount || item.requestedAmount);
                      setApprovalCode(item.approvalCode || "");
                      setQueryNotes(item.queryNotes || "");
                      setDenialReason(item.denialReason || "");
                      setIsUpdateModalOpen(true);
                    }}
                    className="font-bold text-[11px] rounded-lg"
                  >
                    ⚡ Update TPA Claim Status
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUBMIT CASHLESS PRE-AUTH REQUEST MODAL */}
      <Modal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} title="💳 Submit Cashless Pre-Authorization Request" size="lg">
        <form onSubmit={handlePreAuthSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Target Patient Profile *"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              options={[
                { value: "", label: "Select patient..." },
                ...patients.map((p) => ({
                  value: p.id,
                  label: `${p.userId?.name || "Patient"} (${p.userId?.phone || "No phone"})`,
                })),
              ]}
              required
            />

            <Select
              label="Attending Doctor *"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              options={[
                { value: "", label: "Select attending doctor..." },
                ...doctors.map((d) => ({
                  value: d.id,
                  label: `Dr. ${d.name} (${d.specialization || "General Medicine"})`,
                })),
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="TPA / Insurance Provider *"
              value={tpaName}
              onChange={(e) => setTpaName(e.target.value)}
              options={[
                { value: "Medi Assist TPA", label: "Medi Assist TPA" },
                { value: "Star Health Insurance", label: "Star Health Insurance" },
                { value: "HDFC ERGO Health", label: "HDFC ERGO Health" },
                { value: "ICICI Lombard", label: "ICICI Lombard" },
                { value: "Niva Bupa Health Insurance", label: "Niva Bupa Health Insurance" },
                { value: "Vidal Health TPA", label: "Vidal Health TPA" },
                { value: "Heritage Health TPA", label: "Heritage Health TPA" },
              ]}
              required
            />

            <Input
              label="Policy / TPA Member Card Number *"
              placeholder="e.g. POL-99882211"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="ICD-10 Diagnosis Code *"
              placeholder="e.g. K80.20 (Calculus of gallbladder without cholecystitis)"
              value={diagnosisCode}
              onChange={(e) => setDiagnosisCode(e.target.value)}
              required
            />

            <Input
              label="Requested Cashless Amount (₹) *"
              type="number"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
          </div>

          <Textarea
            label="Proposed Surgical / Medical Treatment *"
            placeholder="e.g. Laparoscopic Cholecystectomy under General Anesthesia with 3 days IPD stay..."
            value={proposedTreatment}
            onChange={(e) => setProposedTreatment(e.target.value)}
            rows={3}
            required
          />

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSubmitModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingRequest}>
              Submit TPA Cashless Claim
            </Button>
          </div>
        </form>
      </Modal>

      {/* UPDATE TPA STATUS & APPROVAL MODAL */}
      {activePreAuth && (
        <Modal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title={`⚡ Update TPA Status — ${activePreAuth.preAuthNumber}`}>
          <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
            <Select
              label="Update TPA Claim Status *"
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value as any)}
              options={[
                { value: "submitted", label: "Submitted (Pending TPA Review)" },
                { value: "under_query", label: "Under Query (Clinical Docs Requested)" },
                { value: "approved", label: "Approved Cashless Authorization" },
                { value: "rejected", label: "Rejected / Denied by TPA" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />

            {updateStatus === "approved" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <Input
                  label="Approved Cashless Amount (₹) *"
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
                <Input
                  label="TPA Authorization Code *"
                  placeholder="e.g. MA-APPR-90124"
                  value={approvalCode}
                  onChange={(e) => setApprovalCode(e.target.value)}
                  required
                />
              </div>
            )}

            {updateStatus === "under_query" && (
              <Textarea
                label="TPA Query Notes & Requested Documents *"
                placeholder="e.g. TPA requires pre-op USG abdomen report and indoor case paper copy..."
                value={queryNotes}
                onChange={(e) => setQueryNotes(e.target.value)}
                rows={3}
                required
              />
            )}

            {updateStatus === "rejected" && (
              <Textarea
                label="TPA Denial Reason *"
                placeholder="e.g. Pre-existing disease exclusion clause #4.2 applicable..."
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={3}
                required
              />
            )}

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsUpdateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={submittingUpdate}>
                Save TPA Claim Update
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
