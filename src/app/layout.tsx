import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ananta — Healthcare Platform",
  description: "Ananta Integrated Digital Health Operating System",
  icons: {
    icon: "/logo-w.png",
    shortcut: "/logo-w.png",
    apple: "/logo-w.png",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      data-mode="dark"
      data-palette="blue"
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/logo-w.png" type="image/png" sizes="any" />
        <link rel="apple-touch-icon" href="/logo-w.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem("jk-mode")||"dark";var p=localStorage.getItem("jk-palette")||"blue";if(m==="system"){m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-mode",m);document.documentElement.setAttribute("data-palette",p);if(m==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-text font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
