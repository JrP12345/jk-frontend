"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./PharmacyCounter.module.css";

export function PharmacyCounterFilters({ children }: { children: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const update = () => {
      const start = element.scrollLeft > 1, end = element.scrollWidth - element.clientWidth - element.scrollLeft > 1;
      setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
    };
    const frame = requestAnimationFrame(update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); element.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return <div className={styles.filterViewport} data-fade-start={edges.start || undefined} data-fade-end={edges.end || undefined}>
    <div ref={strip} className={styles.filters} role="group" aria-label="Filter product results by unit" tabIndex={0}>{children}</div>
  </div>;
}
