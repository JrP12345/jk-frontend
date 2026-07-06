"use client";

import { useState, useEffect } from "react";
import { cn } from "./utils";
import Button from "./Button";
import Checkbox from "./Checkbox";

export interface TimeSlot {
  start: string;
  end: string;
}

export type ScheduleData = Record<string, TimeSlot[]>;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface ScheduleEditorProps {
  label?: string;
  value?: string; // JSON string
  onChange: (value: string) => void;
  className?: string;
}

export default function ScheduleEditor({
  label,
  value,
  onChange,
  className,
}: ScheduleEditorProps) {
  const [schedule, setSchedule] = useState<ScheduleData>(() => {
    try {
      return value ? JSON.parse(value) : {};
    } catch {
      return {};
    }
  });

  const [copySource, setCopySource] = useState<string | null>(null);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);

  // Sync to parent
  useEffect(() => {
    onChange(JSON.stringify(schedule));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  const toggleDay = (day: string, isChecked: boolean) => {
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

  const addSlot = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: "09:00", end: "17:00" }]
    }));
  };

  const updateSlot = (day: string, index: number, field: "start" | "end", val: string) => {
    setSchedule((prev) => {
      const next = { ...prev };
      next[day] = [...next[day]];
      next[day][index] = { ...next[day][index], [field]: val };
      return next;
    });
  };

  const removeSlot = (day: string, index: number) => {
    setSchedule((prev) => {
      const next = { ...prev };
      next[day] = next[day].filter((_, i) => i !== index);
      if (next[day].length === 0) {
        delete next[day];
      }
      return next;
    });
  };

  const applyCopyTo = (sourceDay: string) => {
    setSchedule((prev) => {
      const next = { ...prev };
      const sourceSlots = prev[sourceDay] || [];
      copyTargets.forEach((targetDay) => {
        if (sourceSlots.length > 0) {
          next[targetDay] = sourceSlots.map((s) => ({ ...s }));
        } else {
          delete next[targetDay];
        }
      });
      return next;
    });
    setCopySource(null);
    setCopyTargets([]);
  };

  return (
    <div className={cn("flex flex-col gap-1.5 w-full", className)}>
      {label && <label className="text-sm font-medium text-text">{label}</label>}
      <div className="relative border border-border rounded-2xl bg-surface divide-y divide-border shadow-sm">
        {DAYS.map((day, idx) => {
          const isActive = !!schedule[day];
          const slots = schedule[day] || [];
          const isFirst = idx === 0;
          const isLast = idx === DAYS.length - 1;

          return (
            <div
              key={day}
              className={cn(
                "flex flex-col sm:flex-row sm:items-start p-4 gap-4 hover:bg-surface-hover/30 transition-colors relative",
                isFirst && "rounded-t-2xl",
                isLast && "rounded-b-2xl"
              )}
            >
              <div className="w-32 pt-1 flex-shrink-0">
                <Checkbox
                  label={day}
                  checked={isActive}
                  onChange={(e) => toggleDay(day, e.target.checked)}
                />
              </div>

              {isActive && (
                <div className="flex flex-col gap-2.5 flex-grow">
                  {slots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-2 animate-scale-in">
                      <div className="relative flex items-center">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) => updateSlot(day, index, "start", e.target.value)}
                          className="bg-surface-alt border border-border rounded-lg p-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all duration-200 w-28 text-center"
                        />
                      </div>
                      <span className="text-text-muted text-xs font-semibold select-none px-1">to</span>
                      <div className="relative flex items-center">
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) => updateSlot(day, index, "end", e.target.value)}
                          className="bg-surface-alt border border-border rounded-lg p-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all duration-200 w-28 text-center"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSlot(day, index)}
                        className="p-2 text-text-muted hover:text-danger-500 rounded-lg hover:bg-surface-hover active:scale-75 transition-all duration-200 ml-1 cursor-pointer"
                        title="Remove slot"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addSlot(day)}
                      className="text-primary-600 hover:text-primary-700 hover:bg-primary-50/50 dark:text-primary-400 dark:hover:bg-primary-950/20"
                    >
                      + Add Time Slot
                    </Button>
                    <span className="text-border text-xs">|</span>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCopySource(day);
                          setCopyTargets([]);
                        }}
                        className="text-text-secondary hover:text-text hover:bg-surface-hover"
                      >
                        Copy to...
                      </Button>
                      
                      {copySource === day && (
                        <div className="absolute left-0 bottom-full sm:bottom-auto sm:top-full z-30 mt-2 p-4 bg-surface border border-border rounded-2xl shadow-xl animate-scale-in flex flex-col gap-3 min-w-[240px]">
                          <span className="text-xs font-semibold text-text-secondary">Copy slots to:</span>
                          <div className="grid grid-cols-2 gap-2">
                            {DAYS.filter((d) => d !== day).map((d) => (
                              <Checkbox
                                key={d}
                                label={d}
                                checked={copyTargets.includes(d)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCopyTargets((prev) => [...prev, d]);
                                  } else {
                                    setCopyTargets((prev) => prev.filter((x) => x !== d));
                                  }
                                }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-border">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCopySource(null);
                                setCopyTargets([]);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => applyCopyTo(day)}
                            >
                              Apply
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

