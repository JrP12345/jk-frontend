import { COUNTRIES, type CountryCode } from "./countries";

export type PatientOtpTarget = { email: string; phone?: never } | { phone: string; email?: never };

export function detectPatientOtpTarget(identifier: string, countryCode?: CountryCode): PatientOtpTarget | null {
  const value = identifier.trim();
  if (value.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { email: value.toLowerCase() } : null;
  }
  if (!/^\+?[\d\s().-]+$/.test(value)) return null;
  let phone = value.replace(/\D/g, "");
  if (countryCode && countryCode !== "IN" && !value.startsWith("+")) {
    // UK and UAE domestic numbers use a trunk zero, omitted internationally.
    if (countryCode === "GB" || countryCode === "AE") phone = phone.replace(/^0/, "");
    const international = `${COUNTRIES[countryCode].callingCode}${phone}`;
    return /^\+[1-9]\d{7,14}$/.test(international) ? { phone: international } : null;
  }
  if (value.startsWith("+") && /^(?:[1-9]\d{7,14})$/.test(phone) && !(phone.length === 12 && phone.startsWith("91"))) {
    return { phone: `+${phone}` };
  }
  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
  return /^\d{10}$/.test(phone) ? { phone } : null;
}

export function patientOtpDestination(target: PatientOtpTarget): string {
  if (target.email) return target.email;
  const phone = target.phone || "";
  return phone.startsWith("+") ? phone : `+91 ${phone}`;
}
