import { Metadata } from "next";
import BrowseClient, { Clinic, ClinicFilters } from "../BrowseClient";

export const metadata: Metadata = {
  title: "Browse Hospitals & Clinics | Ekavyu Healthcare",
  description: "Find and book appointments with top doctors across our network of hospitals and clinics.",
};

export const dynamic = "force-dynamic";

async function getInitialClinics(): Promise<{ clinics: Clinic[]; filters?: ClinicFilters; nextCursor: string | null } | null> {
  try {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";
    const res = await fetch(`${backendUrl}/api/public/clinics?sort=rating`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json.data) ? { clinics: json.data, filters: json.filters, nextCursor: res.headers.get("X-Next-Cursor") || null } : null;
  } catch {
    return null;
  }
}

export default async function BrowsePage() {
  const initialClinics = await getInitialClinics();
  return <BrowseClient initialClinics={initialClinics?.clinics || []} initialFilters={initialClinics?.filters} initialNextCursor={initialClinics?.nextCursor} initialLoaded={initialClinics !== null} />;
}
