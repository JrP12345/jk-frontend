import { Metadata } from "next";
import BrowseClient, { Clinic } from "./BrowseClient";

export const metadata: Metadata = {
  title: "Browse Hospitals & Clinics | ANANTA Healthcare",
  description: "Find and book appointments with top doctors across our network of hospitals and clinics.",
};

async function getInitialClinics(): Promise<Clinic[]> {
  try {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";
    const res = await fetch(`${backendUrl}/api/public/clinics`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export default async function BrowsePage() {
  const initialClinics = await getInitialClinics();
  return <BrowseClient initialClinics={initialClinics} />;
}
