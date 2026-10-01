export type PublicBookingStatus = "check_availability" | "contact_clinic" | "no_doctors";

export function getPublicBookingStatus(value: {
  bookingStatus?: string | null;
  onlineBookingAvailable?: boolean;
  doctorCount?: number;
}): PublicBookingStatus {
  if (value.doctorCount === 0) return "no_doctors";
  if (value.onlineBookingAvailable === false) return "contact_clinic";
  if (value.bookingStatus === "check_availability" || value.bookingStatus === "contact_clinic" || value.bookingStatus === "no_doctors") {
    return value.bookingStatus;
  }
  return "check_availability";
}
