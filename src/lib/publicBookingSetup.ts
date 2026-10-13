import type { LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { getPublicBookingStatus } from "./publicBooking";
import { parseWeeklySchedule } from "./timing/locationStatus";

/** The same public response drives setup guidance and the share-link review. */
export function publicBookingChecklist(location: LocationDetail) {
  return [
    { label: "At least one doctor is listed", complete: location.doctors.length > 0 },
    { label: "Online appointments are enabled", complete: getPublicBookingStatus({ ...location, doctorCount: location.doctors.length }) === "check_availability" },
    { label: "A contact number is listed", complete: Boolean(location.phone || location.organization?.phone) },
    { label: "The location address is listed", complete: Boolean(location.address) },
    { label: "Opening hours are listed", complete: parseWeeklySchedule(location.timings).hasExplicitSchedule },
    { label: "Consultation fees are clear", complete: location.doctors.length > 0 && location.doctors.every(doctor => doctor.feeType === "free" || doctor.feeType === "post_consultation" || doctor.fees > 0) },
  ];
}
