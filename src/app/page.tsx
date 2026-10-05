import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowRight, Building2, CalendarDays, Check, FileText, ListOrdered, Mail, Search, Stethoscope } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EkavyuLogo from "@/components/ui/EkavyuLogo";
import HomeNavigation from "./home/HomeNavigation";
import VisitPreview from "./home/VisitPreview";
import HomePricing from "./home/HomePricing";
import styles from "./home/home.module.css";

const title = "Ekavyu — Practice management for healthcare teams";
const description = "Practice management software for doctors, clinics and care teams. Manage appointments, reception and consultations, with connected patient booking and visit information.";
function getSiteUrl() {
  try {
    const value = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!value) return undefined;
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}
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
    ...(siteUrl ? { url: "/", images: [{ url: "/ekavyu-home-social.png", width: 1200, height: 630, alt: "Ekavyu — Practice management for your care team. Appointments, reception and consultations in one workspace." }] } : {}),
  },
  twitter: {
    card: siteUrl ? "summary_large_image" : "summary",
    title,
    description,
    ...(siteUrl ? { images: ["/ekavyu-home-social.png"] } : {}),
  },
};

const capabilities = [
  { icon: ListOrdered, title: "Run reception", role: "FOR YOUR FRONT DESK", description: "Appointments and walk-ins enter the same daily workflow.", detail: "Patient registration · Arrival · Queue" },
  { icon: Stethoscope, title: "Carry out the consultation", role: "FOR YOUR DOCTORS", description: "Work with today’s patients and the context of their visit.", detail: "Patient history · Notes · Prescriptions" },
  { icon: Building2, title: "Coordinate your practice", role: "FOR THE TEAM RUNNING IT", description: "Assign doctors and staff to the locations where they work.", detail: "Team access · Locations · Schedules" },
  { icon: FileText, title: "Keep the visit recorded", role: "AFTER THE CONSULTATION", description: "Save care information and handle supported visit billing.", detail: "Visit records · Invoices · Payments" },
];

const practiceSizes = [
  { title: "Start simple", description: "One doctor and receptionist. Essential patient entry and a focused consultation view." },
  { title: "Add your team", description: "Multiple doctors and staff, with assigned access and schedules." },
  { title: "Work across locations", description: "Location-specific teams within your organization’s plan and enabled workflows." },
];

export default async function Home() {
  const cookieStore = await cookies();
  const isBookingGuest = cookieStore.get("ananta_session")?.value === "guest";
  if (!isBookingGuest && (cookieStore.has("refresh_token") || cookieStore.has("access_token"))) redirect("/dashboard");

  return (
    <div className={styles.home}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <HomeNavigation />
      <main id="main-content">
        <section className={`${styles.hero} ${styles.container}`} aria-labelledby="hero-heading">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.smallMark} aria-hidden="true" /> SOFTWARE FOR DOCTORS, CLINICS & CARE TEAMS</p>
            <h1 id="hero-heading">Practice management <br /><span>for your care team.</span></h1>
            <p className={styles.heroDescription}>Manage appointments, reception and consultations in one place.</p>
            <p className={styles.heroPatient}>Patients can find your doctors, book where available and follow their visit through the same system.</p>
            <div className={styles.actions}>
              <Link href="/onboarding?mode=new_org" className={styles.primaryButton} data-home-event="home_organization_setup">Request setup <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link href="/browse" className={styles.textLink} data-home-event="home_find_care">Find care <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
            <p className={styles.heroNote}>Assisted setup. We confirm your plan before activation.</p>
            <a href="#how-it-works" className={styles.workflowLink}>See how a visit works <ArrowDown size={15} aria-hidden="true" /></a>
          </div>
          <div className={styles.heroProduct}>
            <div className={styles.snapshotLabel}><span>THE WORK YOUR TEAM DOES, TOGETHER</span><span className={styles.smallMark} aria-hidden="true" /></div>
            <Card padding="none" className={styles.practiceSnapshot}>
              <div className={styles.snapshotHeader}><span><Building2 size={17} aria-hidden="true" /> Practice workspace</span><Badge variant="outline" size="sm">Illustrative</Badge></div>
              <ol className={styles.snapshotSteps}>
                <li><span className={styles.snapshotToken}>14</span><div><span>APPOINTMENT</span><h2>A patient books a visit.</h2><p>The appointment reaches your team.</p></div><Check size={18} aria-hidden="true" /></li>
                <li><span className={styles.snapshotIcon}><ListOrdered size={20} aria-hidden="true" /></span><div><span>RECEPTION</span><h2>Your front desk receives it.</h2><p>Check-in and queue, in one view.</p></div></li>
                <li><span className={styles.snapshotIcon}><Stethoscope size={20} aria-hidden="true" /></span><div><span>CONSULTATION</span><h2>The doctor carries it forward.</h2><p>Patient context, notes and prescriptions.</p></div></li>
              </ol>
              <p className={styles.snapshotNote}>One sample visit. One shared workspace.</p>
            </Card>
            <p className={styles.snapshotCaption}>Online booking and walk-ins connect to the team’s visit workflow.</p>
          </div>
        </section>

        <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-heading">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>SEE THE PATIENT JOURNEY</p><h2 id="workflow-heading">One visit. <br /><span>From booking to recorded care.</span></h2></div>
              <p>Reception and doctors work on the same visit. Patients experience the other side through booking, tracking and available information.</p>
            </div>
            <VisitPreview />
          </div>
        </section>

        <section id="for-organizations" className={styles.teams} aria-labelledby="teams-heading">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.eyebrow}>WHAT YOUR TEAM GETS</p><h2 id="teams-heading">The daily work of your practice. <br /><span>In one system.</span></h2></div>
              <p>Give reception, doctors and the people managing your practice a workspace for their part of the visit.</p>
            </div>
            <div className={styles.capabilities}>
              {capabilities.map(item => {
                const Icon = item.icon;
                return <div key={item.title}><Icon size={24} aria-hidden="true" /><div><p className={styles.capabilityRole}>{item.role}</p><h3>{item.title}</h3><p>{item.description}</p><span>{item.detail}</span></div></div>;
              })}
            </div>
            <p className={styles.boundary}>Available actions follow your team’s permissions and enabled modules.</p>
            <div className={styles.practiceScale}>
              <div><p className={styles.eyebrow}>BUILT FOR YOUR WAY OF WORKING</p><h3>Start with the team you have.</h3></div>
              <ol>{practiceSizes.map((size, index) => <li key={size.title}><span>0{index + 1}</span><h4>{size.title}</h4><p>{size.description}</p></li>)}</ol>
            </div>
            <div className={styles.teamActions}><Link href="/onboarding?mode=new_org" className={styles.lightButton} data-home-event="home_organization_setup">Request setup <ArrowRight size={17} aria-hidden="true" /></Link><a href="#plans" className={styles.textLink}>Compare plans <ArrowDown size={16} aria-hidden="true" /></a></div>
          </div>
        </section>

        <section id="for-patients" className={styles.patients} aria-labelledby="patients-heading">
          <div className={`${styles.container} ${styles.patientGrid}`}>
            <div><p className={styles.eyebrow}>FOR PATIENTS</p><h2 id="patients-heading">Your provider’s workspace. <br /><span>Your way into care.</span></h2><div className={styles.actions}><Link href="/browse" className={styles.textLink} data-home-event="home_find_care">Find care <ArrowRight size={17} aria-hidden="true" /></Link><Link href="/login" className={styles.textLink} data-home-event="home_sign_in">Sign in for my visits <ArrowRight size={17} aria-hidden="true" /></Link></div></div>
            <ol className={styles.patientSteps}>
              <li><Search size={21} aria-hidden="true" /><div><h3>Find your doctor</h3><p>Explore doctors and facilities without an account.</p></div></li>
              <li><CalendarDays size={21} aria-hidden="true" /><div><h3>Book and follow your visit</h3><p>Book where availability is enabled. Follow queue progress from your appointment link; waiting times are estimates.</p></div></li>
              <li><FileText size={21} aria-hidden="true" /><div><h3>Return to your information</h3><p>See available visits, prescriptions and reports saved by your provider and linked to your account.</p></div></li>
            </ol>
          </div>
        </section>

        <section className={`${styles.trust} ${styles.container}`} aria-labelledby="trust-heading">
          <div><p className={styles.eyebrow}>BEFORE YOU CHOOSE</p><h2 id="trust-heading">A few practical <br />questions.</h2><a href="mailto:ekavyuofficial@gmail.com" className={styles.textLink}><Mail size={16} aria-hidden="true" /> Talk to the Ekavyu team</a></div>
          <div className={styles.disclosures}>
            <details open><summary><span>Can reception manage walk-ins and online bookings?</span><span aria-hidden="true">+</span></summary><p>Yes. Reception can register walk-ins, receive appointments, check patients in and manage the queue. Staff actions follow assigned permissions.</p></details>
            <details><summary><span>Will it work for a larger or hospital care team?</span><span aria-hidden="true">+</span></summary><p>Multiple doctors and locations can work with assigned schedules, team access and enabled modules within their plan. Hospital teams should confirm their required workflows with us before setup.</p></details>
            <details><summary><span>Who can see patient information?</span><span aria-hidden="true">+</span></summary><p>Team access follows roles and permissions. Patients see available records linked to them and saved by their provider. Personal records aren’t part of the public directory.</p></details>
            <details><summary><span>What happens when I request setup?</span><span aria-hidden="true">+</span></summary><p>The form prepares an email draft with your practice details and selected plan. Send it from your email app. Our team reviews the request and confirms activation, capacity and trial terms.</p></details>
          </div>
        </section>

        <section id="plans" className={styles.pricing} aria-labelledby="plans-heading">
          <div className={styles.container}>
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PLANS FOR YOUR PRACTICE</p><h2 id="plans-heading">Choose the capacity <br /><span>your team needs.</span></h2></div><p>Compare the current plans by locations, doctors and staff. Prices and trial terms come from the configured plans.</p></div>
            <HomePricing />
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-heading">
          <div className={styles.container}><p className={styles.eyebrow}>YOUR TEAM. YOUR PATIENTS. ONE EKAVYU.</p><h2 id="closing-heading">Bring your practice <br /><span>into one workspace.</span></h2><div className={styles.actions}><Link href="/onboarding?mode=new_org" className={styles.primaryButton} data-home-event="home_organization_setup">Request setup <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/browse" className={styles.textLink} data-home-event="home_find_care">Find care <ArrowRight size={17} aria-hidden="true" /></Link></div><p>Prepare a request. Agree on your setup with our team.</p></div>
        </section>
      </main>
      <footer className={`${styles.footer} ${styles.container}`}>
        <div><Link href="/" aria-label="Ekavyu home"><EkavyuLogo size="sm" /></Link><p>Care That Keeps Moving.</p></div>
        <nav aria-label="Footer navigation"><Link href="/browse">Find care</Link><a href="#plans">Plans</a><a href="mailto:ekavyuofficial@gmail.com">Contact</a></nav>
        <small>© {new Date().getFullYear()} Ekavyu</small>
      </footer>
    </div>
  );
}
