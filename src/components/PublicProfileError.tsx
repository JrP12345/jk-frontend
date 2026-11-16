"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import PublicCareState from "@/components/PublicCareState";

export default function PublicProfileError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error && typeof error === "object" && "digest" in error ? error.digest : undefined;
  const reference = typeof digest === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(digest) ? digest : null;
  return (
    <PublicCareState title="Profile temporarily unavailable" description="We couldn’t load this profile. Please try again shortly or return to browse locations." role="alert">
        {reference && <p className="text-xs text-text-muted">Error reference: {reference}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={retry}>Try again</Button>
          <Link href="/browse" className="inline-flex min-h-11 items-center font-semibold text-accent">Browse locations</Link>
        </div>
    </PublicCareState>
  );
}
