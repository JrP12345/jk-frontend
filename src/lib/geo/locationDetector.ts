"use client";

import { LanguageCode } from "@/lib/i18n";

export interface DetectedLocation {
  city: string;
  state: string;
  country?: string;
  source: "gps" | "ip" | "fallback";
}

const CACHE_KEY = "ananta_detected_geo";

export function mapStateToLanguage(state: string, city?: string): LanguageCode {
  const s = (state || "").toLowerCase().trim();
  const c = (city || "").toLowerCase().trim();

  // 1. Gujarat & Major Gujarati Cities
  if (
    s.includes("gujarat") ||
    [
      "valsad",
      "ahmedabad",
      "surat",
      "vadodara",
      "rajkot",
      "bhavnagar",
      "jamnagar",
      "gandhinagar",
      "junagadh",
      "anand",
      "navsari",
      "morbi",
      "vapi",
      "bharuch",
      "mehsana",
      "bhuj",
      "porbandar",
    ].includes(c)
  ) {
    return "gu";
  }

  // 2. Maharashtra & Major Marathi Cities
  if (
    s.includes("maharashtra") ||
    [
      "mumbai",
      "pune",
      "nagpur",
      "nashik",
      "thane",
      "chhatrapati sambhajinagar",
      "aurangabad",
      "solapur",
      "amravati",
      "kolhapur",
      "navi mumbai",
      "jalgaon",
      "akola",
      "latur",
      "dhule",
      "ahmednagar",
      "chandrapur",
      "parbhani",
    ].includes(c)
  ) {
    return "mr";
  }

  // 3. Hindi Belt States & Major Cities
  const hindiStates = [
    "delhi",
    "uttar pradesh",
    "madhya pradesh",
    "rajasthan",
    "bihar",
    "haryana",
    "himachal pradesh",
    "uttarakhand",
    "chandigarh",
    "chhattisgarh",
    "jharkhand",
  ];

  if (hindiStates.some((hs) => s.includes(hs))) {
    return "hi";
  }

  const hindiCities = [
    "delhi",
    "new delhi",
    "noida",
    "gurgaon",
    "gurugram",
    "jaipur",
    "lucknow",
    "kanpur",
    "indore",
    "bhopal",
    "patna",
    "agra",
    "varanasi",
    "prayagraj",
    "ghaziabad",
    "faridabad",
    "meerut",
    "jodhpur",
    "kota",
    "gwalior",
    "jabalpur",
    "ranchi",
    "raipur",
    "dehradun",
  ];

  if (hindiCities.includes(c)) {
    return "hi";
  }

  return "en";
}

export function findMatchingClinicCity(detectedCity: string, clinicCities: string[]): string | null {
  if (!detectedCity || !clinicCities || clinicCities.length === 0) return null;
  const cleanDetected = detectedCity.toLowerCase().trim();

  // Direct case-insensitive match
  const directMatch = clinicCities.find((c) => c.toLowerCase().trim() === cleanDetected);
  if (directMatch) return directMatch;

  // Partial/contains match
  const partialMatch = clinicCities.find((c) => {
    const cleanC = c.toLowerCase().trim();
    return cleanC.includes(cleanDetected) || cleanDetected.includes(cleanC);
  });

  return partialMatch || null;
}

/**
 * Dual Location Detection:
 * 1. Checks session cache.
 * 2. Tries browser GPS with a gentle 3-second timeout.
 * 3. Falls back smoothly to IP-based location (zero permissions needed).
 */
export async function detectUserLocation(): Promise<DetectedLocation> {
  if (typeof window === "undefined") {
    return { city: "", state: "", source: "fallback" };
  }

  // 1. Check Session Cache
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.city || parsed?.state) {
        return parsed;
      }
    }
  } catch {}

  // 2. Try Browser GPS
  try {
    const gpsLocation = await new Promise<DetectedLocation | null>((resolve) => {
      if (!navigator.geolocation) {
        return resolve(null);
      }

      const timer = setTimeout(() => {
        resolve(null); // Timeout fallback to IP
      }, 3000);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          clearTimeout(timer);
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            if (res.ok) {
              const data = await res.json();
              const city = data.city || data.locality || "";
              const state = data.principalSubdivision || "";
              const country = data.countryName || "India";
              if (city || state) {
                return resolve({ city, state, country, source: "gps" });
              }
            }
          } catch {}
          resolve(null);
        },
        () => {
          clearTimeout(timer);
          resolve(null); // Permission denied / error -> fallback to IP
        },
        { timeout: 2800, enableHighAccuracy: false, maximumAge: 300000 }
      );
    });

    if (gpsLocation) {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(gpsLocation));
      } catch {}
      return gpsLocation;
    }
  } catch {}

  // 3. Fallback: IP-based Location (Zero-permission instant detection)
  try {
    const ipRes = await fetch("https://ipwho.is/");
    if (ipRes.ok) {
      const data = await ipRes.json();
      if (data && data.success !== false && (data.city || data.region)) {
        const result: DetectedLocation = {
          city: data.city || "",
          state: data.region || "",
          country: data.country || "India",
          source: "ip",
        };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
        } catch {}
        return result;
      }
    }
  } catch {}

  // Secondary IP Fallback
  try {
    const ipApiRes = await fetch("https://ipapi.co/json/");
    if (ipApiRes.ok) {
      const data = await ipApiRes.json();
      if (data && (data.city || data.region)) {
        const result: DetectedLocation = {
          city: data.city || "",
          state: data.region || "",
          country: data.country_name || "India",
          source: "ip",
        };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
        } catch {}
        return result;
      }
    }
  } catch {}

  return { city: "", state: "", source: "fallback" };
}
