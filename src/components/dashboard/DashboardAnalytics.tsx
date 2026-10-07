"use client";

import { ChartContainer, AreaChart, BarChart } from "@/components/ui";

interface DashboardAnalyticsProps {
  role?: string;
  loading: boolean;
  trendRange: string;
  setTrendRange: (range: string) => void;
  appointmentTrendData: Array<{
    label: string;
    completed: number;
    scheduled: number;
    cancelled: number;
  }>;
  locationThroughputData: Array<{
    label: string;
    completed: number;
    waiting: number;
  }>;
}

export function DashboardAnalytics({
  role,
  loading,
  trendRange,
  setTrendRange,
  appointmentTrendData,
  locationThroughputData,
}: DashboardAnalyticsProps) {
  if (role === "patient") return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <ChartContainer
        title="Patient Volume Trajectory"
        description="Daily completed and scheduled consultations"
        className="lg:col-span-2"
        timeRanges={[
          { label: "Last 7 Days", value: "7D" },
          { label: "Last 30 Days", value: "30D" },
        ]}
        activeRange={trendRange}
        onRangeChange={setTrendRange}
        loading={loading}
        empty={
          appointmentTrendData.length === 0 ||
          appointmentTrendData.every((d) => d.completed === 0 && d.scheduled === 0 && d.cancelled === 0)
        }
        emptyMessage="No patient consultations recorded for this period."
      >
        <AreaChart
          data={appointmentTrendData}
          series={[
            { key: "completed", name: "Completed Visits", color: "var(--chart-2)" },
            { key: "scheduled", name: "Scheduled", color: "var(--chart-1)" },
            { key: "cancelled", name: "Cancelled", color: "var(--chart-5)" },
          ]}
          height={220}
          valueFormatter={(v) => `${v} visits`}
        />
      </ChartContainer>

      <ChartContainer
        title="Location Throughput"
        description="Visits distributed by location"
        className="lg:col-span-1"
        loading={loading}
        empty={
          locationThroughputData.length === 0 ||
          locationThroughputData.every((d) => d.completed === 0 && d.waiting === 0)
        }
        emptyMessage="No branch throughput records."
      >
        <BarChart
          data={locationThroughputData}
          series={[
            { key: "completed", name: "Completed", color: "var(--chart-2)" },
            { key: "waiting", name: "Scheduled", color: "var(--chart-1)" },
          ]}
          layout="stacked"
          height={220}
          valueFormatter={(v) => `${v}`}
        />
      </ChartContainer>
    </div>
  );
}
