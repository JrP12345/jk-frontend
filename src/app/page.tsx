import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, Building2, Check, ChevronDown, ClipboardList, Layers3, MessageCircle, Pill, Search } from "lucide-react";
import EkavyuLogo from "@/components/ui/EkavyuLogo";
import { getSiteUrl } from "@/lib/siteUrl";
import HomeNavigation from "./home/HomeNavigation";
import HomeAction from "./home/HomeAction";
import HomePricing from "./home/HomePricing";
import PatientDiscovery from "./home/PatientDiscovery";
import ClinicExperience from "./home/ClinicExperience";
import PharmacyExperience from "./home/PharmacyExperience";
import styles from "./home/home.module.css";

const title = "Ekavyu — Care, connected. For patients, clinics and pharmacies.";
const description = "Find doctors and clinics, explore appointment options, and discover workspaces for clinic and pharmacy teams. Browse care or choose how to get started with Ekavyu.";
const siteUrl = getSiteUrl();
export const metadata: Metadata = {
  title, description,
  ...(siteUrl ? { metadataBase: siteUrl, alternates: { canonical: "/" } } : {}),
  openGraph: { title, description, type: "website", siteName: "Ekavyu", ...(siteUrl ? { url: "/", images: [{ url: "/ekavyu-home-social.png", width: 1200, height: 630, alt: "Ekavyu — Care, connected. Patients, clinics and pharmacies." }] } : {}) },
  twitter: { card: siteUrl ? "summary_large_image" : "summary", title, description, ...(siteUrl ? { images: ["/ekavyu-home-social.png"] } : {}) },
};
const questions = [
  { question: "Do I need an account to find a doctor?", answer: "No. Browse doctors and clinic locations without signing in. A profile shows the supplied practice details, fees and available booking or contact options. Availability varies by provider." },
  { question: "Is my appointment confirmed as soon as I book?", answer: "Check the status shown after booking. Some providers require payment before confirmation. Save your private tracker link for visit updates, and contact reception for appointment changes or verified payment instructions." },
  { question: "How does clinic setup work?", answer: "Send your practice name, city and contact details through the setup request. Our team reviews the request, confirms your plan and provisions the organization. Submitting a request does not instantly activate an account." },
  { question: "Can an independent pharmacy get started?", answer: "Yes. The pharmacy onboarding page lists eligible published trials when available. Verify your business email to continue. Stock and sales activity require the relevant branch setup, access and reviewed issuer details. Real operating and professional requirements still apply." },
  { question: "What is required for WhatsApp updates?", answer: "A configured connection, recorded consent, recipient authorization, applicable plan access and approved templates are required. Shared sending also depends on message credits. Provider acceptance does not guarantee delivery or reading. WhatsApp booking is not available." },
];

export default async function Home() {
  const cookieStore = await cookies();
  const isBookingGuest = cookieStore.get("ekavyu_session")?.value === "guest";
  if (!isBookingGuest && (cookieStore.has("refresh_token") || cookieStore.has("access_token"))) redirect("/dashboard");
  return <div className={styles.home}>
    <a href="#main-content" className={styles.skipLink}>Skip to content</a>
    <HomeNavigation />
    <main id="main-content" tabIndex={-1}>
      <section className={`${styles.hero} ${styles.container}`} aria-labelledby="hero-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.brandRule} />For patients and care teams</p>
          <h1 id="hero-heading">Care,<br /><span>connected.</span></h1>
          <p className={styles.heroDescription}>Find a doctor. Run your clinic. Keep pharmacy stock in view.</p>
          <p className={styles.heroSupporting}>One platform for patients and the teams looking after them.</p>
          <div className={styles.actions}>
            <HomeAction href="/browse" event="home_find_care">Browse care <ArrowRight size={18} aria-hidden="true" /></HomeAction>
            <HomeAction href="#your-path" secondary>Explore the platform <ArrowDown size={17} aria-hidden="true" /></HomeAction>
          </div>
          <p className={styles.heroNote}><Check size={14} aria-hidden="true" />Browse without an account</p>
        </div>
        <figure className={styles.heroVisual}>
          <div className={styles.heroVisualHeading}><span><Layers3 size={17} aria-hidden="true" />The clinic day, in one view</span></div>
          <div className={styles.heroScreen}>
            {/* Pre-optimized application capture. Eager only for the hero. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- Already optimized local WebP; preserve its native, server-rendered priority hint. */}
            <img src="/landing/product/overview-desktop.webp" width={1094} height={800} alt="Ekavyu practice dashboard with fictional appointment activity, collections and team shortcuts." fetchPriority="high" loading="eager" decoding="async" />
          </div>
          <figcaption>Inside the Ekavyu workspace</figcaption>
        </figure>
      </section>

      <section id="your-path" className={`${styles.audienceSection} ${styles.container}`} aria-labelledby="audience-heading">
        <div className={styles.audienceIntro}><h2 id="audience-heading">What brings you to Ekavyu?</h2><p>Explore the part that fits your day.</p></div>
        <div className={styles.audienceGrid}>
          <a href="#for-patients" className={styles.audienceLink}><span className={styles.audienceIcon}><Search size={22} aria-hidden="true" /></span><div><h3>I’m looking for care</h3><p>Find a doctor and plan your visit.</p></div><ArrowRight size={20} aria-hidden="true" /></a>
          <a href="#for-organizations" className={styles.audienceLink}><span className={styles.audienceIcon}><Building2 size={22} aria-hidden="true" /></span><div><h3>I run a clinic or hospital</h3><p>Appointments, records and billing.</p></div><ArrowRight size={20} aria-hidden="true" /></a>
          <a href="#for-pharmacies" className={styles.audienceLink}><span className={styles.audienceIcon}><Pill size={22} aria-hidden="true" /></span><div><h3>I manage a pharmacy</h3><p>Inventory, dispensing and sales.</p></div><ArrowRight size={20} aria-hidden="true" /></a>
        </div>
      </section>

      <section id="for-patients" className={`${styles.patientSection} ${styles.container}`} aria-labelledby="patients-heading">
        <div className={styles.journeyCopy}>
          <p className={styles.eyebrow}>For patients</p><h2 id="patients-heading">Find a doctor. Plan your visit.</h2>
          <p>Compare practice details, fees and appointment options before choosing your next step.</p>
        </div>
        <div className={styles.patientProduct}><PatientDiscovery /></div>
        <div className={styles.patientDetails}>
          <ol className={styles.journeySteps}>
            <li><span>01</span><div><h3>Find care that fits</h3><p>Search by city or specialty. Review locations, fees and contact details.</p></div></li>
            <li><span>02</span><div><h3>Choose your visit</h3><p>Check appointment options and book where online booking is available.</p></div></li>
            <li><span>03</span><div><h3>Keep track of what’s next</h3><p>Save your private tracker link and follow the status of your visit.</p></div></li>
          </ol>
          <Link href="/browse" prefetch={false} className={styles.textLink} data-home-event="home_find_care">Find your next appointment <ArrowRight size={18} aria-hidden="true" /></Link>
          <p className={styles.smallNote}>Booking and payment requirements vary by provider.</p>
        </div>
      </section>

      <section id="for-organizations" className={styles.clinicSection} aria-labelledby="clinics-heading"><div className={styles.container}>
        <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>For clinics & hospitals</p><h2 id="clinics-heading">From arrival to invoice. One shared workspace.</h2></div><div><p>Keep reception, doctors and billing teams working with the same visit details, within their assigned access.</p><Link href="/onboarding?mode=new_org" prefetch={false} className={styles.textLink} data-home-event="home_organization_setup">Request clinic setup <ArrowRight size={18} aria-hidden="true" /></Link></div></div>
        <ClinicExperience />
        <div className={styles.clinicNotes}>
          <div><ClipboardList size={20} aria-hidden="true" /><div><h3>The right access for each role</h3><p>Staff roles and location assignments control access to appointments, patient records and billing.</p></div></div>
          <div><MessageCircle size={20} aria-hidden="true" /><div><h3>Keep patients informed</h3><p>Configured WhatsApp updates support the visit. Consent, templates and plan access are required.</p><a href="#whatsapp-question">See messaging requirements <ArrowRight size={14} aria-hidden="true" /></a></div></div>
        </div>
        <p className={styles.clinicScope}>Available tools depend on your plan, enabled modules, locations and staff permissions.</p>
      </div></section>

      <section id="for-pharmacies" className={`${styles.pharmacySection} ${styles.container}`} aria-labelledby="pharmacy-heading">
        <div className={styles.pharmacyHeading}><div><p className={styles.eyebrow}>For pharmacy teams</p><h2 id="pharmacy-heading">Know your stock.<br />Keep your counter moving.</h2></div><div><p>Inventory, prescriptions, purchases and sales, with the branch and staff controls your pharmacy needs.</p><Link href="/pharmacy-start" prefetch={false} className={styles.textLink} data-home-event="home_pharmacy_setup">Start pharmacy onboarding <ArrowRight size={18} aria-hidden="true" /></Link></div></div>
        <div className={styles.pharmacyLayout}><PharmacyExperience /><div className={styles.pharmacyDetails}>
          <div><span className={styles.featureNumber}>01 / Inventory</span><h3>Track stock by batch and expiry.</h3><p>Review medicines, quantities and stock movements in one workspace.</p></div>
          <div><span className={styles.featureNumber}>02 / Prescriptions & sales</span><h3>From prescription to invoice.</h3><p>Work with authorised prescriptions, dispensing, retail invoices and recorded collections.</p></div>
          <div><span className={styles.featureNumber}>03 / Daily operations</span><h3>Keep purchases and returns in view.</h3><p>Review suppliers, balances and the cash drawer with assigned permissions.</p></div>
          <p className={styles.smallNote}>Operating, issuer and professional requirements apply.</p>
        </div></div>
      </section>

      <section id="how-it-works" className={`${styles.setupSection} ${styles.container}`} aria-labelledby="setup-heading">
        <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>Getting started</p><h2 id="setup-heading">Here’s what happens next.</h2></div><p>Patients can browse right away. Teams follow the setup process for their workspace.</p></div>
        <div className={styles.setupGrid}>
          <article><span className={styles.setupLabel}>Patients</span><h3>Browse, then choose a provider.</h3><p>No account needed to search. Booking and contact options are shown on each provider’s page.</p><Link href="/browse" prefetch={false} className={styles.textLink}>Browse care <ArrowRight size={17} aria-hidden="true" /></Link></article>
          <article><span className={styles.setupLabel}>Clinic & hospital teams</span><h3>Request an assisted setup.</h3><p>Send your practice details. Our team reviews the request, confirms your plan and sets up the organisation.</p><Link href="/onboarding?mode=new_org" prefetch={false} className={styles.textLink}>Request clinic setup <ArrowRight size={17} aria-hidden="true" /></Link></article>
          <article><span className={styles.setupLabel}>Pharmacy teams</span><h3>Verify your business email.</h3><p>Choose an eligible published trial when available, then continue with the required branch setup.</p><Link href="/pharmacy-start" prefetch={false} className={styles.textLink}>Start pharmacy onboarding <ArrowRight size={17} aria-hidden="true" /></Link></article>
        </div>
      </section>

      <section id="plans" className={styles.planSection} aria-labelledby="plans-heading"><div className={styles.container}>
        <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>Clinic & hospital plans</p><h2 id="plans-heading">Choose a plan for your practice.</h2></div><p>Compare pricing and team capacity. Our team confirms your plan, included tools and trial terms before activation.</p></div>
        <HomePricing />
        <p className={styles.pharmacyPlanNote}>Looking for a pharmacy plan? <Link href="/pharmacy-start" prefetch={false}>View eligible pharmacy trials <ArrowRight size={14} aria-hidden="true" /></Link></p>
      </div></section>

      <section className={`${styles.questions} ${styles.container}`} aria-labelledby="questions-heading"><div><p className={styles.eyebrow}>A few practical answers</p><h2 id="questions-heading">Before you begin.</h2><p>Still have a question?</p><a href="mailto:ekavyuofficial@gmail.com" className={styles.textLink}>Talk to the Ekavyu team <ArrowRight size={17} aria-hidden="true" /></a></div><div className={styles.disclosures}>{questions.map((item, index) => <details key={item.question}><summary><span>{item.question}</span><ChevronDown size={18} aria-hidden="true" /></summary><p id={index === 4 ? "whatsapp-question" : undefined} tabIndex={index === 4 ? -1 : undefined}>{item.answer}</p></details>)}</div></section>
      <section className={styles.finalCta} aria-labelledby="next-heading"><div className={styles.container}><div><p className={styles.eyebrow}>Care, connected.</p><h2 id="next-heading">Find care. Or bring your team.</h2><p className={styles.closingDescription}>Start with a search or choose a workspace for your business.</p></div><div className={styles.finalActions}><HomeAction href="/browse">Browse care <ArrowRight size={18} aria-hidden="true" /></HomeAction><Link href="/onboarding?mode=new_org" prefetch={false} className={styles.textLink}>Request clinic setup <ArrowRight size={17} aria-hidden="true" /></Link><Link href="/pharmacy-start" prefetch={false} className={styles.textLink}>Start pharmacy onboarding <ArrowRight size={17} aria-hidden="true" /></Link></div></div></section>
    </main>
    <footer className={`${styles.footer} ${styles.container}`}>
      <div className={styles.footerTop}><div><Link href="/" className={styles.brand} aria-label="Ekavyu home"><EkavyuLogo size="md" /></Link><p>For patients, clinics and pharmacies.</p></div><div className={styles.footerLinks}><nav aria-label="Explore Ekavyu"><h3>Explore</h3><Link href="/browse" prefetch={false}>Browse care</Link><a href="#for-organizations">For clinics & hospitals</a><a href="#for-pharmacies">For pharmacies</a></nav><nav aria-label="Get started"><h3>Get started</h3><Link href="/pricing" prefetch={false}>Compare plans</Link><Link href="/login" prefetch={false}>Sign in</Link><a href="mailto:ekavyuofficial@gmail.com">Contact the team</a></nav></div></div>
      <div className={styles.footerBottom}><small>© {new Date().getFullYear()} Ekavyu</small><span>Patients. Practices. Pharmacies.</span></div>
    </footer>
  </div>;
}
