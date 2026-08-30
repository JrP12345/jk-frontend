"use client";

import { useState, useEffect } from "react";
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
  DatePicker,
  Select,
  useToast,
  Spinner,
  Badge,
  StatCard,
  Dropdown,
  ConfirmDialog,
  ChartContainer,
  DonutChart,
  cn,
} from "@/components/ui";
import { PharmacyAlertsCenter } from "@/components/pharmacy/PharmacyAlertsCenter";
import {
  RotateCw,
  Plus,
  Pill,
  AlertTriangle,
  Clock,
  Package,
  FileText,
  MoreHorizontal,
  Edit3,
  Trash2,
  Receipt,
  Stethoscope,
  Phone,
  ArrowRight,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface MedicineType {
  id: string;
  clinicId: string;
  name: string;
  genericName: string;
  stockQuantity: number;
  price: number;
  costPrice: number;
  expiryDate: string;
  batchNumber: string;
  reorderLevel?: number;
  hsnCode?: string;
  gstRate?: number;
}

interface PrescriptionItem {
  id: string;
  medicineId: string | null;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

interface PendingPrescriptionGroup {
  encounterId: string;
  appointmentId: string | null;
  appointmentTime: string | null;
  patientId: { id: string; name: string; phone?: string };
  doctorId: { id: string; name: string };
  prescriptions: PrescriptionItem[];
}

export default function PharmacyPage() {
  const { user, activeClinicId } = useAuthStore();
  const { clinics, fetchClinics } = useClinicStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"inventory" | "alerts" | "dispensing">("inventory");
  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const [medicines, setMedicines] = useState<MedicineType[]>([]);
  const [pendingPrescriptionGroups, setPendingPrescriptionGroups] = useState<PendingPrescriptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add/Edit Medicine Modal State
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medName, setMedName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [stockQuantity, setStockQuantity] = useState(0);
  const [retailPrice, setRetailPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [expiryDate, setExpiryDate] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [submittingMed, setSubmittingMed] = useState(false);
  const [medErrors, setMedErrors] = useState<Record<string, string>>({});

  // Dispensing Modal State
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);
  const [activePrescriptionGroup, setActivePrescriptionGroup] = useState<PendingPrescriptionGroup | null>(null);
  const [dispenseItems, setDispenseItems] = useState<Array<{ medicineId: string; quantity: number }>>([]);
  const [submittingDispense, setSubmittingDispense] = useState(false);

  // Multi-Batch Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchTargetMed, setBatchTargetMed] = useState<MedicineType | null>(null);
  const [newBatchNum, setNewBatchNum] = useState("");
  const [newBatchExpiry, setNewBatchExpiry] = useState("");
  const [newBatchQty, setNewBatchQty] = useState<number>(50);
  const [newBatchCost, setNewBatchCost] = useState<number>(0);
  const [newBatchPrice, setNewBatchPrice] = useState<number>(0);
  const [submittingBatch, setSubmittingBatch] = useState(false);

  const openAddBatchModal = (med?: MedicineType) => {
    const target = med || medicines[0] || null;
    setBatchTargetMed(target);
    setNewBatchNum("");
    setNewBatchExpiry("");
    setNewBatchQty(50);
    setNewBatchCost(target?.costPrice || 0);
    setNewBatchPrice(target?.price || 0);
    setIsBatchModalOpen(true);
  };

  const handleAddBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchTargetMed || !newBatchNum || !newBatchExpiry || newBatchQty <= 0) {
      toast({
        title: "Validation Error",
        description: "Batch number, expiry date, and quantity are required.",
        variant: "error",
      });
      return;
    }

    setSubmittingBatch(true);
    try {
      await api.post("/pharmacy/batches", {
        medicineId: batchTargetMed.id,
        clinicId: selectedClinicId || batchTargetMed.clinicId,
        batchNumber: newBatchNum.trim(),
        expiryDate: newBatchExpiry,
        quantity: newBatchQty,
        purchaseCost: newBatchCost,
        sellingPrice: newBatchPrice,
      });

      toast({
        title: "Batch Stock Added",
        description: `Added ${newBatchQty} units of Batch #${newBatchNum}.`,
        variant: "success",
      });
      setIsBatchModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Batch Error",
        description: err.response?.data?.message || "Failed to add batch.",
        variant: "error",
      });
    } finally {
      setSubmittingBatch(false);
    }
  };

  const validateMedField = (field: string, value: any, currentCost = costPrice, currentRetail = retailPrice) => {
    let error = "";
    if (field === "name" && !String(value).trim()) {
      error = "Brand Name is required";
    } else if (field === "genericName" && !String(value).trim()) {
      error = "Generic Composition is required";
    } else if (field === "batchNumber" && !String(value).trim()) {
      error = "Batch Number is required";
    } else if (field === "expiryDate" && !value) {
      error = "Expiry Date is required";
    } else if (field === "costPrice") {
      const numVal = Number(value);
      if (isNaN(numVal) || numVal <= 0) {
        error = "Purchase cost must be a positive number";
      } else if (currentRetail > 0 && numVal >= currentRetail) {
        error = "Purchase cost must be less than Retail Price";
      }
    } else if (field === "price") {
      const numVal = Number(value);
      if (isNaN(numVal) || numVal <= 0) {
        error = "Retail price must be a positive number";
      } else if (currentCost > 0 && numVal <= currentCost) {
        error = "Retail Price must be greater than Purchase Cost";
      }
    } else if (field === "stockQuantity" && (isNaN(Number(value)) || Number(value) < 0)) {
      error = "Quantity in stock cannot be negative";
    }

    setMedErrors((prev) => {
      if (error) return { ...prev, [field]: error };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateMedForm = () => {
    const newErrors: Record<string, string> = {};
    if (!medName.trim()) newErrors.name = "Brand Name is required";
    if (!genericName.trim()) newErrors.genericName = "Generic Composition is required";
    if (!batchNumber.trim()) newErrors.batchNumber = "Batch Number is required";
    if (!expiryDate) newErrors.expiryDate = "Expiry Date is required";
    if (costPrice <= 0) newErrors.costPrice = "Purchase cost must be a positive number";
    if (retailPrice <= 0) newErrors.price = "Retail price must be a positive number";
    if (retailPrice <= costPrice) newErrors.price = "Retail Price must be greater than Purchase Cost";
    if (stockQuantity < 0) newErrors.stockQuantity = "Quantity in stock cannot be negative";

    setMedErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getDispenseError = (idx: number): string => {
    const item = dispenseItems[idx];
    if (!item || !item.medicineId) return "";
    const med = medicines.find((m) => m.id === item.medicineId);
    if (!med) return "";
    if (item.quantity <= 0) {
      return "Quantity must be greater than 0";
    }
    if (item.quantity > med.stockQuantity) {
      return `Exceeds available stock (${med.stockQuantity})`;
    }
    return "";
  };

  const hasDispenseErrors = dispenseItems.some((item) => {
    if (!item.medicineId) return false;
    const med = medicines.find((m) => m.id === item.medicineId);
    if (!med) return true;
    return item.quantity <= 0 || item.quantity > med.stockQuantity;
  });

  useEffect(() => {
    if (user && user.role !== "patient") fetchClinics();
  }, [user?.id, user?.role, fetchClinics]);

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const query = selectedClinicId ? `?clinicId=${selectedClinicId}` : "";
      const [medsRes, pendingRes] = await Promise.all([
        api.get(`/medicines${query}`),
        selectedClinicId
          ? api.get(`/pharmacy/pending-prescriptions?clinicId=${selectedClinicId}`)
          : Promise.resolve({ data: { data: [] } }),
      ]);
      setMedicines(medsRes.data.data || []);
      setPendingPrescriptionGroups(pendingRes.data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load pharmacy data", variant: "error" });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  const handleMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateMedForm()) {
      toast({ title: "Validation Error", description: "Please resolve the form validation errors.", variant: "warning" });
      return;
    }

    try {
      setSubmittingMed(true);
      const payload = {
        clinicId: selectedClinicId,
        name: medName,
        genericName,
        stockQuantity,
        price: retailPrice,
        costPrice,
        expiryDate,
        batchNumber,
      };

      if (editingMedId) {
        await api.put(`/medicines/${editingMedId}`, payload);
        toast({ title: "Success", description: "Medicine stock updated successfully", variant: "success" });
      } else {
        await api.post("/medicines", payload);
        toast({ title: "Success", description: "Medicine registered successfully", variant: "success" });
      }

      setIsMedModalOpen(false);
      setEditingMedId(null);
      setMedName("");
      setGenericName("");
      setStockQuantity(0);
      setRetailPrice(0);
      setCostPrice(0);
      setExpiryDate("");
      setBatchNumber("");
      setMedErrors({});
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Internal server error", variant: "error" });
    } finally {
      setSubmittingMed(false);
    }
  };

  const [deletingMedId, setDeletingMedId] = useState<string | null>(null);

  const handleDeleteMed = async () => {
    if (!deletingMedId) return;
    try {
      await api.delete(`/medicines/${deletingMedId}`);
      toast({ title: "Deleted", description: "Medicine deleted successfully.", variant: "warning" });
      setDeletingMedId(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Deletion Failed", description: err.response?.data?.message || "Server error", variant: "error" });
    }
  };

  const openDispenseModal = (group: PendingPrescriptionGroup) => {
    setActivePrescriptionGroup(group);

    const initialMappings = (group.prescriptions || []).map((rx) => {
      const matched = rx.medicineId
        ? medicines.find((m) => m.id === rx.medicineId && m.stockQuantity > 0)
        : medicines.find((m) => m.name.toLowerCase().includes(rx.name.toLowerCase()) && m.stockQuantity > 0);
      return {
        medicineId: matched ? matched.id : "",
        quantity: 10,
      };
    });

    setDispenseItems(initialMappings);
    setIsDispenseOpen(true);
  };

  const handleDispenseSubmit = async () => {
    if (!activePrescriptionGroup) return;

    const validItems = dispenseItems.filter((item) => item.medicineId !== "");
    if (validItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please link at least one prescription item to stock inventory.",
        variant: "warning",
      });
      return;
    }

    try {
      setSubmittingDispense(true);
      await api.post("/pharmacy/dispense", {
        patientId: activePrescriptionGroup.patientId.id,
        clinicId: selectedClinicId,
        doctorId: activePrescriptionGroup.doctorId.id,
        prescriptionIds: activePrescriptionGroup.prescriptions.map((rx) => rx.id),
        items: validItems,
      });

      toast({
        title: "Dispensed & Billed",
        description: "Medicines dispensed and billing invoice generated.",
        variant: "success",
      });

      setIsDispenseOpen(false);
      setActivePrescriptionGroup(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Dispense Failed",
        description: err.response?.data?.message || "Failed to complete dispensing request.",
        variant: "error",
      });
    } finally {
      setSubmittingDispense(false);
    }
  };

  const totalItems = medicines.length;
  const lowStockCount = medicines.filter((m) => m.stockQuantity < 10).length;
  const expiredCount = medicines.filter((m) => new Date(m.expiryDate) < new Date()).length;
  const canManageMedicines = hasAnyPermission(user, "MANAGE_MEDICINES");

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
                Pharmacy Desk & Inventory
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Dispensary Operations
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Dispense practitioner prescriptions, log medicine batches, and track inventory stock levels.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isRefreshing}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              <RotateCw className={cn("h-3.5 w-3.5 mr-1.5 text-text-secondary", isRefreshing && "animate-spin")} />
              Refresh
            </Button>

            {canManageMedicines && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingMedId(null);
                  setMedName("");
                  setGenericName("");
                  setStockQuantity(0);
                  setRetailPrice(0);
                  setCostPrice(0);
                  setExpiryDate("");
                  setBatchNumber("");
                  setMedErrors({});
                  setIsMedModalOpen(true);
                }}
                className="font-semibold rounded-xl shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Medicine
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Catalog Items"
          value={totalItems.toString()}
          description="Registered medicine formulations"
          icon={<Pill className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Low Stock Warnings"
          value={lowStockCount.toString()}
          description="Items with < 10 units remaining"
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          label="Expired / Expiring Soon"
          value={expiredCount.toString()}
          description="Batches past validity date"
          icon={<Clock className="w-5 h-5 text-rose-500" />}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. SEGMENTED TABS NAVIGATION BAR
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-surface-alt/70 rounded-xl border border-border/70 overflow-x-auto w-fit max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={cn(
            "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
            activeTab === "inventory"
              ? "bg-surface text-text shadow-xs font-bold border border-border/60"
              : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
          )}
        >
          <Package className={cn("w-3.5 h-3.5", activeTab === "inventory" ? "text-primary-500" : "text-text-muted")} />
          <span>Inventory Stock Catalog</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
            {medicines.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={cn(
            "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
            activeTab === "alerts"
              ? "bg-surface text-text shadow-xs font-bold border border-border/60"
              : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
          )}
        >
          <AlertTriangle className={cn("w-3.5 h-3.5", activeTab === "alerts" ? "text-amber-500" : "text-text-muted")} />
          <span>Low Stock & Expiry Alerts</span>
          {(lowStockCount > 0 || expiredCount > 0) && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
              {lowStockCount + expiredCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dispensing")}
          className={cn(
            "px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-2 shrink-0",
            activeTab === "dispensing"
              ? "bg-surface text-text shadow-xs font-bold border border-border/60"
              : "text-text-muted hover:text-text hover:bg-surface/50 border border-transparent"
          )}
        >
          <Receipt className={cn("w-3.5 h-3.5", activeTab === "dispensing" ? "text-primary-500" : "text-text-muted")} />
          <span>Dispensing Prescription Desk</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-surface-alt text-text-muted">
            {pendingPrescriptionGroups.length}
          </span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. TAB: LOW STOCK & EXPIRY ALERTS
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "alerts" && (
        <PharmacyAlertsCenter
          clinicId={selectedClinicId}
          medicines={medicines as any}
          onOpenAddBatch={(med) => openAddBatchModal(med as any)}
          onRefresh={fetchData}
        />
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          5. TAB 1: INVENTORY STOCK CATALOG
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "inventory" && (
        <div className="space-y-6 animate-fade-in">
          {/* Inventory Health Donut Chart */}
          {medicines.length > 0 && (
            <ChartContainer
              title="Inventory Health & Expiry Risk Status"
              description="Stock distribution across critical inventory thresholds"
              loading={loading}
              height={200}
            >
              <DonutChart
                data={(() => {
                  const now = new Date();
                  let optimal = 0;
                  let low = 0;
                  let outOfStock = 0;
                  let expired = 0;

                  medicines.forEach((m) => {
                    const isExp = new Date(m.expiryDate) < now;
                    if (isExp) expired++;
                    else if (m.stockQuantity === 0) outOfStock++;
                    else if (m.stockQuantity < 10) low++;
                    else optimal++;
                  });

                  return [
                    { name: "Optimal Stock", value: optimal, color: "var(--s-chart-2, #10b981)" },
                    { name: "Low Stock (<10)", value: low, color: "var(--s-chart-3, #f59e0b)" },
                    { name: "Out of Stock", value: outOfStock, color: "var(--s-chart-5, #f43f5e)" },
                    { name: "Expired Batches", value: expired, color: "#dc2626" },
                  ].filter((item) => item.value > 0);
                })()}
                height={200}
                valueFormatter={(v) => `${v} formulations`}
              />
            </ChartContainer>
          )}

          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <Table
                loading={loading}
                columns={[
                  { header: "Brand Name", key: "name" },
                  { header: "Generic Name", key: "generic" },
                  { header: "Batch", key: "batch" },
                  { header: "Expiry Date", key: "expiry" },
                  { header: "Retail Price", key: "price" },
                  { header: "Stock Quantity", key: "stock" },
                  { header: "Actions", key: "actions", align: "right" },
                ]}
                data={medicines.map((med) => {
                  const isExpired = new Date(med.expiryDate) < new Date();
                  return {
                    id: med.id,
                    name: (
                      <div className="space-y-0.5">
                        <span className="font-bold text-text text-xs sm:text-sm">{med.name}</span>
                      </div>
                    ),
                    generic: <span className="text-xs text-text-muted italic">{med.genericName}</span>,
                    batch: (
                      <Badge variant="outline" size="sm" className="font-mono text-[10px] uppercase font-bold">
                        {med.batchNumber}
                      </Badge>
                    ),
                    expiry: (
                      <span className={cn("text-xs", isExpired ? "text-rose-500 font-bold" : "text-text-secondary")}>
                        {new Date(med.expiryDate).toLocaleDateString()} {isExpired && "(Expired)"}
                      </span>
                    ),
                    price: <span className="text-text font-bold text-xs">₹{med.price.toLocaleString("en-IN")}</span>,
                    stock: (
                      <div className="flex items-center gap-1.5">
                        <span className={cn("font-bold text-xs", med.stockQuantity < 10 ? "text-rose-500" : "text-text")}>
                          {med.stockQuantity}
                        </span>
                        {med.stockQuantity < 10 && (
                          <Badge variant="danger" size="sm" className="text-[9px] uppercase font-bold px-1.5 py-0.2">
                            Low
                          </Badge>
                        )}
                      </div>
                    ),
                    actions: (
                      <div className="flex items-center justify-end gap-1.5">
                        <Dropdown
                          align="right"
                          trigger={
                            <Button
                              size="xs"
                              variant="outline"
                              className="h-7 w-7 p-0 flex items-center justify-center rounded-lg text-text-secondary hover:text-text"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          }
                          items={[
                            {
                              label: "Add Batch Stock",
                              icon: <Plus className="w-4 h-4 text-primary-500" />,
                              onClick: () => openAddBatchModal(med),
                            },
                            {
                              label: "Edit Stock Item",
                              icon: <Edit3 className="w-4 h-4 text-text-muted" />,
                              onClick: () => {
                                setEditingMedId(med.id);
                                setMedName(med.name);
                                setGenericName(med.genericName);
                                setStockQuantity(med.stockQuantity);
                                setRetailPrice(med.price);
                                setCostPrice(med.costPrice);
                                setExpiryDate(new Date(med.expiryDate).toISOString().split("T")[0]);
                                setBatchNumber(med.batchNumber);
                                setMedErrors({});
                                setIsMedModalOpen(true);
                              },
                            },
                            { divider: true, label: "" },
                            {
                              label: "Delete Medicine",
                              icon: <Trash2 className="w-4 h-4 text-danger" />,
                              variant: "danger" as any,
                              onClick: () => setDeletingMedId(med.id),
                            },
                          ]}
                        />
                      </div>
                    ),
                  };
                })}
                emptyMessage="No medicines registered in this clinic catalog."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          6. TAB 2: DISPENSING PRESCRIPTION DESK
         ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === "dispensing" && (
        <div className="space-y-6 animate-fade-in">
          <Card className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <Table
                loading={loading}
                columns={[
                  { header: "Patient Details", key: "patient" },
                  { header: "Attending Physician", key: "doctor" },
                  { header: "Encounter Time", key: "time" },
                  { header: "Prescribed Items", key: "rx" },
                  { header: "Actions", key: "action", align: "right" },
                ]}
                data={pendingPrescriptionGroups.map((group) => ({
                  id: group.encounterId,
                  patient: (
                    <div className="space-y-0.5">
                      <div className="font-bold text-text text-xs sm:text-sm">{group.patientId.name}</div>
                      <div className="text-xs text-text-muted flex items-center gap-1">
                        <Phone className="w-3 h-3 text-text-muted" />
                        {group.patientId.phone || "No phone"}
                      </div>
                    </div>
                  ),
                  doctor: (
                    <div className="flex items-center gap-1 text-xs font-semibold text-text">
                      <Stethoscope className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                      <span>Dr. {group.doctorId.name.replace(/^dr\.?\s+/i, "")}</span>
                    </div>
                  ),
                  time: (
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>
                        {group.appointmentTime
                          ? new Date(group.appointmentTime).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                  ),
                  rx: (
                    <div className="space-y-1 py-1 max-w-sm">
                      {group.prescriptions?.map((item) => (
                        <div key={item.id} className="text-xs text-text flex items-center gap-1.5">
                          <Pill className="w-3 h-3 text-primary-500 shrink-0" />
                          <span className="font-bold">{item.name}</span>
                          <span className="text-text-muted">
                            &bull; {item.dosage} ({item.duration})
                          </span>
                        </div>
                      ))}
                    </div>
                  ),
                  action: (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => openDispenseModal(group)}
                        className="font-semibold rounded-lg shadow-xs"
                      >
                        <Receipt className="w-3.5 h-3.5 mr-1" />
                        Dispense & Bill
                      </Button>
                    </div>
                  ),
                }))}
                emptyMessage="No active prescriptions awaiting dispensing at this clinic location."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          7. ADD / EDIT MEDICINE MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isMedModalOpen}
        onClose={() => setIsMedModalOpen(false)}
        title={editingMedId ? "Update Inventory Formulation" : "Register Medicine Stock"}
        description="Configure pharmaceutical item details, batch numbers, pricing, and expiry date."
        size="md"
      >
        <form onSubmit={handleMedSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Brand Name *"
              value={medName}
              onChange={(e) => {
                setMedName(e.target.value);
                validateMedField("name", e.target.value);
              }}
              onBlur={(e) => validateMedField("name", e.target.value)}
              placeholder="e.g. Lipitor 10mg"
              required
              error={medErrors.name}
            />
            <Input
              label="Generic Composition *"
              value={genericName}
              onChange={(e) => {
                setGenericName(e.target.value);
                validateMedField("genericName", e.target.value);
              }}
              onBlur={(e) => validateMedField("genericName", e.target.value)}
              placeholder="e.g. Atorvastatin"
              required
              error={medErrors.genericName}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Batch Number *"
              value={batchNumber}
              onChange={(e) => {
                setBatchNumber(e.target.value);
                validateMedField("batchNumber", e.target.value);
              }}
              onBlur={(e) => validateMedField("batchNumber", e.target.value)}
              placeholder="e.g. LPT-889A"
              required
              error={medErrors.batchNumber}
            />
            <DatePicker
              label="Expiry Date *"
              value={expiryDate}
              minDate={new Date()}
              onChange={(val) => {
                const strVal = typeof val === "string" ? val : val.target.value;
                setExpiryDate(strVal);
                validateMedField("expiryDate", strVal);
              }}
              error={medErrors.expiryDate}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Purchase Cost (₹) *"
              type="number"
              step="0.01"
              value={costPrice === 0 ? "" : costPrice}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCostPrice(val);
                validateMedField("costPrice", val, val, retailPrice);
              }}
              onBlur={(e) => validateMedField("costPrice", Number(e.target.value), Number(e.target.value), retailPrice)}
              placeholder="e.g. 5.50"
              required
              error={medErrors.costPrice}
            />
            <Input
              label="Retail Price (₹) *"
              type="number"
              step="0.01"
              value={retailPrice === 0 ? "" : retailPrice}
              onChange={(e) => {
                const val = Number(e.target.value);
                setRetailPrice(val);
                validateMedField("price", val, costPrice, val);
              }}
              onBlur={(e) => validateMedField("price", Number(e.target.value), costPrice, Number(e.target.value))}
              placeholder="e.g. 12.00"
              required
              error={medErrors.price}
            />
          </div>

          <Input
            label="Quantity in Stock *"
            type="number"
            value={stockQuantity === 0 ? "" : stockQuantity}
            onChange={(e) => {
              const val = Number(e.target.value);
              setStockQuantity(val);
              validateMedField("stockQuantity", val);
            }}
            onBlur={(e) => validateMedField("stockQuantity", Number(e.target.value))}
            placeholder="e.g. 100"
            required
            error={medErrors.stockQuantity}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsMedModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submittingMed} className="font-semibold rounded-xl shadow-xs">
              {submittingMed ? "Saving..." : "Save Medicine Stock"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. DISPENSING DRAWER MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isDispenseOpen}
        onClose={() => setIsDispenseOpen(false)}
        title="Dispensing Fulfillment Desk"
        description="Fulfill prescribed items against clinic inventory stock and create billing charges."
        size="lg"
      >
        {activePrescriptionGroup && (
          <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
            <div className="p-3.5 bg-surface-alt rounded-2xl border border-border/80">
              <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Patient Recipient:</div>
              <div className="text-sm font-bold text-text mt-0.5">{activePrescriptionGroup.patientId.name}</div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Prescribed Items vs Catalog Matches</h4>

              {activePrescriptionGroup.prescriptions?.map((rx, idx) => (
                <div key={rx.id} className="p-3.5 border border-border/80 rounded-2xl space-y-2 bg-surface">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-text flex items-center gap-1">
                      <Pill className="w-3.5 h-3.5 text-primary-500" />
                      Prescribed: {rx.name}
                    </span>
                    <span className="text-text-muted">
                      Dosage: {rx.dosage} &bull; {rx.duration}
                    </span>
                  </div>

                  {/* Stock mapping select and Quantity */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <Select
                        value={dispenseItems[idx]?.medicineId || ""}
                        onChange={(e) => {
                          const updated = [...dispenseItems];
                          updated[idx].medicineId = e.target.value;
                          setDispenseItems(updated);
                        }}
                        placeholder="-- Select stock formulation --"
                        options={medicines.map((med) => ({
                          value: med.id,
                          label: `${med.name} (Stock: ${med.stockQuantity}) - ₹${med.price}/ea`,
                          disabled: med.stockQuantity <= 0,
                        }))}
                      />
                    </div>

                    <div>
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={dispenseItems[idx]?.quantity || 0}
                        onChange={(e) => {
                          const updated = [...dispenseItems];
                          updated[idx].quantity = Number(e.target.value);
                          setDispenseItems(updated);
                        }}
                        error={getDispenseError(idx) || undefined}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Price Estimate */}
            <div className="border-t border-border/60 pt-3.5 flex justify-between items-center text-sm font-bold text-text">
              <span>Estimated Billing Subtotal:</span>
              <span className="text-primary-600 dark:text-primary-400 font-mono text-base">
                ₹
                {dispenseItems
                  .reduce((sum, item) => {
                    const med = medicines.find((m) => m.id === item.medicineId);
                    return sum + (med ? med.price * item.quantity : 0);
                  }, 0)
                  .toLocaleString("en-IN")}
              </span>
            </div>

            <div className="pt-3 border-t border-border/60 flex justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={() => setIsDispenseOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={submittingDispense || hasDispenseErrors}
                onClick={handleDispenseSubmit}
                className="font-semibold rounded-xl shadow-xs"
              >
                {submittingDispense ? "Dispensing..." : "Dispense & Bill Patient"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────────────
          9. DELETE CONFIRMATION DIALOG
         ────────────────────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deletingMedId}
        onClose={() => setDeletingMedId(null)}
        onConfirm={handleDeleteMed}
        title="Delete Inventory Stock Item"
        description="Are you sure you want to remove this medicine item from the inventory catalog? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete Medicine"
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          10. ADD BATCH STOCK MODAL
         ────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title={`Add Batch Stock: ${batchTargetMed?.name || ""}`}
        size="md"
      >
        <form onSubmit={handleAddBatchSubmit} className="space-y-4 pt-1">
          <div className="p-3.5 bg-surface-alt rounded-2xl border border-border/80 text-xs space-y-0.5">
            <p className="font-bold text-text">{batchTargetMed?.name}</p>
            <p className="text-text-muted italic">{batchTargetMed?.genericName}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Batch Number *"
              placeholder="e.g. BATCH-2026-09"
              value={newBatchNum}
              onChange={(e) => setNewBatchNum(e.target.value)}
              required
            />
            <Input
              label="Expiry Date *"
              type="date"
              value={newBatchExpiry}
              onChange={(e) => setNewBatchExpiry(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input
              label="Quantity *"
              type="number"
              min="1"
              value={newBatchQty}
              onChange={(e) => setNewBatchQty(Number(e.target.value))}
              required
            />
            <Input
              label="Purchase Cost (₹) *"
              type="number"
              min="0"
              step="0.01"
              value={newBatchCost}
              onChange={(e) => setNewBatchCost(Number(e.target.value))}
              required
            />
            <Input
              label="Selling Price (₹) *"
              type="number"
              min="0"
              step="0.01"
              value={newBatchPrice}
              onChange={(e) => setNewBatchPrice(Number(e.target.value))}
              required
            />
          </div>

          <div className="flex justify-between border-t border-border/60 pt-3.5">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={submittingBatch} className="font-semibold rounded-xl shadow-xs">
              Add Batch Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
