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
  cn,
} from "@/components/ui";
import { DICOMViewerModal, ImagingStudyItem } from "@/components/clinical/DicomViewerModal";
import { RotateCw, Scan, Clock, CheckCircle2, Activity, Eye, FileText, Upload, Plus } from "lucide-react";

interface PatientUser {
  name: string;
  email?: string;
  phone?: string;
}

interface PatientProfile {
  id: string;
  userId: PatientUser;
}

export default function RadiologyPage() {
  const { user, activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");
  const [studies, setStudies] = useState<ImagingStudyItem[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedModality, setSelectedModality] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Order Study Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [modality, setModality] = useState<"CR" | "DX" | "CT" | "MR" | "US" | "MG">("CT");
  const [studyDescription, setStudyDescription] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // DICOM Viewer Modal State
  const [activeViewerStudy, setActiveViewerStudy] = useState<ImagingStudyItem | null>(null);

  // Sign Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeReportStudy, setActiveReportStudy] = useState<ImagingStudyItem | null>(null);
  const [radiologyReportText, setRadiologyReportText] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (user?.role === "patient") {
        const studiesRes = await api.get(selectedClinicId ? `/radiology/studies?clinicId=${selectedClinicId}` : "/radiology/studies");
        setStudies(studiesRes.data?.data || []);
      } else {
        const [studiesRes, patientsRes] = await Promise.all([
          api.get(selectedClinicId ? `/radiology/studies?clinicId=${selectedClinicId}` : "/radiology/studies"),
          api.get("/patients"),
        ]);

        setStudies(studiesRes.data?.data || []);
        setPatients(patientsRes.data?.data || []);
      }
    } catch (err: any) {
      toast({
        title: "Failed to Fetch Radiology Data",
        description: err.response?.data?.message || "Could not retrieve DICOM imaging studies",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Order Imaging Study Submit
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !modality || !studyDescription.trim()) {
      toast({ title: "Validation Error", description: "Patient, modality, and study description are required", variant: "error" });
      return;
    }

    try {
      setSubmittingOrder(true);
      await api.post("/radiology/studies", {
        clinicId: selectedClinicId,
        patientId,
        modality,
        studyDescription: studyDescription.trim(),
      });

      toast({
        title: "Imaging Study Requested 🖼️",
        description: `Registered PACS DICOM ${modality} study order.`,
        variant: "success",
      });

      setIsOrderModalOpen(false);
      setPatientId("");
      setStudyDescription("");
      fetchData();
    } catch (err: any) {
      toast({
        title: "Order Failed",
        description: err.response?.data?.message || "Failed to order imaging study",
        variant: "error",
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Sign Radiology Report Submit
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReportStudy || !radiologyReportText.trim()) return;

    try {
      setSubmittingReport(true);
      await api.put(`/radiology/studies/${activeReportStudy.id}/report`, {
        radiologyReport: radiologyReportText.trim(),
      });

      toast({
        title: "Radiology Report Signed 📝",
        description: "Report attached to patient EHR & PACS study record.",
        variant: "success",
      });

      setIsReportModalOpen(false);
      setActiveReportStudy(null);
      setRadiologyReportText("");
      fetchData();
    } catch (err: any) {
      toast({
        title: "Signing Failed",
        description: err.response?.data?.message || "Failed to sign radiology report",
        variant: "error",
      });
    } finally {
      setSubmittingReport(false);
    }
  };

  // Status Switcher
  const handleUpdateStatus = async (studyId: string, nextStatus: string) => {
    try {
      await api.put(`/radiology/studies/${studyId}/status`, { status: nextStatus });
      toast({
        title: "Study Status Updated",
        description: `Status changed to ${nextStatus.toUpperCase()}`,
        variant: "success",
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Could not update study status",
        variant: "error",
      });
    }
  };

  // Filtering Logic
  const filteredStudies = studies.filter((study) => {
    const matchesModality = selectedModality === "all" || study.modality === selectedModality;
    const matchesStatus = selectedStatus === "all" || study.status === selectedStatus;
    const pName = study.patientId?.userId?.name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      pName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      study.studyDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      study.studyInstanceUid.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesModality && matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalStudies = studies.length;
  const requestedCount = studies.filter((s) => s.status === "requested").length;
  const reportedCount = studies.filter((s) => s.status === "reported").length;
  const ctMrCount = studies.filter((s) => s.modality === "CT" || s.modality === "MR").length;

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
                Radiology PACS & Imaging
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Imaging & PACS
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Web DICOM viewer, multi-modality diagnostic review, radiation exposure tracking, and radiology sign-offs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", loading && "animate-spin")} />
              Refresh
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsOrderModalOpen(true)}
              className="font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Order Imaging Study
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Imaging Studies"
          value={totalStudies.toString()}
          description="Registered radiology series"
          icon={<Scan className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Pending Scans"
          value={requestedCount.toString()}
          description="Awaiting modality capture"
          icon={<Clock className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Reported Studies"
          value={reportedCount.toString()}
          description="Signed & finalized reports"
          icon={<CheckCircle2 className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Advanced CT / MRI"
          value={ctMrCount.toString()}
          description="High-resolution volumetric series"
          icon={<Activity className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      {/* Filter Bar & Modality Tabs */}
      <div className="p-3.5 sm:p-4 bg-surface rounded-2xl border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Modality Selector Pills */}
          <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
            <span className="text-[11px] font-bold text-text-muted px-2.5 shrink-0">Modality:</span>
            {[
              { key: "all", label: "All Modalities" },
              { key: "CT", label: "CT Scan" },
              { key: "MR", label: "MRI (3T/1.5T)" },
              { key: "DX", label: "X-Ray (DX/CR)" },
              { key: "US", label: "Ultrasound" },
              { key: "MG", label: "Mammography" },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedModality(m.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0",
                  selectedModality === m.key
                    ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                    : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <Input
            placeholder="Search patient, study description, UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64 text-xs"
          />
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
          <span className="text-[11px] font-bold text-text-muted px-2.5 shrink-0">Status:</span>
          {[
            { key: "all", label: "All Statuses" },
            { key: "requested", label: "Requested" },
            { key: "in_progress", label: "In Progress" },
            { key: "completed", label: "Scan Completed" },
            { key: "reported", label: "Report Signed" },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelectedStatus(s.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0",
                selectedStatus === s.key
                  ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                  : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Studies Table Card */}
      <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <Table
          loading={loading}
          searchPlaceholder="Filter radiology studies..."
          columns={[
            { header: "Patient", key: "patient" },
            { header: "Modality", key: "modality" },
            { header: "Study Description", key: "description" },
            { header: "PACS Instance UID", key: "uid" },
            { header: "Status", key: "status" },
            { header: "Actions", key: "actions", align: "right" },
          ]}
          data={filteredStudies.map((study) => {
            const patientName = study.patientId?.userId?.name || "Patient";
            const patientPhone = study.patientId?.userId?.phone;

            return {
              id: study.id,
              patient: (
                <div>
                  <div className="font-bold text-text">{patientName}</div>
                  {patientPhone && <div className="text-[11px] text-text-muted">{patientPhone}</div>}
                </div>
              ),
              modality: (
                <Badge
                  variant={
                    study.modality === "CT" || study.modality === "MR"
                      ? "primary"
                      : study.modality === "US"
                      ? "success"
                      : "neutral"
                  }
                  className="font-bold font-mono text-xs px-2.5 py-0.5"
                >
                  {study.modality}
                </Badge>
              ),
              description: (
                <div className="max-w-xs">
                  <div className="font-semibold text-text truncate">{study.studyDescription}</div>
                  <div className="text-[10px] text-text-muted">
                    Requested: {new Date(study.createdAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              ),
              uid: (
                <span className="font-mono text-[11px] text-text-muted truncate max-w-[150px] inline-block" title={study.studyInstanceUid}>
                  {study.studyInstanceUid}
                </span>
              ),
              status: (
                <Badge
                  variant={
                    study.status === "reported"
                      ? "success"
                      : study.status === "in_progress"
                      ? "warning"
                      : "neutral"
                  }
                  size="sm"
                  className="capitalize font-bold"
                >
                  {study.status}
                </Badge>
              ),
              actions: (
                <div className="flex items-center justify-end gap-1.5">
                  {/* DICOM Viewer Launcher */}
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setActiveViewerStudy(study)}
                    className="font-bold text-[11px] rounded-lg"
                    title="Launch DICOM Viewer"
                  >
                    🖼️ View DICOM
                  </Button>

                  {/* Sign Radiology Report */}
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setActiveReportStudy(study);
                      setRadiologyReportText(study.radiologyReport || "");
                      setIsReportModalOpen(true);
                    }}
                    className="font-bold text-[11px] text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    title="Draft / Sign Radiology Report"
                  >
                    📝 Report
                  </Button>

                  {/* Status Progress Trigger */}
                  {study.status === "requested" && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleUpdateStatus(study.id, "in_progress")}
                      className="font-semibold text-[10px] rounded-lg"
                      title="Start Scan"
                    >
                      ▶ Start
                    </Button>
                  )}
                </div>
              ),
            };
          })}
        />
      </Card>

      {/* ORDER IMAGING STUDY MODAL */}
      <Modal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} title="🖼️ Order PACS DICOM Imaging Study">
        <form onSubmit={handleOrderSubmit} className="space-y-4 text-xs">
          <Select
            label="Target Patient *"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            options={[
              { value: "", label: "Select patient profile..." },
              ...patients.map((p) => ({
                value: p.id,
                label: `${p.userId?.name || "Patient"} (${p.userId?.phone || "No phone"})`,
              })),
            ]}
            required
          />

          <Select
            label="Imaging Modality *"
            value={modality}
            onChange={(e) => setModality(e.target.value as any)}
            options={[
              { value: "CT", label: "Computed Tomography (CT)" },
              { value: "MR", label: "Magnetic Resonance Imaging (MRI)" },
              { value: "DX", label: "Digital Radiography (DX / X-Ray)" },
              { value: "CR", label: "Computed Radiography (CR)" },
              { value: "US", label: "Diagnostic Ultrasound (US)" },
              { value: "MG", label: "Mammography (MG)" },
            ]}
            required
          />

          <Textarea
            label="Study Description / Clinical Indication *"
            placeholder="e.g. High resolution chest CT with IV contrast for acute pulmonary embolism evaluation..."
            value={studyDescription}
            onChange={(e) => setStudyDescription(e.target.value)}
            rows={3}
            required
          />

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingOrder}>
              Register PACS Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* SIGN RADIOLOGY REPORT MODAL */}
      {activeReportStudy && (
        <Modal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          title={`📝 Sign Radiology Clinical Report — ${activeReportStudy.modality}`}
          size="lg"
        >
          <form onSubmit={handleReportSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-alt rounded-xl border border-border space-y-1">
              <span className="font-bold text-text block font-mono">
                UID: {activeReportStudy.studyInstanceUid}
              </span>
              <p className="text-text-secondary">
                Patient: <b>{activeReportStudy.patientId?.userId?.name}</b> · {activeReportStudy.studyDescription}
              </p>
            </div>

            <Textarea
              label="Radiology Report Findings & Clinical Impression *"
              placeholder="e.g. CLINICAL HISTORY: Dyspnea and chest pain...\n\nFINDINGS: Lungs are clear bilaterally. No pleural effusion or pneumothorax...\n\nIMPRESSION: Normal digital chest radiograph."
              value={radiologyReportText}
              onChange={(e) => setRadiologyReportText(e.target.value)}
              rows={8}
              required
            />

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsReportModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={submittingReport}>
                Sign & Attach Radiology Report
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* INTERACTIVE DICOM PACS VIEWER MODAL */}
      <DICOMViewerModal
        isOpen={!!activeViewerStudy}
        onClose={() => setActiveViewerStudy(null)}
        study={activeViewerStudy}
      />
    </div>
  );
}
