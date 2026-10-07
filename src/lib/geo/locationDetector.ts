"use client";

export interface DetectedLocation {
  city: string;
  state: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  source: "gps" | "ip" | "fallback";
}

const CACHE_KEY = "ekavyu_detected_geo";
const CACHE_AGE = 5 * 60 * 1000;

export function hasLocationCoordinates(location: DetectedLocation | null): location is DetectedLocation & { latitude: number; longitude: number } {
  return typeof location?.latitude === "number" && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 &&
    typeof location.longitude === "number" && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
}

export function findMatchingLocationCity(detectedCity: string, locationCities: string[]): string | null {
  return locationCities.find(city => city.trim().toLowerCase() === detectedCity.trim().toLowerCase()) || null;
}

function cache(location: DetectedLocation): DetectedLocation {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...location, detectedAt: Date.now() })); } catch { /* Optional cache. */ }
  return location;
}

/** GPS needs browser permission. IP coordinates are an approximate area only. */
export async function detectUserLocation(): Promise<DetectedLocation> {
  const fallback: DetectedLocation = { city: "", state: "", source: "fallback" };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    const detectedAt: unknown = saved?.detectedAt;
    if (saved && ["gps", "ip"].includes(saved.source) && hasLocationCoordinates(saved) &&
      typeof detectedAt === "number" && Date.now() - detectedAt >= 0 && Date.now() - detectedAt < CACHE_AGE) return saved;
  } catch { /* Ignore stale or malformed cache. */ }

  const gps = await new Promise<DetectedLocation | null>(resolve => {
    if (!navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 5000);
    try {
      navigator.geolocation.getCurrentPosition(position => {
        clearTimeout(timer);
        const location: DetectedLocation = { city: "", state: "", source: "gps", latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
        // Ranking needs coordinates, so reverse geocoding cannot delay or break it.
        resolve(hasLocationCoordinates(location) ? location : null);
      }, () => { clearTimeout(timer); resolve(null); }, { timeout: 4500, enableHighAccuracy: true, maximumAge: CACHE_AGE });
    } catch { clearTimeout(timer); resolve(null); }
  });
  if (gps) return cache(gps);

  for (const endpoint of ["https://ipwho.is/", "https://ipapi.co/json/"]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.success === false || data.error) continue;
      const location: DetectedLocation = { city: typeof data.city === "string" ? data.city : "", state: typeof data.region === "string" ? data.region : "", country: data.country_name || data.country, latitude: data.latitude, longitude: data.longitude, source: "ip" };
      if (hasLocationCoordinates(location)) return cache(location);
    } catch { /* Try the next provider, then show the ordinary directory. */ }
    finally { clearTimeout(timer); }
  }
  return fallback;
}

export function distanceBandLabel(distanceKm: number, approximate = false): string {
  const label = distanceKm <= 50
    ? `Within ${Math.max(10, Math.ceil(distanceKm / 10) * 10)} km`
    : `${Math.round(distanceKm)} km away`;
  return approximate ? `${label} (approx.)` : label;
}
