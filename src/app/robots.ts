import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/browse",
          "/browse/*",
          "/pricing",
          "/login",
          "/register",
          "/check-in",
          "/track/*",
          "/queue-tv",
        ],
        disallow: [
          "/api/",
          "/dashboard/admin/billing",
        ],
      },
      {
        userAgent: ["GPTBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "PerplexityBot"],
        allow: [
          "/",
          "/browse",
          "/browse/*",
          "/pricing",
          "/login",
          "/register",
          "/check-in",
          "/track/*",
          "/queue-tv",
        ],
        disallow: [
          "/api/",
          "/dashboard/admin/billing",
        ],
      },
    ],
  };
}
