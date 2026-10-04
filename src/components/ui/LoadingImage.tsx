"use client";

import { memo, useCallback, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { cn } from "./utils";

export interface LoadingImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: ReactNode;
}

/** Keep the native image box (including print/viewer styles) while it loads. */
function ImageSource({ fallback, className, style, alt = "", onLoad, onError, decoding = "async", ...props }: LoadingImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    // Cached images may finish before hydration attaches the load handler.
    if (image?.complete) setStatus(image.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  if (!props.src || status === "error") {
    return <span role={alt ? "img" : undefined} aria-label={alt || undefined} className={cn("inline-flex items-center justify-center bg-surface-alt text-text-muted text-xs", className)} style={{ width: props.width, height: props.height, ...style }}>{fallback ?? alt}</span>;
  }

  return (
    /* Native sources include signed uploads, blob previews, and generated QR codes. */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      {...props}
      ref={imageRef}
      alt={alt}
      decoding={decoding}
      data-image-state={status}
      aria-busy={status === "loading" || undefined}
      className={cn(className, status === "loading" ? "skeleton-shimmer" : "animate-fade-in")}
      style={status === "loading" ? { ...style, color: "transparent" } : style}
      onLoad={(event) => { setStatus("loaded"); onLoad?.(event); }}
      onError={(event) => { setStatus("error"); onError?.(event); }}
    />
  );
}

const LoadingImage = memo(function LoadingImage(props: LoadingImageProps) {
  // A new source must not inherit a previous source's success or failure.
  return <ImageSource key={`${props.src ?? ""}|${props.srcSet ?? ""}`} {...props} />;
});

export default LoadingImage;
