"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./home.module.css";

export interface ProductScreen {
  id: string;
  label: string;
  title: string;
  description: string;
  alt: string;
  moment?: string;
}

export default function ProductScreenshots({ screens, audience }: { screens: readonly ProductScreen[]; audience: "patient" | "clinic" | "communications" }) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const screen = screens[selected];
  const headingId = `${audience}-screenshot-heading`;
  return <div className={styles.productEvidence} data-audience={audience} data-screen={screen.id}>
    <div className={styles.screenshotControls} role="group" aria-label={`Explore ${audience} screens`}>
      {screens.map((item, index) => <button type="button" key={item.id} aria-pressed={selected === index} aria-controls={`${audience}-product-screen`} onClick={() => setSelected(index)}>{item.label}</button>)}
    </div>
    <figure id={`${audience}-product-screen`} aria-labelledby={headingId}>
      <div className={styles.screenshotChrome}><span>EKAVYU · ACTUAL APPLICATION</span><span>Demonstration data</span></div>
      <div className={styles.screenshotFrame}>
        {failed === screen.id ? <div className={styles.screenshotUnavailable}><p>The product image couldn’t be loaded.</p><Link href={audience === "patient" ? "/browse" : "/onboarding?mode=new_org"} prefetch={false}>{audience === "patient" ? "Explore doctors and clinics" : "Ask about clinic setup"} <ArrowRight size={15} aria-hidden="true" /></Link></div> : <picture key={screen.id}>
          <source media="(max-width: 639px)" srcSet={`/landing/product/${screen.id}-mobile.webp`} />
          {/* Exact pre-optimized viewport captures; the responsive frame reserves space. */}
          <img src={`/landing/product/${screen.id}-desktop.webp`} alt={screen.alt} width={1200} height={800} loading="lazy" decoding="async" onError={() => setFailed(screen.id)} />
        </picture>}
      </div>
      <figcaption className={styles.screenshotCaption} aria-live="polite" aria-atomic="true">{screen.moment && <span className={styles.screenshotMoment}>{screen.moment}</span>}<h3 id={headingId}>{screen.title}</h3><p>{screen.description}</p><a href={`/landing/product/${screen.id}-desktop.webp`} target="_blank" rel="noreferrer" className={styles.screenshotOriginal}>Open full-size screenshot <ArrowRight size={14} aria-hidden="true" /></a><small>Captured from Ekavyu with isolated synthetic records. All people, activity, prices and delivery states shown are illustrative.</small></figcaption>
    </figure>
  </div>;
}
