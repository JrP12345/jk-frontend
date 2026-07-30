"use client";

import React, { useState } from "react";
import { Badge, Button, Modal } from "@/components/ui";

interface AppointmentItem {
  id: string;
  tokenNumber: number;
  appointmentTime: string;
  status: "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled";
  notes?: string;
  patientId?: {
    userId?: { name: string; phone: string; email: string };
  };
  doctorId?: {
    id?: string;
    name: string;
    specialization?: string;
  };
  clinicId?: {
    name: string;
  };
}

interface CalendarProps {
  appointments: AppointmentItem[];
  onSelectAppointment?: (appt: AppointmentItem) => void;
  onRescheduleClick?: (appt: AppointmentItem) => void;
}

export function AppointmentCalendarView({ appointments, onSelectAppointment, onRescheduleClick }: CalendarProps) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedAppt, setSelectedAppt] = useState<AppointmentItem | null>(null);

  // Group appointments by YYYY-MM-DD
  const appointmentsByDate: Record<string, AppointmentItem[]> = {};
  appointments.forEach((appt) => {
    if (!appt.appointmentTime) return;
    const dateKey = new Date(appt.appointmentTime).toISOString().split("T")[0];
    if (!appointmentsByDate[dateKey]) appointmentsByDate[dateKey] = [];
    appointmentsByDate[dateKey].push(appt);
  });

  // Calculate 7 days for current week view
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    start.setDate(diff);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const weekDates = getWeekDates(currentDate);

  const prevPeriod = () => {
    const next = new Date(currentDate);
    if (viewMode === "day") next.setDate(next.getDate() - 1);
    else if (viewMode === "week") next.setDate(next.getDate() - 7);
    else next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const nextPeriod = () => {
    const next = new Date(currentDate);
    if (viewMode === "day") next.setDate(next.getDate() + 1);
    else if (viewMode === "week") next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed": return "success";
      case "checked-in": return "info";
      case "in-consultation": return "warning";
      case "completed": return "default";
      case "cancelled": return "danger";
      default: return "default";
    }
  };

  return (
    <div className="space-y-4 bg-surface p-6 rounded-2xl border border-border">
      {/* Calendar Header & View Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={prevPeriod}>← Prev</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={nextPeriod}>Next →</Button>
          <h2 className="text-lg font-bold text-text ml-2">
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
        </div>

        <div className="flex items-center gap-1 bg-surface-alt p-1 rounded-xl border border-border">
          {(["day", "week", "month"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
                viewMode === mode ? "bg-primary text-white shadow-xs" : "text-text-muted hover:text-text"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Day View */}
      {viewMode === "day" && (
        <div className="bg-surface-alt/40 p-4 rounded-xl border border-border space-y-3 min-h-[300px]">
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-bold text-text text-sm">
              {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </h3>
            <span className="text-xs text-text-muted">
              {(appointmentsByDate[currentDate.toISOString().split("T")[0]] || []).length} Appointments Scheduled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(appointmentsByDate[currentDate.toISOString().split("T")[0]] || []).length === 0 ? (
              <p className="text-xs text-text-muted italic py-8 col-span-full text-center">No appointments scheduled for this day.</p>
            ) : (
              (appointmentsByDate[currentDate.toISOString().split("T")[0]] || []).map((appt) => (
                <div
                  key={appt.id}
                  onClick={() => { setSelectedAppt(appt); if (onSelectAppointment) onSelectAppointment(appt); }}
                  className="p-3 bg-surface rounded-xl border border-border hover:border-primary-500 cursor-pointer transition-all space-y-1.5 shadow-2xs"
                >
                  <div className="flex justify-between items-center font-bold text-text text-xs">
                    <span>Token #{appt.tokenNumber}</span>
                    <span className="text-primary font-semibold">
                      {new Date(appt.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="font-semibold text-text text-sm">{appt.patientId?.userId?.name || "Patient"}</p>
                  <div className="flex justify-between items-center pt-1 border-t border-border/50 text-xs">
                    <Badge variant={getStatusBadgeVariant(appt.status)} className="capitalize">
                      {appt.status}
                    </Badge>
                    <span className="text-text-muted font-medium">Dr. {appt.doctorId?.name}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Week Grid View */}
      {viewMode === "week" && (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((d) => {
            const dateStr = d.toISOString().split("T")[0];
            const isToday = new Date().toISOString().split("T")[0] === dateStr;
            const dayAppts = appointmentsByDate[dateStr] || [];

            return (
              <div
                key={dateStr}
                className={`min-h-[220px] p-2.5 rounded-xl border flex flex-col space-y-2 ${
                  isToday ? "bg-primary-500/10 border-primary-500/40" : "bg-surface-alt/40 border-border/70"
                }`}
              >
                <div className="flex items-center justify-between text-xs border-b border-border/40 pb-1.5">
                  <span className="font-bold text-text">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black ${isToday ? "bg-primary text-white" : "text-text-muted"}`}>
                    {d.getDate()}
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto">
                  {dayAppts.length === 0 ? (
                    <span className="text-[10px] text-text-muted italic block pt-2 text-center">No appointments</span>
                  ) : (
                    dayAppts.map((appt) => (
                      <div
                        key={appt.id}
                        onClick={() => { setSelectedAppt(appt); if (onSelectAppointment) onSelectAppointment(appt); }}
                        className="p-1.5 bg-surface rounded-lg border border-border/80 text-[11px] shadow-2xs hover:border-primary-500 cursor-pointer transition-all space-y-1"
                      >
                        <div className="flex justify-between items-center font-bold text-text">
                          <span>#{appt.tokenNumber}</span>
                          <span className="text-[10px] font-semibold text-primary-600">
                            {new Date(appt.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="font-medium text-text truncate">{appt.patientId?.userId?.name || "Patient"}</p>
                        <div className="flex justify-between items-center">
                          <Badge variant={getStatusBadgeVariant(appt.status)} className="text-[9px] px-1 py-0 capitalize">
                            {appt.status}
                          </Badge>
                          <span className="text-[9px] text-text-muted truncate max-w-[60px]">Dr. {appt.doctorId?.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month View Grid */}
      {viewMode === "month" && (
        <div className="grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
            <div key={dayName} className="text-center font-bold text-xs text-text-muted py-1 border-b border-border">
              {dayName}
            </div>
          ))}
          {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, idx) => {
            const dayNum = idx + 1;
            const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
            const dateStr = d.toISOString().split("T")[0];
            const isToday = new Date().toISOString().split("T")[0] === dateStr;
            const dayAppts = appointmentsByDate[dateStr] || [];

            return (
              <div
                key={dateStr}
                className={`min-h-[90px] p-2 rounded-xl border flex flex-col justify-between ${
                  isToday ? "bg-primary-500/10 border-primary-500/40" : "bg-surface-alt/30 border-border/60"
                }`}
              >
                <div className="flex justify-between items-center text-xs">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${isToday ? "bg-primary text-white" : "text-text"}`}>
                    {dayNum}
                  </span>
                  {dayAppts.length > 0 && (
                    <span className="text-[10px] font-extrabold text-primary-600 bg-primary/10 px-1.5 py-0.2 rounded-full">
                      {dayAppts.length} appt{dayAppts.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayAppts.slice(0, 2).map((appt) => (
                    <div
                      key={appt.id}
                      onClick={() => { setSelectedAppt(appt); if (onSelectAppointment) onSelectAppointment(appt); }}
                      className="text-[10px] p-1 bg-surface rounded border border-border/60 truncate font-semibold cursor-pointer hover:border-primary-500"
                    >
                      #{appt.tokenNumber} {appt.patientId?.userId?.name || "Patient"}
                    </div>
                  ))}
                  {dayAppts.length > 2 && (
                    <span className="text-[9px] text-text-muted font-bold block text-center">+ {dayAppts.length - 2} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Appointment Quick Info Modal */}
      {selectedAppt && (
        <Modal open={!!selectedAppt} onClose={() => setSelectedAppt(null)} title={`Appointment Details #${selectedAppt.tokenNumber}`} size="sm">
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-surface-alt rounded-lg border border-border space-y-1">
              <p className="font-bold text-text text-sm">{selectedAppt.patientId?.userId?.name}</p>
              <p className="text-text-secondary">Phone: {selectedAppt.patientId?.userId?.phone || "N/A"}</p>
              <p className="text-text-secondary">Doctor: Dr. {selectedAppt.doctorId?.name}</p>
              <p className="text-text-secondary">Clinic: {selectedAppt.clinicId?.name}</p>
              <p className="text-text-secondary">Time: {new Date(selectedAppt.appointmentTime).toLocaleString()}</p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Badge variant={getStatusBadgeVariant(selectedAppt.status)} className="capitalize">
                Status: {selectedAppt.status}
              </Badge>
              {onRescheduleClick && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    const target = selectedAppt;
                    setSelectedAppt(null);
                    onRescheduleClick(target);
                  }}
                >
                  🗓️ Reschedule
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
