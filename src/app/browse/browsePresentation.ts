import type { Location } from "./BrowseClient";
import { getPublicBookingStatus } from "@/lib/publicBooking";

export type MapBounds = [south: number, west: number, north: number, east: number];
export function facilityCoordinates(location: Location): [number, number] | null {
  const { latitude, longitude } = location;
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90 && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0) ? [latitude, longitude] : null;
}
export function facilityPresentation(location: Location) {
  const address = location.address.trim() === "." ? "" : location.address.trim();
  const city = location.city.trim();
  const parts = address.toLocaleLowerCase().split(",").map(part => part.trim());
  const whereabouts = [address, city && !parts.includes(city.toLocaleLowerCase()) ? city : ""].filter(Boolean).join(", ");
  const coordinates = facilityCoordinates(location);
  const destination = coordinates ? coordinates.join(",") : whereabouts ? [location.name, whereabouts].join(", ") : null;
  const phone = location.phone.trim(), dial = phone.replace(/[^+\d]/g, "");
  const callable = /^\+?[\d\s().-]+$/.test(phone) && /^\+?\d{7,15}$/.test(dial);
  const bookable = location.onlineBookingAvailable === true && getPublicBookingStatus(location) === "check_availability";
  return {
    whereabouts, phone, dial, callable, bookable,
    directionsUrl: destination ? `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", destination })}` : null,
    specialties: [...new Set((location.specialties || []).map(value => value.trim()).filter(value => value && value.toLowerCase() !== "specialty not listed"))].slice(0, 2),
    actionLabel: bookable ? "Book appointment" : location.facilityType === "clinic" ? "View clinic" : location.facilityType === "hospital" ? "View hospital" : "View facility",
  };
}
