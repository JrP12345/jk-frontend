"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { Button, cn } from "@/components/ui";
import marketplace from "@/components/MarketplaceLayout.module.css";
import styles from "./FacilityProfile.module.css";

/** Keep booking reachable after its card leaves the usable phone viewport. */
export default function FacilityBookingBar({ fee, label, onBook }: { fee: string; label: string; onBook: () => void }) {
  const [cardVisible, setCardVisible] = useState(true);

  useEffect(() => {
    const card = document.querySelector("[data-facility-doctor]");
    if (!card || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(() => {
      // Read current geometry: an observer entry may predate a layout shift.
      const rect = card.getBoundingClientRect();
      setCardVisible(rect.height > 0 && rect.bottom > 64 && rect.top < window.innerHeight);
    }, { rootMargin: "-64px 0px 0px 0px", threshold: 0 });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return <div role="region" aria-label="Appointment booking" hidden={cardVisible} className={styles.bookingBar}>
    <div className={cn(marketplace.content, styles.bookingBarContent)}>
      <div className={styles.bookingBarFee}><p className="text-xs text-text-secondary">Consultation fee</p><p className="text-lg font-semibold text-text">{fee}</p></div>
      <Button size="sm" className="min-h-11!" onClick={onBook} icon={<Calendar aria-hidden="true" />}>{label}</Button>
    </div>
  </div>;
}
