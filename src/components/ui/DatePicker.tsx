"use client";

import { type ReactNode, forwardRef, useId, useState, useEffect, useRef, useCallback, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { popoverPosition } from "@/lib/popoverPosition";
import { cn } from "./utils";
import { fieldBase, fieldVariants } from "./controlStyles";
import Button from "./Button";
import Select from "./Select";

export type DatePickerVariant = "outline" | "filled" | "ghost" | "danger";
export type DatePickerSize = "sm" | "md" | "lg";
export type DatePickerMode = "date" | "datetime" | "range" | "time" | "month";

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
  onChange?: (value: string) => void;
  onRangeChange?: (range: DateRangeValue) => void;
  name?: string;
  autoComplete?: string;
  id?: string;
  placeholder?: string;
  minDate?: string | Date;
  maxDate?: string | Date;
  disabled?: boolean;
  required?: boolean;
  isClearable?: boolean;
  fullWidth?: boolean;
  className?: string;
  icon?: ReactNode;
  showPresets?: boolean;
}

const triggerSizes: Record<DatePickerSize, string> = {
  sm: "min-h-11 md:min-h-8 md:h-8 text-base md:text-sm px-3 rounded-control gap-1.5",
  md: "min-h-11 md:min-h-9 md:h-9 text-base md:text-sm px-3.5 rounded-control gap-2",
  lg: "h-11 text-base px-4 rounded-control gap-2.5",
};

const variantStyles: Record<DatePickerVariant, string> = {
  outline: fieldVariants.default,
  filled: fieldVariants.filled,
  ghost: "rounded-control border border-transparent bg-transparent text-text hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring",
  danger: "rounded-control border border-danger bg-surface text-text focus-visible:border-danger focus-visible:ring-2 focus-visible:ring-danger",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseISOValue(valStr?: string, mode: DatePickerMode = "date"): { dateObj: Date | null; timeStr: string } {
  if (mode === "time") return { dateObj: null, timeStr: valStr || "" };
  if (!valStr) return { dateObj: null, timeStr: "09:00" };

  try {
    if (mode === "month") {
      const d = new Date(`${valStr}-01T00:00:00`);
      return { dateObj: isNaN(d.getTime()) ? null : d, timeStr: "09:00" };
    }
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
  if (mode === "time") return timeStr;
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  if (mode === "month") return `${year}-${month}`;
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
    autoComplete,
    id: propId,
    placeholder,
    minDate,
    maxDate,
    disabled = false,
    required = false,
    isClearable = true,
    fullWidth = true,
    className = "",
    icon,
    showPresets: showPresetsProp,
  }, ref) => {
    const autoId = useId();
    const id = propId || autoId;
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current!);
    const [nativeError, setNativeError] = useState("");
    const visibleError = error || nativeError;

    const renderPresets = showPresetsProp ?? (mode === "range");

    const [isOpen, setIsOpen] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);
    const [owner, setOwner] = useState<string>();
    const [coords, setCoords] = useState<ReturnType<typeof popoverPosition> | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    useOverlayFocus(isOpen && mounted && !!coords, popupRef, () => setIsOpen(false), false);

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
    const [viewMode, setViewMode] = useState<"days" | "months" | "years">(mode === "month" ? "months" : "days");
    const [timeScreenOpen, setTimeScreenOpen] = useState(false);
    const [timeDraft, setTimeDraft] = useState(initialParsed.timeStr || "09:00");

    // Sync controlled props
    useEffect(() => {
      setNativeError("");
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
        setOwner(buttonRef.current.closest('[role="dialog"]')?.id || undefined);
        setCoords(popoverPosition(rect, 288, 360));
      }
    }, []);

    const interactionDisabled = () => disabled || Boolean(buttonRef.current?.matches(":disabled"));
    const handleToggle = () => {
      if (interactionDisabled()) return;
      if (!isOpen) {
        updateCoords();
        setViewMode(mode === "month" ? "months" : "days");
        setTimeDraft(selectedTime || "09:00");
        setTimeScreenOpen(false);
      }
      setIsOpen(!isOpen);
    };

    // Click outside listener & scroll
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (buttonRef.current && e.target instanceof Node && buttonRef.current.contains(e.target)) return;
        const portalEl = document.getElementById(`datepicker-portal-${id}`);
        if (portalEl && e.target instanceof Node && portalEl.contains(e.target)) return;
        const nestedPopup = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-overlay-owner]") : null;
        if (nestedPopup?.dataset.overlayOwner === popupRef.current?.id) return;
        setIsOpen(false);
      };

      const onScroll = (e: Event) => {
        const portalEl = document.getElementById(`datepicker-portal-${id}`);
        if (portalEl && e.target instanceof Node && portalEl.contains(e.target)) return;
        if (buttonRef.current && e.target instanceof Node && buttonRef.current.contains(e.target)) return;
        updateCoords();
      };

      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", onScroll, { capture: true, passive: true });
      window.addEventListener("resize", updateCoords);
      window.visualViewport?.addEventListener("resize", updateCoords);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", onScroll, { capture: true });
        window.removeEventListener("resize", updateCoords);
        window.visualViewport?.removeEventListener("resize", updateCoords);
      };
    }, [isOpen, id, updateCoords]);

    const emitSingleChange = (d: Date | null, t: string = selectedTime) => {
      setNativeError("");
      const formatted = formatDateISO(d, t, mode);
      if (onChange) {
        onChange(formatted);
      }
    };

    const emitRangeChange = (start: Date | null, end: Date | null) => {
      setNativeError("");
      const startStr = start ? formatDateISO(start, "00:00", "date") : "";
      const endStr = end ? formatDateISO(end, "23:59", "date") : "";
      const payloadString = startStr && endStr ? `${startStr} to ${endStr}` : startStr || endStr;

      if (onRangeChange) {
        onRangeChange({ startDate: startStr, endDate: endStr });
      }
      if (onChange) {
        onChange(payloadString);
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
      if (selectedDate || mode === "time") {
        emitSingleChange(selectedDate, newTime);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (interactionDisabled()) return;
      if (mode === "range") {
        setRangeStart(null);
        setRangeEnd(null);
        emitRangeChange(null, null);
      } else {
        setSelectedDate(null);
        if (mode === "time") setSelectedTime("");
        emitSingleChange(null, mode === "time" ? "" : selectedTime);
      }
    };

    const handlePrevMonth = () => {
      setViewDate((prev) => mode === "month" ? new Date(prev.getFullYear() - 1, prev.getMonth(), 1) : new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
      setViewDate((prev) => mode === "month" ? new Date(prev.getFullYear() + 1, prev.getMonth(), 1) : new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
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
        const minD = typeof minDate === "string" ? parseISOValue(minDate).dateObj : new Date(minDate);
        if (!minD) return true;
        minD.setHours(0, 0, 0, 0);
        if (target < minD) return true;
      }
      if (maxDate) {
        const maxD = typeof maxDate === "string" ? parseISOValue(maxDate).dateObj : new Date(maxDate);
        if (!maxD) return true;
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

    const isMonthDisabled = (month: number) => {
      const target = viewYear * 12 + month;
      const monthIndex = (value: string | Date) => {
        if (typeof value !== "string") return value.getFullYear() * 12 + value.getMonth();
        const parsed = /^(\d{4})-(\d{2})(?:-|$)/.exec(value);
        return parsed ? Number(parsed[1]) * 12 + Number(parsed[2]) - 1 : NaN;
      };
      return Boolean(minDate && (!Number.isFinite(monthIndex(minDate)) || target < monthIndex(minDate)) ||
        maxDate && (!Number.isFinite(monthIndex(maxDate)) || target > monthIndex(maxDate)));
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
      mode === "time" ? "Select time..." : mode === "range"
        ? "Select date range..."
        : mode === "datetime"
        ? "Select date & time..."
        : mode === "month" ? "Select month..." : "Select date...";

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
    } else if (mode === "time") {
      displayString = selectedTime;
    } else if (selectedDate) {
      displayString = mode === "month" ? selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : formatShortDate(selectedDate) + (mode === "datetime" ? `, ${selectedTime}` : "");
    }

    const hasValue = mode === "time" ? Boolean(selectedTime) : mode === "range" ? !!(rangeStart || rangeEnd) : !!selectedDate;
    const activeVariantClass = visibleError ? variantStyles.danger : variantStyles[variant];

    return (
      <div className={cn("flex flex-col gap-1.5 relative", fullWidth && "w-full", className)}>
        {label && (
          <label id={`${id}-label`} htmlFor={`${id}-trigger`} className="text-sm font-medium text-text flex items-center justify-between">
            <span>{label}</span>
          </label>
        )}

        <div className="relative">
          {/* Form semantics stay inside the shared control; the visible picker is custom. */}
          <input
            ref={inputRef}
            type={mode === "range" ? "hidden" : mode === "datetime" ? "datetime-local" : mode}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            required={required}
            disabled={disabled}
            min={typeof minDate === "string" ? mode === "month" ? minDate.slice(0, 7) : minDate : minDate ? formatDateISO(minDate, "09:00", mode === "month" ? "month" : "date") : undefined}
            max={typeof maxDate === "string" ? mode === "month" ? maxDate.slice(0, 7) : maxDate : maxDate ? formatDateISO(maxDate, "09:00", mode === "month" ? "month" : "date") : undefined}
            name={name}
            autoComplete={autoComplete}
            id={id}
            onChange={event => {
              const parsed = parseISOValue(event.target.value, mode);
              setSelectedDate(parsed.dateObj);
              setSelectedTime(parsed.timeStr);
              setNativeError("");
              onChange?.(event.target.value);
            }}
            onInvalid={event => {
              event.preventDefault();
              setNativeError(event.currentTarget.validity.valueMissing
                ? mode === "time" ? "Choose a time." : mode === "month" ? "Choose a month." : mode === "datetime" ? "Choose a date and time." : "Choose a date."
                : "Choose a value within the allowed range.");
              buttonRef.current?.focus();
            }}
            value={
              mode === "range"
                ? `${rangeStart ? formatDateISO(rangeStart, "00:00", "date") : ""}${rangeEnd ? ` to ${formatDateISO(rangeEnd, "23:59", "date")}` : ""}`
                : formatDateISO(selectedDate, selectedTime, mode)
            }
          />

          {/* Main Trigger Button */}
          <button
            id={`${id}-trigger`}
            ref={buttonRef}
            aria-labelledby={label ? `${id}-label` : undefined}
            aria-label={!label ? placeholder || (mode === "range" ? "Choose date range" : "Choose date") : undefined}
            aria-describedby={visibleError ? `${id}-error` : hint ? `${id}-hint` : undefined}
            type="button"
            disabled={disabled}
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-controls={isOpen ? `datepicker-portal-${id}` : undefined}
            className={cn(
              fieldBase, "w-full inline-flex items-center text-left select-none cursor-pointer",
              triggerSizes[size],
              activeVariantClass,
              isClearable && hasValue && !disabled && "pr-12"
            )}
          >
            <span className="shrink-0 text-text-muted [&>svg]:h-4 [&>svg]:w-4">
              {icon || (
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={mode === "time" ? "M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" : "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"} />
                </svg>
              )}
            </span>

            <span className={cn("truncate flex-1 min-w-0 text-left font-medium", !displayString && "text-text-muted font-normal")}>
              {displayString || placeholder || defaultPlaceholder}
            </span>
          </button>

          {isClearable && hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 touch-target text-text-muted hover:text-text p-1 rounded hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring cursor-pointer transition-colors"
              aria-label={mode === "time" ? "Clear time" : "Clear date"}
              title={mode === "time" ? "Clear time" : "Clear date"}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Portal Calendar Popover Panel */}
        {isOpen && mounted && coords && createPortal(
          <div
            id={`datepicker-portal-${id}`}
            ref={popupRef}
            role="dialog"
            onClickCapture={event => {
              // Portals are outside a disabled form fieldset. Recheck the
              // original trigger before any calendar action changes a draft.
              if (interactionDisabled()) {
                event.preventDefault();
                event.stopPropagation();
                setIsOpen(false);
              }
            }}
            aria-label={label ? `Choose ${label}` : "Choose date and time"}
            tabIndex={-1}
            data-overlay-owner={owner}
            style={{
              position: "fixed",
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              zIndex: "var(--layer-popover)",
            }}
            className="material-glass-elevated overflow-y-auto rounded-container p-4 animate-popover-in"
          >
            {mode === "time" || (mode === "datetime" && timeScreenOpen) ? (() => {
              const [hourText, minuteText] = timeDraft.split(":");
              const hour = Number(hourText);
              const period = hour >= 12 ? "PM" : "AM";
              const hour12 = hour % 12 || 12;
              const updateTime = (nextHour: number, nextMinute: string, nextPeriod: string) => {
                const hour24 = nextHour % 12 + (nextPeriod === "PM" ? 12 : 0);
                setTimeDraft(String(hour24).padStart(2, "0") + ":" + nextMinute);
              };
              return <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text">Choose time</h3>
                  {mode === "datetime" && <Button variant="ghost" size="sm" onClick={() => setTimeScreenOpen(false)}>Back to date</Button>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select label="Hour" value={String(hour12)} onChange={event => updateTime(Number(event.target.value), minuteText, period)} options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1).padStart(2, "0") }))} />
                  <Select label="Minute" value={minuteText} onChange={event => updateTime(hour12, event.target.value, period)} options={Array.from({ length: 60 }, (_, minute) => ({ value: String(minute).padStart(2, "0"), label: String(minute).padStart(2, "0") }))} />
                  <Select label="Period" value={period} onChange={event => updateTime(hour12, minuteText, event.target.value)} options={[{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }]} />
                </div>
                <Button fullWidth onClick={() => { handleTimeChange(timeDraft); setTimeScreenOpen(false); setIsOpen(false); }} disabled={mode === "datetime" && !selectedDate}>{mode === "time" ? "Set time" : "Set date & time"}</Button>
              </div>;
            })() : (
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
                    aria-label={mode === "month" ? "Previous Year" : "Previous Month"}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-1 font-semibold text-xs text-text">
                    <button
                      type="button"
                      onClick={() => setViewMode(mode === "month" ? "months" : viewMode === "months" ? "days" : "months")}
                      className={cn(
                        "px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold",
                        viewMode === "months"
                          ? "bg-primary-600 border-primary-600 text-brand-mist shadow-xs"
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
                      onClick={() => setViewMode(viewMode === "years" ? mode === "month" ? "months" : "days" : "years")}
                      className={cn(
                        "px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold",
                        viewMode === "years"
                          ? "bg-primary-600 border-primary-600 text-brand-mist shadow-xs"
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
                    aria-label={mode === "month" ? "Next Year" : "Next Month"}
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
                      const isCurrentMonth = mode === "month" ? selectedDate?.getFullYear() === viewYear && selectedDate?.getMonth() === idx : idx === viewMonth;
                      const disabledMonth = mode === "month" && isMonthDisabled(idx);
                      return (
                        <button
                          key={mName}
                          type="button"
                          aria-label={mode === "month" ? `${mName} ${viewYear}` : undefined}
                          aria-pressed={mode === "month" ? isCurrentMonth : undefined}
                          disabled={disabledMonth}
                          onClick={() => {
                            const target = new Date(viewYear, idx, 1);
                            setViewDate(target);
                            if (mode === "month") {
                              setSelectedDate(target);
                              emitSingleChange(target);
                              setIsOpen(false);
                            } else {
                              setViewMode("days");
                            }
                          }}
                          className={cn(
                            "py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center",
                            disabledMonth && "opacity-30 cursor-not-allowed",
                            isCurrentMonth
                              ? "bg-primary-600 border-primary-600 text-brand-mist font-semibold shadow-sm"
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
                            setViewMode(mode === "month" ? "months" : "days");
                          }}
                          className={cn(
                            "py-1.5 px-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center",
                            isCurrentYear
                              ? "bg-primary-600 border-primary-600 text-brand-mist font-semibold shadow-sm"
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
                    <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
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
                            aria-label={new Date(viewYear, viewMonth, day).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                            aria-pressed={Boolean(isSingleSelected(day) || isRangeBoundary(day, "start") || isRangeBoundary(day, "end"))}
                            onMouseEnter={() => mode === "range" && rangeStart && !rangeEnd && setHoverDate(new Date(viewYear, viewMonth, day))}
                            className={cn(
                              "h-8 w-full flex items-center justify-center font-medium text-xs transition-all relative cursor-pointer",
                              disabledDay && "opacity-30 cursor-not-allowed text-text-muted",
                              todayDay && !singleSelected && !(mode === "range" && (isStart || isEnd)) && "font-semibold text-text ring-1 ring-border rounded-lg",
                              singleSelected && mode !== "range" && "bg-primary-600 text-brand-mist font-semibold rounded-lg shadow-sm z-10",
                              isStart && mode === "range" && "bg-primary-600 text-brand-mist font-semibold rounded-l-lg z-10",
                              isEnd && mode === "range" && "bg-primary-600 text-brand-mist font-semibold rounded-r-lg z-10",
                              isMiddle && mode === "range" && "bg-primary-500/20 text-accent font-semibold rounded-none",
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
                      <span className="text-text-muted font-semibold text-[11px] uppercase tracking-wider">Time:</span>
                      <button
                        type="button"
                        onClick={() => { setTimeDraft(selectedTime || "09:00"); setTimeScreenOpen(true); }}
                        className="px-2.5 py-1.5 rounded-xl bg-surface border border-border/80 hover:border-primary-500/50 hover:bg-surface-hover text-text font-mono font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                      >
                        <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

        {visibleError && <p id={`${id}-error`} role="alert" className="text-xs text-danger-text animate-fade-in">{visibleError}</p>}
        {!visibleError && hint && <p id={`${id}-hint`} className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
export default DatePicker;
