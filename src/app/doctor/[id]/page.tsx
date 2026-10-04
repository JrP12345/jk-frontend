import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import BrowseDetailClient, { type ClinicDetail } from "@/app/browse/[id]/BrowseDetailClient";
import { getPublicBookingStatus, type PublicBookingStatus } from "@/lib/publicBooking";

export const dynamic = "force-dynamic";

type DoctorProfile = {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  experienceYears: number;
  description: string;
  imageUrl: string | null;
  languages: string[];
  organizationName: string;
  organizationLogo: string | null;
  currency: string;
  locations: Array<{
    id: string; name: string; city: string; address: string; logo: string | null;
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

export async function getDoctor(id: string, clinicId?: string): Promise<DoctorProfile | null> {
  try {
    const response = await fetch(`${backendUrl()}/api/public/doctors/${encodeURIComponent(id)}/profile${clinicId ? `?clinicId=${encodeURIComponent(clinicId)}` : ""}`, {
      cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.data) return { ...result.data, name: doctorDisplayName(result.data.name) };
    }
  } catch { /* A clinic link can still provide the doctor's public details. */ }
  if (!clinicId) return null;
  try {
    const response = await fetch(`${backendUrl()}/api/public/clinics/${encodeURIComponent(clinicId)}`, {
      cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    const clinic = result.data as ClinicDetail | undefined;
    if (!clinic || clinic.id !== clinicId || !Array.isArray(clinic.doctors)) return null;
    const doctor = clinic.doctors.find((item) => item.id === id);
    if (!doctor) return null;
    return {
      id, name: doctorDisplayName(doctor.name), specialization: doctor.specialization || "General Medicine",
      qualification: doctor.qualification || "", experienceYears: doctor.experience_years || 0,
      description: doctor.description || "", imageUrl: doctor.image_url || null,
      languages: doctor.languages || [], organizationName: clinic.organization?.name || clinic.name,
      organizationLogo: clinic.organization?.logo_url || null, currency: clinic.currency || "INR",
      locations: [{ id: clinic.id, name: clinic.name, city: clinic.city, address: clinic.address || "",
        logo: clinic.logo_url || null, brandColor: clinic.brandColor || "#0F6F66",
        fees: doctor.fees, feeType: doctor.feeType || "fixed",
        onlineBookingAvailable: clinic.onlineBookingAvailable !== false,
        bookingStatus: getPublicBookingStatus({ ...clinic, doctorCount: clinic.doctors.length }) }],
    };
  } catch { return null; }
}

async function getClinicForBooking(clinicId: string, doctorId: string): Promise<ClinicDetail | null> {
  try {
    const response = await fetch(`${backendUrl()}/api/public/clinics/${encodeURIComponent(clinicId)}?doctorId=${encodeURIComponent(doctorId)}`, {
      cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.data?.id === clinicId && Array.isArray(result.data?.doctors) ? result.data : null;
  } catch { return null; }
}

function consultationFee(location: DoctorProfile["locations"][number], currency: string) {
  if (location.feeType === "free") return "Free";
  const amount = Number.isFinite(location.fees) && location.fees > 0
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(location.fees)
    : null;
  if (location.feeType === "post_consultation") return amount ? `From ${amount} · final fee after consultation` : "Decided after consultation";
  return amount || "Ask clinic for fee";
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ clinicId?: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { clinicId } = await searchParams;
  const doctor = await getDoctor(id, clinicId);
  return {
    title: doctor ? `${doctor.name} | Book an appointment` : "Doctor profile unavailable",
    description: doctor ? `View ${doctor.name}'s clinic locations and book an appointment.` : "This doctor profile is unavailable.",
  };
}

export default async function DoctorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ clinicId?: string }> }) {
  const { id } = await params;
  const { clinicId } = await searchParams;
  const doctor = await getDoctor(id, clinicId);
  const locations = doctor?.locations || [];
  const selectedLocation = locations.find((location) => location.id === clinicId) || locations[0];
  const bookingClinic = selectedLocation ? await getClinicForBooking(selectedLocation.id, id) : null;

  return <div className="min-h-screen bg-surface-alt text-text">
    <MarketplaceNavbar brand={selectedLocation ? { name: doctor?.organizationName || selectedLocation.name, logoUrl: doctor?.organizationLogo || selectedLocation.logo, href: `/browse/${selectedLocation.id}` } : undefined} />
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-24 sm:px-6 sm:pt-28 lg:pb-16">
      {!doctor ? <section className="rounded-3xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">Doctor profile unavailable</h1>
        <p className="mt-2 text-text-secondary">This link may have changed. Browse available clinics to find an appointment.</p>
        <Link href="/browse" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-5 font-semibold text-brand-mist">Browse clinics</Link>
      </section> : <>
        {selectedLocation && selectedLocation.name !== doctor.organizationName && <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3" style={{ borderLeft: `4px solid ${selectedLocation.brandColor}` }}>
          {selectedLocation.logo || doctor.organizationLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={selectedLocation.logo || doctor.organizationLogo || ""} alt="" className="h-11 w-11 rounded-xl border border-border bg-surface object-contain" />
          ) : <div aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10 font-bold text-accent">{selectedLocation.name.slice(0, 1)}</div>}
          <div className="min-w-0"><p className="truncate text-sm font-bold">{doctor.organizationName}</p><p className="truncate text-xs text-text-secondary">Appointments at {selectedLocation.name}</p></div>
        </div>}
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <Link href="/browse" className="hover:text-accent">Browse clinics</Link><span aria-hidden="true">/</span>
          {selectedLocation && <><Link href={`/browse/${selectedLocation.id}`} className="hover:text-accent">{selectedLocation.name}</Link><span aria-hidden="true">/</span></>}
          <span className="font-semibold text-text">{doctor.name}</span>
        </nav>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
          <div className="contents">
            <section className="order-1 min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-6 lg:col-start-1 lg:row-start-1" style={selectedLocation ? { borderTop: `4px solid ${selectedLocation.brandColor}` } : undefined}>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">Doctor profile</p>
              <div className="mt-3 flex items-start gap-3 sm:gap-4">
                {doctor.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={doctor.imageUrl} alt={doctor.name} className="h-16 w-16 sm:h-24 sm:w-24 shrink-0 rounded-xl border border-border object-cover" />
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
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold">{location.name}</h3><p className="mt-1 text-sm text-text-secondary">{[location.address, location.city].filter(Boolean).join(", ")}</p></div><span className="text-sm font-semibold">{consultationFee(location, doctor.currency)}</span></div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><Link href={`/browse/${location.id}`} className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">View clinic details</Link>{location.id !== selectedLocation?.id && <Link href={`/doctor/${encodeURIComponent(doctor.id)}?clinicId=${encodeURIComponent(location.id)}#booking`} className="inline-flex min-h-11 items-center font-semibold text-accent hover:underline">{getPublicBookingStatus({ ...location, doctorCount: 1 }) === "check_availability" ? "Check times at this location" : "Contact this clinic"}</Link>}{location.id === selectedLocation?.id && <span className="font-medium text-text-secondary">Selected location</span>}</div>
              </article>)}</div>
            </section>
          </div>
          <aside id="booking" className="order-2 min-w-0 scroll-mt-24 lg:col-start-2 lg:row-span-3 lg:row-start-1" aria-label="Book an appointment">
            {selectedLocation && <Suspense fallback={<div className="rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">Loading booking options…</div>}><BrowseDetailClient key={selectedLocation.id} id={selectedLocation.id} initialClinic={bookingClinic} bookingDoctorId={doctor.id} bookingOnly bookingName={selectedLocation.name} /></Suspense>}
          </aside>
        </div>
      </>}
    </main>
  </div>;
}
