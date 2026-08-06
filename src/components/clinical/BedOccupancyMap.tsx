"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Modal,
  Select,
  Input,
  Textarea,
  useToast,
  Spinner,
} from "@/components/ui";
import api from "@/lib/api";

export interface BedItem {
  id: string;
  clinicId: string;
  wardName: string;
  bedNumber: string;
  status: "available" | "occupied" | "maintenance" | "reserved";
  pricePerDay: number;
  floor?: string;
  occupiedBy?: {
    id: string;
    userId: {
      name: string;
      phone?: string;
      email?: string;
    };
  } | null;
}

export interface AdmissionItem {
  id: string;
  clinicId: string;
  patientId: {
    id: string;
    userId: { name: string; phone?: string; email?: string };
  };
  bedId: {
    id: string;
    bedNumber: string;
    wardName: string;
    pricePerDay: number;
  };
  admissionDate: string;
  dischargeDate?: string | null;
  reasonForAdmission: string;
  doctorInCharge: { id: string; name: string; specialization?: string };
  status: "admitted" | "discharged";
  notes?: string;
}

interface BedOccupancyMapProps {
  beds: BedItem[];
  admissions: AdmissionItem[];
  clinicId?: string;
  onRefresh: () => void;
  onQuickAdmit?: (bedId: string) => void;
  onDischarge?: (admission: AdmissionItem) => void;
}

export function BedOccupancyMap({
  beds,
  admissions,
  clinicId,
  onRefresh,
  onQuickAdmit,
  onDischarge,
}: BedOccupancyMapProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedWard, setSelectedWard] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Transfer Bed Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferringAdmission, setTransferringAdmission] = useState<AdmissionItem | null>(null);
  const [targetBedId, setTargetBedId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Status Quick Update State
  const [updatingBedId, setUpdatingBedId] = useState<string | null>(null);

  // Extract list of all unique ward names
  const allWards = Array.from(new Set(beds.map((b) => b.wardName || "General Ward")));

  // Filter beds based on Ward, Status, and Search Query
  const filteredBeds = beds.filter((bed) => {
    const matchesWard = selectedWard === "all" || bed.wardName === selectedWard;
    const matchesStatus = selectedStatus === "all" || bed.status === selectedStatus;
    const patientName = bed.occupiedBy?.userId?.name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      bed.bedNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bed.wardName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patientName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesWard && matchesStatus && matchesSearch;
  });

  // Group filtered beds by Ward
  const bedsByWard = filteredBeds.reduce((acc: Record<string, BedItem[]>, bed) => {
    const ward = bed.wardName || "General Ward";
    if (!acc[ward]) acc[ward] = [];
    acc[ward].push(bed);
    return acc;
  }, {});

  // Find active admission for a given bed ID
  const getAdmissionForBed = (bedId: string) => {
    return admissions.find((a) => a.status === "admitted" && (a.bedId?.id || a.bedId) === bedId);
  };

  const handleOpenTransferModal = (bedId: string) => {
    const activeAdm = getAdmissionForBed(bedId);
    if (!activeAdm) {
      toast({
        title: "No Active Admission",
        description: "This bed does not have an active admitted patient to transfer.",
        variant: "error",
      });
      return;
    }
    setTransferringAdmission(activeAdm);
    setTargetBedId("");
    setTransferReason("");
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringAdmission || !targetBedId) return;

    try {
      setTransferSubmitting(true);
      await api.post(`/admissions/${transferringAdmission.id}/transfer-bed`, {
        targetBedId,
        reason: transferReason,
      });

      toast({
        title: "Bed Transfer Complete",
        description: `Patient transferred successfully within ACID session.`,
        variant: "success",
      });

      setTransferModalOpen(false);
      setTransferringAdmission(null);
      onRefresh();
    } catch (err: any) {
      toast({
        title: "Transfer Failed",
        description: err.response?.data?.message || "Could not transfer patient bed",
        variant: "error",
      });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleToggleBedMaintenance = async (bed: BedItem) => {
    const nextStatus = bed.status === "maintenance" ? "available" : "maintenance";
    try {
      setUpdatingBedId(bed.id);
      await api.put(`/beds/${bed.id}`, { status: nextStatus });
      toast({
        title: "Bed Status Updated",
        description: `Bed ${bed.bedNumber} marked as ${nextStatus.toUpperCase()}`,
        variant: "success",
      });
      onRefresh();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.response?.data?.message || "Failed to update bed status",
        variant: "error",
      });
    } finally {
      setUpdatingBedId(null);
    }
  };

  const availableBedsForTransfer = beds.filter((b) => b.status === "available");

  return (
    <div className="space-y-6">
      {/* Ward & Status Filter Toolbar */}
      <div className="p-4 bg-surface rounded-2xl border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Ward Selector Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-text-muted mr-1">Wards:</span>
            <button
              type="button"
              onClick={() => setSelectedWard("all")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                selectedWard === "all"
                  ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                  : "bg-surface-alt text-text-muted border-border/80 hover:text-text"
              }`}
            >
              All Wards ({beds.length})
            </button>
            {allWards.map((ward) => {
              const wardCount = beds.filter((b) => b.wardName === ward).length;
              const isSelected = selectedWard === ward;
              return (
                <button
                  key={ward}
                  type="button"
                  onClick={() => setSelectedWard(ward)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                      : "bg-surface-alt text-text-muted border-border/80 hover:text-text"
                  }`}
                >
                  {ward} ({wardCount})
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <Input
            placeholder="Search bed # or patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-56 text-xs"
          />
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/60 text-xs">
          <span className="font-bold text-text-muted">Filter Status:</span>
          {[
            { key: "all", label: "All Statuses", variant: "neutral" },
            { key: "available", label: "🟢 Available Only", variant: "success" },
            { key: "occupied", label: "🔴 Occupied Only", variant: "error" },
            { key: "maintenance", label: "🟡 Sanitation / Cleaning", variant: "warning" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedStatus(item.key)}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                selectedStatus === item.key
                  ? "bg-primary-500/10 text-primary-600 border-primary-500 font-bold"
                  : "bg-surface-alt/60 text-text-muted border-border/60 hover:text-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ward Cards Layout Grid */}
      {Object.keys(bedsByWard).length === 0 ? (
        <Card className="py-12 text-center text-xs text-text-muted rounded-2xl border-border">
          <CardContent>No inpatient beds found matching current filters.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(bedsByWard).map(([wardName, wardBeds]) => {
            const occupiedCount = wardBeds.filter((b) => b.status === "occupied").length;
            const availableCount = wardBeds.filter((b) => b.status === "available").length;
            const occPercent = wardBeds.length > 0 ? Math.round((occupiedCount / wardBeds.length) * 100) : 0;

            return (
              <Card key={wardName} className="rounded-2xl border border-border/80 bg-surface shadow-xs">
                {/* Ward Header */}
                <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/60">
                  <div>
                    <CardTitle className="text-base font-bold text-text flex items-center gap-2">
                      <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                      </svg>
                      {wardName}
                    </CardTitle>
                    <CardDescription className="text-xs text-text-muted mt-0.5">
                      {occupiedCount} Occupied · {availableCount} Available · Capacity: {wardBeds.length} Beds
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={occPercent > 80 ? "error" : occPercent > 50 ? "warning" : "success"} size="sm" className="font-bold">
                      {occPercent}% Occupancy
                    </Badge>
                  </div>
                </CardHeader>

                {/* Ward Bed Grid */}
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {wardBeds.map((bed) => {
                      const adm = getAdmissionForBed(bed.id);
                      const isOccupied = bed.status === "occupied";
                      const isAvailable = bed.status === "available";
                      const isMaintenance = bed.status === "maintenance";

                      // Calculate days admitted
                      let daysAdmitted = 1;
                      if (adm?.admissionDate) {
                        daysAdmitted = Math.max(
                          1,
                          Math.ceil((Date.now() - new Date(adm.admissionDate).getTime()) / (1000 * 60 * 60 * 24))
                        );
                      }

                      return (
                        <div
                          key={bed.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between text-xs space-y-3 ${
                            isOccupied
                              ? "bg-red-500/5 border-red-500/30 hover:border-red-500/60"
                              : isAvailable
                              ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60"
                              : "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60"
                          }`}
                        >
                          {/* Bed Card Header */}
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-text font-mono">Bed {bed.bedNumber}</span>
                            <Badge
                              variant={isOccupied ? "error" : isAvailable ? "success" : "warning"}
                              size="sm"
                              className="capitalize font-bold"
                            >
                              {bed.status}
                            </Badge>
                          </div>

                          {/* Bed Card Body */}
                          <div className="min-h-[54px] space-y-1">
                            {isOccupied ? (
                              <>
                                <p className="font-bold text-text text-sm truncate">
                                  👤 {bed.occupiedBy?.userId?.name || adm?.patientId?.userId?.name || "Admitted Patient"}
                                </p>
                                {adm?.doctorInCharge?.name && (
                                  <p className="text-[11px] text-text-muted">Doctor: {adm.doctorInCharge.name}</p>
                                )}
                                <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
                                  <span>Admitted: {daysAdmitted} Day{daysAdmitted > 1 ? "s" : ""}</span>
                                  <span className="font-semibold text-emerald-600 font-mono">₹{bed.pricePerDay}/day</span>
                                </div>
                              </>
                            ) : isAvailable ? (
                              <div className="py-1">
                                <p className="text-text-muted italic text-[11px]">Ready for Intake</p>
                                <span className="font-bold text-emerald-600 text-sm block font-mono">₹{bed.pricePerDay}/day</span>
                              </div>
                            ) : (
                              <div className="py-1">
                                <p className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                                  🧹 Sanitation / Cleaning
                                </p>
                                <p className="text-text-muted text-[10px]">Under maintenance</p>
                              </div>
                            )}
                          </div>

                          {/* Quick Action Footer */}
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1.5">
                            {isAvailable && onQuickAdmit && (
                              <Button
                                size="xs"
                                variant="primary"
                                onClick={() => onQuickAdmit(bed.id)}
                                className="w-full font-bold rounded-lg"
                              >
                                + Admit Patient
                              </Button>
                            )}

                            {isOccupied && (
                              <>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => handleOpenTransferModal(bed.id)}
                                  className="font-semibold text-[10px] px-2 rounded-lg"
                                  title="Transfer Bed"
                                >
                                  ⇄ Transfer
                                </Button>
                                {adm?.patientId?.id && (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => router.push(`/dashboard/patients/${adm.patientId.id}`)}
                                    className="font-semibold text-[10px] px-2 rounded-lg"
                                    title="View EHR Profile"
                                  >
                                    📋 EHR
                                  </Button>
                                )}
                                {onDischarge && adm && (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => onDischarge(adm)}
                                    className="font-bold text-[10px] px-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                                    title="Discharge Patient"
                                  >
                                    🚪 Discharge
                                  </Button>
                                )}
                              </>
                            )}

                            {isMaintenance && (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => handleToggleBedMaintenance(bed)}
                                loading={updatingBedId === bed.id}
                                className="w-full font-bold text-emerald-600 rounded-lg"
                              >
                                ✓ Mark Ready
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bed Transfer Modal */}
      {transferringAdmission && (
        <Modal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          title={`⇄ Bed Transfer — ${transferringAdmission.patientId?.userId?.name}`}
        >
          <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-surface-alt rounded-xl border border-border space-y-1">
              <span className="font-bold text-text block">Current Ward & Bed:</span>
              <p className="text-text-secondary">
                {transferringAdmission.bedId?.wardName} — Bed {transferringAdmission.bedId?.bedNumber} (₹{transferringAdmission.bedId?.pricePerDay}/day)
              </p>
            </div>

            <Select
              label="Target Available Bed *"
              value={targetBedId}
              onChange={(e) => setTargetBedId(e.target.value)}
              options={[
                { value: "", label: "Choose an available target bed..." },
                ...availableBedsForTransfer.map((b) => ({
                  value: b.id,
                  label: `${b.wardName} — Bed ${b.bedNumber} (₹${b.pricePerDay}/day)`,
                })),
              ]}
              required
            />

            <Textarea
              label="Reason for Bed Transfer *"
              placeholder="e.g. Patient stabilized in ICU, step-down to General Ward upon doctor recommendation..."
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              rows={3}
              required
            />

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setTransferModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={transferSubmitting}>
                Confirm Bed Transfer
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
