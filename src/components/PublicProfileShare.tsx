"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/components/ui";

export default function PublicProfileShare({ title, path }: { title: string; path: string }) {
  const { toast } = useToast();
  const share = async () => {
    const url = new URL(path, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "The public profile link is ready to share.", variant: "success" });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast({ title: "Could not share", description: "Copy the public profile address from your browser.", variant: "error" });
    }
  };
  return <button type="button" onClick={share} aria-label={`Share ${title}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-surface-hover"><Share2 className="h-3.5 w-3.5" aria-hidden="true" />Share</button>;
}
