"use client";

import { useEffect } from "react";
import { Button, Card, Alert } from "@/components/ui";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Segment Exception:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center p-4 font-sans text-text antialiased">
      <Card className="max-w-md w-full p-6 space-y-5 text-center shadow-xl rounded-2xl border border-border bg-surface">
        <div className="w-12 h-12 rounded-2xl bg-danger-500/10 text-danger-500 border border-danger-500/20 flex items-center justify-center mx-auto shrink-0 animate-scale-in">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div>
          <h2 className="text-lg font-bold text-text tracking-tight">Unexpected Workspace Error</h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            An unexpected error occurred in this section. Our system telemetry has logged the error details.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 rounded-xl bg-danger-500/5 border border-danger-500/15 text-left font-mono text-xs text-danger-600 dark:text-danger-400 space-y-1">
            <span className="font-extrabold uppercase tracking-wider text-[10px] opacity-80 block font-sans">
              Error Details:
            </span>
            <p className="break-all">{error.message}</p>
          </div>
        )}

        <div className="flex items-center gap-2.5 justify-center pt-1">
          <Button variant="primary" size="sm" onClick={() => reset()} className="rounded-xl font-bold text-xs cursor-pointer">
            Retry View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/dashboard")}
            className="rounded-xl font-semibold text-xs cursor-pointer"
          >
            Return to Overview
          </Button>
        </div>
      </Card>
    </div>
  );
}
