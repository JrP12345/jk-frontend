import { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/publicProfile";
import { locationDescription, locationStructuredData, profileMetadata } from "@/lib/publicSeo";
import { locationPath } from "@/lib/publicPaths";
import PublicStructuredData from "@/components/PublicStructuredData";
import BrowseDetailClient, { LocationDetail } from "./BrowseDetailClient";

import BrowseDetailSkeleton from "@/components/ui/BrowseDetailSkeleton";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const location = await getLocation(slug);
  if (!location) notFound();
  return profileMetadata(`${location.name}${location.city ? `, ${location.city}` : ""} | Ekavyu`, locationDescription(location), locationPath(location), location.image_url);
}

export const dynamic = "force-dynamic";

async function getLocation(slug: string): Promise<LocationDetail | null> {
  return getPublicProfile(`locations/${encodeURIComponent(slug)}`);
}

export default async function BrowseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initialLocation = await getLocation(slug);
  if (!initialLocation) notFound();
  return (
    <Suspense fallback={<BrowseDetailSkeleton />}>
      <PublicStructuredData data={locationStructuredData(initialLocation)} />
      <BrowseDetailClient key={slug} slug={slug} initialLocation={initialLocation} />
    </Suspense>
  );
}
