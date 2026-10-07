import { Metadata } from "next";
import BrowseClient, { Location, LocationFilters } from "../BrowseClient";

export const metadata: Metadata = {
  title: "Browse healthcare locations | Ekavyu Healthcare",
  description: "Find and book appointments with top doctors across our network of healthcare locations.",
};

export const dynamic = "force-dynamic";

async function getInitialLocations(): Promise<{ locations: Location[]; filters?: LocationFilters; nextCursor: string | null } | null> {
  try {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";
    const res = await fetch(`${backendUrl}/api/public/locations?sort=rating`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json.data) ? { locations: json.data, filters: json.filters, nextCursor: res.headers.get("X-Next-Cursor") || null } : null;
  } catch {
    return null;
  }
}

export default async function BrowsePage() {
  const initialLocations = await getInitialLocations();
  return <BrowseClient initialLocations={initialLocations?.locations || []} initialFilters={initialLocations?.filters} initialNextCursor={initialLocations?.nextCursor} initialLoaded={initialLocations !== null} />;
}
