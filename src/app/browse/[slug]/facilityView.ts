import { DAYS_OF_WEEK, formatMinutesTo12Hour, parseWeeklySchedule } from "@/lib/timing/locationStatus";

export interface FacilityHoursRow { label: string; value: string; today: boolean; listed: boolean }

/** Summarize one continuous schedule without implying that gaps are open. */
export function facilityHoursSummary(rows: FacilityHoursRow[]): string {
  const groups: Array<{ first: string; last: string; value: string; listed: boolean }> = [];
  for (const row of rows) {
    const labels = row.label.split(" – ");
    const previous = groups.at(-1);
    if (previous?.value === row.value) previous.last = labels.at(-1)!;
    else groups.push({ first: labels[0], last: labels.at(-1)!, value: row.value, listed: row.listed });
  }
  const listed = groups.filter(group => group.listed);
  if (listed.length !== 1) return listed.length ? "See weekly hours" : "Not listed";
  const group = listed[0];
  if (group.value === "Open 24 hours") return group.value;
  return `${group.first === group.last ? group.first : `${group.first} – ${group.last}`}: ${group.value}`;
}

/** Group equal neighbouring hours while keeping today's row distinct, in the facility timezone. */
export function facilityHoursRows(timings: string, timezone = "Asia/Kolkata", now = new Date()): FacilityHoursRow[] {
  const { schedule, is24x7, hasExplicitSchedule } = parseWeeklySchedule(timings);
  if (!hasExplicitSchedule) return [];
  let today = "";
  try { today = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone || "Asia/Kolkata" }).format(now).toLowerCase(); } catch { /* Invalid zones must not highlight the wrong day. */ }
  const week = [...DAYS_OF_WEEK.slice(1), DAYS_OF_WEEK[0]];
  const groups: Array<FacilityHoursRow & { first: string }> = [];
  for (const day of week) {
    const slots = schedule[day];
    const value = is24x7 ? "Open 24 hours" : slots.length ? slots.map(slot => `${formatMinutesTo12Hour(slot.startMinutes)} – ${formatMinutesTo12Hour(slot.endMinutes)}${slot.isOvernight ? " (next day)" : ""}`).join(", ") : "Not listed";
    const label = day.slice(0, 3).replace(/^./, char => char.toUpperCase());
    const row = groups.at(-1);
    if (row && row.value === value && !row.today && day !== today) row.label = `${row.first} – ${label}`;
    else groups.push({ label, value, today: day === today, listed: is24x7 || slots.length > 0, first: label });
  }
  return groups.map(({ label, value, today, listed }) => ({ label, value, today, listed }));
}
