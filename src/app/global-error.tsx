"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Root Exception:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-surface text-text min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-alt border border-border rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-danger-500/10 text-danger-500 flex items-center justify-center mx-auto text-3xl font-bold">
            🚨
          </div>
          <div>
            <h1 className="text-2xl font-bold">System Exception</h1>
            <p className="text-sm text-text-muted mt-2">
              ANANTA Healthcare Platform encountered a critical rendering exception.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl text-sm transition-colors cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
