import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectUserLocation, distanceBandLabel, hasLocationCoordinates } from "../lib/geo/locationDetector";

beforeEach(() => sessionStorage.clear());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); sessionStorage.clear(); });

describe("Directory location detection", () => {
  it("retains browser coordinates without requiring an external reverse geocoder", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: vi.fn(success => success({ coords: { latitude: 0, longitude: -73, accuracy: 20 } })) } });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const location = await detectUserLocation();
    expect(location).toMatchObject({ latitude: 0, longitude: -73, accuracy: 20, source: "gps" });
    expect(fetch).not.toHaveBeenCalled();
    expect(await detectUserLocation()).toMatchObject(location);
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("uses approximate IP coordinates when permission is denied and expires old caches", async () => {
    sessionStorage.setItem("ekavyu_detected_geo", JSON.stringify({ city: "Old city", latitude: 0, longitude: 0, source: "gps", detectedAt: Date.now() - 600000 }));
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: vi.fn((_success, error) => error({ code: 1 })) } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, city: "Surat", region: "Gujarat", latitude: 21.17, longitude: 72.83 }) }));
    expect(await detectUserLocation()).toMatchObject({ city: "Surat", latitude: 21.17, longitude: 72.83, source: "ip" });
  });

  it("bounds unavailable providers and leaves ordinary browsing available", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: vi.fn() } });
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("Timed out"))))));
    const detection = detectUserLocation();
    await vi.advanceTimersByTimeAsync(11000);
    expect(await detection).toEqual({ city: "", state: "", source: "fallback" });
  });

  it("validates signed coordinates and labels expanding distance bands honestly", () => {
    expect(hasLocationCoordinates({ city: "", state: "", source: "gps", latitude: 0, longitude: -180 })).toBe(true);
    expect(hasLocationCoordinates({ city: "", state: "", source: "ip", latitude: 91, longitude: 0 })).toBe(false);
    expect([0, 10, 10.1, 20, 20.1, 50, 63].map(km => distanceBandLabel(km))).toEqual(["Within 10 km", "Within 10 km", "Within 20 km", "Within 20 km", "Within 30 km", "Within 50 km", "63 km away"]);
    expect(distanceBandLabel(15, true)).toBe("Within 20 km (approx.)");
  });
});
