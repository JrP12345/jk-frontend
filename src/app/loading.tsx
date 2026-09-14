"use client";

import { Spinner, AnantLogo } from "@/components/ui";

export default function RootLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center min-h-[45vh] p-6 text-center animate-fade-in select-none"
    >
      <div className="flex flex-col items-center gap-3.5 max-w-sm">
        <AnantLogo size="md" />
        <Spinner size="sm" label="Loading platform content..." />
      </div>
    </div>
  );
}
