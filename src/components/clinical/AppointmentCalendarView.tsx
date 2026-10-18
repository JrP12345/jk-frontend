"use client";

import { useState, useEffect, useRef } from "react";
import { Badge, Button, Spinner } from "@/components/ui";

import Modal from "@/components/queue/QueueDialog";
import { locationDateKey } from "@/lib/locationTime";
import { patientName, patientPhone } from "@/lib/locationWorkflow";
import styles from "./AppointmentCalendarView.module.css";

interface AppointmentItem {
  id: string;
  tokenNumber: number;
  appointmentTime: string;
  status: "pending" | "confirmed" | "checked-in" | "in-consultation" | "completed" | "cancelled";
  notes?: string;
  patientId?: {
    name?: string;
    phone?: string;
    userId?: { name: string; phone: string; email: string };
  };
  doctorId?: {
    id?: string;
    name: string;
    specialization?: string;
  };
  locationId?: {
    name: string;
  };
}

interface CalendarProps {
  appointments: AppointmentItem[];
  onSelectAppointment?: (appt: AppointmentItem) => void;
  onRescheduleClick?: (appt: AppointmentItem) => void;
  initialDate?: string;
  timeZone?: string;
  onRangeChange?: (start: string, end: string) => void;
  loading?: boolean;
  canReschedule?: boolean;
}

export function AppointmentCalendarView({ appointments, onSelectAppointment, onRescheduleClick, initialDate, timeZone, onRangeChange, loading = false, canReschedule = true }: CalendarProps) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">(() => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches ? "day" : "week");
  const [currentDate, setCurrentDate] = useState<Date>(() => initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? new Date(initialDate + "T12:00:00") : new Date());
  const [selectedAppt, setSelectedAppt] = useState<AppointmentItem | null>(null);
  const getLocalDateKey = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const rangeCallback = useRef(onRangeChange);
  useEffect(() => { rangeCallback.current = onRangeChange; }, [onRangeChange]);
  useEffect(() => {
    const start = new Date(currentDate), end = new Date(currentDate);
    if (viewMode === "week") { start.setDate(start.getDate() - (start.getDay() + 6) % 7); end.setTime(start.getTime()); end.setDate(end.getDate() + 6); }
    else if (viewMode === "month") { start.setDate(1); end.setMonth(end.getMonth() + 1, 0); }
    rangeCallback.current?.(getLocalDateKey(start), getLocalDateKey(end));
  }, [currentDate, viewMode]);

  // Group appointments by YYYY-MM-DD in local time
  const appointmentsByDate: Record<string, AppointmentItem[]> = {};
  [...appointments].sort((a, b) => Date.parse(a.appointmentTime) - Date.parse(b.appointmentTime)).forEach((appt) => {
    if (!appt.appointmentTime) return;
    const dateKey = timeZone ? locationDateKey(new Date(appt.appointmentTime), timeZone) : getLocalDateKey(new Date(appt.appointmentTime));
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
    else { next.setDate(1); next.setMonth(next.getMonth() - 1); }
    setCurrentDate(next);
  };

  const nextPeriod = () => {
    const next = new Date(currentDate);
    if (viewMode === "day") next.setDate(next.getDate() + 1);
    else if (viewMode === "week") next.setDate(next.getDate() + 7);
    else { next.setDate(1); next.setMonth(next.getMonth() + 1); }
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
    <div className={styles.calendar} aria-busy={loading} aria-label="Appointment calendar">
      {/* Calendar Header & View Switcher */}
      <div className={styles.header}>
        <div className={styles.navigation}>
          <Button variant="outline" size="sm" onClick={prevPeriod}>← Prev</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={nextPeriod}>Next →</Button>
          <h2 className={styles.periodTitle}>
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
        </div>

        <div className={styles.modes}>
          {(["day", "week", "month"] as const).map((mode) => (
            <Button
              variant={viewMode === mode ? "primary" : "ghost"}
              size="sm"
              aria-pressed={viewMode === mode}
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`min-h-11 px-3 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
                viewMode === mode ? "bg-primary text-brand-mist shadow-xs" : "text-text-muted hover:text-text"
              }`}
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      <div className={styles.loadingLine}>{loading && <span role="status"><Spinner size="sm" /> Updating schedule...</span>}</div>
      {/* Day View */}
      {viewMode === "day" && (
        <div className="bg-surface-alt/40 p-3 rounded-xl border border-border space-y-3 min-h-[300px]">
          <div className="flex flex-wrap gap-2 justify-between items-center border-b border-border pb-2">
            <h3 className="font-bold text-text text-sm">
              {currentDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </h3>
            <span className="text-xs text-text-muted">
              {loading ? "Loading..." : (appointmentsByDate[getLocalDateKey(currentDate)] || []).length + " visits"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(appointmentsByDate[getLocalDateKey(currentDate)] || []).length === 0 ? (
              <p className="text-xs text-text-muted italic py-8 col-span-full text-center">{loading ? "Loading appointments..." : "No appointments scheduled for this day."}</p>
            ) : (
              (appointmentsByDate[getLocalDateKey(currentDate)] || []).map((appt) => (
                <button
                  type="button"
                  key={appt.id}
                  onClick={() => { setSelectedAppt(appt); if (onSelectAppointment) onSelectAppointment(appt); }}
                  className="w-full text-left p-3 bg-surface rounded-xl border border-border hover:border-primary-500 cursor-pointer transition-all space-y-1.5 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <div className="flex justify-between items-center font-bold text-text text-xs">
                    <span>Token #{appt.tokenNumber}</span>
                    <span className="text-accent font-semibold">
                      {new Date(appt.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone })}
                    </span>
                  </div>
                  <p className="font-semibold text-text text-sm">{patientName(appt.patientId)}</p>
                  <div className="flex justify-between items-center pt-1 border-t border-border/50 text-xs">
                    <Badge variant={getStatusBadgeVariant(appt.status)} className="capitalize">
                      {appt.status}
                    </Badge>
                    <span className="text-text-muted font-medium">Dr. {appt.doctorId?.name?.replace(/^dr\.?\s+/i, "")}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Week Grid View */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 min-[1280px]:grid-cols-7 gap-2">
          {weekDates.map((d) => {
            const dateStr = getLocalDateKey(d);
            const isToday = getLocalDateKey(new Date()) === dateStr;
            const dayAppts = appointmentsByDate[dateStr] || [];

            return (
              <div
                key={dateStr}
                className={`min-h-[140px] p-2.5 rounded-xl border flex flex-col space-y-2 ${
                  isToday ? "bg-primary-500/10 border-primary-500/40" : "bg-surface-alt/40 border-border/70"
                }`}
              >
                <div className="flex items-center justify-between text-xs border-b border-border/40 pb-1.5">
                  <span className="font-bold text-text">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black ${isToday ? "bg-primary text-brand-mist" : "text-text-muted"}`}>
                    {d.getDate()}
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto">
                  {dayAppts.length === 0 ? (
                    <span className="text-[10px] text-text-muted italic block pt-2 text-center">No appointments</span>
                  ) : (
                    dayAppts.map((appt) => (
                      <button
                        type="button"
                        key={appt.id}
                        onClick={() => { setSelectedAppt(appt); if (onSelectAppointment) onSelectAppointment(appt); }}
                        className="w-full text-left p-1.5 bg-surface rounded-lg border border-border/80 text-[11px] shadow-2xs hover:border-primary-500 cursor-pointer transition-all space-y-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
                      >
                        <div className="flex justify-between items-center font-bold text-text">
                          <span>#{appt.tokenNumber}</span>
                          <span className="text-[10px] font-semibold text-accent">
                            {new Date(appt.appointmentTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone })}
                          </span>
                        </div>
                        <p className="font-medium text-text truncate">{patientName(appt.patientId)}</p>
                        <div className="flex justify-between items-center">
                          <Badge variant={getStatusBadgeVariant(appt.status)} className="text-[9px] px-1 py-0 capitalize">
                            {appt.status}
                          </Badge>
                          <span className="text-[9px] text-text-muted truncate max-w-[60px]">Dr. {appt.doctorId?.name?.replace(/^dr\.?\s+/i, "")}</span>
                        </div>
                      </button>
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
        <div className={styles.month}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
            <div key={dayName} className="text-center font-bold text-xs text-text-muted py-1 border-b border-border">
              {dayName}
            </div>
          ))}
          {Array.from({ length: (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, index) => <div key={`offset-${index}`} aria-hidden="true" />)}
          {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, idx) => {
            const dayNum = idx + 1;
            const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
            const dateStr = getLocalDateKey(d);
            const isToday = getLocalDateKey(new Date()) === dateStr;
            const dayAppts = appointmentsByDate[dateStr] || [];

            return (
              <div
                key={dateStr}
                data-calendar-day={dateStr}
                className={`min-h-[70px] sm:min-h-[90px] p-1 sm:p-2 rounded-lg sm:rounded-xl border flex flex-col justify-between min-w-0 ${
                  isToday ? "bg-primary-500/10 border-primary-500/40" : "bg-surface-alt/30 border-border/60"
                }`}
              >
                <div className="flex flex-wrap gap-1 justify-between items-center text-xs">
                  <button type="button" className={styles.monthDate} aria-label={d.toLocaleDateString("en-US", { month: "long", day: "numeric" }) + ", " + dayAppts.length + " visits. Open day"} onClick={() => { setCurrentDate(d); setViewMode("day"); }}>{dayNum}</button>
                  {dayAppts.length > 0 && (
                    <span className="text-[10px] font-extrabold text-accent bg-primary/10 px-1.5 py-0.2 rounded-full">
                      {dayAppts.length}<span className="hidden sm:inline"> appt{dayAppts.length > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </div>

                <div className={styles.monthEvents}>
                  {dayAppts.slice(0, 2).map((appt) => (
                    <button
                      type="button"
                      key={appt.id}
                      onClick={() => { setSelectedAppt(appt); if (onSelectAppointment) onSelectAppointment(appt); }}
                      className="w-full text-left text-[10px] p-1 bg-surface rounded border border-border/60 truncate font-semibold cursor-pointer hover:border-primary-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
                    >
                      #{appt.tokenNumber} {patientName(appt.patientId)}
                    </button>
                  ))}
                  {dayAppts.length > 2 && (
                    <button type="button" onClick={() => { setCurrentDate(d); setViewMode("day"); }} className="text-xs text-accent min-h-11 w-full">+ {dayAppts.length - 2} more</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Appointment Quick Info Modal */}
      {selectedAppt && (
        <Modal open={!!selectedAppt} onClose={() => setSelectedAppt(null)} title={`Appointment #${selectedAppt.tokenNumber}`} size="sm" footer={onRescheduleClick && canReschedule && !["completed", "cancelled", "no-show"].includes(selectedAppt.status) ? <Button variant="outline" onClick={() => { const target = selectedAppt; setSelectedAppt(null); onRescheduleClick(target); }}>Reschedule appointment</Button> : <Button variant="outline" onClick={() => setSelectedAppt(null)}>Done</Button>}>
          <div className={styles.details}>
            <div className="p-3 bg-surface-alt rounded-lg border border-border space-y-1">
              <p className="font-bold text-text text-sm">{patientName(selectedAppt.patientId)}</p>
              <p className="text-text-secondary">Phone: {patientPhone(selectedAppt.patientId) || "Not recorded"}</p>
              <p className="text-text-secondary">Doctor: Dr. {selectedAppt.doctorId?.name}</p>
              <p className="text-text-secondary">Location: {selectedAppt.locationId?.name}</p>
              <p className="text-text-secondary">Time: {new Date(selectedAppt.appointmentTime).toLocaleString(undefined, { timeZone })}</p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Badge variant={getStatusBadgeVariant(selectedAppt.status)} className="capitalize">
                Status: {selectedAppt.status}
              </Badge>

            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
