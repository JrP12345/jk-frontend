"use client";

import PrintDialogActions from "@/components/ui/PrintDialogActions";

import PrintButton from "@/components/ui/PrintButton";

import { getPrintBrandStyles, printHtml } from "@/lib/printBrand";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { Card, Table, Button, Modal, Input, Select, Textarea, useToast, Spinner, Badge, StatCard, ImageUpload, Dropdown, ConfirmDialog, ChartContainer, DonutChart, cn } from "@/components/ui";
import { useLatestRead } from "@/hooks/useLatestRead";
import { useR2Upload } from "@/hooks/useR2Upload";
import { Activity, Layers, RotateCw, Plus, FlaskConical, Clock, CheckCircle2, Phone } from "lucide-react";

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
  locationId: string;
  name: string;
  code: string;
  department: string;
  sampleType: string;
  price: number;
  normalRange: string;
}

interface LabOrderType {
  id: string;
  locationId: string;
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
  result?: { value: string; notes?: string; attachmentUrl?: string };
  resultedAt?: string | null;
}

export default function LaboratoryPage() {
  const { user } = useAuthStore();
  const { activeLocationId } = useLocationStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"worklist" | "catalog" | "patientVault">("worklist");
  const [selectedLocationId, setSelectedLocationId] = useState(activeLocationId || "");

  useEffect(() => {
    setSelectedLocationId(activeLocationId || "");
  }, [activeLocationId]);
  const [labTests, setLabTests] = useState<LabTestType[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderType[]>([]);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [tatMetrics, setTatMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const beginDataRead = useLatestRead();
  const beginPatientRead = useLatestRead();
  const fetchData = async () => {
    const request = beginDataRead();
    setLoading(true);
    try {
      setLoadError(null);
      const isAll = !selectedLocationId || selectedLocationId === "all";
      if (user?.role === "patient") {
        const [testsRes, ordersRes] = await Promise.all([
          api.get(!isAll ? `/lab-tests?locationId=${selectedLocationId}` : "/lab-tests", { signal: request.signal }),
          api.get(!isAll ? `/lab-orders?locationId=${selectedLocationId}` : "/lab-orders", { signal: request.signal }),
        ]);
        if (!request.isCurrent()) return;
        setLabTests(testsRes.data?.data || []);
        setLabOrders(ordersRes.data?.data || []);
      } else {
        const [testsRes, ordersRes, docRes, tatRes] = await Promise.all([
          api.get(!isAll ? `/lab-tests?locationId=${selectedLocationId}` : "/lab-tests", { signal: request.signal }),
          api.get(!isAll ? `/lab-orders?locationId=${selectedLocationId}` : "/lab-orders", { signal: request.signal }),
          api.get(!isAll ? `/onboarding/staff?locationId=${selectedLocationId}` : "/onboarding/staff", { signal: request.signal }),
          api.get(!isAll ? `/lab/tat-metrics?locationId=${selectedLocationId}` : "/lab/tat-metrics", { signal: request.signal }),
        ]);

        if (!request.isCurrent()) return;
        setLabTests(testsRes.data?.data || []);
        setLabOrders(ordersRes.data?.data || []);
        setDoctors(docRes.data?.data?.doctors || []);
        setTatMetrics(tatRes.data?.data || null);
      }
    } catch (err) {
      if (!request.isCurrent()) return;
      setLoadError("Laboratory records could not be loaded. Check your connection and try again.");
      // Non-critical
    } finally {
      if (request.isCurrent()) setLoading(false);
    }
  };

  // Validation & Upload States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const { uploadFile, uploading, progress } = useR2Upload({
    onError: (err) => {
      toast({ title: "Upload Failed", description: err instanceof Error ? err.message : "Upload could not be completed", variant: "error" });
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

  // Workspace owns location metadata. Doctors come from fetchData.
  useEffect(() => {
    if (user?.role === 'patient') { setActiveTab('patientVault'); setSelectedLocationId('all'); }
    else if (user) {
      setActiveTab('worklist');
    }
  }, [user?.id, user?.role, user?.organization_id]);

  useEffect(() => { if (user) void fetchData(); else beginDataRead(); }, [selectedLocationId, user?.id, user?.role, user?.organization_id]);

  const handlePatientSearch = (val: string) => { setSelectedPatient(null); setPatientSearch(val); };
  useEffect(() => {
    const request = beginPatientRead();
    setPatientResults([]);
    setSearchLoading(false);
    if (!user || !isOrderOpen || selectedPatient || patientSearch.trim().length < 2) return;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get('/patients', { params: { search: patientSearch.trim() }, signal: request.signal });
        if (request.isCurrent()) setPatientResults(res.data.data || []);
      } catch { /* Cancelled or failed reads retain no results. */ }
      finally { if (request.isCurrent()) setSearchLoading(false); }
    }, 300);
    return () => { window.clearTimeout(timer); request.signal.aborted || beginPatientRead(); };
  }, [patientSearch, selectedPatient, isOrderOpen, user?.id, user?.organization_id, beginPatientRead]);

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
        locationId: selectedLocationId,
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
        locationId: selectedLocationId,
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
        value: resultValue,
        notes: resultNotes,
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

  const executePrint = async () => {
    const printContent = document.getElementById("printable-lab-slip");
    if (!printContent) return;
    await printHtml(`
      <html>
        <head>
          <title>Diagnostic Laboratory Report</title>
          <style>${getPrintBrandStyles()}
            body { font-family: sans-serif; padding: 40px; color: var(--print-text); line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid var(--print-text); padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { margin: 5px 0 0 0; font-size: 14px; color: var(--print-secondary); }
            .section { margin-bottom: 25px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
            .grid-item span { font-weight: bold; color: var(--print-secondary); }
            table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            th, td { border: 1px solid var(--print-border); padding: 12px; text-align: left; }
            th { background-color: var(--print-surface-muted); }
            .notes { background: var(--print-background); border-left: 4px solid var(--print-accent); padding: 15px; margin-top: 30px; font-style: italic; }
            .footer { margin-top: 60px; border-top: 1px solid var(--print-border); padding-top: 20px; text-align: center; font-size: 12px; color: var(--print-muted); }
            .signature { margin-top: 50px; display: flex; justify-content: space-between; }
            .sig-line { width: 200px; border-top: 1px solid var(--print-text); text-align: center; padding-top: 5px; font-size: 14px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
  };

  // Stats Calculations
  const totalOrders = labOrders.length;
  const pendingSamples = labOrders.filter(o => o.status === "ordered").length;
  const pendingResults = labOrders.filter(o => o.status === "sample-collected").length;
  const completedOrders = labOrders.filter(o => o.status === "result-uploaded").length;

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Laboratory
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Test worklist
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Track samples, review test results, and manage laboratory prices.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
            {user && user.role !== "patient" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchData}
                  disabled={loading}
                  className="flex-1 sm:flex-initial min-h-[40px] rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
                 loading={loading}>
                  <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
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
                    className="flex-1 sm:flex-initial min-h-[40px] font-semibold rounded-xl shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Test to Catalog
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setSelectedPatient(null); setPatientSearch(""); setSelectedTestId(""); setSelectedDoctorId(""); setIsOrderOpen(true); }}
                    className="flex-1 sm:flex-initial min-h-[40px] font-semibold rounded-xl shadow-xs cursor-pointer"
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
            description="Uploaded test results"
            icon={<CheckCircle2 className="w-5 h-5 text-text-secondary" />}
          />
        </div>
      )}

      {/* Tabs Menu (Staff Only) */}
      {user && user.role !== "patient" && (
        <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full touch-manipulation">
          <button
            type="button"
            onClick={() => setActiveTab("worklist")}
            aria-pressed={activeTab === "worklist"}
            className={cn(
              "px-3.5 py-2 min-h-11 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              activeTab === "worklist"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <Activity className={cn("w-3.5 h-3.5", activeTab === "worklist" ? "text-accent" : "text-text-muted")} />
            <span>Diagnostics Worklist</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
              {labOrders.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            aria-pressed={activeTab === "catalog"}
            className={cn(
              "px-3.5 py-2 min-h-11 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              activeTab === "catalog"
                ? "bg-surface text-text shadow-xs font-bold border border-border/60"
                : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <Layers className={cn("w-3.5 h-3.5", activeTab === "catalog" ? "text-accent" : "text-text-muted")} />
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
                    "var(--chart-1)",
                    "var(--chart-2)",
                    "var(--chart-3)",
                    "var(--chart-4)",
                    "var(--chart-5)",
                    "var(--chart-6)",
                    "var(--chart-7)",
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
              error={loadError}
              onRetry={fetchData}
              loading={loading}
              mobileCardView
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
                        <div className="text-xs text-accent font-mono font-semibold">{order.testId?.code}</div>
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
                        <span className="font-bold text-text">{order.result?.value}</span>
                        <span className="text-xs text-text-muted block max-w-[150px] truncate">{order.result?.notes}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">Awaiting fulfillment</span>
                    ),
                    action: (
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        {order.status === "ordered" && (
                          <Button variant="outline" size="sm" onClick={() => handleCollectSample(order.id)} className="w-full sm:w-auto min-h-[36px]">
                            Collect {order.testId?.sampleType}
                          </Button>
                        )}
                        {(order.status === "sample-collected" || order.status === "processing") && (
                          <Button variant="primary" size="sm" onClick={() => { setActiveOrder(order); setResultValue(""); setResultNotes(""); setAttachmentUrl(""); setUploadedFile(null); setIsResultOpen(true); }} className="w-full sm:w-auto min-h-[36px]">
                            Upload Results
                          </Button>
                        )}
                        {order.status === "result-uploaded" && (
                          <PrintButton variant="ghost" size="sm" onPrint={() => handlePrintReport(order)} className="w-full sm:w-auto min-h-[36px]" documentName="report" preview>
              </PrintButton>
                        )}
                      </div>
                    )
                  }))}
                  renderMobileCard={(row: any) => {
                    const order = labOrders.find((o) => o.id === row.id);
                    if (!order) return null;
                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-text text-sm">{order.patientId?.userId?.name || "Patient"}</h4>
                            {order.patientId?.userId?.phone && (
                              <a
                                href={`tel:${order.patientId?.userId?.phone}`}
                                className="text-xs text-text-muted hover:text-text flex items-center gap-1 mt-0.5"
                              >
                                <Phone className="w-3 h-3 text-text-muted" />
                                <span>{order.patientId?.userId?.phone}</span>
                              </a>
                            )}
                          </div>
                          <Badge
                            variant={
                              order.status === "ordered" ? "warning" :
                              order.status === "sample-collected" ? "primary" :
                              order.status === "processing" ? "info" : "success"
                            }
                            size="sm"
                            dot
                            className="capitalize text-[10px] font-bold shrink-0"
                          >
                            {order.status.replace("-", " ")}
                          </Badge>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface-alt/70 border border-border/50 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-text">{order.testId?.name}</span>
                            <span className="font-mono text-[10px] font-bold text-accent dark:text-accent bg-primary-500/10 px-1.5 py-0.2 rounded-md">
                              {order.testId?.code}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-text-muted text-[11px]">
                            <span>{order.testId?.department}</span>
                            <span>{new Date(order.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          {order.status === "result-uploaded" && order.result?.value && (
                            <div className="pt-1.5 border-t border-border/50">
                              <span className="text-[10px] font-bold uppercase text-text-muted block">Outcome:</span>
                              <span className="font-bold text-text text-sm">{order.result?.value}</span>
                              {order.result?.notes && (
                                <p className="text-[11px] text-text-muted italic truncate">{order.result?.notes}</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-1">
                          {order.status === "ordered" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCollectSample(order.id)}
                              className="w-full font-bold text-xs rounded-xl min-h-[42px] justify-center"
                            >
                              Collect {order.testId?.sampleType || "Specimen"}
                            </Button>
                          )}
                          {(order.status === "sample-collected" || order.status === "processing") && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setActiveOrder(order);
                                setResultValue("");
                                setResultNotes("");
                                setAttachmentUrl("");
                                setUploadedFile(null);
                                setIsResultOpen(true);
                              }}
                              className="w-full font-bold text-xs rounded-xl min-h-[42px] justify-center shadow-xs"
                            >
                              Upload Results
                            </Button>
                          )}
                          {order.status === "result-uploaded" && (
                            <PrintButton
                              variant="outline"
                              size="sm"
                              onPrint={() => handlePrintReport(order)}
                              className="w-full font-semibold text-xs rounded-xl min-h-[42px] justify-center" documentName="report" preview
                            >
              </PrintButton>
                          )}
                        </div>
                      </div>
                    );
                  }}
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
              error={loadError}
              onRetry={fetchData}
                  loading={loading}
                  mobileCardView
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
                            <Button size="sm" variant="outline" className="h-8 w-8 min-h-[36px] min-w-[36px] p-0 flex items-center justify-center rounded-lg cursor-pointer shrink-0" title="Row Actions">
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
                  renderMobileCard={(row: any) => {
                    const test = labTests.find((t) => t.id === row.id);
                    if (!test) return null;
                    return (
                      <div
                        key={test.id}
                        className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-text text-sm">{test.name}</h4>
                            <p className="text-xs text-text-muted">{test.department}</p>
                          </div>
                          <Badge variant="outline" size="sm" className="font-mono text-[10px] font-bold uppercase shrink-0">
                            {test.code}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-surface-alt/70 border border-border/50">
                          <div>
                            <span className="text-text-muted text-[10px] uppercase font-bold block">Specimen</span>
                            <span className="font-semibold text-text mt-0.5 block">{test.sampleType || "Blood"}</span>
                          </div>
                          <div>
                            <span className="text-text-muted text-[10px] uppercase font-bold block">Price</span>
                            <span className="font-bold text-sm text-text mt-0.5 block">₹{test.price}</span>
                          </div>
                          {test.normalRange && (
                            <div className="col-span-2 pt-1 border-t border-border/40">
                              <span className="text-text-muted text-[10px] uppercase font-bold block">Normal Range</span>
                              <span className="font-mono text-xs text-text mt-0.5 block">{test.normalRange}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTestId(test.id);
                              setTestName(test.name);
                              setTestCode(test.code);
                              setTestDepartment(test.department);
                              setTestSampleType(test.sampleType);
                              setTestPrice(test.price);
                              setTestNormalRange(test.normalRange);
                              setErrors({});
                              setIsTestModalOpen(true);
                            }}
                            className="flex-1 font-semibold text-xs rounded-xl min-h-[40px] justify-center"
                          >
                            Edit Test
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDeletingTestId(test.id)}
                            className="font-semibold text-xs rounded-xl min-h-[40px] px-3.5"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  }}
                  emptyMessage="No diagnostic tests registered in this location catalog."
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
              error={loadError}
              onRetry={fetchData}
                  loading={loading}
                  mobileCardView
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
                      <span className="font-bold text-accent">{order.result?.value}</span>
                    ) : (
                      <span className="text-xs text-text-muted italic">Processing...</span>
                    ),
                    normal: <span className="text-sm font-mono text-text-muted">{order.testId?.normalRange}</span>,
                    action: order.status === "result-uploaded" ? (
                      <PrintButton variant="outline" size="sm" onPrint={() => handlePrintReport(order)} documentName="report" preview>
              </PrintButton>
                    ) : (
                      <span className="text-xs text-text-muted">Awaiting results</span>
                    )
                  }))}
                  renderMobileCard={(row: any) => {
                    const order = labOrders.find((o) => o.id === row.id);
                    if (!order) return null;
                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-text text-sm">{order.testId?.name}</h4>
                            <p className="text-xs text-text-muted font-mono">{order.testId?.code} &bull; {order.testId?.department}</p>
                          </div>
                          <Badge
                            variant={
                              order.status === "ordered" ? "warning" :
                              order.status === "sample-collected" ? "primary" : "success"
                            }
                            size="sm"
                            dot
                            className="capitalize text-[10px] font-bold shrink-0"
                          >
                            {order.status.replace("-", " ")}
                          </Badge>
                        </div>

                        <div className="p-2.5 rounded-xl bg-surface-alt/70 border border-border/50 text-xs space-y-1">
                          <div className="flex items-center justify-between text-text-muted">
                            <span>Requested on:</span>
                            <span className="font-medium text-text">
                              {new Date(order.orderDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          {order.status === "result-uploaded" ? (
                            <div className="pt-1 border-t border-border/50 flex items-center justify-between">
                              <span className="font-bold text-text-muted">Result:</span>
                              <span className="font-bold text-accent dark:text-accent text-sm">{order.result?.value}</span>
                            </div>
                          ) : (
                            <p className="text-xs text-text-muted italic pt-0.5">Report under processing in laboratory.</p>
                          )}
                        </div>

                        {order.status === "result-uploaded" && (
                          <PrintButton
                            variant="primary"
                            size="sm"
                            onPrint={() => handlePrintReport(order)}
                            className="w-full font-bold text-xs rounded-xl min-h-[42px] justify-center shadow-xs" documentName="report" preview
                          >
              </PrintButton>
                        )}
                      </div>
                    );
                  }}
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
        footer={
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 w-full">
            <Button type="button" variant="ghost" onClick={() => setIsOrderOpen(false)} className="w-full sm:w-auto min-h-[44px]">
              Cancel
            </Button>
            <Button type="submit" form="order-lab-form" disabled={submittingOrder} className="w-full sm:w-auto min-h-[44px]" loading={submittingOrder}>
              {submittingOrder ? "Placing Order..." : "Confirm & Bill Test"}
            </Button>
          </div>
        }
      >
        <form id="order-lab-form" onSubmit={handleOrderSubmit} className="space-y-4">
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
              <div className="mt-2 p-3 bg-success/10 border border-success/20 rounded-xl flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-success-text dark:text-success-text">{selectedPatient.userId.name}</div>
                  <div className="text-xs text-text-muted">Phone: {selectedPatient.userId.phone}</div>
                </div>
                <Button variant="ghost" size="sm" className="text-danger-text" onClick={() => setSelectedPatient(null)}>Change</Button>
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
        </form>
      </Modal>

      {/* REGISTER TEST CATALOG MODAL */}
      <Modal
        open={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        title={editingTestId ? "Modify Lab Test Catalog Entry" : "Register Diagnostic Examination"}
        footer={
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 w-full">
            <Button type="button" variant="ghost" onClick={() => setIsTestModalOpen(false)} className="w-full sm:w-auto min-h-[44px]">
              Cancel
            </Button>
            <Button type="submit" form="lab-test-form" disabled={submittingTest} className="w-full sm:w-auto min-h-[44px]" loading={submittingTest}>
              {submittingTest ? "Saving..." : "Save Test Configuration"}
            </Button>
          </div>
        }
      >
        <form id="lab-test-form" onSubmit={handleTestSubmit} className="space-y-4">
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
        </form>
      </Modal>

      {/* UPLOAD RESULT MODAL */}
      <Modal
        open={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        title="Report Laboratory Test Findings"
        footer={
          activeOrder ? (
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 w-full">
              <Button type="button" variant="ghost" onClick={() => setIsResultOpen(false)} className="w-full sm:w-auto min-h-[44px]">
                Cancel
              </Button>
              <Button type="submit" form="lab-result-form" disabled={submittingResult} className="w-full sm:w-auto min-h-[44px]" loading={submittingResult}>
                {submittingResult ? "Saving..." : "Submit Findings"}
              </Button>
            </div>
          ) : undefined
        }
      >
        {activeOrder && (
          <form id="lab-result-form" onSubmit={handleResultSubmit} className="space-y-4">
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
                      const res = await uploadFile(val, { patientId: activeOrder?.patientId.id, contentClass: 'lab_report' });
                      setAttachmentUrl(res.objectKey);
                      toast({ title: "Upload Success", description: "Lab report file uploaded successfully", variant: "success" });
                    } catch {
                      setUploadedFile(null);
                      setAttachmentUrl('');
                      toast({ title: "Upload failed", description: "The attachment was not saved. Check its type and size, then retry.", variant: "error" });
                    }
                  } else {
                    setAttachmentUrl(val);
                  }
                }}
                uploading={uploading}
                progress={progress}
                accept="image/png, image/jpeg, image/webp, application/pdf"
                allowedTypes={["image/", "application/pdf"]}
                helperText="PNG, JPG, WEBP, or PDF (max. 5MB)"
              />
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
        footer={<PrintDialogActions documentName="report" onPrint={executePrint} onClose={() => setIsPrintOpen(false)} disabled={!printOrder} />}
      >
        {printOrder && (
          <div className="space-y-5 font-sans">
            <div id="printable-lab-slip" className="border border-border p-5 sm:p-6 rounded-2xl bg-white text-black space-y-4 shadow-sm">
              <div className="text-center border-b-2 border-border pb-3">
                <h2 className="text-lg font-black uppercase tracking-wider text-text">
                  Ekavyu & Diagnostics Services
                </h2>
                <p className="text-xs text-text-muted mt-0.5">Certified Medical Diagnostics Center &bull; Official Diagnostic Report</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="font-semibold block text-text-muted text-[11px] uppercase tracking-wider">Patient Recipient:</span>
                  <strong className="text-text text-sm">{printOrder.patientId?.userId?.name}</strong>
                  <div className="text-xs text-text-muted mt-0.5">Phone: {printOrder.patientId?.userId?.phone || "N/A"}</div>
                </div>
                <div className="text-right">
                  <span className="font-semibold block text-text-muted text-[11px] uppercase tracking-wider">Ordering Clinician:</span>
                  <strong className="text-text text-sm">{printOrder.doctorId?.name}</strong>
                  <div className="text-xs text-text-muted mt-0.5">{printOrder.doctorId?.specialization || "Clinical Practitioner"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm border-t border-border pt-3">
                <div>
                  <span className="font-semibold block text-text-muted text-[11px] uppercase tracking-wider">Sample Collected Date:</span>
                  <span className="text-text font-medium">{new Date(printOrder.orderDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold block text-text-muted text-[11px] uppercase tracking-wider">Test Room Code:</span>
                  <span className="font-mono font-bold text-text">{printOrder.testId?.code}</span>
                </div>
              </div>

              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse table-fixed text-xs">
                  <thead>
                    <tr className="bg-surface-alt text-text-secondary text-[11px] uppercase font-bold">
                      <th className="border border-border p-2.5 text-left w-[30%]">Examination</th>
                      <th className="border border-border p-2.5 text-left w-[35%]">Patient Result</th>
                      <th className="border border-border p-2.5 text-left w-[23%]">Normal Reference</th>
                      <th className="border border-border p-2.5 text-left w-[12%]">Dept</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-xs">
                      <td className="border border-border p-2.5 align-top">
                        <div className="font-bold text-text leading-snug">{printOrder.testId?.name}</div>
                        <div className="text-[10px] font-mono text-text-muted mt-0.5">{printOrder.testId?.code}</div>
                      </td>
                      <td className="border border-border p-2.5 align-top font-bold text-accent whitespace-pre-wrap break-words leading-relaxed">
                        {printOrder.result?.value}
                      </td>
                      <td className="border border-border p-2.5 align-top font-mono text-text-secondary whitespace-pre-wrap break-words">
                        {printOrder.testId?.normalRange}
                      </td>
                      <td className="border border-border p-2.5 align-top text-[11px] text-text-secondary font-medium">
                        {printOrder.testId?.department}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {printOrder.result?.notes && (
                <div className="bg-accent-subtle/50 border-l-4 border-accent p-3 rounded-r-xl text-xs text-text leading-relaxed">
                  <strong className="text-accent block font-bold mb-0.5">Pathologist Findings & Clinical Notes:</strong>
                  <p className="whitespace-pre-wrap italic">{printOrder.result?.notes}</p>
                </div>
              )}

              <div className="mt-8 flex justify-between text-xs pt-8 border-t border-border">
                <div className="text-center w-36">
                  <div className="border-t border-border pt-1 text-text-muted font-medium text-[11px]">Lab Technician</div>
                </div>
                <div className="text-center w-36">
                  <div className="border-t border-border pt-1 text-text-muted font-medium text-[11px]">Authorized Signatory</div>
                </div>
              </div>
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
