import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, Check, ListOrdered, Mail, Search, Stethoscope } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EkavyuLogo from "@/components/ui/EkavyuLogo";
import HomeNavigation from "./home/HomeNavigation";
import HomePricing from "./home/HomePricing";
import styles from "./home/home.module.css";

const title = "Ekavyu — Practice management for healthcare teams";
const description = "Practice management software for doctors, locations, hospitals and healthcare teams. Manage appointments, reception and consultations, with connected patient booking and visit information.";
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
  { icon: CalendarDays, title: "Appointments, sorted.", description: "Online bookings and walk-ins, ready for your front desk." },
  { icon: ListOrdered, title: "Keep the queue moving.", description: "Check patients in and give your team a clear view of who is next." },
  { icon: Stethoscope, title: "More context for care.", description: "Patient history, consultation notes and prescriptions in one workspace." },
];

export default async function Home() {
  const cookieStore = await cookies();
  const isBookingGuest = cookieStore.get("ekavyu_session")?.value === "guest";
  if (!isBookingGuest && (cookieStore.has("refresh_token") || cookieStore.has("access_token"))) redirect("/dashboard");
  return <div className={styles.home}>
    <a href="#main-content" className={styles.skipLink}>Skip to content</a>
    <HomeNavigation />
    <main id="main-content">
      <section className={[styles.hero, styles.container].join(" ")} aria-labelledby="hero-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.smallMark} aria-hidden="true" /> PRACTICE MANAGEMENT, MADE SIMPLE</p>
          <h1 id="hero-heading">Your care team.<br /><span>One clear workspace.</span></h1>
          <p className={styles.heroDescription}>Appointments, reception and consultations. Together, so your team can focus on care.</p>
          <div className={styles.actions}><Link href="/onboarding?mode=new_org" className={styles.primaryButton} data-home-event="home_organization_setup">Request setup <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/browse" className={styles.textLink} data-home-event="home_find_care">Find care <ArrowRight size={17} aria-hidden="true" /></Link></div>
          <p className={styles.heroNote}>For independent doctors and growing healthcare teams.</p>
        </div>
        <Card padding="none" className={styles.simplePreview}>
          <div className={styles.snapshotHeader}><span><Building2 size={18} aria-hidden="true" /> Your practice day</span><Badge variant="outline" size="sm">Illustrative</Badge></div>
          <div className={styles.previewGreeting}><p>A little more clarity.</p><h2>From arrival to care.</h2></div>
          <ol className={styles.simpleSteps}>
            <li><span><CalendarDays size={21} aria-hidden="true" /></span><div><h3>Appointment booked</h3><p>Ready for reception</p></div><Check size={18} aria-hidden="true" /></li>
            <li><span><ListOrdered size={21} aria-hidden="true" /></span><div><h3>Patient checked in</h3><p>Added to the doctor's queue</p></div><Check size={18} aria-hidden="true" /></li>
            <li><span><Stethoscope size={21} aria-hidden="true" /></span><div><h3>Consultation begins</h3><p>History, notes and prescriptions together</p></div></li>
          </ol>
          <p className={styles.snapshotNote}>A sample workflow. No live patient information.</p>
        </Card>
      </section>
      <section id="how-it-works" className={[styles.simpleFeatures, styles.container].join(" ")} aria-labelledby="features-heading">
        <div id="for-organizations"><p className={styles.eyebrow}>LESS TO JUGGLE</p><h2 id="features-heading">The essentials for your practice.</h2></div>
        <div className={styles.featureGrid}>{capabilities.map(item => { const Icon = item.icon; return <article key={item.title}><Icon size={25} aria-hidden="true" /><h3>{item.title}</h3><p>{item.description}</p></article>; })}</div>
        <p className={styles.boundary}>Start with one doctor or coordinate a larger team. Access follows your team's roles and enabled modules.</p>
      </section>
      <section id="for-patients" className={styles.careBand} aria-labelledby="patients-heading"><div className={styles.container}><div><p className={styles.eyebrow}>LOOKING FOR A DOCTOR?</p><h2 id="patients-heading">Find care. Book where available.</h2><p>Explore locations without an account. Sign in when you need your linked visits and records.</p></div><Link href="/browse" className={styles.lightButton} data-home-event="home_find_care">Find care <Search size={18} aria-hidden="true" /></Link></div></section>
      <section id="plans" className={[styles.simplePlans, styles.container].join(" ")} aria-labelledby="plans-heading"><p className={styles.eyebrow}>ROOM TO GROW</p><h2 id="plans-heading">A plan for your practice.</h2><p className={styles.sectionIntro}>Choose the capacity your team needs. We'll help you get started.</p><HomePricing /></section>
      <section className={[styles.simpleQuestions, styles.container].join(" ")} aria-labelledby="questions-heading"><h2 id="questions-heading">Before you get started.</h2><div className={styles.disclosures}>
        <details><summary><span>What happens when I request setup?</span><span aria-hidden="true">+</span></summary><p>Submit your practice and contact details directly through the form. Our team reviews your request and contacts you to confirm the plan and setup before activation.</p></details>
        <details><summary><span>Can we manage walk-ins?</span><span aria-hidden="true">+</span></summary><p>Yes. Reception can register walk-ins alongside online appointments, check patients in and manage the daily queue.</p></details>
        <details><summary><span>Who can see patient information?</span><span aria-hidden="true">+</span></summary><p>Team access follows assigned roles and permissions. Patients see available information saved by their provider and linked to their account.</p></details>
      </div></section>
      <section className={styles.simpleClosing} aria-labelledby="closing-heading"><div className={styles.container}><h2 id="closing-heading">Let's set up your practice.</h2><p>Tell us about your team. We'll take it from there.</p><Link href="/onboarding?mode=new_org" className={styles.primaryButton} data-home-event="home_organization_setup">Request setup <ArrowRight size={18} aria-hidden="true" /></Link></div></section>
    </main>
    <footer className={[styles.footer, styles.container].join(" ")}><Link href="/" aria-label="Ekavyu home"><EkavyuLogo size="sm" /></Link><nav aria-label="Footer navigation"><Link href="/browse">Find care</Link><a href="#plans">Plans</a><a href="mailto:ekavyuofficial@gmail.com"><Mail size={15} aria-hidden="true" /> Contact</a></nav><small>© {new Date().getFullYear()} Ekavyu</small></footer>
  </div>;
}
