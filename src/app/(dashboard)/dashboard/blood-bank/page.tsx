"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Modal,
  Input,
  Select,
  useToast,
  Badge,
  StatCard,
  Spinner,
} from "@/components/ui";

interface PatientUser {
  name: string;
  email?: string;
  phone?: string;
}

interface PatientProfile {
  id: string;
  userId: PatientUser;
}

export interface BloodUnitItem {
  id: string;
  unitNumber: string;
  clinicId?: { id: string; name: string };
  bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  componentType: "whole_blood" | "prbc" | "ffp" | "platelets";
  volumeMl: number;
  expiryDate: string;
  reservedForPatientId?: {
    id: string;
    userId?: { name: string; phone?: string };
  };
  status: "available" | "reserved" | "transfused" | "expired" | "discarded";
  createdAt?: string;
}

export default function BloodBankPage() {
  const { user, activeClinicId } = useAuthStore();
  const { toast } = useToast();

  const [selectedClinicId, setSelectedClinicId] = useState(activeClinicId || "");
  const [units, setUnits] = useState<BloodUnitItem[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBloodGroupFilter, setSelectedBloodGroupFilter] = useState<string>("all");
  const [selectedComponentFilter, setSelectedComponentFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Register Unit Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [unitNumber, setUnitNumber] = useState("");
  const [bloodGroup, setBloodGroup] = useState<any>("O+");
  const [componentType, setComponentType] = useState<any>("prbc");
  const [volumeMl, setVolumeMl] = useState<number | "">(350);
  const [expiryDate, setExpiryDate] = useState("");
  const [submittingRegister, setSubmittingRegister] = useState(false);

  // Cross-Match Modal State
  const [isCrossMatchModalOpen, setIsCrossMatchModalOpen] = useState(false);
  const [targetPatientId, setTargetPatientId] = useState("");
  const [crossMatchBloodGroup, setCrossMatchBloodGroup] = useState<any>("O+");
  const [requiredUnits, setRequiredUnits] = useState<number>(1);
  const [submittingCrossMatch, setSubmittingCrossMatch] = useState(false);

  useEffect(() => {
    setSelectedClinicId(activeClinicId || "");
  }, [activeClinicId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [unitsRes, patientsRes] = await Promise.all([
        api.get(selectedClinicId ? `/blood-bank/units?clinicId=${selectedClinicId}` : "/blood-bank/units"),
        api.get("/patients"),
      ]);

      setUnits(unitsRes.data?.data || []);
      setPatients(patientsRes.data?.data || []);
    } catch (err: any) {
      toast({
        title: "Failed to Fetch Blood Bank Data",
        description: err.response?.data?.message || "Could not retrieve blood bank inventory",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClinicId]);

  // Handle Register Unit Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitNumber.trim() || !bloodGroup || !volumeMl || !expiryDate) {
      toast({ title: "Validation Error", description: "All fields are required", variant: "error" });
      return;
    }

    try {
      setSubmittingRegister(true);
      await api.post("/blood-bank/units", {
        unitNumber: unitNumber.trim(),
        clinicId: selectedClinicId,
        bloodGroup,
        componentType,
        volumeMl: Number(volumeMl),
        expiryDate: new Date(expiryDate).toISOString(),
      });

      toast({
        title: "Blood Unit Registered 🩸",
        description: `Unit ${unitNumber} (${bloodGroup} ${componentType.toUpperCase()}) added to inventory.`,
        variant: "success",
      });

      setIsRegisterModalOpen(false);
      setUnitNumber("");
      fetchData();
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.response?.data?.message || "Could not register blood unit",
        variant: "error",
      });
    } finally {
      setSubmittingRegister(false);
    }
  };

  // Handle Cross Match Submit
  const handleCrossMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPatientId || !crossMatchBloodGroup || requiredUnits <= 0) {
      toast({ title: "Validation Error", description: "Patient, blood group, and required units are required", variant: "error" });
      return;
    }

    try {
      setSubmittingCrossMatch(true);
      const res = await api.post("/blood-bank/cross-match", {
        patientId: targetPatientId,
        bloodGroup: crossMatchBloodGroup,
        requiredUnits: Number(requiredUnits),
      });

      const data = res.data?.data;
      toast({
        title: "Cross-Match Verified & Reserved 🔬",
        description: `Reserved ${data.reservedCount} unit(s) of ${crossMatchBloodGroup} for patient.`,
        variant: "success",
      });

      setIsCrossMatchModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Cross-Match Allocation Failed",
        description: err.response?.data?.message || "Insufficient unexpired matching blood units available",
        variant: "error",
      });
    } finally {
      setSubmittingCrossMatch(false);
    }
  };

  // Filter Units
  const filteredUnits = units.filter((u) => {
    const matchesBg = selectedBloodGroupFilter === "all" || u.bloodGroup === selectedBloodGroupFilter;
    const matchesComp = selectedComponentFilter === "all" || u.componentType === selectedComponentFilter;
    const matchesStatus = selectedStatusFilter === "all" || u.status === selectedStatusFilter;
    const pName = u.reservedForPatientId?.userId?.name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      u.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.bloodGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesBg && matchesComp && matchesStatus && matchesSearch;
  });

  // Calculate Blood Group Stock Counters
  const bloodGroupsList = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  const stockCounts: Record<string, { available: number; reserved: number }> = {};
  bloodGroupsList.forEach((bg) => {
    stockCounts[bg] = {
      available: units.filter((u) => u.bloodGroup === bg && u.status === "available").length,
      reserved: units.filter((u) => u.bloodGroup === bg && u.status === "reserved").length,
    };
  });

  return (
    <div className="space-y-5 w-full font-sans text-text antialiased animate-fade-in pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight flex items-center gap-2">
            <span>🩸</span> Blood Bank Inventory & Cross-Matching Management
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            ABO/Rh blood component stock control, FEFO (First-Expired, First-Out) cross-matching, and patient reservation.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCrossMatchModalOpen(true)}
            className="font-bold rounded-xl shadow-xs cursor-pointer gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <span>🔬 Cross-Match & Reserve</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUnitNumber(`BLD-U${Date.now().toString().slice(-5)}`);
              setExpiryDate(new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10));
              setIsRegisterModalOpen(true);
            }}
            className="font-bold rounded-xl cursor-pointer gap-1.5"
          >
            <span>+ Register Blood Unit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={loading}
            className="font-semibold rounded-xl cursor-pointer gap-1.5"
          >
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ABO/Rh Blood Group Stock Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {bloodGroupsList.map((bg) => {
          const avail = stockCounts[bg].available;
          const resvd = stockCounts[bg].reserved;
          const isSelected = selectedBloodGroupFilter === bg;

          return (
            <button
              key={bg}
              type="button"
              onClick={() => setSelectedBloodGroupFilter(isSelected ? "all" : bg)}
              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer shadow-xs ${
                isSelected
                  ? "bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-500/30"
                  : avail > 0
                  ? "bg-surface border-border hover:border-red-500/50"
                  : "bg-surface-alt/60 border-border/60 text-text-muted opacity-70"
              }`}
            >
              <div className={`text-base font-black ${isSelected ? "text-white" : "text-red-600 dark:text-red-400"}`}>
                {bg}
              </div>
              <div className="text-xs font-bold mt-0.5">{avail} Avail</div>
              {resvd > 0 && (
                <div className={`text-[10px] ${isSelected ? "text-white/80" : "text-text-muted"}`}>
                  {resvd} Reserved
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Component & Status Filter Toolbar */}
      <div className="p-4 bg-surface rounded-2xl border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Component Type Selector Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-text-muted mr-1">Component:</span>
            {[
              { key: "all", label: "All Components" },
              { key: "prbc", label: "PRBC (Red Blood Cells)" },
              { key: "ffp", label: "FFP (Fresh Frozen Plasma)" },
              { key: "platelets", label: "Platelets" },
              { key: "whole_blood", label: "Whole Blood" },
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedComponentFilter(c.key)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  selectedComponentFilter === c.key
                    ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                    : "bg-surface-alt text-text-muted border-border/80 hover:text-text"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <Input
            placeholder="Search Unit#, Blood Group, Patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-60 text-xs"
          />
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60 text-xs">
          <span className="font-bold text-text-muted">Status:</span>
          {[
            { key: "all", label: "All Units" },
            { key: "available", label: "Available" },
            { key: "reserved", label: "Reserved for Patient" },
            { key: "transfused", label: "Transfused" },
            { key: "expired", label: "Expired" },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelectedStatusFilter(s.key)}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                selectedStatusFilter === s.key
                  ? "bg-primary-500/10 text-primary-600 border-primary-500 font-bold"
                  : "bg-surface-alt/60 text-text-muted border-border/60 hover:text-text"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Blood Units Grid */}
      {loading ? (
        <div className="py-12 text-center">
          <Spinner size="md" label="Loading Blood Bank Units Inventory..." />
        </div>
      ) : filteredUnits.length === 0 ? (
        <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
          <CardContent>No blood units found in inventory matching current filters.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUnits.map((unit) => {
            const isAvailable = unit.status === "available";
            const isReserved = unit.status === "reserved";
            const isExpired = unit.status === "expired" || new Date(unit.expiryDate) < new Date();

            const patientName = unit.reservedForPatientId?.userId?.name || "Patient";
            const patientPhone = unit.reservedForPatientId?.userId?.phone || "";

            const expiryFormatted = new Date(unit.expiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

            return (
              <div
                key={unit.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between text-xs shadow-xs ${
                  isAvailable
                    ? "bg-surface border-border hover:border-red-500"
                    : isReserved
                    ? "bg-purple-500/10 border-purple-500/40 hover:border-purple-500"
                    : isExpired
                    ? "bg-red-500/10 border-red-500/40"
                    : "bg-surface-alt border-border"
                }`}
              >
                {/* Header Badge & Unit Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-sm text-red-600 dark:text-red-400 font-mono bg-red-500/10 px-2.5 py-0.5 rounded-lg border border-red-500/20">
                      🩸 {unit.bloodGroup}
                    </span>
                    <Badge
                      variant={isAvailable ? "success" : isReserved ? "warning" : "error"}
                      className="capitalize font-bold text-xs"
                    >
                      {unit.status}
                    </Badge>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <h3 className="font-bold text-sm text-text font-mono">{unit.unitNumber}</h3>
                    <span className="uppercase text-[11px] font-bold text-text-muted bg-surface-alt px-2 py-0.5 rounded-md border border-border/60">
                      {unit.componentType.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Details Box */}
                <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-border/60 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Volume:</span>
                    <span className="font-bold text-text font-mono">{unit.volumeMl} mL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Expiry Date:</span>
                    <span className={`font-semibold font-mono ${isExpired ? "text-red-500 font-bold" : "text-text"}`}>
                      {expiryFormatted}
                    </span>
                  </div>
                  {isReserved && (
                    <div className="pt-1 border-t border-purple-500/20 text-purple-700 dark:text-purple-300">
                      <span className="block text-text-muted">Reserved For:</span>
                      <span className="font-bold">{patientName} {patientPhone && `(${patientPhone})`}</span>
                    </div>
                  )}
                </div>

                {/* Status Action Buttons */}
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/60">
                  {isReserved && (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={async () => {
                        try {
                          await api.patch(`/blood-bank/units/${unit.id}/status`, { status: "transfused" });
                          toast({ title: "Unit Transfused 💉", description: `Blood unit ${unit.unitNumber} marked as transfused to ${patientName}`, variant: "success" });
                          fetchData();
                        } catch (err: any) {
                          toast({ title: "Action Failed", description: err.response?.data?.message || "Could not update unit status", variant: "error" });
                        }
                      }}
                      className="font-bold text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      💉 Transfuse
                    </Button>
                  )}
                  {(isAvailable || isReserved) && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await api.patch(`/blood-bank/units/${unit.id}/status`, { status: "discarded" });
                          toast({ title: "Unit Discarded 🗑️", description: `Blood unit ${unit.unitNumber} marked as discarded`, variant: "default" });
                          fetchData();
                        } catch (err: any) {
                          toast({ title: "Action Failed", description: err.response?.data?.message || "Could not update unit status", variant: "error" });
                        }
                      }}
                      className="font-semibold text-[11px] text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      🗑️ Discard
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REGISTER BLOOD UNIT MODAL */}
      <Modal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} title="🩸 Register Blood Unit in Inventory">
        <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
          <Input
            label="Blood Unit Number / Barcode *"
            placeholder="e.g. BLD-O-90812"
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="ABO/Rh Blood Group *"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value as any)}
              options={bloodGroupsList.map((bg) => ({ value: bg, label: bg }))}
              required
            />

            <Select
              label="Blood Component Type *"
              value={componentType}
              onChange={(e) => setComponentType(e.target.value as any)}
              options={[
                { value: "prbc", label: "PRBC (Packed Red Blood Cells)" },
                { value: "ffp", label: "FFP (Fresh Frozen Plasma)" },
                { value: "platelets", label: "Platelets Concentrates" },
                { value: "whole_blood", label: "Whole Blood" },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Volume (mL) *"
              type="number"
              value={volumeMl}
              onChange={(e) => setVolumeMl(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />

            <Input
              label="Expiry Date *"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingRegister}>
              Add to Blood Inventory
            </Button>
          </div>
        </form>
      </Modal>

      {/* CROSS-MATCH & RESERVE MODAL */}
      <Modal isOpen={isCrossMatchModalOpen} onClose={() => setIsCrossMatchModalOpen(false)} title="🔬 Cross-Match & Reserve Blood Units">
        <form onSubmit={handleCrossMatchSubmit} className="space-y-4 text-xs">
          <Select
            label="Target Patient Profile *"
            value={targetPatientId}
            onChange={(e) => setTargetPatientId(e.target.value)}
            options={[
              { value: "", label: "Select patient..." },
              ...patients.map((p) => ({
                value: p.id,
                label: `${p.userId?.name || "Patient"} (${p.userId?.phone || "No phone"})`,
              })),
            ]}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="Required Blood Group *"
              value={crossMatchBloodGroup}
              onChange={(e) => setCrossMatchBloodGroup(e.target.value as any)}
              options={bloodGroupsList.map((bg) => ({ value: bg, label: bg }))}
              required
            />

            <Input
              label="Required Units Count *"
              type="number"
              min={1}
              max={10}
              value={requiredUnits}
              onChange={(e) => setRequiredUnits(Number(e.target.value))}
              required
            />
          </div>

          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-[11px] text-purple-800 dark:text-purple-300">
            💡 <b>FEFO Allocation Protocol:</b> The system will automatically select unexpired units closest to expiry date to prevent blood unit degradation.
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCrossMatchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submittingCrossMatch} className="bg-purple-600 hover:bg-purple-700 text-white">
              Verify Cross-Match & Reserve
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
