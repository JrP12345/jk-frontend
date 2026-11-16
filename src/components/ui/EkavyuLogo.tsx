"use client";

import LoadingImage from "@/components/ui/LoadingImage";
import { cn } from "./utils";
import styles from "./EkavyuLogo.module.css";

type BrandAppearance = "auto" | "on-light" | "on-dark";

export interface EkavyuLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  /** Use the supplied Healthcare Platform descriptor in spacious placements. */
  showTagline?: boolean;
  layout?: "horizontal" | "stacked";
  /** Override automatic theme selection on a permanently light/dark surface. */
  appearance?: BrandAppearance;
}

const iconSizeMap = { sm: "h-7 w-7", md: "h-10 w-10", lg: "h-14 w-14", xl: "h-20 w-20" };

function Artwork({ name, width, height }: { name: "symbol" | "wordmark" | "stacked" | "stacked-without-descriptor"; width: number; height: number }) {
  return <>
    {(["black", "white"] as const).map(color => <LoadingImage key={color}
      src={`/brand/ekavyu-${name}-${color}.svg?v=brand-6`}
      alt="" aria-hidden="true" width={width} height={height} loading="eager" loadingEffect={false}
      className={cn(styles.artwork, color === "black" ? styles.normal : styles.inverse)}
    />)}
  </>;
}

/** Original kit paths; theme variants switch in CSS before hydration. */
export function EkavyuIcon({ className = "h-10 w-10", appearance = "auto" }: { className?: string; appearance?: BrandAppearance }) {
  return <span role="img" aria-label="Ekavyu" data-brand-appearance={appearance} className={cn(styles.icon, styles.appearance, className)}>
    <Artwork name="symbol" width={352} height={263} />
  </span>;
}

export default function EkavyuLogo({ className = "", iconOnly = false, size = "md", showTagline = false, layout = "horizontal", appearance = "auto" }: EkavyuLogoProps) {
  if (iconOnly) return <EkavyuIcon className={cn(iconSizeMap[size], className)} appearance={appearance} />;
  const stacked = layout === "stacked";
  return <span role="img" aria-label="Ekavyu" data-brand-appearance={appearance} data-brand-layout={layout}
    className={cn(styles.logo, styles.appearance, styles[size], stacked ? styles.stacked : styles.horizontal, showTagline && styles.descriptor, className)}>
    {stacked || showTagline ? <Artwork name={showTagline ? "stacked" : "stacked-without-descriptor"} width={595} height={showTagline ? 420 : 370} /> : <>
      <span className={styles.horizontalSymbol}><Artwork name="symbol" width={352} height={263} /></span>
      <span className={styles.horizontalWordmark}><Artwork name="wordmark" width={574} height={97} /></span>
    </>}
  </span>;
}
