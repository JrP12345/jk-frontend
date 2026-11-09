import { describe, expect, it } from "vitest";
import { facilityHoursRows, facilityHoursSummary } from "@/app/browse/[slug]/facilityView";

describe("Facility hours presentation", () => {
  const timings = JSON.stringify(Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday"].map(day => [day, [{ start: "09:00", end: "17:00" }]])));
  it("groups equal listed hours without treating an unlisted weekend as closed", () => {
    expect(facilityHoursRows(timings, "Asia/Kolkata", new Date("2026-10-31T06:00:00Z"))).toEqual([
      { label: "Mon – Fri", value: "9:00 AM – 5:00 PM", today: false, listed: true },
      { label: "Sat", value: "Not listed", today: true, listed: false },
      { label: "Sun", value: "Not listed", today: false, listed: false },
    ]);
  });
  it("keeps today distinct in the facility timezone rather than the browser timezone", () => {
    const now = new Date("2026-10-31T00:30:00Z");
    expect(facilityHoursRows(timings, "Asia/Kolkata", now).find(row => row.today)?.label).toBe("Sat");
    expect(facilityHoursRows(timings, "America/New_York", now).find(row => row.today)?.label).toBe("Fri");
  });
  it("preserves split and overnight hours, and leaves unknown schedules absent", () => {
    expect(facilityHoursRows("", "UTC")).toEqual([]);
    const rows = facilityHoursRows(JSON.stringify({ monday: [{ start: "09:00", end: "12:00" }, { start: "22:00", end: "02:00" }] }), "UTC", new Date("2026-10-31T10:00:00Z"));
    expect(rows[0].value).toBe("9:00 AM – 12:00 PM, 10:00 PM – 2:00 AM (next day)");
    expect(facilityHoursRows("24/7", "UTC").every(row => row.value === "Open 24 hours")).toBe(true);
  });
  it("summarizes the whole saved schedule instead of showing only Monday", () => {
    expect(facilityHoursSummary(facilityHoursRows(timings, "UTC", new Date("2026-10-30T10:00:00Z")))).toBe("Mon – Fri: 9:00 AM – 5:00 PM");
    const nonconsecutive = JSON.stringify({ monday: [{ start: "09:00", end: "17:00" }], wednesday: [{ start: "09:00", end: "17:00" }] });
    expect(facilityHoursSummary(facilityHoursRows(nonconsecutive, "UTC"))).toBe("See weekly hours");
    expect(facilityHoursSummary([])).toBe("Not listed");
    expect(facilityHoursSummary(facilityHoursRows("24/7", "UTC"))).toBe("Open 24 hours");
  });
});
