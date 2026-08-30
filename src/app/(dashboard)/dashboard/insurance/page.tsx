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
  cn,
} from "@/components/ui";
import { RotateCw, Plus, ShieldCheck, IndianRupee, Clock, AlertCircle, FileText, CheckCircle2, FileCheck } from "lucide-react";

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

export interface ClaimItem {
  _id?: string;
  id: string;
  claimNumber: string;
  clinicId?: { id: string; name: string } | string;
  patientId: {
    _id?: string;
    id: string;
    userId?: { name: string; email?: string; phone?: string };
  };
  invoiceId?: {
    _id?: string;
    id: string;
    invoiceNumber: string;
    totalAmount: number;
  };
  payerName: string;
  policyNumber: string;
  preAuthCode?: string;
  totalClaimAmount: number;
  approvedAmount?: number;
  copayAmount?: number;
  deductibleAmount?: number;
  rejectionReason?: string;
  status: "submitted" | "under_review" | "approved" | "rejected" | "settled";
  submittedAt?: string;
  adjudicatedAt?: string;
  createdAt?: string;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  patientId: any;
  status: string;
}

export default function InsurancePage() {
  const { user, activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"preAuth" | "claims">("preAuth");
  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");
  const [preAuths, setPreAuths] = useState<PreAuthItem[]>([]);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
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

  // Submit Claim Modal State
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimPatientId, setClaimPatientId] = useState("");
  const [claimInvoiceId, setClaimInvoiceId] = useState("");
  const [claimPayerName, setClaimPayerName] = useState("Star Health Insurance");
  const [claimPolicyNumber, setClaimPolicyNumber] = useState("");
  const [claimPreAuthCode, setClaimPreAuthCode] = useState("");
  const [claimTotalAmount, setClaimTotalAmount] = useState<number | "">(25000);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Adjudicate Claim Modal State
  const [isAdjudicateModalOpen, setIsAdjudicateModalOpen] = useState(false);
  const [activeClaim, setActiveClaim] = useState<ClaimItem | null>(null);
  const [adjudicateStatus, setAdjudicateStatus] = useState<"approved" | "rejected" | "settled" | "under_review">("approved");
  const [adjApprovedAmount, setAdjApprovedAmount] = useState<number | "">(0);
  const [adjCopayAmount, setAdjCopayAmount] = useState<number | "">(0);
  const [adjDeductibleAmount, setAdjDeductibleAmount] = useState<number | "">(0);
  const [adjRejectionReason, setAdjRejectionReason] = useState("");
  const [submittingAdjudicate, setSubmittingAdjudicate] = useState(false);

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [preAuthRes, claimsRes, patientsRes, staffRes, invoicesRes] = await Promise.all([
        api.get(selectedClinicId ? `/pre-auth?clinicId=${selectedClinicId}` : "/pre-auth"),
        api.get(selectedClinicId ? `/billing/claims?clinicId=${selectedClinicId}` : "/billing/claims").catch(() => ({ data: { data: [] } })),
        api.get("/patients"),
        api.get(selectedClinicId ? `/onboarding/staff?clinicId=${selectedClinicId}` : "/onboarding/staff"),
        api.get(selectedClinicId ? `/invoices?clinicId=${selectedClinicId}` : "/invoices").catch(() => ({ data: { data: [] } })),
      ]);

      setPreAuths(preAuthRes.data?.data || []);
      setClaims(claimsRes.data?.data || []);
      setPatients(patientsRes.data?.data || []);
      setDoctors(staffRes.data?.data?.doctors || []);
      setInvoices(invoicesRes.data?.data || []);
    } catch (err: any) {
      toast({
        title: "Failed to Fetch Insurance Records",
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

    if (updateStatus === "approved") {
      const numApproved = Number(approvedAmount);
      if (isNaN(numApproved) || numApproved <= 0) {
        toast({ title: "Validation Error", description: "Approved amount must be greater than zero", variant: "error" });
        return;
      }
      if (numApproved > activePreAuth.requestedAmount) {
        toast({
          title: "Amount Exceeds Requested Ceiling",
          description: `Approved amount (₹${numApproved.toLocaleString("en-IN")}) cannot exceed the requested cashless ceiling (₹${activePreAuth.requestedAmount.toLocaleString("en-IN")})`,
          variant: "error",
        });
        return;
      }
      if (!approvalCode.trim()) {
        toast({ title: "Validation Error", description: "TPA Authorization Code is required for approvals", variant: "error" });
        return;
      }
    }

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

  // Handle Claim Submission
  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimPatientId || !claimPayerName.trim() || !claimPolicyNumber.trim() || claimTotalAmount === "") {
      toast({ title: "Validation Error", description: "Patient, Payer, Policy Number, and Claim Amount are required", variant: "error" });
      return;
    }

    try {
      setSubmittingClaim(true);
      await api.post("/billing/claims", {
        clinicId: selectedClinicId,
        patientId: claimPatientId,
        invoiceId: claimInvoiceId || undefined,
        payerName: claimPayerName.trim(),
        policyNumber: claimPolicyNumber.trim(),
        preAuthCode: claimPreAuthCode.trim() || undefined,
        totalClaimAmount: Number(claimTotalAmount),
      });

      toast({
        title: "Insurance Claim Submitted 📑",
        description: `Claim for ₹${claimTotalAmount} submitted to ${claimPayerName}.`,
        variant: "success",
      });

      setIsClaimModalOpen(false);
      setClaimPatientId("");
      setClaimInvoiceId("");
      setClaimPolicyNumber("");
      setClaimPreAuthCode("");
      fetchData();
    } catch (err: any) {
      toast({
        title: "Claim Submission Failed",
        description: err.response?.data?.message || "Could not submit insurance claim",
        variant: "error",
      });
    } finally {
      setSubmittingClaim(false);
    }
  };

  // Handle Claim Adjudication Submit
  const handleAdjudicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cId = activeClaim?.id || activeClaim?._id;
    if (!cId || !activeClaim) return;

    if (adjudicateStatus === "approved" || adjudicateStatus === "settled") {
      const numApproved = Number(adjApprovedAmount);
      if (isNaN(numApproved) || numApproved <= 0) {
        toast({ title: "Validation Error", description: "Approved amount must be greater than zero", variant: "error" });
        return;
      }
      if (numApproved > activeClaim.totalClaimAmount) {
        toast({
          title: "Amount Exceeds Claim Total",
          description: `Approved amount (₹${numApproved.toLocaleString("en-IN")}) cannot exceed total claimed amount (₹${activeClaim.totalClaimAmount.toLocaleString("en-IN")})`,
          variant: "error",
        });
        return;
      }
    }

    if (adjudicateStatus === "rejected" && !adjRejectionReason.trim()) {
      toast({ title: "Validation Error", description: "Please provide a rejection reason", variant: "error" });
      return;
    }

    try {
      setSubmittingAdjudicate(true);
      await api.post(`/billing/claims/${cId}/adjudicate`, {
        status: adjudicateStatus,
        approvedAmount: adjApprovedAmount !== "" ? Number(adjApprovedAmount) : undefined,
        copayAmount: adjCopayAmount !== "" ? Number(adjCopayAmount) : undefined,
        deductibleAmount: adjDeductibleAmount !== "" ? Number(adjDeductibleAmount) : undefined,
        rejectionReason: adjRejectionReason.trim() || undefined,
      });

      toast({
        title: "Claim Adjudicated Successfully",
        description: `Insurance claim #${activeClaim?.claimNumber} updated to ${adjudicateStatus.toUpperCase()}`,
        variant: "success",
      });

      setIsAdjudicateModalOpen(false);
      setActiveClaim(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Adjudication Failed",
        description: err.response?.data?.message || "Could not adjudicate claim",
        variant: "error",
      });
    } finally {
      setSubmittingAdjudicate(false);
    }
  };

  // Filter PreAuths
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

  // Filter Claims
  const filteredClaims = claims.filter((item) => {
    const pName = item.patientId?.userId?.name || "";
    const matchesStatus = selectedStatusFilter === "all" || item.status === selectedStatusFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      item.claimNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.policyNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalClaimsCount = claims.length;
  const approvedClaimsTotal = claims.filter((c) => c.status === "approved" || c.status === "settled").reduce((acc, c) => acc + (c.approvedAmount || c.totalClaimAmount || 0), 0);
  const pendingClaimsCount = claims.filter((c) => c.status === "submitted" || c.status === "under_review").length;
  const settledClaimsCount = claims.filter((c) => c.status === "settled").length;

  const totalPreAuthCount = preAuths.length;
  const approvedTotalCeiling = preAuths.filter((p) => p.status === "approved").reduce((acc, p) => acc + (p.approvedAmount || 0), 0);
  const pendingPreAuthCount = preAuths.filter((p) => p.status === "submitted").length;
  const underQueryCount = preAuths.filter((p) => p.status === "under_query").length;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Insurance Desk & Claims Adjudication
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                TPA Operations
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Manage cashless pre-authorizations, query letters, final reimbursement claims, and TPA adjudication payouts.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", loading && "animate-spin")} />
              Refresh Desk
            </Button>

            {activeTab === "preAuth" ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsSubmitModalOpen(true)}
                className="font-semibold rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Submit Pre-Auth Request
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsClaimModalOpen(true)}
                className="font-semibold rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Submit Insurance Claim
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. SEGMENTED TABS SWITCHER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
        <button
          type="button"
          onClick={() => {
            setActiveTab("preAuth");
            setSelectedStatusFilter("all");
          }}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
            activeTab === "preAuth"
              ? "bg-surface text-text shadow-xs font-bold border border-border/60"
              : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
          )}
        >
          <ShieldCheck className={cn("w-3.5 h-3.5", activeTab === "preAuth" ? "text-primary-500" : "text-text-muted")} />
          <span>Pre-Authorization Requests</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
            {preAuths.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("claims");
            setSelectedStatusFilter("all");
          }}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
            activeTab === "claims"
              ? "bg-surface text-text shadow-xs font-bold border border-border/60"
              : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
          )}
        >
          <FileCheck className={cn("w-3.5 h-3.5", activeTab === "claims" ? "text-primary-500" : "text-text-muted")} />
          <span>Insurance Claims & Adjudication</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
            {claims.length}
          </span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. KPI STATS CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "preAuth" ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Pre-Auth Claims"
            value={totalPreAuthCount.toString()}
            description="Submitted policy pre-authorizations"
            icon={<ShieldCheck className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Approved Cashless Ceiling"
            value={`₹${approvedTotalCeiling.toLocaleString("en-IN")}`}
            description="Total sanctioned cashless cap"
            icon={<IndianRupee className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Pending TPA Review"
            value={pendingPreAuthCount.toString()}
            description="Awaiting initial sanction response"
            icon={<Clock className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Under Query"
            value={underQueryCount.toString()}
            description="Requires clinical docs / queries"
            icon={<AlertCircle className="w-5 h-5 text-text-secondary" />}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Insurance Claims"
            value={totalClaimsCount.toString()}
            description="Filed reimbursement/cashless claims"
            icon={<FileText className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Approved / Settled Amount"
            value={`₹${approvedClaimsTotal.toLocaleString("en-IN")}`}
            description="Total adjudicated payout"
            icon={<IndianRupee className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Pending Adjudication"
            value={pendingClaimsCount.toString()}
            description="Awaiting desk review"
            icon={<Clock className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Fully Settled Claims"
            value={settledClaimsCount.toString()}
            description="Reconciled & finalized"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          4. FILTER TOOLBAR
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 bg-surface rounded-2xl border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {activeTab === "preAuth" ? (
            <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
              <span className="text-[11px] font-bold text-text-muted px-2.5 shrink-0">TPA Partner:</span>
              {[
                { key: "all", label: "All TPAs" },
                { key: "Medi Assist", label: "Medi Assist" },
                { key: "Star Health", label: "Star Health" },
                { key: "HDFC ERGO", label: "HDFC ERGO" },
                { key: "ICICI Lombard", label: "ICICI Lombard" },
                { key: "Vidal Health", label: "Vidal Health" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedTpaFilter(t.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0",
                    selectedTpaFilter === t.key
                      ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                      : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs font-bold text-text flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary-500" />
              <span>Claims Adjudication Pipeline</span>
            </div>
          )}

          <Input
            placeholder="Search claim#, policy#, patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-60 text-xs"
          />
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
          <span className="text-[11px] font-bold text-text-muted px-2.5 shrink-0">Status:</span>
          {(activeTab === "preAuth"
            ? [
                { key: "all", label: "All Claims" },
                { key: "submitted", label: "Submitted (Pending)" },
                { key: "approved", label: "Approved Cashless" },
                { key: "under_query", label: "Under Query" },
                { key: "rejected", label: "Rejected" },
              ]
            : [
                { key: "all", label: "All Claims" },
                { key: "submitted", label: "Submitted" },
                { key: "under_review", label: "Under Review" },
                { key: "approved", label: "Approved" },
                { key: "settled", label: "Settled" },
                { key: "rejected", label: "Rejected" },
              ]
          ).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelectedStatusFilter(s.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0",
                selectedStatusFilter === s.key
                  ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                  : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. TAB 1: PRE-AUTHORIZATION REQUESTS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "preAuth" && (
        loading ? (
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
              const isTerminal = item.status === "rejected" || item.status === "cancelled";

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
                        variant={isApproved ? "success" : isUnderQuery ? "warning" : isRejected ? "danger" : "primary"}
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
                    {!isTerminal && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setActivePreAuth(item);
                          setUpdateStatus(item.status === "submitted" ? "approved" : item.status);
                          setApprovedAmount(item.approvedAmount || item.requestedAmount);
                          setApprovalCode(item.approvalCode || "");
                          setQueryNotes(item.queryNotes || "");
                          setDenialReason(item.denialReason || "");
                          setIsUpdateModalOpen(true);
                        }}
                        className="font-bold text-[11px] rounded-lg cursor-pointer"
                      >
                        ⚡ Update TPA Claim Status
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          6. TAB 2: INSURANCE CLAIMS & ADJUDICATION DESK
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "claims" && (
        loading ? (
          <div className="py-12 text-center">
            <Spinner size="md" label="Loading Insurance Claims..." />
          </div>
        ) : filteredClaims.length === 0 ? (
          <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
            <CardContent>No insurance claims found matching current filters.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClaims.map((claim) => {
              const patientName = claim.patientId?.userId?.name || "Patient Profile";
              const patientPhone = claim.patientId?.userId?.phone || "";
              const invoiceNum = claim.invoiceId?.invoiceNumber || (typeof claim.invoiceId === "string" ? claim.invoiceId : "N/A");

              const isApproved = claim.status === "approved";
              const isSettled = claim.status === "settled";
              const isRejected = claim.status === "rejected";

              return (
                <div
                  key={claim.id || claim._id}
                  className={`p-4 rounded-2xl border transition-all space-y-3.5 flex flex-col justify-between text-xs shadow-xs ${
                    isSettled
                      ? "bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-500"
                      : isApproved
                      ? "bg-blue-500/5 border-blue-500/30 hover:border-blue-500"
                      : isRejected
                      ? "bg-red-500/5 border-red-500/30 hover:border-red-500"
                      : "bg-surface border-border hover:border-primary-500"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-primary-600 bg-primary-500/10 px-2.5 py-0.5 rounded-lg border border-primary-500/20">
                        {claim.claimNumber}
                      </span>
                      <Badge
                        variant={isSettled ? "success" : isApproved ? "info" : isRejected ? "danger" : "primary"}
                        className="capitalize font-bold text-xs"
                      >
                        {claim.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <div className="pt-1.5">
                      <h3 className="font-bold text-base text-text">{claim.payerName}</h3>
                      <p className="text-[11px] text-text-muted font-mono">Policy #: {claim.policyNumber}</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Patient:</span>
                      <span className="font-bold text-text">{patientName} {patientPhone && `(${patientPhone})`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Linked Invoice:</span>
                      <span className="font-mono font-bold text-text">#{invoiceNum}</span>
                    </div>
                    {claim.preAuthCode && (
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-text-muted">Pre-Auth Code:</span>
                        <span className="font-mono font-bold text-primary-600">{claim.preAuthCode}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-surface/80 rounded-xl border border-border/40 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Claimed Total:</span>
                      <span className="font-mono font-bold text-text">₹{claim.totalClaimAmount?.toLocaleString("en-IN")}</span>
                    </div>
                    {claim.approvedAmount !== undefined && (
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-500/20 text-emerald-600 font-bold">
                        <span>Approved Payout:</span>
                        <span className="font-mono text-sm">₹{claim.approvedAmount.toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {claim.copayAmount !== undefined && claim.copayAmount > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>Patient Copay:</span>
                        <span className="font-mono">₹{claim.copayAmount.toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {claim.deductibleAmount !== undefined && claim.deductibleAmount > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>Deductible:</span>
                        <span className="font-mono">₹{claim.deductibleAmount.toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </div>

                  {isRejected && claim.rejectionReason && (
                    <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-700 dark:text-red-300">
                      <b>Rejection Reason:</b> {claim.rejectionReason}
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/60 flex items-center justify-end">
                    {claim.status !== "settled" && claim.status !== "rejected" && (
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => {
                          setActiveClaim(claim);
                          setAdjudicateStatus(claim.status === "submitted" ? "approved" : "settled");
                          setAdjApprovedAmount(claim.approvedAmount || claim.totalClaimAmount);
                          setAdjCopayAmount(claim.copayAmount || 0);
                          setAdjDeductibleAmount(claim.deductibleAmount || 0);
                          setAdjRejectionReason(claim.rejectionReason || "");
                          setIsAdjudicateModalOpen(true);
                        }}
                        className="font-bold text-[11px] rounded-lg cursor-pointer"
                      >
                        ⚖️ Adjudicate Claim
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* SUBMIT CASHLESS PRE-AUTH REQUEST MODAL */}
      <Modal open={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} title="💳 Submit Cashless Pre-Authorization Request" size="lg">
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
        <Modal open={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title={`⚡ Update TPA Status — ${activePreAuth.preAuthNumber}`}>
          <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
            <Select
              label="Update TPA Claim Status *"
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value as any)}
              options={
                activePreAuth.status === "draft"
                  ? [
                      { value: "submitted", label: "Submit to TPA" },
                      { value: "cancelled", label: "Cancel Request" },
                    ]
                  : activePreAuth.status === "under_query"
                  ? [
                      { value: "submitted", label: "Re-submitted with Docs" },
                      { value: "approved", label: "Approved Cashless Authorization" },
                      { value: "rejected", label: "Rejected / Denied by TPA" },
                      { value: "cancelled", label: "Cancel Request" },
                    ]
                  : activePreAuth.status === "approved"
                  ? [
                      { value: "cancelled", label: "Cancel Sanction" },
                    ]
                  : [
                      { value: "under_query", label: "Under Query (Clinical Docs Requested)" },
                      { value: "approved", label: "Approved Cashless Authorization" },
                      { value: "rejected", label: "Rejected / Denied by TPA" },
                      { value: "cancelled", label: "Cancel Request" },
                    ]
              }
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

      {/* SUBMIT INSURANCE CLAIM MODAL */}
      <Modal open={isClaimModalOpen} onClose={() => setIsClaimModalOpen(false)} title="📑 Submit Insurance Claim" size="lg">
        <form onSubmit={handleClaimSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Patient Profile *"
              value={claimPatientId}
              onChange={(e) => setClaimPatientId(e.target.value)}
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
              label="Linked Billing Invoice (Optional)"
              value={claimInvoiceId}
              onChange={(e) => {
                const invId = e.target.value;
                setClaimInvoiceId(invId);
                const matched = invoices.find((i) => i.id === invId);
                if (matched) setClaimTotalAmount(matched.totalAmount);
              }}
              options={[
                { value: "", label: "Select invoice (or standalone claim)..." },
                ...invoices.map((inv) => ({
                  value: inv.id,
                  label: `Invoice #${inv.invoiceNumber} — ₹${inv.totalAmount}`,
                })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Payer / TPA *"
              value={claimPayerName}
              onChange={(e) => setClaimPayerName(e.target.value)}
              options={[
                { value: "Star Health Insurance", label: "Star Health Insurance" },
                { value: "Medi Assist TPA", label: "Medi Assist TPA" },
                { value: "HDFC ERGO Health", label: "HDFC ERGO Health" },
                { value: "ICICI Lombard", label: "ICICI Lombard" },
                { value: "Niva Bupa Health Insurance", label: "Niva Bupa Health Insurance" },
                { value: "Vidal Health TPA", label: "Vidal Health TPA" },
                { value: "Care Health Insurance", label: "Care Health Insurance" },
              ]}
              required
            />

            <Input
              label="Policy Number *"
              placeholder="e.g. POL-123456"
              value={claimPolicyNumber}
              onChange={(e) => setClaimPolicyNumber(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Pre-Auth Sanction Code (if cashless)"
              placeholder="e.g. PA-998811"
              value={claimPreAuthCode}
              onChange={(e) => setClaimPreAuthCode(e.target.value)}
            />

            <Input
              label="Total Claimed Amount (₹) *"
              type="number"
              value={claimTotalAmount}
              onChange={(e) => setClaimTotalAmount(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsClaimModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingClaim}>
              Submit Claim for Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADJUDICATE CLAIM MODAL */}
      {activeClaim && (
        <Modal open={isAdjudicateModalOpen} onClose={() => setIsAdjudicateModalOpen(false)} title={`⚖️ Adjudicate Claim — ${activeClaim.claimNumber}`}>
          <form onSubmit={handleAdjudicateSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-alt rounded-xl border border-border space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted">Payer:</span>
                <span className="font-bold text-text">{activeClaim.payerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Total Claimed:</span>
                <span className="font-bold font-mono text-text">₹{activeClaim.totalClaimAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <Select
              label="Adjudication Outcome *"
              value={adjudicateStatus}
              onChange={(e) => setAdjudicateStatus(e.target.value as any)}
              options={
                activeClaim.status === "submitted"
                  ? [
                      { value: "under_review", label: "Under Review" },
                      { value: "approved", label: "Approve Payout" },
                      { value: "rejected", label: "Reject / Deny" },
                    ]
                  : activeClaim.status === "under_review"
                  ? [
                      { value: "approved", label: "Approve Payout" },
                      { value: "rejected", label: "Reject / Deny" },
                    ]
                  : [
                      { value: "settled", label: "Settled (Disburse Payment)" },
                    ]
              }
              required
            />

            {(adjudicateStatus === "approved" || adjudicateStatus === "settled") && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <Input
                  label="Approved Amount (₹) *"
                  type="number"
                  value={adjApprovedAmount}
                  onChange={(e) => setAdjApprovedAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
                <Input
                  label="Copay (₹)"
                  type="number"
                  value={adjCopayAmount}
                  onChange={(e) => setAdjCopayAmount(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <Input
                  label="Deductible (₹)"
                  type="number"
                  value={adjDeductibleAmount}
                  onChange={(e) => setAdjDeductibleAmount(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            )}

            {adjudicateStatus === "rejected" && (
              <Textarea
                label="Rejection / Denial Reason *"
                placeholder="e.g. Non-payable consumable items exceed threshold or policy expired..."
                value={adjRejectionReason}
                onChange={(e) => setAdjRejectionReason(e.target.value)}
                rows={3}
                required
              />
            )}

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdjudicateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={submittingAdjudicate}>
                Save Claim Adjudication
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
