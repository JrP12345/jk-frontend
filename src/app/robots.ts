import type { MetadataRoute } from "next";
import { absolutePublicUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    // Let crawlers read noindex headers on operational pages; robots.txt is not access control.
    rules: [{ userAgent: "*", allow: ["/", "/api/public/organization-branding/"], disallow: "/api/" }],
    sitemap: absolutePublicUrl("/sitemap.xml"),
  };
}
