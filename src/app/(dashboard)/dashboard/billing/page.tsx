"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, Select, Textarea, useToast, Spinner, Badge, StatCard, Dropdown
} from "@/components/ui";

interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: { id: string; userId: { name: string; email: string; phone: string } };
  clinicId: { id: string; name: string; city: string; address: string };
  doctorId: { id: string; name: string; specialization: string };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  status: "unpaid" | "paid" | "refunded";
  paymentMethod?: string;
  paymentDate?: string;
  createdAt: string;
}

export default function BillingPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [clinics, setClinics] = useState<any[]>([]);
  const [filterClinic, setFilterClinic] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Invoice Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [doctorAssignments, setDoctorAssignments] = useState<any[]>([]);
  
  // Patient lookup
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Invoice Items Builder
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { description: "General Consultation Fee", amount: 0, quantity: 1 }
  ]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // Collect Payment Modal State
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [collectMethod, setCollectMethod] = useState("cash");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Receipt Modal State
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateInvoiceField = (field: string, value: any, idx?: number, currentSubtotal = subtotal, currentTax = taxAmount) => {
    let error = "";
    if (field === "clinicId" && !value) {
      error = "Clinic Location is required";
    } else if (field === "doctorId" && !value) {
      error = "Doctor is required";
    } else if (field === "patient" && !value) {
      error = "Patient selection is required";
    } else if (field === "tax" && (isNaN(Number(value)) || Number(value) < 0)) {
      error = "Tax must be a non-negative number";
    } else if (field === "discount") {
      const disc = Number(value);
      if (isNaN(disc) || disc < 0) {
        error = "Discount must be a non-negative number";
      } else if (disc > currentSubtotal + currentTax) {
        error = "Discount cannot exceed the subtotal + tax";
      }
    } else if (idx !== undefined) {
      if (field === "itemDescription" && !String(value).trim()) {
        error = "Description is required";
      } else if (field === "itemAmount" && (isNaN(Number(value)) || Number(value) <= 0)) {
        error = "Amount must be a positive number";
      } else if (field === "itemQuantity" && (isNaN(Number(value)) || Number(value) <= 0 || !Number.isInteger(Number(value)))) {
        error = "Quantity must be a positive integer";
      }
    }

    setErrors((prev) => {
      const key = idx !== undefined ? `${field}_${idx}` : field;
      if (error) return { ...prev, [key]: error };
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateInvoiceForm = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedPatient) newErrors.patient = "Patient selection is required";
    if (!selectedClinicId) newErrors.clinicId = "Clinic Location is required";
    if (!selectedDoctorId) newErrors.doctorId = "Doctor is required";
    
    if (taxAmount < 0) newErrors.tax = "Tax must be a non-negative number";
    if (discountAmount < 0) {
      newErrors.discount = "Discount must be a non-negative number";
    } else if (discountAmount > subtotal + taxAmount) {
      newErrors.discount = "Discount cannot exceed the subtotal + tax";
    }

    invoiceItems.forEach((item, idx) => {
      if (!item.description.trim()) {
        newErrors[`itemDescription_${idx}`] = "Description is required";
      }
      if (item.amount <= 0) {
        newErrors[`itemAmount_${idx}`] = "Amount must be a positive number";
      }
      if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        newErrors[`itemQuantity_${idx}`] = "Quantity must be a positive integer";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Load Filters & Clinics
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await api.get("/onboarding/clinics");
        setClinics(res.data.data || []);
      } catch (err) {
        console.warn("Clinics filter not accessible for user role");
      }
    };
    if (user) fetchFilters();
  }, [user]);

  // Load Invoices
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let queryParams = [];
      if (filterClinic) queryParams.push(`clinicId=${filterClinic}`);
      if (filterStatus) queryParams.push(`status=${filterStatus}`);
      const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      
      const res = await api.get(`/invoices${queryString}`);
      setInvoices(res.data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load invoices", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user, filterClinic, filterStatus]);

  // Fetch doctor assignments when creating invoice clinic changes
  useEffect(() => {
    if (!selectedClinicId) {
      setDoctorAssignments([]);
      return;
    }
    const fetchAssignments = async () => {
      try {
        const res = await api.get(`/onboarding/doctors/assignments?clinicId=${selectedClinicId}`);
        setDoctorAssignments(res.data.data || []);
      } catch (err) {
        console.error("Failed to load doctor assignments");
      }
    };
    fetchAssignments();
  }, [selectedClinicId]);

  // Handle Doctor select to auto-populate consultation fee
  useEffect(() => {
    if (!selectedDoctorId || !selectedClinicId) return;
    const activeAssign = doctorAssignments.find(a => 
      (a.doctorId?.id || a.doctorId) === selectedDoctorId
    );
    if (activeAssign) {
      const fee = activeAssign.fees || 200;
      setInvoiceItems(prev => {
        const updated = [...prev];
        updated[0] = { ...updated[0], amount: fee };
        return updated;
      });
    }
  }, [selectedDoctorId, selectedClinicId, doctorAssignments]);

  const handlePatientSearch = async () => {
    if (!patientSearch) return;
    setSearchLoading(true);
    try {
      const res = await api.get(`/patients?search=${patientSearch}`);
      setPatientResults(res.data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Patient search failed", variant: "error" });
    } finally {
      setSearchLoading(false);
    }
  };

  const addInvoiceItem = () => {
    setInvoiceItems([...invoiceItems, { description: "", amount: 0, quantity: 1 }]);
  };

  const removeInvoiceItem = (idx: number) => {
    if (idx === 0) return; // Prevent removing base consultation fee
    const updated = invoiceItems.filter((_, i) => i !== idx);
    setInvoiceItems(updated);
    
    // Shift validation errors down
    setErrors((prev) => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach(key => {
        if (key.startsWith("itemDescription_") || key.startsWith("itemAmount_") || key.startsWith("itemQuantity_")) {
          const parts = key.split("_");
          const fieldName = parts[0];
          const rowIdx = Number(parts[1]);
          if (rowIdx < idx) {
            next[key] = prev[key];
          } else if (rowIdx > idx) {
            next[`${fieldName}_${rowIdx - 1}`] = prev[key];
          }
        } else {
          next[key] = prev[key];
        }
      });
      return next;
    });
  };

  const updateInvoiceItemField = (idx: number, field: keyof InvoiceItem, val: string | number) => {
    const updated = [...invoiceItems];
    if (field === "amount" || field === "quantity") {
      const numVal = Number(val) || 0;
      updated[idx] = { ...updated[idx], [field]: numVal };
      
      const tempItems = [...updated];
      const tempSubtotal = tempItems.reduce((acc, curr) => acc + (curr.amount * curr.quantity), 0);
      validateInvoiceField(field === "amount" ? "itemAmount" : "itemQuantity", numVal, idx, tempSubtotal, taxAmount);
    } else if (field === "description") {
      updated[idx] = { ...updated[idx], description: String(val) };
      validateInvoiceField("itemDescription", val, idx);
    }
    setInvoiceItems(updated);
  };

  // Live Totals
  const subtotal = invoiceItems.reduce((acc, curr) => acc + (curr.amount * curr.quantity), 0);
  const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInvoiceForm()) {
      toast({ title: "Validation Error", description: "Please resolve the form validation errors.", variant: "warning" });
      return;
    }

    try {
      setSubmittingInvoice(true);
      await api.post("/invoices", {
        patientId: selectedPatient.id,
        clinicId: selectedClinicId,
        doctorId: selectedDoctorId,
        items: invoiceItems,
        tax: taxAmount,
        discount: discountAmount
      });
      toast({ title: "Success", description: "Invoice generated successfully", variant: "success" });
      setIsCreateOpen(false);
      resetCreateForm();
      fetchInvoices();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to create invoice", variant: "error" });
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedClinicId("");
    setSelectedDoctorId("");
    setSelectedPatient(null);
    setPatientSearch("");
    setPatientResults([]);
    setInvoiceItems([{ description: "General Consultation Fee", amount: 0, quantity: 1 }]);
    setTaxAmount(0);
    setDiscountAmount(0);
    setErrors({});
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice) return;
    try {
      setSubmittingPayment(true);
      await api.put(`/invoices/${activeInvoice.id}/pay`, { paymentMethod: collectMethod });
      toast({ title: "Payment Recorded", description: `Collected successfully via ${collectMethod.toUpperCase()}`, variant: "success" });
      setIsCollectOpen(false);
      setActiveInvoice(null);
      fetchInvoices();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to record payment", variant: "error" });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handlePrintReceipt = (inv: Invoice) => {
    setReceiptInvoice(inv);
    setReceiptOpen(true);
  };

  const triggerBrowserPrint = (ticketData: Invoice) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Cash Receipt - ${ticketData.invoiceNumber}</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; padding: 20px; }
            .receipt { width: 380px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .center { text-align: center; }
            .border-dashed { border-bottom: 1px dashed #ccc; margin: 15px 0; }
            .flex-between { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
            .bold { font-weight: bold; }
            .title { font-size: 16px; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
            th { border-bottom: 1px solid #ddd; text-align: left; padding-bottom: 5px; }
            td { padding: 4px 0; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <h3 class="title">ANANTA HEALTHCARE SYSTEM</h3>
              <p style="margin:2px 0; font-size:11px;">${ticketData.clinicId?.name}</p>
              <p style="margin:2px 0; font-size:10px;">${ticketData.clinicId?.address}, ${ticketData.clinicId?.city}</p>
            </div>
            <div class="border-dashed"></div>
            <div class="flex-between"><span class="bold">Receipt No:</span><span>${ticketData.invoiceNumber}</span></div>
            <div class="flex-between"><span class="bold">Date:</span><span>${new Date(ticketData.createdAt).toLocaleDateString()}</span></div>
            <div class="flex-between"><span class="bold">Patient:</span><span>${ticketData.patientId?.userId?.name}</span></div>
            <div class="flex-between"><span class="bold">Doctor:</span><span>Dr. ${ticketData.doctorId?.name}</span></div>
            <div class="border-dashed"></div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:right;">Qty</th>
                  <th style="text-align:right;">Amt</th>
                </tr>
              </thead>
              <tbody>
                ${ticketData.items.map(item => `
                  <tr>
                    <td>${item.description}</td>
                    <td style="text-align:right;">${item.quantity}</td>
                    <td style="text-align:right;">₹${item.amount * item.quantity}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div class="border-dashed"></div>
            <div class="flex-between"><span>Subtotal:</span><span>₹${ticketData.subtotal}</span></div>
            <div class="flex-between"><span>Tax:</span><span>₹${ticketData.tax}</span></div>
            <div class="flex-between"><span>Discount:</span><span>-₹${ticketData.discount}</span></div>
            <div class="flex-between bold" style="font-size:14px; margin-top:8px;">
              <span>Total Amount:</span><span>₹${ticketData.totalAmount}</span>
            </div>
            <div class="border-dashed"></div>
            <div class="center">
              <span style="font-size: 13px; font-weight: bold; background: #e6f4ea; color: #137333; padding: 4px 12px; border-radius: 99px; text-transform: uppercase;">
                ${ticketData.status}
              </span>
              ${ticketData.paymentMethod ? `<p style="font-size:11px; margin-top:10px;">Method: ${ticketData.paymentMethod.toUpperCase()}</p>` : ""}
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Search filtered invoices locally
  const filteredInvoices = invoices.filter(inv => {
    const patientName = inv.patientId?.userId?.name || "";
    const phone = inv.patientId?.userId?.phone || "";
    const num = inv.invoiceNumber || "";
    const query = searchQuery.toLowerCase();
    return patientName.toLowerCase().includes(query) || phone.includes(query) || num.toLowerCase().includes(query);
  });

  // Calculate billing analytics metrics
  const todayStr = new Date().toISOString().split("T")[0];
  const todaysPaidAmount = invoices.reduce((acc, curr) => {
    if (curr.status !== "paid") return acc;
    const dateStr = (curr.paymentDate || curr.createdAt || "").split("T")[0];
    return dateStr === todayStr ? acc + curr.totalAmount : acc;
  }, 0);

  const pendingAmount = invoices.reduce((acc, curr) => {
    return curr.status === "unpaid" ? acc + curr.totalAmount : acc;
  }, 0);

  const unpaidCount = invoices.filter(i => i.status === "unpaid").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text">Invoices & Billing</h2>
          <p className="text-xs sm:text-sm text-text-secondary">Track payments, create manual bills, and collect outpatient fees.</p>
        </div>
      </div>

      {/* KPI Stats Analytics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4">
        <StatCard
          label="Today's Collections"
          value={`₹${todaysPaidAmount}`}
          icon={
            <svg className="h-5 w-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Outstanding Balances"
          value={`₹${pendingAmount}`}
          icon={
            <svg className="h-5 w-5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="Unpaid Invoices"
          value={unpaidCount.toString()}
          icon={
            <svg className="h-5 w-5 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* Invoices List Table */}
      <Table
        onAddClick={() => setIsCreateOpen(true)}
        actionLabel="Create Manual Invoice"
        searchPlaceholder="Search patient name, phone, or invoice #..."
        loading={loading}
        toolbarFilters={
          <>
            {clinics.length > 1 && (
              <div className="flex-1 min-w-[130px] sm:max-w-[160px]">
                <Select
                  size="sm"
                  placeholder="All Clinics"
                  value={filterClinic}
                  onChange={(e) => setFilterClinic(e.target.value)}
                  options={[{ value: "", label: "All Clinics" }, ...clinics.map(c => ({ value: c.id, label: c.name }))]}
                />
              </div>
            )}
            <div className="flex-1 min-w-[130px] sm:max-w-[160px]">
              <Select
                size="sm"
                placeholder="All Statuses"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "unpaid", label: "Unpaid" },
                  { value: "paid", label: "Paid" },
                  { value: "refunded", label: "Refunded" }
                ]}
              />
            </div>
          </>
        }
        columns={[
          { key: "invoiceNumber", header: "Invoice #", render: (row: Invoice) => <span className="font-bold text-primary-600">#{row.invoiceNumber}</span> },
          { key: "patient", header: "Patient", render: (row: Invoice) => (
            <div className="flex flex-col">
              <span className="font-medium text-text">{row.patientId?.userId?.name || "Patient Profile"}</span>
              <span className="text-xs text-text-secondary">{row.patientId?.userId?.phone}</span>
            </div>
          )},
          { key: "clinic", header: "Clinic Location", render: (row: Invoice) => <span>{row.clinicId?.name}</span> },
          { key: "doctor", header: "Doctor", render: (row: Invoice) => <span>Dr. {row.doctorId?.name}</span> },
          { key: "totalAmount", header: "Total", render: (row: Invoice) => <span className="font-semibold">₹{row.totalAmount}</span> },
          { key: "status", header: "Status", render: (row: Invoice) => (
            <Badge variant={row.status === "paid" ? "success" : row.status === "unpaid" ? "danger" : "default"} className="capitalize">
              {row.status}
            </Badge>
          )},
          { key: "actions", header: "Actions", render: (row: Invoice) => (
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
                ...(row.status === "unpaid" ? [{ label: "Collect Payment", onClick: () => { setActiveInvoice(row); setIsCollectOpen(true); } }] : []),
                { label: "View & Print Receipt", onClick: () => handlePrintReceipt(row) },
              ]}
            />
          )}
        ]}
        data={filteredInvoices}
        emptyMessage="No invoices found."
      />

      {/* Create Manual Invoice Modal */}
      <Modal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetCreateForm(); }} title="Create Manual Invoice" size="lg">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          
          {/* Step 1: Choose Patient */}
          <div className="space-y-2 border-b border-border pb-4">
            <h3 className="text-sm font-bold text-text">1. Choose Patient</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Search patient name, email, or mobile..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePatientSearch()}
              />
              <Button type="button" onClick={handlePatientSearch} loading={searchLoading}>Search</Button>
            </div>

            {patientResults.length > 0 && (
              <div className="border border-border rounded-lg max-h-40 overflow-y-auto bg-surface mt-2 divide-y divide-border">
                {patientResults.map(p => (
                  <div key={p.id} className="p-2.5 flex justify-between items-center hover:bg-surface-hover transition-colors">
                    <div>
                      <p className="font-semibold text-sm text-text">{p.userId?.name}</p>
                      <p className="text-xs text-text-secondary">{p.userId?.phone} • {p.userId?.email}</p>
                    </div>
                    <Button size="xs" variant="secondary" type="button" onClick={() => {
                      setSelectedPatient(p);
                      setPatientResults([]);
                      setPatientSearch("");
                      validateInvoiceField("patient", p);
                    }}>Select</Button>
                  </div>
                ))}
              </div>
            )}

            {selectedPatient && (
              <div className="p-3 bg-success-50 dark:bg-success-950/20 border border-success-200 dark:border-success-900/40 rounded-lg flex items-center justify-between mt-2">
                <div>
                  <p className="text-sm font-semibold text-success-800 dark:text-success-300">Selected Patient: {selectedPatient.userId?.name}</p>
                  <p className="text-xs text-success-600 dark:text-success-400">{selectedPatient.userId?.phone} • {selectedPatient.userId?.email}</p>
                </div>
                <button type="button" onClick={() => {
                  setSelectedPatient(null);
                  validateInvoiceField("patient", null);
                }} className="text-xs text-text-muted hover:text-danger-600 underline">Change</button>
              </div>
            )}

            {!selectedPatient && errors.patient && (
              <p className="text-xs text-danger-500 mt-1.5 animate-fade-in">{errors.patient}</p>
            )}
          </div>

          {/* Step 2: Clinic & Doctor Details */}
          <div className="grid grid-cols-2 gap-4 border-b border-border pb-4">
            <Select
              label="Choose Clinic Location *"
              value={selectedClinicId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedClinicId(val);
                setSelectedDoctorId("");
                validateInvoiceField("clinicId", val);
              }}
              options={[{ value: "", label: "Select clinic..." }, ...clinics.map(c => ({ value: c.id, label: c.name }))]}
              error={errors.clinicId}
              required
            />
            <Select
              label="Choose Doctor *"
              value={selectedDoctorId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDoctorId(val);
                validateInvoiceField("doctorId", val);
              }}
              options={[
                { value: "", label: "Select doctor..." },
                ...doctorAssignments.map(a => ({ value: a.doctorId?.id || a.doctorId, label: `Dr. ${a.doctorId?.name} (${a.doctorId?.specialization})` }))
              ]}
              disabled={!selectedClinicId}
              error={errors.doctorId}
              required
            />
          </div>

          {/* Step 3: Items Builder */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-text">Invoice Items</h3>
              <Button type="button" size="xs" variant="outline" onClick={addInvoiceItem}>+ Add Custom Charge</Button>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {invoiceItems.map((item, idx) => (
                <div key={idx} className="flex gap-2.5 items-end">
                  <div className="flex-1">
                    <Input
                      label={idx === 0 ? "Base Charge *" : "Item Description *"}
                      value={item.description}
                      onChange={(e) => updateInvoiceItemField(idx, "description", e.target.value)}
                      disabled={idx === 0}
                      error={errors[`itemDescription_${idx}`]}
                      required
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      label="Amount *"
                      type="number"
                      value={item.amount || ""}
                      onChange={(e) => updateInvoiceItemField(idx, "amount", e.target.value)}
                      error={errors[`itemAmount_${idx}`]}
                      required
                    />
                  </div>
                  <div className="w-16">
                    <Input
                      label="Qty *"
                      type="number"
                      value={item.quantity || ""}
                      onChange={(e) => updateInvoiceItemField(idx, "quantity", e.target.value)}
                      error={errors[`itemQuantity_${idx}`]}
                      required
                    />
                  </div>
                  {idx > 0 && (
                    <Button type="button" size="sm" variant="danger" className="mb-0.5" onClick={() => removeInvoiceItem(idx)}>✕</Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div className="space-y-3">
              <Input
                label="Add Tax (₹)"
                type="number"
                value={taxAmount || ""}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setTaxAmount(val);
                  validateInvoiceField("tax", val);
                  if (discountAmount > 0) {
                    validateInvoiceField("discount", discountAmount, undefined, subtotal, val);
                  }
                }}
                error={errors.tax}
              />
              <Input
                label="Add Discount (₹)"
                type="number"
                value={discountAmount || ""}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setDiscountAmount(val);
                  validateInvoiceField("discount", val, undefined, subtotal, taxAmount);
                }}
                error={errors.discount}
              />
            </div>
            <div className="p-4 bg-surface-alt border border-border rounded-xl flex flex-col justify-center text-right space-y-1">
              <p className="text-xs text-text-secondary">Subtotal: <span className="font-semibold text-text">₹{subtotal}</span></p>
              <p className="text-xs text-text-secondary">Tax: <span className="font-semibold text-text">+₹{taxAmount}</span></p>
              <p className="text-xs text-text-secondary">Discount: <span className="font-semibold text-text">-₹{discountAmount}</span></p>
              <div className="border-t border-border/80 my-1 pt-1">
                <p className="text-base font-extrabold text-text">Total Due: <span className="text-primary-600">₹{totalAmount}</span></p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4 mt-6">
            <Button variant="outline" type="button" onClick={() => { setIsCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
            <Button type="submit" loading={submittingInvoice} disabled={!selectedPatient || !selectedClinicId || !selectedDoctorId}>Generate Invoice</Button>
          </div>
        </form>
      </Modal>

      {/* Collect Payment Modal */}
      <Modal open={isCollectOpen} onClose={() => { setIsCollectOpen(false); setActiveInvoice(null); }} title="Record Invoice Payment" size="sm">
        <form onSubmit={handleCollectPayment} className="space-y-4">
          <div className="p-4 bg-surface-alt border border-border rounded-xl space-y-1">
            <p className="text-xs text-text-secondary">Invoice Reference: <span className="font-bold text-text">#{activeInvoice?.invoiceNumber}</span></p>
            <p className="text-xs text-text-secondary">Patient: <span className="font-semibold text-text">{activeInvoice?.patientId?.userId?.name}</span></p>
            <p className="text-sm font-bold text-text mt-1">Total Amount Due: <span className="text-primary-600">₹{activeInvoice?.totalAmount}</span></p>
          </div>

          <Select
            label="Payment Collection Method *"
            value={collectMethod}
            onChange={(e) => setCollectMethod(e.target.value)}
            options={[
              { value: "cash", label: "Cash Payment" },
              { value: "card", label: "Card swipe / POS" },
              { value: "upi", label: "UPI Desk QR Scan" },
              { value: "insurance", label: "Insurance claim settlement" }
            ]}
            required
          />

          <div className="flex justify-end gap-3 border-t border-border pt-4 mt-4">
            <Button variant="outline" type="button" onClick={() => { setIsCollectOpen(false); setActiveInvoice(null); }}>Cancel</Button>
            <Button type="submit" loading={submittingPayment}>Record Payment</Button>
          </div>
        </form>
      </Modal>

      {/* Printable Receipt Preview Modal */}
      <Modal open={receiptOpen} onClose={() => { setReceiptOpen(false); setReceiptInvoice(null); }} title="Cash Payment Receipt" size="md">
        {receiptInvoice && (
          <div className="space-y-6">
            <div className="border border-border rounded-xl p-5 bg-surface-alt font-mono text-sm space-y-4">
              <div className="text-center border-b border-border/80 border-dashed pb-4 mb-2">
                <h3 className="font-extrabold text-base tracking-tight text-text">JK HEALTHCARE SYSTEM</h3>
                <p className="text-xs text-text-muted mt-0.5">{receiptInvoice.clinicId?.name}</p>
                <p className="text-[11px] text-text-muted">{receiptInvoice.clinicId?.address}, {receiptInvoice.clinicId?.city}</p>
              </div>

              <div className="space-y-1 border-b border-border/80 border-dashed pb-3">
                <div className="flex justify-between"><span className="text-text-muted">Invoice No:</span><span className="font-bold text-text">#{receiptInvoice.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Invoice Date:</span><span>{new Date(receiptInvoice.createdAt).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Patient:</span><span className="font-semibold text-text">{receiptInvoice.patientId?.userId?.name}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Doctor:</span><span>Dr. {receiptInvoice.doctorId?.name}</span></div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex justify-between font-bold border-b border-border pb-1">
                  <span>Item Description</span>
                  <span className="w-12 text-right">Qty</span>
                  <span className="w-20 text-right">Amount</span>
                </div>
                {receiptInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-0.5">
                    <span className="truncate max-w-[200px]">{item.description}</span>
                    <span className="w-12 text-right">{item.quantity}</span>
                    <span className="w-20 text-right">₹{item.amount * item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="border-t border-border/80 border-dashed pt-3 space-y-1.5 text-xs text-right">
                <div className="flex justify-between"><span>Subtotal:</span><span>₹{receiptInvoice.subtotal}</span></div>
                <div className="flex justify-between"><span>Tax Charges:</span><span>₹{receiptInvoice.tax}</span></div>
                <div className="flex justify-between"><span>Discounts:</span><span>-₹{receiptInvoice.discount}</span></div>
                <div className="flex justify-between font-extrabold text-sm border-t border-border/60 pt-1.5 text-text">
                  <span>Total Amount Paid:</span><span>₹{receiptInvoice.totalAmount}</span>
                </div>
              </div>

              <div className="text-center pt-2">
                <span className={`inline-block font-extrabold text-xs px-4 py-1.5 rounded-full uppercase border ${
                  receiptInvoice.status === "paid" 
                    ? "bg-success-100/50 text-success-800 border-success-300/40" 
                    : "bg-danger-100/50 text-danger-800 border-danger-300/40"
                }`}>
                  {receiptInvoice.status}
                </span>
                {receiptInvoice.paymentMethod && (
                  <p className="text-[11px] text-text-muted mt-2">Paid via {receiptInvoice.paymentMethod.toUpperCase()} on {receiptInvoice.paymentDate ? new Date(receiptInvoice.paymentDate).toLocaleDateString() : ""}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="outline" onClick={() => { setReceiptOpen(false); setReceiptInvoice(null); }}>Close</Button>
              <Button onClick={() => triggerBrowserPrint(receiptInvoice)}>Print Receipt</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
