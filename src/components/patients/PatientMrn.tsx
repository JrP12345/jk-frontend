"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import Dialog from "@/components/ui/Modal";
import styles from "./PatientMrn.module.css";

/** Abbreviate only the mobile presentation; the stored identifier stays intact. */
export function PatientMrn({ value }: { value?: string }) {
  const [open, setOpen] = useState(false);
  if (!value) return <span className={styles.missing}>MRN: Not assigned</span>;

  return <>
    <span className={styles.desktop}>MRN: {value}</span>
    <button type="button" className={styles.mobile} aria-label="View full MRN" onClick={() => setOpen(true)}>
      MRN: {value.length > 18 ? `…${value.slice(-6)}` : value}
    </button>
    <Dialog isOpen={open} onClose={() => setOpen(false)} title="Patient MRN" size="sm"
      footer={<Button variant="secondary" onClick={() => setOpen(false)}>Done</Button>}>
      <p className={styles.full}>{value}</p>
    </Dialog>
  </>;
}
