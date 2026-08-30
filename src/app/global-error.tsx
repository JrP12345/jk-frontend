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
    console.error("Application Error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-[#080a12] text-[#f1f5f9] min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#0e1019] border border-[#1e2236] rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-blue-500/30 before:to-transparent">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto shrink-0 shadow-inner">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Something went wrong</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              We encountered an issue while loading the application. Please try reloading the page.
            </p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
            >
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/login")}
              className="px-5 py-2.5 bg-[#151722] hover:bg-[#1a1e2d] border border-[#252a3d] text-slate-300 font-semibold rounded-xl text-sm transition-all cursor-pointer active:scale-95"
            >
              Go to Login
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
