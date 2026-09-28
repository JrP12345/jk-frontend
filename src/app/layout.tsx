import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";

const brandDescription = "Ekavyu — Care That Keeps Moving. Integrated digital health for patients and healthcare teams.";

export const metadata: Metadata = {
  title: "Ekavyu — Healthcare Platform",
  description: brandDescription,
  applicationName: "Ekavyu",
  openGraph: {
    type: "website",
    siteName: "Ekavyu",
    title: "Ekavyu — Healthcare Platform",
    description: brandDescription,
  },
  twitter: {
    card: "summary",
    title: "Ekavyu — Healthcare Platform",
    description: brandDescription,
  },
  manifest: "/manifest.json?v=brand-3",
  icons: {
    icon: [
      { url: "/favicon-32.png?v=brand-3", sizes: "32x32", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-16.png?v=brand-3", sizes: "16x16", type: "image/png" }],
    apple: [{ url: "/app-icon-180.png?v=brand-3", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ekavyu",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F6F66",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html
      lang="en"
      className="min-h-full antialiased"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("jk-mode")||"light";if(m==="system"){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(m!=="dark"){m="light";}var d=document.documentElement;d.setAttribute("data-mode",m);d.classList.toggle("dark",m==="dark");d.style.colorScheme=m;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text font-sans antialiased selection:bg-selected selection:text-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
