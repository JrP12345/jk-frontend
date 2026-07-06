"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, Button, Modal, Input, Select, useToast, Spinner, Badge, StatCard
} from "@/components/ui";

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
}

interface PrescriptionItem {
  name: string;
  dosage: string;
  duration: string;
}

interface AppointmentWithRx {
  id: string;
  patientId: { id: string; userId: { name: string; phone: string } };
  clinicId: { id: string; name: string };
  doctorId: { id: string; name: string };
  appointmentTime: string;
  symptoms?: string;
  diagnosis?: string;
  prescriptions?: PrescriptionItem[];
}

export default function PharmacyPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"inventory" | "dispensing">("inventory");
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [medicines, setMedicines] = useState<MedicineType[]>([]);
  const [completedAppointments, setCompletedAppointments] = useState<AppointmentWithRx[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [activeAppointment, setActiveAppointment] = useState<AppointmentWithRx | null>(null);
  const [dispenseItems, setDispenseItems] = useState<Array<{ medicineId: string; quantity: number }>>([]);
  const [submittingDispense, setSubmittingDispense] = useState(false);

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
    if (!item) return "";
    if (!item.medicineId) return "";
    const med = medicines.find(m => m.id === item.medicineId);
    if (!med) return "";
    if (item.quantity <= 0) {
      return "Quantity must be greater than 0";
    }
    if (item.quantity > med.stockQuantity) {
      return `Exceeds available stock (${med.stockQuantity})`;
    }
    return "";
  };

  const hasDispenseErrors = dispenseItems.some((item, idx) => {
    if (!item.medicineId) return false;
    const med = medicines.find(m => m.id === item.medicineId);
    if (!med) return true;
    return item.quantity <= 0 || item.quantity > med.stockQuantity;
  });

  // Fetch Clinics
  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const res = await api.get("/onboarding/clinics");
        const clinicsList = res.data.data || [];
        setClinics(clinicsList);
        if (clinicsList.length > 0) {
          setSelectedClinicId(clinicsList[0].id);
        }
      } catch (err) {
        toast({ title: "Error", description: "Failed to load clinics list", variant: "error" });
      }
    };
    if (user) fetchClinics();
  }, [user]);

  // Fetch data on Clinic change
  const fetchData = async () => {
    if (!selectedClinicId) return;
    try {
      setLoading(true);
      const [medsRes, apptsRes] = await Promise.all([
        api.get(`/medicines?clinicId=${selectedClinicId}`),
        api.get(`/appointments?clinicId=${selectedClinicId}&status=completed`)
      ]);
      setMedicines(medsRes.data.data || []);
      
      // Filter appointments that actually have prescriptions registered
      const withRx = (apptsRes.data.data || []).filter(
        (a: any) => a.prescriptions && a.prescriptions.length > 0
      );
      setCompletedAppointments(withRx);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load pharmacy data", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Handle Medicine Submit
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
        batchNumber
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

  // Delete Medicine
  const handleDeleteMed = async (medId: string) => {
    if (!confirm("Are you sure you want to remove this medicine?")) return;
    try {
      await api.delete(`/medicines/${medId}`);
      toast({ title: "Success", description: "Medicine deleted successfully", variant: "success" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Deletion Failed", description: err.response?.data?.message || "Server error", variant: "error" });
    }
  };

  // Trigger Dispensing Modal
  const openDispenseModal = (appt: AppointmentWithRx) => {
    setActiveAppointment(appt);
    
    // Map initial Rx names to our stock items where possible (fuzzy or exact name search)
    const initialMappings = (appt.prescriptions || []).map(rx => {
      const matched = medicines.find(
        m => m.name.toLowerCase().includes(rx.name.toLowerCase()) && m.stockQuantity > 0
      );
      return {
        medicineId: matched ? matched.id : "",
        quantity: 10 // Default dispensing quantity
      };
    });

    setDispenseItems(initialMappings);
    setIsDispenseOpen(true);
  };

  // Handle Dispense Submit
  const handleDispenseSubmit = async () => {
    if (!activeAppointment) return;

    // Filter out items without matched medicines
    const validItems = dispenseItems.filter(item => item.medicineId !== "");
    if (validItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please link at least one prescription item to a stock medicine",
        variant: "warning"
      });
      return;
    }

    try {
      setSubmittingDispense(true);
      await api.post("/pharmacy/dispense", {
        patientId: activeAppointment.patientId.id,
        clinicId: selectedClinicId,
        doctorId: activeAppointment.doctorId.id,
        items: validItems
      });

      toast({
        title: "Success",
        description: "Medicines dispensed and billing invoice generated",
        variant: "success"
      });

      setIsDispenseOpen(false);
      setActiveAppointment(null);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Dispense Failed",
        description: err.response?.data?.message || "Failed to complete dispensing request",
        variant: "error"
      });
    } finally {
      setSubmittingDispense(false);
    }
  };

  // Stats Calculations
  const totalItems = medicines.length;
  const lowStockCount = medicines.filter(m => m.stockQuantity < 10).length;
  const expiredCount = medicines.filter(m => new Date(m.expiryDate) < new Date()).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 p-6 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold text-text">Pharmacy Desk & Inventory</h2>
          <p className="text-text-muted text-sm mt-1">Dispense doctor prescriptions, log medicine batches, and track clinic stock levels.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-muted whitespace-nowrap">Selected Clinic:</span>
          <Select
            value={selectedClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
            options={clinics.map(c => ({ value: c.id, label: `${c.name} (${c.city})` }))}
            className="w-64"
          />
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Med Types"
          value={totalItems}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
        />
        <StatCard
          label="Low Stock Warnings"
          value={lowStockCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-red-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Expired / Expiring soon"
          value={expiredCount}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`pb-3 text-sm font-semibold transition-colors ${activeTab === "inventory" ? "border-b-2 border-primary-600 text-primary-600" : "text-text-muted hover:text-text"}`}
        >
          Inventory Stock Catalog
        </button>
        <button
          onClick={() => setActiveTab("dispensing")}
          className={`pb-3 text-sm font-semibold transition-colors ${activeTab === "dispensing" ? "border-b-2 border-primary-600 text-primary-600" : "text-text-muted hover:text-text"}`}
        >
          Dispensing Prescription Desk ({completedAppointments.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <Spinner size="lg" label="Loading catalog records..." />
        </div>
      ) : (
        <>
          {/* TAB 1: INVENTORY STOCK CATALOG */}
          {activeTab === "inventory" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-text">Active Inventory List</h3>
                <Button onClick={() => { setEditingMedId(null); setMedName(""); setGenericName(""); setStockQuantity(0); setRetailPrice(0); setCostPrice(0); setExpiryDate(""); setBatchNumber(""); setMedErrors({}); setIsMedModalOpen(true); }}>
                  + Add New Medicine
                </Button>
              </div>

              <Card className="overflow-hidden">
                <Table
                  columns={[
                    { header: "Brand Name", key: "name" },
                    { header: "Generic Name", key: "generic" },
                    { header: "Batch", key: "batch" },
                    { header: "Expiry Date", key: "expiry" },
                    { header: "Retail Price", key: "price" },
                    { header: "Stock count", key: "stock" },
                    { header: "Actions", key: "actions" }
                  ]}
                  data={medicines.map(med => {
                    const isExpired = new Date(med.expiryDate) < new Date();
                    return {
                      id: med.id,
                      name: <span className="font-bold text-text">{med.name}</span>,
                      generic: <span className="text-sm text-text-muted italic">{med.genericName}</span>,
                      batch: <Badge variant="default" className="font-mono text-xs">{med.batchNumber}</Badge>,
                      expiry: (
                        <span className={isExpired ? "text-red-500 font-semibold text-sm" : "text-sm text-text"}>
                          {new Date(med.expiryDate).toLocaleDateString()} {isExpired && "(Expired)"}
                        </span>
                      ),
                      price: <span className="text-text font-medium">₹{med.price}</span>,
                      stock: (
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${med.stockQuantity < 10 ? "text-red-500" : "text-text"}`}>
                            {med.stockQuantity}
                          </span>
                          {med.stockQuantity < 10 && (
                            <Badge variant="danger" className="text-[9px] px-1 py-0 uppercase">Low Stock</Badge>
                          )}
                        </div>
                      ),
                      actions: (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMedId(med.id);
                              setMedName(med.name);
                              setGenericName(med.genericName);
                              setStockQuantity(med.stockQuantity);
                              setRetailPrice(med.price);
                              setCostPrice(med.costPrice);
                              // Format date for input: YYYY-MM-DD
                              setExpiryDate(new Date(med.expiryDate).toISOString().split("T")[0]);
                              setBatchNumber(med.batchNumber);
                              setMedErrors({});
                              setIsMedModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteMed(med.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      )
                    };
                  })}
                  emptyMessage="No medicines registered for this clinic catalog."
                />
              </Card>
            </div>
          )}

          {/* TAB 2: DISPENSING PRESCRIPTION DESK */}
          {activeTab === "dispensing" && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-text">Outpatient Prescription Queue</h3>

              <Card className="overflow-hidden">
                <Table
                  columns={[
                    { header: "Patient Details", key: "patient" },
                    { header: "Attending Doctor", key: "doctor" },
                    { header: "Visit Time", key: "time" },
                    { header: "Prescription", key: "rx" },
                    { header: "Action", key: "action" }
                  ]}
                  data={completedAppointments.map(appt => ({
                    id: appt.id,
                    patient: (
                      <div>
                        <div className="font-semibold text-text">{appt.patientId.userId.name}</div>
                        <div className="text-xs text-text-muted">{appt.patientId.userId.phone}</div>
                      </div>
                    ),
                    doctor: (
                      <div className="font-medium text-text">
                        {appt.doctorId.name}
                      </div>
                    ),
                    time: new Date(appt.appointmentTime).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                    rx: (
                      <div className="space-y-1 py-1">
                        {appt.prescriptions?.map((item, idx) => (
                          <div key={idx} className="text-xs text-text">
                            💊 <span className="font-bold">{item.name}</span> — <span className="text-text-muted">{item.dosage} ({item.duration})</span>
                          </div>
                        ))}
                      </div>
                    ),
                    action: (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openDispenseModal(appt)}
                      >
                        Dispense & Bill
                      </Button>
                    )
                  }))}
                  emptyMessage="No completed prescriptions awaiting dispensing at this clinic location."
                />
              </Card>
            </div>
          )}
        </>
      )}

      {/* ADD / EDIT MEDICINE MODAL */}
      <Modal
        open={isMedModalOpen}
        onClose={() => setIsMedModalOpen(false)}
        title={editingMedId ? "Update Inventory Item" : "Register Medicine Stock"}
      >
        <form onSubmit={handleMedSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Brand Name *</label>
              <Input
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
              {medErrors.name && <p className="text-red-500 text-xs mt-0.5">{medErrors.name}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Generic Composition *</label>
              <Input
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
              {medErrors.genericName && <p className="text-red-500 text-xs mt-0.5">{medErrors.genericName}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Batch Number *</label>
              <Input
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
              {medErrors.batchNumber && <p className="text-red-500 text-xs mt-0.5">{medErrors.batchNumber}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Expiry Date *</label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  validateMedField("expiryDate", e.target.value);
                }}
                onBlur={(e) => validateMedField("expiryDate", e.target.value)}
                required
                error={medErrors.expiryDate}
              />
              {medErrors.expiryDate && <p className="text-red-500 text-xs mt-0.5">{medErrors.expiryDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Purchase Cost (₹) *</label>
              <Input
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
              {medErrors.costPrice && <p className="text-red-500 text-xs mt-0.5">{medErrors.costPrice}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Retail Price (₹) *</label>
              <Input
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
              {medErrors.price && <p className="text-red-500 text-xs mt-0.5">{medErrors.price}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-text mb-1 block">Qty in Stock *</label>
              <Input
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
              {medErrors.stockQuantity && <p className="text-red-500 text-xs mt-0.5">{medErrors.stockQuantity}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsMedModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingMed}>
              {submittingMed ? "Saving..." : "Save Medicine Stock"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DISPENSING DRAWER MODAL */}
      <Modal
        open={isDispenseOpen}
        onClose={() => setIsDispenseOpen(false)}
        title="Dispensing Fulfillment Desk"
      >
        {activeAppointment && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-hover rounded-xl border border-border">
              <div className="text-xs text-text-muted">Patient Recipient:</div>
              <div className="text-sm font-bold text-text mt-0.5">{activeAppointment.patientId.userId.name}</div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Prescribed Items vs Catalog Matches</h4>
              
              {activeAppointment.prescriptions?.map((rx, idx) => (
                <div key={idx} className="p-3 border border-border/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-text">💊 Prescribed: {rx.name}</span>
                    <span className="text-text-muted">Dosage: {rx.dosage} | Days: {rx.duration}</span>
                  </div>

                  {/* Stock mapping select and Quantity */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Select
                        value={dispenseItems[idx]?.medicineId || ""}
                        onChange={(e) => {
                          const updated = [...dispenseItems];
                          updated[idx].medicineId = e.target.value;
                          setDispenseItems(updated);
                        }}
                        placeholder="-- No Stock Match / Skip --"
                        options={medicines.map(med => ({
                          value: med.id,
                          label: `${med.name} (Qty: ${med.stockQuantity} available) - ₹${med.price}/ea`,
                          disabled: med.stockQuantity <= 0
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
                  {getDispenseError(idx) && (
                    <p className="text-red-500 text-xs mt-1 font-semibold">{getDispenseError(idx)}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Total Price Estimate */}
            <div className="border-t border-border pt-4 flex justify-between items-center text-base font-bold text-primary-600">
              <span>Estimated Billing Subtotal:</span>
              <span>
                ₹
                {dispenseItems.reduce((sum, item) => {
                  const med = medicines.find(m => m.id === item.medicineId);
                  return sum + (med ? med.price * item.quantity : 0);
                }, 0)}
              </span>
            </div>

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsDispenseOpen(false)}>
                Cancel
              </Button>
              <Button disabled={submittingDispense || hasDispenseErrors} onClick={handleDispenseSubmit}>
                {submittingDispense ? "Dispensing..." : "Dispense & Bill Patient"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
