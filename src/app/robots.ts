import type { MetadataRoute } from "next";
import { absolutePublicUrl, canIndexPublicSite } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    // Let crawlers read noindex headers on operational pages; robots.txt is not access control.
    rules: [{ userAgent: "*", allow: ["/", "/api/public/organization-branding/"], disallow: "/api/" }],
    sitemap: canIndexPublicSite() ? absolutePublicUrl("/sitemap.xml") : undefined,
  };
}
