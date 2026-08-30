"use client";

import { type ReactNode, forwardRef, useId, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

export type DatePickerVariant = "outline" | "filled" | "ghost" | "danger";
export type DatePickerSize = "sm" | "md" | "lg";
export type DatePickerMode = "date" | "datetime" | "range";

export interface DateRangeValue {
  startDate: string;
  endDate: string;
}

export interface DatePickerProps {
  label?: string;
  error?: string;
  hint?: string;
  size?: DatePickerSize;
  variant?: DatePickerVariant;
  mode?: DatePickerMode;
  value?: string;
  startDate?: string;
  endDate?: string;
  onChange?: (value: string | { target: { name?: string; value: string } }) => void;
  onRangeChange?: (range: DateRangeValue) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  minDate?: string | Date;
  maxDate?: string | Date;
  disabled?: boolean;
  isClearable?: boolean;
  fullWidth?: boolean;
  className?: string;
  icon?: ReactNode;
  showPresets?: boolean;
}

const triggerSizes: Record<DatePickerSize, string> = {
  sm: "h-8 text-xs px-3 rounded-md gap-1.5",
  md: "h-9 text-sm px-3.5 rounded-lg gap-2",
  lg: "h-11 text-base px-4 rounded-xl gap-2.5",
};

const variantStyles: Record<DatePickerVariant, string> = {
  outline: "border border-border bg-surface text-text hover:border-text-secondary focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15",
  filled: "border border-transparent bg-surface-alt text-text hover:bg-surface-hover focus:bg-surface focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15",
  ghost: "border border-transparent bg-transparent text-text hover:bg-surface-hover focus:bg-surface focus:border-primary-500",
  danger: "border border-danger-500 bg-surface text-text focus:ring-2 focus:ring-danger-500/15 focus:border-danger-500",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseISOValue(valStr?: string, mode: DatePickerMode = "date"): { dateObj: Date | null; timeStr: string } {
  if (!valStr) return { dateObj: null, timeStr: "09:00" };

  try {
    if (mode === "datetime" && valStr.includes("T")) {
      const parts = valStr.split("T");
      const d = new Date(parts[0] + "T00:00:00");
      return {
        dateObj: isNaN(d.getTime()) ? null : d,
        timeStr: parts[1].slice(0, 5) || "09:00",
      };
    }

    const d = new Date(valStr.length === 10 ? valStr + "T00:00:00" : valStr);
    return {
      dateObj: isNaN(d.getTime()) ? null : d,
      timeStr: "09:00",
    };
  } catch {
    return { dateObj: null, timeStr: "09:00" };
  }
}

function formatDateISO(date: Date | null, timeStr: string = "09:00", mode: DatePickerMode = "date"): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateFormatted = `${year}-${month}-${day}`;

  if (mode === "datetime") {
    return `${dateFormatted}T${timeStr}`;
  }
  return dateFormatted;
}

function formatShortDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseInitialRange(val?: string, startProp?: string, endProp?: string): { start: Date | null; end: Date | null } {
  let s: Date | null = startProp ? new Date(startProp + (startProp.includes("T") ? "" : "T00:00:00")) : null;
  let e: Date | null = endProp ? new Date(endProp + (endProp.includes("T") ? "" : "T00:00:00")) : null;

  if (!s && !e && val) {
    if (val.includes(" to ")) {
      const parts = val.split(" to ");
      if (parts[0]) {
        const d0 = new Date(parts[0] + "T00:00:00");
        if (!isNaN(d0.getTime())) s = d0;
      }
      if (parts[1]) {
        const d1 = new Date(parts[1] + "T00:00:00");
        if (!isNaN(d1.getTime())) e = d1;
      }
    } else {
      const parsed = new Date(val.length === 10 ? val + "T00:00:00" : val);
      if (!isNaN(parsed.getTime())) {
        s = parsed;
        e = parsed;
      }
    }
  }

  return { start: s, end: e };
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({
    label,
    error,
    hint,
    size = "md",
    variant = "outline",
    mode = "date",
    value: controlledValue,
    startDate: propStartDate,
    endDate: propEndDate,
    onChange,
    onRangeChange,
    name,
    id: propId,
    placeholder,
    minDate,
    maxDate,
    disabled = false,
    isClearable = true,
    fullWidth = true,
    className = "",
    icon,
    showPresets: showPresetsProp,
  }, ref) => {
    const autoId = useId();
    const id = propId || autoId;
    const buttonRef = useRef<HTMLButtonElement>(null);

    const renderPresets = showPresetsProp ?? (mode === "range");

    const [isOpen, setIsOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [alignRight, setAlignRight] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; right: number } | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    // Mode single/datetime states
    const initialParsed = parseISOValue(controlledValue, mode);
    const initialRange = parseInitialRange(controlledValue, propStartDate, propEndDate);

    const [selectedDate, setSelectedDate] = useState<Date | null>(initialParsed.dateObj);
    const [selectedTime, setSelectedTime] = useState<string>(initialParsed.timeStr);

    // Mode range states
    const [rangeStart, setRangeStart] = useState<Date | null>(initialRange.start);
    const [rangeEnd, setRangeEnd] = useState<Date | null>(initialRange.end);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    // Navigation Viewport Date & View Mode (days, months, years)
    const [viewDate, setViewDate] = useState<Date>(
      initialParsed.dateObj || initialRange.start || new Date()
    );
    const [viewMode, setViewMode] = useState<"days" | "months" | "years">("days");
    const [timeScreenOpen, setTimeScreenOpen] = useState(false);

    const hourColRef = useRef<HTMLDivElement>(null);
    const minColRef = useRef<HTMLDivElement>(null);
    const periodColRef = useRef<HTMLDivElement>(null);

    // Initial position centering when time screen opens
    useEffect(() => {
      if (timeScreenOpen) {
        const timer = setTimeout(() => {
          const [hStr, mStr] = (selectedTime || "09:00").split(":");
          const h24 = parseInt(hStr || "9", 10);
          const mins = parseInt(mStr || "0", 10);
          const isPM = h24 >= 12;
          const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

          if (hourColRef.current) {
            hourColRef.current.scrollTop = (h12 - 1) * 36;
          }
          if (minColRef.current) {
            const minOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
            const minIdx = minOptions.findIndex((m) => Math.abs(mins - m) < 3);
            if (minIdx !== -1) minColRef.current.scrollTop = minIdx * 36;
          }
          if (periodColRef.current) {
            periodColRef.current.scrollTop = (isPM ? 1 : 0) * 36;
          }
        }, 30);
        return () => clearTimeout(timer);
      }
    }, [timeScreenOpen]);

    // Sync controlled props
    useEffect(() => {
      if (mode === "range") {
        const r = parseInitialRange(controlledValue, propStartDate, propEndDate);
        setRangeStart(r.start);
        setRangeEnd(r.end);
        if (r.start) setViewDate(r.start);
      } else {
        const parsed = parseISOValue(controlledValue, mode);
        setSelectedDate(parsed.dateObj);
        setSelectedTime(parsed.timeStr);
        if (parsed.dateObj) setViewDate(parsed.dateObj);
      }
    }, [controlledValue, propStartDate, propEndDate, mode]);

    const updateCoords = useCallback(() => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceRight = window.innerWidth - rect.left;
        
        const isUpward = spaceBelow < 340;
        const isRightAlign = spaceRight < 300;

        setOpenUpward(isUpward);
        setAlignRight(isRightAlign);
        setCoords({
          top: isUpward ? rect.top : rect.bottom,
          left: rect.left,
          right: window.innerWidth - rect.right,
        });
      }
    }, []);

    const handleToggle = () => {
      if (disabled) return;
      if (!isOpen) {
        updateCoords();
      }
      setIsOpen(!isOpen);
    };

    // Click outside listener & scroll
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
        const portalEl = document.getElementById(`datepicker-portal-${id}`);
        if (portalEl && portalEl.contains(e.target as Node)) return;
        setIsOpen(false);
      };

      const onScroll = (e: Event) => {
        const portalEl = document.getElementById(`datepicker-portal-${id}`);
        if (portalEl && portalEl.contains(e.target as Node)) return;
        if (buttonRef.current && buttonRef.current.contains(e.target as Node)) return;
        updateCoords();
      };

      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", onScroll, { capture: true });
      };
    }, [isOpen, id, updateCoords]);

    // Escape key listener
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          setIsOpen(false);
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    const emitSingleChange = (d: Date | null, t: string = selectedTime) => {
      const formatted = formatDateISO(d, t, mode);
      if (onChange) {
        onChange(formatted);
        onChange({ target: { name, value: formatted } } as any);
      }
    };

    const emitRangeChange = (start: Date | null, end: Date | null) => {
      const startStr = start ? formatDateISO(start, "00:00", "date") : "";
      const endStr = end ? formatDateISO(end, "23:59", "date") : "";
      const payloadString = startStr && endStr ? `${startStr} to ${endStr}` : startStr || endStr;

      if (onRangeChange) {
        onRangeChange({ startDate: startStr, endDate: endStr });
      }
      if (onChange) {
        onChange(payloadString);
        onChange({ target: { name, value: payloadString } } as any);
      }
    };

    const handleSelectDay = (day: number) => {
      const targetDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

      if (mode === "range") {
        if (!rangeStart || (rangeStart && rangeEnd)) {
          // First click: Start Range
          setRangeStart(targetDate);
          setRangeEnd(null);
        } else if (rangeStart && !rangeEnd) {
          // Second click: End Range
          if (targetDate < rangeStart) {
            setRangeStart(targetDate);
            setRangeEnd(rangeStart);
            emitRangeChange(targetDate, rangeStart);
          } else {
            setRangeEnd(targetDate);
            emitRangeChange(rangeStart, targetDate);
          }
          setIsOpen(false);
        }
      } else {
        setSelectedDate(targetDate);
        emitSingleChange(targetDate, selectedTime);
        if (mode === "date") {
          setIsOpen(false);
        }
      }
    };

    const handleTimeChange = (newTime: string) => {
      setSelectedTime(newTime);
      if (selectedDate) {
        emitSingleChange(selectedDate, newTime);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (mode === "range") {
        setRangeStart(null);
        setRangeEnd(null);
        emitRangeChange(null, null);
      } else {
        setSelectedDate(null);
        emitSingleChange(null);
      }
    };

    const handlePrevMonth = () => {
      setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
      setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const handlePreset = (presetKey: string) => {
      const now = new Date();
      let start: Date | null = null;
      let end: Date | null = null;

      if (presetKey === "today") {
        start = now;
        end = now;
      } else if (presetKey === "yesterday") {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        start = yest;
        end = yest;
      } else if (presetKey === "last7Days") {
        const s = new Date(now);
        s.setDate(now.getDate() - 6);
        start = s;
        end = now;
      } else if (presetKey === "last30Days") {
        const s = new Date(now);
        s.setDate(now.getDate() - 29);
        start = s;
        end = now;
      } else if (presetKey === "thisMonth") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (presetKey === "thisYear") {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
      }

      if (mode === "range") {
        setRangeStart(start);
        setRangeEnd(end);
        emitRangeChange(start, end);
      } else {
        setSelectedDate(start);
        emitSingleChange(start);
      }
      if (start) setViewDate(start);
      setIsOpen(false);
    };

    // Calendar Matrix Helper
    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const isDateDisabled = (day: number) => {
      const target = new Date(viewYear, viewMonth, day);
      if (minDate) {
        const minD = typeof minDate === "string" ? new Date(minDate) : minDate;
        minD.setHours(0, 0, 0, 0);
        if (target < minD) return true;
      }
      if (maxDate) {
        const maxD = typeof maxDate === "string" ? new Date(maxDate) : maxDate;
        maxD.setHours(23, 59, 59, 999);
        if (target > maxD) return true;
      }
      return false;
    };

    const isToday = (day: number) => {
      const today = new Date();
      return (
        today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === day
      );
    };

    const isSingleSelected = (day: number) =>
      selectedDate &&
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day;

    const isRangeBoundary = (day: number, type: "start" | "end") => {
      const target = new Date(viewYear, viewMonth, day);
      const bDate = type === "start" ? rangeStart : rangeEnd;
      if (!bDate) return false;
      return (
        bDate.getFullYear() === target.getFullYear() &&
        bDate.getMonth() === target.getMonth() &&
        bDate.getDate() === target.getDate()
      );
    };

    const isRangeMiddle = (day: number) => {
      if (!rangeStart) return false;
      const target = new Date(viewYear, viewMonth, day);
      const endToCompare = rangeEnd || hoverDate;
      if (!endToCompare) return false;

      const min = rangeStart < endToCompare ? rangeStart : endToCompare;
      const max = rangeStart < endToCompare ? endToCompare : rangeStart;

      return target > min && target < max;
    };

    // Trigger Placeholder & Display String
    const defaultPlaceholder =
      mode === "range"
        ? "Select date range..."
        : mode === "datetime"
        ? "Select date & time..."
        : "Select date...";

    let displayString = "";
    if (mode === "range") {
      if (rangeStart && rangeEnd) {
        if (formatShortDate(rangeStart) === formatShortDate(rangeEnd)) {
          displayString = formatShortDate(rangeStart);
        } else {
          displayString = `${formatShortDate(rangeStart)} – ${formatShortDate(rangeEnd)}`;
        }
      } else if (rangeStart) {
        displayString = `${formatShortDate(rangeStart)} – Select End Date`;
      }
    } else if (selectedDate) {
      displayString = formatShortDate(selectedDate) + (mode === "datetime" ? `, ${selectedTime}` : "");
    }

    const hasValue = mode === "range" ? !!(rangeStart || rangeEnd) : !!selectedDate;
    const activeVariantClass = error ? variantStyles.danger : variantStyles[variant];

    return (
      <div className={cn("flex flex-col gap-1.5 relative", fullWidth && "w-full", className)}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-text flex items-center justify-between">
            <span>{label}</span>
          </label>
        )}

        <div className="relative">
          {/* Hidden input for HTML form integration */}
          <input
            ref={ref}
            type="hidden"
            name={name}
            id={id}
            value={
              mode === "range"
                ? `${rangeStart ? formatDateISO(rangeStart, "00:00", "date") : ""}${rangeEnd ? ` to ${formatDateISO(rangeEnd, "23:59", "date")}` : ""}`
                : formatDateISO(selectedDate, selectedTime, mode)
            }
          />

          {/* Main Trigger Button */}
          <button
            ref={buttonRef}
            type="button"
            disabled={disabled}
            onClick={handleToggle}
            className={cn(
              "w-full inline-flex items-center text-left font-normal transition-all duration-200 select-none cursor-pointer focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt",
              triggerSizes[size],
              activeVariantClass
            )}
          >
            <span className="shrink-0 text-text-muted [&>svg]:h-4 [&>svg]:w-4">
              {icon || (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </span>

            <span className={cn("truncate flex-1 min-w-0 text-left font-medium", !displayString && "text-text-muted font-normal")}>
              {displayString || placeholder || defaultPlaceholder}
            </span>

            {isClearable && hasValue && !disabled && (
              <span
                onClick={handleClear}
                className="shrink-0 text-text-muted hover:text-text p-0.5 rounded hover:bg-surface-hover cursor-pointer transition-colors ml-auto"
                title="Clear date"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
          </button>
        </div>

        {/* Portal Calendar Popover Panel */}
        {isOpen && mounted && coords && createPortal(
          <div
            id={`datepicker-portal-${id}`}
            style={{
              position: "fixed",
              top: openUpward ? undefined : coords.top + 4,
              bottom: openUpward ? window.innerHeight - coords.top + 4 : undefined,
              left: alignRight ? undefined : coords.left,
              right: alignRight ? coords.right : undefined,
              zIndex: 99999,
            }}
            className="w-72 rounded-2xl border border-border/80 bg-surface/95 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl animate-popover-in ring-1 ring-white/10"
          >
            {mode === "datetime" && timeScreenOpen ? (
              /* SCREEN MODE 2: WHEEL TIME PICKER SCREEN (Matching Reference Image) */
              (() => {
                const [hStr, mStr] = (selectedTime || "09:00").split(":");
                const h24 = parseInt(hStr || "9", 10);
                const mins = parseInt(mStr || "0", 10);
                const isPM = h24 >= 12;
                const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

                const setTimeVal = (newH12: number, newMins: number, pm: boolean) => {
                  let targetH24 = newH12 % 12;
                  if (pm) targetH24 += 12;
                  const cleanH = String(targetH24).padStart(2, "0");
                  const cleanM = String(newMins).padStart(2, "0");
                  handleTimeChange(`${cleanH}:${cleanM}`);
                };

                const displayFormatted12 = `${String(h12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;

                return (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200 ease-out transform-gpu py-1">
                    {/* Header: < Back button and Set Time badge */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                      <button
                        type="button"
                        onClick={() => setTimeScreenOpen(false)}
                        className="px-2.5 py-1 bg-surface border border-border rounded-xl text-xs font-bold text-text hover:bg-surface-hover hover:-translate-x-0.5 active:scale-95 transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                        <span>Back</span>
                      </button>
                      <span className="px-3 py-1 rounded-xl bg-primary/15 text-primary-400 border border-primary/30 font-mono font-extrabold text-xs animate-in fade-in duration-200">
                        Set: {displayFormatted12}
                      </span>
                    </div>

                    {/* 3-Column Vertical Scroll Wheel Box */}
                    <div className="relative border border-border/80 rounded-2xl bg-surface/95 p-2 overflow-hidden shadow-inner my-2 h-44">
                      {/* Central Highlight Selection Bar Across All 3 Columns */}
                      <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-8 bg-primary-500/25 border border-primary-500/50 rounded-xl pointer-events-none z-0 shadow-xs transition-all duration-200" />

                      <div className="grid grid-cols-3 gap-1 relative z-10 text-center font-mono h-full">
                        {/* Column 1: Hours (01 - 12) */}
                        <div
                          ref={hourColRef}
                          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                          onScroll={(e) => {
                            const scrollTop = e.currentTarget.scrollTop;
                            requestAnimationFrame(() => {
                              const idx = Math.min(11, Math.max(0, Math.round(scrollTop / 36)));
                              const scrolledH12 = idx + 1;
                              if (scrolledH12 !== h12) {
                                setTimeVal(scrolledH12, mins, isPM);
                              }
                            });
                          }}
                          className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden py-[72px] space-y-1 snap-y snap-mandatory scroll-smooth"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((hVal) => {
                            const isSelected = hVal === h12;
                            return (
                              <button
                                key={hVal}
                                type="button"
                                onClick={() => setTimeVal(hVal, mins, isPM)}
                                className={cn(
                                  "w-full h-8 flex items-center justify-center text-sm font-extrabold transition-all duration-150 ease-out cursor-pointer rounded-lg snap-center active:scale-95",
                                  isSelected ? "text-primary font-black scale-105" : "text-text-muted/50 hover:text-text hover:bg-surface/60"
                                )}
                              >
                                {String(hVal).padStart(2, "0")}
                              </button>
                            );
                          })}
                        </div>

                        {/* Column 2: Minutes (00 - 55 in steps of 5) */}
                        <div
                          ref={minColRef}
                          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                          onScroll={(e) => {
                            const minOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
                            const scrollTop = e.currentTarget.scrollTop;
                            requestAnimationFrame(() => {
                              const idx = Math.min(minOptions.length - 1, Math.max(0, Math.round(scrollTop / 36)));
                              const scrolledMins = minOptions[idx];
                              if (scrolledMins !== mins) {
                                setTimeVal(h12, scrolledMins, isPM);
                              }
                            });
                          }}
                          className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden py-[72px] space-y-1 snap-y snap-mandatory scroll-smooth"
                        >
                          {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((mStrVal) => {
                            const mVal = parseInt(mStrVal, 10);
                            const isSelected = Math.abs(mins - mVal) < 3 || (mins > 55 && mVal === 55);
                            return (
                              <button
                                key={mStrVal}
                                type="button"
                                onClick={() => setTimeVal(h12, mVal, isPM)}
                                className={cn(
                                  "w-full h-8 flex items-center justify-center text-sm font-extrabold transition-all duration-150 ease-out cursor-pointer rounded-lg snap-center active:scale-95",
                                  isSelected ? "text-primary font-black scale-105" : "text-text-muted/50 hover:text-text hover:bg-surface/60"
                                )}
                              >
                                {mStrVal}
                              </button>
                            );
                          })}
                        </div>

                        {/* Column 3: Period (AM / PM Wheel) */}
                        <div
                          ref={periodColRef}
                          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                          onScroll={(e) => {
                            const scrollTop = e.currentTarget.scrollTop;
                            requestAnimationFrame(() => {
                              const idx = Math.round(scrollTop / 36);
                              const scrolledPM = idx >= 1;
                              if (scrolledPM !== isPM) {
                                setTimeVal(h12, mins, scrolledPM);
                              }
                            });
                          }}
                          className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden py-[72px] space-y-1 snap-y snap-mandatory scroll-smooth"
                        >
                          {["AM", "PM"].map((pVal) => {
                            const isSelected = (pVal === "PM" && isPM) || (pVal === "AM" && !isPM);
                            return (
                              <button
                                key={pVal}
                                type="button"
                                onClick={() => setTimeVal(h12, mins, pVal === "PM")}
                                className={cn(
                                  "w-full h-8 flex items-center justify-center text-sm font-extrabold transition-all duration-150 ease-out cursor-pointer rounded-lg snap-center active:scale-95",
                                  isSelected ? "text-primary font-black scale-105" : "text-text-muted/50 hover:text-text hover:bg-surface/60"
                                )}
                              >
                                {pVal}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Confirm & Close Button */}
                    <button
                      type="button"
                      onClick={() => { setTimeScreenOpen(false); setIsOpen(false); }}
                      className="w-full py-2 bg-primary text-white font-bold text-xs rounded-xl shadow-md hover:bg-primary-600 hover:scale-[1.02] active:scale-95 transition-all duration-150 cursor-pointer text-center"
                    >
                      Set Date & Time
                    </button>
                  </div>
                );
              })()
            ) : (
              /* SCREEN MODE 1: CALENDAR VIEW SCREEN */
              <>
                {/* Preset Shortcuts */}
                {renderPresets && (
                  <div className="grid grid-cols-3 gap-1.5 mb-3 pb-2.5 border-b border-border/60 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handlePreset("today")}
                      className="px-1.5 py-1 rounded-md bg-surface border border-border/60 text-text hover:bg-surface-hover transition-colors font-medium text-center truncate cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreset("yesterday")}
                      className="px-1.5 py-1 rounded-md bg-surface border border-border/60 text-text hover:bg-surface-hover transition-colors font-medium text-center truncate cursor-pointer"
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreset("last7Days")}
                      className="px-1.5 py-1 rounded-md bg-surface border border-border/60 text-text hover:bg-surface-hover transition-colors font-medium text-center truncate cursor-pointer"
                    >
                      Last 7D
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreset("last30Days")}
                      className="px-1.5 py-1 rounded-md bg-surface border border-border/60 text-text hover:bg-surface-hover transition-colors font-medium text-center truncate cursor-pointer"
                    >
                      Last 30D
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreset("thisMonth")}
                      className="px-1.5 py-1 rounded-md bg-surface border border-border/60 text-text hover:bg-surface-hover transition-colors font-medium text-center truncate cursor-pointer"
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreset("thisYear")}
                      className="px-1.5 py-1 rounded-md bg-surface border border-border/60 text-text hover:bg-surface-hover transition-colors font-medium text-center truncate cursor-pointer"
                    >
                      This Year
                    </button>
                  </div>
                )}

                {/* Month/Year Navigation Bar */}
                <div className="flex items-center justify-between mb-3 gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text transition-colors cursor-pointer shrink-0"
                    aria-label="Previous Month"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-1 font-bold text-xs text-text">
                    <button
                      type="button"
                      onClick={() => setViewMode(viewMode === "months" ? "days" : "months")}
                      className={cn(
                        "px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold",
                        viewMode === "months"
                          ? "bg-primary-600 border-primary-600 text-white shadow-xs"
                          : "bg-surface border-border/80 text-text hover:bg-surface-hover hover:border-text-secondary"
                      )}
                    >
                      <span>{MONTH_NAMES[viewMonth]}</span>
                      <svg className="h-3 w-3 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode(viewMode === "years" ? "days" : "years")}
                      className={cn(
                        "px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold",
                        viewMode === "years"
                          ? "bg-primary-600 border-primary-600 text-white shadow-xs"
                          : "bg-surface border-border/80 text-text hover:bg-surface-hover hover:border-text-secondary"
                      )}
                    >
                      <span>{viewYear}</span>
                      <svg className="h-3 w-3 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text transition-colors cursor-pointer shrink-0"
                    aria-label="Next Month"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* MODE 1: MONTH SELECTION GRID */}
                {viewMode === "months" && (
                  <div className="grid grid-cols-3 gap-2 py-2 animate-in fade-in zoom-in-95 duration-150">
                    {MONTH_NAMES.map((mName, idx) => {
                      const isCurrentMonth = idx === viewMonth;
                      return (
                        <button
                          key={mName}
                          type="button"
                          onClick={() => {
                            setViewDate(new Date(viewYear, idx, 1));
                            setViewMode("days");
                          }}
                          className={cn(
                            "py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center",
                            isCurrentMonth
                              ? "bg-primary-600 border-primary-600 text-white font-bold shadow-sm scale-105"
                              : "bg-surface border-border/60 text-text hover:bg-surface-hover hover:border-text-secondary"
                          )}
                        >
                          {mName.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* MODE 2: YEAR SELECTION GRID */}
                {viewMode === "years" && (
                  <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 py-1 animate-in fade-in zoom-in-95 duration-150">
                    {Array.from({ length: 110 }, (_, i) => new Date().getFullYear() - 90 + i).map((yr) => {
                      const isCurrentYear = yr === viewYear;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setViewDate(new Date(yr, viewMonth, 1));
                            setViewMode("days");
                          }}
                          className={cn(
                            "py-1.5 px-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center",
                            isCurrentYear
                              ? "bg-primary-600 border-primary-600 text-white font-bold shadow-sm scale-105"
                              : "bg-surface border-border/60 text-text hover:bg-surface-hover hover:border-text-secondary"
                          )}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* MODE 3: STANDARD CALENDAR DAYS GRID */}
                {viewMode === "days" && (
                  <>
                    {/* Day Names Header */}
                    <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                      {DAY_NAMES.map((name) => (
                        <div key={name} className="py-1">{name}</div>
                      ))}
                    </div>

                    {/* Calendar Days Grid */}
                    <div className="grid grid-cols-7 gap-y-1 gap-x-0 text-xs">
                      {/* Prev Month Days */}
                      {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div
                          key={`prev-${i}`}
                          className="h-8 flex items-center justify-center text-text-muted/30 select-none text-xs font-normal"
                        >
                          {daysInPrevMonth - firstDayOfMonth + i + 1}
                        </div>
                      ))}

                      {/* Current Month Days */}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const disabledDay = isDateDisabled(day);
                        const todayDay = isToday(day);
                        const singleSelected = isSingleSelected(day);
                        const isStart = isRangeBoundary(day, "start");
                        const isEnd = isRangeBoundary(day, "end");
                        const isMiddle = isRangeMiddle(day);

                        return (
                          <button
                            key={`day-${day}`}
                            type="button"
                            disabled={disabledDay}
                            onClick={() => handleSelectDay(day)}
                            onMouseEnter={() => mode === "range" && rangeStart && !rangeEnd && setHoverDate(new Date(viewYear, viewMonth, day))}
                            className={cn(
                              "h-8 w-full flex items-center justify-center font-medium text-xs transition-all relative cursor-pointer",
                              disabledDay && "opacity-30 cursor-not-allowed text-text-muted",
                              todayDay && !singleSelected && !(mode === "range" && (isStart || isEnd)) && "font-extrabold text-text ring-1 ring-border rounded-lg",
                              singleSelected && mode !== "range" && "bg-primary-600 text-white font-bold rounded-lg shadow-sm scale-105 z-10",
                              isStart && mode === "range" && "bg-primary-600 text-white font-bold rounded-l-lg z-10",
                              isEnd && mode === "range" && "bg-primary-600 text-white font-bold rounded-r-lg z-10",
                              isMiddle && mode === "range" && "bg-primary-500/20 text-primary-400 font-semibold rounded-none",
                              !singleSelected && !(mode === "range" && (isStart || isEnd || isMiddle)) && !disabledDay && "hover:bg-surface-hover text-text rounded-lg"
                            )}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* DateTime Mode: Switch to Time View Screen Button */}
                {mode === "datetime" && (() => {
                  const [hStr, mStr] = (selectedTime || "09:00").split(":");
                  const h24 = parseInt(hStr || "9", 10);
                  const mins = parseInt(mStr || "0", 10);
                  const isPM = h24 >= 12;
                  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
                  const displayFormatted12 = `${String(h12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;

                  return (
                    <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                      <span className="text-text-muted font-bold text-[11px] uppercase tracking-wider">Time:</span>
                      <button
                        type="button"
                        onClick={() => setTimeScreenOpen(true)}
                        className="px-2.5 py-1.5 rounded-xl bg-surface border border-border/80 hover:border-primary-500/50 hover:bg-surface-hover text-text font-mono font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                      >
                        <svg className="w-3.5 h-3.5 text-primary-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{displayFormatted12}</span>
                        <div className="flex items-center gap-1 text-[11px] text-text-muted font-sans font-medium pl-1.5 border-l border-border/60">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                          </svg>
                          <span>Set Time</span>
                        </div>
                      </button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>,
          document.body
        )}

        {error && <p className="text-xs text-danger-500 animate-fade-in">{error}</p>}
        {!error && hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
export default DatePicker;
