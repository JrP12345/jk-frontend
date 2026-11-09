"use client";

import { memo, useId, useState, type ComponentProps } from "react";
import Link from "next/link";
import { Building2, Navigation, Phone } from "lucide-react";
import { Card, CardTitle, cn } from "@/components/ui";
import { buttonClassName } from "@/components/ui/Button";
import LoadingImage from "@/components/ui/LoadingImage";
import { LocationStatusBadge } from "@/components/ui/LocationStatusBadge";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { locationPath } from "@/lib/publicPaths";
import { distanceBandLabel } from "@/lib/geo/locationDetector";
import type { Location } from "./BrowseClient";
import { facilityCoordinates, facilityPresentation } from "./browsePresentation";
import styles from "./LocationCard.module.css";
import marketplace from "@/components/MarketplaceLayout.module.css";
import care from "@/components/PublicCare.module.css";
import { getAvatarInitials } from "@/lib/avatar";

function ProfileLink({ children, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={intent || props.prefetch ? true : false} onPointerEnter={() => setIntent(true)} onFocus={() => setIntent(true)} onTouchStart={() => setIntent(true)}><NavigationPending />{children}</Link>;
}
export default memo(function LocationCard({ location, onNavigate, preload = false, showDistance, approximateDistance, variant = "row", selected = false, number, onSelect }: {
  location: Location; onNavigate: () => void; preload?: boolean; showDistance: boolean; approximateDistance: boolean;
  variant?: "row" | "compact" | "summary"; selected?: boolean; number?: number; onSelect?: () => void;
}) {
  const nameId = useId();
  const { whereabouts, phone, dial, callable, bookable, directionsUrl, specialties, actionLabel } = facilityPresentation(location);
  const mapped = facilityCoordinates(location);
  const distance = showDistance && mapped && typeof location.distanceKm === "number" && Number.isFinite(location.distanceKm) && location.distanceKm >= 0 ? distanceBandLabel(location.distanceKm, approximateDistance) : null;
  const logo = location.logo_url ? <LoadingImage src={location.logo_url} alt="" width={44} height={44} loading="lazy" loadingEffect={false} className={styles.logo} fallback={<Building2 aria-hidden="true" />} /> : <span aria-hidden="true" className={styles.initial}>{getAvatarInitials(location.name)}</span>;
  const actionClass = (primary = false, layout = "") => buttonClassName({ variant: primary ? "primary" : "outline", size: "sm", className: cn("min-h-11!", layout) });
  return <Card padding="none" hover className={cn(care.card, styles.card)}>
    <article id={variant === "summary" ? undefined : "facility-" + location.id} aria-labelledby={nameId} className={styles.article} data-variant={variant} data-selected={selected || undefined}>
      <header className={styles.identity}>
        {onSelect && mapped ? <button type="button" className={styles.logoFrame} onClick={onSelect} aria-label={"Show " + location.name + " on map"} aria-pressed={selected}>{logo}{number && <span className={styles.mapNumber}>{number}</span>}</button> : <div className={styles.logoFrame} aria-hidden="true">{logo}</div>}
        <div className={styles.information}>
          <div className={styles.headingRow}><CardTitle as="h2"><span id={nameId}>{location.slug ? <ProfileLink href={locationPath(location)} onClick={onNavigate} prefetch={preload}>{location.name}</ProfileLink> : location.name}</span></CardTitle><div className={styles.status}><LocationStatusBadge timings={location.timings} timezone={location.timezone} showSecondary={false} pill className={marketplace.statusBadge} /></div></div>
          {variant === "summary" ? <p className={cn(styles.summaryCity, "text-xs text-text-secondary")}>{location.city || whereabouts || "Location not listed"}</p> : specialties.length > 0 && <p className={cn(styles.specialties, "text-sm leading-relaxed text-accent")}>{specialties.join(" · ")}</p>}
          {variant !== "summary" && <div className={styles.facts}><p className="text-xs leading-relaxed text-text-secondary">{whereabouts || "Location not listed"}{distance && <span> · {distance}</span>}</p>{callable && <p className="text-xs leading-relaxed text-text-secondary">{phone}</p>}</div>}
        </div>
      </header>
      {(location.slug || directionsUrl || callable) && <footer className={styles.actionBand}>
        <div className={styles.actions}>
          {directionsUrl && <a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={"Get directions to " + location.name + " in Google Maps"} className={actionClass(false, styles.directionAction)}><Navigation aria-hidden="true" className="h-4 w-4 shrink-0" /><span className={styles.directionLabel}>Directions</span></a>}
          {location.slug && <ProfileLink href={locationPath(location)} aria-describedby={nameId} onClick={onNavigate} className={actionClass(bookable, styles.bookAction)}>{actionLabel}</ProfileLink>}
          {callable && variant !== "summary" && <a href={"tel:" + dial} aria-label={"Call " + location.name + " at " + phone} className={actionClass(false, styles.callAction)}><Phone aria-hidden="true" className="h-4 w-4" /></a>}
        </div>
      </footer>}
    </article>
  </Card>;
});
