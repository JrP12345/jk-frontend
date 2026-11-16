"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";
import styles from "./home.module.css";

export interface ProductScreen {
  id: string;
  label: string;
  title: string;
  description: string;
  alt: string;
}

export default function ProductScreenshots({ screens, audience }: { screens: readonly ProductScreen[]; audience: "patient" | "clinic" | "pharmacy" }) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const screen = screens[selected];
  const headingId = `${audience}-screenshot-heading`;
  return <div className={styles.productEvidence} data-audience={audience} data-screen={screen.id}>
    {screens.length > 1 && <div className={styles.screenshotControls} role="group" aria-label={`Explore ${audience} screens`}>
      {screens.map((item, index) => <Button variant={selected === index ? "secondary" : "ghost"} size="sm" key={item.id} aria-pressed={selected === index} aria-controls={`${audience}-product-screen`} onClick={() => setSelected(index)}><span className="inline-flex w-full min-w-0 items-center gap-2.5">{audience === "clinic" && <span className={styles.screenNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}<span>{item.label}</span>{audience === "clinic" && <ArrowRight className={styles.screenArrow} size={15} aria-hidden="true" />}</span></Button>)}
    </div>}
    <figure id={`${audience}-product-screen`} aria-labelledby={headingId}>
      <div className={styles.screenshotChrome}><span><i aria-hidden="true" />Ekavyu · {audience === "patient" ? "Finding care" : audience === "clinic" ? "Clinic workspace" : "Pharmacy workspace"}</span></div>
      <div className={styles.screenshotFrame}>
        {failed === screen.id ? <div className={styles.screenshotUnavailable}><p role="status">The product image couldn’t be loaded.</p><Button variant="outline" size="sm" onClick={() => setFailed(null)}>Retry image</Button><Link href={audience === "patient" ? "/browse" : audience === "pharmacy" ? "/pharmacy-start" : "/onboarding?mode=new_org"} prefetch={false}>{audience === "patient" ? "Explore doctors and clinics" : audience === "pharmacy" ? "Explore pharmacy onboarding" : "Ask about clinic setup"} <ArrowRight size={15} aria-hidden="true" /></Link></div> : <picture key={screen.id}>
          <source media="(max-width: 639px)" srcSet={`/landing/product/${screen.id}-mobile.webp`} />
          {/* Exact pre-optimized viewport captures; the responsive frame reserves space. */}
          <img src={`/landing/product/${screen.id}-desktop.webp`} alt={screen.alt} width={1200} height={800} loading="lazy" decoding="async" onError={() => setFailed(screen.id)} />
        </picture>}
      </div>
      <figcaption className={styles.screenshotCaption} aria-live="polite" aria-atomic="true"><div><h3 id={headingId}>{screen.title}</h3><p>{screen.description}</p></div><a href={`/landing/product/${screen.id}-desktop.webp`} target="_blank" rel="noreferrer" className={styles.screenshotOriginal}>View full screen <ArrowRight size={14} aria-hidden="true" /></a></figcaption>
    </figure>
  </div>;
}
