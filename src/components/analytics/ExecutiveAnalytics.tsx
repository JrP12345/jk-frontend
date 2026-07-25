"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, StatCard, Spinner, Badge } from "@/components/ui";

export function ExecutiveAnalytics() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [apptsRes, invRes, deptRes] = await Promise.all([
          api.get("/appointments").catch(() => ({ data: { data: [] } })),
          api.get("/billing/invoices").catch(() => ({ data: { data: [] } })),
          api.get("/departments").catch(() => ({ data: { data: [] } })),
        ]);

        const appts: any[] = apptsRes.data?.data || [];
        const invoices: any[] = invRes.data?.data || [];
        const departments: any[] = deptRes.data?.data || [];

        const totalFootfall = appts.length;
        const completedVisits = appts.filter((a) => a.status === "completed").length;
        const conversionRate = totalFootfall > 0 ? ((completedVisits / totalFootfall) * 100).toFixed(1) : "0";

        const totalRevenue = invoices.reduce((acc: number, inv: any) => acc + (inv.totalAmount || 0), 0);
        const avgRevenuePerVisit = completedVisits > 0 ? (totalRevenue / completedVisits).toFixed(0) : "0";

        setMetrics({
          totalFootfall,
          completedVisits,
          conversionRate,
          totalRevenue,
          avgRevenuePerVisit,
          departmentCount: departments.length,
          departments,
        });
      } catch (err) {
        console.error("Failed to load executive analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Spinner size="lg" label="Calculating enterprise health system KPIs..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-xl font-bold text-text">Executive Health System Analytics</h2>
          <p className="text-xs text-text-secondary">Operational BI metrics, patient footfall, revenue conversion, and capacity utilization.</p>
        </div>
        <Badge variant="primary" className="text-xs font-mono font-bold">
          ⚡ Enterprise Tier Analytics
        </Badge>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total OPD Patient Footfall"
          value={metrics?.totalFootfall || 0}
          change={{ value: "Real-time", positive: true }}
          icon="👥"
        />
        <StatCard
          label="Visit Conversion Rate"
          value={`${metrics?.conversionRate || 0}%`}
          change={{ value: "Checked-In to Completed", positive: true }}
          icon="📈"
        />
        <StatCard
          label="Total OPD Revenue"
          value={`₹${(metrics?.totalRevenue || 0).toLocaleString()}`}
          change={{ value: "Collected", positive: true }}
          icon="💰"
        />
        <StatCard
          label="Avg Revenue / OPD Visit"
          value={`₹${metrics?.avgRevenuePerVisit || 0}`}
          change={{ value: "Per Patient", positive: true }}
          icon="🏥"
        />
      </div>

      {/* Department Breakdown & Capacity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-text">
            Hospital Departments & Specialty Analytics ({metrics?.departmentCount || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics?.departments?.length === 0 ? (
            <div className="text-xs text-text-muted text-center py-6">
              No custom departments configured. Go to Organization Settings to add Cardiology, Orthopedics, Pediatrics, etc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics?.departments?.map((dept: any) => (
                <div key={dept.id || dept._id} className="p-4 bg-surface rounded-xl border border-border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-text">{dept.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      {dept.code}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">{dept.description || "General specialty department"}</p>
                  <div className="pt-2 border-t border-border/50 text-[11px] flex justify-between text-text-muted">
                    <span>Head: Dr. {dept.headDoctorId?.name || "Unassigned"}</span>
                    <span>Facility: {dept.clinicId?.name || "All Facilities"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
