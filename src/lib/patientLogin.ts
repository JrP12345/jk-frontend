export type PatientOtpTarget = { email: string; phone?: never } | { phone: string; email?: never };

export function detectPatientOtpTarget(identifier: string): PatientOtpTarget | null {
  const value = identifier.trim();
  if (value.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { email: value.toLowerCase() } : null;
  }
  if (!/^\+?[\d\s().-]+$/.test(value)) return null;
  let phone = value.replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("91")) phone = phone.slice(2);
  else if (phone.length === 11 && phone.startsWith("0")) phone = phone.slice(1);
  return /^\d{10}$/.test(phone) ? { phone } : null;
}

export function patientOtpDestination(target: PatientOtpTarget): string {
  return target.email || `+91 ${target.phone}`;
}
