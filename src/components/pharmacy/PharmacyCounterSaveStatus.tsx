"use client";
import { useEffect, useState } from "react";
import pos from "./PharmacyCounter.module.css";

/** Remains inside the existing checkout footer while the commit is in flight. */
export function PharmacyCounterSaveStatus({ phase, paid, inventoryMode = "tracked" }: { phase: "checking" | "saving"; paid: boolean; inventoryMode?: "tracked" | "billing_only" }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 3000); return () => clearTimeout(timer); }, []);
  return <p role="status" aria-label="Save progress" className={pos.saveStatus} title="Keep this bill open until the server confirms the result. No second Save is needed.">{slow
    ? "Still confirming; no second Save is needed."
    : phase === "checking" ? inventoryMode === "billing_only" ? "Checking current prices and supply details…" : "Checking current prices and stock…" : paid ? "Saving bill and payment together…" : "Saving bill…"}</p>;
}
