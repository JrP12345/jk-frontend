import { locationPath, doctorPath, hasMultipleLocations } from "@/lib/publicPaths";
import { type FacilityType } from "@/lib/facility";
import LoadingImage from "@/components/ui/LoadingImage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProfile, publicBackendUrl } from "@/lib/publicProfile";
import { profileMetadata, publicImageUrl } from "@/lib/publicSeo";
import { absolutePublicUrl } from "@/lib/siteUrl";
import PublicStructuredData from "@/components/PublicStructuredData";
import PublicBrandStyles from "@/components/PublicBrandStyles";
import PublicProfileShare from "@/components/PublicProfileShare";
import { Suspense, cache } from "react";
import { Breadcrumbs, Card, CardTitle, LoadingState, SkeletonForm, cn } from "@/components/ui";
import Link from "next/link";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import BrowseDetailClient, { type LocationDetail } from "@/app/browse/[slug]/BrowseDetailClient";
import { getPublicBookingStatus, type PublicBookingStatus } from "@/lib/publicBooking";

import { getAvatarInitials } from "@/lib/avatar";
import { publicConsultationFee as consultationFee } from "@/lib/publicFees";
import marketplace from "@/components/MarketplaceLayout.module.css";
import care from "@/components/PublicCare.module.css";
import styles from "./doctor.module.css";

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
    bookingMode?: "time_slot" | "sequential_queue";
  }>;
};

function doctorDisplayName(name: string) {
  return /^Dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

export const getDoctor = cache(async function getDoctor(slug: string, locationSlug?: string): Promise<DoctorProfile | null> {
  const data = await getPublicProfile(`doctors/${encodeURIComponent(slug)}/profile${locationSlug ? `?location=${encodeURIComponent(locationSlug)}` : ""}`);
  return data ? { ...data, name: doctorDisplayName(data.name) } : null;
});

async function getLocationForBooking(locationSlug: string, doctorSlug: string): Promise<LocationDetail | null> {
  try {
    const response = await fetch(`${publicBackendUrl()}/api/public/locations/${encodeURIComponent(locationSlug)}?doctorId=${encodeURIComponent(doctorSlug)}`, {
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.data?.slug === locationSlug && Array.isArray(result.data?.doctors) ? result.data : null;
  } catch { return null; }
}

async function DoctorBooking({ location, doctorId, initialLocation }: {
  location: DoctorProfile["locations"][number];
  doctorId: string;
  initialLocation: Promise<LocationDetail | null>;
}) {
  const bookingLocation = await initialLocation;
  return <BrowseDetailClient key={location.id} slug={location.slug!} initialLocation={bookingLocation} bookingDoctorId={doctorId} bookingOnly bookingName={location.name} />;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ location?: string; openBooking?: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const locationSlug = query.location;
  const doctor = await getDoctor(slug, locationSlug);
  if (!doctor) notFound();
  const location = doctor.locations.find((item) => item.slug === locationSlug) || doctor.locations[0];
  return profileMetadata(`${doctor.name}${location ? ` at ${location.name}` : ""} | Ekavyu`, `${doctor.specialization ? `${doctor.specialization}. ` : ""}View ${doctor.name}'s practice details${location ? ` at ${location.name}, ${location.city}` : ""} and appointment options.`, location ? doctorPath(doctor, location) : `/doctor/${encodeURIComponent(slug)}`, doctor.imageUrl);
}

export default async function DoctorPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ location?: string; openBooking?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const locationSlug = query.location;
  // Start both reads together, but only the profile gates the page and its metadata.
  const requestedLocation = locationSlug ? getLocationForBooking(locationSlug, slug) : Promise.resolve(null);
  const doctor = await getDoctor(slug, locationSlug);
  if (!doctor) notFound();
  const locations = doctor?.locations || [];
  const selectedLocation = locations.find((location) => location.slug === locationSlug) || locations[0];
  const bookingLocation = selectedLocation
    ? selectedLocation.slug === locationSlug ? requestedLocation : getLocationForBooking(selectedLocation.slug!, doctor.slug!)
    : Promise.resolve(null);
  const profileUrl = selectedLocation ? absolutePublicUrl(doctorPath(doctor, selectedLocation)) : undefined;
  const profileImage = publicImageUrl(doctor.imageUrl);

  return <div className={marketplace.page}>
    <PublicBrandStyles color={selectedLocation?.brandColor} />
    <PublicStructuredData data={profileUrl ? { "@context": "https://schema.org", "@type": "ProfilePage", url: profileUrl, mainEntity: { "@type": "Person", "@id": `${profileUrl}#doctor`, name: doctor.name, url: profileUrl, ...(profileImage ? { image: profileImage } : {}), ...(doctor.description ? { description: doctor.description } : {}), workLocation: locations.map((location) => ({ "@type": "Place", name: location.name, url: absolutePublicUrl(locationPath(location)) })) } } : null} />
    <MarketplaceNavbar showSignUp showSearch={false} navigationSlot={<><Link href="/browse" className="font-medium text-accent">Find care</Link><Link href="/" className="text-text-secondary hover:text-text">For patients</Link><Link href="/pricing" className="text-text-secondary hover:text-text">For providers</Link></>} />
    <main className={cn(marketplace.content, styles.content)}>
      <div className={styles.breadcrumbs}><Breadcrumbs separator={<span aria-hidden="true">/</span>} items={[{ label: "Browse locations", href: "/browse" }, ...(selectedLocation ? [{ label: selectedLocation.name, href: locationPath(selectedLocation) }] : []), { label: doctor.name }]} /></div>
      <div className={styles.layout}>
        <div className={styles.profile}>
          <section aria-labelledby="doctor-title" className={styles.identity}>
            <div className={styles.avatar}>{doctor.imageUrl ? <LoadingImage src={doctor.imageUrl} alt="" width={96} height={96} className="h-full w-full object-cover" fallback={<span>{getAvatarInitials(doctor.name.replace(/^Dr\.?\s*/i, ""))}</span>} /> : <span aria-hidden="true">{getAvatarInitials(doctor.name.replace(/^Dr\.?\s*/i, ""))}</span>}</div>
            <div className={styles.identityText}><h1 id="doctor-title" className={care.title}>{doctor.name}</h1><p className="mt-2 text-sm font-medium text-accent">{doctor.specialization || "Specialty not listed"}</p>{doctor.qualification && <p className="mt-1 text-sm text-text-secondary">{doctor.qualification}</p>}{doctor.languages.length > 0 && <p className="mt-2 text-xs text-text-secondary">Consultations in {doctor.languages.join(", ")}</p>}{selectedLocation && hasMultipleLocations(doctor) && selectedLocation.name !== doctor.organizationName && <p className="mt-2 text-xs text-text-secondary">{doctor.organizationName}</p>}</div>
            {selectedLocation && <PublicProfileShare title={doctor.name} path={doctorPath(doctor, selectedLocation)} className={styles.share} iconOnly />}
          </section>
          <Card padding="none" className={care.card}><dl className={cn(care.summary, styles.summary)}>
            {doctor.experienceYears > 0 && <div><dt>Experience</dt><dd>{doctor.experienceYears} {doctor.experienceYears === 1 ? "year" : "years"}</dd></div>}
            {selectedLocation && <div><dt>Consultation fee</dt><dd>{consultationFee(selectedLocation, doctor.currency)}</dd></div>}
            {selectedLocation && <div><dt>Booking</dt><dd>{getPublicBookingStatus({ ...selectedLocation, doctorCount: 1 }) !== "check_availability" ? "Contact reception" : selectedLocation.bookingMode === "sequential_queue" ? "Queue token" : selectedLocation.bookingMode === "time_slot" ? "Time slot" : "Check availability"}</dd></div>}
          </dl></Card>
          {doctor.description && <section aria-labelledby="doctor-about-title" className={styles.about}><h2 id="doctor-about-title" className={care.sectionTitle}>About</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-secondary">{doctor.description}</p></section>}
          <section aria-labelledby="doctor-locations-title" className={styles.practices}>
            <h2 id="doctor-locations-title" className={care.sectionTitle}>Practice {locations.length === 1 ? "location" : "locations"}</h2>
            {locations.length > 1 && <p className="mt-2 text-sm text-text-secondary">Fees and booking options can vary by location.</p>}
            <div className={styles.practiceList}>{locations.map(location => <Card key={location.id} padding="none" className={cn(care.card, location.id === selectedLocation?.id && styles.selectedPractice)}><article className={styles.practice}>
              <span aria-hidden="true" className={styles.practiceDot} data-selected={location.id === selectedLocation?.id} />
              <div className={styles.practiceInfo}><CardTitle as="h3"><Link href={locationPath(location)}>{location.name}</Link></CardTitle><p className="mt-1 text-xs leading-relaxed text-text-secondary">{[location.address, location.city && !location.address?.toLowerCase().includes(location.city.toLowerCase()) ? location.city : null].filter(Boolean).join(", ") || "Address not listed"}</p>{location.id !== selectedLocation?.id && <Link href={doctorPath(doctor, location) + "#booking"} className={styles.practiceLink}>{getPublicBookingStatus({ ...location, doctorCount: 1 }) === "check_availability" ? "Check times at this location" : "Contact this location"}</Link>}{location.id === selectedLocation?.id && <span className="sr-only">Selected location</span>}</div>
              <span className="text-sm font-semibold">{consultationFee(location, doctor.currency)}</span>
            </article></Card>)}</div>
            {!locations.length && <p className="mt-3 text-sm text-text-secondary">No practice locations are listed. <Link href="/browse" className="text-accent underline">Browse other locations</Link></p>}
          </section>
        </div>
        <aside id="booking" className={styles.booking} aria-label="Book an appointment">
          {selectedLocation && <Suspense fallback={<LoadingState label={selectedLocation.onlineBookingAvailable ? "Loading booking options" : "Loading contact options"}><SkeletonForm fields={3} /></LoadingState>}><DoctorBooking location={selectedLocation} doctorId={doctor.id} initialLocation={bookingLocation} /></Suspense>}
        </aside>
      </div>
    </main>
  </div>;
}
