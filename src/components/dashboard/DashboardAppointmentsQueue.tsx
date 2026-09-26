"use client";

import React from "react";
import { localDateKey } from "@/lib/date";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Table,
  Button,
  Dropdown,
} from "@/components/ui";
import { hasAnyPermission } from "@/lib/permissions";
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  XCircle,
  ChevronRight,
  UserCheck,
  CalendarX2,
  MoreHorizontal,
  Plus,
  Stethoscope,
} from "lucide-react";

interface DashboardAppointmentsQueueProps {
  appointments: any[];
  loading: boolean;
  user: any;
  canViewOpsDashboard: boolean;
  onUpdateStatus: (apptId: string, status: string) => void;
}

export function DashboardAppointmentsQueue({
  appointments,
  loading,
  user,
  canViewOpsDashboard,
  onUpdateStatus,
}: DashboardAppointmentsQueueProps) {
  if (user?.role !== "patient" && user?.role !== "family_member") appointments = appointments.filter((appointment) => localDateKey(appointment.appointmentTime) === localDateKey());
  const router = useRouter();

  return (
    <Card className="lg:col-span-2 rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-500/20 before:to-transparent">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <CardTitle className="text-sm sm:text-base font-bold text-text">
            {canViewOpsDashboard
              ? "Live Appointments Queue"
              : user?.role === "doctor"
              ? "Today's Patient Roster"
              : "My Scheduled Appointments"}
          </CardTitle>
          {appointments.length > 0 && (
            <Badge variant="neutral" size="sm" className="font-semibold">
              {appointments.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => router.push("/dashboard/appointments")}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 px-2 py-1 min-h-[36px] hover:bg-surface-hover/60 rounded-lg"
        >
          View All
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-text-muted">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt flex items-center justify-center mb-3 border border-border/70 text-text-secondary">
              <CalendarX2 className="w-6 h-6" />
            </div>
            <p className="font-semibold text-text text-sm">No Active Bookings</p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              There are no scheduled consultations or queue entries recorded at this moment.
            </p>
            {hasAnyPermission(user, "MANAGE_APPOINTMENTS") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/appointments")}
                className="mt-4 rounded-xl text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create First Appointment
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Touch-Friendly Card Roster View */}
            <div className="sm:hidden divide-y divide-border/60">
              {appointments.slice(0, 5).map((row: any) => {
                const patientName = row.patientId?.userId?.name || (user?.role === "patient" ? "Self" : "Patient Profile");
                const doctorName = row.doctorId?.name || "Physician";
                const timeString = new Date(row.appointmentTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const dateString = new Date(row.appointmentTime).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });

                return (
                  <div key={row.id || row._id || Math.random()} className="p-3.5 space-y-2.5 hover:bg-surface-alt/60 transition-colors active:scale-[0.99] touch-manipulation">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                          #{String(row.tokenNumber || "—").padStart(2, "0")}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-text-muted">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{timeString} {user?.role !== "doctor" ? `(${dateString})` : ""}</span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          row.status === "completed"
                            ? "success"
                            : row.status === "in-consultation"
                            ? "primary"
                            : row.status === "cancelled"
                            ? "danger"
                            : "warning"
                        }
                        size="sm"
                        dot
                        className="capitalize text-[10px] font-semibold"
                      >
                        {row.status.replace("-", " ")}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-surface-alt border border-border flex items-center justify-center text-xs font-bold text-text-secondary shrink-0 shadow-2xs">
                          {(patientName || "P")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-text text-sm truncate">{patientName}</p>
                          {user?.role !== "doctor" && (
                            <p className="text-xs text-text-muted flex items-center gap-1 truncate">
                              <Stethoscope className="w-3 h-3 text-text-muted shrink-0" />
                              Dr. {doctorName}
                            </p>
                          )}
                        </div>
                      </div>

                      {user?.role === "doctor" ? (
                        <Dropdown
                          align="right"
                          width="w-44"
                          trigger={
                            <Button
                              size="xs"
                              variant="outline"
                              className="h-9 px-3 text-xs font-semibold rounded-xl shrink-0 min-h-[44px] touch-manipulation"
                            >
                              Action
                              <MoreHorizontal className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          }
                          items={[
                            {
                              label: "Check-In",
                              icon: <UserCheck className="w-4 h-4 text-primary-500" />,
                              onClick: () => onUpdateStatus(row.id, "checked-in"),
                            },
                            {
                              label: "In Consultation",
                              icon: <PlayCircle className="w-4 h-4 text-sky-500" />,
                              onClick: () => onUpdateStatus(row.id, "in-consultation"),
                            },
                            {
                              label: "Complete Visit",
                              icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
                              onClick: () => onUpdateStatus(row.id, "completed"),
                            },
                            { divider: true, label: "" },
                            {
                              label: "Cancel Visit",
                              icon: <XCircle className="w-4 h-4 text-danger" />,
                              onClick: () => onUpdateStatus(row.id, "cancelled"),
                              danger: true,
                            },
                          ]}
                        />
                      ) : (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => router.push("/dashboard/appointments")}
                          className="h-9 px-3 text-xs font-semibold text-text-muted hover:text-primary-600 hover:bg-surface-hover shrink-0 min-h-[44px] rounded-xl touch-manipulation"
                        >
                          Details
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View — Compact Widget Presentation */}
            <div className="hidden sm:block overflow-x-auto [scrollbar-width:thin]">
              <Table
                loading={loading}
                searchable={false}
                pagination={false}
                showColumnVisibility={false}
                density="comfortable"
                variant="flat"
                columns={
                  user?.role === "doctor"
                    ? [
                        {
                          key: "tokenNumber",
                          header: "Token",
                          width: "80px",
                          render: (row: any) => (
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                              #{String(row.tokenNumber || "—").padStart(2, "0")}
                            </span>
                          ),
                        },
                        {
                          key: "patient",
                          header: "Patient",
                          render: (row: any) => (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-surface-alt border border-border flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0">
                                {(row.patientId?.userId?.name || "P")[0].toUpperCase()}
                              </div>
                              <span className="font-semibold text-text text-xs sm:text-sm">
                                {row.patientId?.userId?.name || "Patient Profile"}
                              </span>
                            </div>
                          ),
                        },
                        {
                          key: "time",
                          header: "Time Slot",
                          render: (row: any) => (
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              <span>
                                {new Date(row.appointmentTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          ),
                        },
                        {
                          key: "status",
                          header: "Status",
                          render: (row: any) => (
                            <Badge
                              variant={
                                row.status === "completed"
                                  ? "success"
                                  : row.status === "in-consultation"
                                  ? "primary"
                                  : row.status === "cancelled"
                                  ? "danger"
                                  : "warning"
                              }
                              size="sm"
                              dot
                              className="capitalize text-[11px] font-semibold"
                            >
                              {row.status.replace("-", " ")}
                            </Badge>
                          ),
                        },
                        {
                          key: "actions",
                          header: "Actions",
                          width: "90px",
                          render: (row: any) => (
                            <Dropdown
                              align="right"
                              width="w-44"
                              trigger={
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="h-8 px-2.5 text-xs font-semibold rounded-lg min-h-[36px]"
                                >
                                  Update
                                  <MoreHorizontal className="w-3.5 h-3.5 ml-1" />
                                </Button>
                              }
                              items={[
                                {
                                  label: "Check-In",
                                  icon: <UserCheck className="w-4 h-4 text-primary-500" />,
                                  onClick: () => onUpdateStatus(row.id, "checked-in"),
                                },
                                {
                                  label: "In Consultation",
                                  icon: <PlayCircle className="w-4 h-4 text-sky-500" />,
                                  onClick: () => onUpdateStatus(row.id, "in-consultation"),
                                },
                                {
                                  label: "Complete Visit",
                                  icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
                                  onClick: () => onUpdateStatus(row.id, "completed"),
                                },
                                { divider: true, label: "" },
                                {
                                  label: "Cancel Visit",
                                  icon: <XCircle className="w-4 h-4 text-danger" />,
                                  onClick: () => onUpdateStatus(row.id, "cancelled"),
                                  danger: true,
                                },
                              ]}
                            />
                          ),
                        },
                      ]
                    : [
                        {
                          key: "tokenNumber",
                          header: "Token",
                          width: "80px",
                          render: (row: any) => (
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                              #{String(row.tokenNumber || "—").padStart(2, "0")}
                            </span>
                          ),
                        },
                        {
                          key: "patient",
                          header: "Patient",
                          render: (row: any) => (
                            <span className="font-semibold text-text text-xs sm:text-sm">
                              {row.patientId?.userId?.name || "Self"}
                            </span>
                          ),
                        },
                        {
                          key: "doctor",
                          header: "Doctor",
                          render: (row: any) => (
                            <div className="flex items-center gap-1 text-xs text-text-secondary">
                              <Stethoscope className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              <span>Dr. {row.doctorId?.name || "Physician"}</span>
                            </div>
                          ),
                        },
                        {
                          key: "time",
                          header: "Date & Time",
                          render: (row: any) => (
                            <div className="flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap">
                              <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              <span>
                                {new Date(row.appointmentTime).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                                ,{" "}
                                {new Date(row.appointmentTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          ),
                        },
                        {
                          key: "status",
                          header: "Status",
                          render: (row: any) => (
                            <Badge
                              variant={
                                row.status === "completed"
                                  ? "success"
                                  : row.status === "in-consultation"
                                  ? "primary"
                                  : row.status === "cancelled"
                                  ? "danger"
                                  : "warning"
                              }
                              size="sm"
                              dot
                              className="capitalize text-[11px] font-semibold"
                            >
                              {row.status.replace("-", " ")}
                            </Badge>
                          ),
                        },
                      ]
                }
                data={appointments.slice(0, 5)}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
