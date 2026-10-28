"use client";

import { memo, useId, useState, type ComponentProps } from "react";
import Link from "next/link";
import { Building2, MapPin, Navigation, Phone } from "lucide-react";
import { Card } from "@/components/ui";
import { buttonClassName } from "@/components/ui/Button";
import LoadingImage from "@/components/ui/LoadingImage";
import { LocationStatusBadge } from "@/components/ui/LocationStatusBadge";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { locationPath } from "@/lib/publicPaths";
import { distanceBandLabel } from "@/lib/geo/locationDetector";
import type { Location } from "./BrowseClient";
import { facilityCoordinates, facilityPresentation } from "./browsePresentation";
import styles from "./LocationCard.module.css";

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
  const logo = location.logo_url ? <LoadingImage src={location.logo_url} alt="" width={56} height={56} loading="lazy" loadingEffect={false} className={styles.logo} fallback={<Building2 aria-hidden="true" />} /> : <span aria-hidden="true" className={styles.initial}>{location.name.trim().slice(0, 1).toLocaleUpperCase() || <Building2 />}</span>;
  return <Card padding="none" hover className={styles.card}>
    <article id={variant === "summary" ? undefined : "facility-" + location.id} aria-labelledby={nameId} className={styles.article} data-variant={variant} data-selected={selected || undefined}>
      <div className={styles.identity}>
        {onSelect && mapped ? <button type="button" className={styles.logoFrame} onClick={onSelect} aria-label={"Show " + location.name + " on map"} aria-pressed={selected}>{logo}{number && <span className={styles.mapNumber}>{number}</span>}</button> : <div className={styles.logoFrame} aria-hidden="true">{logo}</div>}
        <div className={styles.information}>
          <h2 id={nameId} className="text-base font-semibold text-text tracking-tight">{location.slug ? <ProfileLink href={locationPath(location)} onClick={onNavigate} prefetch={preload}>{location.name}</ProfileLink> : location.name}</h2>
          <LocationStatusBadge timings={location.timings} timezone={location.timezone} showSecondary={false} className={styles.status} />
          {variant !== "summary" && specialties.length > 0 && <p className={styles.specialties}>{specialties.join(" · ")}</p>}
          <p className={styles.address}><MapPin aria-hidden="true" /><span>{variant === "summary" ? location.city || whereabouts || "Location not listed" : <>{whereabouts || "Location not listed"}{distance && <span> · {distance}</span>}</>}</span></p>
          {variant !== "summary" && (callable ? <a href={"tel:" + dial} aria-label={"Call " + location.name + " at " + phone} className={styles.phone}><Phone aria-hidden="true" /><span>{phone}</span></a> : <p className={styles.phoneMissing}><Phone aria-hidden="true" />Phone not listed</p>)}
        </div>
      </div>
      {(location.slug || directionsUrl) && <footer className={styles.actions}>
        {location.slug && <ProfileLink href={locationPath(location)} aria-describedby={nameId} onClick={onNavigate} className={buttonClassName({ variant: bookable ? "primary" : "outline", size: variant === "compact" ? "xs" : "md", fullWidth: true, className: "min-h-11!" })}>{actionLabel}</ProfileLink>}
        {directionsUrl && <a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={"Get directions to " + location.name + " in Google Maps"} className={buttonClassName({ variant: "outline", size: variant === "compact" ? "xs" : "md", fullWidth: true, className: "min-h-11!" })}><Navigation aria-hidden="true" className="h-4 w-4 shrink-0" />Directions</a>}
      </footer>}
    </article>
  </Card>;
});
