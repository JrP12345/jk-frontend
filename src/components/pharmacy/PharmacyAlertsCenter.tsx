"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Select,
  Spinner,
  useToast,
} from "@/components/ui";
import api from "@/lib/api";

export interface ExpiringBatchItem {
  _id: string;
  medicineId: {
    _id: string;
    id?: string;
    name: string;
    genericName: string;
    reorderLevel?: number;
    hsnCode?: string;
  };
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  purchaseCost: number;
  sellingPrice: number;
  mrp?: number;
  status: "active" | "expired" | "depleted";
}

interface MedicineSummary {
  id: string;
  name: string;
  genericName: string;
  stockQuantity: number;
  reorderLevel?: number;
  price: number;
  costPrice: number;
  hsnCode?: string;
  gstRate?: number;
}

interface PharmacyAlertsCenterProps {
  clinicId: string;
  medicines: MedicineSummary[];
  onOpenAddBatch: (medicine?: MedicineSummary) => void;
  onRefresh: () => void;
}

export function PharmacyAlertsCenter({
  clinicId,
  medicines,
  onOpenAddBatch,
  onRefresh,
}: PharmacyAlertsCenterProps) {
  const { toast } = useToast();

  const [daysThreshold, setDaysThreshold] = useState<number>(60);
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpiringBatches = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const res = await api.get(`/pharmacy/expiring?clinicId=${clinicId}&days=${daysThreshold}`);
      setExpiringBatches(res.data?.data || []);
    } catch (err: any) {
      toast({
        title: "Failed to Fetch Expiration Watchlist",
        description: err.response?.data?.message || "Could not retrieve expiring medicine batches",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiringBatches();
  }, [clinicId, daysThreshold]);

  // Identify low stock medicines (stockQuantity <= reorderLevel)
  const lowStockMedicines = medicines.filter((m) => {
    const threshold = m.reorderLevel !== undefined ? m.reorderLevel : 20;
    return m.stockQuantity <= threshold;
  });

  const now = new Date();
  const expiredBatches = expiringBatches.filter((b) => new Date(b.expiryDate) < now);
  const expiringSoonBatches = expiringBatches.filter((b) => new Date(b.expiryDate) >= now);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner & Threshold Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-text">Pharmacy Low Stock & Expiration Alert Center</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time surveillance of depleted medicine inventory, FEFO batch expirations, and reorder warnings.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Select
            size="sm"
            value={daysThreshold.toString()}
            onChange={(e) => setDaysThreshold(parseInt(e.target.value, 10))}
            options={[
              { value: "30", label: "30 Days Threshold" },
              { value: "60", label: "60 Days Threshold" },
              { value: "90", label: "90 Days Threshold" },
            ]}
            className="w-44 text-xs font-semibold"
          />

          <Button size="xs" variant="primary" onClick={fetchExpiringBatches} className="rounded-xl font-bold">
            Refresh Alerts
          </Button>
        </div>
      </div>

      {/* Quick Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Low Stock Warning Card */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block uppercase tracking-wider">
              Low Stock Warnings
            </span>
            <span className="text-2xl font-black text-amber-700 dark:text-amber-300">
              {lowStockMedicines.length} Medicines
            </span>
            <p className="text-[11px] text-text-muted mt-0.5">Stock &le; Reorder Threshold</p>
          </div>
          <span className="text-3xl">🟠</span>
        </div>

        {/* Expiring Soon Card */}
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-border flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block uppercase tracking-wider">
              Expiring Within {daysThreshold} Days
            </span>
            <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
              {expiringSoonBatches.length} Batches
            </span>
            <p className="text-[11px] text-text-muted mt-0.5">FEFO Action Required</p>
          </div>
          <span className="text-3xl">🟡</span>
        </div>

        {/* Expired Card */}
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-red-600 dark:text-red-400 block uppercase tracking-wider">
              Expired Batches
            </span>
            <span className="text-2xl font-black text-red-700 dark:text-red-300">
              {expiredBatches.length} Batches
            </span>
            <p className="text-[11px] text-text-muted mt-0.5">Quarantine / Disposal</p>
          </div>
          <span className="text-3xl">🔴</span>
        </div>
      </div>

      {/* SECTION 1: LOW STOCK REORDER WARNINGS */}
      <Card className="rounded-2xl border border-border bg-surface shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-text flex items-center gap-2">
            <span>🟠</span>
            Low Stock Inventory Warnings ({lowStockMedicines.length})
          </CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Medicines whose total inventory has dropped at or below their configured reorder threshold.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {lowStockMedicines.length === 0 ? (
            <p className="text-center py-8 text-xs text-text-muted">
              ✓ All medicine inventory levels are above safety reorder thresholds.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lowStockMedicines.map((med) => (
                <div
                  key={med.id}
                  className="p-3.5 bg-amber-500/5 border border-amber-500/30 rounded-2xl space-y-2.5 text-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-text text-sm truncate">{med.name}</h4>
                      <Badge variant="error" size="sm" className="font-mono font-bold">
                        Stock: {med.stockQuantity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-text-muted">{med.genericName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-text-muted mt-2 pt-2 border-t border-amber-500/20">
                      <span>Reorder Threshold: <b>{med.reorderLevel || 20}</b></span>
                      <span>HSN: <b>{med.hsnCode || "3004"}</b></span>
                    </div>
                  </div>

                  <Button
                    size="xs"
                    variant="primary"
                    onClick={() => onOpenAddBatch(med)}
                    className="w-full font-bold rounded-xl mt-1"
                  >
                    + Restock New Batch
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: BATCH EXPIRATION WATCHLIST */}
      <Card className="rounded-2xl border border-border bg-surface shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-text flex items-center gap-2">
              <span>⏰</span>
              Batch Expiration Watchlist ({expiringBatches.length} Batches)
            </CardTitle>
            <CardDescription className="text-xs text-text-muted">
              Individual medicine batches expiring within the next {daysThreshold} days.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-8 text-center">
              <Spinner size="sm" label="Analyzing batch expiration dates..." />
            </div>
          ) : expiringBatches.length === 0 ? (
            <p className="text-center py-8 text-xs text-text-muted">
              ✓ No active medicine batches are expiring within the next {daysThreshold} days.
            </p>
          ) : (
            <div className="space-y-3">
              {expiringBatches.map((batch) => {
                const isPastExpiry = new Date(batch.expiryDate) < now;
                const medName = batch.medicineId?.name || "Medicine Batch";
                const genericName = batch.medicineId?.genericName || "";

                return (
                  <div
                    key={batch._id}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                      isPastExpiry
                        ? "bg-red-500/5 border-red-500/30"
                        : "bg-blue-500/5 border-blue-500/30"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text text-sm">{medName}</span>
                        <span className="text-[11px] text-text-muted">({genericName})</span>
                        <Badge
                          variant={isPastExpiry ? "error" : "warning"}
                          size="sm"
                          className="font-bold uppercase"
                        >
                          {isPastExpiry ? "🔴 Expired" : "🟡 Expiring Soon"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-text-muted pt-0.5">
                        <span>Batch #: <b className="font-mono text-text">{batch.batchNumber}</b></span>
                        <span>Expiry Date: <b className="text-text">{formatDate(batch.expiryDate)}</b></span>
                        <span>Remaining Stock: <b className="font-mono text-text">{batch.quantity} units</b></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right mr-2 hidden sm:block">
                        <span className="font-mono font-bold text-primary-600 block">₹{batch.sellingPrice}/unit</span>
                        <span className="text-[10px] text-text-muted">Cost: ₹{batch.purchaseCost}</span>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          onOpenAddBatch(
                            medicines.find(
                              (m) => m.id === (batch.medicineId?._id || batch.medicineId?.id)
                            )
                          )
                        }
                        className="rounded-xl font-bold"
                      >
                        + Receive Fresh Batch
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
