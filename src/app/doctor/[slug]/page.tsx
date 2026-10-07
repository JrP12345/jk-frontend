import { locationPath, doctorPath, hasMultipleLocations } from "@/lib/publicPaths";
import { facilityTypeLabel, type FacilityType } from "@/lib/facility";
import LoadingImage from "@/components/ui/LoadingImage";
import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { LoadingState, SkeletonForm } from "@/components/ui";
import Link from "next/link";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import BrowseDetailClient, { type LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { getPublicBookingStatus, type PublicBookingStatus } from "@/lib/publicBooking";

export const dynamic = "force-dynamic";

type DoctorProfile = {
  id: string;
  slug?: string;
  name: string;
  specialization: string;
  qualification: string;
  experienceYears: number;
  description: string;
  imageUrl: string | null;
  languages: string[];
  organizationName: string;
  organizationLocationCount?: number;
  organizationLogo: string | null;
  currency: string;
  locations: Array<{
    facilityType?: FacilityType | null;
    id: string;
  slug?: string; name: string; city: string; address: string; logo: string | null;
    brandColor: string; fees: number; feeType: "fixed" | "free" | "post_consultation";
    onlineBookingAvailable: boolean;
    bookingStatus?: PublicBookingStatus;
  }>;
};

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000";
}

function doctorDisplayName(name: string) {
  return /^Dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

export const getDoctor = cache(async function getDoctor(slug: string, locationSlug?: string): Promise<DoctorProfile | null> {
  try {
    const response = await fetch(`${backendUrl()}/api/public/doctors/${encodeURIComponent(slug)}/profile${locationSlug ? `?location=${encodeURIComponent(locationSlug)}` : ""}`, {
      cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.data) return { ...result.data, name: doctorDisplayName(result.data.name) };
    }
  } catch { /* A failed profile request renders the recovery view. */ }
  return null;
});

async function getLocationForBooking(locationSlug: string, doctorSlug: string): Promise<LocationDetail | null> {
  try {
    const response = await fetch(`${backendUrl()}/api/public/locations/${encodeURIComponent(locationSlug)}?doctorId=${encodeURIComponent(doctorSlug)}`, {
      cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.data?.slug === locationSlug && Array.isArray(result.data?.doctors) ? result.data : null;
  } catch { return null; }
}

function consultationFee(location: DoctorProfile["locations"][number], currency: string) {
  if (location.feeType === "free") return "Free";
  const amount = Number.isFinite(location.fees) && location.fees > 0
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(location.fees)
    : null;
  if (location.feeType === "post_consultation") return amount ? `From ${amount} · final fee after consultation` : "Decided after consultation";
  return amount || "Ask reception for fee";
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ location?: string; openBooking?: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const locationSlug = query.location;
  const doctor = await getDoctor(slug, locationSlug);
  return {
    title: doctor ? `${doctor.name} | Book an appointment` : "Doctor profile unavailable",
    description: doctor ? `View ${doctor.name}'s practice locations and book an appointment.` : "This doctor profile is unavailable.",
  };
}

export default async function DoctorPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ location?: string; openBooking?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const locationSlug = query.location;
  const [doctor, requestedLocation] = await Promise.all([
    getDoctor(slug, locationSlug),
    locationSlug ? getLocationForBooking(locationSlug, slug) : Promise.resolve(null),
  ]);
  const locations = doctor?.locations || [];
  const selectedLocation = locations.find((location) => location.slug === locationSlug) || locations[0];
  const bookingLocation = selectedLocation
    ? selectedLocation.slug === locationSlug ? requestedLocation : await getLocationForBooking(selectedLocation.slug!, doctor!.slug!)
    : null;

  return <div className="min-h-screen bg-surface-alt text-text">
    <MarketplaceNavbar brand={selectedLocation ? { name: doctor && hasMultipleLocations(doctor) ? doctor.organizationName : selectedLocation.name, logoUrl: doctor?.organizationLogo || selectedLocation.logo, href: locationPath(selectedLocation) } : undefined} />
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-24 sm:px-6 sm:pt-28 lg:pb-16">
      {!doctor ? <section className="rounded-3xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">Doctor profile unavailable</h1>
        <p className="mt-2 text-text-secondary">This link may have changed. Browse available locations to find an appointment.</p>
        <Link href="/browse" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-5 font-semibold text-brand-mist">Browse locations</Link>
      </section> : <>
        {selectedLocation && hasMultipleLocations(doctor) && selectedLocation.name !== doctor.organizationName && <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3" style={{ borderLeft: `4px solid ${selectedLocation.brandColor}` }}>
          {selectedLocation.logo || doctor.organizationLogo ? (
            <LoadingImage src={selectedLocation.logo || doctor.organizationLogo || ""} alt="" className="h-11 w-11 rounded-xl border border-border bg-surface object-contain" />
          ) : <div aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10 font-bold text-accent">{selectedLocation.name.slice(0, 1)}</div>}
          <div className="min-w-0"><p className="truncate text-sm font-bold">{doctor.organizationName}</p><p className="truncate text-xs text-text-secondary">Appointments at {selectedLocation.name}</p></div>
        </div>}
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <Link href="/browse" className="hover:text-accent">Browse locations</Link><span aria-hidden="true">/</span>
          {selectedLocation && <><Link href={locationPath(selectedLocation)} className="hover:text-accent">{selectedLocation.name}</Link><span aria-hidden="true">/</span></>}
          <span className="font-semibold text-text">{doctor.name}</span>
        </nav>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
          <div className="contents">
            <section className="order-1 min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-6 lg:col-start-1 lg:row-start-1" style={selectedLocation ? { borderTop: `4px solid ${selectedLocation.brandColor}` } : undefined}>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Doctor profile</p>
              <div className="mt-3 flex items-start gap-3 sm:gap-4">
                {doctor.imageUrl ? (
                  <LoadingImage src={doctor.imageUrl} alt={doctor.name} className="h-16 w-16 sm:h-24 sm:w-24 shrink-0 rounded-xl border border-border object-cover" />
                ) : <div aria-hidden="true" className="flex h-16 w-16 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-2xl font-semibold text-accent">{doctor.name.slice(0, 1)}</div>}
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold sm:text-2xl break-words">{doctor.name}</h1>
                  <p className="mt-1 text-base font-medium text-accent">{doctor.specialization}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                    {doctor.qualification && <span>{doctor.qualification}</span>}
                    {doctor.experienceYears > 0 && <span>{doctor.experienceYears} years of experience</span>}
                  </div>
                  {doctor.languages.length > 0 && <p className="mt-3 text-sm text-text-secondary">Consultations in {doctor.languages.join(", ")}</p>}
                </div>
              </div>
              {selectedLocation && <a href="#booking" className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary-600 px-5 text-sm font-semibold text-brand-mist hover:bg-primary-700 sm:w-auto">{getPublicBookingStatus({ ...selectedLocation, doctorCount: 1 }) === "check_availability" ? "Check appointment times" : "See contact options"}</a>}
            </section>
            {doctor.description && <section className="order-3 min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-7 lg:col-start-1 lg:row-start-2" aria-labelledby="doctor-about-title"><h2 id="doctor-about-title" className="text-lg font-bold">About {doctor.name}</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-secondary">{doctor.description}</p></section>}
            <section className={`order-4 min-w-0 lg:col-start-1 ${doctor.description ? "lg:row-start-3" : "lg:row-start-2"}`} aria-labelledby="doctor-locations-title">
              <h2 id="doctor-locations-title" className="text-xl font-bold">Practice locations</h2>
              <p className="mt-1 text-sm text-text-secondary">Fees and booking options can vary by location.</p>
              <div className="mt-4 grid gap-3">{locations.map((location) => <article key={location.id} className={`rounded-2xl border bg-surface p-5 ${location.id === selectedLocation?.id ? "border-primary-600" : "border-border"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold">{location.name}</h3><p className="mt-1 text-sm text-text-secondary">{facilityTypeLabel(location.facilityType)}</p><p className="mt-1 text-sm text-text-secondary">{[location.address, location.city].filter(Boolean).join(", ")}</p></div><span className="text-sm font-semibold">{consultationFee(location, doctor.currency)}</span></div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><Link href={locationPath(location)} className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">View location details</Link>{location.id !== selectedLocation?.id && <Link href={`${doctorPath(doctor, location)}#booking`} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">{getPublicBookingStatus({ ...location, doctorCount: 1 }) === "check_availability" ? "Check times at this location" : "Contact this location"}</Link>}{location.id === selectedLocation?.id && <span className="font-medium text-text-secondary">Selected location</span>}</div>
              </article>)}</div>
            </section>
          </div>
          <aside id="booking" className="order-2 min-w-0 scroll-mt-24 lg:col-start-2 lg:row-span-3 lg:row-start-1" aria-label="Book an appointment">
            {selectedLocation && <Suspense fallback={<LoadingState label="Loading booking options"><SkeletonForm fields={3} /></LoadingState>}><BrowseDetailClient key={selectedLocation.id} slug={selectedLocation.slug!} initialLocation={bookingLocation} bookingDoctorId={doctor.id} bookingOnly bookingName={selectedLocation.name} /></Suspense>}
          </aside>
        </div>
      </>}
    </main>
  </div>;
}
