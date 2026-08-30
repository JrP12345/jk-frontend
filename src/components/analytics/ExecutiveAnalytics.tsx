"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  StatCard,
  Spinner,
  Badge,
  Button,
  ChartContainer,
  AreaChart,
  DonutChart,
} from "@/components/ui";

export function ExecutiveAnalytics() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const [apptsRes, invRes, deptRes] = await Promise.allSettled([
        api.get("/appointments"),
        api.get("/invoices"),
        api.get("/departments"),
      ]);

      const appts: any[] = apptsRes.status === "fulfilled" ? apptsRes.value.data?.data || [] : [];
      const invoices: any[] = invRes.status === "fulfilled" ? invRes.value.data?.data || [] : [];
      const departments: any[] = deptRes.status === "fulfilled" ? deptRes.value.data?.data || [] : [];

      const totalFootfall = appts.length;
      const completedVisits = appts.filter((a) => a.status === "completed").length;
      const conversionRate = totalFootfall > 0 ? ((completedVisits / totalFootfall) * 100).toFixed(1) : "0";

      const totalRevenue = invoices.reduce((acc: number, inv: any) => acc + (inv.totalAmount || 0), 0);
      const avgRevenuePerVisit = completedVisits > 0 ? (totalRevenue / completedVisits).toFixed(0) : "0";

      // 7-day volume trajectory
      const now = new Date();
      const trendData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("en-US", { weekday: "short" });

        const dayAppts = appts.filter((a) => (a.appointmentTime || a.createdAt || "").split("T")[0] === dateKey);
        const dayInvoices = invoices.filter((inv) => (inv.paymentDate || inv.createdAt || "").split("T")[0] === dateKey);

        const visits = dayAppts.length;
        const revenue = dayInvoices.reduce((sum, inv) => sum + (inv.amountPaid || inv.totalAmount || 0), 0);

        trendData.push({
          label,
          visits,
          revenue,
        });
      }

      // Department distribution
      const deptCounts: Record<string, number> = {};
      departments.forEach((dept) => {
        deptCounts[dept.name] = 1;
      });
      appts.forEach((a) => {
        const dName = a.departmentId?.name || a.doctorId?.specialization || "General Medicine";
        deptCounts[dName] = (deptCounts[dName] || 0) + 1;
      });

      const colors = [
        "var(--s-chart-1, #3b82f6)",
        "var(--s-chart-2, #10b981)",
        "var(--s-chart-3, #f59e0b)",
        "var(--s-chart-4, #8b5cf6)",
        "var(--s-chart-5, #ec4899)",
        "#06b6d4",
        "#f97316",
      ];

      const deptData = Object.entries(deptCounts).map(([name, val], idx) => ({
        name,
        value: val,
        color: colors[idx % colors.length],
      }));

      setMetrics({
        totalFootfall,
        completedVisits,
        conversionRate,
        totalRevenue,
        avgRevenuePerVisit,
        departmentCount: departments.length,
        departments,
        trendData,
        deptData,
      });
    } catch (err) {
      console.error("Failed to load executive analytics:", err);
      setError("Unable to load executive metrics. Please verify your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center animate-fade-in flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" label="Aggregating enterprise health system analytics..." />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="py-12 text-center border-dashed border-border/80">
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-text-secondary">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-xl font-bold text-text tracking-tight">Executive BI & Analytics</h2>
          <p className="text-xs text-text-secondary">Operational metrics, patient footfall, revenue conversion, and capacity utilization.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="primary" className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
            Enterprise Tier
          </Badge>
          <Button variant="outline" size="xs" onClick={fetchAnalytics}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Patient Footfall"
          value={metrics?.totalFootfall || 0}
          change={{ value: "Real-time", positive: true }}
          icon={
            <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          label="Visit Conversion Rate"
          value={`${metrics?.conversionRate || 0}%`}
          change={{ value: "Checked-in to Completed", positive: true }}
          icon={
            <svg className="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          label="Total Collected Revenue"
          value={`₹${(metrics?.totalRevenue || 0).toLocaleString()}`}
          change={{ value: "Collections", positive: true }}
          icon={
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Avg Revenue / Visit"
          value={`₹${metrics?.avgRevenuePerVisit || 0}`}
          change={{ value: "Per Encounter", positive: true }}
          icon={
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
      </div>

      {/* Purposeful Executive Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartContainer
          title="Patient Footfall Trajectory"
          description="7-day volume trend of patient consultations"
          className="lg:col-span-2"
          height={210}
        >
          <AreaChart
            data={metrics?.trendData || []}
            series={[
              { key: "visits", name: "Patient Encounters", color: "var(--s-chart-1, #3b82f6)" },
            ]}
            height={210}
            valueFormatter={(v) => `${v} visits`}
          />
        </ChartContainer>

        <ChartContainer
          title="Department & Specialty Breakdown"
          description="Encounter workload by specialty"
          className="lg:col-span-1"
          height={210}
        >
          <DonutChart
            data={metrics?.deptData || []}
            height={210}
            valueFormatter={(v) => `${v}`}
          />
        </ChartContainer>
      </div>

      {/* Department Breakdown & Capacity Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-text">
            Clinical Departments & Specialties ({metrics?.departmentCount || 0})
          </CardTitle>
          <CardDescription>Configured specialties, department heads, and facility affiliations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics?.departments?.length === 0 ? (
            <div className="text-xs text-text-muted text-center py-6">
              No custom departments configured. Go to Organization Settings to add clinical departments.
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
                    <span>Head: {dept.headDoctorId?.name || "Unassigned"}</span>
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

