import { describe, expect, it } from "vitest";
import { addCalendarDays, clinicClockMinutes, clinicDateKey, clinicLocalDateTimeInput, clinicLocalTimeToIso } from "@/lib/clinicTime";
import { detectPatientOtpTarget, patientOtpDestination } from "@/lib/patientLogin";

describe("clinic local time", () => {
  it("uses the clinic's calendar when the browser is on another day", () => {
    const instant = new Date("2026-09-29T00:30:00Z");
    expect(clinicDateKey(instant, "America/Los_Angeles")).toBe("2026-09-28");
    expect(clinicClockMinutes(instant, "America/Los_Angeles")).toBe(17 * 60 + 30);
    expect(clinicLocalDateTimeInput(instant, "America/Los_Angeles")).toBe("2026-09-28T17:30");
    expect(addCalendarDays("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("converts clinic slots to UTC across daylight saving time", () => {
    expect(clinicLocalTimeToIso("2026-01-15", "09:00", "America/New_York")).toBe("2026-01-15T14:00:00.000Z");
    expect(clinicLocalTimeToIso("2026-07-15", "09:00", "America/New_York")).toBe("2026-07-15T13:00:00.000Z");
    expect(clinicLocalTimeToIso("2026-09-29", "09:00", "Asia/Kolkata")).toBe("2026-09-29T03:30:00.000Z");
    expect(() => clinicLocalTimeToIso("2026-03-08", "02:30", "America/New_York")).toThrow();
    expect(() => clinicLocalTimeToIso("2026-02-30", "09:00", "America/New_York")).toThrow();
    expect(() => clinicLocalTimeToIso("2026-09-29", "24:00", "Asia/Kolkata")).toThrow();
  });
});

describe("patient phone entry", () => {
  it("preserves Indian accounts and accepts explicit international numbers", () => {
    expect(detectPatientOtpTarget("+91 98765 43210")).toEqual({ phone: "9876543210" });
    expect(detectPatientOtpTarget("+1 (415) 555-0199")).toEqual({ phone: "+14155550199" });
    expect(detectPatientOtpTarget("+44 20 7946 0123")).toEqual({ phone: "+442079460123" });
    expect(patientOtpDestination({ phone: "+14155550199" })).toBe("+14155550199");
    expect(detectPatientOtpTarget("4155550199")).toEqual({ phone: "4155550199" });
  });
});
