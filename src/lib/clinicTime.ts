const dateParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const number = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: number("year"), month: number("month"), day: number("day"), hour: number("hour"), minute: number("minute") };
};

export function clinicDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = dateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function clinicClockMinutes(date: Date, timeZone: string): number {
  const { hour, minute } = dateParts(date, timeZone);
  return hour * 60 + minute;
}

export function clinicLocalDateTimeInput(date: Date, timeZone: string): string {
  const { year, month, day, hour, minute } = dateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function addCalendarDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function clinicLocalTimeToIso(dateKey: string, time: string, timeZone: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isInteger)) throw new Error("Invalid appointment time");
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{2}:\d{2}(?::00)?$/.test(time)
    || calendarDate.toISOString().slice(0, 10) !== dateKey || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("Invalid appointment time");
  }
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wanted;
  for (let attempt = 0; attempt < 4; attempt++) {
    const found = dateParts(new Date(instant), timeZone);
    const observed = Date.UTC(found.year, found.month - 1, found.day, found.hour, found.minute);
    if (observed === wanted) return new Date(instant).toISOString();
    instant += wanted - observed;
  }
  throw new Error("This clinic time is unavailable due to a timezone change. Select another slot.");
}
