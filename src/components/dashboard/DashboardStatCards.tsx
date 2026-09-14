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
            <StatCard
              label="Collections"
              value={`₹${adminStats.collections.toLocaleString("en-IN")}`}
              description="Today's settled"
              icon={<IndianRupee className="w-5 h-5" />}
            />
            <StatCard
              label="Outstanding"
              value={`₹${adminStats.outstanding.toLocaleString("en-IN")}`}
              description="Pending balance"
              icon={<AlertCircle className="w-5 h-5" />}
            />
            <StatCard
              label="Active Clinics"
              value={adminStats.clinics.toString()}
              description="Open branches"
              icon={<Building2 className="w-5 h-5" />}
            />
            <StatCard
              label="Doctors On-Duty"
              value={adminStats.doctors.toString()}
              description="Active clinicians"
              icon={<Stethoscope className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    );
  }

  if (role === "doctor") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
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

  if (role === "patient") {
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
              label="Booked Visits"
              value={patientStats.appointmentsCount.toString()}
              description="Upcoming bookings"
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              label="Due Balance"
              value={`₹${patientStats.unpaidBills.toLocaleString("en-IN")}`}
              description="Invoices pending"
              icon={<Receipt className="w-5 h-5" />}
            />
          </>
        )}
      </div>
    );
  }

  return null;
}
