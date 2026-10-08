import type { Metadata } from "next";
import type { LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { absolutePublicUrl } from "./siteUrl";
import { locationPath } from "./publicPaths";

/** Mark up only explicit, valid day schedules. Never publish parser defaults. */
export function publicOpeningHours(timings?: string | null) {
  if (!timings) return [];
  try {
    const schedule = JSON.parse(timings);
    if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return [];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const validTime = (value: unknown): value is string => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    return days.flatMap((day) => {
      const key = Object.keys(schedule).find((key) => key.toLowerCase() === day.toLowerCase());
      const value = key ? schedule[key] : null;
      const intervals = Array.isArray(value) ? value : [value];
      return intervals.filter((interval) => interval && validTime(interval.start) && validTime(interval.end) && interval.start !== interval.end)
        .map((interval) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${day}`, opens: interval.start, closes: interval.end }));
    });
  } catch { return []; }
}

export function publicImageUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = value.startsWith("/") && !value.startsWith("//") ? new URL(value, absolutePublicUrl("/") || "https://invalid.local") : new URL(value);
    if (url.hostname === "invalid.local" || !["https:", "http:"].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}

export function profileMetadata(title: string, description: string, path: string, image?: string | null): Metadata {
  const url = absolutePublicUrl(path);
  const preview = publicImageUrl(image) || absolutePublicUrl("/ekavyu-home-social.png");
  return {
    title, description,
    alternates: url ? { canonical: url } : undefined,
    robots: { index: Boolean(url), follow: true },
    openGraph: { title, description, type: "website", siteName: "Ekavyu", ...(url ? { url } : {}), ...(preview ? { images: [{ url: preview, alt: title }] } : {}) },
    twitter: { card: preview ? "summary_large_image" : "summary", title, description, ...(preview ? { images: [preview] } : {}) },
  };
}

export function locationDescription(location: LocationDetail) {
  return `${location.name}${location.city ? ` in ${location.city}` : ""}. ${location.description || "View doctors, location details, opening hours and appointment options."}`.replace(/\s+/g, " ").slice(0, 300);
}

export function locationStructuredData(location: LocationDetail) {
  const url = absolutePublicUrl(locationPath(location));
  if (!url) return null;
  const types: Record<string, string> = { clinic: "MedicalClinic", hospital: "Hospital" };
  const image = publicImageUrl(location.image_url);
  const hours = publicOpeningHours(location.timings);
  return {
    "@context": "https://schema.org", "@type": types[location.facilityType || ""] || "MedicalBusiness",
    "@id": `${url}#facility`, url, name: location.name, description: locationDescription(location),
    ...(image ? { image } : {}),
    ...(location.phone ? { telephone: location.phone } : {}),
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    // Do not advertise the organization's head-office address as a branch address.
    address: { "@type": "PostalAddress", addressLocality: location.city, ...(location.address ? { streetAddress: location.address } : {}), ...(location.countryCode ? { addressCountry: location.countryCode } : {}) },
    ...(typeof location.latitude === "number" && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && typeof location.longitude === "number" && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 ? { geo: { "@type": "GeoCoordinates", latitude: location.latitude, longitude: location.longitude } } : {}),
    // No inferred hours, credentials, reviews, or guaranteed booking action.
  };
}

export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
