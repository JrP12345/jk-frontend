"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Select, useToast } from "@/components/ui";
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
  locationId: string;
  medicines: MedicineSummary[];
  onOpenAddBatch: (medicine?: MedicineSummary) => void;
  onRefresh: () => void;
}

export function PharmacyAlertsCenter({
  locationId,
  medicines,
  onOpenAddBatch,
  onRefresh,
}: PharmacyAlertsCenterProps) {
  const { toast } = useToast();

  const [daysThreshold, setDaysThreshold] = useState<number>(60);
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpiringBatches = async () => {
    if (!locationId) return;
    try {
      setLoading(true);
      const res = await api.get(`/pharmacy/expiring?locationId=${locationId}&days=${daysThreshold}`);
      setExpiringBatches(res.data?.data || []);
    } catch (err: any) {
      toast({
        title: "Expiry alerts could not be loaded",
        description: err.response?.data?.message || "Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiringBatches();
  }, [locationId, daysThreshold]);

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
          <h2 className="text-lg font-bold text-text">Stock and expiry alerts</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Review low stock and medicine batches nearing expiry.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full sm:w-auto">
          <Select
            size="sm"
            value={daysThreshold.toString()}
            onChange={(e) => setDaysThreshold(parseInt(e.target.value, 10))}
            options={[
              { value: "30", label: "Next 30 days" },
              { value: "60", label: "Next 60 days" },
              { value: "90", label: "Next 90 days" },
            ]}
            className="flex-1 sm:w-44 text-xs font-semibold"
          />

          <Button size="xs" variant="primary" onClick={fetchExpiringBatches} className="flex-1 sm:flex-initial rounded-xl font-bold min-h-[38px]">
            Refresh alerts
          </Button>
        </div>
      </div>

      {/* Quick Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Low Stock Warning Card */}
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-warning-text dark:text-warning-text block uppercase tracking-wider">
              Low stock
            </span>
            <span className="text-2xl font-black text-warning-text dark:text-warning-text">
              {lowStockMedicines.length} Medicines
            </span>
            <p className="text-[11px] text-text-muted mt-0.5">At or below reorder level</p>
          </div>
          <span className="text-3xl">🟠</span>
        </div>

        {/* Expiring Soon Card */}
        <div className="p-4 rounded-2xl bg-primary/10 border border-border flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-accent dark:text-accent block uppercase tracking-wider">
              Expiring Within {daysThreshold} Days
            </span>
            <span className="text-2xl font-black text-accent dark:text-accent">
              {expiringSoonBatches.length} Batches
            </span>
            <p className="text-[11px] text-text-muted mt-0.5">Use these batches before they expire</p>
          </div>
          <span className="text-3xl">🟡</span>
        </div>

        {/* Expired Card */}
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-danger-text dark:text-danger-text block uppercase tracking-wider">
              Expired Batches
            </span>
            <span className="text-2xl font-black text-danger-text dark:text-danger-text">
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
                  className="p-3.5 bg-warning/5 border border-warning/30 rounded-2xl space-y-2.5 text-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-text text-sm truncate">{med.name}</h4>
                      <Badge variant="error" size="sm" className="font-mono font-bold">
                        Stock: {med.stockQuantity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-text-muted">{med.genericName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-text-muted mt-2 pt-2 border-t border-warning/20">
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

      <Card loading={loading} loadingText="Analyzing batch expiration dates..." className="rounded-2xl border border-border bg-surface shadow-xs">
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
        <CardContent className="pt-0 min-h-[120px]">
          {!loading && expiringBatches.length === 0 ? (
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
                        ? "bg-danger/5 border-danger/30"
                        : "bg-primary/5 border-accent/30"
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

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right mr-2 hidden sm:block">
                        <span className="font-mono font-bold text-accent block">₹{batch.sellingPrice}/unit</span>
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
                        className="w-full sm:w-auto rounded-xl font-bold min-h-[36px]"
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
