"use client";

import { StatCard, SkeletonCard } from "@/components/ui";
import { IndianRupee, AlertCircle, Building2, Stethoscope, Calendar, Clock, CheckCircle2, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

import styles from "./DashboardOverview.module.css";

interface AdminStats {
  locations: number;
  doctors: number;
  receptionists: number;
  appointments: number;
  collections: number;
  outstanding: number;
}

interface DoctorStats {
  total: number;
  completed: number;
  pending: number;
}

interface PatientStats {
  appointmentsCount: number;
  unpaidBills: number;
}

interface DashboardStatCardsProps {
  role?: string;
  canViewOpsDashboard: boolean;
  loading: boolean;
  adminStats: AdminStats;
  doctorStats: DoctorStats;
  patientStats: PatientStats;
  financialVisible?: boolean;
  showStaffCounts?: boolean;
  moneyByCurrency?: Array<{ currency: string; collections: number; outstanding: number }>;
}

export function DashboardStatCards({
  role,
  canViewOpsDashboard,
  loading,
  adminStats,
  doctorStats,
  patientStats,
  financialVisible = true,
  showStaffCounts = true,
  moneyByCurrency = [],
}: DashboardStatCardsProps) {
  if (canViewOpsDashboard) {
    return (
      <div className={styles.operationalStats}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {financialVisible && <><StatCard
              className={styles.operationalStat}
              label="Collections"
              value={moneyByCurrency.length ? moneyByCurrency.map(row => formatCurrency(row.collections, row.currency)).join(" · ") : formatCurrency(adminStats.collections)}
              description="Today's settled"
              icon={<IndianRupee className="w-5 h-5" />}
            />
            <StatCard
              className={styles.operationalStat}
              label="Outstanding"
              value={moneyByCurrency.length ? moneyByCurrency.map(row => formatCurrency(row.outstanding, row.currency)).join(" · ") : formatCurrency(adminStats.outstanding)}
              description="Today's pending balance"
              icon={<AlertCircle className="w-5 h-5" />}
            />
            </>}
            <StatCard
              className={styles.operationalStat}
              label="Active Locations"
              value={adminStats.locations.toString()}
              description="Open branches"
              icon={<Building2 className="w-5 h-5" />}
            />
            <StatCard
              className={styles.operationalStat}
              label={showStaffCounts ? "Doctors" : "Today's visits"}
              value={(showStaffCounts ? adminStats.doctors : adminStats.appointments).toString()}
              description={showStaffCounts ? "Registered clinicians" : "Across granted locations"}
              icon={<Stethoscope className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    );
  }

  if (role === "doctor") {
    return (
      <div className={styles.doctorStats}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              className={styles.operationalStat}
              label="Total Visits"
              value={doctorStats.total.toString()}
              description="Today's roster"
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              className={styles.operationalStat}
              label="Pending"
              value={doctorStats.pending.toString()}
              description="In waiting line"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              className={styles.operationalStat}
              label="Completed"
              value={doctorStats.completed.toString()}
              description="Finished visits"
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    );
  }

  if (role === "patient" || role === "family_member") {
    return (
      <div className={styles.patientStats}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              className={styles.operationalStat}
              label="Recorded visits"
              value={patientStats.appointmentsCount.toString()}
              description="All recorded bookings"
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              className={styles.operationalStat}
              label="Unpaid invoices"
              value={patientStats.unpaidBills.toLocaleString()}
              description="Including partial payments"
              icon={<Receipt className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    );
  }

  return null;
}
