/**
 * Clinic Operational Status Engine
 * Handles ANY arbitrary opening & closing times, split shifts, cross-midnight shifts,
 * 24/7 emergency operations, and day-of-week schedules.
 */

export type OperationalStatusType =
  | "open_now"
  | "closing_soon"
  | "on_break"
  | "closed"
  | "closed_today"
  | "open_24_7"
  | "unspecified";

export interface TimeSlot {
  startMinutes: number; // Minutes from 00:00 (e.g. 9:30 AM = 570)
  endMinutes: number;   // Minutes from 00:00 (e.g. 5:30 PM = 1050; cross-midnight can be > 1440)
  isOvernight?: boolean;
}

export type DayOfWeek = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export type WeeklySchedule = Record<DayOfWeek, TimeSlot[]>;

export interface OperationalStatusResult {
  status: OperationalStatusType;
  labelKey: string;
  defaultLabel: string;
  secondaryText: string;
  dotColorClass: string;
  textColorClass: string;
  badgeBgClass: string;
  isOpen: boolean;
  nextOpenTime?: string;
  nextOpenDay?: string;
  closingTime?: string;
  minutesUntilClose?: number;
}

/**
 * Parses any time string format into minutes from midnight (0..1439).
 * Examples supported:
 * - "09:00", "9:00", "17:30", "23:15" (24-hour)
 * - "9:00 AM", "9 AM", "1:30 PM", "11:45 pm" (12-hour AM/PM)
 * - "00:00", "24:00"
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  // 12-hour AM/PM pattern
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const meridian = ampmMatch[3].toLowerCase();

    if (hours === 12) {
      hours = meridian === "am" ? 0 : 12;
    } else if (meridian === "pm") {
      hours += 12;
    }
    return (hours % 24) * 60 + (minutes % 60);
  }

  // 24-hour pattern (e.g. "09:00", "17:45", "9:30")
  const standardMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (standardMatch) {
    const hours = parseInt(standardMatch[1], 10);
    const minutes = parseInt(standardMatch[2], 10);
    return (hours % 24) * 60 + (minutes % 60);
  }

  // Single hour (e.g. "9" -> 09:00 if reasonable)
  const singleHourMatch = trimmed.match(/^(\d{1,2})$/);
  if (singleHourMatch) {
    const h = parseInt(singleHourMatch[1], 10);
    if (h >= 0 && h <= 23) {
      return h * 60;
    }
  }

  return null;
}

/**
 * Formats minutes from midnight into localized 12-hour display string.
 * Example: 570 -> "9:30 AM", 1050 -> "5:30 PM", 1440 -> "12:00 AM"
 */
export function formatMinutesTo12Hour(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : `${m}`;
  return `${displayH}:${displayM} ${period}`;
}

/**
 * Check if the timings string represents a 24/7 continuous operation.
 */
export function is24HoursSchedule(timingsStr: string | null | undefined): boolean {
  if (!timingsStr) return false;
  const lower = timingsStr.toLowerCase().trim();
  return (
    lower.includes("24/7") ||
    lower.includes("24x7") ||
    lower.includes("24 hours") ||
    lower.includes("24 hrs") ||
    lower.includes("round the clock") ||
    lower === "open 24"
  );
}

/**
 * Parses raw timings string into a normalized WeeklySchedule.
 * Can parse:
 * - JSON single object: { start: "08:30", end: "19:00" }
 * - JSON array of slots: [{ start: "09:00", end: "13:00" }, { start: "17:00", end: "21:30" }]
 * - JSON day map: { monday: [{ start, end }], tuesday: [...], ... }
 * - String ranges: "09:00 - 17:00", "8:30 AM – 8:30 PM", "9am - 1pm, 5pm - 9pm"
 */
export function parseWeeklySchedule(timingsStr: string | null | undefined): {
  schedule: WeeklySchedule;
  is24x7: boolean;
  hasExplicitSchedule: boolean;
} {
  const defaultSchedule: WeeklySchedule = {
    sunday: [],
    monday: [{ startMinutes: 540, endMinutes: 1020 }],    // 9:00 AM – 5:00 PM
    tuesday: [{ startMinutes: 540, endMinutes: 1020 }],
    wednesday: [{ startMinutes: 540, endMinutes: 1020 }],
    thursday: [{ startMinutes: 540, endMinutes: 1020 }],
    friday: [{ startMinutes: 540, endMinutes: 1020 }],
    saturday: [{ startMinutes: 540, endMinutes: 1020 }],
  };

  if (!timingsStr || !timingsStr.trim()) {
    return { schedule: defaultSchedule, is24x7: false, hasExplicitSchedule: false };
  }

  const trimmed = timingsStr.trim();

  if (is24HoursSchedule(trimmed)) {
    const roundTheClock: TimeSlot[] = [{ startMinutes: 0, endMinutes: 1440 }];
    return {
      schedule: {
        sunday: roundTheClock,
        monday: roundTheClock,
        tuesday: roundTheClock,
        wednesday: roundTheClock,
        thursday: roundTheClock,
        friday: roundTheClock,
        saturday: roundTheClock,
      },
      is24x7: true,
      hasExplicitSchedule: true,
    };
  }

  // Attempt JSON parsing
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);

      // Format 1: Direct single slot object { start: "09:00", end: "17:00" }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.start && parsed.end) {
        const start = parseTimeToMinutes(String(parsed.start));
        const end = parseTimeToMinutes(String(parsed.end));
        if (start !== null && end !== null) {
          const slots: TimeSlot[] = [{
            startMinutes: start,
            endMinutes: end < start ? end + 1440 : end, // Cross-midnight support
            isOvernight: end < start,
          }];
          return {
            schedule: {
              sunday: [],
              monday: slots,
              tuesday: slots,
              wednesday: slots,
              thursday: slots,
              friday: slots,
              saturday: slots,
            },
            is24x7: start === 0 && (end === 1440 || end === 0),
            hasExplicitSchedule: true,
          };
        }
      }

      // Format 2: Direct array of slots [{ start, end }, { start, end }]
      if (Array.isArray(parsed)) {
        const slots: TimeSlot[] = [];
        for (const item of parsed) {
          if (item && item.start && item.end) {
            const start = parseTimeToMinutes(String(item.start));
            const end = parseTimeToMinutes(String(item.end));
            if (start !== null && end !== null) {
              slots.push({
                startMinutes: start,
                endMinutes: end < start ? end + 1440 : end,
                isOvernight: end < start,
              });
            }
          }
        }
        if (slots.length > 0) {
          slots.sort((a, b) => a.startMinutes - b.startMinutes);
          return {
            schedule: {
              sunday: [],
              monday: slots,
              tuesday: slots,
              wednesday: slots,
              thursday: slots,
              friday: slots,
              saturday: slots,
            },
            is24x7: false,
            hasExplicitSchedule: true,
          };
        }
      }

      // Format 3: Day-keyed map { monday: [{ start, end }], ... }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const resultSchedule: WeeklySchedule = {
          sunday: [],
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
        };
        let validDayFound = false;

        for (const day of DAYS_OF_WEEK) {
          const dayKeys = [day, day.slice(0, 3)];
          for (const key of Object.keys(parsed)) {
            if (dayKeys.includes(key.toLowerCase())) {
              const rawVal = parsed[key];
              const slotList: TimeSlot[] = [];

              const items = Array.isArray(rawVal) ? rawVal : [rawVal];
              for (const item of items) {
                if (item && item.start && item.end) {
                  const start = parseTimeToMinutes(String(item.start));
                  const end = parseTimeToMinutes(String(item.end));
                  if (start !== null && end !== null) {
                    slotList.push({
                      startMinutes: start,
                      endMinutes: end < start ? end + 1440 : end,
                      isOvernight: end < start,
                    });
                  }
                }
              }

              if (slotList.length > 0) {
                slotList.sort((a, b) => a.startMinutes - b.startMinutes);
                resultSchedule[day] = slotList;
                validDayFound = true;
              }
              break;
            }
          }
        }

        if (validDayFound) {
          return { schedule: resultSchedule, is24x7: false, hasExplicitSchedule: true };
        }
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // Format 4: Plain text range (e.g. "09:00 - 17:00", "9:00 AM – 5:00 PM, 6:00 PM – 9:00 PM")
  const commaSeparated = trimmed.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const parsedSlots: TimeSlot[] = [];

  for (const seg of commaSeparated) {
    const parts = seg.split(/[-–—to]+/i).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const start = parseTimeToMinutes(parts[0]);
      const end = parseTimeToMinutes(parts[1]);
      if (start !== null && end !== null) {
        parsedSlots.push({
          startMinutes: start,
          endMinutes: end < start ? end + 1440 : end,
          isOvernight: end < start,
        });
      }
    }
  }

  if (parsedSlots.length > 0) {
    parsedSlots.sort((a, b) => a.startMinutes - b.startMinutes);
    return {
      schedule: {
        sunday: [],
        monday: parsedSlots,
        tuesday: parsedSlots,
        wednesday: parsedSlots,
        thursday: parsedSlots,
        friday: parsedSlots,
        saturday: parsedSlots,
      },
      is24x7: false,
      hasExplicitSchedule: true,
    };
  }

  return { schedule: defaultSchedule, is24x7: false, hasExplicitSchedule: false };
}

/**
 * Helper to capitalize day name (e.g. "monday" -> "Monday")
 */
export function formatDayName(day: DayOfWeek): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/**
 * Calculates dynamic real-time operational status for any clinic at any arbitrary time.
 * @param timingsStr Raw string from database (JSON or text)
 * @param referenceDate Optional date/time (defaults to new Date())
 */
export function getClinicOperationalStatus(
  timingsStr: string | null | undefined,
  referenceDate: Date = new Date()
): OperationalStatusResult {
  const { schedule, is24x7, hasExplicitSchedule } = parseWeeklySchedule(timingsStr);

  // Case 1: Open 24/7 continuous
  if (is24x7) {
    return {
      status: "open_24_7",
      labelKey: "status.open_24_7",
      defaultLabel: "Open 24/7",
      secondaryText: "Emergency & OPD open 24 hours",
      dotColorClass: "bg-success-500",
      textColorClass: "text-emerald-600 dark:text-emerald-400",
      badgeBgClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      isOpen: true,
    };
  }

  const currentDayIndex = referenceDate.getDay(); // 0 = Sunday, 1 = Monday, ...
  const currentDayName = DAYS_OF_WEEK[currentDayIndex];
  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  const todaySlots = schedule[currentDayName] || [];

  // Helper to find the next opening slot across upcoming days
  const findNextOpenSlot = () => {
    for (let offset = 1; offset <= 7; offset++) {
      const nextIndex = (currentDayIndex + offset) % 7;
      const nextDay = DAYS_OF_WEEK[nextIndex];
      const slots = schedule[nextDay];
      if (slots && slots.length > 0) {
        const firstSlot = slots[0];
        const timeStr = formatMinutesTo12Hour(firstSlot.startMinutes);
        const dayLabel = offset === 1 ? "tomorrow" : formatDayName(nextDay);
        return { dayLabel, timeStr, offset };
      }
    }
    return null;
  };

  // Case 7: Closed on scheduled day off (e.g. Sunday or off-day with no slots)
  if (todaySlots.length === 0) {
    const next = findNextOpenSlot();
    const secondary = next
      ? next.offset === 1
        ? `Opens tomorrow at ${next.timeStr}`
        : `Opens ${next.dayLabel} at ${next.timeStr}`
      : "Consultation hours not scheduled";

    return {
      status: "closed_today",
      labelKey: "status.closed_today",
      defaultLabel: "Closed today",
      secondaryText: secondary,
      dotColorClass: "bg-text-muted",
      textColorClass: "text-text-secondary",
      badgeBgClass: "bg-surface-alt/90 text-text-secondary border-border/80",
      isOpen: false,
      nextOpenDay: next?.dayLabel,
      nextOpenTime: next?.timeStr,
    };
  }

  // Today has slots: check where currentMinutes falls
  const firstSlot = todaySlots[0];
  const lastSlot = todaySlots[todaySlots.length - 1];

  // Case 6: Before opening today (Early morning)
  if (currentMinutes < firstSlot.startMinutes) {
    const openTimeStr = formatMinutesTo12Hour(firstSlot.startMinutes);
    return {
      status: "closed",
      labelKey: "status.closed",
      defaultLabel: "Closed",
      secondaryText: `Opens today at ${openTimeStr}`,
      dotColorClass: "bg-text-muted",
      textColorClass: "text-text-secondary",
      badgeBgClass: "bg-surface-alt/90 text-text-secondary border-border/80",
      isOpen: false,
      nextOpenDay: "today",
      nextOpenTime: openTimeStr,
    };
  }

  // Check if currently inside any slot or in-between split slots
  for (let i = 0; i < todaySlots.length; i++) {
    const slot = todaySlots[i];

    // Inside this active slot
    if (currentMinutes >= slot.startMinutes && currentMinutes < slot.endMinutes) {
      const minutesRemaining = slot.endMinutes - currentMinutes;
      const closeTimeStr = formatMinutesTo12Hour(slot.endMinutes);

      // Case 3: Closing Soon (within 30 minutes of shift end)
      if (minutesRemaining <= 30) {
        return {
          status: "closing_soon",
          labelKey: "status.closing_soon",
          defaultLabel: "Closing soon",
          secondaryText: `Closes in ${minutesRemaining} min${minutesRemaining === 1 ? "" : "s"} (${closeTimeStr})`,
          dotColorClass: "bg-warning-500",
          textColorClass: "text-amber-600 dark:text-amber-400",
          badgeBgClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
          isOpen: true,
          closingTime: closeTimeStr,
          minutesUntilClose: minutesRemaining,
        };
      }

      // Case 2: Open Now (Normal hours)
      return {
        status: "open_now",
        labelKey: "status.open_now",
        defaultLabel: "Open now",
        secondaryText: `Closes at ${closeTimeStr}`,
        dotColorClass: "bg-success-500",
        textColorClass: "text-emerald-600 dark:text-emerald-400",
        badgeBgClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        isOpen: true,
        closingTime: closeTimeStr,
        minutesUntilClose: minutesRemaining,
      };
    }

    // Case 4: Midday Break (Between this slot and next slot today, e.g. 1 PM to 5 PM break)
    if (i < todaySlots.length - 1) {
      const nextSlotToday = todaySlots[i + 1];
      if (currentMinutes >= slot.endMinutes && currentMinutes < nextSlotToday.startMinutes) {
        const reopenTimeStr = formatMinutesTo12Hour(nextSlotToday.startMinutes);
        return {
          status: "on_break",
          labelKey: "status.on_break",
          defaultLabel: "On break",
          secondaryText: `Reopens today at ${reopenTimeStr}`,
          dotColorClass: "bg-warning-500",
          textColorClass: "text-amber-600 dark:text-amber-400",
          badgeBgClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
          isOpen: false,
          nextOpenDay: "today",
          nextOpenTime: reopenTimeStr,
        };
      }
    }
  }

  // Case 5: Closed for the Day (After today's last slot, e.g. 11:00 PM for 5:00 PM close)
  if (currentMinutes >= lastSlot.endMinutes) {
    const next = findNextOpenSlot();
    const secondary = next
      ? next.offset === 1
        ? `Opens tomorrow at ${next.timeStr}`
        : `Opens ${next.dayLabel} at ${next.timeStr}`
      : "Closed until further notice";

    return {
      status: "closed",
      labelKey: "status.closed",
      defaultLabel: "Closed",
      secondaryText: secondary,
      dotColorClass: "bg-text-muted",
      textColorClass: "text-text-secondary",
      badgeBgClass: "bg-surface-alt/90 text-text-secondary border-border/80",
      isOpen: false,
      nextOpenDay: next?.dayLabel,
      nextOpenTime: next?.timeStr,
    };
  }

  // Fallback for unspecified
  return {
    status: "unspecified",
    labelKey: "status.consultation_hours",
    defaultLabel: "Consultation hours",
    secondaryText: "Contact clinic for hours",
    dotColorClass: "bg-text-muted",
    textColorClass: "text-text-secondary",
    badgeBgClass: "bg-surface-alt/90 text-text-secondary border-border/80",
    isOpen: false,
  };
}
