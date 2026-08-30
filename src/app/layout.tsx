import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Anant — Healthcare Platform",
  description: "Anant Integrated Digital Health Operating System",
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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
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
