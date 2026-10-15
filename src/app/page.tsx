import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, Check, ClipboardList, ListOrdered, Mail, Receipt, Search, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import EkavyuLogo from "@/components/ui/EkavyuLogo";
import HomeNavigation from "./home/HomeNavigation";
import HomePricing from "./home/HomePricing";
import styles from "./home/home.module.css";
import { getSiteUrl } from "@/lib/siteUrl";

const title = "Ekavyu — Practice management for healthcare teams";
const description = "Clinic and practice management software for your healthcare team. Connect appointments, walk-ins, patient queues, consultations and visit billing with Ekavyu.";
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title,
  description,
  ...(siteUrl ? { metadataBase: siteUrl, alternates: { canonical: "/" } } : {}),
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Ekavyu",
    ...(siteUrl ? { url: "/", images: [{ url: "/ekavyu-home-social.png", width: 1200, height: 630, alt: "Ekavyu — Clinic and practice management. Booking, reception, consultations and billing." }] } : {}),
  },
  twitter: {
    card: siteUrl ? "summary_large_image" : "summary",
    title,
    description,
    ...(siteUrl ? { images: ["/ekavyu-home-social.png"] } : {}),
  },
};

const workflow = [
  { icon: CalendarDays, title: "Book or register", description: "Bring online bookings and walk-ins into the appointment list. Find an existing patient or register a new one." },
  { icon: ListOrdered, title: "Check in and call next", description: "Mark arrivals, see who is waiting and call the next patient from the doctor’s queue." },
  { icon: Stethoscope, title: "Consult with context", description: "Review available patient history, record consultation notes and prepare prescriptions." },
  { icon: Receipt, title: "Complete the visit", description: "Create the visit invoice and track recorded payments and outstanding balances." },
];

const team = [
  { role: "Reception", icon: ClipboardList, title: "A clear front desk.", description: "Register walk-ins, manage bookings and check patients in without losing sight of the waiting queue." },
  { role: "Doctors", icon: Stethoscope, title: "Context for the next patient.", description: "Move from the queue into the consultation, with available history, notes and prescriptions together." },
  { role: "Practice owners", icon: UserRound, title: "A view across the practice.", description: "Coordinate staff and locations. Review appointments, collections and pending balances from your workspace." },
];

const questions = [
  { question: "What happens after I request setup?", answer: "Share your practice name, city and contact details in the setup form. Our team reviews the request and contacts you to confirm your plan and setup before activating the organization." },
  { question: "Can we use it for a single-doctor practice?", answer: "Yes. Ekavyu supports independent doctors as well as teams with reception staff and multiple locations. The number of doctors, staff members and locations depends on your plan." },
  { question: "Does it handle walk-ins as well as online bookings?", answer: "Yes. Reception can register a walk-in or find an existing patient, add the visit and manage arrival in the queue. Patients can also book online where the provider has enabled booking." },
  { question: "Who can access patient information?", answer: "Staff access follows assigned roles, permissions and location access. Patients sign in to view available visits and records linked to their account. Available modules and clinical information depend on the organization’s setup and access rules." },
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
          <p className={styles.eyebrow}>CLINIC &amp; PRACTICE MANAGEMENT SOFTWARE</p>
          <h1 id="hero-heading">Run your practice.<br /><span>Connect every visit.</span></h1>
          <p className={styles.heroDescription}>From booking to billing, give reception and doctors one connected way to manage the practice day.</p>
          <div className={styles.actions}>
            <Link href="/onboarding?mode=new_org" className={styles.primaryButton} data-home-event="home_organization_setup">Request setup <ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#how-it-works" className={styles.secondaryButton}>See how it works</a>
          </div>
          <p className={styles.heroNote}>For independent doctors, clinics and healthcare teams.<br />Share your practice details. Our team helps you get set up.</p>
        </div>

        <figure className={styles.practicePreview} aria-labelledby="preview-heading">
          <div className={styles.previewHeader}><span className={styles.previewMark} aria-hidden="true"><ListOrdered size={19} /></span><div><p>AN EXAMPLE PRACTICE DAY</p><h2 id="preview-heading">Everyone knows what’s next.</h2></div></div>
          <div className={styles.queuePreview}>
            <div className={styles.queueHeading}><span>Doctor’s queue</span><span>3 example visits</span></div>
            <ol className={styles.queueRows}>
              <li><span className={styles.activeToken}>12</span><div><strong>Patient A</strong><span>With the doctor</span></div><span className={styles.consultingStatus}><span aria-hidden="true" />In consultation</span></li>
              <li><span className={styles.token}>13</span><div><strong>Patient B</strong><span>Checked in at reception</span></div><span className={styles.arrivedStatus}>Arrived</span></li>
              <li><span className={styles.token}>14</span><div><strong>Patient C</strong><span>Appointment booked</span></div><span className={styles.bookedStatus}>Not arrived</span></li>
            </ol>
            <div className={styles.handoff}><Check size={16} aria-hidden="true" /><span>Reception checks in. The doctor sees who’s waiting.</span></div>
          </div>
          <figcaption>Illustrative workflow · No live patient information</figcaption>
        </figure>
      </section>

      <section id="how-it-works" className={`${styles.workflow} ${styles.container}`} aria-labelledby="workflow-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>FROM THE FIRST BOOKING TO THE FINAL BILL</p><h2 id="workflow-heading">One visit. A clear path.</h2></div><p>Help each person pick up where the last one left off.</p></div>
        <ol className={styles.workflowSteps}>
          {workflow.map((step, index) => { const Icon = step.icon; return <li key={step.title}><div className={styles.stepMarker}><span>0{index + 1}</span><Icon size={22} aria-hidden="true" /></div><div><h3>{step.title}</h3><p>{step.description}</p></div></li>; })}
        </ol>
      </section>

      <section id="for-organizations" className={styles.teamSection} aria-labelledby="team-heading">
        <div className={styles.container}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>ONE PRACTICE. DIFFERENT RESPONSIBILITIES.</p><h2 id="team-heading">A workspace for the work you do.</h2></div><p>From a single-doctor practice to a team working across locations.</p></div>
          <div className={styles.teamGrid}>{team.map(item => { const Icon = item.icon; return <article key={item.role}><p className={styles.roleLabel}><Icon size={17} aria-hidden="true" />{item.role}</p><h3>{item.title}</h3><p>{item.description}</p></article>; })}</div>
          <div className={styles.accessNote}><ShieldCheck size={21} aria-hidden="true" /><p><strong>The right access for each role.</strong> Staff access follows assigned permissions and locations. Available capabilities depend on your organization’s enabled modules and plan.</p></div>
        </div>
      </section>

      <section id="plans" className={`${styles.plans} ${styles.container}`} aria-labelledby="plans-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PLANS &amp; ASSISTED SETUP</p><h2 id="plans-heading">Start with the team you have.</h2></div><p>Compare current prices and capacity. We’ll confirm your setup and plan before activation.</p></div>
        <HomePricing />
      </section>

      <section className={`${styles.getStarted} ${styles.container}`} aria-labelledby="setup-heading">
        <div className={styles.setupCopy}><p className={styles.eyebrow}>YOUR NEXT STEP</p><h2 id="setup-heading">Let’s talk about your practice.</h2><p>Tell us your practice name, city and how to reach you. We’ll review your request and help confirm the right setup.</p><Link href="/onboarding?mode=new_org" className={styles.primaryButton} data-home-event="home_organization_setup">Request setup <ArrowRight size={18} aria-hidden="true" /></Link><a href="mailto:ekavyuofficial@gmail.com" className={styles.textLink}><Mail size={16} aria-hidden="true" /> Prefer email? Contact the team</a></div>
        <div className={styles.questions}><h3>Before you get started</h3><div className={styles.disclosures}>{questions.map(item => <details key={item.question}><summary><span>{item.question}</span><span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></div>
      </section>

      <section id="for-patients" className={styles.patientSection} aria-labelledby="patients-heading"><div className={styles.container}><div><p className={styles.eyebrow}>HERE AS A PATIENT?</p><h2 id="patients-heading">Your next visit starts here.</h2><p>Explore doctors and locations without an account. Book where available, or sign in for your linked visits, records and bills.</p></div><div className={styles.patientActions}><Link href="/browse" className={styles.primaryButton} data-home-event="home_find_care">Find care <Search size={17} aria-hidden="true" /></Link><Link href="/login" className={styles.textLink}>Patient sign in <ArrowRight size={16} aria-hidden="true" /></Link></div></div></section>
    </main>
    <footer className={`${styles.footer} ${styles.container}`}><div><Link href="/" aria-label="Ekavyu home"><EkavyuLogo size="sm" /></Link><p>Care That Keeps Moving</p></div><nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#plans">Plans</a><Link href="/browse">Find care</Link><Link href="/login">Sign in</Link><a href="mailto:ekavyuofficial@gmail.com">Contact</a></nav><small>© {new Date().getFullYear()} Ekavyu</small></footer>
  </div>;
}
