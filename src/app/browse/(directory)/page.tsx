import { Metadata } from "next";
import BrowseClient, { Location, LocationFilters } from "../BrowseClient";
import { profileMetadata } from "@/lib/publicSeo";

export const metadata: Metadata = profileMetadata("Browse healthcare locations | Ekavyu", "Find healthcare locations and doctors, compare practice details, and check appointment options.", "/browse");

export const dynamic = "force-dynamic";

async function getInitialLocations(search?: string): Promise<{ locations: Location[]; filters?: LocationFilters; nextCursor: string | null } | null> {
  try {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
      "http://localhost:5000";
    const query = new URLSearchParams({ sort: "rating" });
    if (search) query.set("search", search);
    const res = await fetch(`${backendUrl}/api/public/locations?${query}`, {
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

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ search?: string | string[]; view?: string }> }) {
  const params = await searchParams;
  const initialSearch = typeof params.search === "string" ? params.search.trim().slice(0, 160) : undefined;
  const initialLocations = await getInitialLocations(initialSearch);
  return <BrowseClient initialLocations={initialLocations?.locations || []} initialFilters={initialLocations?.filters} initialNextCursor={initialLocations?.nextCursor} initialLoaded={initialLocations !== null} initialSearch={initialSearch} initialView={params.view === "map" ? "map" : "list"} />;
}
