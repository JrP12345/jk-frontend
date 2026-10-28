"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission } from "@/lib/permissions";

function Trigger({ loading = false, onClick }: { loading?: boolean; onClick?: () => void }) {
  return <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 sm:right-6 z-45">
    <button onClick={onClick} disabled={loading} aria-busy={loading || undefined} aria-label={loading ? "Loading AI Copilot" : "Toggle AI Copilot"} aria-haspopup="dialog" aria-expanded={false} title="Open Ekavyu AI Copilot"
      className="relative w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 bg-primary-600 hover:bg-primary-700 text-brand-mist shadow-lg hover:scale-108 active:scale-95">
      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-brand-mist animate-pulse" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C12 2 13.5 8 18 10C13.5 12 12 18 12 18C12 18 10.5 12 6 10C10.5 8 12 2 12 2Z" />
        <path d="M19 2C19 2 19.6 4.4 21.5 5.2C19.6 6 19 8.4 19 8.4C19 8.4 18.4 6 16.5 5.2C18.4 4.4 19 2 19 2Z" opacity="0.8" />
      </svg>
    </button>
  </div>;
}

const Copilot = dynamic(() => import("./FloatingAICopilot").then(module => module.FloatingAICopilot), {
  ssr: false, loading: () => <Trigger loading />,
});

export default function AICopilotLauncher() {
  const user = useAuthStore(state => state.user);
  const [requested, setRequested] = useState(false);
  if (!hasAnyPermission(user, "MANAGE_CLINICAL_NOTES", "MANAGE_EHR", "VIEW_EHR")) return null;
  // Keep the loaded component mounted after closing so its existing state and cleanup remain authoritative.
  return requested ? <Copilot initiallyOpen /> : <Trigger onClick={() => setRequested(true)} />;
}
