"use client";

import Link from "next/link";
import { Calendar, Clock, Copy, Mail, MapPin, MessageSquare, Navigation, Phone, Search, Star } from "lucide-react";
import { Breadcrumbs, Button, Card, Input, Select, useToast } from "@/components/ui";
import LoadingImage from "@/components/ui/LoadingImage";
import { LocationStatusBadge } from "@/components/ui/LocationStatusBadge";
import { getAvatarInitials } from "@/components/ui/Avatar";
import { NavigationPending } from "@/components/ui/RouteProgress";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import PublicProfileShare from "@/components/PublicProfileShare";
import { doctorPath, hasMultipleLocations, locationPath } from "@/lib/publicPaths";
import { normalizeGoogleMapsEmbed } from "@/lib/geo/googleMapsEmbed";
import { DAYS_OF_WEEK, formatMinutesTo12Hour, parseWeeklySchedule } from "@/lib/timing/locationStatus";
import type { PublicBookingStatus } from "@/lib/publicBooking";
import type { ReactNode } from "react";
import type { Doctor, LocationDetail } from "./BrowseDetailClient";
import styles from "./FacilityProfile.module.css";
import marketplace from "@/components/MarketplaceLayout.module.css";

interface Props {
  location: LocationDetail;
  bookingStatus: PublicBookingStatus;
  directionsUrl: string | null;
  doctorQuery: string;
  onQuery: (value: string) => void;
  specialty: string;
  onSpecialty: (value: string) => void;
  specialties: string[];
  matchingDoctors: Doctor[];
  visibleDoctors: Doctor[];
  onShowAll: () => void;
  onBook: (doctor: Doctor) => void;
  onPhoto: (index: number) => void;
  feeLabel: (doctor: Doctor, currency: string) => string;
  hours: ReactNode;
  hoursSummary: string;
}

export default function FacilityProfile({ location, bookingStatus, directionsUrl, doctorQuery, onQuery, specialty, onSpecialty, specialties, matchingDoctors, visibleDoctors, onShowAll, onBook, onPhoto, feeLabel, hours, hoursSummary }: Props) {
  const { toast } = useToast();
  const logo = location.logo_url || location.organization?.logo_url;
  const phone = location.phone?.trim();
  const email = location.email?.trim();
  const mapEmbed = normalizeGoogleMapsEmbed(location.googleMapsEmbedUrl || "");
  const address = location.address?.trim() && location.address.trim() !== "." ? location.address : location.city;
  const affiliated = hasMultipleLocations(location) && location.organization?.name && location.organization.name !== location.name;
  const { schedule, is24x7, hasExplicitSchedule } = parseWeeklySchedule(location.timings);
  const week = [...DAYS_OF_WEEK.slice(1), DAYS_OF_WEEK[0]];
  const initials = <span aria-hidden="true">{getAvatarInitials(location.name)}</span>;
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast({ title: "Copied", description: "Contact detail copied.", variant: "success" }); }
    catch { toast({ title: "Could not copy", description: "Select the contact detail to copy it.", variant: "error" }); }
  };
  const visit = <div className={styles.visit}>
    {address && <div className={styles.visitRow}>
      <span className={styles.visitIcon}><MapPin aria-hidden="true" /></span>
      <div className={styles.contactText}><span>Address</span><p>{address}</p></div>
      <button type="button" className={styles.iconButton} onClick={() => void copy(address)} aria-label="Copy address" title="Copy address"><Copy aria-hidden="true" /></button>
    </div>}
    {phone && <div className={styles.visitRow}>
      <span className={styles.visitIcon}><Phone aria-hidden="true" /></span>
      <div className={styles.contactText}><span>Reception phone</span><a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a></div>
      <button type="button" className={styles.iconButton} onClick={() => void copy(phone)} aria-label="Copy phone number" title="Copy phone number"><Copy aria-hidden="true" /></button>
    </div>}
    {email && <div className={styles.visitRow}>
      <span className={styles.visitIcon}><Mail aria-hidden="true" /></span>
      <div className={styles.contactText}><span>Email</span><a href={`mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`}>{email}</a></div>
      <button type="button" className={styles.iconButton} onClick={() => void copy(email)} aria-label="Copy email address" title="Copy email address"><Copy aria-hidden="true" /></button>
    </div>}
  </div>;
  const map = mapEmbed ? <div className={styles.embeddedMap}><iframe src={mapEmbed} title={`Map of ${location.name}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div> : null;
  return <>
    <MarketplaceNavbar showSignUp showSearch={false} />
    <div className={`${marketplace.content} ${styles.container}`} data-facility-content>
      <div className={styles.breadcrumbs}>
        <Breadcrumbs separator={<span aria-hidden="true">/</span>} items={[{ label: "Browse locations", href: "/browse" }, ...(location.city ? [{ label: location.city }] : []), { label: location.name }]} />
      </div>
      <Card padding="none" className={styles.heroCard}>
        <section className={styles.hero} aria-labelledby="facility-title">
          <div className={styles.heroIdentity}>
            <div className={styles.logo}>{logo ? <LoadingImage src={logo} alt="" width={72} height={72} loadingEffect={false} className="h-full w-full object-contain p-2" fallback={initials} /> : initials}</div>
            <div className={styles.heroText}>
              <h1 id="facility-title">{location.name}</h1>
              {affiliated && <p className={styles.affiliation}>Branch of {location.organization!.name}</p>}
              <div className={styles.heroMeta}>
                {location.city && <span><MapPin aria-hidden="true" />{location.city}</span>}
                <LocationStatusBadge timings={location.timings} timezone={location.timezone} className={`${marketplace.statusBadge} ${styles.openingStatus}`} pill />
              </div>
            </div>
          </div>
          <div className={styles.heroActions}>
            {phone && <a className={`${styles.contactAction} ${styles.callAction}`} href={`tel:${phone.replace(/[^+\d]/g, "")}`}><Phone aria-hidden="true" />Call</a>}
            {directionsUrl && <a className={styles.contactAction} href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${location.name} in Google Maps`}><Navigation aria-hidden="true" />Directions</a>}
            {phone && <a className={`${styles.contactAction} ${styles.whatsapp}`} href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hello, I would like to inquire about appointments and doctors at ${location.name}.`)}`} target="_blank" rel="noopener noreferrer"><MessageSquare aria-hidden="true" />WhatsApp</a>}
            <PublicProfileShare title={location.name} path={locationPath(location)} />
          </div>
        </section>
      </Card>
      <div className={`${marketplace.detailsColumns} ${styles.layout}`}>
        <Card padding="none" className={styles.doctors}>
          <section aria-labelledby="facility-doctors" className={styles.doctorSection}>
            <header className={styles.sectionHeader}><h2 id="facility-doctors">Doctors</h2><p>{bookingStatus === "check_availability" ? "Choose a doctor to see available dates and times." : "View our doctors and contact reception about appointments."}</p></header>
            {bookingStatus === "contact_location" && <div role="status" className={styles.notice}><strong>Online booking is temporarily unavailable.</strong><p>Please contact reception directly.</p></div>}
            <div className={styles.filters}>
              {location.doctors.length > 8 && <Input icon={<Search className="h-4 w-4" aria-hidden="true" />} value={doctorQuery} onChange={event => onQuery(event.target.value)} placeholder="Search doctors or specialties" aria-label="Search doctors at this location" />}
              {specialties.length > 1 && <Select label="Specialty" value={specialty} onChange={event => onSpecialty(event.target.value)} options={[{ value: "", label: "All specialties" }, ...specialties.map(value => ({ value, label: value }))]} />}
            </div>
            {(doctorQuery || specialty) && <p role="status" className={styles.results}>Showing {matchingDoctors.length} {matchingDoctors.length === 1 ? "doctor" : "doctors"}</p>}
            {location.doctors.length === 0 ? <div className={styles.empty}><p>No doctors are listed for online booking at this location right now.</p><Link href="/browse">Browse other locations</Link>{phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>Call reception</a>}</div> : matchingDoctors.length === 0 ? <p role="status" className={styles.empty}>No doctors match this search. Try a name or specialty.</p> : <div className={styles.doctorList}>
              {visibleDoctors.map(doc => <article key={doc.id} className={styles.doctorRow}>
                <Link href={doctorPath(doc, location)} className={styles.doctorIdentity}>
                  <NavigationPending />
                  <div className={styles.avatar}>{doc.image_url ? <LoadingImage src={doc.image_url} alt="" width={52} height={52} loading="lazy" className="h-full w-full object-cover" fallback={<span aria-hidden="true">{getAvatarInitials(doc.name.replace(/^Dr\.?\s*/i, ""))}</span>} /> : <span aria-hidden="true">{getAvatarInitials(doc.name.replace(/^Dr\.?\s*/i, ""))}</span>}</div>
                  <div className={styles.doctorText}><h3>Dr. {doc.name.replace(/^Dr\.?\s*/i, "")}</h3><p className={styles.specialty}>{doc.specialization || "Specialty not listed"}</p><p className={styles.credentials}>{[doc.qualification, doc.experience_years > 0 ? `${doc.experience_years}+ years experience` : null].filter(Boolean).join(" · ")}</p>
                    {doc.rating != null && (doc.reviewsCount || 0) > 0 && <p className={styles.rating}><Star aria-hidden="true" />{doc.rating.toFixed(1)} <span>({doc.reviewsCount} reviews)</span></p>}
                  </div>
                </Link>
                <footer className={styles.doctorFooter}>
                  {(doc.isOnlineBookingClosed || doc.isAvailable === false || doc.bookingMode === "sequential_queue") && <p className={styles.doctorStatus}><Clock aria-hidden="true" /><span>{[doc.isAvailable === false ? "Unavailable today" : doc.isOnlineBookingClosed ? "Online booking closed today" : null, doc.bookingMode === "sequential_queue" ? "Queue tokens" : null].filter(Boolean).join(" · ")}</span></p>}
                  <div className={styles.doctorBooking}>
                  <div className={styles.doctorFee}><span>Consultation fee</span><strong>{feeLabel(doc, location.currency || "INR")}</strong></div>
                  <div className={styles.doctorActions}><Button variant="primary" className="min-h-11! w-full" onClick={() => onBook(doc)} disabled={bookingStatus !== "check_availability"}><Calendar aria-hidden="true" />{bookingStatus !== "check_availability" ? "Contact reception" : doc.isAvailable === false ? "Find next date" : doc.isOnlineBookingClosed ? "Find next date" : "Book now"}</Button></div>
                  </div>
                </footer>
              </article>)}
            </div>}
            {matchingDoctors.length > visibleDoctors.length && <Button variant="outline" className="mt-4 min-h-11! w-full" onClick={onShowAll}>Show all {matchingDoctors.length} doctors</Button>}
          </section>
        </Card>
        <aside aria-label="Facility information" className={styles.sidebar}>
          <Card padding="none" className={styles.information}>
            <div className={styles.informationBody}>
              {visit}
              <section className={styles.hoursSection} aria-labelledby="facility-hours" title={hoursSummary}>
                <span className={styles.visitIcon}><Clock aria-hidden="true" /></span>
                <div className={styles.hoursBody}><h2 id="facility-hours">{location.facilityType === "clinic" ? "Clinic opening hours" : "Opening hours"}</h2>
                  {hasExplicitSchedule ? <dl className={styles.hours}>
                    {week.map(day => <div key={day}>
                      <dt>{day.slice(0, 3)}</dt>
                      <dd className={schedule[day].length ? undefined : styles.unlisted}>
                        {is24x7 ? "Open 24 hours" : schedule[day].length ? schedule[day].map(slot => `${formatMinutesTo12Hour(slot.startMinutes)} – ${formatMinutesTo12Hour(slot.endMinutes)}${slot.isOvernight ? " (next day)" : ""}`).join(", ") : "Not listed"}
                      </dd>
                    </div>)}
                  </dl> : hours}
                </div>
              </section>
              {map}
              {location.description && <p className={styles.description}>{location.description}</p>}
              {affiliated && location.organization?.description && <p className={styles.description}>{location.organization.description}</p>}
              {Boolean(location.amenities?.length || location.images?.length) && <details className={styles.disclosure}>
                <summary>Facilities &amp; photos</summary>
                {Boolean(location.amenities?.length) && <><h2 className={styles.amenityTitle}>Amenities ({location.amenities!.length})</h2><ul className={styles.amenities}>{location.amenities!.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
                {Boolean(location.images?.length) && <><h2 className={styles.amenityTitle}>Photos</h2><div className={styles.gallery}>{location.images!.slice(0, 6).map((image, index) => <button key={index} type="button" onClick={() => onPhoto(index)} aria-label={`View facility photo ${index + 1}`}><LoadingImage src={image} alt={`Facility photo ${index + 1}`} loading="lazy" className="h-full w-full object-cover" /></button>)}</div><Button variant="outline" className="mt-4 min-h-11! w-full" onClick={() => onPhoto(0)}>View all photos</Button></>}
              </details>}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  </>;
}
