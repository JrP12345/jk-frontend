"use client";

import React from "react";
import { StatCard, SkeletonCard } from "@/components/ui";
import {
  IndianRupee,
  AlertCircle,
  Building2,
  Stethoscope,
  Calendar,
  Clock,
  CheckCircle2,
  Receipt,
} from "lucide-react";

interface AdminStats {
  clinics: number;
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
}

export function DashboardStatCards({
  role,
  canViewOpsDashboard,
  loading,
  adminStats,
  doctorStats,
  patientStats,
}: DashboardStatCardsProps) {
  if (canViewOpsDashboard) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Today's Collections"
              value={`₹${adminStats.collections.toLocaleString("en-IN")}`}
              description="Settled invoices today"
              icon={<IndianRupee className="w-5 h-5" />}
            />
            <StatCard
              label="Outstanding Balances"
              value={`₹${adminStats.outstanding.toLocaleString("en-IN")}`}
              description="Unpaid pending bills"
              icon={<AlertCircle className="w-5 h-5" />}
            />
            <StatCard
              label="Active Clinics"
              value={adminStats.clinics.toString()}
              description="Operational branches"
              icon={<Building2 className="w-5 h-5" />}
            />
            <StatCard
              label="Active Doctors"
              value={adminStats.doctors.toString()}
              description="On-duty specialists"
              icon={<Stethoscope className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    );
  }

  if (role === "doctor") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Total Consultations"
              value={doctorStats.total.toString()}
              description="Scheduled visits recorded"
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              label="Pending Queue"
              value={doctorStats.pending.toString()}
              description="Awaiting consultation"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              label="Completed Visits"
              value={doctorStats.completed.toString()}
              description="Concluded consultations"
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    );
  }

  if (role === "patient") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Scheduled Visits"
              value={patientStats.appointmentsCount.toString()}
              description="Active upcoming bookings"
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              label="Unpaid Balance"
              value={`₹${patientStats.unpaidBills.toLocaleString("en-IN")}`}
              description="Pending invoices due"
              icon={<Receipt className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    );
  }

  return null;
}
