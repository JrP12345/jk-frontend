import { Metadata } from "next";
import BrowseClient, { Clinic } from "./BrowseClient";

export const metadata: Metadata = {
  title: "Browse Hospitals & Clinics | ANANTA Healthcare",
  description: "Find and book appointments with top doctors across our network of hospitals and clinics.",
};

export const dynamic = "force-dynamic";

async function getInitialClinics(): Promise<Clinic[] | null> {
  try {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";
    const res = await fetch(`${backendUrl}/api/public/clinics`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || [];
  } catch {
    return null;
  }
}

export default async function BrowsePage() {
  const initialClinics = await getInitialClinics();
  return <BrowseClient initialClinics={initialClinics || []} initialLoaded={initialClinics !== null} />;
}
