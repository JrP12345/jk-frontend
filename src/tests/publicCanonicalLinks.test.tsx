import { afterEach, expect, it, vi } from "vitest";
import BrowseDetailPage from "@/app/browse/[slug]/page";
import DoctorPage, { getDoctor, generateMetadata as doctorMetadata } from "@/app/doctor/[slug]/page";
import { doctorPath, locationPath } from "@/lib/publicPaths";

vi.mock("@/app/browse/[slug]/BrowseDetailClient", () => ({ default: () => null }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("uses only public slugs when generating location and doctor links", () => {
  expect(locationPath({ id: "private-location", slug: "care-location" })).toBe("/browse/care-location");
  expect(doctorPath({ id: "private-doctor", slug: "asha" }, { id: "private-location", slug: "care-location" })).toBe("/doctor/asha?location=care-location");
  expect(locationPath({ id: "private-location" })).toBe("/browse");
  expect(doctorPath({ id: "private-doctor" }, { id: "private-location" })).toBe("/browse");
});
it("passes the canonical location record to the booking client", async () => {
  const location = { id: "private-location", slug: "care-location", doctors: [] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: location }) }));
  const page = await BrowseDetailPage({ params: Promise.resolve({ slug: "care-location" }) });
  expect(page.props.children[1].props.initialLocation).toEqual(location);
  expect(page.props.children[1].props.slug).toBe("care-location");
});
it("returns an unavailable doctor instead of loading a second profile representation", async () => {
  const request = vi.fn().mockResolvedValue({ ok: false, status: 404 });
  vi.stubGlobal("fetch", request);
  expect(await getDoctor("asha", "care-location")).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(expect.stringContaining("/api/public/doctors/asha/profile?location=care-location"), expect.anything());
});
it("opens the canonical doctor and location without an identifier redirect", async () => {
  const profile = { id: "private-doctor", slug: "asha", name: "Asha", specialization: "General medicine", qualification: "MBBS", experienceYears: 2, description: "", imageUrl: null, languages: [], organizationName: "Care", organizationLogo: null, currency: "INR", locations: [{ id: "private-location", slug: "care-location", name: "Care", city: "Surat", address: "", logo: null, brandColor: "#0F6F66", fees: 300, feeType: "fixed", onlineBookingAvailable: true }] };
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => ({ data: url.includes("/profile") ? profile : { id: "private-location", slug: "care-location", doctors: [] } }) })));
  await expect(DoctorPage({ params: Promise.resolve({ slug: "asha" }), searchParams: Promise.resolve({ location: "care-location", openBooking: "true" }) })).resolves.toBeTruthy();
  vi.stubEnv("APP_URL", "https://care.example");
  const metadata = await doctorMetadata({ params: Promise.resolve({ slug: "asha" }), searchParams: Promise.resolve({ location: "care-location", openBooking: "true" }) });
  expect(metadata.alternates?.canonical).toBe("https://care.example/doctor/asha?location=care-location");
  expect(metadata.title).toContain("Dr. Asha at Care");
});
