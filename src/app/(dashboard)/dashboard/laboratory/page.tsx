"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, Select, Textarea, useToast, Spinner, Badge, StatCard, ImageUpload, SkeletonTable, Dropdown, ConfirmDialog,
  ChartContainer, DonutChart, cn
} from "@/components/ui";
import { useR2Upload } from "@/hooks/useR2Upload";
import { Activity, Layers, RotateCw, Plus, FlaskConical, Clock, CheckCircle2 } from "lucide-react";

const LAB_DEPARTMENTS = ["Biochemistry", "Hematology", "Radiology", "Microbiology", "Immunology", "Pathology", "Urinalysis", "Cardiology"];

interface PatientProfile {
  id: string;
  userId: { name: string; email: string; phone: string };
}

interface DoctorUser {
  id: string;
  name: string;
  specialization?: string;
}

interface LabTestType {
  id: string;
  clinicId: string;
  name: string;
  code: string;
  department: string;
  sampleType: string;
  price: number;
  normalRange: string;
}

interface LabOrderType {
  id: string;
  clinicId: string;
  patientId: PatientProfile;
  doctorId: DoctorUser;
  testId: {
    id: string;
    name: string;
    code: string;
    department: string;
    sampleType: string;
    normalRange: string;
    price: number;
  };
  orderDate: string;
  status: "ordered" | "sample-collected" | "processing" | "result-uploaded" | "cancelled";
  resultValue?: string;
  resultNotes?: string;
  attachmentUrl?: string;
  completedDate?: string | null;
}

export default function LaboratoryPage() {
  const { user, activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"worklist" | "catalog" | "patientVault">("worklist");
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);
  const [labTests, setLabTests] = useState<LabTestType[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderType[]>([]);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [tatMetrics, setTatMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const isAll = !selectedClinicId || selectedClinicId === "all";
      if (user?.role === "patient") {
        const [testsRes, ordersRes] = await Promise.all([
          api.get(!isAll ? `/lab-tests?clinicId=${selectedClinicId}` : "/lab-tests"),
          api.get(!isAll ? `/lab-orders?clinicId=${selectedClinicId}` : "/lab-orders"),
        ]);
        setLabTests(testsRes.data?.data || []);
        setLabOrders(ordersRes.data?.data || []);
      } else {
        const [testsRes, ordersRes, docRes, tatRes] = await Promise.all([
          api.get(!isAll ? `/lab-tests?clinicId=${selectedClinicId}` : "/lab-tests"),
          api.get(!isAll ? `/lab-orders?clinicId=${selectedClinicId}` : "/lab-orders"),
          api.get(!isAll ? `/onboarding/staff?clinicId=${selectedClinicId}` : "/onboarding/staff"),
          api.get(!isAll ? `/lab/tat-metrics?clinicId=${selectedClinicId}` : "/lab/tat-metrics"),
        ]);

        setLabTests(testsRes.data?.data || []);
        setLabOrders(ordersRes.data?.data || []);
        setDoctors(docRes.data?.data?.doctors || []);
        setTatMetrics(tatRes.data?.data || null);
      }
    } catch (err) {
      // Non-critical
    } finally {
      setLoading(false);
    }
  };

  // Validation & Upload States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const { uploadFile, isUploading, progress } = useR2Upload({
    onError: (err) => {
      toast({ title: "Upload Failed", description: err.message, variant: "error" });
    }
  });

  // New Order Modal State
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Add/Edit Test Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [testName, setTestName] = useState("");
  const [testCode, setTestCode] = useState("");
  const [testDepartment, setTestDepartment] = useState("");
  const [testSampleType, setTestSampleType] = useState("");
  const [testPrice, setTestPrice] = useState(0);
  const [testNormalRange, setTestNormalRange] = useState("");
  const [submittingTest, setSubmittingTest] = useState(false);

  // Result Upload Modal State
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<LabOrderType | null>(null);
  const [resultValue, setResultValue] = useState("");
  const [resultNotes, setResultNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [submittingResult, setSubmittingResult] = useState(false);

  // Print Report Modal State
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<LabOrderType | null>(null);

  const validateField = (field: string, value: any) => {
    let error = "";
    if (field === "name" && !value.trim()) {
      error = "Test Name is required";
    } else if (field === "code" && !value.trim()) {
      error = "Test Code is required";
    } else if (field === "department" && !value) {
      error = "Department Group is required";
    } else if (field === "sampleType" && !value.trim()) {
      error = "Sample Material Type is required";
    } else if (field === "price" && (isNaN(Number(value)) || Number(value) <= 0)) {
      error = "Price must be a positive number";
    } else if (field === "normalRange" && !value.trim()) {
      error = "Normal Range Reference is required";
    }

    setErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!testName.trim()) newErrors.name = "Test Name is required";
    if (!testCode.trim()) newErrors.code = "Test Code is required";
    if (!testDepartment) newErrors.department = "Department Group is required";
    if (!testSampleType.trim()) newErrors.sampleType = "Sample Material Type is required";
    if (testPrice <= 0) newErrors.price = "Price must be a positive number";
    if (!testNormalRange.trim()) newErrors.normalRange = "Normal Range Reference is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Initial Fetch: Clinics & Doctors
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [clinicsRes, staffRes] = await Promise.all([
          api.get("/onboarding/clinics"),
          api.get("/onboarding/staff")
        ]);
        const clinicsList = clinicsRes.data.data || [];
        setClinics(clinicsList);
        setDoctors(staffRes.data.data.doctors || []);
      } catch (err) {
        toast({ title: "Error", description: "Failed to load clinic or staff lists", variant: "error" });
      }
    };

    if (user) {
      if (user.role === "patient") {
        setActiveTab("patientVault");
        setSelectedClinicId("all");
      } else {
        setActiveTab("worklist");
        fetchMetadata();
      }
    }
  }, [user]);

  useEffect(() => {
    if (selectedClinicId) {
      fetchData();
    }
  }, [selectedClinicId]);

  // Patient Lookup
  const handlePatientSearch = async (val: string) => {
    setPatientSearch(val);
    if (val.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const res = await api.get(`/patients?search=${val}`);
      setPatientResults(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.userId.name);
    setPatientResults([]);
  };

  // Submit Lab Order
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !selectedTestId || !selectedDoctorId) {
      toast({ title: "Validation Error", description: "Please configure all order parameters", variant: "warning" });
      return;
    }

    try {
      setSubmittingOrder(true);
      await api.post("/lab-orders", {
        clinicId: selectedClinicId,
        patientId: selectedPatient.id,
        doctorId: selectedDoctorId,
        testId: selectedTestId
      });

      toast({ title: "Success", description: "Lab diagnostic order placed", variant: "success" });
      setIsOrderOpen(false);
      setSelectedPatient(null);
      setPatientSearch("");
      setSelectedTestId("");
      setSelectedDoctorId("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Order Failed", description: err.response?.data?.message || "Internal server error", variant: "error" });
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Submit Test Catalog Entry
  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({ title: "Validation Error", description: "Please configure all catalog test options correctly", variant: "warning" });
      return;
    }

    try {
      setSubmittingTest(true);
      const payload = {
        clinicId: selectedClinicId,
        name: testName,
        code: testCode,
        department: testDepartment,
        sampleType: testSampleType,
        price: testPrice,
        normalRange: testNormalRange
      };

      if (editingTestId) {
        await api.put(`/lab-tests/${editingTestId}`, payload);
        toast({ title: "Success", description: "Catalog entry updated", variant: "success" });
      } else {
        await api.post("/lab-tests", payload);
        toast({ title: "Success", description: "Lab test registered in catalog", variant: "success" });
      }

      setIsTestModalOpen(false);
      setEditingTestId(null);
      setTestName("");
      setTestCode("");
      setTestDepartment("");
      setTestSampleType("");
      setTestPrice(0);
      setTestNormalRange("");
      setErrors({});
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Server error", variant: "error" });
    } finally {
      setSubmittingTest(false);
    }
  };

  // Delete Lab Test State & Handler
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);

  const handleDeleteTest = async () => {
    if (!deletingTestId) return;
    try {
      await api.delete(`/lab-tests/${deletingTestId}`);
      toast({ title: "Success", description: "Test deleted from catalog", variant: "warning" });
      setDeletingTestId(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Deletion Failed", description: err.response?.data?.message || "Server error", variant: "error" });
    }
  };

  // Collect Sample Handler
  const handleCollectSample = async (orderId: string) => {
    try {
      await api.put(`/lab-orders/${orderId}/sample`);
      toast({ title: "Sample Collected", description: "Status updated to sample collected", variant: "success" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update status", variant: "error" });
    }
  };

  // Submit Result Upload
  const handleResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !resultValue) return;

    try {
      setSubmittingResult(true);
      await api.put(`/lab-orders/${activeOrder.id}/result`, {
        resultValue,
        resultNotes,
        attachmentUrl
      });

      toast({ title: "Results Saved", description: "Diagnostic values reported successfully", variant: "success" });
      setIsResultOpen(false);
      setActiveOrder(null);
      setResultValue("");
      setResultNotes("");
      setAttachmentUrl("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to upload result", variant: "error" });
    } finally {
      setSubmittingResult(false);
    }
  };

  // Handle Browser Printing of Report Slip
  const handlePrintReport = (order: LabOrderType) => {
    setPrintOrder(order);
    setIsPrintOpen(true);
  };

  const executePrint = () => {
    const printContent = document.getElementById("printable-lab-slip");
    if (!printContent) return;
    const winPrint = window.open("", "", "left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0");
    if (!winPrint) return;
    winPrint.document.write(`
      <html>
        <head>
          <title>Diagnostic Laboratory Report</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
            .section { margin-bottom: 25px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
            .grid-item span { font-weight: bold; color: #555; }
            table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; }
            .notes { background: #f9f9f9; border-left: 4px solid #0d9488; padding: 15px; margin-top: 30px; font-style: italic; }
            .footer { margin-top: 60px; border-top: 1px solid #ddd; padding-top: 20px; text-align: center; font-size: 12px; color: #777; }
            .signature { margin-top: 50px; display: flex; justify-content: space-between; }
            .sig-line { width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 5px; font-size: 14px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    winPrint.document.close();
  };

  // Stats Calculations
  const totalOrders = labOrders.length;
  const pendingSamples = labOrders.filter(o => o.status === "ordered").length;
  const pendingResults = labOrders.filter(o => o.status === "sample-collected").length;
  const completedOrders = labOrders.filter(o => o.status === "result-uploaded").length;

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/30 before:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Diagnostics Laboratory
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Diagnostics Worklist
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Track diagnostic specimen collection, sample processing, automated normal ranges, and pathology pricing.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {user && user.role !== "patient" && (
              <>
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

                {activeTab === "catalog" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingTestId(null);
                      setTestName("");
                      setTestCode("");
                      setTestDepartment("");
                      setTestSampleType("");
                      setTestPrice(0);
                      setTestNormalRange("");
                      setErrors({});
                      setIsTestModalOpen(true);
                    }}
                    className="font-semibold rounded-xl shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Test to Catalog
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setSelectedPatient(null); setPatientSearch(""); setSelectedTestId(""); setSelectedDoctorId(""); setIsOrderOpen(true); }}
                    className="font-semibold rounded-xl shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Place Lab Order
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS GRID (STAFF ONLY)
         ────────────────────────────────────────────────────────────────────────── */}
      {user && user.role !== "patient" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Lab Orders"
            value={totalOrders.toString()}
            description="Diagnostic test requests"
            icon={<FlaskConical className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Samples Pending"
            value={pendingSamples.toString()}
            description="Awaiting phlebotomy collection"
            icon={<Clock className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Results Awaiting"
            value={pendingResults.toString()}
            description="Under processing / analysis"
            icon={<Activity className="w-5 h-5 text-text-secondary" />}
          />
          <StatCard
            label="Completed Results"
            value={completedOrders.toString()}
            description="Signed & verified reports"
            icon={<CheckCircle2 className="w-5 h-5 text-text-secondary" />}
          />
        </div>
      )}

      {/* Tabs Menu (Staff Only) */}
      {user && user.role !== "patient" && (
        <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab("worklist")}
            className={cn(
              "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
              activeTab === "worklist"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <Activity className={cn("w-3.5 h-3.5", activeTab === "worklist" ? "text-primary-500" : "text-text-muted")} />
            <span>Diagnostics Worklist</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
              {labOrders.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={cn(
              "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
              activeTab === "catalog"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <Layers className={cn("w-3.5 h-3.5", activeTab === "catalog" ? "text-primary-500" : "text-text-muted")} />
            <span>Tests Pricing Catalog</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
              {labTests.length}
            </span>
          </button>
        </div>
      )}

      {/* TAB 1: WORKLIST (STAFF) */}
      {activeTab === "worklist" && user?.role !== "patient" && (
        <div className="space-y-6">
          {/* PURPOSEFUL DIAGNOSTIC WORKLOAD DISTRIBUTION */}
          {labOrders.length > 0 && (
            <ChartContainer
              title="Diagnostic Workload by Department"
              description="Active lab test orders categorized across clinical specialties"
              loading={loading}
              height={200}
            >
              <DonutChart
                data={(() => {
                  const counts: Record<string, number> = {};
                  labOrders.forEach((o) => {
                    const dept = o.testId?.department || "General Lab";
                    counts[dept] = (counts[dept] || 0) + 1;
                  });
                  const colors = [
                    "var(--s-chart-1, #3b82f6)",
                    "var(--s-chart-2, #10b981)",
                    "var(--s-chart-3, #f59e0b)",
                    "var(--s-chart-4, #8b5cf6)",
                    "var(--s-chart-5, #ec4899)",
                    "#06b6d4",
                    "#f97316",
                  ];
                  return Object.entries(counts).map(([name, value], idx) => ({
                    name,
                    value,
                    color: colors[idx % colors.length],
                  }));
                })()}
                height={200}
                valueFormatter={(v) => `${v} orders`}
              />
            </ChartContainer>
          )}

          <Card className="overflow-hidden">
            <Table
              loading={loading}
                  columns={[
                    { header: "Patient Details", key: "patient" },
                    { header: "Diagnostic Test", key: "test" },
                    { header: "Department", key: "dept" },
                    { header: "Order Date", key: "date" },
                    { header: "Status", key: "status" },
                    { header: "Outcome Value", key: "val" },
                    { header: "Attending / Action", key: "action" }
                  ]}
                  data={labOrders.map(order => ({
                    id: order.id,
                    patient: (
                      <div>
                        <div className="font-semibold text-text">{order.patientId?.userId?.name}</div>
                        <div className="text-xs text-text-muted">{order.patientId?.userId?.phone}</div>
                      </div>
                    ),
                    test: (
                      <div>
                        <div className="font-bold text-text">{order.testId?.name}</div>
                        <div className="text-xs text-primary-600 font-mono font-semibold">{order.testId?.code}</div>
                      </div>
                    ),
                    dept: <Badge variant="default" className="text-[10px]">{order.testId?.department}</Badge>,
                    date: new Date(order.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                    status: (
                      <Badge variant={
                        order.status === "ordered" ? "warning" :
                        order.status === "sample-collected" ? "primary" : "success"
                      }>
                        {order.status}
                      </Badge>
                    ),
                    val: order.status === "result-uploaded" ? (
                      <div className="text-sm">
                        <span className="font-bold text-text">{order.resultValue}</span>
                        <span className="text-xs text-text-muted block max-w-[150px] truncate">{order.resultNotes}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">Awaiting fulfillment</span>
                    ),
                    action: (
                      <div className="flex items-center gap-2">
                        {order.status === "ordered" && (
                          <Button variant="outline" size="sm" onClick={() => handleCollectSample(order.id)}>
                            Collect {order.testId?.sampleType}
                          </Button>
                        )}
                        {(order.status === "sample-collected" || order.status === "processing") && (
                          <Button variant="primary" size="sm" onClick={() => { setActiveOrder(order); setResultValue(""); setResultNotes(""); setAttachmentUrl(""); setUploadedFile(null); setIsResultOpen(true); }}>
                            Upload Results
                          </Button>
                        )}
                        {order.status === "result-uploaded" && (
                          <Button variant="ghost" size="sm" onClick={() => handlePrintReport(order)}>
                            Print Report
                          </Button>
                        )}
                      </div>
                    )
                  }))}
                  emptyMessage="No laboratory diagnostic orders registered yet."
                />
              </Card>
            </div>
          )}

          {/* TAB 2: TEST CATALOG (STAFF) */}
          {activeTab === "catalog" && user?.role !== "patient" && (
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <Table
                  loading={loading}
                  columns={[
                    { header: "Test Code", key: "code" },
                    { header: "Test Name", key: "name" },
                    { header: "Department", key: "dept" },
                    { header: "Sample Material", key: "sample" },
                    { header: "Normal Reference Range", key: "normal" },
                    { header: "Price", key: "price" },
                    { header: "Actions", key: "actions" }
                  ]}
                  data={labTests.map(test => ({
                    id: test.id,
                    code: <Badge variant="default" className="font-mono text-xs">{test.code}</Badge>,
                    name: <span className="font-bold text-text">{test.name}</span>,
                    dept: <span className="text-sm text-text">{test.department}</span>,
                    sample: <span className="text-sm text-text-muted">{test.sampleType}</span>,
                    normal: <span className="text-sm text-text font-mono">{test.normalRange}</span>,
                    price: <span className="text-text font-semibold">₹{test.price}</span>,
                    actions: (
                      <div className="flex items-center justify-end">
                        <Dropdown
                          align="right"
                          trigger={
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 flex items-center justify-center rounded-lg cursor-pointer shrink-0" title="Row Actions">
                              <svg className="h-4 w-4 text-text-secondary" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                              </svg>
                            </Button>
                          }
                          items={[
                            { label: "Edit Lab Test", onClick: () => {
                              setEditingTestId(test.id);
                              setTestName(test.name);
                              setTestCode(test.code);
                              setTestDepartment(test.department);
                              setTestSampleType(test.sampleType);
                              setTestPrice(test.price);
                              setTestNormalRange(test.normalRange);
                              setErrors({});
                              setIsTestModalOpen(true);
                            }},
                            { label: "Delete Lab Test", danger: true, onClick: () => setDeletingTestId(test.id) },
                          ]}
                        />
                      </div>
                    )
                  }))}
                  emptyMessage="No diagnostic tests registered in this clinic catalog."
                />
              </Card>
            </div>
          )}

          {/* TAB 3: PATIENT VAULT (PATIENT VIEW) */}
          {activeTab === "patientVault" && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-text">My Laboratory & Diagnostic Reports</h3>

              <Card className="overflow-hidden">
                <Table
                  loading={loading}
                  columns={[
                    { header: "Test Name", key: "name" },
                    { header: "Code / Lab Room", key: "code" },
                    { header: "Date Requested", key: "date" },
                    { header: "Status", key: "status" },
                    { header: "Result Value", key: "val" },
                    { header: "Normal Reference", key: "normal" },
                    { header: "Action", key: "action" }
                  ]}
                  data={labOrders.map(order => ({
                    id: order.id,
                    name: <span className="font-bold text-text">{order.testId?.name}</span>,
                    code: (
                      <div>
                        <div className="text-xs font-mono font-bold text-text-muted">{order.testId?.code}</div>
                        <div className="text-[10px] text-text-muted">{order.testId?.department}</div>
                      </div>
                    ),
                    date: new Date(order.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                    status: (
                      <Badge variant={
                        order.status === "ordered" ? "warning" :
                        order.status === "sample-collected" ? "primary" : "success"
                      }>
                        {order.status}
                      </Badge>
                    ),
                    val: order.status === "result-uploaded" ? (
                      <span className="font-bold text-primary-600">{order.resultValue}</span>
                    ) : (
                      <span className="text-xs text-text-muted italic">Processing...</span>
                    ),
                    normal: <span className="text-sm font-mono text-text-muted">{order.testId?.normalRange}</span>,
                    action: order.status === "result-uploaded" ? (
                      <Button variant="outline" size="sm" onClick={() => handlePrintReport(order)}>
                        View & Print Report
                      </Button>
                    ) : (
                      <span className="text-xs text-text-muted">Awaiting results</span>
                    )
                  }))}
                  emptyMessage="You have no diagnostic laboratory orders registered."
                />
              </Card>
            </div>
          )}

      {/* PLACE LAB ORDER MODAL */}
      <Modal
        open={isOrderOpen}
        onClose={() => setIsOrderOpen(false)}
        title="Order Diagnostic Lab Test"
      >
        <form onSubmit={handleOrderSubmit} className="space-y-4">
          {/* Patient Lookup */}
          <div className="relative">
            <label className="text-xs font-semibold text-text mb-1 block">Patient Profile *</label>
            <Input
              value={patientSearch}
              onChange={(e) => handlePatientSearch(e.target.value)}
              placeholder="Search patient name or phone..."
              required
            />
            {searchLoading && (
              <div className="absolute right-3 top-8">
                <Spinner size="sm" />
              </div>
            )}
            {patientResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                {patientResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left p-3 hover:bg-surface-hover border-b border-border/50 flex flex-col"
                  >
                    <span className="text-sm font-semibold text-text">{p.userId.name}</span>
                    <span className="text-xs text-text-muted">Phone: {p.userId.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <div className="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-green-700 dark:text-green-400">{selectedPatient.userId.name}</div>
                  <div className="text-xs text-text-muted">Phone: {selectedPatient.userId.phone}</div>
                </div>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setSelectedPatient(null)}>Change</Button>
              </div>
            )}
          </div>

          {/* Lab Test Select */}
          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Choose Diagnostic Test *</label>
            <Select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              placeholder="-- Select Lab Examination --"
              options={labTests.map(t => ({ value: t.id, label: `${t.name} (${t.code}) - ₹${t.price}` }))}
              required
            />
          </div>

          {/* Ordering Doctor Select */}
          <div>
            <label className="text-xs font-semibold text-text mb-1 block">Ordering Clinician *</label>
            <Select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              placeholder="-- Attending Clinician --"
              options={doctors.map(d => ({ value: d.id, label: `${d.name} (${d.specialization || "General Medicine"})` }))}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsOrderOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingOrder}>
              {submittingOrder ? "Placing Order..." : "Confirm & Bill Test"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* REGISTER TEST CATALOG MODAL */}
      <Modal
        open={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        title={editingTestId ? "Modify Lab Test Catalog Entry" : "Register Diagnostic Examination"}
      >
        <form onSubmit={handleTestSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Test Name *</label>
              <Input
                value={testName}
                onChange={(e) => {
                  setTestName(e.target.value);
                  validateField("name", e.target.value);
                }}
                onBlur={(e) => validateField("name", e.target.value)}
                placeholder="e.g. Lipid Profile"
                required
                error={errors.name}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Test Code *</label>
              <Input
                value={testCode}
                onChange={(e) => {
                  setTestCode(e.target.value);
                  validateField("code", e.target.value);
                }}
                onBlur={(e) => validateField("code", e.target.value)}
                placeholder="e.g. LPD-002"
                required
                error={errors.code}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Department Group *</label>
              <Select
                value={testDepartment}
                onChange={(e) => {
                  setTestDepartment(e.target.value);
                  validateField("department", e.target.value);
                }}
                options={LAB_DEPARTMENTS.map(d => ({ value: d, label: d }))}
                placeholder="Select Department"
                required
                error={errors.department}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Sample Material Type *</label>
              <Input
                value={testSampleType}
                onChange={(e) => {
                  setTestSampleType(e.target.value);
                  validateField("sampleType", e.target.value);
                }}
                onBlur={(e) => validateField("sampleType", e.target.value)}
                placeholder="e.g. Blood, Urine, None (X-Ray)"
                required
                error={errors.sampleType}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Price (₹ INR) *</label>
              <Input
                type="number"
                value={testPrice === 0 ? "" : testPrice}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTestPrice(val);
                  validateField("price", val);
                }}
                onBlur={(e) => validateField("price", Number(e.target.value))}
                placeholder="e.g. 45"
                required
                error={errors.price}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Normal Range Reference *</label>
              <Input
                value={testNormalRange}
                onChange={(e) => {
                  setTestNormalRange(e.target.value);
                  validateField("normalRange", e.target.value);
                }}
                onBlur={(e) => validateField("normalRange", e.target.value)}
                placeholder="e.g. < 200 mg/dL"
                required
                error={errors.normalRange}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsTestModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingTest}>
              {submittingTest ? "Saving..." : "Save Test Configuration"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* UPLOAD RESULT MODAL */}
      <Modal
        open={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        title="Report Laboratory Test Findings"
      >
        {activeOrder && (
          <form onSubmit={handleResultSubmit} className="space-y-4">
            <div className="p-3 bg-surface-hover rounded-xl border border-border">
              <span className="text-xs text-text-muted block">Ordered Test:</span>
              <span className="text-sm font-bold text-text">{activeOrder.testId?.name} ({activeOrder.testId?.code})</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Recorded Value / Result *</label>
              <Input
                value={resultValue}
                onChange={(e) => setResultValue(e.target.value)}
                placeholder={`Reference Range: ${activeOrder.testId?.normalRange}`}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Clinician Findings / Notes</label>
              <Textarea
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                placeholder="Enter pathologic observations or comments..."
                rows={3}
              />
            </div>

            <div>
              <ImageUpload
                label="Lab Report Attachment (PDF or Image)"
                value={uploadedFile || attachmentUrl}
                onChange={async (val) => {
                  if (!val) {
                    setAttachmentUrl("");
                    setUploadedFile(null);
                    return;
                  }
                  if (val instanceof File) {
                    setUploadedFile(val);
                    try {
                      const res = await uploadFile(val);
                      setAttachmentUrl(res.publicUrl);
                      toast({ title: "Upload Success", description: "Lab report file uploaded successfully", variant: "success" });
                    } catch (err) {
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setAttachmentUrl(e.target?.result as string);
                        toast({ title: "Attachment Attached", description: "Lab report file attached successfully", variant: "success" });
                      };
                      reader.readAsDataURL(val);
                    }
                  } else {
                    setAttachmentUrl(val);
                  }
                }}
                uploading={isUploading}
                progress={progress}
                accept="image/png, image/jpeg, image/webp, application/pdf"
                allowedTypes={["image/", "application/pdf"]}
                helperText="PNG, JPG, WEBP, or PDF (max. 5MB)"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setIsResultOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingResult}>
                {submittingResult ? "Saving..." : "Submit Findings"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* PRINT REPORT SLIP MODAL */}
      <Modal
        open={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        title="Laboratory Diagnosis Certificate"
        size="lg"
      >
        {printOrder && (
          <div className="space-y-5 font-sans">
            <div id="printable-lab-slip" className="border border-gray-200 p-5 sm:p-6 rounded-2xl bg-white text-black space-y-4 shadow-sm">
              <div className="text-center border-b-2 border-gray-800 pb-3">
                <h2 className="text-lg font-black uppercase tracking-wider text-gray-900">
                  JK Laboratory & Diagnostics Services
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Certified Medical Diagnostics Center &bull; Official Diagnostic Report</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="font-semibold block text-gray-500 text-[11px] uppercase tracking-wider">Patient Recipient:</span>
                  <strong className="text-gray-900 text-sm">{printOrder.patientId?.userId?.name}</strong>
                  <div className="text-xs text-gray-500 mt-0.5">Phone: {printOrder.patientId?.userId?.phone || "N/A"}</div>
                </div>
                <div className="text-right">
                  <span className="font-semibold block text-gray-500 text-[11px] uppercase tracking-wider">Ordering Clinician:</span>
                  <strong className="text-gray-900 text-sm">{printOrder.doctorId?.name}</strong>
                  <div className="text-xs text-gray-500 mt-0.5">{printOrder.doctorId?.specialization || "Clinical Practitioner"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm border-t border-gray-100 pt-3">
                <div>
                  <span className="font-semibold block text-gray-500 text-[11px] uppercase tracking-wider">Sample Collected Date:</span>
                  <span className="text-gray-800 font-medium">{new Date(printOrder.orderDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold block text-gray-500 text-[11px] uppercase tracking-wider">Test Room Code:</span>
                  <span className="font-mono font-bold text-gray-800">{printOrder.testId?.code}</span>
                </div>
              </div>

              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse table-fixed text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-[11px] uppercase font-bold">
                      <th className="border border-gray-200 p-2.5 text-left w-[30%]">Examination</th>
                      <th className="border border-gray-200 p-2.5 text-left w-[35%]">Patient Result</th>
                      <th className="border border-gray-200 p-2.5 text-left w-[23%]">Normal Reference</th>
                      <th className="border border-gray-200 p-2.5 text-left w-[12%]">Dept</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-xs">
                      <td className="border border-gray-200 p-2.5 align-top">
                        <div className="font-bold text-gray-900 leading-snug">{printOrder.testId?.name}</div>
                        <div className="text-[10px] font-mono text-gray-500 mt-0.5">{printOrder.testId?.code}</div>
                      </td>
                      <td className="border border-gray-200 p-2.5 align-top font-bold text-teal-700 whitespace-pre-wrap break-words leading-relaxed">
                        {printOrder.resultValue}
                      </td>
                      <td className="border border-gray-200 p-2.5 align-top font-mono text-gray-700 whitespace-pre-wrap break-words">
                        {printOrder.testId?.normalRange}
                      </td>
                      <td className="border border-gray-200 p-2.5 align-top text-[11px] text-gray-600 font-medium">
                        {printOrder.testId?.department}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {printOrder.resultNotes && (
                <div className="bg-teal-50/50 border-l-4 border-teal-600 p-3 rounded-r-xl text-xs text-gray-800 leading-relaxed">
                  <strong className="text-teal-900 block font-bold mb-0.5">Pathologist Findings & Clinical Notes:</strong>
                  <p className="whitespace-pre-wrap italic">{printOrder.resultNotes}</p>
                </div>
              )}

              <div className="mt-8 flex justify-between text-xs pt-8 border-t border-gray-100">
                <div className="text-center w-36">
                  <div className="border-t border-gray-400 pt-1 text-gray-500 font-medium text-[11px]">Lab Technician</div>
                </div>
                <div className="text-center w-36">
                  <div className="border-t border-gray-400 pt-1 text-gray-500 font-medium text-[11px]">Authorized Signatory</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsPrintOpen(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={executePrint}>
                Print Report Slip
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Test Confirm Dialog ─────────────────────────────────── */}
      <ConfirmDialog
        open={!!deletingTestId}
        onClose={() => setDeletingTestId(null)}
        onConfirm={handleDeleteTest}
        title="Delete Diagnostic Test"
        description="Are you sure you want to remove this test from the laboratory catalog? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete Test"
      />
    </div>
  );
}
