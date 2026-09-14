import Link from "next/link";
import { Button, Card, CardContent, AnantaLogo, ModeSwitcher } from "@/components/ui";
import { Home, Compass, ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-between items-center p-4 relative overflow-hidden bg-surface-alt text-text font-sans antialiased">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="w-full max-w-6xl flex items-center justify-between py-4 px-2 z-10">
        <Link href="/" className="flex items-center gap-2">
          <AnantaLogo size="md" />
        </Link>
        <ModeSwitcher />
      </header>

      {/* Main 404 Centerpiece */}
      <main className="w-full max-w-lg relative z-10 my-auto text-center px-2">
        <div className="relative mb-6">
          <span className="text-8xl sm:text-9xl font-extrabold tracking-tighter text-primary-500/15 select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-surface/80 border border-border/80 shadow-lg backdrop-blur-md flex items-center justify-center text-primary-600 dark:text-primary-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-text">
          Page Not Found
        </h1>
        <p className="text-text-muted text-sm sm:text-base mb-8 max-w-md mx-auto leading-relaxed">
          The medical workspace, patient record, or clinic resource you are trying to access does not exist or has moved.
        </p>

        <Card className="border-border/60 shadow-lg backdrop-blur-md bg-surface/90 mb-6 text-left">
          <CardContent className="p-4 flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted px-2">
              Helpful Destinations
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Link
                href="/browse"
                className="flex items-center gap-2.5 p-3 sm:p-2.5 rounded-xl hover:bg-surface-hover transition-colors text-sm font-medium text-text min-h-[44px] sm:min-h-0"
              >
                <Compass className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                <span>Find Doctors & Clinics</span>
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2.5 p-3 sm:p-2.5 rounded-xl hover:bg-surface-hover transition-colors text-sm font-medium text-text min-h-[44px] sm:min-h-0"
              >
                <Home className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                <span>Patient / Doctor Portal</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto flex items-center justify-center gap-2 font-medium min-h-[44px]">
              <Home className="w-4 h-4" />
              Return Home
            </Button>
          </Link>
          <Link href="/browse" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto flex items-center justify-center gap-2 font-medium min-h-[44px]">
              <Compass className="w-4 h-4" />
              Explore Platform
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-text-muted z-10">
        &copy; {new Date().getFullYear()} ANANTA Health Platform. All rights reserved.
      </footer>
    </div>
  );
}
