"use client";

import { Spinner, AnantLogo } from "@/components/ui";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface-alt animate-fade-in p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <AnantLogo size="lg" />
        <Spinner size="md" label="Loading application..." />
      </div>
    </div>
  );
}
