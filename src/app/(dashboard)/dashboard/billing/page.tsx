"use client";

import { PharmacyTill } from "@/components/pharmacy/PharmacyTill";
import PrintDialogActions from "@/components/ui/PrintDialogActions";
import { RefundReconciliationAction } from "@/components/billing/RefundReconciliationAction";

import Modal from "@/components/queue/QueueDialog";
import { useLatestRead } from "@/hooks/useLatestRead";
import { authScopeKey } from "@/lib/authScope";
import styles from "./Billing.module.css";

import { getPrintBrandStyles, printElement, printHtml } from "@/lib/printBrand";
import { canPrintPharmacyInvoice, pharmacyDocumentTitle, type IssuedPharmacyInvoice, type PharmacyTaxDocument } from "@/lib/pharmacyInvoice";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { hasAnyPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { formatCurrency } from "@/lib/currency";
import { Table, Button, Input, Select, Textarea, useToast, Spinner, Badge, Dropdown, Tabs, cn } from "@/components/ui";
import { UnifiedDocumentModal, UnifiedDocumentData } from "@/components/clinical/UnifiedDocumentModal";
import { RotateCw, Plus, FileText, IndianRupee, Receipt, CheckCircle2, Printer, Search, MoreHorizontal, Banknote, AlertTriangle, Trash2 } from "lucide-react";

const tillEvidenceLabels: Record<string, string> = {
  missing_invoice_organization: "Historical payment ownership requires reconciliation",
  different_currency: "Payment currency differs from this location",
  unknown_payment_method: "Payment method needs review",
  reversal_or_deleted_invoice: "Refund, cancellation or deletion needs reconciliation",
  invalid_receipt_ledger: "Receipt history needs review",
  missing_receipt_date: "Collection date is missing",
  invalid_receipt_amount: "Collected amount needs review",
  duplicate_receipt_identity: "Repeated receipt reference needs review",
  future_receipt_date: "Collection date is in the future",
  receipt_balance_mismatch: "Invoice paid balance does not match its receipts",
  incomplete_legacy_payment_evidence: "Historical payment details are incomplete",
};

interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
}

interface Invoice {
  documentVersion?: number;
  issuedAt?: string;
  financialYear?: string;
  taxDocument?: PharmacyTaxDocument;
  cgstTotal?: number;
  sgstTotal?: number;
  id: string;
  invoiceNumber: string;
  currency?: string;
  appointmentId?: string;
  refundPending?: boolean;
  patientId: { id: string; name?: string; phone?: string; userId?: { name?: string; email?: string; phone?: string } };
  locationId: { id: string; name: string; city: string; address: string };
  doctorId: { id: string; name: string; specialization: string };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  amountPaid?: number;
  balanceDue?: number;
  status: "unpaid" | "partially_paid" | "paid" | "refunded" | "cancelled";
  paymentMethod?: string;
  paymentDate?: string;
  createdAt: string;
}

export const roundCurrency = (val: number): number => {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
};

export default function BillingPage() {
  const user = useAuthStore((state) => state.user);
  return <BillingWorkspace key={authScopeKey(user)} />;
}

const patientName = (invoice: Invoice) => invoice.patientId?.userId?.name || invoice.patientId?.name || "Patient";
const patientPhone = (invoice: Invoice) => invoice.patientId?.userId?.phone || invoice.patientId?.phone || "";
const balanceDue = (invoice: Invoice) => Math.max(0, invoice.balanceDue ?? invoice.totalAmount - (invoice.amountPaid ?? 0));
const paidAmount = (invoice: Invoice) => invoice.amountPaid ?? (invoice.status === "paid" ? invoice.totalAmount : 0);
const isPayable = (invoice: Invoice) => !invoice.refundPending && ["unpaid", "partially_paid"].includes(invoice.status) && balanceDue(invoice) > 0;
const statusLabel = (status: Invoice["status"]) => status === "partially_paid" ? "Part paid" : status.charAt(0).toUpperCase() + status.slice(1);

function BillingWorkspace() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { locations, activeLocationId, fetchLocations } = useLocationStore();
  const { toast } = useToast();
  const authenticated = Boolean(user);
  const canManageBilling = hasAnyPermission(user, "MANAGE_BILLING");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters State
  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadedScope, setLoadedScope] = useState("");
  const invoiceScope = JSON.stringify([filterLocation, filterStatus, page]);
  const startInvoiceRead = useLatestRead();
  const startCheckoutRead = useLatestRead();
  const startAppointmentRead = useLatestRead();
  const startTillRead = useLatestRead();
  const startPatientRead = useLatestRead();
  const startAssignmentRead = useLatestRead();
  const [patientError, setPatientError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentReadVersion, setAssignmentReadVersion] = useState(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [tillError, setTillError] = useState<string | null>(null);

  // Create Invoice Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
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
  const [isDrawerModalOpen, setIsDrawerModalOpen] = useState(false);
  const reportCommand = useRef<{ key: string; body: object } | null>(null);
  const [isTillModalOpen, setIsTillModalOpen] = useState(false);
  const [tillLocationId, setTillLocationId] = useState("");
  const [tillSummary, setTillSummary] = useState<{
    date: string;
    locationId: string;
    collectionBasis?: string;
    timezone?: string;
    currency?: string;
    reconciliation?: { requiresReview: boolean; issueCount: number; issues: Array<{ invoiceId: string; invoiceNumber: string; reason: string }> };
    systemTotals: {
      cash: number;
      upi: number;
      card: number;
      other: number;
      total: number;
      invoiceCount: number;
      receiptCount?: number;
      legacyReceiptCount?: number;
    };
    latestShift?: any;
  } | null>(null);
  const [loadingTillSummary, setLoadingTillSummary] = useState(false);
  const [actualCashCounted, setActualCashCounted] = useState<string>("");
  const [varianceReason, setVarianceReason] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [submittingTillClose, setSubmittingTillClose] = useState(false);
  const [zReportSlip, setZReportSlip] = useState<any | null>(null);
  const tillCurrency = tillSummary?.currency || "INR";
  const reportCurrency = zReportSlip?.currency || "INR";

  // 1-Click Consolidated OPD Checkout State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutLocationId, setCheckoutLocationId] = useState("");
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
    unfilledPrescriptions?: Array<{ prescriptionId: string; medicineName: string }>;
    isAlreadyPaid: boolean;
    feeType?: string;
    consultationFee?: number;
    isFeeEditable?: boolean;
  } | null>(null);
  const [loadingCheckoutPreview, setLoadingCheckoutPreview] = useState(false);
  const [previewAppointmentId, setPreviewAppointmentId] = useState("");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"cash" | "upi" | "card">("cash");
  const [checkoutDiscount, setCheckoutDiscount] = useState<number>(0);
  const [checkoutNotes, setCheckoutNotes] = useState<string>("");
  const [checkoutRefNumber, setCheckoutRefNumber] = useState<string>("");
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [checkoutCustomConsultFee, setCheckoutCustomConsultFee] = useState<number | string>("");

  const fetchCheckoutPreview = async (apptId: string, customFee?: number) => {
    const request = startCheckoutRead();
    if (customFee === undefined) setCheckoutPreview(null);
    setPreviewAppointmentId("");
    setCheckoutError(null);
    if (customFee === undefined) setCheckoutCustomConsultFee("");
    if (!apptId) return;
    setLoadingCheckoutPreview(true);
    try {
      const url = customFee !== undefined
        ? `/billing/checkout/preview/${apptId}?customConsultFee=${customFee}`
        : `/billing/checkout/preview/${apptId}`;
      const res = await api.get(url, { signal: request.signal });
      if (!request.isCurrent()) return;
      setCheckoutPreview(res.data?.data);
      setPreviewAppointmentId(apptId);
      if (customFee === undefined && res.data?.data?.consultationFee !== undefined) {
        setCheckoutCustomConsultFee(res.data.data.consultationFee);
      }
    } catch (err: any) {
      if (request.isCurrent()) setCheckoutError(err.response?.data?.message || "Charges could not be loaded. Try again.");
    } finally {
      if (request.isCurrent()) setLoadingCheckoutPreview(false);
    }
  };

  const fetchOpdAppointments = async (locationId = checkoutLocationId) => {
    const request = startAppointmentRead();
    startCheckoutRead();
    setCheckoutPreview(null);
    setPreviewAppointmentId("");
    setSelectedCheckoutApptId("");
    setOpdAppointments([]);
    setCheckoutError(null);
    setLoadingOpdAppointments(true);
    try {
      if (!locationId) throw new Error("Location required");
      const today = new Date().toISOString().slice(0, 10);
      const list: any[] = [];
      let pages = 1;
      for (let current = 1; current <= pages; current++) {
        const res = await api.get(`/appointments?locationId=${locationId}&startDate=${today}&endDate=${today}&page=${current}&limit=100`, { signal: request.signal });
        if (!request.isCurrent()) return;
        list.push(...(res.data?.data || []));
        pages = Math.max(1, Number(res.headers?.["x-total-pages"]) || 1);
      }
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
    } catch {
      if (request.isCurrent()) setCheckoutError("Appointments could not be loaded. Try again.");
    } finally {
      if (request.isCurrent()) setLoadingOpdAppointments(false);
    }
  };

  const handleOpenCheckoutModal = () => {
    setIsCheckoutModalOpen(true);
    setCheckoutPaymentMethod("cash");
    setCheckoutDiscount(0);
    setCheckoutNotes("");
    setCheckoutRefNumber("");
    const locationId = filterLocation || locations.find((location) => location.id === activeLocationId)?.id || locations[0]?.id || "";
    setCheckoutLocationId(locationId);
    void fetchOpdAppointments(locationId);
  };

  const handleExecuteConsolidatedCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingCheckout || !canManageBilling || !selectedCheckoutApptId || !checkoutPreview || loadingCheckoutPreview || loadingOpdAppointments || previewAppointmentId !== selectedCheckoutApptId || checkoutPreview.isAlreadyPaid || (checkoutPreview.isFeeEditable && Number(checkoutCustomConsultFee) !== checkoutPreview.consultationFee)) return;

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
        customConsultationFee: checkoutCustomConsultFee !== "" ? Number(checkoutCustomConsultFee) : undefined,
      });

      const invoiceData = res.data?.data;
      toast({
        title: "OPD Checkout Completed!",
        description: `Consolidated invoice #${invoiceData?.invoiceNumber} generated & settled via ${checkoutPaymentMethod.toUpperCase()}.`,
        variant: "success",
      });

      // Clinical checkout remains an invoice/receipt; pharmacy tax documents use their issued snapshot.
      const appt = checkoutPreview.appointment;
      const patientName = appt?.patientId?.userId?.name || appt?.patientId?.name || "Patient";
      const invoiceDoc: UnifiedDocumentData = {
        documentType: "invoice",
        currency: invoiceData?.currency || "INR",
        title: "OPD Invoice & Settlement Receipt",
        locationName: appt?.locationId?.name || "Healthcare facility",
        locationAddress: appt?.locationId?.address || "",
        doctorName: (appt?.doctorId as any)?.name || "Attending Physician",
        doctorSpecialization: (appt?.doctorId as any)?.specialization || "General Medicine",
        patientName,
        patientId: appt?.patientId?.id || appt?.patientId?._id,
        date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        referenceNumber: invoiceData?.invoiceNumber || "Not provided",
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

  const fetchTillSummary = async (locationIdToFetch: string) => {
    const request = startTillRead();
    setTillSummary(null);
    setTillError(null);
    if (!locationIdToFetch) return;
    setLoadingTillSummary(true);
    try {
      const res = await api.get(`/billing/till/summary?locationId=${locationIdToFetch}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      const data = res.data?.data || res.data;
      setTillSummary(data);
    } catch (err: any) {
      if (request.isCurrent()) setTillError(err.response?.data?.message || "Till totals could not be loaded. Try again.");
    } finally {
      if (request.isCurrent()) setLoadingTillSummary(false);
    }
  };

  const handleOpenTillModal = () => {
    const activeCId = String(filterLocation || locations[0]?.id || "");
    setTillLocationId(activeCId);
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
    if (submittingTillClose || !canManageBilling || loadingTillSummary || !tillSummary || tillSummary.locationId !== tillLocationId || tillSummary.reconciliation?.requiresReview) return;
    if (!tillLocationId) {
      toast({ title: "Validation Error", description: "Please select a location for till closeout.", variant: "error" });
      return;
    }
    const counted = Number(actualCashCounted);
    if (actualCashCounted.trim() === "" || !Number.isFinite(counted) || counted < 0) {
      toast({ title: "Validation Error", description: "Please enter a valid non-negative counted cash amount.", variant: "error" });
      return;
    }

    const systemCash = tillSummary?.systemTotals?.cash || 0;
    const variance = Math.round((counted - systemCash) * 100) / 100;

    if (variance !== 0 && !varianceReason.trim()) {
      toast({
        title: "Variance Reason Required",
        description: `Please enter an explanation for the ${formatCurrency(Math.abs(variance), tillCurrency)} cash ${variance < 0 ? "shortage" : "surplus"}.`,
        variant: "error",
      });
      return;
    }

    setSubmittingTillClose(true);
    try {
      const body = {
        locationId: tillLocationId,
        actualCashCounted: counted,
        varianceReason: varianceReason.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
      };
      if (reportCommand.current && JSON.stringify(reportCommand.current.body) !== JSON.stringify(body)) throw new Error("Check or retry the original report before changing its details");
      reportCommand.current ||= { key: crypto.randomUUID(), body };
      const res = await api.post("/billing/till/close", reportCommand.current.body, { headers: { "Idempotency-Key": reportCommand.current.key } });
      reportCommand.current = null;

      const shiftData = res.data?.data || res.data;
      setZReportSlip(shiftData);
      toast({
        title: "Collection report saved",
        description: res.data?.message || "Daily collection report saved. Physical drawers close separately.",
        variant: "success",
      });
      fetchInvoices();
    } catch (err: any) {
      if ([400, 409, 428].includes(err.response?.status)) reportCommand.current = null;
      toast({
        title: "Collection report needs attention",
        description: err.response?.data?.message || err.message || "Could not confirm the collection report",
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
    if (submittingPartial || !canManageBilling) return;
    if (!partialTargetInvoice || !isPayable(partialTargetInvoice) || !Number.isFinite(partialAmount) || roundCurrency(partialAmount) <= 0) {
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
        description: `Payment amount cannot exceed remaining balance of ${formatCurrency(currentBalance, partialTargetInvoice.currency)}`,
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
    if (inv.documentVersion === 1 && !canPrintPharmacyInvoice(inv)) {
      toast({ title: "Invoice unavailable", description: "Reload the issued document before printing.", variant: "error" });
      return;
    }
    setUnifiedDoc({
      documentType: "invoice",
      title: `${inv.taxDocument ? pharmacyDocumentTitle(inv.taxDocument.kind) : "INVOICE"} #${inv.invoiceNumber}`,
      pharmacyInvoice: inv.documentVersion === 1 ? inv as unknown as IssuedPharmacyInvoice : undefined,
      locationName: inv.taxDocument?.issuer.legalName || inv.locationId?.name || "Healthcare Center",
      locationAddress: inv.taxDocument?.issuer.address || inv.locationId?.address || inv.locationId?.city,
      doctorName: inv.doctorId?.name,
      doctorSpecialization: inv.doctorId?.specialization,
      patientName: inv.taxDocument?.recipient.name || patientName(inv),
      patientId: inv.patientId?.id,
      date: new Date(inv.issuedAt || inv.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      referenceNumber: inv.invoiceNumber,
      invoiceItems: inv.items || [],
      currency: inv.currency || "INR",
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
    if (field === "locationId" && !value) {
      error = "Location is required";
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
    if (!selectedLocationId) newErrors.locationId = "Location is required";
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
    if (user && user.role !== "patient") fetchLocations();
  }, [user, fetchLocations]);

  const fetchInvoices = useCallback(async () => {
    const request = startInvoiceRead();
    setLoadError(null);
    setIsRefreshing(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterLocation) query.set("locationId", filterLocation);
      if (filterStatus) query.set("status", filterStatus);
      const res = await api.get(`/invoices?${query}`, { signal: request.signal });
      if (!request.isCurrent()) return;
      const rows = res.data.data || [];
      if (!Array.isArray(rows)) throw new Error("Invalid invoice response");
      setInvoices(rows);
      setLoadedScope(invoiceScope);
      setTotalCount(Number(res.headers?.["x-total-count"]) || rows.length);
      setTotalPages(Math.max(1, Number(res.headers?.["x-total-pages"]) || 1));
    } catch {
      if (request.isCurrent()) setLoadError("Invoices could not be loaded. Try again.");
    } finally {
      if (request.isCurrent()) { setLoading(false); setIsRefreshing(false); }
    }
  }, [page, filterLocation, filterStatus, invoiceScope, startInvoiceRead]);

  useEffect(() => {
    if (authenticated) void fetchInvoices();
  }, [authenticated, fetchInvoices]);

  useEffect(() => {
    if (!selectedLocationId) {
      setDoctorAssignments([]);
      return;
    }
    const request = startAssignmentRead();
    setDoctorAssignments([]);
    setAssignmentError(null);
    const fetchAssignments = async () => {
      try {
        const res = await api.get(`/onboarding/doctors/assignments?locationId=${selectedLocationId}`, { signal: request.signal });
        if (request.isCurrent()) setDoctorAssignments(res.data.data || []);
      } catch {
        if (request.isCurrent()) setAssignmentError("Doctors could not be loaded. Try again.");
      }
    };
    void fetchAssignments();
    return () => { startAssignmentRead(); };
  }, [selectedLocationId, startAssignmentRead, assignmentReadVersion]);

  useEffect(() => {
    if (!selectedDoctorId || !selectedLocationId) return;
    const activeAssign = doctorAssignments.find((a) => (a.doctorId?.id || a.doctorId) === selectedDoctorId);
    if (activeAssign) {
      const fee = Number(activeAssign.consultationFee ?? activeAssign.fees ?? 0);
      setInvoiceItems((prev) => {
        const updated = [...prev];
        updated[0] = { ...updated[0], amount: fee };
        return updated;
      });
    }
  }, [selectedDoctorId, selectedLocationId, doctorAssignments]);

  const handlePatientSearch = useCallback(async () => {
    const request = startPatientRead();
    const query = patientSearch.trim();
    if (query.length < 2) return;
    setSearchLoading(true);
    setPatientError(null);
    try {
      const res = await api.get("/patients?search=" + encodeURIComponent(query), { signal: request.signal });
      if (request.isCurrent()) {
        const rows = res.data.data || [];
        setPatientResults(rows);
        if (!rows.length) setPatientError("No patients found. Try another name or phone number.");
      }
    } catch {
      if (request.isCurrent()) setPatientError("Patient search failed. Try again.");
    } finally {
      if (request.isCurrent()) setSearchLoading(false);
    }
  }, [patientSearch, startPatientRead]);

  useEffect(() => {
    const timer = setTimeout(() => { void handlePatientSearch(); }, 300);
    return () => { clearTimeout(timer); startPatientRead(); };
  }, [handlePatientSearch, startPatientRead]);

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
    if (submittingInvoice || !canManageBilling) return;
    if (!validateInvoiceForm()) {
      toast({ title: "Validation Error", description: "Please resolve the form validation errors.", variant: "warning" });
      return;
    }

    try {
      setSubmittingInvoice(true);
      await api.post("/invoices", {
        patientId: selectedPatient.id,
        locationId: selectedLocationId,
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
    startPatientRead();
    setPatientError(null);
    setSearchLoading(false);
    setSelectedLocationId("");
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
    if (submittingPayment || !canManageBilling || !activeInvoice || !isPayable(activeInvoice)) return;
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

  const triggerBrowserPrint = async (ticketData: Invoice) => {
    await printHtml(`
      <html>
        <head>
          <title>Cash Receipt - ${ticketData.invoiceNumber}</title>
          <style>${getPrintBrandStyles()}
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; padding: 20px; }
            .receipt { width: 380px; padding: 20px; border: 1px solid var(--print-border); border-radius: 8px; }
            .center { text-align: center; }
            .border-dashed { border-bottom: 1px dashed var(--print-border); margin: 15px 0; }
            .flex-between { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
            .bold { font-weight: bold; }
            .title { font-size: 16px; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
            th { border-bottom: 1px solid var(--print-border); text-align: left; padding-bottom: 5px; }
            td { padding: 4px 0; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <h3 class="title">Ekavyu HEALTHCARE SYSTEM</h3>
              <p style="margin:2px 0; font-size:11px;">${ticketData.locationId?.name}</p>
              <p style="margin:2px 0; font-size:10px;">${ticketData.locationId?.address}, ${ticketData.locationId?.city}</p>
            </div>
            <div class="border-dashed"></div>
            <div class="flex-between"><span class="bold">Receipt No:</span><span>${ticketData.invoiceNumber}</span></div>
            <div class="flex-between"><span class="bold">Date:</span><span>${new Date(ticketData.createdAt).toLocaleDateString()}</span></div>
            <div class="flex-between"><span class="bold">Patient:</span><span>${patientName(ticketData)}</span></div>
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
                    <td style="text-align:right;">${formatCurrency(item.amount * item.quantity, ticketData.currency)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="border-dashed"></div>
            <div class="flex-between"><span>Subtotal:</span><span>${formatCurrency(ticketData.subtotal, ticketData.currency)}</span></div>
            <div class="flex-between"><span>Tax:</span><span>${formatCurrency(ticketData.tax, ticketData.currency)}</span></div>
            <div class="flex-between"><span>Discount:</span><span>-${formatCurrency(ticketData.discount, ticketData.currency)}</span></div>
            <div class="flex-between bold" style="font-size:14px; margin-top:8px;">
              <span>Total Amount:</span><span>${formatCurrency(ticketData.totalAmount, ticketData.currency)}</span>
            </div>
            <div class="border-dashed"></div>
            <div class="center">
              <span style="font-size: 13px; font-weight: bold; background: var(--print-success-subtle); color: var(--print-success); padding: 4px 12px; border-radius: 99px; text-transform: uppercase;">
                ${ticketData.status}
              </span>
              ${
                ticketData.paymentMethod
                  ? `<p style="font-size:11px; margin-top:10px;">Method: ${ticketData.paymentMethod.toUpperCase()}</p>`
                  : ""
              }
            </div>
          </div>
        </body>
      </html>
    `);
  };

  const checkoutFeeDirty = Boolean(checkoutPreview?.isFeeEditable && Number(checkoutCustomConsultFee) !== checkoutPreview.consultationFee);
  const currentInvoices = loadedScope === invoiceScope ? invoices : [];
  const query = searchQuery.trim().toLowerCase();
  const filteredInvoices = currentInvoices.filter((invoice) =>
    [patientName(invoice), patientPhone(invoice), invoice.invoiceNumber].some((value) => value.toLowerCase().includes(query))
  );
  const summaries = Object.entries(currentInvoices.reduce<Record<string, { total: number; paid: number; due: number }>>((groups, invoice) => {
    const currency = invoice.currency || "INR";
    const group = groups[currency] ||= { total: 0, paid: 0, due: 0 };
    group.total += invoice.totalAmount;
    group.paid += paidAmount(invoice);
    if (["unpaid", "partially_paid"].includes(invoice.status)) group.due += balanceDue(invoice);
    return groups;
  }, {}));
  const showLoading = loading || (loadedScope !== invoiceScope && !loadError);
  const invoiceStatus = (invoice: Invoice) => <Badge size="sm" dot variant={invoice.status === "paid" ? "success" : ["unpaid", "partially_paid"].includes(invoice.status) ? "warning" : "default"}>{statusLabel(invoice.status)}</Badge>;
  const invoiceActions = (invoice: Invoice) => <div className={styles.rowActions}>
    {invoice.refundPending && invoice.appointmentId && canManageBilling ? <RefundReconciliationAction appointmentId={invoice.appointmentId} onReconciled={fetchInvoices} />
      : canManageBilling && isPayable(invoice) ? <Button size="sm" onClick={() => openPartialPaymentModal(invoice)}>Record payment</Button>
      : <Button size="sm" variant="outline" onClick={() => handleOpenPrintInvoice(invoice)}><FileText size={14} /> Invoice</Button>}
    <Dropdown align="right" width="w-56" trigger={<Button size="sm" variant="ghost" className={styles.iconButton} aria-label={`Actions for invoice ${invoice.invoiceNumber}`}><MoreHorizontal size={18} /></Button>} items={[
      ...(canManageBilling && isPayable(invoice) && invoice.status === "unpaid" ? [{ label: "Collect full payment", icon: <CheckCircle2 size={16} />, onClick: () => { setActiveInvoice(invoice); setIsCollectOpen(true); } }] : []),
      { label: "Preview invoice", icon: <FileText size={16} />, onClick: () => handleOpenPrintInvoice(invoice) },
      ...(paidAmount(invoice) > 0 ? [{ label: "Preview receipt", icon: <Printer size={16} />, onClick: () => handlePrintReceipt(invoice) }] : []),
    ]} />
  </div>;

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div><h1>Billing</h1><p>Invoices and patient payments</p></div>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" className={styles.iconButton} aria-label="Refresh invoices" disabled={isRefreshing} onClick={fetchInvoices}><RotateCw size={17} className={isRefreshing ? "animate-spin" : ""} /></Button>
          {canManageBilling && <Button size="sm" onClick={() => setIsCreateOpen(true)}><Plus size={16} /> New invoice</Button>}
          <Dropdown align="right" width="w-56" trigger={<Button variant="ghost" size="sm" className={styles.iconButton} aria-label="Billing tools"><MoreHorizontal size={19} /></Button>} items={[
            ...(canManageBilling ? [
              { label: "OPD checkout", icon: <Receipt size={16} />, onClick: handleOpenCheckoutModal },
              { label: "Physical cash drawer", icon: <Banknote size={16} />, onClick: () => { setTillLocationId(activeLocationId === "all" ? locations[0]?.id || "" : activeLocationId || locations[0]?.id || ""); setIsDrawerModalOpen(true); } },
              { label: "Daily collection report", icon: <Banknote size={16} />, onClick: handleOpenTillModal },
            ] : []),
            { label: "Service rates", icon: <FileText size={16} />, onClick: () => router.push("/dashboard/billing/services") },
          ]} />
        </div>
      </header>

      <section className={styles.directory} aria-label="Invoices">
        <div className={styles.filters}>
          <Tabs variant="pills" activeTab={filterStatus || "all"} onChange={(value) => { setPage(1); setFilterStatus(value === "all" ? "" : value); }} scrollActiveIntoView={false} tabs={[
            { id: "all", label: "All" }, { id: "unpaid", label: "Unpaid" }, { id: "partially_paid", label: "Part paid" },
            { id: "paid", label: "Paid" }, { id: "refunded", label: "Refunded" }, { id: "cancelled", label: "Cancelled" },
          ]} />
          <div className={styles.searchRow}>
            <Input aria-label="Search invoices on this page" icon={<Search size={16} />} placeholder="Search this page" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            {locations.length > 1 && <Select aria-label="Filter by location" value={filterLocation} onChange={(event) => { setPage(1); setFilterLocation(event.target.value); }} options={[{ value: "", label: "All locations" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]} />}
          </div>
        </div>
        <Table variant="flat" density="compact" fitContent searchable={false} showColumnVisibility={false} pagination={false}
          loading={showLoading} error={loadError} onRetry={fetchInvoices} data={filteredInvoices}
          emptyMessage={query ? "No matches on this page. Try another page or clear your search." : "No invoices for this filter."}
          columns={[
            { key: "patient", header: "Patient / invoice", render: (invoice: Invoice) => <div className={styles.identity}><strong>{patientName(invoice)}</strong><span>{invoice.invoiceNumber}</span>{patientPhone(invoice) && <small>{patientPhone(invoice)}</small>}</div> },
            { key: "location", header: "Visit", render: (invoice: Invoice) => <div className={styles.identity}><span>{invoice.locationId?.name || "Location unavailable"}</span><small>{invoice.doctorId?.name || "Doctor not recorded"}</small><small>{new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</small></div> },
            { key: "totalAmount", header: "Amount", align: "right", render: (invoice: Invoice) => <div className={styles.amount}><strong>{formatCurrency(invoice.totalAmount, invoice.currency)}</strong>{["unpaid", "partially_paid"].includes(invoice.status) && <small>Due {formatCurrency(balanceDue(invoice), invoice.currency)}</small>}</div> },
            { key: "status", header: "Status", render: invoiceStatus },
            { key: "actions", header: "", align: "right", render: invoiceActions },
          ]}
          mobileCardView renderMobileCard={(invoice: Invoice) => <article className={styles.invoiceCard} key={invoice.id}>
            <div className={styles.cardHeading}><div className={styles.identity}><strong>{patientName(invoice)}</strong><span>{invoice.invoiceNumber}</span></div>{invoiceStatus(invoice)}</div>
            <p className={styles.visit}>{invoice.locationId?.name || "Location unavailable"} &middot; {new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
            <div className={styles.cardAmounts}><div><small>Invoice total</small><strong>{formatCurrency(invoice.totalAmount, invoice.currency)}</strong></div><div><small>{["unpaid", "partially_paid"].includes(invoice.status) ? "Balance due" : "Recorded payments"}</small><strong>{formatCurrency(["unpaid", "partially_paid"].includes(invoice.status) ? balanceDue(invoice) : paidAmount(invoice), invoice.currency)}</strong></div></div>
            {invoiceActions(invoice)}
          </article>} />
        <footer className={styles.pagination}>
          <span aria-live="polite">{showLoading ? "Loading invoices..." : loadedScope !== invoiceScope ? "Invoices unavailable" : query ? filteredInvoices.length + " matches on this page" : totalCount + (totalCount === 1 ? " invoice" : " invoices")}</span>
          <div><Button size="sm" variant="ghost" disabled={page <= 1 || isRefreshing} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} / {loadedScope === invoiceScope ? totalPages : "\u2014"}</span><Button size="sm" variant="ghost" disabled={page >= totalPages || isRefreshing} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
        </footer>
      </section>
      {currentInvoices.length > 0 && <details className={styles.summary}><summary>Page summary <span>{currentInvoices.length} invoices</span></summary>
        <p>Totals for invoices on this page, grouped by currency. These are not daily collection totals.</p>
        {summaries.map(([currency, totals]) => <div key={currency} className={styles.summaryAmounts}><div><small>Invoiced &middot; {currency}</small><strong>{formatCurrency(totals.total, currency)}</strong></div><div><small>Recorded payments</small><strong>{formatCurrency(totals.paid, currency)}</strong></div><div><small>Outstanding</small><strong>{formatCurrency(totals.due, currency)}</strong></div></div>)}
      </details>}

      <Modal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          resetCreateForm();
        }}
        title="New invoice"
        description="Choose a patient and add their charges."
        size="xl"
        busy={submittingInvoice}
        bodyClassName={styles.dialogBody}
        footer={<div className={styles.dialogActions}>
            <Button
              disabled={submittingInvoice} variant="outline"
              type="button"
              size="sm"
              onClick={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit" form="create-invoice"
              size="sm"
              variant="primary"
              loading={submittingInvoice}
              disabled={!selectedPatient || !selectedLocationId || !selectedDoctorId}
              className="w-full sm:w-auto font-semibold min-h-[44px]"
            >
              Create invoice
            </Button>
          </div>}
      >
        <form id="create-invoice" onSubmit={handleCreateInvoice} className="space-y-4 pt-1">
          {/* Step 1: Choose Patient */}
          <div className="space-y-2 border-b border-border/60 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text">Patient</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">

                <Input icon={<Search />}
                  placeholder="Search patient name, email, or mobile..."
                  value={patientSearch}
                  onChange={(e) => { startPatientRead(); setPatientResults([]); setPatientError(null); setSearchLoading(false); setPatientSearch(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handlePatientSearch(); } }}
                  aria-label="Find a patient"
                  className="pl-9"
                />
              </div>
              <Button type="button" onClick={handlePatientSearch} loading={searchLoading} className="font-semibold">
                Search
              </Button>
            </div>

            {patientError && <p role="status" className="text-xs text-text-muted">{patientError}</p>}
            {patientResults.length > 0 && (
              <div className="border border-border/80 rounded-2xl max-h-40 overflow-y-auto bg-surface mt-2 divide-y divide-border/60">
                {patientResults.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 flex justify-between items-center hover:bg-surface-hover transition-colors"
                  >
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-text">{p.userId?.name || p.name || "Patient"}</p>
                      <p className="text-xs text-text-muted">
                        {p.userId?.phone || p.phone} &bull; {p.userId?.email}
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
              <div className="p-3 bg-success/10 border border-success/20 rounded-2xl flex items-center justify-between mt-2">
                <div>
                  <p className="text-xs font-bold text-success-text dark:text-success-text">
                    Selected: {selectedPatient.userId?.name || selectedPatient.name || "Patient"}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {selectedPatient.userId?.phone} &bull; {selectedPatient.userId?.email}
                  </p>
                </div>
                <Button type="button" onClick={() => {
                    setSelectedPatient(null);
                    validateInvoiceField("patient", null);
                  }} variant="ghost" size="xs" className="text-danger-text">
                  Change
                </Button>
              </div>
            )}

            {!selectedPatient && errors.patient && (
              <p className="text-xs text-danger-text mt-1">{errors.patient}</p>
            )}
          </div>

          {/* Step 2: Location & Doctor Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-b border-border/60 pb-4">
            <Select
              label="Location *"
              value={selectedLocationId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedLocationId(val);
                setSelectedDoctorId("");
                validateInvoiceField("locationId", val);
              }}
              options={[{ value: "", label: "Select location..." }, ...locations.map((c) => ({ value: c.id, label: c.name }))]}
              error={errors.locationId}
              required
            />
            <Select
              label="Doctor *"
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
              disabled={!selectedLocationId}
              error={errors.doctorId}
              required
            />
          </div>

          {assignmentError && <div role="alert" className={styles.readError}>{assignmentError}<Button type="button" size="sm" variant="outline" onClick={() => setAssignmentReadVersion((value) => value + 1)}>Try again</Button></div>}
          {/* Step 3: Invoice Line Items Table */}
          <div className="space-y-2 border-b border-border/60 pb-4">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text">Charges</h3>
              <Button type="button" size="xs" variant="outline" onClick={addInvoiceItem} className="font-semibold rounded-lg">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add charge
              </Button>
            </div>

            <div className={styles.lineItems}>
              {invoiceItems.map((item, idx) => (
                <div key={idx} className={styles.lineItem}>
                  <div className="flex-1">
                    <Input
                      label="Description"
                      aria-label={`Charge ${idx + 1} description`}
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
                      label="Amount"
                      aria-label={`Charge ${idx + 1} amount`}
                      min="0" step="0.01"
                      value={item.amount}
                      onChange={(e) => updateInvoiceItemField(idx, "amount", e.target.value)}
                      error={errors[`itemAmount_${idx}`]}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      label="Qty"
                      aria-label={`Charge ${idx + 1} quantity`}
                      min="1" step="1"
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
                        className="h-7 w-7 rounded-lg text-danger-text hover:bg-danger/10 flex items-center justify-center transition-colors cursor-pointer"
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
                  Total Due: <span className="text-accent dark:text-accent font-mono">₹{totalAmount.toLocaleString("en-IN")}</span>
                </p>
              </div>
            </div>
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
        title="Collect full payment"
        size="sm"
        busy={submittingPayment}
        bodyClassName={styles.dialogBody}
        footer={<div className={styles.dialogActions}>
            <Button
              disabled={submittingPayment} variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setIsCollectOpen(false);
                setActiveInvoice(null);
              }}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button type="submit" form="collect-payment" size="sm" variant="primary" loading={submittingPayment} className="w-full sm:w-auto font-semibold min-h-[44px]">
              Record payment
            </Button>
          </div>}
      >
        <form id="collect-payment" onSubmit={handleCollectPayment} className="space-y-4 pt-1">
          <div className="p-4 bg-surface-alt border border-border/80 rounded-2xl space-y-1 text-xs">
            <p className="text-text-muted">
              Invoice Reference: <span className="font-mono font-bold text-text">#{activeInvoice?.invoiceNumber}</span>
            </p>
            <p className="text-text-muted">
              Patient: <span className="font-bold text-text">{activeInvoice ? patientName(activeInvoice) : ""}</span>
            </p>
            <p className="text-sm font-bold text-text pt-1">
              Total Amount Due:{" "}
              <span className="text-accent dark:text-accent font-mono">
                {formatCurrency(activeInvoice?.totalAmount, activeInvoice?.currency)}
              </span>
            </p>
          </div>

          <Select
            label="Payment method *"
            value={collectMethod}
            onChange={(e) => setCollectMethod(e.target.value as any)}
            options={[
              { value: "cash", label: "Cash" },
              { value: "card", label: "Card / POS" },
              { value: "upi", label: "UPI" },
              { value: "insurance", label: "Insurance / TPA Settlement" },
            ]}
            required
          />

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
        title="Payment receipt"
        bodyClassName={styles.dialogBody}
        footerClassName={styles.printFooter}
        size="md"
        footer={<PrintDialogActions documentName="receipt" onPrint={() => triggerBrowserPrint(receiptInvoice!)} onClose={() => {
          setReceiptOpen(false);
          setReceiptInvoice(null);
        }} disabled={!receiptInvoice} />}
      >
        {receiptInvoice && <div className={styles.receipt}>
          <header><h3>Payment receipt</h3><p>{receiptInvoice.locationId?.name}</p><p>{[receiptInvoice.locationId?.address, receiptInvoice.locationId?.city].filter(Boolean).join(", ")}</p></header>
          <dl>
            <div><dt>Invoice</dt><dd>{receiptInvoice.invoiceNumber}</dd></div>
            <div><dt>Date</dt><dd>{new Date(receiptInvoice.createdAt).toLocaleDateString("en-IN")}</dd></div>
            <div><dt>Patient</dt><dd>{patientName(receiptInvoice)}</dd></div>
            <div><dt>Doctor</dt><dd>{receiptInvoice.doctorId?.name || "Not recorded"}</dd></div>
          </dl>
          <div className={styles.receiptItems}>
            <div><span>Charge</span><span>Qty</span><span>Amount</span></div>
            {receiptInvoice.items.map((item, index) => <div key={index}><span>{item.description}</span><span>{item.quantity}</span><span>{formatCurrency(item.amount * item.quantity, receiptInvoice.currency)}</span></div>)}
          </div>
          <dl>
            <div><dt>Subtotal</dt><dd>{formatCurrency(receiptInvoice.subtotal, receiptInvoice.currency)}</dd></div>
            <div><dt>Tax</dt><dd>{formatCurrency(receiptInvoice.tax, receiptInvoice.currency)}</dd></div>
            <div><dt>Discount</dt><dd>-{formatCurrency(receiptInvoice.discount, receiptInvoice.currency)}</dd></div>
            <div><dt>Invoice total</dt><dd>{formatCurrency(receiptInvoice.totalAmount, receiptInvoice.currency)}</dd></div>
            <div><dt>Recorded payments</dt><dd><strong>{formatCurrency(paidAmount(receiptInvoice), receiptInvoice.currency)}</strong></dd></div>
            {["unpaid", "partially_paid"].includes(receiptInvoice.status) && <div><dt>Balance due</dt><dd>{formatCurrency(balanceDue(receiptInvoice), receiptInvoice.currency)}</dd></div>}
          </dl>
          <div className={styles.receiptStatus}>{invoiceStatus(receiptInvoice)}{receiptInvoice.paymentMethod && <p>Method: {receiptInvoice.paymentMethod.toUpperCase()}</p>}</div>
        </div>}
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
        title="Record payment"
        description={partialTargetInvoice?.invoiceNumber}
        size="md"
        busy={submittingPartial}
        bodyClassName={styles.dialogBody}
        footer={<div className={styles.dialogActions}>
            <Button disabled={submittingPartial} variant="outline" size="sm" type="button" onClick={() => setIsPartialModalOpen(false)} className="w-full sm:w-auto min-h-[44px]">
              Cancel
            </Button>
            <Button type="submit" form="record-payment" size="sm" variant="primary" loading={submittingPartial} className="w-full sm:w-auto font-semibold min-h-[44px]">
              Record payment
            </Button>
          </div>}
      >
        <form id="record-payment" onSubmit={handleRecordPartialPayment} className="space-y-4 pt-1">
          <div className="p-3.5 bg-surface-alt rounded-2xl border border-border/80 text-xs space-y-1">
            <p className="font-bold text-text">Patient: {partialTargetInvoice ? patientName(partialTargetInvoice) : ""}</p>
            <p className="text-text-muted">
              Invoice total: {formatCurrency(partialTargetInvoice?.totalAmount, partialTargetInvoice?.currency)}
            </p>
            <p className="text-text-muted">
              Already paid: {formatCurrency(partialTargetInvoice?.amountPaid, partialTargetInvoice?.currency)}
            </p>
            <p className="font-bold text-danger-text pt-1">
              Balance due: {formatCurrency((partialTargetInvoice?.balanceDue !== undefined
                ? partialTargetInvoice.balanceDue
                : (partialTargetInvoice?.totalAmount || 0) - (partialTargetInvoice?.amountPaid || 0)
              ), partialTargetInvoice?.currency)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label={`Amount (${partialTargetInvoice?.currency || "INR"}) *`}
              type="number"
              min="0.01"
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
            label="Reference (optional)"
            placeholder="e.g. UPI/123456789 or CHQ-998822"
            value={partialRef}
            onChange={(e) => setPartialRef(e.target.value)}
          />

          <Input
            label="Notes (optional)"
            placeholder="Installment 1 of 3, Deposit balance, etc."
            value={partialNotes}
            onChange={(e) => setPartialNotes(e.target.value)}
          />

          </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. CASHIER TILL RECONCILIATION & SHIFT CLOSE (Z-REPORT) MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal open={isDrawerModalOpen} onClose={() => setIsDrawerModalOpen(false)} title="Physical cash drawer" size="lg"><Select label="Drawer location" value={tillLocationId} onChange={event => setTillLocationId(event.target.value)} options={locations.map(location => ({ value: location.id, label: location.name }))} />{tillLocationId && <PharmacyTill key={tillLocationId} locationId={tillLocationId} channel="billing" canOpen={canManageBilling} canClose={canManageBilling} canMove={canManageBilling} />}</Modal>
      <Modal
        open={isTillModalOpen}
        onClose={() => {
          setIsTillModalOpen(false);
          setZReportSlip(null);
        }}
        title="Daily collection report"
        footerClassName={zReportSlip ? styles.printFooter : undefined}
        description="Save a comparison against gross cash receipts. Open and close physical drawers separately."
        size="md"
        busy={submittingTillClose}
        bodyClassName={styles.dialogBody}
        footer={zReportSlip ? <PrintDialogActions documentName="daily report" disabled={!zReportSlip} onPrint={async () => { const element = document.getElementById("z-report-print"); await printElement(element); }} onClose={() => {
          setIsTillModalOpen(false);
          setZReportSlip(null);
        }} /> : (<div className={styles.dialogActions}>
                  <Button
                    type="button"
                    disabled={submittingTillClose} variant="outline"
                    size="sm"
                    onClick={() => setIsTillModalOpen(false)}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit" form="close-till"
                    size="sm"
                    variant="primary"
                    loading={submittingTillClose}
                    disabled={loadingTillSummary || !tillSummary || Boolean(tillError) || tillSummary.locationId !== tillLocationId || Boolean(tillSummary.reconciliation?.requiresReview)}
                    className="w-full sm:w-auto min-h-[44px] font-bold bg-warning hover:bg-warning text-background"
                  >
                    <Banknote className="w-3.5 h-3.5 mr-1.5" />
                    Save daily collection report
                  </Button>
                </div>)}
      >
        {zReportSlip ? (
          <div className="space-y-4 pt-1">
            <div id="z-report-print" className="p-4 rounded-2xl bg-surface border border-border/80 space-y-3 font-mono text-xs">
              <div className="text-center border-b border-dashed border-border/80 pb-3">
                <h3 className="font-bold text-sm tracking-wide uppercase text-text">
                  {locations.find((c) => c.id === tillLocationId)?.name || "Ekavyu Healthcare"}
                </h3>
                <p className="text-[11px] text-text-muted">{zReportSlip.collectionBasis === "receipt_v1" ? "DAILY COLLECTION SNAPSHOT" : "LEGACY DAILY REPORT"}</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Report Date: {zReportSlip.shiftDate} • Saved: {zReportSlip.endedAt ? new Date(zReportSlip.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: zReportSlip.timezone }) : "Not recorded"} {zReportSlip.timezone || ""}
                </p>
                <p className="text-[10px] text-text-muted">
                  Cashier: <strong>{zReportSlip.cashierName || user?.name}</strong>
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-text-muted">
                  <span>{zReportSlip.collectionBasis === "receipt_v1" ? "Invoices with collections:" : "Settled Invoices:"}</span>
                  <span className="font-bold text-text">
                    {zReportSlip.systemTotals?.invoiceCount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>System Cash Total:</span>
                  <span className="font-bold text-text">
                    {formatCurrency(zReportSlip.systemTotals?.cash, reportCurrency, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {zReportSlip.collectionBasis === "receipt_v1" && <p className="text-text-muted">{zReportSlip.systemTotals?.receiptCount || 0} receipts · {zReportSlip.systemTotals?.legacyReceiptCount || 0} recorded legacy payments</p>}
                <div className="flex justify-between text-text-muted">
                    <span>UPI / QR:</span>
                  <span className="font-bold text-text">
                    {formatCurrency(zReportSlip.systemTotals?.upi, reportCurrency, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Card / POS Terminals:</span>
                  <span className="font-bold text-text">
                    {formatCurrency(zReportSlip.systemTotals?.card, reportCurrency, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {(zReportSlip.systemTotals?.other || 0) > 0 && (
                  <div className="flex justify-between text-text-muted">
                    <span>Other / Online:</span>
                    <span className="font-bold text-text">
                      {formatCurrency(zReportSlip.systemTotals?.other, reportCurrency, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-border/80 pt-1.5 font-bold text-text">
                  <span>Total Day Collections:</span>
                  <span className="text-accent dark:text-accent">
                    {formatCurrency(zReportSlip.systemTotals?.total, reportCurrency, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-surface-alt border border-border space-y-1 mt-2">
                <div className="flex justify-between">
                  <span className="font-bold text-text">Physical Cash Counted:</span>
                  <span className="font-bold text-text">
                    {formatCurrency(zReportSlip.actualCashCounted, reportCurrency, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border/60">
                  <span className="font-bold">Drawer Variance:</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-bold",
                      zReportSlip.cashVariance === 0
                        ? "bg-success/20 text-success-text dark:text-success-text"
                        : zReportSlip.cashVariance < 0
                        ? "bg-danger/20 text-danger-text dark:text-danger-text"
                        : "bg-primary/20 text-accent dark:text-accent"
                    )}
                  >
                    {zReportSlip.cashVariance === 0
                      ? `BALANCED (${formatCurrency(0, reportCurrency, { minimumFractionDigits: 2 })})`
                      : zReportSlip.cashVariance < 0
                      ? `SHORTAGE (-${formatCurrency(Math.abs(zReportSlip.cashVariance), reportCurrency, { minimumFractionDigits: 2 })})`
                      : `SURPLUS (+${formatCurrency(zReportSlip.cashVariance, reportCurrency, { minimumFractionDigits: 2 })})`}
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


          </div>
        ) : (
          <form id="close-till" onSubmit={handleCloseTill} className="space-y-4 pt-1">
            {locations.length > 1 && (
              <Select
                label="Location *"
                value={tillLocationId}
                onChange={(e) => {
                  setTillLocationId(e.target.value);
                  setActualCashCounted("");
                  setVarianceReason("");
                  fetchTillSummary(e.target.value);
                }}
                options={locations.map((c) => ({ value: String(c.id), label: c.name }))}
                required
              />
            )}

            {tillError ? <div role="alert" className={styles.readError}>{tillError}<Button type="button" size="sm" variant="outline" onClick={() => fetchTillSummary(tillLocationId)}>Try again</Button></div> : loadingTillSummary ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-text-muted">
                <Spinner size="md" />
                <p className="text-xs">Loading till totals...</p>
              </div>
            ) : (
              <>
                {/* Live System Collections Card */}
                <div className="p-3.5 rounded-2xl bg-surface-alt border border-border/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-accent" />
                      System Collections ({tillSummary?.date || new Date().toISOString().slice(0, 10)})
                    </span>
                    <span className="text-xs font-bold text-text">
                      {tillSummary?.systemTotals?.invoiceCount ?? 0} invoices with collections
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60">
                      <p className="text-[10px] text-text-muted font-semibold">CASH DRAWER</p>
                      <p className="text-sm font-bold text-success-text dark:text-success-text font-mono mt-0.5">
                        {formatCurrency(tillSummary?.systemTotals?.cash, tillCurrency, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60">
                      <p className="text-[10px] text-text-muted font-semibold">UPI / QR</p>
                      <p className="text-sm font-bold text-accent dark:text-accent font-mono mt-0.5">
                        {formatCurrency(tillSummary?.systemTotals?.upi, tillCurrency, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60">
                      <p className="text-[10px] text-text-muted font-semibold">POS / CARDS</p>
                      <p className="text-sm font-bold text-accent dark:text-accent font-mono mt-0.5">
                        {formatCurrency(tillSummary?.systemTotals?.card, tillCurrency, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface border border-border/60">
                      <p className="text-[10px] text-text-muted font-semibold">TOTAL RECEIPTS</p>
                      <p className="text-sm font-bold text-text font-mono mt-0.5">
                        {formatCurrency(tillSummary?.systemTotals?.total, tillCurrency, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted">Gross receipts by collection date{tillSummary?.timezone ? ` · ${tillSummary.timezone}` : ""}. Use Physical cash drawer to reconcile opening float, refunds, payouts and handover.</p>
                  {tillSummary?.systemTotals.receiptCount !== undefined && <p className="text-xs">{tillSummary.systemTotals.receiptCount} receipts · {tillSummary.systemTotals.legacyReceiptCount || 0} recorded legacy payments</p>}
                  {(tillSummary?.systemTotals.other || 0) > 0 && <p className="text-xs">Other / online payments: {formatCurrency(tillSummary?.systemTotals.other, tillCurrency, { minimumFractionDigits: 2 })}</p>}
                  {tillSummary?.reconciliation?.requiresReview && <div role="alert" className={styles.readError}>
                    {tillSummary.reconciliation.issueCount} payment evidence issues need reconciliation before closing. Review the affected invoices; uncertain amounts are excluded from these totals.
                    <ul>{tillSummary.reconciliation.issues.map((issue, index) => <li key={`${issue.invoiceId}-${index}`}>{issue.invoiceNumber}: {tillEvidenceLabels[issue.reason] || "Payment details need review"}</li>)}</ul>
                  </div>}
                  {tillSummary?.latestShift && (
                    <div className="p-2 rounded-xl bg-warning/10 border border-warning/20 text-xs text-warning-text dark:text-warning-text flex items-center justify-between">
                      <span>
                        ℹ️ Shift already closed today at{" "}
                        <strong>{new Date(tillSummary.latestShift.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => setZReportSlip(tillSummary.latestShift)}
                        className="text-[10px] font-bold border-warning/30"
                      >
                        View last collection report
                      </Button>
                    </div>
                  )}
                </div>

                {/* Drawer Cash Audit & Variance Calculation */}
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <Input
                      label={`Actual Physical Cash Counted (${tillCurrency}) *`}
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
                              ? "bg-success/10 border-success/30 text-success-text dark:text-success-text"
                              : isShort
                              ? "bg-danger/10 border-danger/30 text-danger-text dark:text-danger-text"
                              : "bg-primary/10 border-accent/30 text-accent dark:text-accent"
                          )}
                        >
                          {isBalanced ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-success-text shrink-0" />
                              <span>BALANCED: Matches system cash.</span>
                            </>
                          ) : isShort ? (
                            <>
                              <AlertTriangle className="w-4 h-4 text-danger-text shrink-0" />
                              <span>SHORTAGE: -{formatCurrency(Math.abs(diff), tillCurrency, { minimumFractionDigits: 2 })}</span>
                            </>
                          ) : (
                            <>
                              <IndianRupee className="w-4 h-4 text-accent shrink-0" />
                              <span>SURPLUS: +{formatCurrency(diff, tillCurrency, { minimumFractionDigits: 2 })}</span>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {actualCashCounted !== "" && Number(actualCashCounted) !== (tillSummary?.systemTotals?.cash ?? 0) && (
                    <Input
                      label="Reason for difference *"
                      placeholder="e.g. Returned petty cash, change rounding, unrecorded refund..."
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                      required
                    />
                  )}

                  <Textarea
                    label="Handover notes (optional)"
                    placeholder="e.g. 500x4, 200x2, 100x1. Handed over drawer keys to Evening Shift..."
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    rows={2}
                  />
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
        title="OPD checkout"
        size="lg"
        busy={submittingCheckout}
        bodyClassName={styles.dialogBody}
        footer={<div className={styles.dialogActions}>
            <Button
              disabled={submittingCheckout} variant="outline"
              size="sm"
              onClick={() => setIsCheckoutModalOpen(false)}
              className="w-full sm:w-auto font-semibold min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit" form="checkout-payment"
              loading={submittingCheckout}
              disabled={!checkoutPreview || loadingCheckoutPreview || loadingOpdAppointments || previewAppointmentId !== selectedCheckoutApptId || checkoutPreview.isAlreadyPaid || checkoutFeeDirty}
              className="w-full sm:w-auto font-bold bg-primary-600 hover:bg-primary-700 min-h-[44px]"
            >
              Collect & issue invoice
            </Button>
          </div>}
      >
        <form id="checkout-payment" onSubmit={handleExecuteConsolidatedCheckout} className="space-y-4 pt-1">
          <p className="text-xs text-text-muted">
            Review consultation, test and medicine charges before collecting payment.
          </p>

          {locations.length > 1 ? <Select label="Location" value={checkoutLocationId} disabled={submittingCheckout} onChange={(event) => {
            setCheckoutLocationId(event.target.value);
            setCheckoutDiscount(0);
            setCheckoutNotes("");
            setCheckoutRefNumber("");
            void fetchOpdAppointments(event.target.value);
          }} options={locations.map((location) => ({ value: location.id, label: location.name }))} /> : <p className="text-xs text-text-muted">{locations[0]?.name || "No location available"}</p>}

          {/* Select OPD Patient */}
          <div>
            <label htmlFor="checkout-appointment" className="text-xs font-bold text-text mb-1.5 block">Today's appointment</label>
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
                id="checkout-appointment"
                value={selectedCheckoutApptId}
                onChange={(e) => {
                  setCheckoutDiscount(0);
                  setCheckoutRefNumber("");
                  setCheckoutNotes("");
                  setCheckoutPaymentMethod("cash");
                  setSelectedCheckoutApptId(e.target.value);
                  fetchCheckoutPreview(e.target.value);
                }}
                options={opdAppointments.map((a: any) => ({
                  value: a.id || a._id,
                  label: `#${a.tokenNumber ?? "—"} — ${a.patientId?.userId?.name || a.patientId?.name || "Patient"} · ${a.paymentStatus === "paid" ? "Paid" : "Unpaid"}`,
                }))}
              />
            )}
          </div>

          {checkoutError && <div role="alert" className={styles.readError}>{checkoutError}<Button type="button" size="sm" variant="outline" onClick={() => selectedCheckoutApptId ? fetchCheckoutPreview(selectedCheckoutApptId) : fetchOpdAppointments()}>Try again</Button></div>}
          {/* Charges Breakdown Preview */}
          {loadingCheckoutPreview && !checkoutPreview ? (
            <div className="flex items-center justify-center p-8 rounded-2xl bg-surface-alt border border-border text-xs text-text-muted gap-2">
              <Spinner size="md" />
              <span>Loading charges...</span>
            </div>
          ) : checkoutPreview ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-surface-alt p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Charges</span>
                  <Badge variant={checkoutPreview.isAlreadyPaid ? "success" : "warning"} size="sm" className="text-[10px] font-bold">
                    {checkoutPreview.isAlreadyPaid ? "Already paid" : "Payment due"}
                  </Badge>
                </div>

                {checkoutPreview.isFeeEditable && (
                  <div className={styles.feeEditor}>
                    <div>
                      <span className="font-bold text-warning-text dark:text-warning-text block">Consultation fee</span>
                      <span className="text-[10px] text-text-muted">
                        {checkoutPreview.feeType === "post_consultation" ? "Post-consultation fee entry" : "Adjustable consultation charge"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-text">₹</span>
                      <Input type="number" min={0} disabled={loadingCheckoutPreview} value={checkoutCustomConsultFee} onChange={(e) => setCheckoutCustomConsultFee(e.target.value)} aria-label="Consultation fee" placeholder="Amount" fullWidth={false} containerClassName="w-24" size="sm" />
                      <Button type="button" loading={loadingCheckoutPreview} onClick={() => fetchCheckoutPreview(selectedCheckoutApptId, Number(checkoutCustomConsultFee) || 0)} variant="outline" size="xs">
                        Apply
                      </Button>
                    </div>
                  </div>
                )}

                {Boolean(checkoutPreview.unfilledPrescriptions?.length) && (
                  <p className="text-xs text-text-secondary" role="status">Awaiting pharmacy supply (unbilled): {checkoutPreview.unfilledPrescriptions!.map(rx => rx.medicineName).join(", ")}.</p>
                )}
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
                    <span className="font-mono text-accent dark:text-accent">
                      ₹{checkoutPreview.totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="checkout-method" className="text-xs font-bold text-text mb-1 block">Payment Method *</label>
                  <Select id="checkout-method"                     value={checkoutPaymentMethod}
                    onChange={(e) => setCheckoutPaymentMethod(e.target.value as any)}
                    options={[
                      { value: "cash", label: "💵 Cash (Counter Drawer)" },
                      { value: "upi", label: "📱 UPI (Counter QR / Soundbox)" },
                      { value: "card", label: "💳 Card (POS Terminal)" },
                    ]}
                  />
                </div>

                <div>
                  <label htmlFor="checkout-discount" className="text-xs font-bold text-text mb-1 block">Discount / Waiver (₹)</label>
                  <Input id="checkout-discount"                     type="number"
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
                  <label htmlFor="checkout-reference" className="text-xs font-bold text-text mb-1 block">Transaction / UTR Reference (Optional)</label>
                  <Input id="checkout-reference"                     value={checkoutRefNumber}
                    onChange={(e) => setCheckoutRefNumber(e.target.value)}
                    placeholder="UPI Ref / Card Auth Code"
                  />
                </div>
                <div>
                  <label htmlFor="checkout-notes" className="text-xs font-bold text-text mb-1 block">Cashier Settlement Notes</label>
                  <Input id="checkout-notes"                     value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    placeholder="e.g. Cleared at Reception Counter"
                  />
                </div>
              </div>

              {/* Net Payable Banner */}
              <div className={styles.checkoutTotal}>
                <div>
                  <span className="text-xs font-bold text-success-text dark:text-success-text">Amount to collect</span>
                  <p className="text-[11px] text-success-text/80 dark:text-success-text/80">
                    Invoice issued after payment
                  </p>
                </div>
                <div className="text-2xl font-black font-mono text-success-text dark:text-success-text">
                  ₹{Math.max(0, checkoutPreview.totalAmount - (Number(checkoutDiscount) || 0)).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          ) : null}

          </form>
      </Modal>
    </div>
  );
}
