import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import { publicBackendUrl } from "@/lib/publicProfile";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteUrl();
  if (!origin) throw new Error("Configure APP_URL with the frontend origin before serving the sitemap");
  const urls = new Set(["/", "/browse", "/pricing"]);
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const response: Response = await fetch(`${publicBackendUrl()}/api/public/discovery${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Public discovery is temporarily unavailable");
    const { data }: { data: { paths: unknown[]; nextCursor: string | null } } = await response.json();
    if (!data || !Array.isArray(data.paths)) throw new Error("Invalid public discovery response");
    for (const path of data.paths) {
      if (typeof path !== "string" || !/^\/(?:browse\/[a-z0-9-]+|doctor\/[a-z0-9-]+\?location=[a-z0-9-]+)$/.test(path)) throw new Error("Invalid public discovery path");
      urls.add(path);
    }
    cursor = data.nextCursor || null;
    if (urls.size > 50000 || (cursor && (cursors.has(cursor) || !/^[a-f0-9]{24}$/.test(cursor)))) throw new Error("Public sitemap needs partitioning or a valid discovery cursor");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return [...urls].map((path) => ({ url: new URL(path, origin).href }));
}
