"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Calendar, ChevronDown, Clock, Copy, MessageSquare, Navigation, Phone, Search, Star } from "lucide-react";
import { Badge, Breadcrumbs, Button, Card, CardTitle, Input, Select, cn, useToast } from "@/components/ui";
import { buttonClassName } from "@/components/ui/Button";
import LoadingImage from "@/components/ui/LoadingImage";
import { LocationStatusBadge } from "@/components/ui/LocationStatusBadge";
import { getAvatarInitials } from "@/lib/avatar";
import { NavigationPending } from "@/components/ui/RouteProgress";
import { PublicPharmacyCatalogue } from "@/components/pharmacy/PublicPharmacyCatalogue";
import { facilityHasDoctorSection } from "@/lib/facility";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import PublicProfileShare from "@/components/PublicProfileShare";
import { doctorPath, hasMultipleLocations, locationPath } from "@/lib/publicPaths";
import { normalizeGoogleMapsEmbed } from "@/lib/geo/googleMapsEmbed";
import type { PublicBookingStatus } from "@/lib/publicBooking";
import type { Doctor, LocationDetail } from "./BrowseDetailClient";
import { facilityHoursRows, facilityHoursSummary } from "./facilityView";
import styles from "./FacilityProfile.module.css";
import care from "@/components/PublicCare.module.css";
import marketplace from "@/components/MarketplaceLayout.module.css";

interface Props {
  location: LocationDetail; bookingStatus: PublicBookingStatus; directionsUrl: string | null;
  doctorQuery: string; onQuery: (value: string) => void; specialty: string; onSpecialty: (value: string) => void;
  specialties: string[]; matchingDoctors: Doctor[]; visibleDoctors: Doctor[]; onShowAll: () => void;
  onBook: (doctor: Doctor) => void; onPhoto: (index: number) => void;
  feeLabel: (doctor: Doctor, currency: string) => string; hours: ReactNode;
}

export default function FacilityProfile({ location, bookingStatus, directionsUrl, doctorQuery, onQuery, specialty, onSpecialty, specialties, matchingDoctors, visibleDoctors, onShowAll, onBook, onPhoto, feeLabel, hours }: Props) {
  const { toast } = useToast();
  const [now, setNow] = useState(() => new Date());
  const hasDoctors = facilityHasDoctorSection(location);
  const hasPharmacy = location.facilityType === "pharmacy" || location.pharmacy?.catalogueEnabled === true;
  const standalonePharmacy = hasPharmacy && !hasDoctors;
  const firstSection = hasDoctors ? "facility-doctors" : hasPharmacy ? "facility-medicines" : "facility-services";
  const [activeSection, setActiveSection] = useState(firstSection);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const logo = location.logo_url || location.organization?.logo_url;
  const phone = location.phone?.trim();
  const dial = phone?.replace(/[^+\d]/g, "") || "";
  const callable = Boolean(phone && /^\+?[\d\s().-]+$/.test(phone) && /^\+?\d{7,15}$/.test(dial));
  const email = location.email?.trim();
  const mapEmbed = normalizeGoogleMapsEmbed(location.googleMapsEmbedUrl || "");
  const address = location.address?.trim() && location.address.trim() !== "." ? location.address : location.city;
  const affiliated = hasMultipleLocations(location) && location.organization?.name && location.organization.name !== location.name;
  const rows = facilityHoursRows(location.timings, location.timezone, now);
  const bookable = bookingStatus === "check_availability" && location.doctors.length > 0;
  const singleDoctor = location.doctors.length === 1 ? location.doctors[0] : null;
  const hasAbout = Boolean(location.description?.trim() || (affiliated && location.organization?.description?.trim()) || location.amenities?.length || location.images?.length);
  const whatsappUrl = callable ? `https://wa.me/${dial.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, I would like to inquire about ${hasDoctors ? "appointments and doctors" : hasPharmacy ? "medicine availability" : "services"} at ${location.name}.`)}` : null;
  const navigation = [...(hasDoctors ? [{ id: "facility-doctors", label: "Doctors" }] : []), ...(hasPharmacy ? [{ id: "facility-medicines", label: "Medicines" }] : []), ...(!hasDoctors && !hasPharmacy ? [{ id: "facility-services", label: "Services" }] : []), { id: "facility-hours", label: "Hours" }, { id: "facility-location", label: "Location" }, ...(hasAbout ? [{ id: "facility-about", label: "About" }] : [])];
  useEffect(() => {
    const update = () => { const id = window.location.hash.slice(1); setActiveSection(["facility-doctors", "facility-medicines", "facility-services", "facility-hours", "facility-location", "facility-about"].includes(id) ? id : firstSection); };
    queueMicrotask(update);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [firstSection]);
  const copy = async (value: string, name: string) => {
    try { await navigator.clipboard.writeText(value); toast({ title: "Copied", description: name + " copied.", variant: "success" }); }
    catch { toast({ title: "Could not copy", description: "Select the " + name.toLowerCase() + " to copy it.", variant: "error" }); }
  };
  const showDoctors = () => { setActiveSection("facility-doctors"); document.getElementById("facility-doctors")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); };
  const bookFromHeader = () => { if (singleDoctor && bookable) onBook(singleDoctor); else showDoctors(); };
  const heroLinkClass = cn(buttonClassName({ variant: "outline", size: "sm", className: "min-h-11!" }), styles.contactAction);
  const doctorAction = (doc: Doctor) => !bookable ? "Contact reception" : doc.isAvailable === false || doc.isOnlineBookingClosed ? "Find next date" : "Book now";

  const locationInformation = (<aside aria-label="Facility information" className={standalonePharmacy ? styles.pharmacyLocation : styles.sidebar}>
          <Card padding="none" className={care.card}>
            <section id="facility-location" aria-labelledby="facility-location-title" className={styles.locationSection}>
              {!standalonePharmacy && mapEmbed && <div className={styles.embeddedMap}><iframe src={mapEmbed} title={`Map of ${location.name}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>}
              <div className={styles.locationBody}><CardTitle as="h2" className={care.sectionTitle}><span id="facility-location-title">Location</span></CardTitle>
                <p className="text-sm leading-relaxed text-text-secondary">{address || "Address not listed"}</p>
                {standalonePharmacy && (mapEmbed ? <div className={styles.embeddedMap}><iframe src={mapEmbed} title={`Map of ${location.name}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div> : directionsUrl ? <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}><Navigation aria-hidden="true" /><span>View map</span></a> : null)}
                <div className={styles.locationActions}>{directionsUrl && <a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${location.name}`} className={buttonClassName({ size: "sm", className: "min-h-11!" })}><Navigation aria-hidden="true" className="h-4 w-4" />Get directions</a>}{address && <Button variant="outline" size="sm" onClick={() => copy(address, "Address")} aria-label="Copy address" className="min-h-11!">Copy</Button>}</div>
              </div>
            </section>
            <section id="facility-hours" className={styles.weeklyHours}>
              <details id="facility-weekly-hours" open={!rows.length}><summary>Weekly opening hours<ChevronDown aria-hidden="true" /></summary>
                <section aria-label={location.facilityType === "clinic" ? "Clinic opening hours" : "Opening hours"}>{rows.length ? <dl className={styles.hours}>{rows.map(row => <div key={row.label} className={row.today ? styles.today : undefined}><dt>{row.label}{row.today && <span> · Today</span>}</dt><dd className={row.listed ? undefined : "text-text-secondary"}>{row.value}</dd></div>)}</dl> : hours}</section>
              </details>
            </section>
          </Card>
        </aside>);

  return <div className={standalonePharmacy ? styles.pharmacyPage : undefined}>
    <MarketplaceNavbar showSignUp showSearch={false} />
    <div className={cn(marketplace.content, styles.container)} data-facility-content>
      <section className={styles.heroBand} aria-labelledby="facility-title">
      <div className={styles.breadcrumbs}><Breadcrumbs separator={<span aria-hidden="true">/</span>} items={[{ label: "Browse locations", href: "/browse" }, ...(location.city ? [{ label: location.city }] : []), { label: location.name }]} /></div>

          <div className={styles.hero}>
            <div className={styles.heroIdentity}>
              <div className={styles.logo}>{logo ? <LoadingImage src={logo} alt="" width={72} height={72} loadingEffect={false} className="h-full w-full object-contain p-2" fallback={<span aria-hidden="true">{getAvatarInitials(location.name)}</span>} /> : <span aria-hidden="true">{getAvatarInitials(location.name)}</span>}</div>
              <div className={styles.heroText}>
                <h1 id="facility-title" className={care.title}>{location.name}</h1>
                {affiliated && <p className="mt-1 text-sm text-text-secondary">Branch of {location.organization!.name}</p>}
                <div className={styles.heroMeta}>
                  {location.city && <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">{location.city}</span>}
                  {address && address !== location.city && <span className="text-sm">{address}</span>}
                </div>
              </div>
            </div>
            <div className={styles.heroActions}>
              {bookable && <Button className={cn(styles.heroBooking, "min-h-11!")} size="sm" onClick={bookFromHeader} icon={<Calendar aria-hidden="true" />}>Book appointment</Button>}
              {callable && <a className={heroLinkClass} href={"tel:" + dial}><Phone aria-hidden="true" className="h-4 w-4" /><span>Call</span></a>}
              {directionsUrl && <a className={heroLinkClass} href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${location.name} in Google Maps`}><Navigation aria-hidden="true" className="h-4 w-4" /><span>Directions</span></a>}
              {whatsappUrl && <a className={heroLinkClass} href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageSquare aria-hidden="true" className="h-4 w-4" /><span>WhatsApp</span></a>}
              <PublicProfileShare title={location.name} path={locationPath(location)} className={cn(styles.shareAction, "min-h-11!")} stackOnMobile />
            </div>
          </div>
      </section>
      <Card padding="none" className={cn(care.card, styles.summaryCard)}><dl className={cn(care.summary, styles.summary)}>
        <div><dt>Today</dt><dd><LocationStatusBadge timings={location.timings} timezone={location.timezone} context="services" showSecondary className={styles.openingStatus} /></dd></div>
        <div><dt>Hours</dt><dd><a href="#facility-hours" onClick={() => { const detail = document.getElementById("facility-weekly-hours"); if (detail instanceof HTMLDetailsElement) detail.open = true; }}>{facilityHoursSummary(rows)}</a></dd></div>
        {callable && <div className={styles.contactCell}><dt>{hasDoctors ? "Reception" : "Contact"}</dt><dd className={styles.summaryContact}><a href={"tel:" + dial}>{phone}</a><Button variant="ghost" size="xs" onClick={() => copy(phone!, "Phone number")} aria-label="Copy phone number" icon={<Copy aria-hidden="true" />} /></dd></div>}
        {email && <div className={styles.contactCell}><dt>Email</dt><dd className={styles.summaryContact}><a href={`mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`}>{email}</a><Button variant="ghost" size="xs" onClick={() => copy(email, "Email address")} aria-label="Copy email address" icon={<Copy aria-hidden="true" />} /></dd></div>}
      </dl></Card>
      <nav aria-label="Facility sections" className={styles.jumpNav}>{navigation.map(item => <a key={item.id} href={"#" + item.id} aria-current={activeSection === item.id ? "location" : undefined} onClick={() => setActiveSection(item.id)} className={buttonClassName({ variant: activeSection === item.id ? "secondary" : "ghost", size: "sm", className: "min-h-11! shrink-0" })}>{item.label}</a>)}</nav>
      <div className={cn(styles.layout, standalonePharmacy && styles.pharmacyLayout)}>
        <div className="min-w-0 space-y-8">
        {hasDoctors && <section id="facility-doctors" aria-labelledby="facility-doctors-title" className={styles.doctors}>
          <header className={styles.sectionHeader}><h2 id="facility-doctors-title" className={care.sectionTitle}>Doctors</h2>{bookable && <p className="text-sm text-text-secondary">Choose a doctor to check appointment availability.</p>}</header>
          {bookingStatus === "contact_location" && <div role="status" className={styles.notice}><p className="font-medium">Online booking is temporarily unavailable.</p><p>Please contact reception directly.</p></div>}
          <div className={styles.filters}>
            {location.doctors.length > 8 && <Input icon={<Search className="h-4 w-4" aria-hidden="true" />} value={doctorQuery} onChange={event => onQuery(event.target.value)} placeholder="Search doctors or specialties" aria-label="Search doctors at this location" />}
            {specialties.length > 1 && <Select label="Specialty" value={specialty} onChange={event => onSpecialty(event.target.value)} options={[{ value: "", label: "All specialties" }, ...specialties.map(value => ({ value, label: value }))]} />}
          </div>
          {(doctorQuery || specialty) && <p role="status" className="my-3 text-sm text-text-secondary">Showing {matchingDoctors.length} {matchingDoctors.length === 1 ? "doctor" : "doctors"}</p>}
          {location.doctors.length === 0 ? <Card padding="md"><p className="text-sm text-text-secondary">No doctors are listed for online booking at this location right now.</p><Link href="/browse" className="mt-3 inline-flex min-h-11 items-center text-sm text-accent underline">Browse other locations</Link>{callable && <a href={"tel:" + dial} className="inline-flex min-h-11 items-center text-sm text-accent underline">Call reception</a>}</Card> : matchingDoctors.length === 0 ? <p role="status" className={styles.notice}>No doctors match this search. Try a name or specialty.</p> : <div className={styles.doctorList}>
            {visibleDoctors.map(doc => {
              const status = [doc.isAvailable === false ? "Unavailable today" : doc.isOnlineBookingClosed ? "Online booking closed today" : null, doc.bookingMode === "sequential_queue" ? "Queue tokens" : null].filter(Boolean).join(" · ");
              return <Card key={doc.id} padding="none" className={care.card}><article className={styles.doctorRow} data-facility-doctor>
              <Link href={doctorPath(doc, location)} className={styles.doctorIdentity}><NavigationPending />
                <div className={styles.avatar}>{doc.image_url ? <LoadingImage src={doc.image_url} alt="" width={56} height={56} loading="lazy" className="h-full w-full object-cover" fallback={<span aria-hidden="true">{getAvatarInitials(doc.name.replace(/^Dr\.?\s*/i, ""))}</span>} /> : <span aria-hidden="true">{getAvatarInitials(doc.name.replace(/^Dr\.?\s*/i, ""))}</span>}</div>
                <div className={styles.doctorText}><h3 className={cn(care.sectionTitle, styles.doctorName)}>Dr. {doc.name.replace(/^Dr\.?\s*/i, "")}</h3><p className="text-sm text-accent">{doc.specialization || "Specialty not listed"}</p><p className="text-xs leading-relaxed text-text-secondary">{[doc.qualification, doc.experience_years > 0 ? `${doc.experience_years}+ years experience` : null].filter(Boolean).join(" · ")}</p>
                  {doc.rating != null && (doc.reviewsCount || 0) > 0 && <p className={styles.rating}><Star aria-hidden="true" />{doc.rating.toFixed(1)} <span>({doc.reviewsCount} reviews)</span></p>}
                </div>
              </Link>
              <div className={styles.doctorFee}><span className="text-xs text-text-secondary">Consultation fee</span><strong className={care.fee}>{feeLabel(doc, location.currency || "INR")}</strong></div>
              <div className={styles.doctorBooking}>
              {status && <p className={styles.doctorStatus}><Clock aria-hidden="true" /><span>{status}</span></p>}
                <div className={styles.doctorActions}><Button data-facility-booking-action size="sm" className="min-h-11! w-full" onClick={() => onBook(doc)} disabled={!bookable} icon={<Calendar aria-hidden="true" />}>{doctorAction(doc)}</Button></div>
              </div>
            </article></Card>;
            })}
          </div>}
          {matchingDoctors.length > visibleDoctors.length && <Button variant="outline" className="mt-4 min-h-11! w-full" onClick={onShowAll}>Show all {matchingDoctors.length} doctors</Button>}
        </section>}
        {hasPharmacy && <section id="facility-medicines" aria-labelledby="facility-medicines-title"><header className={standalonePharmacy && location.pharmacy?.catalogueEnabled ? "sr-only" : styles.sectionHeader}><h2 id="facility-medicines-title" className={care.sectionTitle}>Medicines</h2></header><PublicPharmacyCatalogue key={location.id} slug={location.slug} locationId={location.id} published={location.pharmacy?.catalogueEnabled === true} allowPickup={location.pharmacy?.pickupEnabled === true} timings={location.timings} timezone={location.timezone} countryCode={location.countryCode} sidebar={standalonePharmacy ? locationInformation : undefined} /></section>}
        {!hasDoctors && !hasPharmacy && <section id="facility-services" aria-labelledby="facility-services-title"><h2 id="facility-services-title" className={care.sectionTitle}>Service enquiries</h2><Card className="mt-4"><p className="text-sm text-text-secondary">Contact this location for available services, preparation instructions and visits.</p>{callable && <a className={heroLinkClass} href={"tel:" + dial}>Call {location.name}</a>}</Card></section>}
        </div>
        {!standalonePharmacy && locationInformation}
        {hasAbout && <section id="facility-about" aria-labelledby="facility-about-title" className={styles.aboutSection}><h2 id="facility-about-title" className={cn(care.sectionTitle, "mb-3")}>About</h2>
          <Card padding="md" className={care.card}>
            {location.description && <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{location.description}</p>}
            {affiliated && location.organization?.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{location.organization.description}</p>}
            {Boolean(location.amenities?.length || location.images?.length) && <details className={styles.disclosure}><summary>Facilities &amp; photos<ChevronDown aria-hidden="true" /></summary>
              {Boolean(location.amenities?.length) && <><h3 className="mb-2 mt-4 text-sm font-medium">Amenities ({location.amenities!.length})</h3><ul className="flex flex-wrap gap-2">{location.amenities!.map((item, index) => <li key={index}><Badge variant="secondary">{item}</Badge></li>)}</ul></>}
              {Boolean(location.images?.length) && <><h3 className="mb-2 mt-4 text-sm font-medium">Photos</h3><div className={styles.gallery}>{location.images!.slice(0, 6).map((image, index) => <Button key={index} type="button" variant="ghost" className="relative h-full w-full p-0!" onClick={() => onPhoto(index)} aria-label={`View facility photo ${index + 1}`}><LoadingImage src={image} alt={`Facility photo ${index + 1}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></Button>)}</div><Button variant="outline" className="mt-4 min-h-11! w-full" onClick={() => onPhoto(0)}>View all photos</Button></>}
            </details>}
          </Card>
        </section>}
      </div>
    </div>
  </div>;
}
