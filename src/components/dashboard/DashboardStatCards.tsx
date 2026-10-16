"use client";

import { StatCard, SkeletonCard } from "@/components/ui";
import { IndianRupee, AlertCircle, Building2, Stethoscope, Calendar, Clock, CheckCircle2, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
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
              label="Collections"
              value={moneyByCurrency.length ? moneyByCurrency.map(row => formatCurrency(row.collections, row.currency)).join(" · ") : formatCurrency(adminStats.collections)}
              description="Today's settled"
              icon={<IndianRupee className="w-5 h-5" />}
            />
            <StatCard
              label="Outstanding"
              value={moneyByCurrency.length ? moneyByCurrency.map(row => formatCurrency(row.outstanding, row.currency)).join(" · ") : formatCurrency(adminStats.outstanding)}
              description="Today's pending balance"
              icon={<AlertCircle className="w-5 h-5" />}
            />
            </>}
            <StatCard
              label="Active Locations"
              value={adminStats.locations.toString()}
              description="Open branches"
              icon={<Building2 className="w-5 h-5" />}
            />
            <StatCard
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Total Visits"
              value={doctorStats.total.toString()}
              description="Today's roster"
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              label="Pending"
              value={doctorStats.pending.toString()}
              description="In waiting line"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
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
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Recorded visits"
              value={patientStats.appointmentsCount.toString()}
              description="All recorded bookings"
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
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
