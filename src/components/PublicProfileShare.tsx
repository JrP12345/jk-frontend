"use client";

import { Share2 } from "lucide-react";
import { useToast, Button, cn } from "@/components/ui";

export default function PublicProfileShare({ title, path, className, stackOnMobile = false, iconOnly = false }: { title: string; path: string; className?: string; stackOnMobile?: boolean; iconOnly?: boolean }) {
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
  return <Button type="button" onClick={share} aria-label={`Share ${title}`} variant="outline" size={stackOnMobile ? "sm" : "xs"} className={className} icon={iconOnly ? <Share2 aria-hidden="true" /> : undefined}>{!iconOnly && <span className={cn("inline-flex items-center gap-1.5", stackOnMobile && "flex-col md:flex-row")}><Share2 className={stackOnMobile ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" /><span>Share</span></span>}</Button>;
}
