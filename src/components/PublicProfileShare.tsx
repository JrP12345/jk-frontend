"use client";

import { Share2 } from "lucide-react";
import { useToast, Button } from "@/components/ui";

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
  return <Button type="button" onClick={share} aria-label={`Share ${title}`} variant="outline" size="xs"><Share2 className="h-3.5 w-3.5" aria-hidden="true" />Share</Button>;
}
