"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

export default function PublicProfileError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error && typeof error === "object" && "digest" in error ? error.digest : undefined;
  const reference = typeof digest === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(digest) ? digest : null;
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-24 text-text">
      <section role="alert" className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        <h1 className="text-xl font-semibold">Profile temporarily unavailable</h1>
        <p className="text-text-secondary">We couldn&apos;t load this profile. Please try again shortly or return to browse locations.</p>
        {reference && <p className="text-xs text-text-muted">Error reference: {reference}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={retry}>Try again</Button>
          <Link href="/browse" className="inline-flex min-h-11 items-center font-semibold text-accent">Browse locations</Link>
        </div>
      </section>
    </main>
  );
}
