import { Metadata } from "next";
import { Suspense } from "react";
import BrowseDetailClient, { ClinicDetail } from "./BrowseDetailClient";

import MarketplaceNavbar from "@/components/MarketplaceNavbar";

export const metadata: Metadata = {
  title: "Hospital Details | JK Healthcare",
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

function DetailLoadingFallback() {
  return (
    <div className="min-h-screen bg-surface-alt font-sans text-text antialiased">
      <MarketplaceNavbar />
      {/* Navigation Breadcrumbs Skeleton */}
      <div className="bg-surface border-b border-border/40 px-4 sm:px-6 py-3 pt-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="h-4 w-40 bg-surface-alt rounded-lg animate-pulse" />
          <div className="h-4 w-24 bg-surface-alt rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Clinic Header Banner Skeleton */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs animate-pulse">
          <div className="h-36 sm:h-52 w-full bg-surface-alt" />
          <div className="p-4 sm:p-6 space-y-3">
            <div className="h-7 w-64 bg-surface-alt rounded-lg" />
            <div className="h-4 w-48 bg-surface-alt rounded-lg" />
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col lg:grid lg:grid-cols-3 gap-6">
        <div className="order-1 lg:order-2 lg:col-span-2 space-y-4">
          <div className="h-6 w-40 bg-surface rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 bg-surface rounded-2xl border border-border animate-pulse p-4" />
            <div className="h-64 bg-surface rounded-2xl border border-border animate-pulse p-4" />
          </div>
        </div>
        <div className="order-2 lg:order-1 lg:col-span-1">
          <div className="h-72 bg-surface rounded-2xl border border-border animate-pulse p-4" />
        </div>
      </div>
    </div>
  );
}

export default async function BrowseDetailPage({ params }: { params: { id: string } }) {
  // Pass the id from params to the client component
  const { id } = await params;
  const initialClinic = await getClinic(id);
  return (
    <Suspense fallback={<DetailLoadingFallback />}>
      <BrowseDetailClient id={id} initialClinic={initialClinic} />
    </Suspense>
  );
}
