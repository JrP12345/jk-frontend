"use client";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import type { PharmacyCapabilities } from "@/lib/pharmacyCapabilities";
import { pharmacyGuideOpening, pharmacyGuideRecovery, pharmacyStaffGuide, pharmacyStaffGuideText } from "@/lib/pharmacyStaffGuide";

export function PharmacyStaffGuide({ capabilities, onNavigate }: { capabilities: PharmacyCapabilities; onNavigate: (tab: string) => void }) {
  const tasks = pharmacyStaffGuide(capabilities), [error, setError] = useState("");
  if (!tasks.length) return null;
  function download() {
    let url: string | undefined;
    const anchor = document.createElement("a");
    try {
      url = URL.createObjectURL(new Blob([pharmacyStaffGuideText(capabilities)], { type: "text/plain;charset=utf-8" }));
      anchor.href = url; anchor.download = "ekavyu-pharmacy-staff-guide.txt"; document.body.appendChild(anchor); anchor.click(); setError("");
    } catch { setError("The staff guide could not be downloaded. The same instructions are available below."); }
    finally { anchor.remove(); if (url) { const completed = url; setTimeout(() => URL.revokeObjectURL(completed), 1000); } }
  }
  return <details className="min-w-0 rounded-control border border-border bg-surface p-3">
    <summary className="cursor-pointer text-sm font-semibold">First-day and daily staff guide</summary>
    <section aria-label="Pharmacy daily staff guide" className="space-y-4 pt-3 text-sm">
      <p>{pharmacyGuideOpening}</p><Button size="sm" variant="outline" onClick={download}>Download your daily staff guide</Button>
      {error && <Alert variant="error" title="Guide download unavailable">{error}</Alert>}
      <div className="grid min-w-0 gap-3 lg:grid-cols-2">{tasks.map(task => <details key={task.id} className="min-w-0 space-y-3 rounded-control border border-border p-3">
        <summary className="cursor-pointer font-semibold">{task.title}</summary><ol className="list-decimal space-y-2 pl-5">{task.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <p><strong>Check: </strong>{task.check}</p>
        {task.tab && task.action && <Button size="sm" variant="outline" onClick={() => onNavigate(task.tab!)}>{task.action}</Button>}
      </details>)}</div>
      {capabilities.actions.sell && <p>Counter keys: F1 search, F2 new bill, F4 hold, F6 discount, F8 payment, F10 save. Check the visible shortcut bar on your PC; a browser or scanner can intercept a key.</p>}
      <p>{pharmacyGuideRecovery}</p>
    </section>
  </details>;
}
