export type PublicBookingStatus = "check_availability" | "contact_location" | "no_doctors";

export function getPublicBookingStatus(value: {
  bookingStatus?: string | null;
  onlineBookingAvailable?: boolean;
  doctorCount?: number;
}): PublicBookingStatus {
  if (value.doctorCount === 0) return "no_doctors";
  if (value.onlineBookingAvailable === false) return "contact_location";
  if (value.bookingStatus === "check_availability" || value.bookingStatus === "contact_location" || value.bookingStatus === "no_doctors") {
    return value.bookingStatus;
  }
  return "check_availability";
}
