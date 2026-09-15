import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "ANANTA — Healthcare Platform",
  description: "ANANTA Integrated Digital Health Operating System",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-w.png",
    shortcut: "/logo-w.png",
    apple: "/logo-w.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ANANTA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="min-h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1068eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("jk-mode")||"light";var p=localStorage.getItem("jk-palette")||"blue";if(m==="system"){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var d=document.documentElement;d.setAttribute("data-mode",m);d.setAttribute("data-palette",p);if(m==="dark"){d.classList.add("dark");d.style.colorScheme="dark";}else{d.classList.remove("dark");d.style.colorScheme="light";}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text font-sans antialiased selection:bg-primary-500/20 selection:text-primary-700 dark:selection:text-primary-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
