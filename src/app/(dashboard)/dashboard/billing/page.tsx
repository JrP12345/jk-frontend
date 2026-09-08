"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { useClinicStore } from "@/store/clinicStore";
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
  Spinner,
  Badge,
  StatCard,
  Dropdown,
  ChartContainer,
  AreaChart,
  DonutChart,
  cn,
} from "@/components/ui";
import { UnifiedDocumentModal, UnifiedDocumentData } from "@/components/clinical/UnifiedDocumentModal";
import {
  RotateCw,
  Plus,
  FileText,
  IndianRupee,
  AlertCircle,
  Receipt,
  CreditCard,
  CheckCircle2,
  Printer,
  Search,
  Building2,
  Stethoscope,
  Phone,
  Trash2,
  MoreHorizontal,
  ArrowRight,
  Clock,
  Check,
  Banknote,
  AlertTriangle,
} from "lucide-react";

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
  amountPaid?: number;
  balanceDue?: number;
  status: "unpaid" | "partially_paid" | "paid" | "refunded";
  paymentMethod?: string;
  paymentDate?: string;
  createdAt: string;
}

export const roundCurrency = (val: number): number => {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
};

export default function BillingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { clinics, fetchClinics } = useClinicStore();
  const { toast } = useToast();
  const canManageBilling = hasAnyPermission(user, "MANAGE_BILLING");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters State
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
    { description: "General Consultation Fee", amount: 0, quantity: 1 },
  ]);
  const [taxAmount, setTaxAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // Collect Payment Modal State
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [collectMethod, setCollectMethod] = useState<
    "cash" | "card" | "upi" | "net-banking" | "insurance" | "online"
  >("cash");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Partial / Installment Payment Modal State
  const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);
  const [partialTargetInvoice, setPartialTargetInvoice] = useState<Invoice | null>(null);
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [partialMethod, setPartialMethod] = useState<string>("cash");
  const [partialRef, setPartialRef] = useState<string>("");
  const [partialNotes, setPartialNotes] = useState<string>("");
  const [submittingPartial, setSubmittingPartial] = useState(false);

  // Cashier Till Reconciliation & Z-Report State
  const [isTillModalOpen, setIsTillModalOpen] = useState(false);
  const [tillClinicId, setTillClinicId] = useState("");
  const [tillSummary, setTillSummary] = useState<{
    date: string;
    clinicId: string;
    systemTotals: {
      cash: number;
      upi: number;
      card: number;
      other: number;
      total: number;
      invoiceCount: number;
    };
    latestShift?: any;
  } | null>(null);
  const [loadingTillSummary, setLoadingTillSummary] = useState(false);
  const [actualCashCounted, setActualCashCounted] = useState<string>("");
  const [varianceReason, setVarianceReason] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [submittingTillClose, setSubmittingTillClose] = useState(false);
  const [zReportSlip, setZReportSlip] = useState<any | null>(null);

  // 1-Click Consolidated OPD Checkout State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [opdAppointments, setOpdAppointments] = useState<any[]>([]);
  const [loadingOpdAppointments, setLoadingOpdAppointments] = useState(false);
  const [selectedCheckoutApptId, setSelectedCheckoutApptId] = useState<string>("");
  const [checkoutPreview, setCheckoutPreview] = useState<{
    appointment: any;
    items: Array<{
      description: string;
      amount: number;
      quantity: number;
      category: string;
      gstRate: number;
    }>;
    subtotal: number;
    cgstTotal: number;
    sgstTotal: number;
    totalAmount: number;
    existingInvoice?: any;
    isAlreadyPaid: boolean;
  } | null>(null);
  const [loadingCheckoutPreview, setLoadingCheckoutPreview] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"cash" | "upi" | "card">("cash");
  const [checkoutDiscount, setCheckoutDiscount] = useState<number>(0);
  const [checkoutNotes, setCheckoutNotes] = useState<string>("");
  const [checkoutRefNumber, setCheckoutRefNumber] = useState<string>("");
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  const fetchCheckoutPreview = async (apptId: string) => {
    if (!apptId) return;
    setLoadingCheckoutPreview(true);
    try {
      const res = await api.get(`/billing/checkout/preview/${apptId}`);
      setCheckoutPreview(res.data?.data);
    } catch (err: any) {
      toast({
        title: "Checkout Preview Error",
        description: err.response?.data?.message || "Failed to load consolidated charges.",
        variant: "error",
      });
    } finally {
      setLoadingCheckoutPreview(false);
    }
  };

  const fetchOpdAppointments = async () => {
    const cId = filterClinic || clinics[0]?.id || "";
    setLoadingOpdAppointments(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await api.get(`/appointments?clinicId=${cId}&startDate=${today}&endDate=${today}`);
      const list = res.data?.data || [];
      const activeAppts = list.filter((a: any) =>
        ["confirmed", "checked-in", "in-consultation", "completed"].includes(a.status)
      );
      setOpdAppointments(activeAppts);
      if (activeAppts.length > 0) {
        const firstId = activeAppts[0].id || activeAppts[0]._id;
        setSelectedCheckoutApptId(firstId);
        fetchCheckoutPreview(firstId);
      } else {
        setSelectedCheckoutApptId("");
        setCheckoutPreview(null);
      }
    } catch (err) {
      console.error("fetchOpdAppointments error", err);
    } finally {
      setLoadingOpdAppointments(false);
    }
  };

  const handleOpenCheckoutModal = () => {
    setIsCheckoutModalOpen(true);
    setCheckoutDiscount(0);
    setCheckoutNotes("");
    setCheckoutRefNumber("");
    fetchOpdAppointments();
  };

  const handleExecuteConsolidatedCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheckoutApptId || !checkoutPreview) return;

    setSubmittingCheckout(true);
    try {
      const netPayable = Math.max(0, checkoutPreview.totalAmount - (Number(checkoutDiscount) || 0));
      const res = await api.post("/billing/checkout/consolidate", {
        appointmentId: selectedCheckoutApptId,
        paymentMethod: checkoutPaymentMethod,
        discount: Number(checkoutDiscount) || 0,
        amountPaid: netPayable,
        referenceNumber: checkoutRefNumber.trim() || undefined,
        notes: checkoutNotes.trim() || undefined,
      });

      const invoiceData = res.data?.data;
      toast({
        title: "OPD Checkout Completed!",
        description: `Consolidated invoice #${invoiceData?.invoiceNumber} generated & settled via ${checkoutPaymentMethod.toUpperCase()}.`,
        variant: "success",
      });

      // Prepare Unified Document Modal for immediate Tax Invoice printing
      const appt = checkoutPreview.appointment;
      const patientName = appt?.patientId?.userId?.name || appt?.patientId?.name || "Patient";
      const invoiceDoc: UnifiedDocumentData = {
        documentType: "invoice",
        title: "Tax Invoice & OPD Settlement Receipt",
        clinicName: appt?.clinicId?.name || "Medical Clinic",
        clinicAddress: appt?.clinicId?.address || "",
        doctorName: (appt?.doctorId as any)?.name || "Attending Physician",
        doctorSpecialization: (appt?.doctorId as any)?.specialization || "General Medicine",
        patientName,
        patientId: appt?.patientId?.id || appt?.patientId?._id,
        date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        referenceNumber: invoiceData?.invoiceNumber || `INV-${Date.now()}`,
        invoiceItems: checkoutPreview.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          amount: it.amount,
        })),
        invoiceTotals: {
          subtotal: checkoutPreview.subtotal,
          tax: (checkoutPreview.cgstTotal || 0) + (checkoutPreview.sgstTotal || 0),
          discount: Number(checkoutDiscount) || 0,
          total: netPayable,
          status: "PAID",
        },
      };

      setIsCheckoutModalOpen(false);
      setUnifiedDoc(invoiceDoc);
      setPrintModalOpen(true);
      fetchInvoices();
    } catch (err: any) {
      toast({
        title: "Checkout Settlement Error",
        description: err.response?.data?.message || "Failed to settle consolidated checkout.",
        variant: "error",
      });
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const fetchTillSummary = async (clinicIdToFetch: string) => {
    if (!clinicIdToFetch) return;
    setLoadingTillSummary(true);
    try {
      const res = await api.get(`/billing/till/summary?clinicId=${clinicIdToFetch}`);
      const data = res.data?.data || res.data;
      setTillSummary(data);
    } catch (err: any) {
      toast({
        title: "Till Summary Error",
        description: err.response?.data?.message || "Failed to load cashier till summary",
        variant: "error",
      });
    } finally {
      setLoadingTillSummary(false);
    }
  };

  const handleOpenTillModal = () => {
    const activeCId = String(filterClinic || clinics[0]?.id || "");
    setTillClinicId(activeCId);
    setActualCashCounted("");
    setVarianceReason("");
    setHandoverNotes("");
    setZReportSlip(null);
    setIsTillModalOpen(true);
    if (activeCId) {
      fetchTillSummary(activeCId);
    }
  };

  const handleCloseTill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tillClinicId) {
      toast({ title: "Validation Error", description: "Please select a clinic for till closeout.", variant: "error" });
      return;
    }
    const counted = Number(actualCashCounted);
    if (isNaN(counted) || counted < 0) {
      toast({ title: "Validation Error", description: "Please enter a valid non-negative counted cash amount.", variant: "error" });
      return;
    }

    const systemCash = tillSummary?.systemTotals?.cash || 0;
    const variance = Math.round((counted - systemCash) * 100) / 100;

    if (variance !== 0 && !varianceReason.trim()) {
      toast({
        title: "Variance Reason Required",
        description: `Please enter an explanation for the ₹${Math.abs(variance)} cash ${variance < 0 ? "shortage" : "surplus"}.`,
        variant: "error",
      });
      return;
    }

    setSubmittingTillClose(true);
    try {
      const res = await api.post("/billing/till/close", {
        clinicId: tillClinicId,
        actualCashCounted: counted,
        varianceReason: varianceReason.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
      });

      const shiftData = res.data?.data || res.data;
      setZReportSlip(shiftData);
      toast({
        title: "Till Shift Closed",
        description: res.data?.message || "Cashier till closed successfully and Z-Report generated.",
        variant: "success",
      });
      fetchInvoices();
    } catch (err: any) {
      toast({
        title: "Close Till Error",
        description: err.response?.data?.message || "Failed to close till",
        variant: "error",
      });
    } finally {
      setSubmittingTillClose(false);
    }
  };

  const openPartialPaymentModal = (inv: Invoice) => {
    setPartialTargetInvoice(inv);
    const balance = inv.balanceDue !== undefined ? inv.balanceDue : inv.totalAmount - (inv.amountPaid || 0);
    setPartialAmount(balance);
    setPartialMethod("cash");
    setPartialRef("");
    setPartialNotes("");
    setIsPartialModalOpen(true);
  };

  const handleRecordPartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialTargetInvoice || partialAmount <= 0) {
      toast({ title: "Validation Error", description: "Please enter a valid payment amount greater than 0.", variant: "error" });
      return;
    }

    const currentBalance = roundCurrency(
      partialTargetInvoice.balanceDue !== undefined
        ? partialTargetInvoice.balanceDue
        : partialTargetInvoice.totalAmount - (partialTargetInvoice.amountPaid || 0)
    );

    if (roundCurrency(partialAmount) > currentBalance) {
      toast({
        title: "Validation Error",
        description: `Payment amount cannot exceed remaining balance of ₹${currentBalance}`,
        variant: "error",
      });
      return;
    }

    setSubmittingPartial(true);
    try {
      const res = await api.post(`/invoices/${partialTargetInvoice.id}/payments`, {
        amount: roundCurrency(partialAmount),
        paymentMethod: partialMethod,
        referenceNumber: partialRef,
        notes: partialNotes,
      });

      toast({
        title: "Payment Recorded",
        description: res.data?.message || "Payment installment recorded successfully.",
        variant: "success",
      });
      setIsPartialModalOpen(false);
      fetchInvoices();
    } catch (err: any) {
      toast({
        title: "Payment Failed",
        description: err.response?.data?.message || "Unable to record payment installment.",
        variant: "error",
      });
    } finally {
      setSubmittingPartial(false);
    }
  };

  // Receipt Modal State
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);

  // Print Invoice PDF Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [unifiedDoc, setUnifiedDoc] = useState<UnifiedDocumentData | null>(null);

  const handleOpenPrintInvoice = (inv: Invoice) => {
    setUnifiedDoc({
      documentType: "invoice",
      title: `INVOICE #${inv.invoiceNumber}`,
      clinicName: inv.clinicId?.name || "Healthcare Center",
      clinicAddress: inv.clinicId?.address || inv.clinicId?.city,
      doctorName: inv.doctorId?.name,
      doctorSpecialization: inv.doctorId?.specialization,
      patientName: inv.patientId?.userId?.name || "Patient Profile",
      patientId: inv.patientId?.id,
      date: new Date(inv.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      referenceNumber: inv.invoiceNumber,
      invoiceItems: inv.items || [],
      invoiceTotals: {
        subtotal: inv.subtotal,
        tax: inv.tax,
        discount: inv.discount,
        total: inv.totalAmount,
        status: inv.status,
      },
    });
    setPrintModalOpen(true);
  };

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateInvoiceField = (
    field: string,
    value: any,
    idx?: number,
    currentSubtotal = subtotal,
    currentTax = taxAmount
  ) => {
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
      } else if (
        field === "itemQuantity" &&
        (isNaN(Number(value)) || Number(value) <= 0 || !Number.isInteger(Number(value)))
      ) {
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
    if (!invoiceItems || invoiceItems.length === 0) {
      newErrors.items = "At least one invoice line item is required";
    }

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

  useEffect(() => {
    if (user && user.role !== "patient") fetchClinics();
  }, [user?.id, user?.role, fetchClinics]);

  const fetchInvoices = async () => {
    try {
      setIsRefreshing(true);
      const queryParams = [];
      if (filterClinic) queryParams.push(`clinicId=${filterClinic}`);
      if (filterStatus) queryParams.push(`status=${filterStatus}`);
      const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

      const res = await api.get(`/invoices${queryString}`);
      setInvoices(res.data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load invoices", variant: "error" });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user, filterClinic, filterStatus]);

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
        console.error("Failed to load doctor assignments", err);
      }
    };
    fetchAssignments();
  }, [selectedClinicId]);

  useEffect(() => {
    if (!selectedDoctorId || !selectedClinicId) return;
    const activeAssign = doctorAssignments.find((a) => (a.doctorId?.id || a.doctorId) === selectedDoctorId);
    if (activeAssign) {
      const fee = activeAssign.fees || 200;
      setInvoiceItems((prev) => {
        const updated = [...prev];
        updated[0] = { ...updated[0], amount: fee };
        return updated;
      });
    }
  }, [selectedDoctorId, selectedClinicId, doctorAssignments]);

  // Debounced Patient Lookup
  useEffect(() => {
    if (!patientSearch.trim() || patientSearch.length < 2) {
      setPatientResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`/patients?search=${encodeURIComponent(patientSearch.trim())}`);
        setPatientResults(res.data.data || []);
      } catch {
        // Non-critical search error
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearch]);

  const handlePatientSearch = async () => {
    if (!patientSearch.trim()) return;
    setSearchLoading(true);
    try {
      const res = await api.get(`/patients?search=${encodeURIComponent(patientSearch.trim())}`);
      setPatientResults(res.data.data || []);
    } catch {
      toast({ title: "Error", description: "Patient search failed", variant: "error" });
    } finally {
      setSearchLoading(false);
    }
  };

  const addInvoiceItem = () => {
    setInvoiceItems([...invoiceItems, { description: "", amount: 0, quantity: 1 }]);
  };

  const removeInvoiceItem = (idx: number) => {
    if (idx === 0) return;
    const updated = invoiceItems.filter((_, i) => i !== idx);
    setInvoiceItems(updated);

    setErrors((prev) => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach((key) => {
        if (
          key.startsWith("itemDescription_") ||
          key.startsWith("itemAmount_") ||
          key.startsWith("itemQuantity_")
        ) {
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
      const tempSubtotal = tempItems.reduce((acc, curr) => acc + curr.amount * curr.quantity, 0);
      validateInvoiceField(field === "amount" ? "itemAmount" : "itemQuantity", numVal, idx, tempSubtotal, taxAmount);
    } else if (field === "description") {
      updated[idx] = { ...updated[idx], description: String(val) };
      validateInvoiceField("itemDescription", val, idx);
    }
    setInvoiceItems(updated);
  };

  const subtotal = roundCurrency(invoiceItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0) * (Number(curr.quantity) || 1), 0));
  const totalAmount = roundCurrency(Math.max(0, subtotal + (Number(taxAmount) || 0) - (Number(discountAmount) || 0)));

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
        discount: discountAmount,
      });
      toast({ title: "Invoice Created", description: "Invoice generated successfully.", variant: "success" });
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
      toast({
        title: "Payment Recorded",
        description: `Collected successfully via ${collectMethod.toUpperCase()}.`,
        variant: "success",
      });
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
              <h3 class="title">ANANT HEALTHCARE SYSTEM</h3>
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
                ${ticketData.items
                  .map(
                    (item) => `
                  <tr>
                    <td>${item.description}</td>
                    <td style="text-align:right;">${item.quantity}</td>
                    <td style="text-align:right;">₹${item.amount * item.quantity}</td>
                  </tr>
                `
                  )
                  .join("")}
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
              ${
                ticketData.paymentMethod
                  ? `<p style="font-size:11px; margin-top:10px;">Method: ${ticketData.paymentMethod.toUpperCase()}</p>`
                  : ""
              }
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

  const filteredInvoices = invoices.filter((inv) => {
    const patientName = inv.patientId?.userId?.name || "";
    const phone = inv.patientId?.userId?.phone || "";
    const num = inv.invoiceNumber || "";
    const query = searchQuery.toLowerCase();
    return patientName.toLowerCase().includes(query) || phone.includes(query) || num.toLowerCase().includes(query);
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const todaysPaidAmount = invoices.reduce((acc, curr) => {
    if (curr.status !== "paid") return acc;
    const dateStr = (curr.paymentDate || curr.createdAt || "").split("T")[0];
    return dateStr === todayStr ? acc + curr.totalAmount : acc;
  }, 0);

  const pendingAmount = invoices.reduce((acc, curr) => {
    return curr.status === "unpaid" ? acc + curr.totalAmount : acc;
  }, 0);

  const unpaidCount = invoices.filter((i) => i.status === "unpaid").length;

  const cashflowTrendData = (() => {
    const result = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const dayInvoices = invoices.filter((inv) => {
        const iDate = (inv.paymentDate || inv.createdAt || "").split("T")[0];
        return iDate === dateKey;
      });

      const collected = dayInvoices
        .filter((inv) => inv.status === "paid")
        .reduce((sum, inv) => sum + (inv.amountPaid || inv.totalAmount || 0), 0);

      const pending = dayInvoices
        .filter((inv) => inv.status !== "paid")
        .reduce((sum, inv) => sum + (inv.balanceDue !== undefined ? inv.balanceDue : inv.totalAmount), 0);

      result.push({
        label,
        collected,
        pending,
      });
    }
    return result;
  })();

  const paymentMethodsData = (() => {
    const counts: Record<string, number> = {
      UPI: 0,
      Card: 0,
      Cash: 0,
      "Insurance / TPA": 0,
      "Net Banking": 0,
    };

    invoices.forEach((inv) => {
      const m = (inv.paymentMethod || "").toLowerCase();
      if (m.includes("upi")) counts["UPI"] += inv.totalAmount || 1;
      else if (m.includes("card")) counts["Card"] += inv.totalAmount || 1;
      else if (m.includes("cash")) counts["Cash"] += inv.totalAmount || 1;
      else if (m.includes("insur")) counts["Insurance / TPA"] += inv.totalAmount || 1;
      else if (inv.status === "paid") counts["Net Banking"] += inv.totalAmount || 1;
    });

    const colors: Record<string, string> = {
      UPI: "var(--s-chart-1, #3b82f6)",
      Card: "var(--s-chart-4, #8b5cf6)",
      Cash: "var(--s-chart-2, #10b981)",
      "Insurance / TPA": "var(--s-chart-3, #f59e0b)",
      "Net Banking": "#06b6d4",
    };

    return Object.entries(counts)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => ({
        name,
        value,
        color: colors[name],
      }));
  })();

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
                Invoices & Revenue Billing
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Revenue Desk
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Track outpatient collections, generate medical invoices, and record installment payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/billing/services")}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-text-secondary" />
              Rate Cards
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchInvoices}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {canManageBilling && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCheckoutModal}
                  className="font-semibold rounded-xl border-primary-500/40 text-primary-700 dark:text-primary-300 hover:bg-primary-500/10 transition-colors shadow-2xs"
                  title="Consolidate Consultation + Lab Tests + Prescriptions into single 1-Click checkout"
                >
                  <Receipt className="h-3.5 w-3.5 mr-1 text-primary-500" />
                  1-Click OPD Checkout
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenTillModal}
                  className="font-semibold rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors shadow-2xs"
                  title="Reconcile Cash Drawer & Close Daily Shift (Z-Report)"
                >
                  <Banknote className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                  Close Till / Z-Report
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateOpen(true)}
                  className="font-semibold rounded-xl shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create Invoice
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. FINANCIAL KPI STATS CARDS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Today's Collections"
          value={`₹${todaysPaidAmount.toLocaleString("en-IN")}`}
          description="Settled outpatient receipts"
          icon={<IndianRupee className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          label="Outstanding Balances"
          value={`₹${pendingAmount.toLocaleString("en-IN")}`}
          description="Uncollected pending receivables"
          icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          label="Unpaid Invoices"
          value={unpaidCount.toString()}
          description="Invoices awaiting settlement"
          icon={<Receipt className="w-5 h-5 text-rose-500" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. BILLING ANALYTICS & CASHFLOW CHARTS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <ChartContainer
          title="Cashflow Velocity & Aging"
          description="14-day comparison of collected revenue vs pending receivables"
          className="lg:col-span-2"
          loading={loading}
          empty={invoices.length === 0}
          emptyMessage="No historical invoices or collections recorded yet."
        >
          <AreaChart
            data={cashflowTrendData}
            series={[
              { key: "collected", name: "Collections Inflow", color: "var(--s-chart-2, #10b981)" },
              { key: "pending", name: "Outstanding Aging", color: "var(--s-chart-3, #f59e0b)" },
            ]}
            height={210}
            valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
          />
        </ChartContainer>

        <ChartContainer
          title="Settlement Channels"
          description="Payment method volume distribution"
          className="lg:col-span-1"
          loading={loading}
          empty={paymentMethodsData.length === 0}
          emptyMessage="No payment method transactions yet."
        >
          <DonutChart
            data={paymentMethodsData}
            height={210}
            valueFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
          />
        </ChartContainer>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. INVOICES ROSTER TABLE
         ────────────────────────────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table
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
                      options={[{ value: "", label: "All Clinics" }, ...clinics.map((c) => ({ value: c.id, label: c.name }))]}
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
                      { value: "refunded", label: "Refunded" },
                    ]}
                  />
                </div>
              </>
            }
            columns={[
              {
                key: "invoiceNumber",
                header: "Invoice #",
                render: (row: Invoice) => (
                  <span className="font-mono font-bold text-xs text-primary-600 dark:text-primary-400">
                    #{row.invoiceNumber}
                  </span>
                ),
              },
              {
                key: "patient",
                header: "Patient",
                render: (row: Invoice) => (
                  <div className="space-y-0.5 min-w-[140px]">
                    <span className="font-bold text-text text-xs sm:text-sm">
                      {row.patientId?.userId?.name || "Patient Profile"}
                    </span>
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Phone className="w-3 h-3 text-text-muted" />
                      {row.patientId?.userId?.phone || "No phone"}
                    </span>
                  </div>
                ),
              },
              {
                key: "clinic",
                header: "Facility",
                render: (row: Invoice) => (
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary min-w-[120px]">
                    <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span>{row.clinicId?.name || "Clinic"}</span>
                  </div>
                ),
              },
              {
                key: "doctor",
                header: "Doctor",
                render: (row: Invoice) => (
                  <div className="flex items-center gap-1 text-xs font-semibold text-text min-w-[130px]">
                    <Stethoscope className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                    <span>Dr. {(row.doctorId?.name || "").replace(/^dr\.?\s+/i, "")}</span>
                  </div>
                ),
              },
              {
                key: "totalAmount",
                header: "Total / Balance",
                render: (row: Invoice) => (
                  <div className="space-y-0.5">
                    <span className="font-bold text-text text-xs sm:text-sm">
                      ₹{row.totalAmount.toLocaleString("en-IN")}
                    </span>
                    {row.status !== "paid" && (
                      <span className="text-xs font-bold text-rose-500 block">
                        Due: ₹
                        {(row.balanceDue !== undefined
                          ? row.balanceDue
                          : row.totalAmount - (row.amountPaid || 0)
                        ).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row: Invoice) => (
                  <Badge
                    variant={
                      row.status === "paid" ? "success" : row.status === "partially_paid" ? "warning" : "danger"
                    }
                    size="sm"
                    dot
                    className="capitalize font-semibold text-[10px]"
                  >
                    {row.status === "partially_paid" ? "Partially Paid" : row.status}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (row: Invoice) => (
                  <div className="flex items-center justify-end gap-1.5">
                    {row.status !== "paid" ? (
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => openPartialPaymentModal(row)}
                        className="shrink-0 font-semibold rounded-lg shadow-xs"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        Pay ₹
                        {(row.balanceDue !== undefined
                          ? row.balanceDue
                          : row.totalAmount - (row.amountPaid || 0)
                        ).toLocaleString("en-IN")}
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleOpenPrintInvoice(row)}
                        className="shrink-0 font-semibold rounded-lg"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1" />
                        PDF
                      </Button>
                    )}
                    <Dropdown
                      align="right"
                      trigger={
                        <Button
                          size="xs"
                          variant="outline"
                          className="h-7 w-7 p-0 flex items-center justify-center rounded-lg text-text-secondary hover:text-text"
                          title="Row Actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      }
                      items={[
                        ...(row.status !== "paid"
                          ? [
                              {
                                label: "Record Installment Payment",
                                icon: <CreditCard className="w-4 h-4 text-primary-500" />,
                                onClick: () => openPartialPaymentModal(row),
                              },
                            ]
                          : []),
                        ...(row.status === "unpaid"
                          ? [
                              {
                                label: "Collect Full Payment",
                                icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
                                onClick: () => {
                                  setActiveInvoice(row);
                                  setIsCollectOpen(true);
                                },
                              },
                            ]
                          : []),
                        {
                          label: "View & Print Receipt",
                          icon: <Printer className="w-4 h-4 text-text-muted" />,
                          onClick: () => handlePrintReceipt(row),
                        },
                        {
                          label: "Print Official PDF",
                          icon: <FileText className="w-4 h-4 text-text-muted" />,
                          onClick: () => handleOpenPrintInvoice(row),
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
            data={filteredInvoices}
            emptyMessage="No clinical invoices found for selected filter."
          />
        </CardContent>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. CREATE MANUAL INVOICE MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          resetCreateForm();
        }}
        title="Create Manual Medical Invoice"
        description="Generate an outpatient invoice itemized by consultation fees, diagnostics, and procedures."
        size="lg"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
          {/* Step 1: Choose Patient */}
          <div className="space-y-2 border-b border-border/60 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text">1. Choose Patient</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder="Search patient name, email, or mobile..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePatientSearch()}
                  className="pl-9"
                />
              </div>
              <Button type="button" onClick={handlePatientSearch} loading={searchLoading} className="font-semibold rounded-xl">
                Search
              </Button>
            </div>

            {patientResults.length > 0 && (
              <div className="border border-border/80 rounded-2xl max-h-40 overflow-y-auto bg-surface mt-2 divide-y divide-border/60">
                {patientResults.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 flex justify-between items-center hover:bg-surface-hover transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-text">{p.userId?.name}</p>
                      <p className="text-xs text-text-muted">
                        {p.userId?.phone} &bull; {p.userId?.email}
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant="primary"
                      type="button"
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientResults([]);
                        setPatientSearch("");
                        validateInvoiceField("patient", p);
                      }}
                      className="rounded-lg font-semibold"
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {selectedPatient && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between mt-2">
                <div>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Selected: {selectedPatient.userId?.name}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {selectedPatient.userId?.phone} &bull; {selectedPatient.userId?.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    validateInvoiceField("patient", null);
                  }}
                  className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  Change
                </button>
              </div>
            )}

            {!selectedPatient && errors.patient && (
              <p className="text-xs text-rose-500 mt-1">{errors.patient}</p>
            )}
          </div>

          {/* Step 2: Clinic & Doctor Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-b border-border/60 pb-4">
            <Select
              label="Choose Clinic Location *"
              value={selectedClinicId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedClinicId(val);
                setSelectedDoctorId("");
                validateInvoiceField("clinicId", val);
              }}
              options={[{ value: "", label: "Select clinic..." }, ...clinics.map((c) => ({ value: c.id, label: c.name }))]}
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
                ...doctorAssignments.map((a) => {
                  const docName = a.doctorId?.name || "";
                  const formattedName = docName.startsWith("Dr.") ? docName : `Dr. ${docName}`;
                  const spec = a.doctorId?.specialization ? ` (${a.doctorId.specialization})` : "";
                  return { value: a.doctorId?.id || a.doctorId, label: `${formattedName}${spec}` };
                }),
              ]}
              disabled={!selectedClinicId}
              error={errors.doctorId}
              required
            />
          </div>

          {/* Step 3: Invoice Line Items Table */}
          <div className="space-y-2 border-b border-border/60 pb-4">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text">3. Invoice Line Items</h3>
              <Button type="button" size="xs" variant="outline" onClick={addInvoiceItem} className="font-semibold rounded-lg">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Line Item
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {invoiceItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      value={item.description}
                      onChange={(e) => updateInvoiceItemField(idx, "description", e.target.value)}
                      disabled={idx === 0}
                      error={errors[`itemDescription_${idx}`]}
                      placeholder="Charge description..."
                      required
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      value={item.amount || ""}
                      onChange={(e) => updateInvoiceItemField(idx, "amount", e.target.value)}
                      error={errors[`itemAmount_${idx}`]}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      value={item.quantity || ""}
                      onChange={(e) => updateInvoiceItemField(idx, "quantity", e.target.value)}
                      error={errors[`itemQuantity_${idx}`]}
                      placeholder="1"
                      required
                    />
                  </div>
                  <div className="w-8 flex justify-center pt-1.5 shrink-0">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => removeInvoiceItem(idx)}
                        className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer"
                        title="Remove Line Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-border/60 pt-3.5">
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
            <div className="p-4 bg-surface-alt border border-border/80 rounded-2xl flex flex-col justify-center text-right space-y-1">
              <p className="text-xs text-text-muted">
                Subtotal: <span className="font-semibold text-text">₹{subtotal.toLocaleString("en-IN")}</span>
              </p>
              <p className="text-xs text-text-muted">
                Tax: <span className="font-semibold text-text">+₹{taxAmount.toLocaleString("en-IN")}</span>
              </p>
              <p className="text-xs text-text-muted">
                Discount: <span className="font-semibold text-text">-₹{discountAmount.toLocaleString("en-IN")}</span>
              </p>
              <div className="border-t border-border/60 my-1 pt-1.5">
                <p className="text-base font-bold text-text">
                  Total Due: <span className="text-primary-600 dark:text-primary-400 font-mono">₹{totalAmount.toLocaleString("en-IN")}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-border/60 pt-3.5 mt-4">
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={submittingInvoice}
              disabled={!selectedPatient || !selectedClinicId || !selectedDoctorId}
              className="font-semibold rounded-xl shadow-xs"
            >
              Generate Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. COLLECT FULL PAYMENT MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isCollectOpen}
        onClose={() => {
          setIsCollectOpen(false);
          setActiveInvoice(null);
        }}
        title="Record Invoice Payment"
        size="sm"
      >
        <form onSubmit={handleCollectPayment} className="space-y-4 pt-1">
          <div className="p-4 bg-surface-alt border border-border/80 rounded-2xl space-y-1 text-xs">
            <p className="text-text-muted">
              Invoice Reference: <span className="font-mono font-bold text-text">#{activeInvoice?.invoiceNumber}</span>
            </p>
            <p className="text-text-muted">
              Patient: <span className="font-bold text-text">{activeInvoice?.patientId?.userId?.name}</span>
            </p>
            <p className="text-sm font-bold text-text pt-1">
              Total Amount Due:{" "}
              <span className="text-primary-600 dark:text-primary-400 font-mono">
                ₹{activeInvoice?.totalAmount.toLocaleString("en-IN")}
              </span>
            </p>
          </div>

          <Select
            label="Payment Collection Method *"
            value={collectMethod}
            onChange={(e) => setCollectMethod(e.target.value as any)}
            options={[
              { value: "cash", label: "Cash Payment" },
              { value: "card", label: "Card Swipe / POS Terminal" },
              { value: "upi", label: "UPI Desk QR Scan" },
              { value: "insurance", label: "Insurance / TPA Settlement" },
            ]}
            required
          />

          <div className="flex justify-end gap-2.5 border-t border-border/60 pt-3.5">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setIsCollectOpen(false);
                setActiveInvoice(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submittingPayment} className="font-semibold rounded-xl shadow-xs">
              Record Settlement
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          7. CASH RECEIPT PREVIEW MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={receiptOpen}
        onClose={() => {
          setReceiptOpen(false);
          setReceiptInvoice(null);
        }}
        title="Cash Payment Receipt"
        size="md"
      >
        {receiptInvoice && (
          <div className="space-y-4 py-1">
            <div className="border border-border/80 rounded-2xl p-5 bg-surface-alt font-mono text-xs space-y-3">
              <div className="text-center border-b border-border/60 border-dashed pb-3 mb-2">
                <h3 className="font-bold text-sm tracking-tight text-text">HEALTHCARE RECEIPT</h3>
                <p className="text-[11px] text-text-muted mt-0.5">{receiptInvoice.clinicId?.name}</p>
                <p className="text-[10px] text-text-muted">
                  {receiptInvoice.clinicId?.address}, {receiptInvoice.clinicId?.city}
                </p>
              </div>

              <div className="space-y-1 border-b border-border/60 border-dashed pb-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">Invoice No:</span>
                  <span className="font-bold text-text">#{receiptInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Invoice Date:</span>
                  <span>{new Date(receiptInvoice.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Patient:</span>
                  <span className="font-semibold text-text">{receiptInvoice.patientId?.userId?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Doctor:</span>
                  <span>Dr. {receiptInvoice.doctorId?.name}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-bold border-b border-border/60 pb-1">
                  <span>Item Description</span>
                  <span className="w-12 text-right">Qty</span>
                  <span className="w-20 text-right">Amount</span>
                </div>
                {receiptInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-0.5">
                    <span className="truncate max-w-[200px]">{item.description}</span>
                    <span className="w-12 text-right">{item.quantity}</span>
                    <span className="w-20 text-right">₹{(item.amount * item.quantity).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="border-t border-border/60 border-dashed pt-2.5 space-y-1 text-right">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{receiptInvoice.subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>₹{receiptInvoice.tax.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-₹{receiptInvoice.discount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-border/60 pt-1.5 text-text">
                  <span>Total Paid:</span>
                  <span>₹{receiptInvoice.totalAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="text-center pt-2">
                <span className="inline-block font-bold text-[10px] px-3 py-1 rounded-full uppercase border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  {receiptInvoice.status}
                </span>
                {receiptInvoice.paymentMethod && (
                  <p className="text-[10px] text-text-muted mt-1.5">
                    Settled via {receiptInvoice.paymentMethod.toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border/60 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReceiptOpen(false);
                  setReceiptInvoice(null);
                }}
              >
                Close
              </Button>
              <Button size="sm" variant="primary" onClick={() => triggerBrowserPrint(receiptInvoice)} className="font-semibold rounded-xl shadow-xs">
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. OFFICIAL INVOICE PDF MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <UnifiedDocumentModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        document={unifiedDoc}
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          9. RECORD PARTIAL PAYMENT MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isPartialModalOpen}
        onClose={() => setIsPartialModalOpen(false)}
        title={`Record Installment: Invoice #${partialTargetInvoice?.invoiceNumber || ""}`}
        size="md"
      >
        <form onSubmit={handleRecordPartialPayment} className="space-y-4 pt-1">
          <div className="p-3.5 bg-surface-alt rounded-2xl border border-border/80 text-xs space-y-1">
            <p className="font-bold text-text">Patient: {partialTargetInvoice?.patientId?.userId?.name}</p>
            <p className="text-text-muted">
              Total Invoice Amount: ₹{partialTargetInvoice?.totalAmount.toLocaleString("en-IN")}
            </p>
            <p className="text-text-muted">
              Previously Settled: ₹{(partialTargetInvoice?.amountPaid || 0).toLocaleString("en-IN")}
            </p>
            <p className="font-bold text-rose-500 pt-1">
              Remaining Balance Due: ₹
              {(partialTargetInvoice?.balanceDue !== undefined
                ? partialTargetInvoice.balanceDue
                : (partialTargetInvoice?.totalAmount || 0) - (partialTargetInvoice?.amountPaid || 0)
              ).toLocaleString("en-IN")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Installment Payment Amount (₹) *"
              type="number"
              min="1"
              step="0.01"
              value={partialAmount}
              onChange={(e) => setPartialAmount(Number(e.target.value))}
              required
            />
            <Select
              label="Payment Method *"
              value={partialMethod}
              onChange={(e) => setPartialMethod(e.target.value)}
              options={[
                { value: "cash", label: "Cash" },
                { value: "upi", label: "UPI / QR Code" },
                { value: "card", label: "Debit/Credit Card" },
                { value: "net-banking", label: "Net Banking" },
                { value: "insurance", label: "Insurance / Cashless" },
              ]}
            />
          </div>

          <Input
            label="Transaction Reference / Cheque #"
            placeholder="e.g. UPI/123456789 or CHQ-998822"
            value={partialRef}
            onChange={(e) => setPartialRef(e.target.value)}
          />

          <Input
            label="Payment Notes"
            placeholder="Installment 1 of 3, Deposit balance, etc."
            value={partialNotes}
            onChange={(e) => setPartialNotes(e.target.value)}
          />

          <div className="flex justify-between border-t border-border/60 pt-3.5">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsPartialModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submittingPartial} className="font-semibold rounded-xl shadow-xs">
              Record Installment
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. CASHIER TILL RECONCILIATION & SHIFT CLOSE (Z-REPORT) MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isTillModalOpen}
        onClose={() => {
          setIsTillModalOpen(false);
          setZReportSlip(null);
        }}
        title="Cashier Desk Till Reconciliation & Z-Report"
        description="End-of-shift physical cash drawer balancing, digital collections audit, and official financial handover certification."
        size="md"
      >
        {zReportSlip ? (
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-2xl bg-surface border border-border/80 space-y-3 font-mono text-xs">
              <div className="text-center border-b border-dashed border-border/80 pb-3">
                <h3 className="font-bold text-sm tracking-wide uppercase text-text">
                  {clinics.find((c) => c.id === tillClinicId)?.name || "ANANTA HEALTH CLINIC"}
                </h3>
                <p className="text-[11px] text-text-muted">OFFICIAL END-OF-DAY Z-REPORT SLIP</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Shift Date: {zReportSlip.shiftDate} • Closed: {new Date(zReportSlip.endedAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-[10px] text-text-muted">
                  Cashier: <strong>{zReportSlip.cashierName || user?.name}</strong>
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-text-muted">
                  <span>Settled Invoices:</span>
                  <span className="font-bold text-text">
                    {zReportSlip.systemTotals?.invoiceCount ?? tillSummary?.systemTotals?.invoiceCount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>System Cash Total:</span>
                  <span className="font-bold text-text">
                    ₹{(zReportSlip.systemTotals?.cash ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>BharatPe UPI / QR:</span>
                  <span className="font-bold text-text">
                    ₹{(zReportSlip.systemTotals?.upi ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Card / POS Terminals:</span>
                  <span className="font-bold text-text">
                    ₹{(zReportSlip.systemTotals?.card ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {(zReportSlip.systemTotals?.other || 0) > 0 && (
                  <div className="flex justify-between text-text-muted">
                    <span>Other / Online:</span>
                    <span className="font-bold text-text">
                      ₹{(zReportSlip.systemTotals?.other ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-border/80 pt-1.5 font-bold text-text">
                  <span>Total Day Collections:</span>
                  <span className="text-primary-600 dark:text-primary-400">
                    ₹{(zReportSlip.systemTotals?.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-alt border border-border space-y-1 mt-2">
                <div className="flex justify-between">
                  <span className="font-bold text-text">Physical Cash Counted:</span>
                  <span className="font-bold text-text">
                    ₹{(zReportSlip.actualCashCounted ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border/60">
                  <span className="font-bold">Drawer Variance:</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-bold",
                      zReportSlip.cashVariance === 0
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : zReportSlip.cashVariance < 0
                        ? "bg-red-500/20 text-red-700 dark:text-red-400"
                        : "bg-blue-500/20 text-blue-700 dark:text-blue-400"
                    )}
                  >
                    {zReportSlip.cashVariance === 0
                      ? "BALANCED (₹0.00)"
                      : zReportSlip.cashVariance < 0
                      ? `SHORTAGE (-₹${Math.abs(zReportSlip.cashVariance).toFixed(2)})`
                      : `SURPLUS (+₹${zReportSlip.cashVariance.toFixed(2)})`}
                  </span>
                </div>
                {zReportSlip.varianceReason && (
                  <p className="text-[10px] text-text-muted pt-1">
                    <strong>Variance Reason:</strong> {zReportSlip.varianceReason}
                  </p>
                )}
              </div>

              {zReportSlip.handoverNotes && (
                <div className="text-[11px] text-text-muted pt-1">
                  <strong>Handover Notes:</strong> {zReportSlip.handoverNotes}
                </div>
              )}

              <div className="pt-6 grid grid-cols-2 gap-4 text-center border-t border-dashed border-border/80 text-[10px] text-text-muted">
                <div>
                  <div className="border-b border-border/80 h-6 mb-1"></div>
                  <p>Cashier Signature</p>
                </div>
                <div>
                  <div className="border-b border-border/80 h-6 mb-1"></div>
                  <p>Manager / Auditor Sign</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2 border-t border-border/60 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsTillModalOpen(false);
                  setZReportSlip(null);
                }}
              >
                Done / Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                className="font-bold shadow-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Z-Report Slip
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCloseTill} className="space-y-4 pt-1">
            {clinics.length > 1 && (
              <Select
                label="Select Clinic Counter *"
                value={tillClinicId}
                onChange={(e) => {
                  setTillClinicId(e.target.value);
                  fetchTillSummary(e.target.value);
                }}
                options={clinics.map((c) => ({ value: String(c.id), label: c.name }))}
                required
              />
            )}

            {loadingTillSummary ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-text-muted">
                <Spinner size="md" />
                <p className="text-xs">Computing live till ledger & collection receipts...</p>
              </div>
            ) : (
              <>
                {/* Live System Collections Card */}
                <div className="p-3.5 rounded-2xl bg-surface-alt border border-border/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-primary-500" />
                      System Collections ({tillSummary?.date || new Date().toISOString().slice(0, 10)})
                    </span>
                    <span className="text-xs font-bold text-text">
                      {tillSummary?.systemTotals?.invoiceCount ?? 0} Invoices Settled
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60">
                      <p className="text-[10px] text-text-muted font-semibold">CASH DRAWER</p>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                        ₹{(tillSummary?.systemTotals?.cash ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60">
                      <p className="text-[10px] text-text-muted font-semibold">BHARATPE UPI</p>
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                        ₹{(tillSummary?.systemTotals?.upi ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60">
                      <p className="text-[10px] text-text-muted font-semibold">POS / CARDS</p>
                      <p className="text-sm font-bold text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                        ₹{(tillSummary?.systemTotals?.card ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60">
                      <p className="text-[10px] text-text-muted font-semibold">TOTAL RECEIPTS</p>
                      <p className="text-sm font-bold text-text font-mono mt-0.5">
                        ₹{(tillSummary?.systemTotals?.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {tillSummary?.latestShift && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
                      <span>
                        ℹ️ Shift already closed today at{" "}
                        <strong>{new Date(tillSummary.latestShift.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setZReportSlip(tillSummary.latestShift)}
                        className="text-[10px] font-bold border-amber-500/30"
                      >
                        View Last Z-Report
                      </Button>
                    </div>
                  )}
                </div>

                {/* Drawer Cash Audit & Variance Calculation */}
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <Input
                      label="Actual Physical Cash Counted (₹) *"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 2450.00"
                      value={actualCashCounted}
                      onChange={(e) => setActualCashCounted(e.target.value)}
                      required
                    />

                    {actualCashCounted !== "" && !isNaN(Number(actualCashCounted)) && (() => {
                      const counted = Number(actualCashCounted);
                      const sys = tillSummary?.systemTotals?.cash ?? 0;
                      const diff = Math.round((counted - sys) * 100) / 100;
                      const isBalanced = diff === 0;
                      const isShort = diff < 0;

                      return (
                        <div
                          className={cn(
                            "p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold",
                            isBalanced
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                              : isShort
                              ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
                              : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400"
                          )}
                        >
                          {isBalanced ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>BALANCED: Matches system cash.</span>
                            </>
                          ) : isShort ? (
                            <>
                              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                              <span>SHORTAGE: -₹{Math.abs(diff).toFixed(2)}</span>
                            </>
                          ) : (
                            <>
                              <IndianRupee className="w-4 h-4 text-blue-600 shrink-0" />
                              <span>SURPLUS: +₹{diff.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {actualCashCounted !== "" && Number(actualCashCounted) !== (tillSummary?.systemTotals?.cash ?? 0) && (
                    <Input
                      label="Variance Justification / Explanation *"
                      placeholder="e.g. Returned petty cash, change rounding, unrecorded refund..."
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                      required
                    />
                  )}

                  <Textarea
                    label="Shift Handover & Denomination Notes"
                    placeholder="e.g. 500x4, 200x2, 100x1. Handed over drawer keys to Evening Shift..."
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex justify-between items-center border-t border-border/60 pt-3.5 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTillModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    loading={submittingTillClose}
                    className="font-bold shadow-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Banknote className="w-3.5 h-3.5 mr-1.5" />
                    Reconcile & Generate Z-Report
                  </Button>
                </div>
              </>
            )}
          </form>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          11. 1-CLICK CONSOLIDATED OPD CHECKOUT MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isCheckoutModalOpen}
        onClose={() => !submittingCheckout && setIsCheckoutModalOpen(false)}
        title="⚡ 1-Click Consolidated OPD Checkout"
        size="lg"
      >
        <form onSubmit={handleExecuteConsolidatedCheckout} className="space-y-4 pt-1">
          <p className="text-xs text-text-muted">
            Consolidate Physician Consultation Fee, Diagnostic Lab Tests, and Pharmacy Medications into a single official tax invoice.
          </p>

          {/* Select OPD Patient */}
          <div>
            <label className="text-xs font-bold text-text mb-1.5 block">Select Today's OPD Patient / Appointment *</label>
            {loadingOpdAppointments ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-alt border border-border text-xs text-text-muted">
                <Spinner size="sm" />
                <span>Loading today's OPD appointments...</span>
              </div>
            ) : opdAppointments.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-surface-alt border border-border text-xs text-text-muted">
                No active OPD appointments found for today.
              </div>
            ) : (
              <Select
                value={selectedCheckoutApptId}
                onChange={(e) => {
                  setSelectedCheckoutApptId(e.target.value);
                  fetchCheckoutPreview(e.target.value);
                }}
                options={opdAppointments.map((a: any) => ({
                  value: a.id || a._id,
                  label: `Token #${a.tokenNumber} — ${a.patientId?.userId?.name || a.patientId?.name || "Patient"} (Dr. ${(a.doctorId?.name || "").replace(/^dr\.?\s+/i, "")} • ${a.status.toUpperCase()}) [${a.paymentStatus === "paid" ? "PAID" : "UNPAID"}]`,
                }))}
              />
            )}
          </div>

          {/* Charges Breakdown Preview */}
          {loadingCheckoutPreview ? (
            <div className="flex items-center justify-center p-8 rounded-2xl bg-surface-alt border border-border text-xs text-text-muted gap-2">
              <Spinner size="md" />
              <span>Compiling itemized charges from OPD Encounter, Lab Orders & Prescriptions...</span>
            </div>
          ) : checkoutPreview ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-surface-alt p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Itemized Services & Prescriptions</span>
                  <Badge variant={checkoutPreview.isAlreadyPaid ? "success" : "warning"} size="sm" className="text-[10px] font-bold">
                    {checkoutPreview.isAlreadyPaid ? "Already Settled" : "Pending Settlement"}
                  </Badge>
                </div>

                <div className="divide-y divide-border/60 max-h-48 overflow-y-auto">
                  {checkoutPreview.items.map((item, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">
                          {item.category === "consultation" ? "🩺" : item.category === "lab_test" ? "🧪" : "💊"}
                        </span>
                        <span className="font-medium text-text truncate">{item.description}</span>
                        {item.gstRate > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border text-text-muted shrink-0">
                            {item.gstRate}% GST
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-text shrink-0">
                        ₹{(item.amount * (item.quantity || 1)).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtotals and Taxes */}
                <div className="pt-2 border-t border-border/80 space-y-1 text-xs">
                  <div className="flex justify-between text-text-muted">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">₹{checkoutPreview.subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  {((checkoutPreview.cgstTotal || 0) + (checkoutPreview.sgstTotal || 0)) > 0 && (
                    <div className="flex justify-between text-text-muted">
                      <span>GST (CGST + SGST):</span>
                      <span className="font-mono font-semibold">
                        ₹{((checkoutPreview.cgstTotal || 0) + (checkoutPreview.sgstTotal || 0)).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-text pt-1 border-t border-border/40">
                    <span>Gross Total:</span>
                    <span className="font-mono text-primary-600 dark:text-primary-400">
                      ₹{checkoutPreview.totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text mb-1 block">Payment Method *</label>
                  <Select
                    value={checkoutPaymentMethod}
                    onChange={(e) => setCheckoutPaymentMethod(e.target.value as any)}
                    options={[
                      { value: "cash", label: "💵 Cash (Counter Drawer)" },
                      { value: "upi", label: "📱 UPI (Counter QR / Soundbox)" },
                      { value: "card", label: "💳 Card (POS Terminal)" },
                    ]}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text mb-1 block">Discount / Waiver (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    max={checkoutPreview.totalAmount}
                    value={checkoutDiscount || ""}
                    onChange={(e) => setCheckoutDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text mb-1 block">Transaction / UTR Reference (Optional)</label>
                  <Input
                    value={checkoutRefNumber}
                    onChange={(e) => setCheckoutRefNumber(e.target.value)}
                    placeholder="UPI Ref / Card Auth Code"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text mb-1 block">Cashier Settlement Notes</label>
                  <Input
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    placeholder="e.g. Cleared at Reception Counter"
                  />
                </div>
              </div>

              {/* Net Payable Banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Net Payable Amount:</span>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    Official tax invoice will be generated upon settlement
                  </p>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{Math.max(0, checkoutPreview.totalAmount - (Number(checkoutDiscount) || 0)).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCheckoutModalOpen(false)}
              disabled={submittingCheckout}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={submittingCheckout}
              disabled={!checkoutPreview || loadingCheckoutPreview}
              className="font-bold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-xs"
            >
              <span>⚡</span> Settle & Issue Invoice
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
