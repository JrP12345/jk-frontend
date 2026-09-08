"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui";
import { CalendarClock, ArrowRight } from "lucide-react";

interface DashboardFollowUpAlertsProps {
  alerts: any[];
}

export function DashboardFollowUpAlerts({ alerts }: DashboardFollowUpAlertsProps) {
  const router = useRouter();

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((appt) => (
        <div
          key={appt.id}
          className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.06] p-4 sm:p-5 shadow-xs"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="warning" size="sm" className="font-bold uppercase tracking-wider text-[10px]">
                    Clinical Recommendation
                  </Badge>
                  <span className="text-xs text-text-muted font-medium">
                    Due within {appt.followUpTimeline || "2 weeks"}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-text">
                  Follow-Up Consultation with Dr. {appt.doctorId?.name || "Specialist"}
                </h3>
                <p className="text-xs text-text-secondary">
                  Recommended at <span className="font-semibold text-text">{appt.clinicId?.name || "Clinic"}</span> following your consultation on{" "}
                  {new Date(appt.appointmentTime).toLocaleDateString(undefined, { dateStyle: "medium" })}.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const clinicId = appt.clinicId?._id || appt.clinicId?.id || (typeof appt.clinicId === "string" ? appt.clinicId : "");
                const doctorId = appt.doctorId?._id || appt.doctorId?.id || (typeof appt.doctorId === "string" ? appt.doctorId : "");
                const prevApptId = appt._id || appt.id || "";
                router.push(
                  `/browse/${clinicId}?doctorId=${doctorId}&followUp=true&prevAppointmentId=${prevApptId}`
                );
              }}
              className="rounded-xl font-semibold text-xs shrink-0 self-start md:self-center"
            >
              Schedule Now
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
