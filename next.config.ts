import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow mobile devices on LAN (hotspot/Wi-Fi) to access dev resources (HMR, hot reload)
  // Add your laptop's current LAN IP here (run `ipconfig` to find it)
  allowedDevOrigins: ["10.109.193.146"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@tanstack/react-query", "zustand", "axios"],
  },
  /* config options here */
  reactCompiler: false,
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
    return [];
  },
  async headers() {
    return [
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
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com; frame-ancestors 'self' https:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https: https://*.razorpay.com; font-src 'self' data:; connect-src 'self' http: https: ws: wss: https://lumberjack.razorpay.com https://*.razorpay.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
