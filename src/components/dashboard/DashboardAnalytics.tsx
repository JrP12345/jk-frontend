"use client";

import { ChartContainer, AreaChart, BarChart } from "@/components/ui";
import styles from "./DashboardOverview.module.css";

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
    <div className={styles.analytics}>
      <ChartContainer
        title="Patient volume"
        description="Daily completed and scheduled consultations"
        className={styles.chartPanel}
        height="auto"
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
        <div className={styles.chartScroll} role="region" tabIndex={0} aria-label="Scrollable patient volume"><div style={{ minWidth: Math.max(240, appointmentTrendData.length * 24 + 72) }}><AreaChart
          data={appointmentTrendData}
          series={[
            { key: "completed", name: "Completed Visits", color: "var(--chart-2)" },
            { key: "scheduled", name: "Scheduled", color: "var(--chart-1)" },
            { key: "cancelled", name: "Cancelled", color: "var(--chart-5)" },
          ]}
          height={220}
          valueFormatter={(v) => v.toLocaleString()}
        /></div></div>
      </ChartContainer>

      <ChartContainer
        title="Location activity"
        description="Visits distributed by location"
        className={styles.chartPanel}
        height="auto"
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
