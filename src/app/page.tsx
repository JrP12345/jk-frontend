import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, Check, MessageCircle, BellRing, FileText, ShieldCheck } from "lucide-react";
import EkavyuLogo from "@/components/ui/EkavyuLogo";
import { getSiteUrl } from "@/lib/siteUrl";
import HomeNavigation from "./home/HomeNavigation";
import HomePricing from "./home/HomePricing";
import LivingAppointment from "./home/LivingAppointment";
import PatientDiscovery from "./home/PatientDiscovery";
import ClinicExperience from "./home/ClinicExperience";
import Communications from "./home/Communications";
import styles from "./home/home.module.css";

const title = "Ekavyu — Find doctors & manage clinic appointments";
const description = "Discover doctors and clinics, check appointment options and book where available. Ekavyu helps clinic teams manage bookings, walk-ins, consultations and visit billing.";
const siteUrl = getSiteUrl();
export const metadata: Metadata = {
  title, description,
  ...(siteUrl ? { metadataBase: siteUrl, alternates: { canonical: "/" } } : {}),
  openGraph: { title, description, type: "website", siteName: "Ekavyu", ...(siteUrl ? { url: "/", images: [{ url: "/ekavyu-home-social.png", width: 1200, height: 630, alt: "Ekavyu — Find your doctor. Manage your clinic day." }] } : {}) },
  twitter: { card: siteUrl ? "summary_large_image" : "summary", title, description, ...(siteUrl ? { images: ["/ekavyu-home-social.png"] } : {}) },
};

const questions = [
  { question: "Can I browse without an account?", answer: "Yes. Explore doctors and clinic locations without signing in. Open a provider’s profile to review their practice locations, fees and available booking or contact options." },
  { question: "Does every provider offer online booking?", answer: "No. Booking depends on the provider’s setup and available appointments. Where online booking is not enabled, use the contact options on the clinic’s page." },
  { question: "What happens after I book?", answer: "Review the booking status and keep your private tracker link for visit updates. Some appointments require payment before confirmation; follow the instructions shown and contact reception for verified payment guidance. Keep the tracker link private." },
  { question: "Can clinics manage walk-ins too?", answer: "Yes. Reception can find an existing patient or register a new one, add a walk-in visit and manage arrival alongside online appointments." },
  { question: "What can clinics send through WhatsApp?", answer: "With a configured connection, clinics can send supported booking updates, queue alerts and completed-visit prescriptions. Sending depends on recorded consent, recipient authorization, clinic settings, plan access, approved templates and available credits. Delivery status is visible in the workspace. WhatsApp is not a booking chatbot, and delivery is not guaranteed." },
  { question: "How do clinic setup and staff access work?", answer: "Our team reviews your setup request and confirms the plan before activating the organization. Staff access follows assigned roles, permissions and locations. Available tools and capacity depend on the enabled modules and selected plan." },
  { question: "Who should I contact for help?", answer: "For appointment changes, availability or payment instructions, contact the provider using the details on their clinic page. For help evaluating Ekavyu or requesting clinic setup, email ekavyuofficial@gmail.com." },
];

export default async function Home() {
  const cookieStore = await cookies();
  const isBookingGuest = cookieStore.get("ekavyu_session")?.value === "guest";
  if (!isBookingGuest && (cookieStore.has("refresh_token") || cookieStore.has("access_token"))) redirect("/dashboard");

  return <div className={styles.home}>
    <a href="#main-content" className={styles.skipLink}>Skip to content</a>
    <HomeNavigation />
    <main id="main-content" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <div className={`${styles.heroCopy} ${styles.container}`}>
          <p className={styles.heroPrelude}>Doctor discovery. Clinic coordination.</p>
          <h1 id="hero-heading">Find your doctor.<br /><span>Manage your clinic day.</span></h1>
          <p className={styles.heroDescription}>Explore doctors and clinics, and book appointments where available.<br />{" "}For clinic teams, coordinate arrivals, consultations, billing and patient updates.</p>
          <div className={styles.actions}>
            <Link href="/browse" prefetch={false} className={styles.primaryButton} data-home-event="home_find_care">Find a Doctor <ArrowRight size={17} aria-hidden="true" /></Link>
            <a href="#for-organizations" className={styles.secondaryButton}>For Clinics <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
          <p className={styles.heroReassurance}>Browse without an account. Clinic setup is assisted by our team.</p>
        </div>
        <div className={`${styles.heroProduct} ${styles.container}`}><LivingAppointment /></div>
        <div className={`${styles.audienceRibbon} ${styles.container}`}><span>SEE HOW EKAVYU WORKS</span><a href="#for-patients">Doctor discovery & booking <ArrowDown size={14} aria-hidden="true" /></a><a href="#for-organizations">Inside the clinic workspace <ArrowDown size={14} aria-hidden="true" /></a></div>
      </section>

      <section id="for-patients" className={styles.patientSection} aria-labelledby="patients-heading">
        <div className={`${styles.container} ${styles.journeyThread}`}><span className={styles.storyInitials} aria-hidden="true">AS</span><div><strong>One visit. The people who make it happen.</strong><p>Follow Anaya S. and Dr. Mira Shah at Aster Grove Clinic. Every person, visit and total in this example is fictional.</p></div><span className={styles.storyLabel}>AN ILLUSTRATIVE CLINIC DAY</span></div>
        <div className={`${styles.container} ${styles.patientLayout}`}>
          <div className={styles.patientCopy}><p className={styles.eyebrow}>01 / FOR PATIENTS</p><h2 id="patients-heading">Find a provider.<br /><em>Plan your visit.</em></h2><p>Search by city or specialty. Compare practice locations and fees, then check the booking options for the doctor you choose.</p><ol className={styles.patientSteps}><li><span>01</span>Explore doctors and clinic locations.</li><li><span>02</span>Review fees and available times.</li><li><span>03</span>Enter your details and check the booking status.</li></ol><Link href="/browse" prefetch={false} className={styles.textLink} data-home-event="home_find_care">Find a Doctor <ArrowRight size={18} aria-hidden="true" /></Link><p className={styles.smallNote}>Availability and payment requirements vary by provider.</p></div>
          <div className={styles.patientProduct}><PatientDiscovery /></div>
        </div>
        <div className={`${styles.container} ${styles.afterBooking}`}><div><p className={styles.eyebrow}>AFTER BOOKING</p><h3>Keep your visit details close.</h3></div><p>Check the status shown on your booking and save your private tracker link for updates. If payment is required before confirmation, follow the displayed instructions or contact reception.</p><Link href="/login" prefetch={false} className={styles.textLink}>Sign in to your account <ArrowRight size={15} aria-hidden="true" /></Link></div>
      </section>

      <section id="for-organizations" className={styles.clinicSection} aria-labelledby="clinics-heading">
        <div className={styles.container}>
          <div className={styles.clinicIntro}><div><p className={styles.eyebrow}>02 / INSIDE THE CLINIC</p><h2 id="clinics-heading">From the front desk<br /><em>to the consultation.</em></h2></div><div><p>Anaya’s visit is one part of a busy clinic day. Explore the actual workspaces for reception, the doctor and the people managing the practice.</p><Link href="/onboarding?mode=new_org" prefetch={false} className={styles.lightLink} data-home-event="home_organization_setup">Request clinic setup <ArrowRight size={17} aria-hidden="true" /></Link></div></div>
          <ClinicExperience />
          <div className={styles.clinicFooter}><span>Appointments & walk-ins</span><span>Arrivals & patient queues</span><span>Consultations & visit billing</span></div>
          <p className={styles.clinicScope}>Tools depend on your plan, enabled modules and staff permissions.</p>
        </div>
      </section>

      <section id="stay-connected" className={styles.communicationsSection} aria-labelledby="communications-heading">
        <div className={styles.container}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / WHATSAPP & TEAM UPDATES</p><h2 id="communications-heading">Keep patients updated.<br /><em>See delivery clearly.</em></h2></div><p>The same visit carries on beyond the front desk. Share supported patient updates through WhatsApp, and keep staff informed in their Ekavyu workspace.</p></div>
          <ul className={styles.communicationCapabilities}>
            <li><MessageCircle size={20} aria-hidden="true" /><div><h3>Booking updates</h3><p>Send the update that matches the booking’s actual status. Pending payment is not a confirmed visit.</p></div></li>
            <li><BellRing size={20} aria-hidden="true" /><div><h3>Queue communication</h3><p>Configured turn alerts help patients prepare. Staff can send delay alerts when the clinic is running late.</p></div></li>
            <li><FileText size={20} aria-hidden="true" /><div><h3>After the consultation</h3><p>Share an available prescription after the visit is completed, with the authorized recipient and consent.</p></div></li>
          </ul>
          <Communications />
          <p className={styles.communicationRequirements}>WhatsApp requires a configured connection, recorded consent, applicable plan access and approved templates. Shared connections also depend on message credits. Provider acceptance does not guarantee delivery or reading.</p>
        </div>
      </section>

      <section id="how-it-works" className={`${styles.setupSection} ${styles.container}`} aria-labelledby="setup-heading">
        <div className={styles.setupHeading}><div><p className={styles.eyebrow}>04 / MAKE ROOM FOR YOUR PRACTICE</p><h2 id="setup-heading">Your team.<br /><em>Your clinic’s next step.</em></h2></div><p>Tell us how your practice works. Our team reviews your request and confirms the plan, locations and tools before activating your organization.</p></div>
        <ol className={styles.setupSteps}><li><span>01</span><h3>Tell us about your practice.</h3><p>Share your practice name, city and contact details. Choose a plan or ask for help deciding.</p></li><li><span>02</span><h3>Confirm your plan and setup.</h3><p>Our team reviews your request and contacts you to confirm the right capacity and tools.</p></li><li><span>03</span><h3>Activate your organization.</h3><p>The team provisions the organization after review. Staff use the workspaces and locations assigned to them.</p></li></ol>
        <div className={styles.setupActions}><Link href="/onboarding?mode=new_org" prefetch={false} className={styles.primaryButton} data-home-event="home_organization_setup">Request clinic setup <ArrowRight size={17} aria-hidden="true" /></Link><a href="mailto:ekavyuofficial@gmail.com" className={styles.textLink}>Ask the team a question <ArrowRight size={16} aria-hidden="true" /></a></div>
        <div className={styles.accessNote}><ShieldCheck size={22} aria-hidden="true" /><strong>Access follows each person’s role.</strong><p>Assigned permissions and locations determine which clinic information staff can access.</p></div>
      </section>

      <section id="plans" className={styles.planSection} aria-labelledby="plans-heading"><div className={styles.container}>
        <div className={styles.planIntro}><div><p className={styles.eyebrow}>05 / PLANS THAT FIT YOUR PRACTICE</p><h2 id="plans-heading">Choose the capacity<br /><em>your practice needs.</em></h2></div><div><p>Compare current prices, billing periods and team limits. We’ll confirm your selected plan and setup before activation.</p><span className={styles.setupPill}><Check size={14} aria-hidden="true" />Current configured plans · Assisted activation</span></div></div>
        <HomePricing />
      </div></section>

      <section className={`${styles.questions} ${styles.container}`} aria-labelledby="questions-heading"><div><p className={styles.eyebrow}>BEFORE YOU BEGIN</p><h2 id="questions-heading">Practical questions.<br /><em>Direct answers.</em></h2><a href="mailto:ekavyuofficial@gmail.com" className={styles.textLink}>Contact the Ekavyu team <ArrowRight size={16} aria-hidden="true" /></a></div><div className={styles.disclosures}>{questions.map(item => <details key={item.question}><summary><span>{item.question}</span><span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>

      <section className={styles.finalCta} aria-labelledby="next-heading"><div className={styles.container}><p className={styles.eyebrow}>CHOOSE YOUR NEXT STEP</p><h2 id="next-heading">Looking for a doctor?<br /><em>Or tools for your clinic?</em></h2><div className={styles.actions}><Link href="/browse" prefetch={false} className={styles.primaryButton} data-home-event="home_find_care">Find a Doctor <ArrowRight size={17} aria-hidden="true" /></Link><Link href="/onboarding?mode=new_org" prefetch={false} className={styles.secondaryButton} data-home-event="home_organization_setup">Request clinic setup <ArrowRight size={17} aria-hidden="true" /></Link></div><p>Explore providers, or tell our team about your practice.</p></div></section>
    </main>
    <footer className={`${styles.footer} ${styles.container}`}><div><Link href="/" aria-label="Ekavyu home"><EkavyuLogo size="md" /></Link><p>Doctor discovery & clinic coordination</p></div><nav aria-label="Footer navigation"><Link href="/browse" prefetch={false}>Find a Doctor</Link><a href="#for-organizations">For Clinics</a><a href="#how-it-works">Clinic setup</a><Link href="/pricing" prefetch={false}>Compare plans</Link><Link href="/login" prefetch={false}>Sign in</Link><a href="mailto:ekavyuofficial@gmail.com">Contact</a></nav><div className={styles.footerBottom}><small>© {new Date().getFullYear()} Ekavyu</small><span>Patients. Doctors. Clinics.</span></div></footer>
  </div>;
}
