import type { Metadata } from "next";
import Link from "next/link";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import type { ClinicDetail } from "@/app/browse/[id]/BrowseDetailClient";

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
    brandColor: string;
    fees: number; feeType: "fixed" | "free" | "post_consultation";
    onlineBookingAvailable: boolean;
  }>;
};

export async function getDoctor(id: string, clinicId?: string): Promise<DoctorProfile | null> {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") || "http://localhost:5000";
  try {
    const response = await fetch(`${backendUrl}/api/public/doctors/${encodeURIComponent(id)}/profile`, {
      cache: "no-store", signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const result = await response.json();
      if (result.data) return { ...result.data, name: doctorDisplayName(result.data.name) };
    }
  } catch { /* The clinic catalog can still serve a doctor linked from that clinic. */ }
  if (!clinicId) return null;
  try {
    const response = await fetch(`${backendUrl}/api/public/clinics/${encodeURIComponent(clinicId)}`, {
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
        onlineBookingAvailable: clinic.onlineBookingAvailable !== false }],
    };
  } catch { return null; }
}

function doctorDisplayName(name: string) {
  return /^Dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
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
  const locations = doctor ? [...doctor.locations].sort((a, b) => Number(b.id === clinicId) - Number(a.id === clinicId)) : [];
  return <div className="min-h-screen bg-surface-alt text-text">
    <MarketplaceNavbar />
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:pt-28">
      {!doctor ? <section className="rounded-3xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-bold">Doctor profile unavailable</h1>
        <p className="mt-2 text-text-secondary">This link may have changed. Browse available clinics to find an appointment.</p>
        <Link href="/browse" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-5 text-brand-mist font-semibold">Browse clinics</Link>
      </section> : <>
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <Link href="/browse" className="hover:text-accent">Browse clinics</Link>
          <span aria-hidden="true">/</span>
          {locations[0] && clinicId === locations[0].id && <><Link href={`/browse/${locations[0].id}`} className="hover:text-accent">{locations[0].name}</Link><span aria-hidden="true">/</span></>}
          <span className="font-semibold text-text">{doctor.name}</span>
        </nav>
        <section className="rounded-3xl border border-border bg-surface p-5 sm:p-8 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Doctor profile</p>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
            {doctor.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={doctor.imageUrl} alt={doctor.name} className="h-28 w-28 rounded-2xl border border-border object-cover" />
            ) : <div aria-hidden="true" className="flex h-28 w-28 items-center justify-center rounded-2xl bg-primary-500/10 text-4xl font-bold text-accent">{doctor.name.slice(0, 1)}</div>}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold sm:text-3xl">{doctor.name}</h1>
              <p className="mt-1 text-base text-text-secondary">{doctor.specialization}{doctor.qualification ? ` · ${doctor.qualification}` : ""}</p>
              {doctor.experienceYears > 0 && <p className="mt-2 text-sm text-text-muted">{doctor.experienceYears} years of experience</p>}
              {doctor.description && <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-text-secondary">{doctor.description}</p>}
              {doctor.languages.length > 0 && <p className="mt-3 text-xs text-text-muted">Languages: {doctor.languages.join(", ")}</p>}
            </div>
          </div>
        </section>
        <section className="mt-7" aria-labelledby="doctor-locations-title">
          <h2 id="doctor-locations-title" className="text-xl font-bold">Book with {doctor.name}</h2>
          <p className="mt-1 text-sm text-text-secondary">Select an available date and time for this doctor at a clinic location.</p>
          {locations.length === 0 ? <p className="mt-4 rounded-2xl border border-border bg-surface p-5 text-sm text-text-secondary">No clinic locations are accepting online bookings for this doctor right now.</p> :
            <div className={`mt-4 grid gap-4 ${locations.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}>{locations.map((location) => <article key={location.id} className={`rounded-2xl border border-border bg-surface p-5 shadow-xs ${locations.length === 1 ? "sm:p-7" : ""}`}>
              <div className={locations.length === 1 ? "sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] sm:items-center sm:gap-8" : ""}>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{location.id === clinicId ? "Your selected clinic" : "Clinic location"}</p>
                  <h3 className="mt-1 text-lg font-bold">{location.name}</h3>
                  <p className="mt-1 text-sm text-text-secondary">{location.address ? `${location.address}, ` : ""}{location.city}</p>
                  <p className="mt-4 text-sm"><span className="text-text-muted">Consultation fee</span><strong className="ml-2 text-text">{consultationFee(location, doctor.currency)}</strong></p>
                </div>
                <div className="mt-4 sm:mt-0">
                  {location.onlineBookingAvailable ? <Link href={`/browse/${location.id}?doctorId=${encodeURIComponent(doctor.id)}&openBooking=true`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary-600 px-5 text-sm font-semibold text-brand-mist hover:bg-primary-700">Select date & book</Link> : <p className="text-sm font-medium text-warning-text">Online booking is unavailable at this clinic</p>}
                  <Link href={`/browse/${location.id}`} className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-xs font-semibold text-accent hover:underline">View clinic details</Link>
                </div>
              </div>
            </article>)}</div>}
        </section>
      </>}
    </main>
  </div>;
}
