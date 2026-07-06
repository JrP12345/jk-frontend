"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import {
  Card, CardHeader, CardTitle, CardContent,
  Table, useToast, Spinner, Badge, StatCard
} from "@/components/ui";

interface ClinicPerformance {
  id: string;
  name: string;
  city: string;
  appointmentCount: number;
  revenue: number;
  outstanding: number;
}

interface SpecCount {
  name: string;
  count: number;
}

interface AnalyticsData {
  overall: {
    totalRevenue: number;
    outstandingBilling: number;
    bedOccupancyRate: number;
    lowStockWarnings: number;
  };
  clinicsPerformance: ClinicPerformance[];
  doctorSpecializations: SpecCount[];
  referralStats: {
    totalReferrals: number;
    completedReferrals: number;
    completionRate: number;
  };
}

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get("/analytics/executive");
      setData(res.data.data);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load executive analytics reports",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "admin") {
      fetchAnalytics();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <Spinner size="lg" label="Aggregating ecosystem analytics..." />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-8 text-center text-text-muted">
        No analytics data available for your organization.
      </Card>
    );
  }

  const { overall, clinicsPerformance, doctorSpecializations, referralStats } = data;

  return (
    <div className="space-y-6">
      {/* Top Title Banner */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 p-6 rounded-2xl">
        <h2 className="text-2xl font-bold text-text">Ecosystem Executive Board</h2>
        <p className="text-text-muted text-sm mt-1">
          Comparative multi-clinic revenue analytics, active bed census utilization, pharmacy stock alerts, and outpatient referral loop performance.
        </p>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Collections"
          value={`₹${overall.totalRevenue.toLocaleString()}`}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-green-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Outstanding Billings"
          value={`₹${overall.outstandingBilling.toLocaleString()}`}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-red-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Global Bed Census"
          value={`${overall.bedOccupancyRate}%`}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M5 12v7m14-7v7M3 7h2v5H3V7zm16 0h2v5h-2V7z" /></svg>}
        />
        <StatCard
          label="Low Stock Warnings"
          value={overall.lowStockWarnings}
          icon={<svg fill="none" viewBox="0 0 24 24" className="h-5 w-5 text-amber-500" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comparative Clinic Table (Takes 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="py-4 px-5 border-b border-border">
              <CardTitle className="text-lg font-bold text-text">Multi-Clinic Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                columns={[
                  { 
                    header: "Clinic Name", 
                    key: "name",
                    sortable: true,
                    render: (row: ClinicPerformance) => <span className="font-bold text-text">{row.name}</span>
                  },
                  { 
                    header: "Location City", 
                    key: "city",
                    sortable: true,
                    render: (row: ClinicPerformance) => <Badge variant="default" className="text-xs">{row.city}</Badge>
                  },
                  { 
                    header: "Total Visits", 
                    key: "appointmentCount",
                    sortable: true,
                    render: (row: ClinicPerformance) => <span className="text-text font-semibold">{row.appointmentCount}</span>
                  },
                  { 
                    header: "Revenue Collections", 
                    key: "revenue",
                    sortable: true,
                    render: (row: ClinicPerformance) => <span className="text-green-600 font-bold">₹{row.revenue.toLocaleString()}</span>
                  },
                  { 
                    header: "Outstanding Balance", 
                    key: "outstanding",
                    sortable: true,
                    render: (row: ClinicPerformance) => <span className="text-red-500 font-semibold">₹{row.outstanding.toLocaleString()}</span>
                  }
                ]}
                data={clinicsPerformance}
                emptyMessage="No comparative clinic metrics found."
              />
            </CardContent>
          </Card>
        </div>

        {/* Doctor Specialization Distribution & Referrals */}
        <div className="space-y-6">
          {/* Doctor specializations card */}
          <Card>
            <CardHeader className="py-4 px-5 border-b border-border">
              <CardTitle className="text-base font-bold text-text">Clinician Specializations</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {doctorSpecializations.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">No doctor profiles found.</p>
              ) : (
                doctorSpecializations.map((spec, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                    <span className="font-semibold text-text">{spec.name}</span>
                    <Badge variant="default" className="text-xs">
                      {spec.count} {spec.count === 1 ? "Doctor" : "Doctors"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Referral loops performance card */}
          <Card>
            <CardHeader className="py-4 px-5 border-b border-border">
              <CardTitle className="text-base font-bold text-text">Referral Loop Performance</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Total Referrals Programmed:</span>
                <span className="font-bold text-text">{referralStats.totalReferrals}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-muted">Referrals Completed:</span>
                <span className="font-bold text-green-600">{referralStats.completedReferrals}</span>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-text">Loop Completion Rate:</span>
                  <span className="font-extrabold text-primary-600">{referralStats.completionRate}%</span>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="w-full bg-surface-alt h-3.5 rounded-full overflow-hidden border border-border">
                  <div
                    className="bg-primary-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${referralStats.completionRate}%` }}
                  />
                </div>
                <p className="text-[10px] text-text-muted italic mt-1 text-center">
                  Completion measures appointments linked to diagnostic referrals that transitioned to completed status.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
