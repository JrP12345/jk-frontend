"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, Select, Textarea, useToast, Spinner, Badge, StatCard, ImageUpload, SkeletonTable, Dropdown
} from "@/components/ui";
import { useR2Upload } from "@/lib/useR2Upload";

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
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"worklist" | "catalog" | "patientVault">("worklist");
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [labTests, setLabTests] = useState<LabTestType[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderType[]>([]);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState(true);

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
        if (clinicsList.length > 0) {
          setSelectedClinicId(clinicsList[0].id);
        }
        setDoctors(staffRes.data.data.doctors || []);
      } catch (err) {
        toast({ title: "Error", description: "Failed to load clinic or staff lists", variant: "error" });
      }
    };

    if (user) {
      if (user.role === "patient") {
        setActiveTab("patientVault");
        setSelectedClinicId("all"); // Patients query across all
      } else {
        setActiveTab("worklist");
      }
      fetchMetadata();
    }
  }, [user]);

  // Fetch Tests and Orders when clinic changes
  const fetchData = async () => {
    try {
      setLoading(true);
      const testQuery = selectedClinicId !== "all" && selectedClinicId ? `?clinicId=${selectedClinicId}` : "";
      const orderQuery = selectedClinicId !== "all" && selectedClinicId ? `?clinicId=${selectedClinicId}` : "";

      const [testsRes, ordersRes] = await Promise.all([
        api.get(`/lab-tests${testQuery}`),
        api.get(`/lab-orders${orderQuery}`)
      ]);
      setLabTests(testsRes.data.data || []);
      setLabOrders(ordersRes.data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load laboratory logs", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

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

  // Delete Lab Test
  const handleDeleteTest = async (testId: string) => {
    if (!confirm("Are you sure you want to remove this diagnostic test from the catalog?")) return;
    try {
      await api.delete(`/lab-tests/${testId}`);
      toast({ title: "Success", description: "Test deleted from catalog", variant: "success" });
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
    <div className="space-y-6">
      {/* Top Header & Clinic Select */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text">Laboratory & Diagnostics</h2>
          <p className="text-xs sm:text-sm text-text-secondary">Order medical lab examinations, manage catalog test departments, and upload result reports.</p>
        </div>
        {user && user.role !== "patient" && (
          <div className="flex items-center gap-2.5">
            <Select
              size="sm"
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              options={clinics.map(c => ({ value: c.id, label: `${c.name} (${c.city})` }))}
              className="w-full sm:w-64"
            />
          </div>
        )}
      </div>

      {/* Stats Cards (Staff Only) */}
      {user && user.role !== "patient" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <StatCard
            label="Total Lab Orders"
            value={totalOrders}
            icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
          />
          <StatCard
            label="Samples Pending"
            value={pendingSamples}
            icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
          />
          <StatCard
            label="Results Awaiting"
            value={pendingResults}
            icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-purple-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
          />
          <StatCard
            label="Completed Results"
            value={completedOrders}
            icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-green-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>}
          />
        </div>
      )}

      {/* Tabs Menu (Staff Only) */}
      {user && user.role !== "patient" && (
        <div className="flex items-center border-b border-border gap-3 sm:gap-6 overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("worklist")}
            className={`pb-2.5 pt-1 text-xs sm:text-sm font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer ${activeTab === "worklist" ? "border-b-2 border-primary-600 text-primary-600 font-bold" : "text-text-muted hover:text-text"}`}
          >
            Diagnostics Worklist
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`pb-2.5 pt-1 text-xs sm:text-sm font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer ${activeTab === "catalog" ? "border-b-2 border-primary-600 text-primary-600 font-bold" : "text-text-muted hover:text-text"}`}
          >
            Tests Pricing Catalog
          </button>
        </div>
      )}

      {/* TAB 1: WORKLIST (STAFF) */}
      {activeTab === "worklist" && user?.role !== "patient" && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <Table
              onAddClick={() => { setSelectedPatient(null); setPatientSearch(""); setSelectedTestId(""); setSelectedDoctorId(""); setIsOrderOpen(true); }}
              actionLabel="Place Lab Order"
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
                  onAddClick={() => { setEditingTestId(null); setTestName(""); setTestCode(""); setTestDepartment(""); setTestSampleType(""); setTestPrice(0); setTestNormalRange(""); setErrors({}); setIsTestModalOpen(true); }}
                  actionLabel="Register Lab Test"
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
                      <Dropdown
                        align="right"
                        trigger={
                          <Button size="xs" variant="outline" className="h-7 w-7 p-0 flex items-center justify-center rounded-lg cursor-pointer" title="Row Actions">
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
                          { label: "Delete Lab Test", danger: true, onClick: () => handleDeleteTest(test.id) },
                        ]}
                      />
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
          <div className="grid grid-cols-2 gap-4">
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
              {errors.name && <p className="text-red-500 text-xs mt-0.5">{errors.name}</p>}
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
              {errors.code && <p className="text-red-500 text-xs mt-0.5">{errors.code}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              {errors.department && <p className="text-red-500 text-xs mt-0.5">{errors.department}</p>}
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
              {errors.sampleType && <p className="text-red-500 text-xs mt-0.5">{errors.sampleType}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              {errors.price && <p className="text-red-500 text-xs mt-0.5">{errors.price}</p>}
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
              {errors.normalRange && <p className="text-red-500 text-xs mt-0.5">{errors.normalRange}</p>}
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
      >
        {printOrder && (
          <div className="space-y-6">
            <div id="printable-lab-slip" className="border border-border p-6 rounded-xl bg-white text-black space-y-4">
              <div className="text-center border-b-2 border-gray-800 pb-3">
                <h2 className="text-lg font-bold uppercase tracking-wider">JK Laboratory & Diagnostics Services</h2>
                <p className="text-xs text-gray-500">Certified Medical Diagnostics Center | System Generated Report</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold block text-gray-500 text-xs">Patient Recipient:</span>
                  <strong className="text-gray-900">{printOrder.patientId?.userId?.name}</strong>
                  <div className="text-xs text-gray-500">Phone: {printOrder.patientId?.userId?.phone}</div>
                </div>
                <div className="text-right">
                  <span className="font-semibold block text-gray-500 text-xs">Ordering Clinician:</span>
                  <strong className="text-gray-900">{printOrder.doctorId?.name}</strong>
                  <div className="text-xs text-gray-500">{printOrder.doctorId?.specialization || "Clinical Practitioner"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-3">
                <div>
                  <span className="font-semibold block text-gray-500 text-xs">Sample Collected Date:</span>
                  <span className="text-gray-800">{new Date(printOrder.orderDate).toLocaleDateString()}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold block text-gray-500 text-xs">Test Room Code:</span>
                  <span className="font-mono text-gray-800">{printOrder.testId?.code}</span>
                </div>
              </div>

              <div className="my-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-xs uppercase">
                      <th className="border p-2 text-left">Examination Code & Name</th>
                      <th className="border p-2 text-left">Patient Result</th>
                      <th className="border p-2 text-left">Normal reference</th>
                      <th className="border p-2 text-left">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-sm">
                      <td className="border p-3">
                        <div className="font-bold text-gray-900">{printOrder.testId?.name}</div>
                        <div className="text-xs text-gray-500">{printOrder.testId?.code}</div>
                      </td>
                      <td className="border p-3 font-bold text-teal-700">{printOrder.resultValue}</td>
                      <td className="border p-3 font-mono text-gray-700">{printOrder.testId?.normalRange}</td>
                      <td className="border p-3 text-xs">{printOrder.testId?.department}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {printOrder.resultNotes && (
                <div className="bg-gray-50 border-l-4 border-teal-600 p-3 text-sm italic text-gray-700">
                  <strong>Pathologist Findings:</strong> {printOrder.resultNotes}
                </div>
              )}

              <div className="mt-12 flex justify-between text-xs pt-12 border-t border-gray-100">
                <div className="text-center w-40">
                  <div className="border-t border-gray-300 pt-1 text-gray-500">Lab Technician</div>
                </div>
                <div className="text-center w-40">
                  <div className="border-t border-gray-300 pt-1 text-gray-500">Authorized Signatory</div>
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
    </div>
  );
}
