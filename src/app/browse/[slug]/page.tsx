import { Metadata } from "next";
import { Suspense } from "react";
import BrowseDetailClient, { LocationDetail } from "./BrowseDetailClient";

import BrowseDetailSkeleton from "@/components/ui/BrowseDetailSkeleton";

export const metadata: Metadata = {
  title: "Location details | Ekavyu",
  description: "View location details, opening hours, and available appointments with doctors.",
};

export const dynamic = "force-dynamic";

async function getLocation(slug: string): Promise<LocationDetail | null> {
  try {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";
    const res = await fetch(`${backendUrl}/api/public/locations/${encodeURIComponent(slug)}`, {
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

export default async function BrowseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initialLocation = await getLocation(slug);
  return (
    <Suspense fallback={<BrowseDetailSkeleton />}>
      <BrowseDetailClient key={slug} slug={slug} initialLocation={initialLocation} />
    </Suspense>
  );
}
