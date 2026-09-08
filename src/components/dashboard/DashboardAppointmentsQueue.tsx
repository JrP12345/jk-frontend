"use client";

import React from "react";
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
  const router = useRouter();

  return (
    <Card className="lg:col-span-2 rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
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
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 p-0 hover:bg-transparent"
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
          <div className="overflow-x-auto">
            <Table
              loading={loading}
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
                                className="h-7 px-2 text-xs font-semibold rounded-lg"
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
        )}
      </CardContent>
    </Card>
  );
}
