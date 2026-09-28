import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow mobile devices on LAN (hotspot/Wi-Fi) to access dev resources (HMR, hot reload)
  // Configure LAN origins through ALLOWED_DEV_ORIGINS.
  output: "standalone",
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map(origin => origin.trim()).filter(Boolean) ?? [],
  experimental: {
    optimizePackageImports: ["lucide-react", "@tanstack/react-query", "zustand", "axios"],
  },
  reactCompiler: false,
  async redirects() {
    return ["/logo-d.png", "/logo-w.png", "/app-icon-light-192.png"].map(source => ({
      source, destination: "/app-icon-192.png?v=brand-3", permanent: false,
    }));
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL;
    if (backendUrl) {
      const cleanBackend = backendUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
      return [
        {
          source: "/api/:path*",
          destination: `${cleanBackend}/api/:path*`,
        },
      ];
    }
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
  async headers() {
    return [
      { source: "/manifest.json", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
