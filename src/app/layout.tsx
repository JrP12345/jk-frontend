import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import {
  type LanguageCode,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
} from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "ANANTA — Healthcare Platform",
  description: "ANANTA Integrated Digital Health Operating System",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/app-icon-512.png", sizes: "512x512", type: "image/png" }],
    shortcut: [{ url: "/app-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/app-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ANANTA",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("ananta_lang")?.value;
  const initialLang: LanguageCode = isSupportedLanguage(cookieLang)
    ? cookieLang
    : DEFAULT_LANGUAGE;

  return (
    <html
      lang={initialLang}
      className="min-h-full antialiased"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1068eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("jk-mode")||"light";var p=localStorage.getItem("jk-palette")||"blue";if(m==="system"){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var d=document.documentElement;d.setAttribute("data-mode",m);d.setAttribute("data-palette",p);if(m==="dark"){d.classList.add("dark");d.style.colorScheme="dark";}else{d.classList.remove("dark");d.style.colorScheme="light";}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text font-sans antialiased selection:bg-primary-500/20 selection:text-primary-700 dark:selection:text-primary-300">
        <Providers initialLanguage={initialLang}>{children}</Providers>
      </body>
    </html>
  );
}
