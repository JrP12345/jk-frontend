"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { canViewAnalytics } from "@/lib/permissions";
import { Alert, Card, CardHeader, CardTitle, CardContent, Button, Table, useToast, Badge, StatCard, SkeletonCard, SkeletonTable, ChartContainer, DonutChart } from "@/components/ui";
import { RotateCw, IndianRupee, AlertCircle, Building2, Boxes } from "lucide-react";

interface LocationPerformance {
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
  locationsPerformance: LocationPerformance[];
  doctorSpecializations: SpecCount[];
  referralStats: {
    totalReferrals: number;
    completedReferrals: number;
    completionRate: number;
  };
}

import { AnalyticsService } from "@/services/analytics.service";

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<any | null>(null);
  const [nabhKpis, setNabhKpis] = useState<any | null>(null);

  const displayMetric = (value: unknown, suffix = "") => value === null || value === undefined ? "—" : `${value}${suffix}`;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const [execData, qData, nabhData] = await Promise.all([
        AnalyticsService.getExecutiveAnalytics(),
        AnalyticsService.getQualityMetrics().catch(() => null),
        AnalyticsService.getNabhKpis().catch(() => null),
      ]);
      setData(execData);
      setQualityMetrics(qData);
      setNabhKpis(nabhData);
    } catch (err) {
      setLoadError(true);
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
    if (user && canViewAnalytics(user)) {
      fetchAnalytics();
    }
  }, [user]);

  if (!user || !canViewAnalytics(user)) {
    return <Alert variant="warning" title="Analytics access required">Your account does not have access to these reports.</Alert>;
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SkeletonTable rows={5} cols={5} />
          </div>
          <div>
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return <div className="space-y-4"><h1 className="text-xl font-semibold">Analytics overview</h1><Alert variant="error" title="Reports could not be loaded" action={<Button variant="outline" onClick={fetchAnalytics}>Try again</Button>}>Check your connection and try again.</Alert></div>;
  }

  if (!data) {
    return (
      <Card className="p-8 text-center text-text-muted">
        No analytics data available for your organization.
      </Card>
    );
  }

  const { overall, locationsPerformance, doctorSpecializations, referralStats } = data;

  return (
    <div className="space-y-6 w-full font-sans text-text antialiased animate-fade-up pb-32 sm:pb-12">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. TOP EXECUTIVE HEADER BANNER
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
                Analytics overview
              </h1>
              <Badge variant="primary" size="sm" dot pulse className="font-semibold">
                Performance
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl">
              Compare revenue, bed use, and referrals across locations.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalytics}
              disabled={loading}
              className="rounded-xl text-xs font-semibold hover:bg-surface-hover transition-colors w-full sm:w-auto min-h-[44px] sm:min-h-[36px] justify-center"
             loading={loading}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5 text-text-secondary" />
              Refresh analytics
            </Button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. KPI STATS CARDS GRID
         ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          label="Total Collections"
          value={`₹${overall.totalRevenue.toLocaleString("en-IN")}`}
          description="Cumulative collected revenue"
          icon={<IndianRupee className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Outstanding Billings"
          value={`₹${overall.outstandingBilling.toLocaleString("en-IN")}`}
          description="Unpaid patient balances"
          icon={<AlertCircle className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Global Bed Census"
          value={`${overall.bedOccupancyRate}%`}
          description="Active inpatient occupancy"
          icon={<Building2 className="w-5 h-5 text-text-secondary" />}
        />
        <StatCard
          label="Low Stock Warnings"
          value={overall.lowStockWarnings.toString()}
          description="Pharmacy items below threshold"
          icon={<Boxes className="w-5 h-5 text-text-secondary" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comparative Location Table (Takes 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="py-4 px-5 border-b border-border">
              <CardTitle className="text-lg font-bold text-text">Multi-Location Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                loading={loading}
                mobileCardView={true}
                columns={[
                  {
                    header: "Location Name",
                    key: "name",
                    sortable: true,
                    render: (row: LocationPerformance) => <span className="font-bold text-text">{row.name}</span>
                  },
                  {
                    header: "Location City",
                    key: "city",
                    sortable: true,
                    render: (row: LocationPerformance) => <Badge variant="default" className="text-xs">{row.city}</Badge>
                  },
                  {
                    header: "Total Visits",
                    key: "appointmentCount",
                    sortable: true,
                    render: (row: LocationPerformance) => <span className="text-text font-semibold">{row.appointmentCount}</span>
                  },
                  {
                    header: "Revenue Collections",
                    key: "revenue",
                    sortable: true,
                    render: (row: LocationPerformance) => <span className="text-success-text font-bold">₹{row.revenue.toLocaleString()}</span>
                  },
                  {
                    header: "Outstanding Balance",
                    key: "outstanding",
                    sortable: true,
                    render: (row: LocationPerformance) => <span className="text-danger-text font-semibold">₹{row.outstanding.toLocaleString()}</span>
                  }
                ]}
                data={locationsPerformance}
                renderMobileCard={(row: LocationPerformance) => (
                  <div
                    key={row.id}
                    className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs space-y-3 relative overflow-hidden transition-all hover:border-primary-500/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-text text-sm">{row.name}</h4>
                        <Badge variant="neutral" size="sm" className="mt-1 text-[10px]">{row.city}</Badge>
                      </div>
                      <span className="text-xs text-text-secondary bg-surface-alt px-2.5 py-1 rounded-lg border border-border/50 font-semibold">
                        {row.appointmentCount} Visits
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-surface-alt/70 border border-border/50">
                      <div>
                        <span className="text-text-muted text-[10px] uppercase font-bold block">Collections</span>
                        <span className="font-bold text-sm text-success-text dark:text-success-text mt-0.5 block">
                          ₹{row.revenue.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted text-[10px] uppercase font-bold block">Outstanding</span>
                        <span className="font-bold text-sm text-danger-text mt-0.5 block">
                          ₹{row.outstanding.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                emptyMessage="No comparative location metrics found."
              />
            </CardContent>
          </Card>
        </div>

        {/* Doctor Specialization Distribution & Referrals */}
        <div className="space-y-6">
          {/* Doctor specializations card */}
          <ChartContainer
            title="Clinician Specializations"
            description="Active clinical provider distribution"
            height={200}
            empty={doctorSpecializations.length === 0}
            emptyMessage="No clinical specialists registered yet."
          >
            <DonutChart
              data={doctorSpecializations.map((spec) => ({
                name: spec.name,
                value: spec.count,
              }))}
              height={200}
              valueFormatter={(v) => `${v} doctors`}
            />
          </ChartContainer>

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
                <span className="font-bold text-success-text">{referralStats.completedReferrals}</span>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-text">Loop Completion Rate:</span>
                  <span className="font-extrabold text-accent">{referralStats.completionRate}%</span>
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

          {/* NABH Hospital Accreditation Quality Standards Card */}
          {nabhKpis && (
            <Card>
              <CardHeader className="py-4 px-5 border-b border-border flex justify-between items-center">
                <CardTitle className="text-base font-bold text-text">NABH Quality Standards (5th Ed.)</CardTitle>
                <Badge variant="primary" className="text-[10px]">Reported indicators</Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Average Length of Stay (ALOS):</span>
                  <span className="font-bold text-text">{displayMetric(nabhKpis.indicators?.averageLengthOfStayDays, " Days")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">30-Day Readmission Rate:</span>
                  <span className="font-bold text-accent">{displayMetric(nabhKpis.indicators?.readmissionRate30DaysPercent, "%")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">MAR Medication Safety:</span>
                  <span className="font-bold text-success-text">{displayMetric(nabhKpis.indicators?.marMedicationCompliancePercent, "%")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">HAI Rate (per 1000 days):</span>
                  <span className="font-bold text-warning-text">{displayMetric(nabhKpis.indicators?.hospitalAcquiredInfectionRatePer1000)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border pt-2">
                  <span className="font-semibold text-text">Patient Satisfaction Index:</span>
                  <span className="font-extrabold text-success-text">{displayMetric(nabhKpis.indicators?.patientSatisfactionScorePercent, "%")}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
