import { afterEach, expect, it, vi } from "vitest";
import BrowseDetailPage from "@/app/browse/[slug]/page";
import DoctorPage, { getDoctor, generateMetadata as doctorMetadata } from "@/app/doctor/[slug]/page";
import { doctorPath, locationPath } from "@/lib/publicPaths";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

vi.mock("@/app/browse/[slug]/BrowseDetailClient", () => ({ default: () => null }));

const profile = { id: "private-doctor", slug: "asha", name: "Asha", specialization: "General medicine", qualification: "MBBS", experienceYears: 2, description: "", imageUrl: null, languages: [], organizationName: "Care", organizationLogo: null, currency: "INR", locations: [{ id: "private-location", slug: "care-location", name: "Care", city: "Surat", address: "", logo: null, brandColor: "#0F6F66", fees: 300, feeType: "fixed", onlineBookingAvailable: true }] };

function findBooking(node: ReactNode): ReactElement | undefined {
  if (!isValidElement<{ children?: ReactNode }>(node)) return;
  if (typeof node.type === "function" && node.type.name === "DoctorBooking") return node;
  for (const child of Children.toArray(node.props.children)) {
    const booking = findBooking(child);
    if (booking) return booking;
  }
}
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
  const booking = page.props.children.find((child: { props: { initialLocation?: unknown } }) => child.props.initialLocation);
  expect(booking?.props.initialLocation).toEqual(location);
  expect(booking?.props.slug).toBe("care-location");
});
it("returns an unavailable doctor instead of loading a second profile representation", async () => {
  const request = vi.fn().mockResolvedValue({ ok: false, status: 404 });
  vi.stubGlobal("fetch", request);
  expect(await getDoctor("asha", "care-location")).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(expect.stringContaining("/api/public/doctors/asha/profile?location=care-location"), expect.anything());
});
it("opens the canonical doctor and location without an identifier redirect", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () => ({ data: url.includes("/profile") ? profile : { id: "private-location", slug: "care-location", doctors: [] } }) })));
  await expect(DoctorPage({ params: Promise.resolve({ slug: "asha" }), searchParams: Promise.resolve({ location: "care-location", openBooking: "true" }) })).resolves.toBeTruthy();
  vi.stubEnv("APP_URL", "https://care.example");
  const metadata = await doctorMetadata({ params: Promise.resolve({ slug: "asha" }), searchParams: Promise.resolve({ location: "care-location", openBooking: "true" }) });
  expect(metadata.alternates?.canonical).toBe("https://care.example/doctor/asha?location=care-location");
  expect(metadata.title).toContain("Dr. Asha at Care");
});

it.each(["success", "failure", "wrong-location"])("renders the doctor before a slow booking read settles: %s", async outcome => {
  type BookingResponse = { ok: boolean; json: () => Promise<{ data: unknown }> };
  let finish!: (response: BookingResponse) => void;
  let fail!: (error: Error) => void;
  const pending = new Promise<BookingResponse>((resolve, reject) => { finish = resolve; fail = reject; });
  const request = vi.fn((url: string) => url.includes("/profile")
    ? Promise.resolve({ ok: true, json: async () => ({ data: profile }) })
    : pending);
  vi.stubGlobal("fetch", request);

  // This must resolve while the clinic request is still pending; awaiting both would hang.
  const page = await DoctorPage({ params: Promise.resolve({ slug: "asha" }), searchParams: Promise.resolve({ location: "care-location" }) });
  const booking = findBooking(page);
  expect(booking).toBeDefined();
  const renderedBooking = Reflect.apply(booking!.type as (props: unknown) => ReactNode, null, [booking!.props]) as Promise<ReactElement<{ initialLocation: unknown; bookingDoctorId: string; slug: string }>>;
  const location = { id: "private-location", slug: "care-location", doctors: [{ id: "private-doctor" }] };
  if (outcome === "failure") fail(new Error("Timed out"));
  else finish({ ok: true, json: async () => ({ data: outcome === "wrong-location" ? { ...location, slug: "another-location" } : location }) });
  const client = await renderedBooking;
  expect(client.props.initialLocation).toEqual(outcome === "success" ? location : null);
  expect(client.props.bookingDoctorId).toBe("private-doctor");
  expect(client.props.slug).toBe("care-location");
  expect(request.mock.calls.filter(([url]) => url.includes("/api/public/locations/"))).toHaveLength(1);
});

it("starts one booking read for the default practice when the doctor link has no location query", async () => {
  const request = vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => ({ data: url.includes("/profile") ? profile : { slug: "care-location", doctors: [] } }) }));
  vi.stubGlobal("fetch", request);
  const page = await DoctorPage({ params: Promise.resolve({ slug: "asha" }), searchParams: Promise.resolve({}) });
  const booking = findBooking(page)!;
  await Reflect.apply(booking.type as (props: unknown) => ReactNode, null, [booking.props]);
  expect(request.mock.calls.filter(([url]) => url.includes("/locations/"))).toEqual([
    [expect.stringContaining("/locations/care-location?doctorId=asha"), expect.objectContaining({ cache: "no-store" })],
  ]);
});
