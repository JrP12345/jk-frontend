import { describe, expect, it } from "vitest";
import { addCalendarDays, locationClockMinutes, locationDateKey, locationLocalDateTimeInput, locationLocalTimeToIso } from "@/lib/locationTime";
import { detectPatientOtpTarget, patientOtpDestination } from "@/lib/patientLogin";
import { COUNTRIES, countryOptions, phoneCountryOptions } from "@/lib/countries";

describe("clinic local time", () => {
  it("uses the clinic's calendar when the browser is on another day", () => {
    const instant = new Date("2026-09-29T00:30:00Z");
    expect(locationDateKey(instant, "America/Los_Angeles")).toBe("2026-09-28");
    expect(locationClockMinutes(instant, "America/Los_Angeles")).toBe(17 * 60 + 30);
    expect(locationLocalDateTimeInput(instant, "America/Los_Angeles")).toBe("2026-09-28T17:30");
    expect(addCalendarDays("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("converts clinic slots to UTC across daylight saving time", () => {
    expect(locationLocalTimeToIso("2026-01-15", "09:00", "America/New_York")).toBe("2026-01-15T14:00:00.000Z");
    expect(locationLocalTimeToIso("2026-07-15", "09:00", "America/New_York")).toBe("2026-07-15T13:00:00.000Z");
    expect(locationLocalTimeToIso("2026-09-29", "09:00", "Asia/Kolkata")).toBe("2026-09-29T03:30:00.000Z");
    expect(() => locationLocalTimeToIso("2026-03-08", "02:30", "America/New_York")).toThrow();
    expect(() => locationLocalTimeToIso("2026-02-30", "09:00", "America/New_York")).toThrow();
    expect(() => locationLocalTimeToIso("2026-09-29", "24:00", "Asia/Kolkata")).toThrow();
  });
});

describe("patient phone entry", () => {
  it("uses one country list for organization setup and phone selection", () => {
    expect(phoneCountryOptions.map(country => country.value)).toEqual(countryOptions.map(country => country.value));
    expect(COUNTRIES.GB).toMatchObject({ currency: "GBP", timezone: "Europe/London", callingCode: "+44" });
    expect(detectPatientOtpTarget("9876543210", "IN")).toEqual({ phone: "9876543210" });
    expect(detectPatientOtpTarget("+91 9876543210", "US")).toEqual({ phone: "9876543210" });
    expect(detectPatientOtpTarget("+44 20 7946 0123", "GB")).toEqual({ phone: "+442079460123" });
    expect(detectPatientOtpTarget("12345", "US")).toBeNull();
    expect(detectPatientOtpTarget("abc4155550199", "US")).toBeNull();
    expect(detectPatientOtpTarget("41555501991234567", "US")).toBeNull();
    expect(detectPatientOtpTarget(" Patient@Example.COM ", "AE")).toEqual({ email: "patient@example.com" });
  });
  it("preserves Indian accounts and accepts explicit international numbers", () => {
    expect(detectPatientOtpTarget("+91 98765 43210")).toEqual({ phone: "9876543210" });
    expect(detectPatientOtpTarget("+1 (415) 555-0199")).toEqual({ phone: "+14155550199" });
    expect(detectPatientOtpTarget("+44 20 7946 0123")).toEqual({ phone: "+442079460123" });
    expect(patientOtpDestination({ phone: "+14155550199" })).toBe("+14155550199");
    expect(detectPatientOtpTarget("4155550199")).toEqual({ phone: "4155550199" });
  });
});
