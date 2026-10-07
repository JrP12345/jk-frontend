import { addCalendarDays, locationDateKey, locationLocalTimeToIso } from "./locationTime";

export function locationTodayRange(timezone: string, now = new Date()) {
  const date = locationDateKey(now, timezone);
  const start = locationLocalTimeToIso(date, "00:00", timezone);
  const end = new Date(new Date(locationLocalTimeToIso(addCalendarDays(date, 1), "00:00", timezone)).getTime() - 1).toISOString();
  return new URLSearchParams({ startDate: start, endDate: end }).toString();
}
export function validSingleChoice<T>(options: T[], id: (value: T) => string, current = "") {
  return options.some(value => id(value) === current) ? current : options.length === 1 ? id(options[0]) : "";
}
export interface WorkflowPatient {
  id?: string; _id?: string; name?: string; phone?: string; mrn?: string;
  userId?: { name?: string; phone?: string };
}
export const patientName = (patient?: WorkflowPatient) => patient?.userId?.name || patient?.name || "Patient";
export const patientPhone = (patient?: WorkflowPatient) => patient?.userId?.phone || patient?.phone || "";
export const recordId = (record: { id?: string; _id?: string } | string | undefined) => typeof record === "string" ? record : record?.id || record?._id || "";
