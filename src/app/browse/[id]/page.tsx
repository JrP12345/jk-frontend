import { Metadata } from "next";
import { Suspense } from "react";
import BrowseDetailClient, { ClinicDetail } from "./BrowseDetailClient";

import BrowseDetailSkeleton from "@/components/ui/BrowseDetailSkeleton";

export const metadata: Metadata = {
  title: "Hospital Details | Ekavyu",
  description: "View hospital details, timings, and book appointments with specialized doctors.",
};

export const dynamic = "force-dynamic";

async function getClinic(id: string): Promise<ClinicDetail | null> {
  try {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";
    const res = await fetch(`${backendUrl}/api/public/clinics/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}



export default async function BrowseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Pass the id from params to the client component
  const { id } = await params;
  const initialClinic = await getClinic(id);
  return (
    <Suspense fallback={<BrowseDetailSkeleton />}>
      <BrowseDetailClient key={id} id={id} initialClinic={initialClinic} />
    </Suspense>
  );
}
