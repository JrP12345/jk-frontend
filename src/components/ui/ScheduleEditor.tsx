"use client";

import { useState, useEffect, memo } from "react";
import { cn } from "./utils";
import Select from "./Select";
import { Copy, Check, X, Layers } from "lucide-react";

export interface TimeSlot {
  start: string;
  end: string;
}

export type ScheduleData = Record<string, TimeSlot[]>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun"
};

const TIME_OPTIONS = [
  { value: "06:00", label: "06:00 AM" },
  { value: "06:30", label: "06:30 AM" },
  { value: "07:00", label: "07:00 AM" },
  { value: "07:30", label: "07:30 AM" },
  { value: "08:00", label: "08:00 AM" },
  { value: "08:30", label: "08:30 AM" },
  { value: "09:00", label: "09:00 AM" },
  { value: "09:30", label: "09:30 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "10:30", label: "10:30 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "11:30", label: "11:30 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "12:30", label: "12:30 PM" },
  { value: "13:00", label: "01:00 PM" },
  { value: "13:30", label: "01:30 PM" },
  { value: "14:00", label: "02:00 PM" },
  { value: "14:30", label: "02:30 PM" },
  { value: "15:00", label: "03:00 PM" },
  { value: "15:30", label: "03:30 PM" },
  { value: "16:00", label: "04:00 PM" },
  { value: "16:30", label: "04:30 PM" },
  { value: "17:00", label: "05:00 PM" },
  { value: "17:30", label: "05:30 PM" },
  { value: "18:00", label: "06:00 PM" },
  { value: "18:30", label: "06:30 PM" },
  { value: "19:00", label: "07:00 PM" },
  { value: "19:30", label: "07:30 PM" },
  { value: "20:00", label: "08:00 PM" },
  { value: "20:30", label: "08:30 PM" },
  { value: "21:00", label: "09:00 PM" },
  { value: "21:30", label: "09:30 PM" },
  { value: "22:00", label: "10:00 PM" },
  { value: "22:30", label: "10:30 PM" },
  { value: "23:00", label: "11:00 PM" },
  { value: "23:59", label: "11:59 PM (Midnight)" },
];

interface ScheduleEditorProps {
  label?: string;
  value?: string; // JSON string
  onChange: (value: string) => void;
  className?: string;
}

const DEFAULT_SCHEDULE: ScheduleData = {
  Monday: [{ start: "09:00", end: "17:00" }],
  Tuesday: [{ start: "09:00", end: "17:00" }],
  Wednesday: [{ start: "09:00", end: "17:00" }],
  Thursday: [{ start: "09:00", end: "17:00" }],
  Friday: [{ start: "09:00", end: "17:00" }],
};

const ScheduleEditor = memo(function ScheduleEditor({
  label = "Working Days & Operating Hours",
  value = "",
  onChange,
  className,
}: ScheduleEditorProps) {

  const [schedule, setSchedule] = useState<ScheduleData>(() => {
    try {
      const parsed = value ? JSON.parse(value) : null;
      if (parsed && Object.keys(parsed).length > 0) return parsed;
      return DEFAULT_SCHEDULE;
    } catch {
      return DEFAULT_SCHEDULE;
    }
  });

  // Mode: "same" (all open days share 1 time range) vs "custom" (per day custom slots)
  const [mode, setMode] = useState<"same" | "custom">(() => {
    try {
      const parsed = value ? JSON.parse(value) : {};
      const days = Object.keys(parsed);
      if (days.length === 0) return "same";
      const firstSlotStr = JSON.stringify(parsed[days[0]] || []);
      const isAllSame = days.every(d => JSON.stringify(parsed[d]) === firstSlotStr);
      return isAllSame ? "same" : "custom";
    } catch {
      return "same";
    }
  });

  // Common hours state for "same" mode
  const [sameHours, setSameHours] = useState<TimeSlot>(() => {
    try {
      const parsed = value ? JSON.parse(value) : {};
      const firstDay = Object.keys(parsed)[0];
      if (firstDay && parsed[firstDay]?.[0]) {
        return parsed[firstDay][0];
      }
    } catch {}
    return { start: "09:00", end: "17:00" };
  });

  // Active days list for "same" mode
  const [sameActiveDays, setSameActiveDays] = useState<string[]>(() => {
    try {
      const parsed = value ? JSON.parse(value) : {};
      const days = Object.keys(parsed);
      return days.length > 0 ? days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    } catch {
      return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    }
  });

  // Sync state changes to parent JSON string
  useEffect(() => {
    onChange(JSON.stringify(schedule));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  // Update schedule when sameMode hours or days change
  const applySameModeSchedule = (days: string[], hours: TimeSlot) => {
    const next: ScheduleData = {};
    days.forEach((day) => {
      next[day] = [{ ...hours }];
    });
    setSchedule(next);
  };

  const toggleSameDay = (day: string) => {
    const nextDays = sameActiveDays.includes(day)
      ? sameActiveDays.filter((d) => d !== day)
      : [...sameActiveDays, day];
    
    const sorted = DAYS.filter((d) => nextDays.includes(d));
    setSameActiveDays(sorted);
    applySameModeSchedule(sorted, sameHours);
  };

  const updateSameHours = (field: "start" | "end", val: string) => {
    const nextHours = { ...sameHours, [field]: val };
    setSameHours(nextHours);
    applySameModeSchedule(sameActiveDays, nextHours);
  };

  // Custom mode handlers
  const toggleCustomDay = (day: string, isChecked: boolean) => {
    setSchedule((prev) => {
      const next = { ...prev };
      if (isChecked) {
        next[day] = [{ start: "09:00", end: "17:00" }];
      } else {
        delete next[day];
      }
      return next;
    });
  };

  const updateCustomSlot = (day: string, index: number, field: "start" | "end", val: string) => {
    setSchedule((prev) => {
      const next = { ...prev };
      next[day] = [...next[day]];
      next[day][index] = { ...next[day][index], [field]: val };
      return next;
    });
  };

  const addCustomSlot = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: "09:00", end: "17:00" }]
    }));
  };

  const removeCustomSlot = (day: string, index: number) => {
    setSchedule((prev) => {
      const next = { ...prev };
      next[day] = next[day].filter((_, i) => i !== index);
      if (next[day].length === 0) {
        delete next[day];
      }
      return next;
    });
  };

  const switchToCustomMode = () => {
    setMode("custom");
  };

  const switchToSameMode = () => {
    setMode("same");
    applySameModeSchedule(sameActiveDays, sameHours);
  };

  // Clone schedule state for custom mode
  const [cloningDay, setCloningDay] = useState<string | null>(null);
  const [selectedTargetDays, setSelectedTargetDays] = useState<string[]>([]);
  const [cloneFeedback, setCloneFeedback] = useState<{ day: string; msg: string } | null>(null);

  const cloneSchedule = (sourceDay: string, targets: string[]) => {
    const sourceSlots = schedule[sourceDay];
    if (!sourceSlots || sourceSlots.length === 0 || targets.length === 0) return;

    setSchedule((prev) => {
      const next = { ...prev };
      targets.forEach((targetDay) => {
        next[targetDay] = sourceSlots.map((slot) => ({ ...slot }));
      });
      return next;
    });

    setCloneFeedback({
      day: sourceDay,
      msg: `Copied to ${targets.length} day${targets.length > 1 ? "s" : ""}`
    });
    setTimeout(() => setCloneFeedback(null), 3500);
    setCloningDay(null);
    setSelectedTargetDays([]);
  };

  const copyToAllActiveDays = (sourceDay: string) => {
    const targets = DAYS.filter((d) => d !== sourceDay && !!schedule[d]);
    cloneSchedule(sourceDay, targets);
  };

  const copyToWeekdays = (sourceDay: string) => {
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const targets = weekdays.filter((d) => d !== sourceDay);
    cloneSchedule(sourceDay, targets);
  };

  const copyToAllDays = (sourceDay: string) => {
    const targets = DAYS.filter((d) => d !== sourceDay);
    cloneSchedule(sourceDay, targets);
  };

  return (
    <div className={cn("space-y-3 w-full font-sans", className)}>
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface p-3 border border-border rounded-xl shadow-2xs">
        <div>
          {label && <label className="text-xs font-bold text-text block">{label}</label>}
          <p className="text-[11px] text-text-muted mt-0.5">Configure clinic working hours & active operating days</p>
        </div>

        <div className="flex bg-surface-alt p-1 rounded-lg border border-border gap-1 shrink-0">
          <button
            type="button"
            onClick={switchToSameMode}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
              mode === "same"
                ? "bg-primary-600 text-white shadow-xs"
                : "text-text-muted hover:text-text"
            )}
          >
            Standard Hours
          </button>
          <button
            type="button"
            onClick={switchToCustomMode}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer",
              mode === "custom"
                ? "bg-primary-600 text-white shadow-xs"
                : "text-text-muted hover:text-text"
            )}
          >
            Custom Per Day
          </button>
        </div>
      </div>

      {/* MODE 1: STANDARD HOURS (DEFAULT & CLEANEST) */}
      {mode === "same" && (
        <div className="p-4 bg-surface border border-border rounded-xl space-y-4 shadow-2xs">
          {/* Day Selector Chips */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-2">
              1. Select Active Working Days
            </span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const isSelected = sameActiveDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleSameDay(day)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                      isSelected
                        ? "bg-primary-50 dark:bg-primary-950/40 text-primary-600 border-primary-500/50 shadow-2xs"
                        : "bg-surface-alt text-text-muted border-border/80 hover:border-text-muted hover:text-text"
                    )}
                  >
                    {DAY_ABBR[day]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Time Select Bar */}
          <div className="border-t border-border/60 pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-2">
              2. Working Shift Hours
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-[140px]">
                <span className="text-[10px] font-semibold text-text-muted block mb-1">Opening Time</span>
                <Select
                  size="sm"
                  value={sameHours.start}
                  onChange={(e) => updateSameHours("start", e.target.value)}
                  options={TIME_OPTIONS}
                />
              </div>

              <span className="text-text-muted text-xs font-bold pt-4 text-center select-none shrink-0">&ndash; to &ndash;</span>

              <div className="flex-1 min-w-[140px]">
                <span className="text-[10px] font-semibold text-text-muted block mb-1">Closing Time</span>
                <Select
                  size="sm"
                  value={sameHours.end}
                  onChange={(e) => updateSameHours("end", e.target.value)}
                  options={TIME_OPTIONS}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: CUSTOM PER DAY */}
      {mode === "custom" && (
        <div className="border border-border rounded-xl bg-surface shadow-2xs overflow-hidden">
          {/* Custom Mode Quick Header */}
          <div className="px-3 py-2 bg-surface-alt/70 border-b border-border/70 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary-500" />
              Custom Per-Day Shifts
            </span>
            <span className="text-[11px] text-text-muted hidden sm:inline">
              Configure any day, then click <strong className="text-primary-600 font-semibold">Clone</strong> to copy its shifts to other days
            </span>
          </div>

          <div className="divide-y divide-border/60 max-h-96 overflow-y-auto p-1">
            {DAYS.map((day) => {
              const isActive = !!schedule[day];
              const slots = schedule[day] || [];
              const isCloningThis = cloningDay === day;

              return (
                <div
                  key={day}
                  className={cn(
                    "transition-all rounded-lg my-0.5 border",
                    isCloningThis
                      ? "border-primary-500/40 bg-surface shadow-xs"
                      : isActive
                      ? "border-transparent bg-surface"
                      : "border-transparent bg-surface-alt/40"
                  )}
                >
                  <div className="p-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 w-32 shrink-0">
                      <input
                        type="checkbox"
                        id={`custom-${day}`}
                        checked={isActive}
                        onChange={(e) => toggleCustomDay(day, e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                      <label htmlFor={`custom-${day}`} className="text-xs font-bold text-text cursor-pointer select-none">
                        {day}
                      </label>
                    </div>

                    {isActive ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                        {slots.map((slot, index) => (
                          <div key={index} className="flex items-center gap-1.5 bg-surface-alt border border-border/80 p-1.5 rounded-lg">
                            <Select
                              size="sm"
                              value={slot.start}
                              onChange={(e) => updateCustomSlot(day, index, "start", e.target.value)}
                              options={TIME_OPTIONS}
                              className="w-28 text-xs font-mono font-bold"
                            />
                            <span className="text-text-muted text-[10px] font-medium">&ndash;</span>
                            <Select
                              size="sm"
                              value={slot.end}
                              onChange={(e) => updateCustomSlot(day, index, "end", e.target.value)}
                              options={TIME_OPTIONS}
                              className="w-28 text-xs font-mono font-bold"
                            />

                            {slots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCustomSlot(day, index)}
                                className="text-text-muted hover:text-red-500 p-1 rounded cursor-pointer"
                                title="Remove shift"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addCustomSlot(day)}
                          className="text-[11px] font-bold text-primary-600 hover:text-primary-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          + Shift
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isCloningThis) {
                              setCloningDay(null);
                            } else {
                              setCloningDay(day);
                              const activeTargets = DAYS.filter((d) => d !== day && !!schedule[d]);
                              setSelectedTargetDays(activeTargets);
                            }
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer border shadow-2xs",
                            isCloningThis
                              ? "bg-primary-600 text-white border-primary-600 shadow-xs"
                              : "text-text-muted hover:text-primary-600 bg-surface-alt hover:bg-primary-50 dark:hover:bg-primary-950/40 border-border/80 hover:border-primary-500/40"
                          )}
                          title={`Clone ${day}'s working shifts to other days`}
                        >
                          <Copy className="w-3 h-3" />
                          <span>Clone</span>
                        </button>

                        {cloneFeedback?.day === day && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md animate-fade-in">
                            <Check className="w-3 h-3" />
                            {cloneFeedback.msg}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-text-muted bg-surface-alt px-2 py-0.5 rounded-md border border-border/50">
                        Closed
                      </span>
                    )}
                  </div>

                  {/* Inline Clone Expandable Drawer */}
                  {isCloningThis && isActive && (
                    <div className="p-3 bg-primary-50/40 dark:bg-primary-950/30 border-t border-primary-500/20 rounded-b-lg space-y-2.5 animate-fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Copy className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                          <span className="text-xs font-bold text-text">
                            Clone {day}&apos;s schedule ({slots.length} shift{slots.length > 1 ? "s" : ""}) to other days:
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCloningDay(null)}
                          className="p-1 text-text-muted hover:text-text rounded-md cursor-pointer text-xs"
                          aria-label="Close clone drawer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Quick Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mr-1">Quick Apply:</span>
                        <button
                          type="button"
                          onClick={() => copyToAllActiveDays(day)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-border hover:border-primary-500 text-text hover:text-primary-600 cursor-pointer transition-colors shadow-2xs"
                        >
                          All Active Days
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToWeekdays(day)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-border hover:border-primary-500 text-text hover:text-primary-600 cursor-pointer transition-colors shadow-2xs"
                        >
                          Mon – Fri (Weekdays)
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToAllDays(day)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-border hover:border-primary-500 text-text hover:text-primary-600 cursor-pointer transition-colors shadow-2xs"
                        >
                          All 7 Days (Mon – Sun)
                        </button>
                      </div>

                      {/* Specific Day Chips */}
                      <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mr-1">Or Pick:</span>
                          {DAYS.filter((d) => d !== day).map((targetDay) => {
                            const isSelected = selectedTargetDays.includes(targetDay);
                            return (
                              <button
                                key={targetDay}
                                type="button"
                                onClick={() => {
                                  setSelectedTargetDays((prev) =>
                                    prev.includes(targetDay) ? prev.filter((d) => d !== targetDay) : [...prev, targetDay]
                                  );
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer",
                                  isSelected
                                    ? "bg-primary-600 text-white border-primary-600 shadow-2xs"
                                    : "bg-surface text-text-muted border-border hover:border-text-muted hover:text-text"
                                )}
                              >
                                {DAY_ABBR[targetDay]}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          disabled={selectedTargetDays.length === 0}
                          onClick={() => cloneSchedule(day, selectedTargetDays)}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5",
                            selectedTargetDays.length > 0
                              ? "bg-primary-600 hover:bg-primary-700 text-white"
                              : "bg-surface-alt text-text-muted border border-border cursor-not-allowed opacity-60"
                          )}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Apply to {selectedTargetDays.length} Day{selectedTargetDays.length > 1 ? "s" : ""}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default ScheduleEditor;

