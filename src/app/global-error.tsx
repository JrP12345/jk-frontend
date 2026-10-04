"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-surface text-text dark:bg-background dark:text-text min-h-screen flex items-center justify-center p-6 font-sans antialiased">
        <div className="max-w-md w-full bg-surface dark:bg-surface border border-border dark:border-border rounded-3xl p-8 text-center space-y-6 shadow-lg relative overflow-hidden ">
          <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger-text dark:text-danger-text border border-danger/20 flex items-center justify-center mx-auto shrink-0 shadow-inner">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text dark:text-text">Something went wrong</h1>
            <p className="text-sm text-text-secondary dark:text-text-muted mt-2 leading-relaxed">
              We encountered an issue while loading the application. Please try reloading the page.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 bg-primary hover:bg-primary text-brand-mist font-semibold rounded-xl text-sm transition-all shadow-md  cursor-pointer active:scale-95 min-h-[44px] flex items-center justify-center"
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/login")}
              className="px-5 py-2.5 bg-surface-alt hover:bg-surface-alt dark:bg-surface-alt dark:hover:bg-surface-hover border border-border dark:border-input-border text-text-secondary dark:text-text-secondary font-semibold rounded-xl text-sm transition-all cursor-pointer active:scale-95 min-h-[44px] flex items-center justify-center"
            >
              Go to Login
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
