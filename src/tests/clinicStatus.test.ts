import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  formatMinutesTo12Hour,
  parseWeeklySchedule,
  getClinicOperationalStatus,
} from "../lib/timing/clinicStatus";

describe("Clinic Operational Status Engine", () => {
  describe("parseTimeToMinutes", () => {
    it("parses 24-hour time strings correctly", () => {
      expect(parseTimeToMinutes("00:00")).toBe(0);
      expect(parseTimeToMinutes("09:00")).toBe(540);
      expect(parseTimeToMinutes("13:30")).toBe(810);
      expect(parseTimeToMinutes("17:45")).toBe(1065);
      expect(parseTimeToMinutes("23:59")).toBe(1439);
    });

    it("parses 12-hour AM/PM time strings correctly", () => {
      expect(parseTimeToMinutes("12:00 AM")).toBe(0);
      expect(parseTimeToMinutes("9:00 AM")).toBe(540);
      expect(parseTimeToMinutes("9 AM")).toBe(540);
      expect(parseTimeToMinutes("12:00 PM")).toBe(720);
      expect(parseTimeToMinutes("1:30 PM")).toBe(810);
      expect(parseTimeToMinutes("5:45 PM")).toBe(1065);
      expect(parseTimeToMinutes("11:30 PM")).toBe(1410);
    });
  });

  describe("formatMinutesTo12Hour", () => {
    it("formats minutes into human readable 12-hour strings", () => {
      expect(formatMinutesTo12Hour(0)).toBe("12:00 AM");
      expect(formatMinutesTo12Hour(540)).toBe("9:00 AM");
      expect(formatMinutesTo12Hour(720)).toBe("12:00 PM");
      expect(formatMinutesTo12Hour(810)).toBe("1:30 PM");
      expect(formatMinutesTo12Hour(1065)).toBe("5:45 PM");
      expect(formatMinutesTo12Hour(1410)).toBe("11:30 PM");
    });
  });

  describe("getClinicOperationalStatus with arbitrary times", () => {
    // Helper to create a specific Date (2026-09-21 was a Monday)
    // 2026-09-21: Monday
    const createTestDate = (dayOfWeek: number, hours: number, minutes: number) => {
      // Start with Monday Sep 21, 2026
      const baseMonday = new Date(2026, 8, 21); // Month is 0-indexed (8 = September)
      const diffDays = dayOfWeek - 1; // 1 = Monday
      const targetDate = new Date(baseMonday);
      targetDate.setDate(baseMonday.getDate() + diffDays);
      targetDate.setHours(hours, minutes, 0, 0);
      return targetDate;
    };

    it("handles User Bug Scenario: 11:00 PM on a 9:00 AM - 5:00 PM clinic", () => {
      const timings = JSON.stringify({ start: "09:00", end: "17:00" });
      const mondayNight11pm = createTestDate(1, 23, 0); // Monday 23:00

      const status = getClinicOperationalStatus(timings, mondayNight11pm);
      expect(status.status).toBe("closed");
      expect(status.isOpen).toBe(false);
      expect(status.defaultLabel).toBe("Closed");
      expect(status.secondaryText).toBe("Opens tomorrow at 9:00 AM");
    });

    it("handles arbitrary evening clinic (4:00 PM – 11:30 PM): open at 11:00 PM", () => {
      const timings = JSON.stringify({ start: "16:00", end: "23:30" });

      // At 23:00 (11:00 PM), it is still open! Closes in 30 mins -> closing_soon
      const at11pm = createTestDate(1, 23, 0);
      const status11pm = getClinicOperationalStatus(timings, at11pm);
      expect(status11pm.status).toBe("closing_soon");
      expect(status11pm.isOpen).toBe(true);
      expect(status11pm.closingTime).toBe("11:30 PM");

      // At 23:45 (11:45 PM), it has closed
      const at1145pm = createTestDate(1, 23, 45);
      const status1145pm = getClinicOperationalStatus(timings, at1145pm);
      expect(status1145pm.status).toBe("closed");
      expect(status1145pm.isOpen).toBe(false);
      expect(status1145pm.secondaryText).toBe("Opens tomorrow at 4:00 PM");
    });

    it("handles arbitrary early morning clinic (7:15 AM – 3:45 PM)", () => {
      const timings = JSON.stringify({ start: "07:15", end: "15:45" });

      // At 6:30 AM: closed before open
      const at630am = createTestDate(1, 6, 30);
      const statusEarly = getClinicOperationalStatus(timings, at630am);
      expect(statusEarly.status).toBe("closed");
      expect(statusEarly.secondaryText).toBe("Opens today at 7:15 AM");

      // At 10:00 AM: open now
      const at10am = createTestDate(1, 10, 0);
      const statusOpen = getClinicOperationalStatus(timings, at10am);
      expect(statusOpen.status).toBe("open_now");
      expect(statusOpen.secondaryText).toBe("Closes at 3:45 PM");

      // At 3:30 PM: closing soon (15 mins left)
      const at330pm = createTestDate(1, 15, 30);
      const statusClosing = getClinicOperationalStatus(timings, at330pm);
      expect(statusClosing.status).toBe("closing_soon");
      expect(statusClosing.secondaryText).toContain("Closes in 15 mins (3:45 PM)");
    });

    it("handles Indian split shifts (9:30 AM – 1:30 PM & 5:00 PM – 9:30 PM)", () => {
      const timings = JSON.stringify([
        { start: "09:30", end: "13:30" },
        { start: "17:00", end: "21:30" },
      ]);

      // At 11:00 AM: morning open
      const at11am = createTestDate(1, 11, 0);
      const statusMorning = getClinicOperationalStatus(timings, at11am);
      expect(statusMorning.status).toBe("open_now");
      expect(statusMorning.secondaryText).toBe("Closes at 1:30 PM");

      // At 3:00 PM: on break
      const at3pm = createTestDate(1, 15, 0);
      const statusBreak = getClinicOperationalStatus(timings, at3pm);
      expect(statusBreak.status).toBe("on_break");
      expect(statusBreak.defaultLabel).toBe("On break");
      expect(statusBreak.secondaryText).toBe("Reopens today at 5:00 PM");

      // At 7:00 PM: evening open
      const at7pm = createTestDate(1, 19, 0);
      const statusEvening = getClinicOperationalStatus(timings, at7pm);
      expect(statusEvening.status).toBe("open_now");
      expect(statusEvening.secondaryText).toBe("Closes at 9:30 PM");

      // At 10:00 PM: closed for day
      const at10pm = createTestDate(1, 22, 0);
      const statusNight = getClinicOperationalStatus(timings, at10pm);
      expect(statusNight.status).toBe("closed");
      expect(statusNight.secondaryText).toBe("Opens tomorrow at 9:30 AM");
    });

    it("handles 24/7 continuous emergency clinic", () => {
      const timings = "24x7 Emergency Services";
      const midnight = createTestDate(1, 3, 0); // 3:00 AM

      const status = getClinicOperationalStatus(timings, midnight);
      expect(status.status).toBe("open_24_7");
      expect(status.isOpen).toBe(true);
      expect(status.defaultLabel).toBe("Open 24/7");
      expect(status.secondaryText).toContain("24 hours");
    });

    it("handles Sunday off-day with Monday opening", () => {
      // Monday-Saturday 10:00 AM - 6:00 PM (Sunday empty)
      const timings = JSON.stringify({
        monday: [{ start: "10:00", end: "18:00" }],
        saturday: [{ start: "10:00", end: "14:00" }],
      });

      // Test on Sunday (0) at 12:00 PM -> Tomorrow is Monday!
      const sundayNoon = createTestDate(0, 12, 0);
      const statusSunday = getClinicOperationalStatus(timings, sundayNoon);
      expect(statusSunday.status).toBe("closed_today");
      expect(statusSunday.defaultLabel).toBe("Closed today");
      expect(statusSunday.secondaryText).toBe("Opens tomorrow at 10:00 AM");

      // Test on Saturday (6) at 8:00 PM (after Saturday close) -> Sunday is closed -> Next is Monday!
      const saturdayNight = createTestDate(6, 20, 0);
      const statusSaturday = getClinicOperationalStatus(timings, saturdayNight);
      expect(statusSaturday.status).toBe("closed");
      expect(statusSaturday.secondaryText).toBe("Opens Monday at 10:00 AM");
    });

    it("parses plain text strings with arbitrary times like '8:30 AM - 4:15 PM'", () => {
      const timings = "8:30 AM - 4:15 PM";
      const atNoon = createTestDate(1, 12, 0);

      const status = getClinicOperationalStatus(timings, atNoon);
      expect(status.status).toBe("open_now");
      expect(status.secondaryText).toBe("Closes at 4:15 PM");
    });
  });
});
