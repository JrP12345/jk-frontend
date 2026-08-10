import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "@tanstack/react-query", "zustand", "axios"],
  },
  /* config options here */
  reactCompiler: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https: https://*.razorpay.com; font-src 'self' data:; connect-src 'self' http: https: ws: wss: https://lumberjack.razorpay.com https://*.razorpay.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
